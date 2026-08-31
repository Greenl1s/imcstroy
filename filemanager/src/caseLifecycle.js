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

/**
 * Проект стёрли из корзины окончательно — вместе с ним навсегда уходят
 * и его задачи.
 *
 * Пока проект лежит в корзине, задачи никуда не деваются: они просто не
 * показываются (везде, где они читаются, стоит условие «проект не
 * удалён»), и возвращаются вместе с проектом. А вот очистка корзины —
 * действие необратимое по своей сути, и держать после него осиротевшие
 * задачи незачем: проекта, к которому они относились, больше нет.
 *
 * Саму запись проекта не стираем: на неё ссылается история стадий и
 * журнал регистрации. Она и так скрыта отовсюду отметкой deleted_at.
 *
 * Возвращает, сколько задач удалено и по каким проектам.
 */
async function purgeTasksByPath(purgedPath) {
  const clean = String(purgedPath || "").replace(/\/+$/, "");
  if (!clean) return { tasks: 0, cases: [] };

  const { rows: affected } = await db.query(
    `SELECT id, name FROM cases
      WHERE folder_path = $1 OR folder_path LIKE $2`,
    [clean, clean + "/%"]
  );
  if (!affected.length) return { tasks: 0, cases: [] };

  const ids = affected.map((c) => c.id);
  const { rows: removed } = await db.query(
    "DELETE FROM case_tasks WHERE case_id = ANY($1::int[]) RETURNING case_id", [ids]);

  // Отметку о том, когда задачи стёрли, ставим на сам проект: иначе
  // потом не отличить «задач не было» от «задачи удалили вместе с ним».
  await db.query(
    "UPDATE cases SET tasks_purged_at = now(), updated_at = now() WHERE id = ANY($1::int[])",
    [ids]
  );

  // В отчёт попадают только те проекты, у которых задачи действительно
  // были: иначе в логе окажутся проекты, у которых удалять было нечего.
  const withTasks = new Set(removed.map((r) => Number(r.case_id)));
  return {
    tasks: removed.length,
    cases: affected.filter((c) => withTasks.has(Number(c.id))).map((c) => c.name),
  };
}

module.exports = {
  markDeletedByPath, unmarkDeletedByPath, markLostCases, purgeTasksByPath, isInside,
};
