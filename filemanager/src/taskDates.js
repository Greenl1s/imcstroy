/**
 * Сроки задач: что считать просроченным, а что сегодняшним.
 *
 * Тут была настоящая ошибка, из-за которой список врал. Срок задачи —
 * это КАЛЕНДАРНАЯ ДАТА («сдать 2 сентября»), а сравнивался он с моментом
 * времени: `new Date(end_date) < new Date()`. Задача со сроком «сегодня»
 * становилась просроченной в полночь, хотя весь день ещё впереди.
 * Вдобавок сервер живёт по Гринвичу, а центр — в Москве, и это добавляло
 * ещё три часа расхождения: с 21:00 московского вечера «завтрашние»
 * задачи показывались сегодняшними.
 *
 * Поэтому здесь всё считается по календарным датам московского времени,
 * и считается ОДИН раз — на сервере. Интерфейс только читает готовый
 * ответ, чтобы список задач и счётчики над ним не могли разойтись.
 */

/** Москва — UTC+3 круглый год, перевода часов в России нет с 2014 года. */
const MSK_OFFSET_MINUTES = 3 * 60;

/** Сегодняшняя дата по Москве в виде "2026-09-05". */
function todayIso(now = new Date()) {
  const msk = new Date(now.getTime() + MSK_OFFSET_MINUTES * 60 * 1000);
  return msk.toISOString().slice(0, 10);
}

/**
 * Приводит срок к "YYYY-MM-DD".
 *
 * Из базы колонка date приезжает объектом Date в часовом поясе сервера —
 * если взять у него toISOString(), дата может съехать на сутки назад.
 * Поэтому у Date берём именно UTC-части: драйвер кладёт туда полночь той
 * самой календарной даты, которая записана в базе.
 */
function toIso(value) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const p2 = (n) => String(n).padStart(2, "0");
    return `${value.getUTCFullYear()}-${p2(value.getUTCMonth() + 1)}-${p2(value.getUTCDate())}`;
  }
  const s = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** Сколько календарных дней между двумя датами: b - a. */
function daysBetween(aIso, bIso) {
  const a = Date.parse(aIso + "T00:00:00Z");
  const b = Date.parse(bIso + "T00:00:00Z");
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

/**
 * Состояние срока одной задачи.
 *
 *   none    — срока нет. Это не «всё хорошо»: у многих задач по
 *             инструкции срока действительно не бывает, и терять их
 *             в фильтрах нельзя, поэтому у них своё состояние;
 *   overdue — срок прошёл;
 *   today   — срок сегодня;
 *   soon    — срок в ближайшие 7 дней включительно;
 *   later   — позже.
 *
 * Завершённая задача срока не имеет: она уже сдана, и подсвечивать её
 * красным бессмысленно.
 */
function dueState(task, today = todayIso()) {
  const due = toIso(task.end_date);
  if (task.is_done) return { state: "done", due, daysLeft: null };
  if (!due) return { state: "none", due: null, daysLeft: null };

  const daysLeft = daysBetween(today, due);
  if (daysLeft === null) return { state: "none", due: null, daysLeft: null };
  if (daysLeft < 0) return { state: "overdue", due, daysLeft };
  if (daysLeft === 0) return { state: "today", due, daysLeft };
  if (daysLeft <= 7) return { state: "soon", due, daysLeft };
  return { state: "later", due, daysLeft };
}

/** Проходит ли задача фильтр по сроку. */
function matchesDueFilter(task, filter, today = todayIso()) {
  if (!filter || filter === "any") return true;
  const { state } = dueState(task, today);
  switch (filter) {
    case "overdue": return state === "overdue";
    case "today": return state === "today";
    // «Ближайшие 7 дней» включает и сегодня, и просроченное: человек
    // спрашивает «что мне разгребать на этой неделе», а не «что наступит
    // строго в будущем». Просроченное разгребать тоже надо.
    case "week": return state === "overdue" || state === "today" || state === "soon";
    case "none": return state === "none";
    default: return true;
  }
}

const DUE_FILTERS = ["any", "overdue", "today", "week", "none"];

module.exports = { todayIso, toIso, daysBetween, dueState, matchesDueFilter, DUE_FILTERS };
