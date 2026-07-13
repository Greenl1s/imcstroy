import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from './db.js';

const SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = process.env.TOKEN_TTL || '12h';

if (!SECRET || SECRET.length < 32) {
  throw new Error('JWT_SECRET не задан или слишком короткий (нужно минимум 32 символа)');
}

/** Хэш пароля. В базу никогда не попадает пароль в открытом виде. */
export function hashPassword(plain) {
  return bcrypt.hash(String(plain), 12);
}

export function checkPassword(plain, hash) {
  return bcrypt.compare(String(plain), hash);
}

export function issueToken(user) {
  return jwt.sign(
    { sub: String(user.id), username: user.username, role: user.role },
    SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

/**
 * Проверяет токен из заголовка Authorization и кладёт пользователя в req.user.
 * Роль берётся ИЗ ТОКЕНА, подписанного сервером, а не из того, что прислал браузер.
 * Подделать её нельзя, не зная JWT_SECRET.
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Требуется авторизация' });

  try {
    const payload = jwt.verify(token, SECRET);
    // Сверяемся с базой: вдруг пользователя удалили или понизили в правах,
    // пока его старый токен ещё жив.
    const { rows } = await query(
      'SELECT id, username, role, extra FROM users WHERE id = $1',
      [payload.sub]
    );
    if (!rows.length) return res.status(401).json({ error: 'Пользователь не найден' });
    req.user = rows[0];
    next();
  } catch {
    return res.status(401).json({ error: 'Сессия истекла, войдите заново' });
  }
}

/** Пускает дальше только администратора. */
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ только для администратора' });
  }
  next();
}
