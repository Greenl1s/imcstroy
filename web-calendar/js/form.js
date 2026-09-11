import { api, ApiError } from './api.js';
import { openModal, closeModal, run, toast } from './ui.js';
import { personChip } from './views.js';
import { escapeHtml, hhmm, toMinutes, fmtDay } from './utils.js';

// ============================================================
//  Окно дела и встречи.
//
//  Занятость проверяется, пока человек ещё заполняет форму, а не
//  после нажатия «Создать»: узнать, что время занято, полезнее до
//  того, как ты мысленно уже назначил встречу.
// ============================================================

const REPEATS = [
  ['none', 'Не повторяется'],
  ['daily', 'Каждый день'],
  ['weekdays', 'По будням'],
  ['weekly', 'Каждую неделю'],
  ['monthly', 'Каждый месяц'],
];

export function showEventForm(state, { event = null, date = null, start = null } = {}) {
  const isEdit = Boolean(event);
  const mine = !isEdit || Number(event.owner_id) === Number(state.me.id);

  // Чужую встречу не редактируют: из неё либо участвуют, либо выходят.
  if (isEdit && !mine) return showGuestView(state, event);

  const v = {
    title: event?.title || '',
    date: event?.event_date || date || state.selected || state.today,
    start: event ? hhmm(event.start_min) : (start || ''),
    end: event ? hhmm(event.end_min) : (start ? hhmm(toMinutes(start) + 60) : ''),
    place: event?.place || '',
    note: event?.note || '',
    repeat: event?.repeat_rule || 'none',
  };

  let guests = (event?.guests || []).map((g) => ({ ...g }));

  openModal(isEdit ? 'Дело' : 'Новое дело', `
    <form id="eventForm" class="modal-body">
      <label>Название
        <input name="title" value="${escapeHtml(v.title)}" required autocomplete="off" placeholder="Что нужно сделать">
      </label>

      <div class="row-3">
        <label>Дата<input type="date" name="date" value="${escapeHtml(v.date)}" required></label>
        <label>Начало<input type="time" name="start" value="${escapeHtml(v.start)}" step="300"></label>
        <label>Окончание<input type="time" name="end" value="${escapeHtml(v.end)}" step="300"></label>
      </div>
      <span class="task-sub">Без времени — дело просто стоит на дне и никого не занимает.</span>

      <label>Участники
        <div class="people-box" id="peopleBox"></div>
      </label>

      <div id="busyNotice"></div>

      <div class="row-2">
        <label>Повтор
          <select name="repeat" ${isEdit ? 'disabled' : ''}>
            ${REPEATS.map(([k, t]) => `<option value="${k}"${k === v.repeat ? ' selected' : ''}>${t}</option>`).join('')}
          </select>
        </label>
        <label id="untilWrap" class="${v.repeat === 'none' ? 'hidden' : ''}">Повторять до
          <input type="date" name="repeat_until" value="">
        </label>
      </div>
      ${isEdit && event.repeat_rule !== 'none'
        ? '<span class="task-sub">Это один день из серии. Изменения касаются только его.</span>' : ''}

      <label>Место<input name="place" value="${escapeHtml(v.place)}" autocomplete="off" placeholder="Необязательно"></label>
      <label>Заметка<textarea name="note" placeholder="Необязательно">${escapeHtml(v.note)}</textarea></label>
    </form>

    <div class="modal-foot">
      ${isEdit ? `<button class="danger" type="button" data-delete>Удалить</button>` : ''}
      ${isEdit && event.repeat_rule !== 'none' ? `<button class="danger" type="button" data-delete-series>Удалить всю серию</button>` : ''}
      <span class="spacer"></span>
      <button class="ghost" type="button" data-close>Отмена</button>
      <button class="primary" type="submit" form="eventForm" id="saveBtn">${isEdit ? 'Сохранить' : 'Создать'}</button>
    </div>`);

  const form = document.getElementById('eventForm');
  const peopleBox = document.getElementById('peopleBox');
  const notice = document.getElementById('busyNotice');
  const saveBtn = document.getElementById('saveBtn');
  const untilWrap = document.getElementById('untilWrap');

  // ---------- участники ----------

  const drawPeople = () => {
    const free = state.people.filter((p) => !guests.some((g) => Number(g.id) === Number(p.id)));
    peopleBox.innerHTML = `
      ${personChip({ id: state.me.id, username: `${state.me.username} · вы` }, false)}
      ${guests.map((g) => personChip(g)).join('')}
      ${free.length ? `<select id="addPerson" style="width: auto; min-height: 34px; font-size: 13px;">
        <option value="">+ добавить</option>
        ${free.map((p) => `<option value="${p.id}">${escapeHtml(p.username)}</option>`).join('')}
      </select>` : '<span class="task-sub">Больше некого позвать</span>'}`;

    peopleBox.querySelectorAll('[data-drop-person]').forEach((btn) => {
      btn.onclick = () => {
        guests = guests.filter((g) => Number(g.id) !== Number(btn.dataset.dropPerson));
        drawPeople();
        checkBusy();
      };
    });
    const add = document.getElementById('addPerson');
    if (add) add.onchange = () => {
      const person = state.people.find((p) => String(p.id) === add.value);
      if (person) guests.push({ ...person });
      drawPeople();
      checkBusy();
    };
  };

  // ---------- проверка занятости ----------

  let timer = null;
  const checkBusy = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const data = new FormData(form);
      const start = String(data.get('start') || '');
      if (!guests.length || !start) {
        notice.innerHTML = '';
        saveBtn.disabled = false;
        return;
      }
      try {
        const result = await api.busy({
          date: data.get('date'),
          start,
          end: data.get('end') || '',
          guests: guests.map((g) => g.id),
          ignore_ids: isEdit ? [event.id] : [],
        });
        drawNotice(result, data.get('start'), data.get('end'));
      } catch {
        // Не смогли проверить — молчим и не мешаем сохранять: сервер
        // всё равно проверит ещё раз перед записью.
        notice.innerHTML = '';
        saveBtn.disabled = false;
      }
    }, 350);
  };

  function drawNotice(result, start, end) {
    if (result.free) {
      notice.innerHTML = `
        <div class="notice ok">
          <div class="notice-row">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>
            <b>${escapeHtml(start)}${end ? ` — ${escapeHtml(end)}` : ''} свободно у всех участников</b>
          </div>
        </div>`;
      saveBtn.disabled = false;
      return;
    }

    const who = result.conflicts
      .filter((c) => Number(c.user_id) !== Number(state.me.id))
      .map((c) => `${escapeHtml(c.username)} — занято ${hhmm(c.start_min)} — ${hhmm(c.end_min)}`);
    const meBusy = result.conflicts.some((c) => Number(c.user_id) === Number(state.me.id));

    notice.innerHTML = `
      <div class="notice busy">
        <div class="notice-row">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; margin-top: 2px;"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg>
          <div>
            <b>В это время занято</b><br>
            ${meBusy ? 'У вас — занято<br>' : ''}${who.join('<br>')}
          </div>
        </div>
        ${result.suggestions.length ? `<div class="slots">
          <span>Свободно у всех:</span>
          ${result.suggestions.map((s) => `<button class="slot" type="button"
              data-slot="${s.date}|${hhmm(s.start)}|${hhmm(s.end)}">${
                s.date === form.date.value ? '' : fmtDay(s.date) + ', '}${hhmm(s.start)} — ${hhmm(s.end)}</button>`).join('')}
        </div>` : ''}
      </div>`;

    notice.querySelectorAll('[data-slot]').forEach((btn) => {
      btn.onclick = () => {
        const [date, start, end] = btn.dataset.slot.split('|');
        form.date.value = date;
        form.start.value = start;
        form.end.value = end;
        checkBusy();
      };
    });

    // Встречу поверх занятого времени не создаём — так и договаривались.
    saveBtn.disabled = true;
  }

  drawPeople();
  checkBusy();

  form.querySelector('[name="repeat"]').onchange = (e) => {
    untilWrap.classList.toggle('hidden', e.target.value === 'none');
  };
  ['date', 'start', 'end'].forEach((name) => {
    form.querySelector(`[name="${name}"]`).onchange = checkBusy;
  });
  // Указали начало без конца — сразу предлагаем час: так делают все,
  // и переписывать «15:00» после «14:00» не приходится.
  form.querySelector('[name="start"]').oninput = (e) => {
    const start = toMinutes(e.target.value);
    if (start !== null && !form.end.value) form.end.value = hhmm(Math.min(start + 60, 1439));
  };

  // ---------- удаление ----------

  const del = document.querySelector('[data-delete]');
  if (del) del.onclick = async (e) => {
    if (!confirm('Удалить это дело?')) return;
    const ok = await run(() => api.remove(event.id), { button: e.currentTarget, success: 'Удалено' });
    if (ok === null) return;
    closeModal();
    state.reload();
  };

  const delSeries = document.querySelector('[data-delete-series]');
  if (delSeries) delSeries.onclick = async (e) => {
    if (!confirm('Удалить все повторы этого дела?')) return;
    const ok = await run(() => api.remove(event.id, true), { button: e.currentTarget, success: 'Серия удалена' });
    if (ok === null) return;
    closeModal();
    state.reload();
  };

  // ---------- сохранение ----------

  form.onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const payload = {
      title: data.title,
      date: data.date,
      start: data.start || '',
      end: data.end || '',
      place: data.place || '',
      note: data.note || '',
      guests: guests.map((g) => g.id),
    };
    if (!isEdit) {
      payload.repeat = data.repeat || 'none';
      payload.repeat_until = data.repeat_until || '';
    }

    saveBtn.disabled = true;
    try {
      if (isEdit) {
        await api.update(event.id, payload);
        // Участников у уже созданной встречи пока не меняем: это
        // отдельный разговор с проверкой занятости у новых людей.
        toast('Сохранено');
      } else {
        const result = await api.create(payload);
        toast(result.created > 1 ? `Создано ${result.created} повторов` : 'Записано');
      }
      closeModal();
      state.reload();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        drawNotice({ free: false, ...err.data }, data.start, data.end);
        toast('В это время занято', true);
      } else {
        toast(err.message || 'Не удалось сохранить', true);
      }
      saveBtn.disabled = false;
    }
  };
}

