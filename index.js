import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { query, waitForDb } from './db.js';
import { hashPassword } from './auth.js';
import { auth } from './routes/auth.js';
import { users } from './routes/users.js';
import { instruments } from './routes/instruments.js';
import { history } from './routes/history.js';

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.set('trust proxy', 1); // за Caddy — чтобы rate limit видел реальный IP
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));

// Разрешаем запросы только с адресов, перечисленных в ALLOWED_ORIGINS.
// Если фронтенд отдаётся тем же сервером — список можно оставить пустым.
const origins = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({
  origin: origins.length ? origins : true,
  credentials: false
}));

// 8 МБ: фото в 5 МБ после base64-кодирования весит примерно 6.7 МБ
app.use(express.json({ limit: '8mb' }));

app.get('/api/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

app.use('/api/auth', auth);
app.use('/api/users', users);
app.use('/api/instruments', instruments);
app.use('/api/history', history);

app.use((req, res) => res.status(404).json({ error: 'Метод не найден' }));

// Единая обработка ошибок: наружу уходит текст, в логи — подробности.
app.use((err, req, res, next) => {
  console.error('[api]', err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Внутренняя ошибка сервера' });
});

/**
 * Первый запуск: если администраторов нет — создаём одного.
 * Пароль берётся из переменной окружения, а не зашит в код,
 * и в базе оказывается только его хэш.
 */
async function ensureAdmin() {
  const { rows } = await query(`SELECT 1 FROM users WHERE role = 'admin' LIMIT 1`);
  if (rows.length) return;

  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error(
      'Администраторов в базе нет. Задайте ADMIN_PASSWORD (минимум 8 символов) в .env и перезапустите сервер.'
    );
  }
  await query(
    `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'admin')`,
    [username, await hashPassword(password)]
  );
  console.log(`[api] создан администратор «${username}»`);
}

await waitForDb();
await ensureAdmin();
app.listen(PORT, () => console.log(`[api] слушаю порт ${PORT}`));
