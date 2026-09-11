import express from 'express';
import { query, transaction } from '../db.js';
import { requireAuth } from '../auth.js';
import { expandRepeat, MAX_INSTANCES } from '../repeat.js';
import { checkBusy, WORK_START, WORK_END } from '../busy.js';
import { todayIso, toIso } from '../dates.js';

export const events = express.Router();
events.use(requireAuth);

// ---------- Разбор присланного ----------

/** «09:30» → 570. Пустое значение — это дело без времени, а не ошибка. */
function toMinutes(value) {
  if (value === null || value === undefined || value === '') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value).trim());
  if (!m) return NaN;
  const min = Number(m[1]) * 60 + Number(m[2]);
  return min >= 0 && min <= 1440 ? min : NaN;
}

const clean = (value, max = 400) => String(value ?? '').trim().slice(0, max);

function parseTimes(body) {
  const start = toMinutes(body.start);
  const end = toMinutes(body.end);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return { error: 'Время указывается как 09:30' };
  }
  // Указали только начало — считаем, что дело на час: так думают люди,
  // и это лучше, чем отказ с придиркой.
  if (start !== null && end === null) return { start, end: Math.min(start + 60, 1440) };
  if (start === null && end !== null) return { error: 'Указано окончание без начала' };
  if (start !== null && end <= start) return { error: 'Окончание раньше начала' };
  return { start, end };
}

// ---------- Чтение ----------

/**
 * Дела за период: свои и те встречи, куда позвали.
 * Чужие календари целиком отсюда не видны — только через проверку
 * занятости, и та отдаёт лишь время.
 */
events.get('/events', async (req, res) => {
  const from = toIso(req.query.from) || todayIso();
  const to = toIso(req.query.to) || from;
  if (to < from) return res.status(400).json({ error: 'Конец периода раньше начала' });

  const { rows } = await query(
    `SELECT v.* FROM cal_events_view v
      WHERE v.event_date BETWEEN $1 AND $2
        AND (v.owner_id = $3
             OR EXISTS (SELECT 1 FROM cal_event_guests g
                         WHERE g.event_id = v.id AND g.user_id = $3))
      ORDER BY v.event_date, v.start_min NULLS FIRST, v.id`,
    [from, to, req.user.id]
  );
  res.json(rows);
});

/** Кого можно позвать на встречу. Только имена — больше и не нужно. */
events.get('/people', async (req, res) => {
  const { rows } = await query(
    'SELECT id, username FROM users WHERE id <> $1 ORDER BY username',
    [req.user.id]
  );
  res.json(rows);
});

/**
 * Всё, что нужно странице при запуске: кто вошёл, какой сегодня день
 * по Москве и какие часы считать рабочими. Отдельного /me не заводим —
 * это один и тот же вопрос «с чего начинать рисовать».
 */
events.get('/settings', (req, res) => {
  res.json({
    user: { id: req.user.id, username: req.user.username, role: req.user.role },
    work_start: WORK_START,
    work_end: WORK_END,
    today: todayIso(),
  });
});

// ---------- Проверка занятости ----------

events.post('/busy', async (req, res) => {
  const dateIso = toIso(req.body?.date);
  if (!dateIso) return res.status(400).json({ error: 'Не указана дата' });

  const times = parseTimes(req.body || {});
  if (times.error) return res.status(400).json({ error: times.error });
  if (times.start === null) return res.json({ free: true, conflicts: [], suggestions: [] });

  const guests = Array.isArray(req.body?.guests) ? req.body.guests.map(Number).filter(Boolean) : [];
  const ignore = Array.isArray(req.body?.ignore_ids) ? req.body.ignore_ids.map(Number).filter(Boolean) : [];

  const result = await checkBusy({
    dateIso, start: times.start, end: times.end,
    userIds: [req.user.id, ...guests],
    ignoreIds: ignore,
  });
  res.json(result);
});

// ---------- Создание ----------