/** Чужая встреча: посмотреть и, если надо, выйти из неё. */
function showGuestView(state, event) {
  openModal('Встреча', `
    <div class="modal-body">
      <div>
        <b style="font-size: 17px;">${escapeHtml(event.title)}</b>
        <div class="task-sub">${escapeHtml(fmtDay(event.event_date))}${
          event.start_min !== null ? `, ${hhmm(event.start_min)} — ${hhmm(event.end_min)}` : ''}</div>
      </div>
      ${event.place ? `<div><span class="section-title">Место</span><div>${escapeHtml(event.place)}</div></div>` : ''}
      ${event.note ? `<div><span class="section-title">Заметка</span><div>${escapeHtml(event.note)}</div></div>` : ''}
      <div>
        <span class="section-title">Позвал</span>
        <div class="people-box">${personChip({ id: event.owner_id, username: event.owner_name }, false)}</div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="danger" type="button" data-leave>Выйти из встречи</button>
      <span class="spacer"></span>
      <button class="ghost" type="button" data-close>Закрыть</button>
    </div>`);

  document.querySelector('[data-leave]').onclick = async (e) => {
    if (!confirm('Убрать эту встречу из своего календаря?')) return;
    const ok = await run(() => api.leave(event.id), { button: e.currentTarget, success: 'Вы больше не участник' });
    if (ok === null) return;
    closeModal();
    state.reload();
  };
}
