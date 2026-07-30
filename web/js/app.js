import { api, getToken } from './api.js';
import { state, refresh, isAdmin } from './state.js';
import { escapeHtml, CONTROL_TYPES } from './utils.js';
import { openModal, closeModal, toast, setSync, run } from './ui.js';
import { badgeText, showUserForm, showUsersManager } from './auth.js';
import { renderCard, renderList, showInstrumentForm } from './instruments.js';
import { exportAllInstruments, exportExpiringInstruments } from './export.js';
import { displayNo, verificationBadge, verificationText, today } from './utils.js';

// ---------- Тема ----------

const themeToggle = document.getElementById('themeToggle');
const savedTheme = localStorage.getItem('theme') || 'light';
applyTheme(savedTheme === 'dark');
themeToggle.onclick = () => applyTheme(!document.body.classList.contains('dark-theme'));

function applyTheme(dark) {
  document.body.classList.toggle('dark-theme', dark);
  themeToggle.textContent = dark ? 'Светлая' : 'Тёмная';
  localStorage.setItem('theme', dark ? 'dark' : 'light');
}

// ---------- Запуск ----------

document.addEventListener('DOMContentLoaded', init);

async function init() {
  bindEvents();

  // Токен есть — проверяем у сервера, что он ещё действителен
  if (getToken()) {
    try {
      state.currentUser = await api.me();
      await enterApp();
      return;
    } catch {
      // токен протух — просто покажем экран входа
    }
  }
  showAuth();
}

function bindEvents() {
  document.getElementById('loginForm').onsubmit = onLogin;

  populateControlTypeFilter();

  document.getElementById('logoutButton').onclick = () => {
    api.logout();
    state.currentUser = null;
    history.pushState(null, '', location.pathname);
    showAuth();
  };

  bindMenu();

  document.getElementById('usersButton').onclick = showUsersManager;
  document.getElementById('profileButton').onclick = () => showUserForm(state.currentUser);
  document.getElementById('addInstrumentButton').onclick = () => showInstrumentForm();
  document.getElementById('retiredButton').onclick = showRetired;

  document.getElementById('searchInput').oninput = (e) => setFilter('search', e.target.value);
  document.getElementById('verificationFilter').onchange = (e) => setFilter('verification', e.target.value);
  document.getElementById('conditionFilter').onchange = (e) => setFilter('condition', e.target.value);
  document.getElementById('controlTypeFilter').onchange = (e) => setFilter('controlType', e.target.value);

  document.getElementById('massToggleBtn').onclick = () => setMassMode(!state.massMode);
  bindMassActionsMenu();
  document.getElementById('massIssueBtn').onclick = () => {
    closeMassActionsMenu();
    showBulkTakeForm();
  };
  document.getElementById('massBookBtn').onclick = () => {
    closeMassActionsMenu();
    showBulkBookForm();
  };
  document.getElementById('massRetireBtn').onclick = (e) => {
    closeMassActionsMenu();
    bulk(e.currentTarget, 'retire');
  };
  document.getElementById('massDeleteBtn').onclick = (e) => {
    closeMassActionsMenu();
    bulk(e.currentTarget, 'delete');
  };
  document.getElementById('massReturnBtn').onclick = (e) => {
    closeMassActionsMenu();
    bulkSimple(e.currentTarget, 'return');
  };
  document.getElementById('massCancelBookingBtn').onclick = (e) => {
    closeMassActionsMenu();
    bulkSimple(e.currentTarget, 'cancel-booking');
  };
  document.getElementById('massTransferBtn').onclick = () => {
    closeMassActionsMenu();
    showBulkTransferForm();
  };

  // Сервер сказал, что сессия недействительна — возвращаемся ко входу
  window.addEventListener('app:unauthorized', () => {
    state.currentUser = null;
    showAuth();
  });
  window.addEventListener('app:changed', () => {
    setSync(`Приборов: ${state.instruments.length}`);
  });
  window.addEventListener('app:refresh-route', renderRoute);
  window.addEventListener('popstate', renderRoute);
}

