import { Router } from 'express';
import { query, transaction } from '../db.js';
import { requireAuth } from '../auth.js';
import { logEvent } from '../history.js';
import { todayIso } from '../dates.js';

/**
 * Комплекты приборов.
 *
 * Комплект — сохранённый список приборов, который берётся одной кнопкой.
 * Это шаблон, а не коробка: приборы остаются в общем списке, их можно
 * брать поштучно, статус у каждого свой. Один прибор входит в сколько
 * угодно комплектов — физически он один, поэтому если его взяли
 * в одном комплекте, в остальных он покажется занятым.
 *
 * Своего состояния у комплекта нет. Всё, что показывается («4 из 5
 * на руках»), считается на лету из статусов приборов. Хранимое поле
 * рано или поздно разошлось бы с действительностью: прибор можно
 * вернуть поштучно, мимо комплекта.
 *
 * Права: комплекты общие. Видит, берёт, создаёт и правит любой
 * авторизованный сотрудник. Отдельного требования requireAdmin здесь
 * намеренно нет — так решено при проектировании.
 */
export const kits = Router();
kits.use(requireAuth);

const today = () => todayIso();
const nullify = (value) => {
  const text = String(value ?? '').trim();
  return text === '' ? null : text;
};

/** 404, если комплекта нет. Возвращает строку из kits. */
async function loadKit(id) {
  const { rows } = await query('SELECT * FROM kits WHERE id = $1', [id]);
  if (!rows.length) {
    const err = new Error('Комплект не найден');
    err.status = 404;
    throw err;
  }
  return rows[0];
}

/**
 * Состав комплекта с текущим состоянием каждого прибора и готовым
 * ответом на вопрос «можно ли его сейчас взять».
 *
 * Решение принимается ЗДЕСЬ, а не в браузере, по одной причине:
 * тот же самый ответ нужен и списку, и экрану проверки, и в будущем —
 * выгрузкам. Если бы правило жило в JS на странице, оно неизбежно
 * разъехалось бы с сервером.
 *
 * У каждого прибора появляются три служебных поля:
 *   takeable  — можно ли взять прямо сейчас (статус free)
 *   blocked   — почему нельзя, человеческим языком (или null)
 *   warning   — можно, но стоит знать (просроченная поверка) (или null)
 */
async function kitItems(kitId) {
  const { rows } = await query(
    `SELECT i.*, ki.position
       FROM kit_items ki
       JOIN instruments_view i ON i.id = ki.instrument_id
      WHERE ki.kit_id = $1
      ORDER BY ki.position, i.id`,
    [kitId]
  );

  const now = today();

  return rows.map((item) => {
    let blocked = null;
    if (item.status === 'busy') {
      const who = item.taken_by_name ? `у ${item.taken_by_name}` : 'выдан';
      const since = item.taken_at ? ` с ${item.taken_at}` : '';
      blocked = `Занят — ${who}${since}`;
    } else if (item.status === 'booked') {
      const who = item.booked_by_name ? `${item.booked_by_name}` : 'другим сотрудником';
      blocked = `Забронирован — ${who}${item.booked_for ? ` на ${item.booked_for}` : ''}`;
    } else if (item.status === 'retired') {
      blocked = 'Списан';
    }

    // Поверка не мешает взять прибор — только предупреждает.
    // Решение остаётся за человеком, это его ответственность,
    // а не повод запретить выезд.
    let warning = null;
    if (!blocked && item.check_type !== 'none') {
      if (!item.valid_until) {
        warning = 'Срок поверки не заполнен';
      } else if (item.valid_until < now) {
        warning = `Поверка просрочена (до ${item.valid_until})`;
      }
    }

    return { ...item, takeable: !blocked, blocked, warning };
  });
}

// ---------- Чтение ----------

/** Список комплектов со счётчиками. Виден всем. */
kits.get('/', async (req, res) => {
  const { rows } = await query('SELECT * FROM kits_view ORDER BY lower(name)');
  res.json(rows);
});

/**
 * Один комплект вместе с составом и текущим состоянием приборов.
 * Это же и есть данные для экрана «Проверка перед выездом» —
 * отдельного маршрута для него не нужно.
 */
