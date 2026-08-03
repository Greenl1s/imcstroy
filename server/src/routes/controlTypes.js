import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';

export const controlTypes = Router();
controlTypes.use(requireAuth);

/** Список классификаций — виден всем, нужен для фильтра и формы прибора. */
controlTypes.get('/', async (req, res) => {
  const { rows } = await query('SELECT code, full_name, short_name, position FROM control_types ORDER BY position, code');
  res.json(rows);
});

/** Добавить новую классификацию — только администратор. */
controlTypes.post('/', requireAdmin, async (req, res) => {
  const code = String(req.body?.code || '').trim().toLowerCase();
  const fullName = String(req.body?.full_name || '').trim();
  const shortName = String(req.body?.short_name || '').trim();

  if (!code || !fullName || !shortName) {
    return res.status(400).json({ error: 'Укажите код, полное и короткое название' });
  }
  if (!/^[a-z0-9_]+$/.test(code)) {
    return res.status(400).json({ error: 'Код — латинскими буквами, цифрами и подчёркиванием, без пробелов' });
  }

  try {
    const { rows: maxPos } = await query('SELECT COALESCE(MAX(position), 0) AS max FROM control_types');
    const { rows } = await query(
      `INSERT INTO control_types (code, full_name, short_name, position)
       VALUES ($1, $2, $3, $4) RETURNING code, full_name, short_name, position`,
      [code, fullName, shortName, maxPos[0].max + 1]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Такой код уже используется' });
    throw err;
  }
});

/**
 * Удалить классификацию — только администратор, и только если ею уже
 * никто не пользуется (внешний ключ в instruments не даст удалить занятую,
 * но проверяем заранее сами, чтобы показать понятную причину, а не
 * голую ошибку базы данных).
 */
controlTypes.delete('/:code', requireAdmin, async (req, res) => {
  const code = req.params.code;

  const { rows: usedBy } = await query(
    'SELECT COUNT(*)::int AS c FROM instruments WHERE control_type = $1',
    [code]
  );
  if (usedBy[0].c > 0) {
    return res.status(409).json({
      error: `Эта классификация используется у ${usedBy[0].c} прибор(ов) — сначала назначьте им другую классификацию`
    });
  }

  const { rowCount } = await query('DELETE FROM control_types WHERE code = $1', [code]);
  if (!rowCount) return res.status(404).json({ error: 'Классификация не найдена' });
  res.json({ ok: true });
});