events.post('/events', async (req, res) => {
  const body = req.body || {};
  const title = clean(body.title, 200);
  if (!title) return res.status(400).json({ error: 'Без названия дело не найдётся' });

  const dateIso = toIso(body.date);
  if (!dateIso) return res.status(400).json({ error: 'Не указана дата' });

  const times = parseTimes(body);
  if (times.error) return res.status(400).json({ error: times.error });

  const guests = [...new Set((Array.isArray(body.guests) ? body.guests : []).map(Number).filter(Boolean))]
    .filter((id) => id !== req.user.id);
  const kind = guests.length ? 'meeting' : 'task';

  const rule = ['none', 'daily', 'weekdays', 'weekly', 'monthly'].includes(body.repeat) ? body.repeat : 'none';
  const until = toIso(body.repeat_until);
  const dates = expandRepeat(dateIso, rule, until);

  // Встречу с участниками не повторяем автоматически: серия встреч
  // требует проверки занятости на каждый день, а это уже не «повтор»,
  // а планирование. Пока честно ограничиваем.
  if (guests.length && dates.length > 1) {
    return res.status(400).json({ error: 'Повторяющуюся встречу пока сделать нельзя — только повторяющееся дело' });
  }

  if (guests.length && times.start !== null) {
    const check = await checkBusy({
      dateIso, start: times.start, end: times.end, userIds: [req.user.id, ...guests],
    });
    if (!check.free) {
      // 409, а не 400: дело не в форме, а в том, что время уже занято.
      return res.status(409).json({
        error: 'В это время занято',
        conflicts: check.conflicts,
        suggestions: check.suggestions,
      });
    }
  }

  try {
    const created = await transaction(async (client) => {
      const made = [];
      let seriesId = null;

      for (const d of dates) {
        const { rows } = await client.query(
          `INSERT INTO cal_events (owner_id, title, note, place, event_date, start_min, end_min, kind, series_id, repeat_rule)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
          [req.user.id, title, clean(body.note, 2000), clean(body.place, 200),
           d, times.start, times.end, kind, seriesId, rule]
        );
        const id = rows[0].id;
        // Первая строка серии — сама себе родитель: так вся серия
        // находится одним условием series_id = X, включая первый день.
        if (seriesId === null) {
          seriesId = id;
          await client.query('UPDATE cal_events SET series_id = $1 WHERE id = $1', [id]);
        }
        for (const g of guests) {
          await client.query('INSERT INTO cal_event_guests (event_id, user_id) VALUES ($1, $2)', [id, g]);
        }
        made.push(id);
      }
      return made;
    });

    const { rows } = await query('SELECT * FROM cal_events_view WHERE id = $1', [created[0]]);
    res.status(201).json({ event: rows[0], created: created.length });
  } catch (err) {
    console.error('[calendar] создание:', err);
    res.status(400).json({ error: 'Не удалось сохранить дело' });
  }
});

// ---------- Изменение ----------

async function loadOwned(id, userId) {
  const { rows } = await query('SELECT * FROM cal_events WHERE id = $1', [id]);
  if (!rows.length) return { error: { status: 404, message: 'Дело не найдено' } };
  if (Number(rows[0].owner_id) !== Number(userId)) {
    return { error: { status: 403, message: 'Это дело завёл другой человек' } };
  }
  return { row: rows[0] };
}

/**
 * Изменение одного дня. Перетаскивание на другую дату приходит сюда же:
 * для календаря «перенести» — это и есть смена даты, отдельного метода
 * заводить незачем.
 */
events.patch('/events/:id', async (req, res) => {
  const { row, error } = await loadOwned(req.params.id, req.user.id);
  if (error) return res.status(error.status).json({ error: error.message });

  const body = req.body || {};
  const patch = {};

  if (body.title !== undefined) {
    const title = clean(body.title, 200);
    if (!title) return res.status(400).json({ error: 'Название не может быть пустым' });
    patch.title = title;
  }
  if (body.note !== undefined) patch.note = clean(body.note, 2000);
  if (body.place !== undefined) patch.place = clean(body.place, 200);

  if (body.date !== undefined) {
    const dateIso = toIso(body.date);
    if (!dateIso) return res.status(400).json({ error: 'Не разобрал дату' });
    patch.event_date = dateIso;
  }

  if (body.start !== undefined || body.end !== undefined) {
    const times = parseTimes({
      start: body.start !== undefined ? body.start : minutesToText(row.start_min),
      end: body.end !== undefined ? body.end : minutesToText(row.end_min),
    });
    if (times.error) return res.status(400).json({ error: times.error });
    patch.start_min = times.start;
    patch.end_min = times.end;
  }

  if (!Object.keys(patch).length) return res.status(400).json({ error: 'Нечего менять' });

  const date = patch.event_date || row.event_date;
  const start = patch.start_min !== undefined ? patch.start_min : row.start_min;
  const end = patch.end_min !== undefined ? patch.end_min : row.end_min;

  // У встречи проверяем занятость и при переносе: иначе перетаскиванием
  // можно было бы поставить встречу поверх чужой — в обход формы.
  if (start !== null) {
    const { rows: guestRows } = await query('SELECT user_id FROM cal_event_guests WHERE event_id = $1', [row.id]);
    if (guestRows.length) {
      const check = await checkBusy({
        dateIso: date, start, end,
        userIds: [req.user.id, ...guestRows.map((g) => Number(g.user_id))],
        ignoreIds: [Number(row.id)],
      });
      if (!check.free) {
        return res.status(409).json({ error: 'В это время занято', conflicts: check.conflicts, suggestions: check.suggestions });
      }
    }
  }

  const keys = Object.keys(patch);
  const set = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const { rows } = await query(
    `UPDATE cal_events SET ${set}, updated_at = now() WHERE id = $1 RETURNING id`,
    [row.id, ...keys.map((k) => patch[k])]
  );
  const { rows: view } = await query('SELECT * FROM cal_events_view WHERE id = $1', [rows[0].id]);
  res.json(view[0]);
});

function minutesToText(min) {
  if (min === null || min === undefined) return '';
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/** Галочка. Снять её так же просто, как поставить — done: false. */
events.post('/events/:id/done', async (req, res) => {
  const { row, error } = await loadOwned(req.params.id, req.user.id);
  if (error) return res.status(error.status).json({ error: error.message });

  const done = req.body?.done !== false;
  const { rows } = await query(
    'UPDATE cal_events SET done_at = $2, updated_at = now() WHERE id = $1 RETURNING id',
    [row.id, done ? new Date() : null]
  );
  const { rows: view } = await query('SELECT * FROM cal_events_view WHERE id = $1', [rows[0].id]);
  res.json(view[0]);
});

/** Удаление одного дня или всей серии (?series=1). */
events.delete('/events/:id', async (req, res) => {
  const { row, error } = await loadOwned(req.params.id, req.user.id);
  if (error) return res.status(error.status).json({ error: error.message });

  const whole = String(req.query.series || '') === '1' && row.series_id;
  const { rowCount } = whole
    ? await query('DELETE FROM cal_events WHERE series_id = $1 AND owner_id = $2', [row.series_id, req.user.id])
    : await query('DELETE FROM cal_events WHERE id = $1', [row.id]);

  res.json({ ok: true, deleted: rowCount });
});

/** Выйти из чужой встречи. Своё дело удаляют, в чужом — просто не участвуют. */
events.delete('/events/:id/me', async (req, res) => {
  const { rowCount } = await query(
    'DELETE FROM cal_event_guests WHERE event_id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );
  if (!rowCount) return res.status(404).json({ error: 'Вы и так не участник этой встречи' });
  res.json({ ok: true });
});

export const MAX_SERIES = MAX_INSTANCES;
