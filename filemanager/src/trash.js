const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const crypto = require("crypto");

const db = require("./db");
const files = require("./files");
const caseLifecycle = require("./caseLifecycle");

// Скрытая папка внутри хранилища. Имя начинается с точки — listDir такие
// записи пропускает, поэтому в файловом менеджере корзина не видна как
// обычная папка и не попадает ни в списки, ни в поиск, ни в архивы.
const TRASH_DIR = "/.trash";

// Сколько дней удалённое лежит в корзине, прежде чем стереться само.
const RETENTION_DAYS = Number(process.env.TRASH_RETENTION_DAYS || 30);

function trashRootAbs() {
  return files.safeResolve(TRASH_DIR);
}

/** Размер файла или папки целиком — чтобы показывать, сколько занято в корзине. */
async function sizeOf(abs) {
  const stat = await fsp.stat(abs);
  if (!stat.isDirectory()) return stat.size;
  let total = 0;
  for (const entry of await fsp.readdir(abs, { withFileTypes: true })) {
    total += await sizeOf(path.join(abs, entry.name));
  }
  return total;
}

function normalizePath(p) {
  const clean = "/" + String(p || "/").replace(/^\/+/, "").replace(/\/+$/, "");
  return clean === "" ? "/" : clean;
}

/**
 * Убирает персональные правила доступа на удаляемую папку и всё внутри неё,
 * возвращая их снимок. Если оставить правила висеть, новая папка с тем же
 * названием получила бы чужие права; если просто стереть — их не вернуть
 * при восстановлении. Поэтому забираем с собой в запись корзины.
 */
async function takePermissionRules(relPath) {
  const clean = normalizePath(relPath);
  const { rows } = await db.query(
    `SELECT user_id, path, access FROM fm_folder_permissions
      WHERE path = $1 OR path LIKE $2`,
    [clean, clean + "/%"]
  );
  if (rows.length) {
    await db.query("DELETE FROM fm_folder_permissions WHERE path = $1 OR path LIKE $2", [clean, clean + "/%"]);
  }
  return rows;
}

/** Возвращает снимок правил обратно, подставляя новый путь (если имя изменилось). */
async function restorePermissionRules(rules, oldPath, newPath) {
  const oldClean = normalizePath(oldPath);
  const newClean = normalizePath(newPath);
  for (const rule of rules || []) {
    const suffix = String(rule.path || "").slice(oldClean.length);
    const target = newClean + suffix;
    await db.query(
      `INSERT INTO fm_folder_permissions (path, user_id, access)
       VALUES ($1, $2, $3)
       ON CONFLICT (path, user_id) DO UPDATE SET access = EXCLUDED.access`,
      [target, rule.user_id, rule.access]
    );
  }
}

/**
 * Переносит файл/папку в корзину. Физически это одно переименование
 * внутри того же диска — мгновенно даже для больших папок.
 */
async function moveToTrash(relPath, userId) {
  const abs = files.safeResolve(relPath);
  const stat = await fsp.stat(abs);
  const name = path.basename(abs);
  const size = await sizeOf(abs);

  const storageKey = crypto.randomBytes(16).toString("hex");
  const root = trashRootAbs();
  await fsp.mkdir(root, { recursive: true });
  const destAbs = path.join(root, storageKey);

  const permRules = await takePermissionRules(relPath);

  try {
    await fsp.rename(abs, destAbs);
  } catch (err) {
    // Не смогли перенести — возвращаем правила на место, чтобы не потерять их.
    await restorePermissionRules(permRules, relPath, relPath);
    throw err;
  }

  const { rows } = await db.query(
    `INSERT INTO fm_trash (name, original_path, is_dir, size_bytes, storage_key, perm_rules, deleted_by)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
     RETURNING id`,
    [name, normalizePath(relPath), stat.isDirectory(), size, storageKey, JSON.stringify(permRules), userId || null]
  );
  return rows[0].id;
}

/** Список корзины: сотрудник видит своё, администратор — всё. */
async function listTrash(user) {
  const isAdmin = user.role === "admin";
  const { rows } = await db.query(
    `SELECT t.id, t.name, t.original_path, t.is_dir, t.size_bytes, t.deleted_at,
            u.username AS deleted_by_name,
            GREATEST(0, $2::int - FLOOR(EXTRACT(EPOCH FROM (now() - t.deleted_at)) / 86400)::int) AS days_left
       FROM fm_trash t
       LEFT JOIN users u ON u.id = t.deleted_by
      WHERE $1::boolean OR t.deleted_by = $3
      ORDER BY t.deleted_at DESC`,
    [isAdmin, RETENTION_DAYS, user.id]
  );
  return rows;
}

async function getEntry(id) {
  const { rows } = await db.query("SELECT * FROM fm_trash WHERE id = $1", [id]);
  return rows[0] || null;
}

/** Своё удалённое может трогать сам сотрудник, чужое — только администратор. */
function canManage(user, entry) {
  return user.role === "admin" || String(entry.deleted_by) === String(user.id);
}

/** Подбирает свободное имя, если на месте уже появилось что-то с таким названием. */
function freeName(parentAbs, name) {
  if (!fs.existsSync(path.join(parentAbs, name))) return name;
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  for (let i = 1; i < 1000; i++) {
    const candidate = i === 1 ? `${base} (восстановлено)${ext}` : `${base} (восстановлено ${i})${ext}`;
    if (!fs.existsSync(path.join(parentAbs, candidate))) return candidate;
  }
  return `${base} (${Date.now()})${ext}`;
}

