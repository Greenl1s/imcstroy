import { query } from './db.js';

// ============================================================
//  Занятость.
//
//  Что видно про чужой календарь — ровно две вещи: занято или нет,
//  и с какого по какое. Название чужой встречи не отдаётся никогда,
//  даже владельцу проверяемого времени: единый вход на три сервиса
//  и так означает, что одна сессия открывает многое, и добавлять к
//  этому чтение чужих записей незачем.
//
//  Дела без времени (start_min IS NULL) никого не занимают — на то
//  они и без времени.
// ============================================================

export const WORK_START = Number(process.env.WORK_START_MIN || 8 * 60);
export const WORK_END = Number(process.env.WORK_END_MIN || 19 * 60);
const STEP = 15;

/** Все занятые промежутки указанных людей за один день. */
async function busyIntervals(dateIso, userIds, ignoreIds = []) {
  const { rows } = await query(
    `WITH mine AS (
       SELECT id, start_min, end_min, owner_id AS user_id FROM cal_events
        WHERE event_date = $1 AND start_min IS NOT NULL
       UNION
       SELECT e.id, e.start_min, e.end_min, g.user_id
         FROM cal_events e
         JOIN cal_event_guests g ON g.event_id = e.id
        WHERE e.event_date = $1 AND e.start_min IS NOT NULL
     )
     SELECT m.id, m.start_min, m.end_min, m.user_id, u.username
       FROM mine m
       JOIN users u ON u.id = m.user_id
      WHERE m.user_id = ANY($2::bigint[])
        AND NOT (m.id = ANY($3::bigint[]))
      ORDER BY m.start_min`,
    [dateIso, userIds, ignoreIds.length ? ignoreIds : [0]]
  );
  return rows;
}

const overlaps = (a, b) => a.start < b.end_min && a.end > b.start_min;

/**
 * Свободные окна нужной длины в рабочих часах указанного дня.
 * Возвращает не больше `limit` штук — список вариантов, а не расписание.
 */
function freeSlots(intervals, minutes, limit = 3, near = null) {
  const slots = [];
  for (let start = WORK_START; start + minutes <= WORK_END; start += STEP) {
    const end = start + minutes;
    const busy = intervals.some((i) => start < i.end_min && end > i.start_min);
    if (busy) continue;
    // Соседние окна одной длины сливались бы в стену кнопок: берём
    // первое свободное и отступаем на его длину.
    if (slots.length && start < slots[slots.length - 1].end) continue;
    slots.push({ start, end });
  }

  // Человек хотел 14:00, а не 08:00: ближние к задуманному времени
  // варианты полезнее первых попавшихся с начала дня. Порядок показа
  // при этом остаётся хронологическим — так их легче читать.
  if (near !== null) {
    return slots
      .slice()
      .sort((a, b) => Math.abs(a.start - near) - Math.abs(b.start - near))
      .slice(0, limit)
      .sort((a, b) => a.start - b.start);
  }
  return slots.slice(0, limit);
}

const addDay = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};

/**
 * Проверка перед созданием встречи.
 *
 * @returns {{free: boolean, conflicts: Array, suggestions: Array}}
 *   conflicts — кто и когда занят (без названий);
 *   suggestions — ближайшие окна, свободные у всех: сначала в этот же
 *   день, и если их нет — одно на следующий, чтобы человеку не пришлось
 *   гадать самому.
 */
export async function checkBusy({ dateIso, start, end, userIds, ignoreIds = [] }) {
  const ids = [...new Set(userIds.map(Number))].filter(Boolean);
  if (!ids.length || start === null || end === null) {
    return { free: true, conflicts: [], suggestions: [] };
  }

  const intervals = await busyIntervals(dateIso, ids, ignoreIds);
  const conflicts = intervals
    .filter((i) => overlaps({ start, end }, i))
    .map((i) => ({ user_id: i.user_id, username: i.username, start_min: i.start_min, end_min: i.end_min }));

  if (!conflicts.length) return { free: true, conflicts: [], suggestions: [] };

  const minutes = end - start;
  const suggestions = freeSlots(intervals, minutes, 3, start).map((s) => ({ ...s, date: dateIso }));

  if (suggestions.length < 3) {
    const next = addDay(dateIso);
    const nextIntervals = await busyIntervals(next, ids, ignoreIds);
    for (const s of freeSlots(nextIntervals, minutes, 3 - suggestions.length)) {
      suggestions.push({ ...s, date: next });
    }
  }

  return { free: false, conflicts, suggestions };
}
