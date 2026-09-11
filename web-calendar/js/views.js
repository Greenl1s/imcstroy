import {
  WEEKDAYS, monthGrid, weekGrid, dayNumber, monthOf, isWeekend, weekdayIndex,
  hhmm, escapeHtml, fmtFull, fmtDay, nowMinutesMsk, plural, initials, personColor,
} from './utils.js';

// ============================================================
//  Рисование видов. Здесь только разметка: обработчики вешает app.js
//  по data-атрибутам. Так вид можно перерисовать целиком, не думая
//  о том, какие подписки остались висеть на старых узлах.
// ============================================================

const byDate = (events) => {
  const map = new Map();
  for (const e of events) {
    if (!map.has(e.event_date)) map.set(e.event_date, []);
    map.get(e.event_date).push(e);
  }
  return map;
};

/** Порядок внутри дня: сначала дела без времени, потом по часам. */
const sortDay = (list) => list.slice().sort((a, b) => {
  if ((a.start_min === null) !== (b.start_min === null)) return a.start_min === null ? -1 : 1;
  return (a.start_min ?? 0) - (b.start_min ?? 0) || a.id - b.id;
});

const eventClass = (e, today) => {
  if (e.done_at) return 'done';
  if (!e.done_at && e.event_date < today && e.start_min === null) return 'late';
  if (e.guests?.length) return 'meet';
  if (e.start_min !== null) return 'time';
  return '';
};

function eventChip(e, today) {
  const time = e.start_min !== null ? `<span class="t">${hhmm(e.start_min)}</span>` : '';
  return `<button class="ev ${eventClass(e, today)}" type="button" draggable="true"
            data-event="${e.id}" title="${escapeHtml(e.title)}">${time}${escapeHtml(e.title)}</button>`;
}

// ---------- Месяц ----------

export function renderMonth(state) {
  const days = monthGrid(state.anchor);
  const map = byDate(state.events);
  const current = monthOf(state.anchor);

  const head = WEEKDAYS
    .map((d, i) => `<div class="${i >= 5 ? 'wknd' : ''}">${d}</div>`).join('');

  const cells = days.map((day) => {
    const list = sortDay(map.get(day) || []);
    // Больше трёх дел в клетку не влезает так, чтобы их можно было
    // прочитать. Остальные честно считаем — и открываем день целиком.
    const shown = list.slice(0, 3);
    const rest = list.length - shown.length;
    const classes = ['cell'];
    if (monthOf(day) !== current) classes.push('out');
    else if (isWeekend(day)) classes.push('wknd');
    if (day === state.today) classes.push('today');
    if (day === state.selected) classes.push('is-selected');

    const num = day === state.today
      ? `<span class="num-today">${dayNumber(day)}</span>`
      : `<span class="num">${dayNumber(day)}</span>`;

    return `<div class="${classes.join(' ')}" data-day="${day}">
      ${num}
      ${shown.map((e) => eventChip(e, state.today)).join('')}
      ${rest > 0 ? `<span class="more">ещё ${rest}</span>` : ''}
    </div>`;
  }).join('');

  return `<div class="weekdays">${head}</div><div class="month">${cells}</div>`;
}

// ---------- Неделя ----------

export function renderWeek(state) {
  const days = weekGrid(state.anchor);
  const map = byDate(state.events);
  const from = state.settings.work_start ?? 8 * 60;
  const to = state.settings.work_end ?? 19 * 60;
  const hourCount = Math.ceil((to - from) / 60);
  const HOUR = 56;
  const pos = (min) => ((min - from) / 60) * HOUR;

  const head = days.map((day) => `
    <div class="${day === state.today ? 'today-col' : ''}" data-day="${day}">
      <div class="dw">${WEEKDAYS[weekdayIndex(day)]}</div>
      <div class="dn">${dayNumber(day)}</div>
    </div>`).join('');

  // Дела без времени — отдельной полосой сверху: в сетке часов им
  // некуда встать, а теряться они не должны.
  const allday = days.map((day) => {
    const list = (map.get(day) || []).filter((e) => e.start_min === null);
    return `<div data-day="${day}" class="${day === state.today ? 'today' : ''}">
      ${list.map((e) => eventChip(e, state.today)).join('')}
    </div>`;
  }).join('');

  const hours = Array.from({ length: hourCount }, (_, i) =>
    `<div>${hhmm(from + i * 60)}</div>`).join('');

  const cols = days.map((day) => {
    const list = (map.get(day) || []).filter((e) => e.start_min !== null);
    const classes = ['week-col'];
    if (isWeekend(day)) classes.push('wknd');
    if (day === state.today) classes.push('today');

    const blocks = list.map((e) => {
      const top = Math.max(0, pos(e.start_min));
      const height = Math.max(26, pos(e.end_min) - pos(e.start_min) - 2);
      const short = height < 40;
      return `<button class="block ${e.guests?.length ? 'meet' : ''}" type="button"
                data-event="${e.id}" style="top: ${top}px; height: ${height}px;">
        <b${short ? ' style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"' : ''}>${escapeHtml(e.title)}</b>
        ${short ? '' : `<span>${hhmm(e.start_min)} — ${hhmm(e.end_min)}</span>`}
      </button>`;
    }).join('');

    const now = day === state.today && nowMinutesMsk() >= from && nowMinutesMsk() <= to
      ? `<div class="now-line" style="top: ${pos(nowMinutesMsk())}px;"></div>
         <div class="now-dot" style="top: ${pos(nowMinutesMsk()) - 4}px;"></div>`
      : '';

    return `<div class="${classes.join(' ')}" data-day="${day}" style="height: ${hourCount * HOUR}px;">${blocks}${now}</div>`;
  }).join('');

  return `
    <div class="week-head"><div></div>${head}</div>
    <div class="week-allday"><span class="label">весь<br>день</span>${allday}</div>
    <div class="week-grid">
      <div class="week-hours">${hours}</div>
      ${cols}
    </div>`;
}

