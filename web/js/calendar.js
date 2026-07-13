import { state } from './state.js';
import { pad, escapeHtml, displayNo } from './utils.js';
import { openModal, closeModal } from './ui.js';

/**
 * Календарь событий: поверки, выдачи, брони.
 *
 * Что изменилось: раньше обработчик клика по дню вешался строкой
 * onclick="window._showDayEvents(...)" через глобальную переменную.
 * Теперь обработчики навешиваются нормально, а closeModal наконец
 * импортирован — раньше кнопка «Назад» падала с ошибкой.
 */
export function showCalendar() {
  let year = new Date().getFullYear();
  let month = new Date().getMonth();

  const dayEvents = (dateKey) => ({
    verification: state.instruments.filter((i) => i.valid_until === dateKey),
    booked: state.instruments.filter((i) => i.booked_for === dateKey && i.booked_by),
    taken: state.instruments.filter((i) => i.taken_at === dateKey && i.taken_by)
  });

  function renderGrid(y, m) {
    const first = new Date(y, m, 1);
    const offset = (first.getDay() + 6) % 7;       // неделя начинается с понедельника
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const now = new Date();

    let grid = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
      .map((d) => `<div class="day header">${d}</div>`).join('');
    grid += '<div></div>'.repeat(offset);

    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${y}-${pad(m + 1)}-${pad(d)}`;
      const events = dayEvents(key);
      const kinds = [
        events.verification.length > 0,
        events.booked.length > 0,
        events.taken.length > 0
      ];
      const count = kinds.filter(Boolean).length;

      let color = '';
      if (count === 3) color = 'purple';
      else if (count === 2) color = 'orange';
      else if (kinds[0]) color = 'green';
      else if (kinds[1]) color = 'red';
      else if (kinds[2]) color = 'blue';

      const isToday = y === now.getFullYear() && m === now.getMonth() && d === now.getDate();
      const classes = ['day', isToday ? 'today' : '', color].filter(Boolean).join(' ');

      grid += count
        ? `<div class="${classes}" data-day="${key}" role="button" tabindex="0">${d}</div>`
        : `<div class="${classes}">${d}</div>`;
    }
    return grid;
  }

  function renderMonth(y, m) {
    const title = new Date(y, m).toLocaleString('ru', { month: 'long', year: 'numeric' });
    return `
      <div class="calendar-header">
        <button class="secondary" data-cal-prev type="button">◀</button>
        <span class="calendar-title">${title}</span>
        <button class="secondary" data-cal-next type="button">▶</button>
      </div>
      <div class="calendar-grid">${renderGrid(y, m)}</div>
      <div class="calendar-legend">
        <span><span class="badge green">Зелёный</span> истекает поверка</span>
        <span><span class="badge red">Красный</span> бронь</span>
        <span><span class="badge blue">Синий</span> выдача</span>
        <span><span class="badge warn">Оранжевый</span> два события</span>
        <span><span class="badge purple">Фиолетовый</span> три события</span>
      </div>`;
  }

  function draw() {
    openModal('Календарь', renderMonth(year, month));
    const modal = document.getElementById('modal');

    modal.querySelector('[data-cal-prev]').onclick = () => {
      if (--month < 0) { month = 11; year--; }
      draw();
    };
    modal.querySelector('[data-cal-next]').onclick = () => {
      if (++month > 11) { month = 0; year++; }
      draw();
    };
    modal.querySelectorAll('[data-day]').forEach((node) => {
      node.onclick = () => showDay(node.dataset.day);
    });
  }

  function showDay(key) {
    const { verification, booked, taken } = dayEvents(key);
    const section = (title, items, describe) => items.length
      ? `<div class="day-section"><b>${title}</b>${items.map((i) =>
          `<div class="row panel"><div>
            <div class="row-title">${escapeHtml(displayNo(i))} ${escapeHtml(i.name)}</div>
            <div class="row-subtitle">${escapeHtml(describe(i))}</div>
          </div></div>`).join('')}</div>`
      : '';

    const html =
      section('Выданы', taken, (i) => `У пользователя: ${i.taken_by_name || ''}`) +
      section('Забронированы', booked, (i) => `Бронь: ${i.booked_by_name || ''}`) +
      section('Истекает поверка', verification, () => 'Требуется поверка/калибровка');

    openModal(`События на ${key}`, `
      <div class="list">${html || '<div class="panel card">Нет событий</div>'}</div>
      <div class="modal-actions"><button class="secondary" data-back-to-calendar type="button">Назад к календарю</button></div>`);

    document.querySelector('[data-back-to-calendar]').onclick = draw;
  }

  draw();
}
