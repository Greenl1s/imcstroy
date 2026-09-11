import { api } from './api.js';
import { renderMonth, renderWeek, renderDayPanel, renderTodayBar } from './views.js';
import { showEventForm } from './form.js';
import { run, toast } from './ui.js';
import {
  addDays, addMonths, startOfMonth, startOfWeek, weekGrid, monthGrid,
  fmtMonth, fmtWeek, fmtFull,
} from './utils.js';

// ============================================================
//  Сборка страницы.
//
//  Один поток: загрузили период → нарисовали вид целиком → повесили
//  обработчики по data-атрибутам. Никакого хранения ссылок на узлы
//  между перерисовками: вид всегда собирается из состояния заново.
// ============================================================

const state = {
  view: 'month',
  anchor: '',
  selected: '',
  today: '',
  me: null,
  people: [],
  settings: {},
  events: [],
  overdue: [],
  reload: async () => {},
};

/** Границы периода для текущего вида — что грузим и что рисуем. */
function range() {
  if (state.view === 'month') {
    const days = monthGrid(state.anchor);
    return [days[0], days[days.length - 1]];
  }
  if (state.view === 'week') {
    const days = weekGrid(state.anchor);
    return [days[0], days[6]];
  }
  return [state.anchor, state.anchor];
}

async function load() {
  const [from, to] = range();
  // Просроченное тянем отдельно и всегда: оно не должно исчезать из
  // полосы «Сегодня» только потому, что человек листает другой месяц.
  const [events, past] = await Promise.all([
    api.events(from, to),
    api.events(addDays(state.today, -60), addDays(state.today, -1)),
  ]);
  state.events = events;
  // Просроченное — только дела без времени: встреча, которая прошла,
  // не «просрочена», она просто состоялась, и тянуть её в сегодня
  // означало бы засыпать полосу прошлогодними планёрками.
  state.overdue = past.filter((e) => !e.done_at && e.start_min === null);
}

function title() {
  if (state.view === 'month') return fmtMonth(state.anchor);
  if (state.view === 'week') return fmtWeek(weekGrid(state.anchor));
  return fmtFull(state.anchor);
}

function draw() {
  document.getElementById('period').textContent = title();
  document.getElementById('todayBar').innerHTML = renderTodayBar(state);

  const board = document.getElementById('board');
  const panel = document.getElementById('dayPanel');

  if (state.view === 'week') {
    board.innerHTML = renderWeek(state);
    board.classList.remove('hidden');
    panel.classList.add('hidden');
  } else if (state.view === 'day') {
    // В режиме дня сетка не нужна — день и есть весь экран.
    board.classList.add('hidden');
    panel.classList.remove('hidden');
    panel.style.width = '100%';
    panel.innerHTML = renderDayPanel(state, state.anchor);
  } else {
    board.innerHTML = renderMonth(state);
    board.classList.remove('hidden');
    panel.style.width = '';
    panel.classList.toggle('hidden', !state.selected);
    if (state.selected) panel.innerHTML = renderDayPanel(state, state.selected);
  }

  document.querySelectorAll('#viewSwitch button').forEach((b) => {
    b.classList.toggle('on', b.dataset.view === state.view);
  });

  wire();
}

async function refresh() {
  await load();
  draw();
}
state.reload = refresh;

const eventById = (id) => [...state.events, ...state.overdue].find((e) => String(e.id) === String(id));

// ---------- обработчики, которые вешаются после каждой отрисовки ----------

function wire() {
  document.querySelectorAll('[data-event]').forEach((node) => {
    node.onclick = (e) => {
      e.stopPropagation();
      const event = eventById(node.dataset.event);
      if (event) showEventForm(state, { event });
    };
  });

  document.querySelectorAll('[data-day]').forEach((node) => {
    node.onclick = () => {
      state.selected = node.dataset.day;
      if (state.view === 'week') { state.view = 'day'; state.anchor = node.dataset.day; refresh(); return; }
      draw();
    };
    node.ondblclick = () => showEventForm(state, { date: node.dataset.day });
  });

  document.querySelectorAll('[data-done]').forEach((node) => {
    node.onclick = async (e) => {
      e.stopPropagation();
      const event = eventById(node.dataset.done);
      if (!event) return;
      const ok = await run(() => api.setDone(event.id, !event.done_at));
      if (ok === null) return;
      refresh();
    };
  });

  document.querySelectorAll('[data-add-day]').forEach((node) => {
    node.onclick = () => showEventForm(state, { date: node.dataset.addDay });
  });
  document.querySelectorAll('[data-add-at]').forEach((node) => {
    node.onclick = () => showEventForm(state, {
      date: state.view === 'day' ? state.anchor : state.selected,
      start: node.dataset.addAt,
    });
  });

  wireDrag();
}