function setFilter(key, value) {
  state[key] = value;
  renderList(openCard);
}

/**
 * Заполняет фильтр "Классификация" полными названиями из CONTROL_TYPES —
 * единственного места, где заведён список классификаций (используется и
 * здесь, и в форме прибора). Так названия не могут разъехаться между собой.
 * "Все" и "Не указано" уже есть в index.html — новые варианты вставляем
 * между ними.
 */
function populateControlTypeFilter() {
  const select = document.getElementById('controlTypeFilter');
  const noneOption = select.querySelector('option[value="none"]');
  for (const [code, full] of CONTROL_TYPES) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = full;
    select.insertBefore(opt, noneOption);
  }
}

// ---------- Вход ----------

async function onLogin(event) {
  event.preventDefault();
  const button = event.target.querySelector('button[type="submit"]');
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  const user = await run(() => api.login(username, password), { button });
  if (!user) return;

  state.currentUser = user;
  document.getElementById('loginPassword').value = '';
  await enterApp();
}

async function enterApp() {
  document.getElementById('authView').classList.add('hidden');
  document.getElementById('appView').classList.remove('hidden');
  document.getElementById('currentUserBadge').textContent = badgeText();

  document.querySelectorAll('.admin-only')
    .forEach((node) => node.classList.toggle('hidden', !isAdmin()));

  setMassMode(false);
  setSync('Загрузка...');

  try {
    await refresh();
  } catch (err) {
    setSync('Ошибка загрузки');
    toast(err.message, true);
    return;
  }
  renderRoute();
}

function showAuth() {
  document.getElementById('appView').classList.add('hidden');
  document.getElementById('authView').classList.remove('hidden');
}

// ---------- Маршрутизация ----------

function renderRoute() {
  if (!state.currentUser) return;
  const id = new URLSearchParams(location.search).get('id');
  if (id) {
    renderCard(id, goList);
  } else {
    document.getElementById('cardScreen').classList.add('hidden');
    document.getElementById('listScreen').classList.remove('hidden');
    renderList(openCard);
  }
}

function openCard(id) {
  history.pushState(null, '', `?id=${encodeURIComponent(id)}`);
  renderRoute();
}

function goList() {
  history.pushState(null, '', location.pathname);
  renderRoute();
}

// ---------- Массовые операции ----------

function setMassMode(enabled) {
  state.massMode = enabled;
  document.getElementById('massActionsWrapper').style.display = state.massMode ? 'inline-flex' : 'none';
  document.getElementById('massActionsDropdown').classList.add('hidden');
  document.getElementById('massToggleBtn').textContent = state.massMode ? 'Отменить выбор' : 'Выбрать';
  if (state.currentUser) renderList(openCard);
}

function selectedIds() {
  return Array.from(document.querySelectorAll('.instrument-checkbox:checked'))
    .map((cb) => Number(cb.value));
}

/**
 * Списание/удаление уходит на сервер ОДНИМ запросом и выполняется одной
 * транзакцией: либо обработаются все выбранные приборы, либо ни одного.
 * Раньше это был цикл из отдельных сохранений — при обрыве связи на середине
 * часть приборов оставалась в непонятном состоянии.
 */
async function bulk(button, kind) {
  const ids = selectedIds();
  if (!ids.length) return toast('Выберите приборы', true);

  const question = kind === 'retire'
    ? `Списать ${ids.length} прибор(ов)?`
    : `Удалить ${ids.length} прибор(ов) безвозвратно?`;
  if (!confirm(question)) return;

  const result = await run(
    () => (kind === 'retire' ? api.bulkRetire(ids) : api.bulkDelete(ids)),
    { button, success: kind === 'retire' ? 'Приборы списаны' : 'Приборы удалены' }
  );
  if (result === null) return;

  setMassMode(false);
  await refresh();
  renderRoute();
}

/**
 * "Вернуть" и "Отменить бронирование" не требуют доп. данных — просто
 * подтверждение, как списание/удаление. Но, в отличие от них, здесь
 * возможен частичный успех (кто-то мог уже вернуть/отменить бронь
 * на один из выбранных приборов раньше нас) — поэтому используем
 * тот же построчный разбор результата, что и для "Взять"/"Забронировать".
 */
