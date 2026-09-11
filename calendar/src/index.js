import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { waitForDb, query } from './db.js';
import { events } from './routes/events.js';

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
// Общая cookie единого входа: без этого календарь не узнал бы человека,
// вошедшего в ИСУ, и просил бы отдельный вход, которого у него нет.
app.use(cookieParser());

const origins = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true, credentials: true }));

app.use(express.json({ limit: '512kb' }));

app.get('/api/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

app.use('/api/calendar', events);

app.use((req, res) => res.status(404).json({ error: 'Метод не найден' }));

app.use((err, req, res, next) => {
  console.error('[calendar]', err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Внутренняя ошибка сервера' });
});

waitForDb()
  .then(() => {
    app.listen(PORT, () => console.log(`[calendar] слушаю порт ${PORT}`));
  })
  .catch((err) => {
    console.error('[calendar] не удалось подключиться к базе:', err);
    process.exit(1);
  });