kits.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  await loadKit(id);
  const { rows } = await query('SELECT * FROM kits_view WHERE id = $1', [id]);
  const items = await kitItems(id);
  res.json({ ...rows[0], items });
});

// ---------- Создание и правка ----------

/**
 * Создать комплект. Можно сразу передать состав (ids) — так работает
 * кнопка «Собрать комплект» из отмеченных галочками приборов.
 */
kits.post('/', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const description = String(req.body?.description || '').trim();
  const ids = [...new Set((req.body?.ids || []).map(Number).filter(Boolean))];

  if (!name) return res.status(400).json({ error: 'Укажите название комплекта' });
  if (name.length > 120) return res.status(400).json({ error: 'Название длиннее 120 символов' });

  try {
    const kit = await transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO kits (name, description, created_by) VALUES ($1, $2, $3) RETURNING *`,
        [name, description, req.user.id]
      );
      const created = rows[0];
      if (ids.length) await insertItems(client, created.id, ids, 0);
      return created;
    });
    const { rows } = await query('SELECT * FROM kits_view WHERE id = $1', [kit.id]);
    res.status(201).json({ ...rows[0], items: await kitItems(kit.id) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Комплект с таким названием уже есть' });
    }
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Один из приборов не найден' });
    }
    throw err;
  }
});

/**
 * Добавляет приборы в конец списка. Уже входящие молча пропускаются
 * (ON CONFLICT DO NOTHING) — повторное добавление не ошибка,
 * человек просто отметил галочкой то, что уже там было.
 */
async function insertItems(client, kitId, ids, startPosition) {
  let position = startPosition;
  for (const instrumentId of ids) {
    await client.query(
      `INSERT INTO kit_items (kit_id, instrument_id, position)
       VALUES ($1, $2, $3)
       ON CONFLICT (kit_id, instrument_id) DO NOTHING`,
      [kitId, instrumentId, position++]
    );
  }
}

/** Переименовать комплект / изменить описание. */
kits.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  await loadKit(id);

  const fields = [];
  const params = [id];

  if (req.body?.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) return res.status(400).json({ error: 'Название не может быть пустым' });
    if (name.length > 120) return res.status(400).json({ error: 'Название длиннее 120 символов' });
    params.push(name);
    fields.push(`name = $${params.length}`);
  }
  if (req.body?.description !== undefined) {
    params.push(String(req.body.description).trim());
    fields.push(`description = $${params.length}`);
  }
  if (!fields.length) return res.status(400).json({ error: 'Нечего менять' });

  try {
    await query(`UPDATE kits SET ${fields.join(', ')} WHERE id = $1`, params);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Комплект с таким названием уже есть' });
    }
    throw err;
  }
  const { rows } = await query('SELECT * FROM kits_view WHERE id = $1', [id]);
  res.json({ ...rows[0], items: await kitItems(id) });
});

/**
 * Добавить приборы в состав.
 * Это правка комплекта, а не выдача: статусы приборов не меняются.
 */
kits.post('/:id/items', async (req, res) => {
  const id = Number(req.params.id);
  await loadKit(id);

  const ids = [...new Set((req.body?.ids || []).map(Number).filter(Boolean))];
  if (!ids.length) return res.status(400).json({ error: 'Не выбрано ни одного прибора' });

  const { rows: maxPos } = await query(
    'SELECT COALESCE(MAX(position), -1) AS max FROM kit_items WHERE kit_id = $1', [id]
  );

  try {
    await transaction((client) => insertItems(client, id, ids, maxPos[0].max + 1));
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'Один из приборов не найден' });
    throw err;
  }

  const { rows } = await query('SELECT * FROM kits_view WHERE id = $1', [id]);
  res.json({ ...rows[0], items: await kitItems(id) });
});

/**
 * Убрать прибор из состава — НАСОВСЕМ.
 *
 * Это не то же самое, что снять галочку на экране проверки перед
 * выездом: там прибор пропускается разово и в следующий раз снова
 * будет в списке. Здесь он уходит из комплекта до тех пор, пока его
 * не добавят обратно. Поэтому действие отдельное и живёт в карточке
 * комплекта, а не рядом с кнопкой выдачи.
 */
kits.delete('/:id/items/:instrumentId', async (req, res) => {
  const id = Number(req.params.id);
  await loadKit(id);

  const { rowCount } = await query(
    'DELETE FROM kit_items WHERE kit_id = $1 AND instrument_id = $2',
    [id, Number(req.params.instrumentId)]
  );
  if (!rowCount) return res.status(404).json({ error: 'Этого прибора нет в комплекте' });

  const { rows } = await query('SELECT * FROM kits_view WHERE id = $1', [id]);
  res.json({ ...rows[0], items: await kitItems(id) });
});

/**
 * Копия комплекта.
 *
 * Нужна, когда следующий выезд похож на прошлый: проще взять готовый
 * список и убрать лишнее, чем собирать всё заново. Приборы копируются
 * как есть, даже занятые: комплект — это список того, что брать,
 * а не бронь. Занятость проверяется в момент выдачи, там ей и место.
 *
 * Название у комплектов уникальное, поэтому к копии приписывается
 * «(1)», а если такая уже есть — «(2)» и так далее.
 */
kits.post('/:id/copy', async (req, res) => {
  const id = Number(req.params.id);
  const source = await loadKit(id);

  const { rows: taken } = await query('SELECT name FROM kits');
  const names = new Set(taken.map((r) => r.name));

  // «Выездной набор (1)» копируем как «Выездной набор (2)», а не
  // «Выездной набор (1) (1)»: копия копии — всё ещё копия оригинала.
  const base = source.name.replace(/\s*\(\d+\)\s*$/, '');
  let name = '';
  for (let n = 1; n <= 999; n++) {
    const candidate = `${base} (${n})`.slice(0, 120);
    if (!names.has(candidate)) { name = candidate; break; }
  }
  if (!name) return res.status(409).json({ error: 'Слишком много копий этого комплекта' });

  const copy = await transaction(async (client) => {
    const { rows } = await client.query(
      'INSERT INTO kits (name, description, created_by) VALUES ($1, $2, $3) RETURNING *',
      [name, source.description || '', req.user.id]
    );
    const { rows: items } = await client.query(
      'SELECT instrument_id, position FROM kit_items WHERE kit_id = $1 ORDER BY position, instrument_id',
      [id]
    );
    for (const item of items) {
      await client.query(
        'INSERT INTO kit_items (kit_id, instrument_id, position) VALUES ($1, $2, $3)',
        [rows[0].id, item.instrument_id, item.position]
      );
    }
    return rows[0];
  });

  const { rows } = await query('SELECT * FROM kits_view WHERE id = $1', [copy.id]);
  res.status(201).json({ ...rows[0], items: await kitItems(copy.id) });
});

/**
 * Удалить комплект целиком. Приборы не трогаются вообще —
 * исчезает только запись о том, что они были собраны вместе.
 */
kits.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { rowCount } = await query('DELETE FROM kits WHERE id = $1', [id]);
  if (!rowCount) return res.status(404).json({ error: 'Комплект не найден' });
  res.json({ ok: true });
});

// ---------- Выдача и возврат ----------

/**
 * Взять комплект.
 *
 * Приходит список id — ровно те приборы, что остались отмеченными
 * на экране проверки. Сервер НЕ берёт весь состав сам: человек мог
 * снять галочки, и его решение важнее сохранённого списка.
 *
 * Проверяем, что все присланные приборы действительно входят
 * в комплект: иначе этот маршрут превратился бы в обход обычной
 * массовой выдачи с другими правами.
 *
 * Дальше это ровно та же операция, что и «взять» поштучно: у каждого
 * прибора своя транзакция, свой UPDATE ... WHERE status = 'free'
 * (защита от одновременного нажатия двумя людьми) и своя запись
 * в журнале. Никаких новых типов событий не заводим — в журнале это
 * обычная выдача, просто с пометкой, из какого комплекта.
 * Старые выгрузки и отчёты продолжают работать без изменений.
 */
kits.post('/:id/issue', async (req, res) => {
  const id = Number(req.params.id);
  const kit = await loadKit(id);

  const requested = [...new Set((req.body?.ids || []).map(Number).filter(Boolean))];
  if (!requested.length) return res.status(400).json({ error: 'Не выбрано ни одного прибора' });

  const { rows: inKit } = await query(
    'SELECT instrument_id FROM kit_items WHERE kit_id = $1', [id]
  );
  const allowed = new Set(inKit.map((r) => r.instrument_id));
  const stranger = requested.find((instrumentId) => !allowed.has(instrumentId));
  if (stranger) {
    return res.status(400).json({ error: `Прибор ${stranger} не входит в этот комплект` });
  }

  const taken_where = nullify(req.body?.taken_where);
  const taken_extra = nullify(req.body?.taken_extra);
  const taken_at = req.body?.taken_at || today();

  const succeeded = [];
  const failed = [];

  for (const instrumentId of requested) {
    try {
      const instrument = await transaction(async (client) => {
        const { rows } = await client.query(
          `UPDATE instruments
              SET status = 'busy', taken_by = $2, taken_where = $3,
                  taken_extra = $4, taken_at = $5
            WHERE id = $1 AND status = 'free'
            RETURNING *`,
          [instrumentId, req.user.id, taken_where, taken_extra, taken_at]
        );
        if (!rows.length) {
          const exists = await client.query('SELECT name FROM instruments WHERE id = $1', [instrumentId]);
          const err = new Error(
            exists.rows.length
              ? `«${exists.rows[0].name}» уже занят или забронирован`
              : 'Прибор не найден'
          );
          err.status = exists.rows.length ? 409 : 404;
          throw err;
        }
        const row = rows[0];
        await logEvent(client, {
          instrument: row, action: 'issue', actor: req.user,
          targetName: req.user.username, place: taken_where, extra: taken_extra,
          note: `Выдан: ${req.user.username} (комплект «${kit.name}»)`
        });
        return row;
      });
      succeeded.push({ id: instrumentId, name: instrument.name });
    } catch (err) {
      failed.push({ id: instrumentId, message: err.message });
    }
  }

  res.json({ ok: true, succeeded, failed });
});

/**
 * Вернуть комплект — те приборы из его состава, что сейчас числятся
 * за этим человеком. Прибор, который он уже вернул сам, просто
 * пропускается: это не ошибка, а нормальный ход событий.
 *
 * Администратор может вернуть и приборы, выданные другому — так же,
 * как в обычном массовом возврате.
 */
kits.post('/:id/return', async (req, res) => {
  const id = Number(req.params.id);
  const kit = await loadKit(id);

  const isAdmin = req.user.role === 'admin';
  const { rows: mine } = await query(
    `SELECT i.id, i.name
       FROM kit_items ki
       JOIN instruments i ON i.id = ki.instrument_id
      WHERE ki.kit_id = $1 AND i.status = 'busy' AND (i.taken_by = $2 OR $3)
      ORDER BY ki.position, i.id`,
    [id, req.user.id, isAdmin]
  );

  if (!mine.length) {
    return res.status(409).json({
      error: isAdmin
        ? 'Ни один прибор из комплекта сейчас не выдан'
        : 'Ни один прибор из комплекта за вами не числится'
    });
  }

  const succeeded = [];
  const failed = [];

  for (const item of mine) {
    try {
      const instrument = await transaction(async (client) => {
        const { rows } = await client.query(
          `UPDATE instruments
              SET status = 'free', taken_by = NULL, taken_where = NULL,
                  taken_extra = NULL, taken_at = NULL
            WHERE id = $1 AND status = 'busy' AND (taken_by = $2 OR $3)
            RETURNING *`,
          [item.id, req.user.id, isAdmin]
        );
        if (!rows.length) {
          // Между выборкой и обновлением прибор успели вернуть
          // или передать. Считаем это отказом по конкретному прибору,
          // остальные всё равно вернутся.
          const err = new Error(`«${item.name}» уже возвращён или выдан другому`);
          err.status = 409;
          throw err;
        }
        const row = rows[0];
        await logEvent(client, {
          instrument: row, action: 'return', actor: req.user,
          note: `Возвращён: ${req.user.username} (комплект «${kit.name}»)`
        });
        return row;
      });
      succeeded.push({ id: item.id, name: instrument.name });
    } catch (err) {
      failed.push({ id: item.id, message: err.message });
    }
  }

  res.json({ ok: true, succeeded, failed });
});
