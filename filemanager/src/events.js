const fs = require("fs");
const path = require("path");

const db = require("./db");
const files = require("./files");
const folderAccess = require("./folderAccess");
const { columnForPath } = require("./permissions");

// Какие действия считаются "файл появился или изменился" — из них
// собирается раздел "Последние".
const RECENT_ACTIONS = ["upload", "create_file", "office_save", "gp_generate", "restore"];

/**
 * Записывает событие. Намеренно ничего не бросает наружу: история —
 * вещь полезная, но не настолько, чтобы из-за сбоя записи в неё
 * разваливалась сама операция с файлом.
 */
async function log(user, action, info = {}) {
  try {
    await db.query(
      `INSERT INTO fm_events (actor_id, actor_name, action, target_path, target_name, is_dir, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        user && user.id ? user.id : null,
        user && user.username ? user.username : null,
        action,
        info.path || null,
        info.name || (info.path ? path.posix.basename(info.path) : null),
        Boolean(info.isDir),
        JSON.stringify(info.details || {}),
      ]
    );
  } catch (err) {
    console.error("Не удалось записать событие в историю:", err.message);
  }
}

/**
 * Оставляет только те события, до которых пользователю есть дело:
 * "База данных" — по общему признаку доступа, "Дела" — по персональным
 * правилам на конкретную папку. Администратор видит всё.
 */
async function filterVisible(rows, user) {
  if (user.role === "admin") return rows;

  let casesRules = null;
  const visible = [];
  for (const row of rows) {
    const column = columnForPath(row.target_path);
    if (column === "db") {
      if (user.can_db) visible.push(row);
      continue;
    }
    if (column === "cases") {
      if (!user.can_cases) continue;
      if (!casesRules) casesRules = await folderAccess.getUserRules(user.id);
      if (folderAccess.resolveAccess(casesRules, row.target_path)) visible.push(row);
      continue;
    }
    // События без пути (или вне двух разделов) показываем всем — там нет
    // содержимого дела, только сам факт действия.
    if (!row.target_path) visible.push(row);
  }
  return visible;
}

/**
 * Лента истории. Берём с запасом и фильтруем по правам уже здесь:
 * иначе у сотрудника с узким доступом страница выглядела бы полупустой.
 */
async function list(user, options = {}) {
  const limit = Math.min(Number(options.limit) || 100, 300);
  const conditions = [];
  const params = [];

  if (options.action) {
    params.push(options.action);
    conditions.push(`action = $${params.length}`);
  }
  if (options.actorId) {
    params.push(Number(options.actorId));
    conditions.push(`actor_id = $${params.length}`);
  }
  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  params.push(limit * 4);
  const { rows } = await db.query(
    `SELECT id, actor_id, actor_name, action, target_path, target_name, is_dir, details, created_at
       FROM fm_events ${where}
      ORDER BY created_at DESC
      LIMIT $${params.length}`,
    params
  );

  const visible = await filterVisible(rows, user);
  return visible.slice(0, limit);
}

/** Кто вообще что-то делал — для выпадающего списка фильтра. */
async function listActors() {
  const { rows } = await db.query(
    `SELECT DISTINCT actor_id AS id, actor_name AS name
       FROM fm_events
      WHERE actor_id IS NOT NULL AND actor_name IS NOT NULL
      ORDER BY actor_name`
  );
  return rows;
}

/**
 * Раздел "Последние": по одному свежему событию на файл, только
 * добавленные и изменённые, и только те, что ещё лежат на месте
 * (файл могли удалить или переименовать после).
 */
async function recent(user, options = {}) {
  const limit = Math.min(Number(options.limit) || 50, 200);
  const params = [RECENT_ACTIONS, limit * 6];
  let scope = "";
  if (options.column === "db") scope = "AND target_path LIKE '/База данных/%'";
  if (options.column === "cases") scope = "AND target_path LIKE '/Дела/%'";

  const { rows } = await db.query(
    `SELECT DISTINCT ON (target_path)
            id, actor_id, actor_name, action, target_path, target_name, is_dir, created_at
       FROM fm_events
      WHERE action = ANY($1) AND target_path IS NOT NULL AND is_dir = false ${scope}
      ORDER BY target_path, created_at DESC
      LIMIT $2`,
    params
  );

  rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const visible = await filterVisible(rows, user);

  const alive = [];
  for (const row of visible) {
    if (alive.length >= limit) break;
    try {
      if (fs.existsSync(files.safeResolve(row.target_path))) alive.push(row);
    } catch (err) {
      // Кривой путь в старой записи — просто пропускаем.
    }
  }
  return alive;
}

module.exports = { log, list, listActors, recent, filterVisible, RECENT_ACTIONS };
