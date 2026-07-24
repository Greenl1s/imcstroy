import jwt from 'jsonwebtoken';

// Тот же секрет должен быть задан переменной окружения FILE_LINK_SECRET
// у ОБОИХ сервисов — и здесь, и в filemanager. Не путать с JWT_SECRET,
// которым подписываются токены входа пользователей "Учёта приборов".
const FILE_LINK_SECRET = process.env.FILE_LINK_SECRET;

// Адрес filemanager внутри docker-сети (не публичный домен) — оба сервиса
// в одном docker-compose, поэтому обращаемся друг к другу по имени сервиса.
const FILEMANAGER_INTERNAL_URL = process.env.FILEMANAGER_INTERNAL_URL || 'http://filemanager:3000';

function signFileLinkToken(relPath) {
  if (!FILE_LINK_SECRET) {
    throw new Error('Переменная окружения FILE_LINK_SECRET не задана');
  }
  return jwt.sign({ path: relPath }, FILE_LINK_SECRET);
}

/**
 * Забирает файл, привязанный по пути в файловом менеджере, и возвращает
 * его содержимое и Content-Type — чтобы отдать дальше пользователю так,
 * будто это обычное фото/документ из своей базы.
 */
export async function fetchLinkedFile(relPath) {
  const token = signFileLinkToken(relPath);
  const url =
    `${FILEMANAGER_INTERNAL_URL}/internal/linked-file` +
    `?path=${encodeURIComponent(relPath)}&token=${encodeURIComponent(token)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Файловый менеджер вернул ошибку (HTTP ${response.status})`);
  }
  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, contentType };
}
