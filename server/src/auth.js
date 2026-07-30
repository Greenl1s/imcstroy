import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from './db.js';

const SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = process.env.TOKEN_TTL || '12h';

if (!SECRET || SECRET.length < 32) {
  throw new Error('JWT_SECRET не задан или слишком короткий (нужно минимум 32 символа)');
}

// Общая cookie для единого входа (SSO) — та же самая cookie распознаётся
// и файловым менеджером ИСУ, если у обоих сервисов задан один и тот же
// JWT_SECRET и SSO_COOKIE_DOMAIN.
export const SSO_COOKIE_NAME = 'sso_token';
const SSO_COOKIE_DOMAIN = process.env.SSO_COOKIE_DOMAIN || undefined;

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

/** Выставляет общую cookie так, чтобы её видел и files.<домен>, и сам сайт. */
export function setSsoCookie(res, token) {
  res.cookie(SSO_COOKIE_NAME, token, {
    domain: SSO_COOKIE_DOMAIN,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000,
  });
}

export function clearSsoCookie(res) {
  res.clearCookie(SSO_COOKIE_NAME, { domain: SSO_COOKIE_DOMAIN });
}

/**
 * Проверяет токен из заголовка Authorization, а если его нет — из общей
 * cookie SSO (например, если человек уже вошёл на files.<домен> и просто
 * открыл этот сайт — тогда токена в заголовке ещё нет, но cookie браузер
 * пришлёт сам). Роль берётся ИЗ ТОКЕНА, подписанного сервером, а не из
 * того, что прислал браузер. Подделать её нельзя, не зная JWT_SECRET.
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : (req.cookies?.[SSO_COOKIE_NAME] || null);
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
