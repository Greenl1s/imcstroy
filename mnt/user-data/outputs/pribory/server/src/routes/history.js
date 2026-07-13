import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';

export const history = Router();
history.use(requireAuth);

/** Общий журнал: последние события по всем приборам. */
history.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  const { rows } = await query(
    'SELECT * FROM history ORDER BY created_at DESC, id DESC LIMIT $1',
    [limit]
  );
  res.json(rows);
});
