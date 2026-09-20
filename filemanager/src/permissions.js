const folderAccess = require("./folderAccess");
const db = require("./db");
const { normalizeStoragePath } = require("./storagePath");

// Определяет, к какому "разделу" (колонке) относится путь.
function columnForPath(relPath) {
  const clean = normalizeStoragePath(relPath);
  if (clean === "/База данных" || clean.startsWith("/База данных/")) return "db";
  if (clean === "/Дела" || clean.startsWith("/Дела/")) return "cases";
  return null;
}

/**
 * Middleware-фабрика: проверяет доступ к пути в query/теле запроса.
 * options.write=true — операция что-то меняет (загрузка, удаление, создание
 * папки/файла); иначе — только просмотр/скачивание.
 *
 * "База данных" — как раньше, общий переключатель can_db на весь раздел.
 * "Дела" — вдобавок ещё и персональные правила по каждой папке/файлу
 * (см. folderAccess.js): не только "весь раздел да/нет", а конкретно,
 * что именно из "Дела" разрешено этому пользователю.
 *
 * Администратору доступно всё без ограничений в любом случае.
 */
function requireColumnAccess(options = {}) {
  const needsWrite = Boolean(options.write);

  return async function (req, res, next) {
    try {
      // GET/DELETE handlers consume query.path; POST handlers consume body.path.
      // Do not authorize a query parameter and then write to an unrelated body path.
      const source = ["GET", "DELETE"].includes(req.method) ? req.query : req.body;
      if (typeof source?.path !== "string" || !source.path) {
        return res.status(400).json({ message: "Укажите путь" });
      }
      const p = normalizeStoragePath(source.path);
      if (req.query?.path !== undefined && req.body?.path !== undefined &&
          normalizeStoragePath(req.query.path) !== normalizeStoragePath(req.body.path)) {
        return res.status(400).json({ message: "В запросе указаны разные пути" });
      }
      source.path = p;
      req.accessPath = p;
      if (req.user.role === "admin") return next();

      const col = columnForPath(p);

      if (col === "db") {
        if (req.user.can_db) return next();
        return res.status(403).json({ message: "Нет доступа к этому разделу" });
      }

      if (col === "cases") {
        if (!req.user.can_cases) {
          return res.status(403).json({ message: "Нет доступа к этому разделу" });
        }
        const rules = await folderAccess.getUserRules(req.user.id);
        req.folderRules = rules;

        if (needsWrite) {
          const access = folderAccess.resolveAccess(rules, p);
          if (access !== "write") {
            return res.status(403).json({ message: "У вас нет прав на изменение этой папки" });
          }
          req.folderAccess = access;
          return next();
        }

        if (!folderAccess.canList(rules, p)) {
          return res.status(403).json({ message: "Нет доступа к этой папке" });
        }
        req.folderAccess = folderAccess.resolveAccess(rules, p);
        return next();
      }

      return res.status(403).json({ message: "Доступ запрещён" });
    } catch (err) {
      if (err.status === 400) return res.status(400).json({ message: err.message });
      console.error("Ошибка проверки доступа к папке:", err);
      res.status(500).json({ message: "Не удалось проверить права доступа" });
    }
  };
}

function requireToolsAccess(req, res, next) {
  if (req.user.role === "admin" || req.user.can_tools) return next();
  return res.status(403).json({ message: "Нет доступа к разделу «Инструменты»" });
}

/**
 * Может ли ЭТОТ человек прочитать файл по этому пути.
 *
 * Те же правила, что и в requireColumnAccess без права записи, но не
 * как middleware, а обычной проверкой: нужна там, где пользователь не
 * приходит со своей cookie, а его id передан другим нашим сервисом
 * (см. /internal/linked-file — привязанные фото и документы приборов
 * в "Учёте приборов").
 *
 * Пользователя ищем в базе сами: доверять роли, присланной снаружи,
 * нельзя — иначе проверка ничего не проверяет.
 */
async function canUserReadPath(userId, relPath) {
  const { rows } = await db.query("SELECT id, role FROM users WHERE id = $1", [Number(userId)]);
  if (!rows.length) return false;
  const user = rows[0];
  if (user.role === "admin") return true;

  const col = columnForPath(relPath);
  if (!col) return false;

  const { rows: permRows } = await db.query(
    "SELECT can_db, can_cases FROM fm_permissions WHERE user_id = $1", [user.id]
  );
  const perms = permRows[0] || { can_db: false, can_cases: false };

  if (col === "db") return Boolean(perms.can_db);

  if (col === "cases") {
    if (!perms.can_cases) return false;
    const rules = await folderAccess.getUserRules(user.id);
    return folderAccess.canList(rules, relPath);
  }
  return false;
}

module.exports = { columnForPath, requireColumnAccess, requireToolsAccess, canUserReadPath };
