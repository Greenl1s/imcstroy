import jwt from 'jsonwebtoken';

// Тот же секрет должен быть задан переменной окружения FILE_LINK_SECRET
// у ОБОИХ сервисов — и здесь, и в filemanager. Не путать с JWT_SECRET,
// которым подписываются токены входа пользователей "Учёта приборов".
const FILE_LINK_SECRET = process.env.FILE_LINK_SECRET;

// Адрес filemanager внутри docker-сети (не публичный домен) — оба сервиса
// в одном docker-compose, поэтому обращаемся друг к другу по имени сервиса.
const FILEMANAGER_INTERNAL_URL = process.env.FILEMANAGER_INTERNAL_URL || 'http://filemanager:3000';

// Пропуск действует пять минут. Он не хранится: подписывается заново
// на каждый показ файла — поэтому короткий срок ничему не мешает, зато
// перехваченная ссылка не остаётся вечным пропуском.
const TTL = '5m';

/**
 * Подписывает разовый пропуск к файлу в ИСУ.
 *
 * viewerId — id человека, который сейчас смотрит (users.id, таблица общая
 * у обоих сайтов). Файловый менеджер по нему проверяет права на папку.
 * Без него он теперь отдавать файл откажется — и правильно: раньше этой
 * проверки не было нигде, и права на папки "Дел" обходились через "Учёт".
 */
function signFileLinkToken(relPath, viewerId) {
  if (!FILE_LINK_SECRET) {
    throw new Error('Переменная окружения FILE_LINK_SECRET не задана');
  }
  if (!viewerId) {
    throw new Error('Не указан пользователь, для которого запрашивается файл');
  }
  return jwt.sign({ path: relPath, viewerId: Number(viewerId) }, FILE_LINK_SECRET, { expiresIn: TTL });
}

/**
 * Забирает файл, привязанный по пути в файловом менеджере, и возвращает
 * его содержимое и Content-Type — чтобы отдать дальше пользователю так,
 * будто это обычное фото/документ из своей базы.
 *
 * viewerId обязателен: файловый менеджер проверяет права ИМЕННО этого
 * человека. Если ему папку в ИСУ не показывают — файл он и здесь не получит.
 */
export async function fetchLinkedFile(relPath, viewerId) {
  const token = signFileLinkToken(relPath, viewerId);
  const url =
    `${FILEMANAGER_INTERNAL_URL}/internal/linked-file` +
    `?path=${encodeURIComponent(relPath)}&token=${encodeURIComponent(token)}`;

  const response = await fetch(url);
  if (response.status === 403) {
    const err = new Error('Нет доступа к этому файлу в ИСУ');
    err.status = 403;
    throw err;
  }
  if (!response.ok) {
    throw new Error(`Файловый менеджер вернул ошибку (HTTP ${response.status})`);
  }
  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, contentType };
}
