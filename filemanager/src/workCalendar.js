/**
 * Рабочие дни.
 *
 * Инструкция считает сроки в рабочих днях: «+3 рабочих дня» для контроля
 * определения, «+1 рабочий день» для ходатайства об ознакомлении.
 * Суббота и воскресенье нерабочие всегда, а праздники и переносы каждый
 * год свои — они лежат в таблице work_calendar и заводятся руками.
 *
 * Важно: если календарь на нужный год не заполнен, мы не делаем вид,
 * что всё в порядке. Расчёт возвращает признак, что праздники за этот
 * период неизвестны, и интерфейс говорит об этом прямо — иначе в январе
 * сроки молча уедут на неделю.
 */
const db = require("./db");

/** "2026-09-15" из даты. Всё считаем по календарным датам, без времени. */
function toIso(date) {
  // Пустое значение — это "даты нет", а не "начало времён". Без этой
  // проверки new Date(null) даёт 1 января 1970 года, и незаполненный
  // срок экспертизы уезжал в задачу как настоящая дата.
  if (date === null || date === undefined || date === "") return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const p2 = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
}

function parseIso(value) {
  const iso = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(iso + "T00:00:00Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(date, n) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

/** Отметки календаря за период: {"2026-01-01": "holiday", ...}. */
async function loadMarks(fromIso, toIsoDate) {
  const { rows } = await db.query(
    "SELECT to_char(day, 'YYYY-MM-DD') AS day, kind FROM work_calendar WHERE day BETWEEN $1 AND $2",
    [fromIso, toIsoDate]
  );
  const map = new Map();
  for (const r of rows) map.set(r.day, r.kind);
  return map;
}

function isWorkingDay(date, marks) {
  const iso = toIso(date);
  const mark = marks.get(iso);
  if (mark === "holiday") return false;
  if (mark === "workday") return true;         // рабочая суббота по переносу
  const dow = date.getUTCDay();
  return dow !== 0 && dow !== 6;
}

/**
 * Прибавляет N рабочих дней к дате.
 *
 * Возвращает { date, calendarKnown }: calendarKnown = false, если за
 * пройденный период в календаре нет ни одной отметки о празднике —
 * значит год просто не заполнен, и результату верить нельзя.
 */
async function addWorkingDays(fromDate, n) {
  const start = parseIso(fromDate);
  if (!start) return { date: null, calendarKnown: false };
  const count = Number(n) || 0;
  if (count <= 0) return { date: toIso(start), calendarKnown: true };

  // Берём запас: в самом плохом случае (новогодние каникулы) на N рабочих
  // дней уходит заметно больше календарных.
  const horizon = addDays(start, count * 3 + 30);
  const marks = await loadMarks(toIso(start), toIso(horizon));

  let cursor = start;
  let left = count;
  for (let guard = 0; guard < count * 3 + 30 && left > 0; guard++) {
    cursor = addDays(cursor, 1);
    if (isWorkingDay(cursor, marks)) left--;
  }
  if (left > 0) return { date: null, calendarKnown: false };

  // Знаем ли мы календарь на этот отрезок: считаем по году начала и года
  // конца — если ни на один из них праздники не заведены, предупреждаем.
  const years = new Set([start.getUTCFullYear(), cursor.getUTCFullYear()]);
  const { rows } = await db.query(
    "SELECT DISTINCT EXTRACT(YEAR FROM day)::int AS y FROM work_calendar WHERE kind = 'holiday'");
  const known = new Set(rows.map((r) => r.y));
  const calendarKnown = [...years].every((y) => known.has(y));

  return { date: toIso(cursor), calendarKnown };
}

/** Прибавляет календарные дни — для правил вида «через 2 дня». */
function addCalendarDays(fromDate, n) {
  const start = parseIso(fromDate);
  if (!start) return null;
  return toIso(addDays(start, Number(n) || 0));
}

/** Отнимает календарные дни — «за 3 недели до заседания». */
function subCalendarDays(fromDate, n) {
  return addCalendarDays(fromDate, -(Number(n) || 0));
}

/* ---------------- Ведение календаря (администрирование) ---------------- */

async function listCalendar(year) {
  const { rows } = await db.query(
    `SELECT to_char(day, 'YYYY-MM-DD') AS day, kind, note FROM work_calendar
      WHERE EXTRACT(YEAR FROM day) = $1 ORDER BY day`,
    [Number(year)]
  );
  return rows;
}

/** Годы, на которые календарь заполнен, — чтобы видеть, чего не хватает. */
async function knownYears() {
  const { rows } = await db.query(
    `SELECT EXTRACT(YEAR FROM day)::int AS year, count(*)::int AS days
       FROM work_calendar GROUP BY 1 ORDER BY 1`);
  return rows;
}

async function setDay(day, kind, note, actorId) {
  const iso = toIso(parseIso(day));
  if (!iso) throw new Error("Некорректная дата");
  if (!["holiday", "workday"].includes(kind)) throw new Error("Некорректный вид дня");
  await db.query(
    `INSERT INTO work_calendar (day, kind, note) VALUES ($1, $2, $3)
     ON CONFLICT (day) DO UPDATE SET kind = EXCLUDED.kind, note = EXCLUDED.note`,
    [iso, kind, note || null]
  );
  return { day: iso, kind, note: note || null };
}

async function removeDay(day) {
  const iso = toIso(parseIso(day));
  if (!iso) throw new Error("Некорректная дата");
  const { rowCount } = await db.query("DELETE FROM work_calendar WHERE day = $1", [iso]);
  return rowCount > 0;
}

module.exports = {
  addWorkingDays, addCalendarDays, subCalendarDays,
  listCalendar, knownYears, setDay, removeDay,
  toIso, parseIso, isWorkingDay, loadMarks,
};