/**
 * Перенос мышкой. Перетащить дело на другой день — это и есть «перенести»:
 * никакой отдельной кнопки для этого не нужно.
 */
function wireDrag() {
  let dragging = null;

  document.querySelectorAll('.ev[draggable="true"]').forEach((node) => {
    node.ondragstart = (e) => {
      dragging = node.dataset.event;
      node.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      // Firefox без этого не начинает перетаскивание вообще.
      e.dataTransfer.setData('text/plain', dragging);
    };
    node.ondragend = () => {
      node.classList.remove('dragging');
      document.querySelectorAll('.cell.drop').forEach((c) => c.classList.remove('drop'));
      dragging = null;
    };
  });

  document.querySelectorAll('.cell[data-day], .week-allday > div[data-day]').forEach((cell) => {
    cell.ondragover = (e) => { e.preventDefault(); cell.classList.add('drop'); };
    cell.ondragleave = () => cell.classList.remove('drop');
    cell.ondrop = async (e) => {
      e.preventDefault();
      cell.classList.remove('drop');
      const id = dragging || e.dataTransfer.getData('text/plain');
      const event = eventById(id);
      if (!event || event.event_date === cell.dataset.day) return;
      const ok = await run(() => api.update(event.id, { date: cell.dataset.day }), { success: 'Перенесено' });
      if (ok === null) return;
      refresh();
    };
  });
}

// ---------- шапка ----------

function wireTopbar() {
  document.getElementById('todayBtn').onclick = () => {
    state.anchor = state.today;
    state.selected = state.today;
    refresh();
  };

  const shift = (dir) => {
    if (state.view === 'month') state.anchor = addMonths(startOfMonth(state.anchor), dir);
    else if (state.view === 'week') state.anchor = addDays(startOfWeek(state.anchor), dir * 7);
    else state.anchor = addDays(state.anchor, dir);
    refresh();
  };
  document.getElementById('prevBtn').onclick = () => shift(-1);
  document.getElementById('nextBtn').onclick = () => shift(1);

  document.querySelectorAll('#viewSwitch button').forEach((b) => {
    b.onclick = () => {
      const next = b.dataset.view;
      // При переходе в день показываем выбранный день, а не первое
      // число месяца: человек только что на него смотрел.
      if (next === 'day') state.anchor = state.selected || state.today;
      state.view = next;
      refresh();
    };
  });

  document.getElementById('addBtn').onclick = () => showEventForm(state, {
    date: state.view === 'day' ? state.anchor : (state.selected || state.today),
  });

  document.getElementById('isuBtn').onclick = () => { location.href = window.ISU_URL; };

  const theme = document.getElementById('themeBtn');
  const applyTheme = (dark) => {
    document.body.classList.toggle('dark-theme', dark);
    theme.textContent = dark ? 'Светлая' : 'Тёмная';
    try { localStorage.setItem('calendar-theme', dark ? 'dark' : 'light'); } catch { /* приват-режим */ }
  };
  theme.onclick = () => applyTheme(!document.body.classList.contains('dark-theme'));
  try { applyTheme(localStorage.getItem('calendar-theme') === 'dark'); } catch { applyTheme(false); }

  // Стрелки и клавиша T — как в обычных календарях.
  document.addEventListener('keydown', (e) => {
    if (document.getElementById('modal').open) return;
    if (e.target.matches('input, textarea, select')) return;
    if (e.key === 'ArrowLeft') shift(-1);
    if (e.key === 'ArrowRight') shift(1);
    if (e.key.toLowerCase() === 't' || e.key.toLowerCase() === 'е') {
      state.anchor = state.today; state.selected = state.today; refresh();
    }
  });
}

// ---------- запуск ----------

async function boot() {
  try {
    const settings = await api.settings();
    state.settings = settings;
    state.me = settings.user;
    state.today = settings.today;
    state.anchor = settings.today;
    state.selected = settings.today;
  } catch (err) {
    // Своего входа у календаря нет — отправляем туда, где он общий.
    document.getElementById('gate').classList.remove('hidden');
    if (err.status && err.status !== 401) {
      document.getElementById('gateText').textContent = 'Календарь пока не отвечает. Попробуйте обновить страницу через минуту.';
    }
    return;
  }

  document.getElementById('shell').classList.remove('hidden');
  document.getElementById('userBadge').textContent =
    `${state.me.username} · ${state.me.role === 'admin' ? 'администратор' : 'сотрудник'}`;

  state.people = await api.people().catch(() => []);
  wireTopbar();
  await refresh();
}

boot().catch((err) => {
  console.error(err);
  toast('Не удалось запустить календарь', true);
});
