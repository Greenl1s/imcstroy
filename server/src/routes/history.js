import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';

export const history = Router();
history.use(requireAuth);

// Одна и та же граница для итогов и раскрываемой истории.
const loanScope = `(remaining > 0
    OR issued_at >= TIMESTAMPTZ '2026-10-07 00:00:00+03'
    OR (issued_at IS NULL AND issue_date >= DATE '2026-10-07')
    OR returned_at >= TIMESTAMPTZ '2026-10-07 00:00:00+03')`;
const validId = value => /^\d{1,19}$/.test(value) && BigInt(value) > 0n && BigInt(value) <= 9223372036854775807n;

/** Полный каталог, включая приборы без выдач. Итоги не зависят от пагинации истории. */
history.get('/loan-instruments', async (req, res) => {
  const filter = String(req.query.filter || 'all');
  if (!['all', 'active'].includes(filter)) return res.status(400).json({ error: 'Некорректный фильтр статистики' });
  const { rows } = await query(`WITH stats AS (
    SELECT instrument_id, count(*)::int AS loan_count,
      count(*) FILTER (WHERE project_id IS NOT NULL OR NULLIF(btrim(project_name),'') IS NOT NULL)::int AS project_loan_count,
      count(DISTINCT COALESCE(project_id::text, NULLIF(btrim(project_name),'')))::int AS project_count,
      count(*) FILTER (WHERE remaining > 0)::int AS active_count,
      COALESCE(sum(remaining),0)::int AS active_quantity,
      COALESCE(sum(GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(returned_at,now()) - issued_at))))
        FILTER (WHERE issued_at IS NOT NULL),0)::double precision AS duration_seconds,
      count(*) FILTER (WHERE issued_at IS NULL)::int AS unknown_time_count
    FROM equipment_loans WHERE ${loanScope} GROUP BY instrument_id
  ), catalog AS (
    SELECT i.id AS instrument_id, i.name AS instrument_name, i.inventory_no, i.model, i.serial_number, i.status,
      COALESCE(s.loan_count,0) AS loan_count, COALESCE(s.project_loan_count,0) AS project_loan_count,
      COALESCE(s.project_count,0) AS project_count, COALESCE(s.active_count,0) AS active_count,
      COALESCE(s.active_quantity,0) AS active_quantity, COALESCE(s.duration_seconds,0) AS duration_seconds,
      COALESCE(s.unknown_time_count,0) AS unknown_time_count
    FROM instruments i LEFT JOIN stats s ON s.instrument_id=i.id WHERE i.deleted_at IS NULL
  ) SELECT *, count(*) OVER ()::int AS total_instruments,
      count(*) FILTER (WHERE active_count>0) OVER ()::int AS active_instruments
    FROM catalog ORDER BY lower(instrument_name), instrument_id`);
  res.json({ items: filter === 'active' ? rows.filter(row => row.active_count > 0) : rows,
    counts: { total: rows[0]?.total_instruments || 0, active: rows[0]?.active_instruments || 0 } });
});

/** Отдельные выдачи для статистики прототипа. Авторизация общая с учётом. */
history.get('/loans', async (req, res) => {
  const filter = String(req.query.filter || 'all');
  const before = String(req.query.before || '');
  const instrument = String(req.query.instrument || '');
  if (!['all', 'active', 'returned'].includes(filter) || (before && !validId(before)) || (instrument && !validId(instrument))) {
    return res.status(400).json({ error: 'Некорректный фильтр статистики' });
  }
  const where = filter === 'active' ? 'remaining > 0' : filter === 'returned' ? 'remaining = 0' : 'true';
  // Фиксированное начало новой статистики, а не скользящее «сегодня».
  // Открытые старые выдачи остаются видны и после возврата с этой даты.
  const params = instrument ? [instrument] : [];
  const scope = `${loanScope}${instrument ? ' AND instrument_id = $1::bigint' : ''}`;
  const { rows: totals } = await query(`SELECT count(*)::int AS total,
    count(*) FILTER (WHERE remaining > 0)::int AS active,
    count(*) FILTER (WHERE remaining = 0)::int AS returned FROM equipment_loans WHERE ${scope}`, params);
  if (before) params.push(before);
  const { rows } = await query(`SELECT * FROM equipment_loans WHERE ${scope} AND ${where}
    ${before ? `AND id < $${params.length}::bigint` : ''} ORDER BY id DESC LIMIT 101`, params);
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
