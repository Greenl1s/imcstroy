import { Router } from 'express';
import { query, transaction } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { logEvent } from '../history.js';
import { fetchLinkedFile } from '../fileLink.js';
import { todayIso } from '../dates.js';
import { assertIssuable, assertIssuableLocked } from '../issuance.js';

// Как человека зовут. Логин остаётся делом входа — в журнале и в
// карточках прибора людям нужно имя.
const userName = (u) => (u && (u.name || u.username)) || '';

export const instruments = Router();
instruments.use(requireAuth);

// Сегодняшняя дата по Москве. Раньше здесь был toISOString(), считавший
// дату по Гринвичу: с полуночи до 03:00 МСК прибор записывался вчерашним
// числом. См. server/src/dates.js.
const today = () => todayIso();

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
      if (['transfer_request', 'transfer_accept', 'confirm_booking'].includes(action)) {
        await assertIssuableLocked(client, id);
      }
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

// ---------- Наличие ----------
/**
 * НАЛИЧИЕ: сколько штук прибора есть и сколько у кого на руках.
 *
 * Два одинаковых фонаря — одна карточка и цифра «2». Держателей у такой
 * карточки может быть несколько, и в поля taken_by / taken_at, рассчитанные
 * на одного, они не помещаются. Поэтому у многоштучных приборов держатели
 * живут в instrument_holdings, а taken_by остаётся пустым: назвать одного
 * из троих «тем самым» было бы неправдой.
 *
 * Прибор с наличием 1 — а это все прежние приборы — идёт по СТАРОМУ пути,
 * ни одной строкой иначе. Это не лень: менять работающий каждый день
 * механизм выдачи ради единообразия значит рисковать им ради фонарей.
 *
 * Все проверки остатка делаются в базе, под FOR UPDATE. Если двое
 * одновременно возьмут последнюю штуку, второй получит честный отказ,
 * а не минус один в наличии.
 */
const MAX_QTY = 999;

const isMulti = (instrument) => Number(instrument.qty) > 1;

function parseQty(value, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), MAX_QTY);
}

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

/** Прибор со свежим остатком, заблокированный до конца транзакции. */
async function lockInstrument(client, id) {
  const { rows } = await client.query(
    `SELECT i.*, COALESCE((SELECT SUM(h.qty)::int FROM instrument_holdings h
                            WHERE h.instrument_id = i.id), 0) AS held_qty
       FROM instruments i WHERE i.id = $1 FOR UPDATE OF i`,
    [id]
  );
  if (!rows.length) fail(404, 'Прибор не найден');
  const row = rows[0];
  row.free_qty = Number(row.qty) - Number(row.held_qty);
  return row;
}

/**
 * Состояние многоштучного прибора — не отдельное решение, а следствие
 * остатка: есть свободные — free, разобрали все — busy. Пересчитывается
 * после каждой выдачи и возврата, чтобы список и фильтры не разошлись
 * с карточкой.
 */
async function syncMultiStatus(client, id) {
  const { rows } = await client.query(
    `UPDATE instruments i
        SET status = CASE
              WHEN i.status = 'retired' THEN 'retired'::instrument_status
              WHEN i.qty - COALESCE((SELECT SUM(h.qty)::int FROM instrument_holdings h
                                      WHERE h.instrument_id = i.id), 0) > 0
                THEN 'free'::instrument_status
              ELSE 'busy'::instrument_status
            END
      WHERE i.id = $1 RETURNING *`,
    [id]
  );
  return rows[0];
}

/** Строка «2 шт» — только там, где штук правда несколько. */
const pieces = (n) => `${n} шт`;

/**
 * Выдача одной записи. Общая и для одиночной кнопки, и для групповой —
 * иначе две выдачи разошлись бы в мелочах, а мелочь здесь это остаток.
 */
async function issueOne(client, { instrument, user, qty, where, extra, at }) {
  assertIssuable(instrument);
  if (!isMulti(instrument)) {
    const { rows } = await client.query(
      `UPDATE instruments
          SET status = 'busy', taken_by = $2, taken_where = $3, taken_extra = $4, taken_at = $5
        WHERE id = $1 AND status = 'free'
        RETURNING *`,
      [instrument.id, user.id, where, extra, at]
    );
    if (!rows.length) fail(409, `«${instrument.name}» уже занят или забронирован`);
    return { row: rows[0], qty: 1 };
  }

  if (instrument.status === 'retired') fail(409, `«${instrument.name}» списан`);
  if (instrument.free_qty <= 0) fail(409, `«${instrument.name}»: свободных штук нет`);
  if (qty > instrument.free_qty) {
    fail(409, `«${instrument.name}»: свободно ${pieces(instrument.free_qty)}, ` +
      `а взять хотят ${pieces(qty)}`);
  }

  // Один человек — одна запись на прибор. Взял ещё штуку — прибавляется
  // к его же строке, иначе в карточке было бы «Петров — 1 шт» трижды.
  await client.query(
    `INSERT INTO instrument_holdings (instrument_id, user_id, qty, taken_where, taken_extra, taken_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (instrument_id, user_id) DO UPDATE
        SET qty = instrument_holdings.qty + EXCLUDED.qty,
            taken_where = COALESCE(EXCLUDED.taken_where, instrument_holdings.taken_where),
            taken_extra = COALESCE(EXCLUDED.taken_extra, instrument_holdings.taken_extra)`,
    [instrument.id, user.id, qty, where, extra, at]
  );
  return { row: await syncMultiStatus(client, instrument.id), qty };
}

