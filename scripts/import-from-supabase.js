/**
 * Перенос данных из старой базы Supabase в новую.
 *
 * Запуск (из папки server, чтобы были установлены зависимости):
 *
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_KEY=<anon-ключ> \
 *   DATABASE_URL=postgres://pribory:пароль@localhost:5432/pribory \
 *   node ../scripts/import-from-supabase.js
 *
 * Что происходит с паролями: в старой базе они лежат открытым текстом.
 * Скрипт превращает их в хэши. Сами пароли у пользователей остаются
 * прежними — заходить можно с теми же логинами. Но после переноса
 * настоятельно рекомендуется всех попросить сменить пароль: старые
 * значения могли быть видны кому угодно.
 */

import pg from 'pg';
import bcrypt from 'bcryptjs';

const { SUPABASE_URL, SUPABASE_KEY, DATABASE_URL } = process.env;
if (!SUPABASE_URL || !SUPABASE_KEY || !DATABASE_URL) {
  console.error('Задайте SUPABASE_URL, SUPABASE_KEY и DATABASE_URL');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function fetchTable(table) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  if (!response.ok) {
    console.warn(`  таблица ${table}: ${response.status}, пропускаю`);
    return [];
  }
  return response.json();
}

const clean = (v) => {
  const s = String(v ?? '').trim();
  return s && s.toLowerCase() !== 'nan' ? s : null;
};
const cleanDate = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '').trim()) ? String(v).trim() : null);

async function main() {
  console.log('Читаю данные из Supabase...');
  const [oldUsers, oldInstruments, oldRetired, oldHistory] = await Promise.all([
    fetchTable('users'), fetchTable('instruments'), fetchTable('retired'), fetchTable('history')
  ]);
  console.log(`  пользователей: ${oldUsers.length}`);
  console.log(`  приборов: ${oldInstruments.length}`);
  console.log(`  списанных: ${oldRetired.length}`);
  console.log(`  записей истории: ${oldHistory.length}`);

  const client = await pool.connect();
  await client.query('BEGIN');

  try {
    // ---------- Пользователи ----------
    const userIdByName = new Map();
    for (const u of oldUsers) {
      const username = clean(u.username);
      if (!username) continue;
      const password = clean(u.password) || 'changeme123';
      const { rows } = await client.query(
        `INSERT INTO users (username, password_hash, role, extra)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (lower(username)) DO UPDATE SET extra = EXCLUDED.extra
         RETURNING id`,
        [username, await bcrypt.hash(password, 12), u.role === 'admin' ? 'admin' : 'employee', clean(u.extra) || '']
      );
      userIdByName.set(username.toLowerCase(), rows[0].id);
    }
    console.log(`Перенесено пользователей: ${userIdByName.size}`);

    const userId = (name) => userIdByName.get(String(name ?? '').trim().toLowerCase()) ?? null;

    // ---------- Приборы (действующие и списанные) ----------
    // Старый id больше не используется: новые id генерирует база.
    // Старый номер сохраняем как инвентарный, чтобы наклейки и QR
    // на приборах не пришлось переклеивать.
    const idMap = new Map(); // старый id -> новый id
    let count = 0;

    const insertInstrument = async (row, retired) => {
      const oldId = String(row.id ?? '').trim();
      // У списанных к id спереди приписывался ноль — убираем его
      const inventoryNo = retired ? oldId.replace(/^0+/, '') : oldId;

      const takenBy = retired ? null : userId(row.taken_by);
      const bookedBy = retired ? null : userId(row.booked_by);

      let status = 'free';
      if (retired) status = 'retired';
      else if (takenBy) status = 'busy';
      else if (bookedBy) status = 'booked';

      const { rows } = await client.query(
        `INSERT INTO instruments
           (inventory_no, name, serial_number, model, check_type,
            verification_date, valid_until, document_url, comment, status,
            taken_by, taken_where, taken_extra, taken_at,
            booked_by, booked_for, booked_extra, retired_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         RETURNING id`,
        [
          inventoryNo || null,
          clean(row.name) || 'Без названия',
          clean(row.serial_number),
          clean(row.model),
          String(row.type || '').toLowerCase().startsWith('калибр') ? 'calibration' : 'verification',
          cleanDate(row.verification_date),
          cleanDate(row.valid_until),
          clean(row.document_url),
          clean(row.comment) || '',
          status,
          takenBy,
          takenBy ? clean(row.taken_where) : null,
          takenBy ? clean(row.taken_extra) : null,
          takenBy ? (cleanDate(row.taken_date) || new Date().toISOString().slice(0, 10)) : null,
          bookedBy,
          bookedBy ? (cleanDate(row.booked_date) || new Date().toISOString().slice(0, 10)) : null,
          bookedBy ? clean(row.booked_extra) : null,
          retired ? (cleanDate(row.retired_date) || new Date().toISOString().slice(0, 10)) : null
        ]
      );

      const newId = rows[0].id;
      if (!retired && oldId) idMap.set(oldId, newId);
      count++;

      // Фото: было строкой data:image/...;base64,... прямо в таблице приборов
      const photo = String(row.photo || '');
      const match = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(photo);
      if (match) {
        const bytes = Buffer.from(match[2], 'base64');
        if (bytes.length <= 5 * 1024 * 1024) {
          await client.query(
            `INSERT INTO instrument_photos (instrument_id, mime_type, bytes, size_bytes)
             VALUES ($1, $2, $3, $4)`,
            [newId, match[1], bytes, bytes.length]
          );
        } else {
          console.warn(`  фото прибора «${row.name}» больше 5 МБ — пропущено`);
        }
      }
    };

    for (const row of oldInstruments) await insertInstrument(row, false);
    for (const row of oldRetired) await insertInstrument(row, true);
    console.log(`Перенесено приборов: ${count}`);

    // ---------- История ----------
    // Старый формат — пара «выдача/возврат» в одной строке.
    // Разворачиваем её в два события журнала.
    let events = 0;
    for (const row of oldHistory) {
      const instrumentId = idMap.get(String(row.instrument_id ?? '').trim()) ?? null;
      const name = clean(row.instrument_name) || 'Прибор';
      const actor = clean(row.taken_by) || 'неизвестно';

      await client.query(
        `INSERT INTO history (instrument_id, instrument_name, action, actor_id, actor_name,
                              target_name, place, extra, note, created_at)
         VALUES ($1,$2,'issue',$3,$4,$5,$6,$7,'Перенесено из старой системы', $8)`,
        [instrumentId, name, userId(row.taken_by), actor, actor,
         clean(row.place), clean(row.extra_data),
         cleanDate(row.issue_date) || cleanDate(row.operation_date) || '2020-01-01']
      );
      events++;

      if (cleanDate(row.return_date)) {
        const returnedBy = clean(row.returned_by) || actor;
        await client.query(
          `INSERT INTO history (instrument_id, instrument_name, action, actor_id, actor_name,
                                note, created_at)
           VALUES ($1,$2,'return',$3,$4,'Перенесено из старой системы',$5)`,
          [instrumentId, name, userId(row.returned_by), returnedBy, cleanDate(row.return_date)]
        );
        events++;
      }
    }
    console.log(`Перенесено событий истории: ${events}`);

    await client.query('COMMIT');
    console.log('\nГотово. Данные перенесены.');
    console.log('Важно: попросите всех сменить пароли — старые хранились открытым текстом.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\nОшибка, ничего не записано:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