// ---------- День ----------

export function renderDayPanel(state, day) {
  const list = sortDay(state.events.filter((e) => e.event_date === day));
  const tasks = list.filter((e) => e.start_min === null);
  const timed = list.filter((e) => e.start_min !== null);
  const late = state.overdue.filter((e) => day === state.today);

  const from = state.settings.work_start ?? 8 * 60;
  const to = state.settings.work_end ?? 19 * 60;

  const taskRow = (e, overdue = false) => `
    <div class="task ${overdue ? 'late' : ''} ${e.done_at ? 'is-done' : ''}">
      <button class="box ${e.done_at ? 'on' : ''}" type="button" data-done="${e.id}"
              aria-label="Отметить сделанным">
        ${e.done_at ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>' : ''}
      </button>
      <button class="task-open" type="button" data-event="${e.id}"
              style="background: transparent; padding: 0; min-height: 0; display: block; text-align: left;">
        <span class="task-title">${escapeHtml(e.title)}</span>
        ${overdue ? `<span class="task-sub">Перенесено с ${escapeHtml(e.event_date.slice(8, 10))}.${escapeHtml(e.event_date.slice(5, 7))}</span>`
          : e.place ? `<span class="task-sub">${escapeHtml(e.place)}</span>` : ''}
      </button>
    </div>`;

  const hours = [];
  for (let h = from; h < to; h += 60) {
    const here = timed.filter((e) => e.start_min >= h && e.start_min < h + 60);
    hours.push(`
      <div class="hour">
        <span class="hnum">${hhmm(h)}</span>
        <div class="hour-slot">
          ${here.map((e) => `
            <button class="block ${e.guests?.length ? 'meet' : ''}" type="button" data-event="${e.id}">
              <b>${escapeHtml(e.title)}${e.guests?.length ? ` · с ${escapeHtml(e.guests.map((g) => g.username).join(', '))}` : ''}</b>
              <span>${hhmm(e.start_min)} — ${hhmm(e.end_min)}${e.place ? ` · ${escapeHtml(e.place)}` : ''}</span>
            </button>`).join('')}
          <button class="slot-add" type="button" data-add-at="${hhmm(h)}">+ добавить на ${hhmm(h)}</button>
        </div>
      </div>`);
  }

  const count = list.length + late.length;

  return `
    <div class="day-head">
      <div>
        <b>${fmtFull(day)}</b>
        <span>${count ? plural(count, 'дело', 'дела', 'дел') : 'Дел нет'}${late.length ? ` · ${late.length} просрочено` : ''}</span>
      </div>
      <button class="primary" type="button" data-add-day="${day}">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
        Добавить
      </button>
    </div>

    <div class="day-scroll">
      <div class="day-section">
        <span class="section-title">Без времени</span>
        ${late.map((e) => taskRow(e, true)).join('')}
        ${tasks.map((e) => taskRow(e)).join('')}
        ${!tasks.length && !late.length ? '<span class="task-sub">Ничего не записано</span>' : ''}
      </div>

      <div class="day-section">
        <span class="section-title">По часам</span>
        <div class="hours">${hours.join('')}</div>
      </div>
    </div>`;
}

// ---------- Полоса «Сегодня» ----------

export function renderTodayBar(state) {
  const todayList = sortDay(state.events.filter((e) => e.event_date === state.today && !e.done_at));
  const late = state.overdue;
  const total = todayList.length + late.length;

  const chips = [
    ...late.map((e) => `
      <button class="today-chip late" type="button" data-event="${e.id}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg>
        ${escapeHtml(e.title)} · с ${escapeHtml(e.event_date.slice(8, 10))}.${escapeHtml(e.event_date.slice(5, 7))}
      </button>`),
    ...todayList.map((e) => `
      <button class="today-chip ${e.start_min !== null ? 'time' : ''}" type="button" data-event="${e.id}">
        ${e.start_min !== null ? `<span class="t">${hhmm(e.start_min)}</span>` : ''}${escapeHtml(e.title)}
      </button>`),
  ].join('');

  return `
    <div class="today-head">
      <b>Сегодня, ${escapeHtml(fmtDay(state.today))}</b>
      <span>${total ? plural(total, 'дело', 'дела', 'дел') : 'Ничего не запланировано'}${late.length ? ` · ${late.length} просрочено` : ''}</span>
    </div>
    <div class="today-list">${chips || '<span class="today-empty">На сегодня пусто — и это тоже ответ</span>'}</div>`;
}

/** Кружок с инициалами — участник встречи. */
export const personChip = (person, removable = true) => `
  <span class="person">
    <span class="ava" style="background: ${personColor(person.username)};">${escapeHtml(initials(person.username))}</span>
    ${escapeHtml(person.username)}
    ${removable ? `<button type="button" data-drop-person="${person.id}" aria-label="Убрать"
        style="background: transparent; padding: 0; min-height: 0;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>` : ''}
  </span>`;