async function bulkSimple(button, kind) {
  const ids = selectedIds();
  if (!ids.length) return toast('Выберите приборы', true);

  const question = kind === 'return'
    ? `Вернуть ${ids.length} прибор(ов)?`
    : `Отменить бронирование у ${ids.length} прибор(ов)?`;
  if (!confirm(question)) return;

  const result = await run(
    () => (kind === 'return' ? api.bulkReturn(ids) : api.bulkCancelBooking(ids)),
    { button }
  );
  if (result === null) return;

  reportBulkResult(result, kind === 'return' ? 'возвращено' : 'отменено');
  setMassMode(false);
  await refresh();
  renderRoute();
}

function showBulkTransferForm() {
  const ids = selectedIds();
  if (!ids.length) return toast('Выберите приборы', true);

  const others = state.users.filter((u) => u.id !== state.currentUser.id);
  if (!others.length) return toast('Некому передавать', true);

  openModal(`Передать приборы (${ids.length})`, `
    <form id="bulkTransferForm" class="form-grid">
      <label>Новый пользователь
        <select name="to_user_id" required>
          ${others.map((u) => `<option value="${u.id}">${escapeHtml(u.username)}</option>`).join('')}
        </select>
      </label>
      <label>Место использования<input name="taken_where"></label>
      <label>Доп. данные<input name="taken_extra"></label>
      <div class="modal-actions"><button class="primary" type="submit">Передать (${ids.length})</button></div>
    </form>`);

  document.getElementById('bulkTransferForm').onsubmit = async (event) => {
    event.preventDefault();
    const button = event.target.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(event.target).entries());
    const result = await run(() => api.bulkTransfer(ids, data), { button });
    if (result === null) return;
    closeModal();
    reportBulkResult(result, 'передано');
    setMassMode(false);
    await refresh();
    renderRoute();
  };
}

/**
 * В отличие от списания/удаления, взять или забронировать сразу все
 * выбранные приборы не всегда получится: кто-то мог занять один из них
 * прямо перед этим. Поэтому сервер обрабатывает каждый прибор отдельно
 * и возвращает список успехов и неудач — показываем это пользователю,
 * а не молча проваливаем всю операцию из-за одного занятого прибора.
 */
function reportBulkResult(result, verbPast) {
  const { succeeded = [], failed = [] } = result || {};
  if (failed.length === 0) {
    toast(`Готово: ${succeeded.length} прибор(ов) ${verbPast}`);
    return;
  }
  const details = failed.map((f) => f.message).join('; ');
  toast(`${verbPast[0].toUpperCase()}${verbPast.slice(1)}: ${succeeded.length}. Не удалось: ${failed.length} (${details})`, true);
}

function showBulkTakeForm() {
  const ids = selectedIds();
  if (!ids.length) return toast('Выберите приборы', true);

  openModal(`Взять приборы (${ids.length})`, `
    <form id="bulkTakeForm" class="form-grid">
      <p>Кто берёт: ${escapeHtml(state.currentUser.username)}</p>
      <label>Место использования<input name="taken_where"></label>
      <label>Доп. данные<input name="taken_extra" value="${escapeHtml(state.currentUser.extra || '')}"></label>
      <label>Дата<input name="taken_at" type="date" value="${today()}"></label>
      <div class="modal-actions"><button class="primary" type="submit">Взять (${ids.length})</button></div>
    </form>`);

  document.getElementById('bulkTakeForm').onsubmit = async (event) => {
    event.preventDefault();
    const button = event.target.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(event.target).entries());
    const result = await run(() => api.bulkIssue(ids, data), { button });
    if (result === null) return;
    closeModal();
    reportBulkResult(result, 'взято');
    setMassMode(false);
    await refresh();
    renderRoute();
  };
}

