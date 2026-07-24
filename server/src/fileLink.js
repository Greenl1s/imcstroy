const jwt = require("jsonwebtoken");

// Отдельный секрет — не тот же самый, что для пользовательских сессий
// и не тот, что для внутренних токенов OnlyOffice. Используется другими
// нашими сервисами (например, "Учёт приборов"), чтобы показывать файл,
// один раз привязанный к своей записи, без входа пользователя в сам
// файловый менеджер.
const FILE_LINK_SECRET = process.env.FILE_LINK_SECRET;

// Токен НЕ имеет срока действия (в отличие от токена OnlyOffice) —
// ссылка на привязанный файл должна работать сколько угодно долго,
// пока существует запись, которая на него ссылается.
function signFileLinkToken(relPath) {
  if (!FILE_LINK_SECRET) {
    throw new Error("Переменная окружения FILE_LINK_SECRET не задана");
  }
  return jwt.sign({ path: relPath }, FILE_LINK_SECRET);
}

function verifyFileLinkToken(token, relPath) {
  if (!FILE_LINK_SECRET) {
    throw new Error("Переменная окружения FILE_LINK_SECRET не задана");
  }
  const payload = jwt.verify(token, FILE_LINK_SECRET);
  if (payload.path !== relPath) {
    throw new Error("Токен не соответствует запрошенному пути");
  }
  return payload;
}

module.exports = { signFileLinkToken, verifyFileLinkToken };
