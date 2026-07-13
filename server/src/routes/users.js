import { Router } from 'express';
import { query } from '../db.js';
import { hashPassword, requireAuth, requireAdmin } from '../auth.js';

export const users = Router();
users.use(requireAuth);

/**
 * Список пользователей нужен всем: чтобы выбрать, кому передать прибор,
 * и чтобы отфильтровать список по пользователю.
 * Хэши паролей не отдаются НИКОМУ и НИКОГДА — их просто нет в SELECT.
 */
users.get('/', async (req, res) => {
  const { rows } = await query(
    'SELECT id, username, role, extra FROM users ORDER BY lower(username)'
  );
  res.json(rows);
});

users.post('/', requireAdmin, async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const role = req.body?.role === 'admin' ? 'admin' : 'employee';
  const extra = String(req.body?.extra || '');

  if (!username) return res.status(400).json({ error: 'Укажите логин' });
  if (password.length < 6) return res.status(400).json({ error: 'Пароль должен быть не короче 6 символов' });

  try {
    const { rows } = await query(
      `INSERT INTO users (username, password_hash, role, extra)
       VALUES ($1, $2, $3, $4) RETURNING id, username, role, extra`,
      [username, await hashPassword(password), role, extra]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Такой логин уже есть' });
    throw err;
  }
});

users.patch('/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { rows: existing } = await query('SELECT id, role FROM users WHERE id = $1', [id]);
  if (!existing.length) return res.status(404).json({ error: 'Пользователь не найден' });

  const fields = [];
  const params = [id];

  if (req.body?.username !== undefined) {
    params.push(String(req.body.username).trim());
    fields.push(`username = $${params.length}`);
  }
  if (req.body?.extra !== undefined) {
    params.push(String(req.body.extra));
    fields.push(`extra = $${params.length}`);
  }
  if (req.body?.password) {
    if (String(req.body.password).length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть не короче 6 символов' });
    }
    params.push(await hashPassword(req.body.password));
    fields.push(`password_hash = $${params.length}`);
  }
  if (req.body?.role !== undefined) {
    const role = req.body.role === 'admin' ? 'admin' : 'employee';
    // Нельзя разжаловать самого себя и остаться без единого администратора.
    if (existing[0].role === 'admin' && role !== 'admin' && !(await hasOtherAdmin(id))) {
      return res.status(409).json({ error: 'В системе должен остаться хотя бы один администратор' });
    }
    params.push(role);
    fields.push(`role = $${params.length}`);
  }
  if (!fields.length) return res.status(400).json({ error: 'Нечего обновлять' });

  try {
    const { rows } = await query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $1 RETURNING id, username, role, extra`,
      params
    );
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Такой логин уже есть' });
    throw err;
  }
});

/**
 * Удаление пользователя. Раньше оно жило только в памяти браузера —
 * теперь запись действительно исчезает из базы. Приборы, которые
 * числились за ним, не пропадут: ссылка на пользователя обнулится.
 */
users.delete('/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) {
    return res.status(409).json({ error: 'Нельзя удалить самого себя' });
  }
  const { rows } = await query('SELECT role FROM users WHERE id = $1', [id]);
  if (!rows.length) return res.status(404).json({ error: 'Пользователь не найден' });
  if (rows[0].role === 'admin' && !(await hasOtherAdmin(id))) {
    return res.status(409).json({ error: 'В системе должен остаться хотя бы один администратор' });
  }

  // Освобождаем приборы, которые числились за удаляемым пользователем,
  // иначе сработает ограничение целостности состояния.
  await query(
    `UPDATE instruments SET status = 'free', taken_by = NULL, taken_where = NULL,
            taken_extra = NULL, taken_at = NULL
      WHERE taken_by = $1`, [id]
  );
  await query(
    `UPDATE instruments SET status = 'free', booked_by = NULL, booked_for = NULL,
            booked_extra = NULL
      WHERE booked_by = $1`, [id]
  );
  await query('DELETE FROM users WHERE id = $1', [id]);
  res.json({ ok: true });
});

async function hasOtherAdmin(exceptId) {
  const { rows } = await query(
    `SELECT 1 FROM users WHERE role = 'admin' AND id <> $1 LIMIT 1`, [exceptId]
  );
  return rows.length > 0;
}