/**
 * Возврат. У многоштучного прибора возвращают СВОИ штуки; администратор
 * может вернуть за любого — тогда он называет, за кого (holderId).
 */
async function returnOne(client, { instrument, user, isAdmin, qty, holderId }) {
  if (!isMulti(instrument)) {
    const { rows } = await client.query(
      `UPDATE instruments
          SET status = 'free', taken_by = NULL, taken_where = NULL,
              taken_extra = NULL, taken_at = NULL
        WHERE id = $1 AND status = 'busy' AND (taken_by = $2 OR $3)
        RETURNING *`,
      [instrument.id, user.id, isAdmin]
    );
    if (!rows.length) {
      fail(409, `«${instrument.name}» не выдан или выдан другому пользователю`);
    }
    return { row: rows[0], qty: 1, holderName: null };
  }

  const target = isAdmin && holderId ? Number(holderId) : user.id;
  const { rows: held } = await client.query(
    `SELECT h.*, COALESCE(NULLIF(btrim(u.full_name), ''), u.username) AS name
       FROM instrument_holdings h JOIN users u ON u.id = h.user_id
      WHERE h.instrument_id = $1 AND h.user_id = $2`,
    [instrument.id, target]
  );
  if (!held.length) {
    fail(409, target === user.id
      ? `«${instrument.name}» за вами не числится`
      : `«${instrument.name}» за этим человеком не числится`);
  }
  const holding = held[0];
  // Ничего не указали — возвращают всё своё: так и бывает почти всегда.
  const back = qty === null ? holding.qty : qty;
  if (back > holding.qty) {
    fail(409, `«${instrument.name}»: на руках ${pieces(holding.qty)}, ` +
      `вернуть хотят ${pieces(back)}`);
  }

  if (back === holding.qty) {
    await client.query('DELETE FROM instrument_holdings WHERE id = $1', [holding.id]);
  } else {
    await client.query('UPDATE instrument_holdings SET qty = qty - $2 WHERE id = $1',
      [holding.id, back]);
  }
  return {
    row: await syncMultiStatus(client, instrument.id),
    qty: back,
    holderName: holding.name,
  };
}

/**
 * Бронь и передача для многоштучных приборов пока не сделаны — и лучше
 * честно отказать, чем забронировать «весь фонарь целиком», когда два из
 * трёх уже у людей на руках. Это следующая работа, а не забытый случай.
 */
function refuseMulti(instrument, what) {
  if (isMulti(instrument)) {
    fail(409, `«${instrument.name}»: ${what} для приборов с наличием больше одного ` +
      'пока не сделана — скажите, если нужна');
  }
}

