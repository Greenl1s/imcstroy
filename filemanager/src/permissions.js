const folderAccess = require("./folderAccess");

// Определяет, к какому "разделу" (колонке) относится путь.
function columnForPath(relPath) {
  const clean = "/" + String(relPath || "/").replace(/^\/+/, "");
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
      if (req.user.role === "admin") return next();

      const p = req.query.path || (req.body && req.body.path);
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
      console.error("Ошибка проверки доступа к папке:", err);
      res.status(500).json({ message: "Не удалось проверить права доступа" });
    }
  };
}

function requireToolsAccess(req, res, next) {
  if (req.user.role === "admin" || req.user.can_tools) return next();
  return res.status(403).json({ message: "Нет доступа к разделу «Инструменты»" });
}

module.exports = { columnForPath, requireColumnAccess, requireToolsAccess };
