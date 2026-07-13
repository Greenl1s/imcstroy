import { Router } from 'express';
import { query, transaction } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { logEvent } from '../history.js';

export const instruments = Router();
instruments.use(requireAuth);

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Все переходы состояния сделаны одним UPDATE с условием на текущий статус.
 *
 *   UPDATE ... WHERE id = $1 AND status = 'free'
 *
 * Если два человека одновременно нажмут «Взять», база выполнит запросы
 * по очереди: первый получит строку, второй — ноль строк и увидит честную
 * ошибку «прибор уже занят». Проверка «если свободен, то занять» на клиенте
 * такой гарантии не даёт в принципе.
 */
async function transition(res, { id, actor, sql, params, action, guardMessage, buildLog }) {
  try {
    const row = await transaction(async (client) => {
      const { rows } = await client.query(sql, params);
      if (!rows.length) {
        const exists = await client.query('SELECT status FROM instruments WHERE id = $1', [id]);
        const err = new Error(
          exists.rows.length ? guardMessage : 'Прибор не найден'
        );
        err.status = exists.rows.length ? 409 : 404;
        throw err;
      }
      const instrument = rows[0];
      await logEvent(client, { instrument, action, actor, ...buildLog(instrument) });
      return instrument;
    });
    res.json(await withNames(row.id));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

async function withNames(id) {
  const { rows } = await query('SELECT * FROM instruments_view WHERE id = $1', [id]);
  return rows[0] || null;
}

// ---------- Чтение ----------

/** Список. Фотографии сюда НЕ попадают — только флаг has_photo. */
instruments.get('/', async (req, res) => {
  const status = req.query.status === 'retired' ? 'retired' : null;
  const { rows } = await query(
    status
      ? `SELECT * FROM instruments_view WHERE status = 'retired' ORDER BY id`
      : `SELECT * FROM instruments_view WHERE status <> 'retired' ORDER BY id`
  );
  res.json(rows);
});

instruments.get('/:id', async (req, res) => {
  const item = await withNames(req.params.id);
  if (!item) return res.status(404).json({ error: 'Прибор не найден' });
  res.json(item);
});

instruments.get('/:id/history', async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM history WHERE instrument_id = $1 ORDER BY created_at DESC LIMIT 200',
    [req.params.id]
  );
  res.json(rows);
});

// ---------- Фото ----------

instruments.get('/:id/photo', async (req, res) => {
  const { rows } = await query(
    'SELECT mime_type, bytes FROM instrument_photos WHERE instrument_id = $1',
    [req.params.id]
  );
  if (!rows.length) return res.status(404).end();
  res.set('Content-Type', rows[0].mime_type);
  res.set('Cache-Control', 'private, max-age=300');
  res.send(rows[0].bytes);
});

instruments.put('/:id/photo', requireAdmin, async (req, res) => {
  const { data_url } = req.body || {};
  const match = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(String(data_url || ''));
  if (!match) return res.status(400).json({ error: 'Ожидается изображение в формате data URL' });

  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > 5 * 1024 * 1024) {
    return res.status(413).json({ error: 'Файл больше 5 МБ' });
  }
  await query(
    `INSERT INTO instrument_photos (instrument_id, mime_type, bytes, size_bytes)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (instrument_id)
     DO UPDATE SET mime_type = EXCLUDED.mime_type, bytes = EXCLUDED.bytes,
                   size_bytes = EXCLUDED.size_bytes, uploaded_at = now()`,
    [req.params.id, match[1], bytes, bytes.length]
  );
  res.json({ ok: true });
});

instruments.delete('/:id/photo', requireAdmin, async (req, res) => {
  await query('DELETE FROM instrument_photos WHERE instrument_id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ---------- Создание / изменение / удаление ----------

const EDITABLE = [
  'inventory_no', 'name', 'serial_number', 'model', 'check_type',
  'verification_date', 'valid_until', 'document_url', 'comment'
];

/** Пустая строка из формы должна стать NULL, а не '' — иначе даты не сохранятся. */
const nullify = (v) => (v === '' || v === undefined ? null : v);

instruments.post('/', requireAdmin, async (req, res) => {
  const values = EDITABLE.map((key) => nullify(req.body?.[key]));
  try {
    const row = await transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO instruments
           (inventory_no, name, serial_number, model, check_type,
            verification_date, valid_until, document_url, comment)
         VALUES ($1, $2, $3, $4, coalesce($5::check_type, 'verification'),
                 $6, $7, $8, coalesce($9, ''))
         RETURNING *`,
        values
      );
      await logEvent(client, {
        instrument: rows[0], action: 'create', actor: req.user, note: 'Прибор добавлен'
      });
      return rows[0];
    });
    res.status(201).json(await withNames(row.id));
  } catch (err) {
    res.status(400).json({ error: humanize(err) });
  }
});

instruments.patch('/:id', requireAdmin, async (req, res) => {
  const updates = EDITABLE.filter((key) => key in (req.body || {}));
  if (!updates.length) return res.status(400).json({ error: 'Нечего обновлять' });

  const set = updates.map((key, i) => `${key} = $${i + 2}`).join(', ');
  const params = [req.params.id, ...updates.map((key) => nullify(req.body[key]))];

  try {
    const row = await transaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE instruments SET ${set} WHERE id = $1 RETURNING *`, params
      );
      if (!rows.length) {
        const err = new Error('Прибор не найден');
        err.status = 404;
        throw err;
      }
      await logEvent(client, {
        instrument: rows[0], action: 'update', actor: req.user, note: 'Карточка изменена'
      });
      return rows[0];
    });
    res.json(await withNames(row.id));
  } catch (err) {
    res.status(err.status || 400).json({ error: humanize(err) });
  }
});

