// ============================================================
//  Даты и мелкие помощники.
//
//  Все даты — строки YYYY-MM-DD, всё время — минуты от полуночи.
//  Объект Date используется только для арифметики и только в UTC:
//  из-за местного часового пояса «понедельник + 7 дней» в ночь
//  перевода часов даёт воскресенье, и это ровно та ошибка, которую
//  в календаре замечают последней.
// ============================================================

export const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const WEEKDAYS_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

const utc = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

export const addDays = (day, n) => iso(utc(day) + n * 86400000);
export const addMonths = (day, n) => {
  const [y, m] = day.split('-').map(Number);
  return iso(Date.UTC(y, m - 1 + n, 1));
};

/** 0 — понедельник. Неделя у нас начинается с понедельника, как в стране. */
export const weekdayIndex = (day) => (new Date(utc(day)).getUTCDay() + 6) % 7;
export const isWeekend = (day) => weekdayIndex(day) >= 5;
export const monthOf = (day) => day.slice(0, 7);
export const dayNumber = (day) => Number(day.slice(8, 10));
export const startOfWeek = (day) => addDays(day, -weekdayIndex(day));
export const startOfMonth = (day) => `${day.slice(0, 7)}-01`;

/** Шесть недель в сетке месяца: так высота не прыгает от месяца к месяцу. */
export function monthGrid(anchor) {
  const first = startOfWeek(startOfMonth(anchor));
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

export function weekGrid(anchor) {
  const first = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}

export const fmtDay = (day) => `${dayNumber(day)} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;
export const fmtFull = (day) => `${WEEKDAYS_FULL[weekdayIndex(day)]}, ${fmtDay(day)}`;
export const fmtMonth = (day) => `${MONTHS_NOM[Number(day.slice(5, 7)) - 1]} ${day.slice(0, 4)}`;

export function fmtWeek(days) {
  const a = days[0];
  const b = days[6];
  const sameMonth = a.slice(0, 7) === b.slice(0, 7);
  return sameMonth
    ? `${dayNumber(a)} — ${fmtDay(b)} ${b.slice(0, 4)}`
    : `${fmtDay(a)} — ${fmtDay(b)} ${b.slice(0, 4)}`;
}

export const hhmm = (min) => (min === null || min === undefined)
  ? ''
  : `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export const toMinutes = (text) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(text || '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Минуты «прямо сейчас» по Москве — для линии текущего времени. */
export function nowMinutesMsk() {
  const msk = new Date(Date.now() + 3 * 3600 * 1000);
  return msk.getUTCHours() * 60 + msk.getUTCMinutes();
}

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return `${n} ${many}`;
  if (b > 1 && b < 5) return `${n} ${few}`;
  if (b === 1) return `${n} ${one}`;
  return `${n} ${many}`;
}

export const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const initials = (name) => String(name || '?').trim().slice(0, 2).toUpperCase();

/**
 * Цвет кружка участника. Берётся из имени, а не назначается вручную:
 * у одного человека он всегда один и тот же, и список не надо вести.
 */
export function personColor(name) {
  const palette = ['#1f5c8a', '#7a4fa3', '#2f7d4f', '#c2660d', '#9c3d5c', '#1a6b6b'];
  let sum = 0;
  for (const ch of String(name || '')) sum += ch.codePointAt(0);
  return palette[sum % palette.length];
}

/** Просрочено — только то, что без времени, не сделано и осталось в прошлом. */
export const isLate = (event, today) =>
  !event.done_at && event.event_date < today;

export const isDone = (event) => Boolean(event.done_at);