/** Тот же запрет, но по номеру прибора — до начала операции. */
async function assertSingleOp(res, id, what) {
  const { rows } = await query('SELECT id, name, qty FROM instruments WHERE id = $1', [id]);
  if (!rows.length) return true;              // «не найден» скажет сама операция
  try {
    refuseMulti(rows[0], what);
    return true;
  } catch (err) {
    res.status(err.status).json({ error: err.message });
    return false;
  }
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

/**
 * В какие комплекты входит этот прибор — для блока в карточке.
 * Прибор может входить в сколько угодно комплектов сразу: физически
 * он один, поэтому взятый в одном комплекте в остальных покажется
 * занятым. Здесь просто список, без проверок.
 */
instruments.get('/:id/kits', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT k.id, k.name, kv.total
         FROM kit_items ki
         JOIN kits k       ON k.id = ki.kit_id
         JOIN kits_view kv ON kv.id = k.id
        WHERE ki.instrument_id = $1
        ORDER BY lower(k.name)`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    // 42P01 = таблицы ещё нет: код обновили, миграцию 032 не применили.
    // Карточка прибора из-за этого падать не должна — просто нет комплектов.
    if (err.code === '42P01') return res.json([]);
    throw err;
  }
});

// ---------- Фото ----------

/**
 * Если у прибора привязан файл из файлового менеджера (photo_link_path) —
 * забираем его оттуда по внутренней докер-сети и отдаём как обычно.
 * Иначе — как раньше, байты из instrument_photos.
 */
instruments.get('/:id/photo', async (req, res) => {
  const { rows: instRows } = await query(
    'SELECT photo_link_path FROM instruments WHERE id = $1',
    [req.params.id]
  );
  if (!instRows.length) return res.status(404).end();

  const linkPath = instRows[0].photo_link_path;
  if (linkPath) {
    try {
      // Передаём, КТО смотрит: файловый менеджер проверит его права на
      // папку. Без этого привязанный документ из закрытой папки "Дел"
      // видел любой, кто просто вошёл в "Учёт приборов".
      const { buffer, contentType } = await fetchLinkedFile(linkPath, req.user.id);
      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'private, no-store');
      return res.send(buffer);
    } catch (err) {
      if (err.status === 403) {
        return res.status(403).json({ error: 'У вас нет доступа к этому файлу' });
      }
      console.error('Не удалось получить привязанное фото из файлового менеджера:', err);
      return res.status(502).json({ error: 'Не удалось получить файл из файлового менеджера' });
    }
  }

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
  // Загрузка с компьютера отменяет ранее привязанный файл из файлового менеджера.
  await query('UPDATE instruments SET photo_link_path = NULL WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

/** Привязка фото из файлового менеджера вместо загрузки с компьютера. */
instruments.put('/:id/photo/link', requireAdmin, async (req, res) => {
  const linkPath = req.body?.path;
  if (!linkPath || typeof linkPath !== 'string') {
    return res.status(400).json({ error: 'Не указан путь к файлу' });
  }
  await query('UPDATE instruments SET photo_link_path = $2 WHERE id = $1', [req.params.id, linkPath]);
  // Привязка отменяет ранее загруженное с компьютера фото.
  await query('DELETE FROM instrument_photos WHERE instrument_id = $1', [req.params.id]);
  res.json({ ok: true });
});

instruments.delete('/:id/photo', requireAdmin, async (req, res) => {
  await query('DELETE FROM instrument_photos WHERE instrument_id = $1', [req.params.id]);
  await query('UPDATE instruments SET photo_link_path = NULL WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ---------- Фото документа (замена ссылки на документ) ----------

instruments.get('/:id/document', async (req, res) => {
  const { rows: instRows } = await query(
    'SELECT document_link_path FROM instruments WHERE id = $1',
    [req.params.id]
  );
  if (!instRows.length) return res.status(404).end();

  const linkPath = instRows[0].document_link_path;
  if (linkPath) {
    try {
      const { buffer, contentType } = await fetchLinkedFile(linkPath, req.user.id);
      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'private, no-store');
      return res.send(buffer);
    } catch (err) {
      if (err.status === 403) {
        return res.status(403).json({ error: 'У вас нет доступа к этому файлу' });
      }
      console.error('Не удалось получить привязанный документ из файлового менеджера:', err);
      return res.status(502).json({ error: 'Не удалось получить файл из файлового менеджера' });
    }
  }

  const { rows } = await query(
    'SELECT mime_type, bytes FROM instrument_documents WHERE instrument_id = $1',
    [req.params.id]
  );
  if (!rows.length) return res.status(404).end();
  res.set('Content-Type', rows[0].mime_type);
  res.set('Cache-Control', 'private, max-age=300');
  res.send(rows[0].bytes);
});

instruments.put('/:id/document', requireAdmin, async (req, res) => {
  const { data_url } = req.body || {};
  const match = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(String(data_url || ''));
  if (!match) return res.status(400).json({ error: 'Ожидается изображение в формате data URL' });

  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > 5 * 1024 * 1024) {
    return res.status(413).json({ error: 'Файл больше 5 МБ' });
  }
  await query(
    `INSERT INTO instrument_documents (instrument_id, mime_type, bytes, size_bytes)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (instrument_id)
     DO UPDATE SET mime_type = EXCLUDED.mime_type, bytes = EXCLUDED.bytes,
                   size_bytes = EXCLUDED.size_bytes, uploaded_at = now()`,
    [req.params.id, match[1], bytes, bytes.length]
  );
  await query('UPDATE instruments SET document_link_path = NULL WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

/** Привязка документа из файлового менеджера вместо загрузки с компьютера. */
instruments.put('/:id/document/link', requireAdmin, async (req, res) => {
  const linkPath = req.body?.path;
  if (!linkPath || typeof linkPath !== 'string') {
    return res.status(400).json({ error: 'Не указан путь к файлу' });
  }
  await query('UPDATE instruments SET document_link_path = $2 WHERE id = $1', [req.params.id, linkPath]);
  await query('DELETE FROM instrument_documents WHERE instrument_id = $1', [req.params.id]);
  res.json({ ok: true });
});

instruments.delete('/:id/document', requireAdmin, async (req, res) => {
  await query('DELETE FROM instrument_documents WHERE instrument_id = $1', [req.params.id]);
  await query('UPDATE instruments SET document_link_path = NULL WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ---------- Создание / изменение / удаление ----------

export const EDITABLE = [
  'inventory_no', 'name', 'serial_number', 'model', 'check_type', 'control_type',
  'verification_date', 'valid_until', 'comment', 'company_code', 'qty'
];

/** Пустая строка из формы должна стать NULL, а не '' — иначе даты не сохранятся. */
const nullify = (v) => (v === '' || v === undefined ? null : v);

/**
 * Комментарий — исключение: колонка NOT NULL, пустое значение должно остаться '', а не стать NULL.
 * Наличие — тоже: пустое поле в форме значит «одна штука», а не «неизвестно».
 */
const toDbValue = (key, v) => {
  if (key === 'comment') return String(v ?? '');
  if (key === 'qty') return parseQty(v);
  return nullify(v);
};

instruments.post('/', requireAdmin, async (req, res) => {
  const values = EDITABLE.map((key) => toDbValue(key, req.body?.[key]));
  const checkType = nullify(req.body?.check_type) || 'verification';
  const qty = parseQty(req.body?.qty);
  if (checkType !== 'none' && qty !== 1) {
    return res.status(400).json({
      error: 'Для прибора с поверкой или калибровкой каждый экземпляр создаётся отдельной карточкой'
    });
  }
  try {
    const row = await transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO instruments
           (inventory_no, name, serial_number, model, check_type, control_type,
            verification_date, valid_until, comment, company_code, qty)
         VALUES ($1, $2, $3, $4, coalesce($5::check_type, 'verification'), $6,
                 $7, $8, coalesce($9, ''), $10, coalesce($11, 1))
         RETURNING *`,
        values
      );
      await logEvent(client, {
        instrument: rows[0], action: 'create', actor: req.user, note: 'Прибор добавлен'
      });
      const copyPhotoFrom = Number(req.body?.copy_photo_from_id);
      if (Number.isInteger(copyPhotoFrom) && copyPhotoFrom > 0) {
        // У экземпляров одной модели может быть общее изображение прибора,
        // но свидетельство и даты намеренно не копируем: они индивидуальны.
        await client.query(
          `UPDATE instruments target
              SET photo_link_path = source.photo_link_path
             FROM instruments source
            WHERE target.id = $1 AND source.id = $2`,
          [rows[0].id, copyPhotoFrom]
        );
        await client.query(
          `INSERT INTO instrument_photos (instrument_id, mime_type, bytes, size_bytes)
           SELECT $1, mime_type, bytes, size_bytes
             FROM instrument_photos WHERE instrument_id = $2
           ON CONFLICT (instrument_id) DO NOTHING`,
          [rows[0].id, copyPhotoFrom]
        );
      }
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

  // check_type по-прежнему настоящий enum в базе — явно указываем тип.
  // control_type теперь обычный текст (со ссылкой на таблицу control_types),
  // ему такой каст больше не нужен.
  const ENUM_CASTS = { check_type: '::check_type' };
  const set = updates
    .map((key, i) => `${key} = $${i + 2}${ENUM_CASTS[key] || ''}`)
    .join(', ');
  const params = [req.params.id, ...updates.map((key) => toDbValue(key, req.body[key]))];

  try {
    const row = await transaction(async (client) => {
      // Наличие нельзя опустить ниже того, что уже на руках: «выдано две,
      // а есть одна» — это не данные, а ошибка, о которой потом никто не
      // догадается. Проверяем под замком, чтобы между проверкой и записью
      // никто не успел взять ещё одну штуку.
      if (updates.includes('qty') || updates.includes('check_type')) {
        const current = await lockInstrument(client, req.params.id);
        const wanted = updates.includes('qty') ? parseQty(req.body.qty) : parseQty(current.qty);
        const wantedCheckType = updates.includes('check_type')
          ? (nullify(req.body.check_type) || 'verification')
          : current.check_type;
        if (wantedCheckType !== 'none' && wanted !== 1) {
          fail(409, 'Для прибора с поверкой или калибровкой каждый экземпляр должен иметь отдельную карточку');
        }
        if (wanted < current.held_qty) {
          fail(409, `На руках ${pieces(current.held_qty)} — меньше этого наличие ` +
            'поставить нельзя. Сначала примите возврат.');
        }
      }
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

// ---------- Массовые операции ----------
// Взять/забронировать доступны любому пользователю (как и одиночные версии).
// В отличие от списания/удаления, тут возможен частичный успех: один прибор
// мог быть занят кем-то прямо перед этим — обрабатываем каждый по отдельности
// и возвращаем и успехи, и неудачи, а не проваливаем всю операцию целиком.

instruments.post('/bulk/confirm-booking', async (req, res) => {
  const ids = (req.body?.ids || []).map(Number).filter(Boolean);
  if (!ids.length) return res.status(400).json({ error: 'Не выбрано ни одного прибора' });

  const succeeded = [];
  const failed = [];

  for (const id of ids) {
    try {
      const instrument = await transaction(async (client) => {
        await assertIssuableLocked(client, id);
        const { rows } = await client.query(
          `UPDATE instruments
              SET status = 'busy',
                  taken_by = booked_by, taken_at = $4, taken_extra = booked_extra,
                  taken_where = booked_where,
                  booked_by = NULL, booked_for = NULL, booked_extra = NULL, booked_where = NULL
            WHERE id = $1 AND status = 'booked' AND (booked_by = $2 OR $3)
            RETURNING *`,
          [id, req.user.id, req.user.role === 'admin', today()]
        );
        if (!rows.length) {
          const exists = await client.query('SELECT name FROM instruments WHERE id = $1', [id]);
          const err = new Error(
            exists.rows.length
              ? `«${exists.rows[0].name}» не забронирован или бронь оформлена другим пользователем`
              : 'Прибор не найден'
          );
          err.status = exists.rows.length ? 409 : 404;
          throw err;
        }
        const row = rows[0];
        await logEvent(client, {
          instrument: row, action: 'confirm_booking', actor: req.user,
          note: 'Бронирование подтверждено, прибор выдан (групповая операция)'
        });
        return row;
      });
      succeeded.push({ id, name: instrument.name });
    } catch (err) {
      failed.push({ id, message: err.message });
    }
  }

  res.json({ ok: true, succeeded, failed });
});

instruments.post('/bulk/cancel-booking', async (req, res) => {
  const ids = (req.body?.ids || []).map(Number).filter(Boolean);
  if (!ids.length) return res.status(400).json({ error: 'Не выбрано ни одного прибора' });

  const succeeded = [];
  const failed = [];

  for (const id of ids) {
    try {
      const instrument = await transaction(async (client) => {
        const { rows } = await client.query(
          `UPDATE instruments
              SET status = 'free', booked_by = NULL, booked_for = NULL, booked_extra = NULL, booked_where = NULL
            WHERE id = $1 AND status = 'booked' AND (booked_by = $2 OR $3)
            RETURNING *`,
          [id, req.user.id, req.user.role === 'admin']
        );
        if (!rows.length) {
          const exists = await client.query('SELECT name FROM instruments WHERE id = $1', [id]);
          const err = new Error(
            exists.rows.length
              ? `«${exists.rows[0].name}» не забронирован или бронь оформлена другим пользователем`
              : 'Прибор не найден'
          );
          err.status = exists.rows.length ? 409 : 404;
          throw err;
        }
        const row = rows[0];
        await logEvent(client, {
          instrument: row, action: 'cancel_booking', actor: req.user,
          note: 'Бронирование отменено (групповая операция)'
        });
        return row;
      });
      succeeded.push({ id, name: instrument.name });
    } catch (err) {
      failed.push({ id, message: err.message });
    }
  }

  res.json({ ok: true, succeeded, failed });
});

instruments.post('/bulk/return', async (req, res) => {
  const ids = (req.body?.ids || []).map(Number).filter(Boolean);
  if (!ids.length) return res.status(400).json({ error: 'Не выбрано ни одного прибора' });

  const succeeded = [];
  const failed = [];

  for (const id of ids) {
    try {
      const instrument = await transaction(async (client) => {
        const found = await lockInstrument(client, id);
        // Групповой возврат отдаёт ВСЁ своё: человек сдаёт то, что у него
        // на руках, а не отсчитывает по одной штуке.
        const done = await returnOne(client, {
          instrument: found, user: req.user,
          isAdmin: req.user.role === 'admin', qty: null, holderId: null,
        });
        await logEvent(client, {
          instrument: done.row, action: 'return', actor: req.user,
          note: isMulti(found)
            ? `Возвращён: ${userName(req.user)} — ${pieces(done.qty)} (групповая операция)`
            : `Возвращён: ${userName(req.user)} (групповая операция)`
        });
        return done.row;
      });
      succeeded.push({ id, name: instrument.name });
    } catch (err) {
      failed.push({ id, message: err.message });
    }
  }

  res.json({ ok: true, succeeded, failed });
});

instruments.post('/bulk/transfer', async (req, res) => {
  const ids = (req.body?.ids || []).map(Number).filter(Boolean);
  if (!ids.length) return res.status(400).json({ error: 'Не выбрано ни одного прибора' });

  const targetId = Number(req.body?.to_user_id);
  if (!targetId) return res.status(400).json({ error: 'Не выбран новый пользователь' });

  const { rows: target } = await query(
    `SELECT COALESCE(NULLIF(btrim(full_name), ''), username) AS name FROM users WHERE id = $1`,
    [targetId]);
  if (!target.length) return res.status(400).json({ error: 'Пользователь не найден' });

  const taken_where = nullify(req.body?.taken_where);
  const taken_extra = nullify(req.body?.taken_extra);

  const succeeded = [];
  const failed = [];

  for (const id of ids) {
    try {
      const instrument = await transaction(async (client) => {
        const found = await lockInstrument(client, id);
        refuseMulti(found, 'передача');
        assertIssuable(found);
        const { rows } = await client.query(
          `UPDATE instruments
              SET pending_transfer_to = $4, pending_transfer_where = $5, pending_transfer_extra = $6
            WHERE id = $1 AND status = 'busy' AND (taken_by = $2 OR $3) AND pending_transfer_to IS NULL
            RETURNING *`,
          [id, req.user.id, req.user.role === 'admin', targetId, taken_where, taken_extra]
        );
        if (!rows.length) {
          const err = new Error(
            `«${found.name}» можно передать, только если он у вас на руках и не ждёт другой передачи`
          );
          err.status = 409;
          throw err;
        }
        const row = rows[0];
        await logEvent(client, {
          instrument: row, action: 'transfer_request', actor: req.user,
          targetName: target[0].name, place: taken_where,
          note: `Запрошена передача: ${userName(req.user)} → ${target[0].name} (групповая операция), ожидает подтверждения`
        });
        return row;
      });
      succeeded.push({ id, name: instrument.name });
    } catch (err) {
      failed.push({ id, message: err.message });
    }
  }

  res.json({ ok: true, succeeded, failed });
});

instruments.post('/bulk/accept-transfer', async (req, res) => {
  const ids = (req.body?.ids || []).map(Number).filter(Boolean);
  if (!ids.length) return res.status(400).json({ error: 'Не выбрано ни одного прибора' });

  const succeeded = [];
  const failed = [];

  for (const id of ids) {
    try {
      const instrument = await transaction(async (client) => {
        await assertIssuableLocked(client, id);
        const { rows } = await client.query(
          `UPDATE instruments
              SET taken_by = pending_transfer_to,
                  taken_where = pending_transfer_where,
                  taken_extra = pending_transfer_extra,
                  taken_at = $3,
                  pending_transfer_to = NULL, pending_transfer_where = NULL, pending_transfer_extra = NULL
            WHERE id = $1 AND pending_transfer_to = $2
            RETURNING *`,
          [id, req.user.id, today()]
        );
        if (!rows.length) {
          const exists = await client.query('SELECT name FROM instruments WHERE id = $1', [id]);
          const err = new Error(
            exists.rows.length
              ? `«${exists.rows[0].name}» — эта передача не адресована вам или уже обработана`
              : 'Прибор не найден'
          );
          err.status = exists.rows.length ? 409 : 404;
          throw err;
        }
        const row = rows[0];
        await logEvent(client, {
          instrument: row, action: 'transfer_accept', actor: req.user,
          note: `Передача подтверждена: принял ${userName(req.user)} (групповая операция)`
        });
        return row;
      });
      succeeded.push({ id, name: instrument.name });
    } catch (err) {
      failed.push({ id, message: err.message });
    }
  }

  res.json({ ok: true, succeeded, failed });
});

instruments.post('/bulk/reject-transfer', async (req, res) => {
  const ids = (req.body?.ids || []).map(Number).filter(Boolean);
  if (!ids.length) return res.status(400).json({ error: 'Не выбрано ни одного прибора' });

  const succeeded = [];
  const failed = [];

  for (const id of ids) {
    try {
      const instrument = await transaction(async (client) => {
        const { rows } = await client.query(
          `UPDATE instruments
              SET pending_transfer_to = NULL, pending_transfer_where = NULL, pending_transfer_extra = NULL
            WHERE id = $1 AND pending_transfer_to = $2
            RETURNING *`,
          [id, req.user.id]
        );
        if (!rows.length) {
          const exists = await client.query('SELECT name FROM instruments WHERE id = $1', [id]);
          const err = new Error(
            exists.rows.length
              ? `«${exists.rows[0].name}» — эта передача не адресована вам или уже обработана`
              : 'Прибор не найден'
          );
          err.status = exists.rows.length ? 409 : 404;
          throw err;
        }
        const row = rows[0];
        await logEvent(client, {
          instrument: row, action: 'transfer_reject', actor: req.user,
          note: `Передача отклонена пользователем ${userName(req.user)} (групповая операция)`
        });
        return row;
      });
      succeeded.push({ id, name: instrument.name });
    } catch (err) {
      failed.push({ id, message: err.message });
    }
  }

  res.json({ ok: true, succeeded, failed });
});

instruments.post('/bulk/issue', async (req, res) => {
  const ids = (req.body?.ids || []).map(Number).filter(Boolean);
  if (!ids.length) return res.status(400).json({ error: 'Не выбрано ни одного прибора' });

  const taken_where = nullify(req.body?.taken_where);
  const taken_extra = nullify(req.body?.taken_extra);
  const taken_at = req.body?.taken_at || today();

  const succeeded = [];
  const failed = [];

  for (const id of ids) {
    try {
      const instrument = await transaction(async (client) => {
        const found = await lockInstrument(client, id);
        // Групповая выдача берёт по ОДНОЙ штуке: отметили галочками десять
        // приборов — значит взяли десять предметов. Сколько именно штук
        // многоштучного прибора нужно, спрашивают в его карточке.
        const done = await issueOne(client, {
          instrument: found, user: req.user, qty: 1,
          where: taken_where, extra: taken_extra, at: taken_at,
        });
        await logEvent(client, {
          instrument: done.row, action: 'issue', actor: req.user,
          targetName: userName(req.user), place: taken_where, extra: taken_extra,
          note: isMulti(found)
            ? `Выдан: ${userName(req.user)} — ${pieces(done.qty)} (групповая выдача)`
            : `Выдан: ${userName(req.user)} (групповая выдача)`
        });
        return done.row;
      });
      succeeded.push({ id, name: instrument.name });
    } catch (err) {
      failed.push({ id, message: err.message });
    }
  }

  res.json({ ok: true, succeeded, failed });
});

instruments.post('/bulk/book', async (req, res) => {
  const ids = (req.body?.ids || []).map(Number).filter(Boolean);
  if (!ids.length) return res.status(400).json({ error: 'Не выбрано ни одного прибора' });

  const booked_for = req.body?.booked_for || today();
  const booked_extra = nullify(req.body?.booked_extra);
  const booked_where = nullify(req.body?.booked_where);

  const succeeded = [];
  const failed = [];

  for (const id of ids) {
    try {
      const instrument = await transaction(async (client) => {
        const found = await lockInstrument(client, id);
        refuseMulti(found, 'бронь');
        const { rows } = await client.query(
          `UPDATE instruments
              SET status = 'booked', booked_by = $2, booked_for = $3, booked_extra = $4, booked_where = $5
            WHERE id = $1 AND status = 'free'
            RETURNING *`,
          [id, req.user.id, booked_for, booked_extra, booked_where]
        );
        if (!rows.length) {
          const err = new Error(`«${found.name}» уже занят или забронирован`);
          err.status = 409;
          throw err;
        }
        const row = rows[0];
        await logEvent(client, {
          instrument: row, action: 'book', actor: req.user,
          targetName: userName(req.user), place: booked_where, extra: booked_extra,
          note: `Забронирован на ${booked_for} (групповое бронирование)`
        });
        return row;
      });
      succeeded.push({ id, name: instrument.name });
    } catch (err) {
      failed.push({ id, message: err.message });
    }
  }

  res.json({ ok: true, succeeded, failed });
});

// ---------- Массовые операции (списание/удаление) ----------
// Выполняются одной транзакцией: либо обрабатываются все приборы, либо ни одного.

/**
 * Привязать (или отвязать) сразу несколько приборов к компании-владельцу.
 * Работает независимо от текущего статуса прибора — это просто смена
 * учётного поля, а не операция выдачи/возврата.
 *
 * Только администратор — как и смена того же поля в карточке прибора
 * (PATCH /:id, где company_code входит в EDITABLE). Без этой проверки
 * сотрудник не мог поменять владельца одному прибору, но мог поменять
 * его сразу сотне.
 */
instruments.post('/bulk/set-company', requireAdmin, async (req, res) => {
  const ids = (req.body?.ids || []).map(Number).filter(Boolean);
  if (!ids.length) return res.status(400).json({ error: 'Не выбрано ни одного прибора' });

  const companyCode = req.body?.company_code ? String(req.body.company_code) : null;

  const succeeded = [];
  const failed = [];

  for (const id of ids) {
    try {
      const instrument = await transaction(async (client) => {
        const { rows } = await client.query(
          `UPDATE instruments SET company_code = $2 WHERE id = $1 RETURNING *`,
          [id, companyCode]
        );
        if (!rows.length) {
          const err = new Error('Прибор не найден');
          err.status = 404;
          throw err;
        }
        const row = rows[0];
        await logEvent(client, {
          instrument: row, action: 'update', actor: req.user,
          note: companyCode
            ? `Назначен владелец (групповая операция)`
            : `Владелец снят (групповая операция)`
        });
        return row;
      });
      succeeded.push({ id, name: instrument.name });
    } catch (err) {
      failed.push({ id, message: humanize(err) });
    }
  }

  res.json({ ok: true, succeeded, failed });
});

instruments.post('/bulk/retire', requireAdmin, async (req, res) => {
  const ids = (req.body?.ids || []).map(Number).filter(Boolean);
  if (!ids.length) return res.status(400).json({ error: 'Не выбрано ни одного прибора' });

  const count = await transaction(async (client) => {
    // Списанный прибор ни за кем не числится — ни через taken_by, ни
    // через записи «на руках» у многоштучного. Иначе в наличии осталось
    // бы «2 на руках» у прибора, которого больше нет.
    const { rows } = await client.query(
      `WITH cleared AS (
         DELETE FROM instrument_holdings
          WHERE instrument_id = ANY($1::bigint[])
       )
       UPDATE instruments
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

// ---------- Операции с приборами ----------

instruments.post('/:id/issue', async (req, res) => {
  const where = nullify(req.body?.taken_where);
  const extra = nullify(req.body?.taken_extra);
  const at = req.body?.taken_at || today();
  try {
    const id = await transaction(async (client) => {
      const instrument = await lockInstrument(client, req.params.id);
      const wanted = parseQty(req.body?.qty);
      const done = await issueOne(client, { instrument, user: req.user, qty: wanted, where, extra, at });
      await logEvent(client, {
        instrument: done.row, action: 'issue', actor: req.user,
        targetName: userName(req.user), place: where, extra,
        note: isMulti(instrument)
          ? `Выдан: ${userName(req.user)} — ${pieces(done.qty)} (свободно ${
              instrument.free_qty - done.qty} из ${instrument.qty})`
          : `Выдан: ${userName(req.user)}`
      });
      return done.row.id;
    });
    res.json(await withNames(id));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/** Вернуть может тот, кто взял, либо администратор. */
instruments.post('/:id/return', async (req, res) => {
  const admin = req.user.role === 'admin';
  try {
    const id = await transaction(async (client) => {
      const instrument = await lockInstrument(client, req.params.id);
      const done = await returnOne(client, {
        instrument, user: req.user, isAdmin: admin,
        // Не указали сколько — возвращают всё своё.
        qty: req.body?.qty === undefined ? null : parseQty(req.body.qty),
        holderId: req.body?.holder_id,
      });
      await logEvent(client, {
        instrument: done.row, action: 'return', actor: req.user,
        targetName: done.holderName,
        note: isMulti(instrument)
          ? `Возвращён: ${done.holderName} — ${pieces(done.qty)}${
              done.holderName === userName(req.user) ? '' : ` (вернул ${userName(req.user)})`}`
          : `Возвращён: ${userName(req.user)}`
      });
      return done.row.id;
    });
    res.json(await withNames(id));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * Передать другому — только тот, у кого прибор на руках. Прибор НЕ переходит
 * сразу: тому, кому передают, приходит запрос на подтверждение, и только
 * после его согласия (см. /:id/accept-transfer) taken_by реально меняется.
 */
instruments.post('/:id/transfer', async (req, res) => {
  if (!await assertSingleOp(res, req.params.id, 'передача')) return;
  const targetId = Number(req.body?.to_user_id);
  if (!targetId) return res.status(400).json({ error: 'Не выбран новый пользователь' });

  const { rows: target } = await query(
    `SELECT COALESCE(NULLIF(btrim(full_name), ''), username) AS name FROM users WHERE id = $1`,
    [targetId]);
  if (!target.length) return res.status(400).json({ error: 'Пользователь не найден' });

  return transition(res, {
    id: req.params.id,
    actor: req.user,
    action: 'transfer_request',
    guardMessage: 'Передать можно только прибор на руках, у которого нет уже ожидающей передачи',
    sql: `UPDATE instruments
             SET pending_transfer_to = $4, pending_transfer_where = $5, pending_transfer_extra = $6
           WHERE id = $1 AND status = 'busy' AND (taken_by = $2 OR $3) AND pending_transfer_to IS NULL
           RETURNING *`,
    params: [
      req.params.id, req.user.id, req.user.role === 'admin', targetId,
      nullify(req.body?.taken_where), nullify(req.body?.taken_extra)
    ],
    buildLog: () => ({
      targetName: target[0].name,
      note: `Запрошена передача: ${userName(req.user)} → ${target[0].name}, ожидает подтверждения`
    })
  });
});

/** Получатель подтверждает — прибор реально переходит к нему. */
instruments.post('/:id/accept-transfer', (req, res) => transition(res, {
  id: req.params.id,
  actor: req.user,
  action: 'transfer_accept',
  guardMessage: 'Эта передача не адресована вам или уже обработана',
  sql: `UPDATE instruments
           SET taken_by = pending_transfer_to,
               taken_where = pending_transfer_where,
               taken_extra = pending_transfer_extra,
               taken_at = $3,
               pending_transfer_to = NULL, pending_transfer_where = NULL, pending_transfer_extra = NULL
         WHERE id = $1 AND pending_transfer_to = $2
         RETURNING *`,
  params: [req.params.id, req.user.id, today()],
  buildLog: () => ({ note: `Передача подтверждена: принял ${userName(req.user)}` })
}));

/** Получатель отклоняет — прибор остаётся у прежнего держателя. */
instruments.post('/:id/reject-transfer', (req, res) => transition(res, {
  id: req.params.id,
  actor: req.user,
  action: 'transfer_reject',
  guardMessage: 'Эта передача не адресована вам или уже обработана',
  sql: `UPDATE instruments
           SET pending_transfer_to = NULL, pending_transfer_where = NULL, pending_transfer_extra = NULL
         WHERE id = $1 AND pending_transfer_to = $2
         RETURNING *`,
  params: [req.params.id, req.user.id],
  buildLog: () => ({ note: `Передача отклонена пользователем ${userName(req.user)}` })
}));

instruments.post('/:id/book', async (req, res) => {
  if (!await assertSingleOp(res, req.params.id, 'бронь')) return;
  return transition(res, {
  id: req.params.id,
  actor: req.user,
  action: 'book',
  guardMessage: 'Прибор уже занят или забронирован',
  sql: `UPDATE instruments
           SET status = 'booked', booked_by = $2, booked_for = $3, booked_extra = $4, booked_where = $5
         WHERE id = $1 AND status = 'free'
         RETURNING *`,
  params: [
    req.params.id, req.user.id,
    req.body?.booked_for || today(), nullify(req.body?.booked_extra), nullify(req.body?.booked_where)
  ],
  buildLog: (i) => ({
    targetName: userName(req.user), place: i.booked_where, extra: i.booked_extra,
    note: `Забронирован на ${i.booked_for}`
  })
  });
});

instruments.post('/:id/cancel-booking', (req, res) => transition(res, {
  id: req.params.id,
  actor: req.user,
  action: 'cancel_booking',
  guardMessage: 'Прибор не забронирован или бронь оформлена другим пользователем',
  sql: `UPDATE instruments
           SET status = 'free', booked_by = NULL, booked_for = NULL, booked_extra = NULL, booked_where = NULL
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
  // "Место использования" не спрашиваем заново — берём то, что уже было
  // указано при бронировании (booked_where), чтобы не вводить дважды.
  sql: `UPDATE instruments
           SET status = 'busy',
               taken_by = booked_by, taken_at = $4, taken_extra = booked_extra,
               taken_where = booked_where,
               booked_by = NULL, booked_for = NULL, booked_extra = NULL, booked_where = NULL
         WHERE id = $1 AND status = 'booked' AND (booked_by = $2 OR $3)
         RETURNING *`,
  params: [
    req.params.id, req.user.id, req.user.role === 'admin',
    today()
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
  // Записи «на руках» уходят вместе с прибором — см. групповое списание.
  sql: `WITH cleared AS (
          DELETE FROM instrument_holdings WHERE instrument_id = $1
        )
        UPDATE instruments
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

/** Превращаем ошибки Postgres в понятный текст. */
function humanize(err) {
  if (err.code === '23505') return 'Прибор с таким инвентарным номером уже есть';
  if (err.code === '23503' && String(err.constraint).includes('control_type')) {
    return 'Такой классификации не существует';
  }
  if (err.code === '23503' && String(err.constraint).includes('company_code')) {
    return 'Такой компании не существует';
  }
  if (err.code === '23514' && String(err.constraint).includes('dates_sane')) {
    return 'Дата поверки не может быть позже даты окончания её действия';
  }
  if (err.code === '23514') return 'Недопустимое состояние прибора';
  return err.message;
}