/**
 * Удаление. Раньше строка убиралась только из массива в браузере и после
 * перезагрузки страницы возвращалась. Теперь удаление происходит в базе.
 * Запись в журнале остаётся: instrument_id станет NULL, но имя сохранено.
 */
instruments.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await transaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM instruments WHERE id = $1', [req.params.id]);
      if (!rows.length) {
        const err = new Error('Прибор не найден');
        err.status = 404;
        throw err;
      }
      await logEvent(client, {
        instrument: rows[0], action: 'delete', actor: req.user, note: 'Прибор удалён безвозвратно'
      });
      await client.query('DELETE FROM instruments WHERE id = $1', [req.params.id]);
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ---------- Операции с приборами ----------

instruments.post('/:id/issue', (req, res) => transition(res, {
  id: req.params.id,
  actor: req.user,
  action: 'issue',
  guardMessage: 'Прибор уже занят или забронирован',
  sql: `UPDATE instruments
           SET status = 'busy', taken_by = $2, taken_where = $3, taken_extra = $4, taken_at = $5
         WHERE id = $1 AND status = 'free'
         RETURNING *`,
  params: [
    req.params.id, req.user.id,
    nullify(req.body?.taken_where), nullify(req.body?.taken_extra),
    req.body?.taken_at || today()
  ],
  buildLog: (i) => ({
    targetName: req.user.username, place: i.taken_where, extra: i.taken_extra,
    note: `Выдан: ${req.user.username}`
  })
}));

/** Вернуть может тот, кто взял, либо администратор. */
instruments.post('/:id/return', (req, res) => transition(res, {
  id: req.params.id,
  actor: req.user,
  action: 'return',
  guardMessage: 'Прибор не выдан или выдан другому пользователю',
  sql: `UPDATE instruments
           SET status = 'free', taken_by = NULL, taken_where = NULL,
               taken_extra = NULL, taken_at = NULL
         WHERE id = $1 AND status = 'busy' AND (taken_by = $2 OR $3)
         RETURNING *`,
  params: [req.params.id, req.user.id, req.user.role === 'admin'],
  buildLog: () => ({ note: `Возвращён: ${req.user.username}` })
}));

/** Передать другому — только тот, у кого прибор на руках. */
instruments.post('/:id/transfer', async (req, res) => {
  const targetId = Number(req.body?.to_user_id);
  if (!targetId) return res.status(400).json({ error: 'Не выбран новый пользователь' });

  const { rows: target } = await query('SELECT username FROM users WHERE id = $1', [targetId]);
  if (!target.length) return res.status(400).json({ error: 'Пользователь не найден' });

  return transition(res, {
    id: req.params.id,
    actor: req.user,
    action: 'transfer',
    guardMessage: 'Передать можно только прибор, который у вас на руках',
    sql: `UPDATE instruments
             SET taken_by = $4, taken_where = $5, taken_extra = $6, taken_at = $7
           WHERE id = $1 AND status = 'busy' AND (taken_by = $2 OR $3)
           RETURNING *`,
    params: [
      req.params.id, req.user.id, req.user.role === 'admin', targetId,
      nullify(req.body?.taken_where), nullify(req.body?.taken_extra), today()
    ],
    buildLog: (i) => ({
      targetName: target[0].username, place: i.taken_where,
      note: `Передан: ${req.user.username} → ${target[0].username}`
    })
  });
});

instruments.post('/:id/book', (req, res) => transition(res, {
  id: req.params.id,
  actor: req.user,
  action: 'book',
  guardMessage: 'Прибор уже занят или забронирован',
  sql: `UPDATE instruments
           SET status = 'booked', booked_by = $2, booked_for = $3, booked_extra = $4
         WHERE id = $1 AND status = 'free'
         RETURNING *`,
  params: [
    req.params.id, req.user.id,
    req.body?.booked_for || today(), nullify(req.body?.booked_extra)
  ],
  buildLog: (i) => ({
    targetName: req.user.username, extra: i.booked_extra,
    note: `Забронирован на ${i.booked_for}`
  })
}));