/**
 * Возвращает удалённое на прежнее место. Если исходной папки больше нет —
 * воссоздаём путь целиком, чтобы файл не потерялся и лежал там, где его
 * привыкли искать.
 */
async function restore(id, user) {
  const entry = await getEntry(id);
  if (!entry) throw Object.assign(new Error("Запись не найдена"), { status: 404 });
  if (!canManage(user, entry)) throw Object.assign(new Error("Нет прав на восстановление"), { status: 403 });

  const storedAbs = path.join(trashRootAbs(), entry.storage_key);
  if (!fs.existsSync(storedAbs)) {
    await db.query("DELETE FROM fm_trash WHERE id = $1", [id]);
    throw Object.assign(new Error("Файла уже нет в корзине"), { status: 404 });
  }

  const originalPath = normalizePath(entry.original_path);
  const parentRel = originalPath.slice(0, originalPath.lastIndexOf("/")) || "/";
  const parentAbs = files.safeResolve(parentRel);
  await fsp.mkdir(parentAbs, { recursive: true });

  const finalName = freeName(parentAbs, entry.name);
  await fsp.rename(storedAbs, path.join(parentAbs, finalName));

  const newPath = parentRel === "/" ? "/" + finalName : parentRel + "/" + finalName;
  await restorePermissionRules(entry.perm_rules, originalPath, newPath);
  await db.query("DELETE FROM fm_trash WHERE id = $1", [id]);

  return { path: newPath, name: finalName, renamed: finalName !== entry.name };
}

/**
 * Окончательно стирает одну запись — вернуть уже нельзя.
 *
 * Если это была папка проекта, вместе с ней навсегда уходят и его
 * задачи: пока проект лежал в корзине, они были целы и вернулись бы
 * вместе с ним, но после очистки возвращать уже нечему.
 */
async function purge(id, user) {
  const entry = await getEntry(id);
  if (!entry) throw Object.assign(new Error("Запись не найдена"), { status: 404 });
  if (user && !canManage(user, entry)) throw Object.assign(new Error("Нет прав на удаление"), { status: 403 });

  await fsp.rm(path.join(trashRootAbs(), entry.storage_key), { recursive: true, force: true });
  await db.query("DELETE FROM fm_trash WHERE id = $1", [id]);

  // Задачи чистим после того, как файлы уже стёрты: если это упадёт,
  // корзина всё равно останется в согласованном состоянии.
  return purgeCaseTasksSafely(entry.original_path);
}

/**
 * Удаление задач не должно мешать очистке корзины: файлы уже стёрты, и
 * падение на этом шаге не должно превращаться в ошибку для человека.
 */
async function purgeCaseTasksSafely(originalPath) {
  try {
    const result = await caseLifecycle.purgeTasksByPath(normalizePath(originalPath));
    if (result.tasks) {
      console.log(`Вместе с проектами (${result.cases.join(", ")}) удалено задач: ${result.tasks}`);
    }
    return result;
  } catch (err) {
    console.error("Не удалось удалить задачи вместе с проектом:", err.message);
    return { tasks: 0, cases: [] };
  }
}

/** Очистка вручную: сотрудник чистит своё, администратор — всю корзину. */
async function empty(user) {
  const entries = await listTrash(user);
  for (const entry of entries) await purge(entry.id, user);
  return entries.length;
}

/**
 * Фоновая уборка: всё, что пролежало дольше срока хранения, стирается.
 * Заодно подчищаем папки в ".trash", на которые не осталось записей в базе
 * (например, если базу восстановили из более старой копии).
 */
async function purgeExpired() {
  const { rows } = await db.query(
    `SELECT id, storage_key, original_path FROM fm_trash
      WHERE deleted_at < now() - ($1::int * INTERVAL '1 day')`,
    [RETENTION_DAYS]
  );
  for (const row of rows) {
    await fsp.rm(path.join(trashRootAbs(), row.storage_key), { recursive: true, force: true });
    await db.query("DELETE FROM fm_trash WHERE id = $1", [row.id]);
    // Срок хранения истёк — это то же окончательное удаление, что и
    // очистка корзины руками, значит и задачи уходят так же.
    await purgeCaseTasksSafely(row.original_path);
  }

  let orphans = 0;
  const root = trashRootAbs();
  if (fs.existsSync(root)) {
    const { rows: known } = await db.query("SELECT storage_key FROM fm_trash");
    const keys = new Set(known.map((r) => r.storage_key));
    for (const name of await fsp.readdir(root)) {
      if (keys.has(name)) continue;
      await fsp.rm(path.join(root, name), { recursive: true, force: true });
      orphans++;
    }
  }

  return { removed: rows.length, orphans };
}

/** Сколько места занято корзиной — для подсказки в виджете диска. */
async function usedBytes() {
  const { rows } = await db.query("SELECT COALESCE(SUM(size_bytes), 0)::bigint AS total FROM fm_trash");
  return Number(rows[0].total);
}

module.exports = {
  TRASH_DIR,
  getEntry,
  RETENTION_DAYS,
  moveToTrash,
  listTrash,
  restore,
  purge,
  empty,
  purgeExpired,
  usedBytes,
  canManage,
  freeName,
  normalizePath,
};
