import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { checkPassword, hashPassword, issueToken, requireAuth } from '../auth.js';

export const auth = Router();

// Настоящий хэш от случайной строки. Нужен, чтобы при несуществующем логине
// сервер тратил столько же времени, сколько при существующем.
const DUMMY_HASH = await hashPassword(Math.random().toString(36));

/** Не даём подбирать пароль перебором: 10 попыток за 5 минут с одного адреса. */
const loginLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  message: { error: 'Слишком много попыток входа. Попробуйте через несколько минут.' }
});

auth.post('/login', loginLimit, async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (!username || !password) {
    return res.status(400).json({ error: 'Введите логин и пароль' });
  }

  const { rows } = await query(
    'SELECT id, username, password_hash, role, extra FROM users WHERE lower(username) = lower($1)',
    [username]
  );
  const user = rows[0];

  // Сравнение выполняем даже когда пользователя нет — чтобы по времени ответа
  // нельзя было понять, существует такой логин или нет.
  const ok = await checkPassword(password, user ? user.password_hash : DUMMY_HASH);

  if (!ok || !user) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }

  res.json({
    token: issueToken(user),
    user: { id: user.id, username: user.username, role: user.role, extra: user.extra }
  });
});

/** Кто я сейчас. Используется при перезагрузке страницы. */
auth.get('/me', requireAuth, (req, res) => res.json(req.user));

/** Смена собственного пароля и доп. информации. */
auth.patch('/me', requireAuth, async (req, res) => {
  const { password, extra } = req.body || {};

  if (password !== undefined && String(password).length < 6) {
    return res.status(400).json({ error: 'Пароль должен быть не короче 6 символов' });
  }

  const fields = [];
  const params = [req.user.id];
  if (extra !== undefined) {
    params.push(String(extra));
    fields.push(`extra = $${params.length}`);
  }
  if (password) {
    params.push(await hashPassword(password));
    fields.push(`password_hash = $${params.length}`);
  }
  if (!fields.length) return res.json(req.user);

  const { rows } = await query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $1 RETURNING id, username, role, extra`,
    params
  );
  res.json(rows[0]);
});
