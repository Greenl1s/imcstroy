/**
 * Судьба записи проекта, когда его папку удаляют или возвращают.
 *
 * Запись из базы не стираем: журнал регистрации и история стадий должны
 * пережить удаление папки. Вместо этого ставим отметку deleted_at —
 * проект перестаёт предлагаться в выборе (ГП и прочее), но остаётся
 * следом в истории. Возврат из корзины отметку снимает.
 */
const db = require("./db");
const files = require("./files");

/** Путь равен целевому или лежит внутри него. */
function isInside(path, parent) {
  return path === parent || path.startsWith(parent.endsWith("/") ? parent : parent + "/");
}

/**
 * Помечает удалёнными проекты, чья папка попала под удаление. Удалить
 * могли и саму папку проекта, и целиком папку стадии — во втором случае
 * помечаются все проекты внутри.
 * Возвращает названия помеченных проектов.
 */
async function markDeletedByPath(removedPath) {
  const clean = String(removedPath || "").replace(/\/+$/, "");
  if (!clean) return [];
  const { rows } = await db.query(
    `UPDATE cases
        SET deleted_at = now(), updated_at = now()
      WHERE deleted_at IS NULL
        AND (folder_path = $1 OR folder_path LIKE $2)
      RETURNING name`,
    [clean, clean + "/%"]
  );
  return rows.map((r) => r.name);
}

/** Снимает отметку удаления с проектов, чья папка вернулась из корзины. */
async function unmarkDeletedByPath(restoredPath) {
  const clean = String(restoredPath || "").replace(/\/+$/, "");
  if (!clean) return [];
  const { rows } = await db.query(
    `UPDATE cases
        SET deleted_at = NULL, updated_at = now()
      WHERE deleted_at IS NOT NULL
        AND (folder_path = $1 OR folder_path LIKE $2)
      RETURNING name`,
    [clean, clean + "/%"]
  );
  return rows.map((r) => r.name);
}

/**
 * Разовая сверка при старте: проект числится живым, а папки нет.
 * Так бывает после удаления мимо интерфейса (правкой на диске) или
 * после старых удалений, сделанных до появления этой отметки.
 */
async function markLostCases() {
  const { rows } = await db.query(
    "SELECT id, name, folder_path FROM cases WHERE deleted_at IS NULL"
  );
  const lost = [];
  for (const kase of rows) {
    if (await files.pathExists(kase.folder_path)) continue;
    lost.push(kase);
  }
  if (!lost.length) return [];
  await db.query(
    "UPDATE cases SET deleted_at = now(), updated_at = now() WHERE id = ANY($1::int[])",
    [lost.map((k) => k.id)]
  );
  return lost.map((k) => k.name);
}

module.exports = { markDeletedByPath, unmarkDeletedByPath, markLostCases, isInside };