instruments.post('/:id/cancel-booking', (req, res) => transition(res, {
  id: req.params.id,
  actor: req.user,
  action: 'cancel_booking',
  guardMessage: 'Прибор не забронирован или бронь оформлена другим пользователем',
  sql: `UPDATE instruments
           SET status = 'free', booked_by = NULL, booked_for = NULL, booked_extra = NULL
         WHERE id = $1 AND status = 'booked' AND (booked_by = $2 OR $3)
         RETURNING *`,
  params: [req.params.id, req.user.id, req.user.role === 'admin'],
  buildLog: () => ({ note: 'Бронирование отменено' })
}));

/** Подтверждение брони: прибор переходит к тому, кто его бронировал. */
instruments.post('/:id/confirm-booking', (req, res) => transition(res, {
  id: req.params.id,
  actor: req.user,
  action: 'confirm_booking',
  guardMessage: 'Прибор не забронирован или бронь оформлена другим пользователем',
  sql: `UPDATE instruments
           SET status = 'busy',
               taken_by = booked_by, taken_at = $4, taken_extra = booked_extra,
               taken_where = $5,
               booked_by = NULL, booked_for = NULL, booked_extra = NULL
         WHERE id = $1 AND status = 'booked' AND (booked_by = $2 OR $3)
         RETURNING *`,
  params: [
    req.params.id, req.user.id, req.user.role === 'admin',
    today(), nullify(req.body?.taken_where)
  ],
  buildLog: () => ({ note: 'Бронирование подтверждено, прибор выдан' })
}));

/**
 * Списание. Прибор НЕ переезжает в другую таблицу и НЕ меняет свой id —
 * он просто получает статус retired. Никаких префиксов '0'.
 */
instruments.post('/:id/retire', requireAdmin, (req, res) => transition(res, {
  id: req.params.id,
  actor: req.user,
  action: 'retire',
  guardMessage: 'Прибор уже списан',
  sql: `UPDATE instruments
           SET status = 'retired', retired_at = $2,
               taken_by = NULL, taken_where = NULL, taken_extra = NULL, taken_at = NULL,
               booked_by = NULL, booked_for = NULL, booked_extra = NULL
         WHERE id = $1 AND status <> 'retired'
         RETURNING *`,
  params: [req.params.id, today()],
  buildLog: () => ({ note: 'Прибор списан' })
}));

instruments.post('/:id/restore', requireAdmin, (req, res) => transition(res, {
  id: req.params.id,
  actor: req.user,
  action: 'restore',
  guardMessage: 'Прибор не находится в списанных',
  sql: `UPDATE instruments
           SET status = 'free', retired_at = NULL
         WHERE id = $1 AND status = 'retired'
         RETURNING *`,
  params: [req.params.id],
  buildLog: () => ({ note: 'Прибор восстановлен из списанных' })
}));

// ---------- Массовые операции ----------
// Выполняются одной транзакцией: либо обрабатываются все приборы, либо ни одного.

instruments.post('/bulk/retire', requireAdmin, async (req, res) => {
  const ids = (req.body?.ids || []).map(Number).filter(Boolean);
  if (!ids.length) return res.status(400).json({ error: 'Не выбрано ни одного прибора' });

  const count = await transaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE instruments
          SET status = 'retired', retired_at = $2,
              taken_by = NULL, taken_where = NULL, taken_extra = NULL, taken_at = NULL,
              booked_by = NULL, booked_for = NULL, booked_extra = NULL
        WHERE id = ANY($1::bigint[]) AND status <> 'retired'
        RETURNING *`,
      [ids, today()]
    );
    for (const instrument of rows) {
      await logEvent(client, {
        instrument, action: 'retire', actor: req.user, note: 'Прибор списан (массовая операция)'
      });
    }
    return rows.length;
  });
  res.json({ ok: true, count });
});

instruments.post('/bulk/delete', requireAdmin, async (req, res) => {
  const ids = (req.body?.ids || []).map(Number).filter(Boolean);
  if (!ids.length) return res.status(400).json({ error: 'Не выбрано ни одного прибора' });

  const count = await transaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM instruments WHERE id = ANY($1::bigint[])', [ids]);
    for (const instrument of rows) {
      await logEvent(client, {
        instrument, action: 'delete', actor: req.user, note: 'Прибор удалён (массовая операция)'
      });
    }
    await client.query('DELETE FROM instruments WHERE id = ANY($1::bigint[])', [ids]);
    return rows.length;
  });
  res.json({ ok: true, count });
});

/** Превращаем ошибки Postgres в понятный текст. */
function humanize(err) {
  if (err.code === '23505') return 'Прибор с таким инвентарным номером уже есть';
  if (err.code === '23514' && String(err.constraint).includes('dates_sane')) {
    return 'Дата поверки не может быть позже даты окончания её действия';
  }
  if (err.code === '23514') return 'Недопустимое состояние прибора';
  return err.message;
}
