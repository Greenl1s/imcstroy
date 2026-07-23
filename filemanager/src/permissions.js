// Определяет, к какому "разделу" (колонке) относится путь.
function columnForPath(relPath) {
  const clean = "/" + String(relPath || "/").replace(/^\/+/, "");
  if (clean === "/База данных" || clean.startsWith("/База данных/")) return "db";
  if (clean === "/Дела" || clean.startsWith("/Дела/")) return "cases";
  return null;
}

// Middleware: проверяет, что у пользователя есть доступ к разделу,
// к которому относится path в query или в теле запроса.
// Администратору доступно всё без ограничений.
function requireColumnAccess(req, res, next) {
  if (req.user.role === "admin") return next();
  const p = req.query.path || (req.body && req.body.path);
  const col = columnForPath(p);
  if (col === "db" && req.user.can_db) return next();
  if (col === "cases" && req.user.can_cases) return next();
  return res.status(403).json({ message: "Нет доступа к этому разделу" });
}

function requireToolsAccess(req, res, next) {
  if (req.user.role === "admin" || req.user.can_tools) return next();
  return res.status(403).json({ message: "Нет доступа к разделу «Инструменты»" });
}

module.exports = { columnForPath, requireColumnAccess, requireToolsAccess };
