import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';

export const companies = Router();
companies.use(requireAuth);

/** Список компаний — виден всем, нужен для фильтра и формы прибора. */
companies.get('/', async (req, res) => {
  const { rows } = await query('SELECT code, name, position FROM companies ORDER BY position, code');
  res.json(rows);
});

/** Добавить новую компанию — только администратор. */
companies.post('/', requireAdmin, async (req, res) => {
  const code = String(req.body?.code || '').trim().toLowerCase();
  const name = String(req.body?.name || '').trim();

  if (!code || !name) {
    return res.status(400).json({ error: 'Укажите код и название' });
  }
  if (!/^[a-z0-9_]+$/.test(code)) {
    return res.status(400).json({ error: 'Код — латинскими буквами, цифрами и подчёркиванием, без пробелов' });
  }

  try {
    const { rows: maxPos } = await query('SELECT COALESCE(MAX(position), 0) AS max FROM companies');
    const { rows } = await query(
      `INSERT INTO companies (code, name, position) VALUES ($1, $2, $3) RETURNING code, name, position`,
      [code, name, maxPos[0].max + 1]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Такой код уже используется' });
    throw err;
  }
});

/**
 * Удалить компанию — только администратор, и только если к ней уже
 * никто не привязан (внешний ключ в instruments не даст удалить занятую,
 * но проверяем заранее сами, чтобы показать понятную причину).
 */
companies.delete('/:code', requireAdmin, async (req, res) => {
  const code = req.params.code;

  const { rows: usedBy } = await query(
    'SELECT COUNT(*)::int AS c FROM instruments WHERE company_code = $1',
    [code]
  );
  if (usedBy[0].c > 0) {
    return res.status(409).json({
      error: `К этой компании привязано ${usedBy[0].c} прибор(ов) — сначала переназначьте их`
    });
  }

  const { rowCount } = await query('DELETE FROM companies WHERE code = $1', [code]);
  if (!rowCount) return res.status(404).json({ error: 'Компания не найдена' });
  res.json({ ok: true });
});
