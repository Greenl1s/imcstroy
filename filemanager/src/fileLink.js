const jwt = require("jsonwebtoken");

// Отдельный секрет — не тот же самый, что для пользовательских сессий
// и не тот, что для внутренних токенов OnlyOffice. Используется другими
// нашими сервисами (например, "Учёт приборов"), чтобы показывать файл,
// один раз привязанный к своей записи, без входа пользователя в сам
// файловый менеджер.
const FILE_LINK_SECRET = process.env.FILE_LINK_SECRET;

// Сколько живёт токен. Он не хранится нигде: сервис-потребитель
// подписывает его заново на каждый запрос файла. Поэтому короткий срок
// ничему не мешает, зато перехваченная ссылка перестаёт работать через
// пять минут, а не остаётся вечным пропуском.
const TTL = "5m";

/**
 * Подписывает разовый пропуск к файлу.
 *
 * viewerId — id ЧЕЛОВЕКА, который сейчас смотрит (users.id, общая таблица
 * обоих сайтов). Он обязателен: без него файловый менеджер не знает, чьи
 * права проверять, и раньше отдавал файл кому угодно, у кого есть секрет.
 * Именно так права на папки "Дел" можно было обойти через "Учёт приборов".
 */
function signFileLinkToken(relPath, viewerId) {
  if (!FILE_LINK_SECRET) {
    throw new Error("Переменная окружения FILE_LINK_SECRET не задана");
  }
  if (!viewerId) {
    throw new Error("Не указан пользователь, для которого выдаётся доступ к файлу");
  }
  return jwt.sign({ path: relPath, viewerId: Number(viewerId) }, FILE_LINK_SECRET, { expiresIn: TTL });
}

function verifyFileLinkToken(token, relPath) {
  if (!FILE_LINK_SECRET) {
    throw new Error("Переменная окружения FILE_LINK_SECRET не задана");
  }
  const payload = jwt.verify(token, FILE_LINK_SECRET);
  if (payload.path !== relPath) {
    throw new Error("Токен не соответствует запрошенному пути");
  }
  if (!payload.viewerId) {
    // Токен старого образца — без указания, кто смотрит. Такие больше не
    // принимаем: проверить по ним права не по чему, а молча отдать файл
    // значит оставить дыру открытой.
    throw new Error("Токен старого образца: в нём не указан пользователь");
  }
  return payload;
}

module.exports = { signFileLinkToken, verifyFileLinkToken };
