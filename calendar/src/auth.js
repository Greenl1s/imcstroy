import jwt from 'jsonwebtoken';
import { query } from './db.js';

// Календарь не заводит своего входа. Он проверяет тот же токен, что
// выдают ИСУ и «Учёт»: один JWT_SECRET на три сервиса, одна cookie
// sso_token на одном домене. Вошли в любом — вошли везде.
const SECRET = process.env.JWT_SECRET;

if (!SECRET || SECRET.length < 32) {
  throw new Error('JWT_SECRET не задан или слишком короткий (нужно минимум 32 символа)');
}

export const SSO_COOKIE_NAME = 'sso_token';

/**
 * Токен берётся из заголовка Authorization, а если его нет — из общей
 * cookie: человек мог войти на files.<домен> и просто открыть календарь,
 * тогда заголовка ещё нет, а cookie браузер пришлёт сам.
 *
 * Роль и имя берутся из базы, а не из токена: токен живёт 12 часов,
 * за это время пользователя могли удалить или переименовать.
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ')
    ? header.slice(7)
    : (req.cookies?.[SSO_COOKIE_NAME] || null);
  if (!token) return res.status(401).json({ error: 'Требуется авторизация' });

  try {
    const payload = jwt.verify(token, SECRET);
    const { rows } = await query('SELECT id, username, role FROM users WHERE id = $1', [payload.sub]);
    if (!rows.length) return res.status(401).json({ error: 'Пользователь не найден' });
    req.user = rows[0];
    next();
  } catch {
    return res.status(401).json({ error: 'Сессия истекла, войдите заново' });
  }
}
