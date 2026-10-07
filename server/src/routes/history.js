import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';

export const history = Router();
history.use(requireAuth);

/** Отдельные выдачи для статистики прототипа. Авторизация общая с учётом. */
history.get('/loans', async (req, res) => {
  const filter = String(req.query.filter || 'all');
  const before = String(req.query.before || '');
  if (!['all', 'active', 'returned'].includes(filter) || (before && (!/^\d{1,19}$/.test(before) || BigInt(before) > 9223372036854775807n || BigInt(before) < 1n))) {
    return res.status(400).json({ error: 'Некорректный фильтр статистики' });
  }
  const where = filter === 'active' ? 'remaining > 0' : filter === 'returned' ? 'remaining = 0' : 'true';
  // Фиксированное начало новой статистики, а не скользящее «сегодня».
  // Открытые старые выдачи остаются видны и после возврата с этой даты.
  const scope = `(remaining > 0
    OR issued_at >= TIMESTAMPTZ '2026-10-07 00:00:00+03'
    OR (issued_at IS NULL AND issue_date >= DATE '2026-10-07')
    OR returned_at >= TIMESTAMPTZ '2026-10-07 00:00:00+03')`;
  const { rows: totals } = await query(`SELECT count(*)::int AS total,
    count(*) FILTER (WHERE remaining > 0)::int AS active,
    count(*) FILTER (WHERE remaining = 0)::int AS returned FROM equipment_loans WHERE ${scope}`);
  const { rows } = await query(`SELECT * FROM equipment_loans WHERE ${scope} AND ${where}
    ${before ? 'AND id < $1::bigint' : ''} ORDER BY id DESC LIMIT 101`, before ? [before] : []);
  const items = rows.slice(0,100);
  res.json({ items, counts: totals[0], next: rows.length > 100 ? String(items.at(-1).id) : null });
});

/** Общий журнал: последние события по всем приборам. */
history.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  const { rows } = await query(
    'SELECT * FROM history ORDER BY created_at DESC, id DESC LIMIT $1',
    [limit]
  );
  res.json(rows);
});