function showBulkBookForm() {
  const ids = selectedIds();
  if (!ids.length) return toast('Выберите приборы', true);

  openModal(`Забронировать приборы (${ids.length})`, `
    <form id="bulkBookForm" class="form-grid">
      <p>Кто бронирует: ${escapeHtml(state.currentUser.username)}</p>
      <label>Куда бронируем (место использования)<input name="booked_where"></label>
      <label>Дата бронирования<input name="booked_for" type="date" value="${today()}" required></label>
      <label>Доп. информация<input name="booked_extra" value="${escapeHtml(state.currentUser.extra || '')}"></label>
      <div class="modal-actions"><button class="primary" type="submit">Забронировать (${ids.length})</button></div>
    </form>`);

  document.getElementById('bulkBookForm').onsubmit = async (event) => {
    event.preventDefault();
    const button = event.target.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(event.target).entries());
    const result = await run(() => api.bulkBook(ids, data), { button });
    if (result === null) return;
    closeModal();
    reportBulkResult(result, 'забронировано');
    setMassMode(false);
    await refresh();
    renderRoute();
  };
}


// ---------- Списанные ----------

async function showRetired() {
  openModal('Списанные приборы', '<div class="list">Загрузка...</div>');

  let items;
  try {
    items = await api.listRetired();
  } catch (err) {
    return openModal('Списанные приборы', `<div class="panel card">${escapeHtml(err.message)}</div>`);
  }

  const html = items.length
    ? items.map((item) => `
      <div class="row panel">
        <div>
          <div class="row-title">${escapeHtml(displayNo(item))} ${escapeHtml(item.name)}</div>
          <div class="row-subtitle">
            ${escapeHtml(item.model || 'Модель не указана')} ·
            списан ${escapeHtml(item.retired_at || '—')}
          </div>
        </div>
        <div class="badges">
          <span class="badge ${verificationBadge(item)}">${verificationText(item)}</span>
          <button class="secondary" data-open-retired="${item.id}">Открыть</button>
          ${isAdmin() ? `<button class="primary" data-restore="${item.id}">Восстановить</button>` : ''}
        </div>
      </div>`).join('')
    : '<div class="panel card">Списанных приборов нет</div>';

  openModal('Списанные приборы', `<div class="list">${html}</div>`);

  document.querySelectorAll('[data-open-retired]').forEach((node) => {
    node.onclick = () => {
      closeModal();
      openCard(node.dataset.openRetired);
    };
  });

  document.querySelectorAll('[data-restore]').forEach((node) => {
    node.onclick = async (event) => {
      const result = await run(() => api.restore(node.dataset.restore), {
        button: event.currentTarget,
        success: 'Прибор восстановлен'
      });
      if (result === null) return;
      await refresh();
      showRetired();
    };
  });
}

// ---------- Меню экспорта в Excel ----------

function bindMassActionsMenu() {
  const button = document.getElementById('massActionsBtn');
  const dropdown = document.getElementById('massActionsDropdown');

  button.onclick = (event) => {
    event.stopPropagation();
    dropdown.classList.toggle('hidden');
  };

  document.addEventListener('click', (event) => {
    if (!dropdown.classList.contains('hidden') && !dropdown.contains(event.target) && event.target !== button) {
      dropdown.classList.add('hidden');
    }
  });
}

function closeMassActionsMenu() {
  document.getElementById('massActionsDropdown').classList.add('hidden');
}

function bindMenu() {
  const button = document.getElementById('menuButton');
  const dropdown = document.getElementById('menuDropdown');

  button.onclick = (event) => {
    event.stopPropagation();
    dropdown.classList.toggle('hidden');
  };

  // Клик где угодно за пределами меню — закрывает его
  document.addEventListener('click', (event) => {
    if (!dropdown.classList.contains('hidden') && !dropdown.contains(event.target)) {
      dropdown.classList.add('hidden');
    }
  });

  document.getElementById('exportAllButton').onclick = () => {
    dropdown.classList.add('hidden');
    exportAllInstruments();
  };
  document.getElementById('exportExpiringButton').onclick = () => {
    dropdown.classList.add('hidden');
    exportExpiringInstruments();
  };
}
