import { api } from './api.js';
import { state, refresh, isAdmin } from './state.js';
import { escapeHtml, getControlTypes, setControlTypes, getCompanies, setCompanies } from './utils.js';
import { openModal, closeModal, toast, setSync, run } from './ui.js';
import { badgeText, showUserForm, showUsersManager } from './auth.js';
import { renderCard, renderList, showInstrumentForm, FILEMANAGER_ORIGIN, showPendingTransfersModal, showControlTypesManager, showCompaniesManager } from './instruments.js';
import { exportAllInstruments, exportExpiringInstruments } from './export.js';
import { renderKits, renderKitCard, showKitForm } from './kits.js';
import { displayNo, verificationBadge, verificationText, today, verificationInfo,
  VERIFICATION_SOON_DAYS } from './utils.js';

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

  // Один и тот же запрос проверяет оба варианта: и токен этой вкладки
  // (если есть), и общую SSO-cookie (если человек уже вошёл на files.<домен>,
  // в ИСУ — тогда браузер сам пришлёт cookie, даже если токена в этой
  // вкладке никогда не было).
  try {
    state.currentUser = await api.me();
    await enterApp();
    return;
  } catch {
    // ни токена, ни действующей cookie — показываем экран входа
  }
  showAuth();
}

function bindEvents() {
  document.getElementById('loginForm').onsubmit = onLogin;

  const backToIsuButton = document.getElementById('backToIsuButton');
  if (backToIsuButton) {
    backToIsuButton.onclick = () => {
      location.href = '/';
    };
  }

  const backToListButton = document.getElementById('backToListButton');
  if (backToListButton) backToListButton.onclick = () => goList();

  document.getElementById('pendingTransfersBtn').onclick = () => showPendingTransfersModal();

  document.getElementById('logoutButton').onclick = async () => {
    await api.logout();
    state.currentUser = null;
    history.pushState(null, '', location.pathname);
    showAuth();
  };

  bindMenu();

  document.getElementById('usersButton').onclick = showUsersManager;
  document.getElementById('controlTypesButton').onclick = showControlTypesManager;
  document.getElementById('companiesButton').onclick = showCompaniesManager;
  document.getElementById('profileButton').onclick = () => showUserForm(state.currentUser);
  document.getElementById('addInstrumentButton').onclick = () => showInstrumentForm();
  document.getElementById('retiredButton').onclick = showRetired;
  document.getElementById('kitsButton').onclick = goKits;

  document.getElementById('searchInput').oninput = (e) => setFilter('search', e.target.value);
  document.getElementById('verificationFilter').onchange = (e) => setFilter('verification', e.target.value);
  document.getElementById('conditionFilter').onchange = (e) => setFilter('condition', e.target.value);
  document.getElementById('controlTypeFilter').onchange = (e) => setFilter('controlType', e.target.value);
  document.getElementById('companyFilter').onchange = (e) => setFilter('company', e.target.value);

  document.getElementById('massToggleBtn').onclick = () => setMassMode(!state.massMode);
  document.getElementById('massCancelBtn').onclick = () => setMassMode(false);

  // Счётчик выбранного обновляется на любой щелчок по списку: галочки
  // рисуются заново при каждой перерисовке, вешать обработчик на каждую
  // по отдельности незачем.
  document.getElementById('instrumentList').addEventListener('click', updateMassCount);

  // Подпись фильтра работает и как заголовок колонки: щелчок сортирует
  // список по этому полю, повторный щелчок переворачивает порядок.
  document.querySelectorAll('.filter-chip-label[data-sort]').forEach((label) => {
    label.onclick = () => toggleSort(label.dataset.sort);
  });
  document.getElementById('massIssueBtn').onclick = (e) => {
    showBulkTakeForm();
  };
  document.getElementById('massBookBtn').onclick = (e) => {
    showBulkBookForm();
  };
  document.getElementById('massRetireBtn').onclick = (e) => {
    bulk(e.currentTarget, 'retire');
  };
  document.getElementById('massDeleteBtn').onclick = (e) => {
    bulk(e.currentTarget, 'delete');
  };
  document.getElementById('massReturnBtn').onclick = (e) => {
    bulkSimple(e.currentTarget, 'return');
  };
  document.getElementById('massConfirmBookingBtn').onclick = (e) => {
    bulkSimple(e.currentTarget, 'confirm-booking');
  };
  document.getElementById('massCancelBookingBtn').onclick = (e) => {
    bulkSimple(e.currentTarget, 'cancel-booking');
  };
  document.getElementById('massTransferBtn').onclick = (e) => {
    showBulkTransferForm();
  };

  document.getElementById('massQrWordBtn').onclick = (e) => {
    downloadSelectedQrAsWord();
  };

  // «Собрать комплект» из отмеченных галочками приборов: самый частый
  // способ завести комплект — отметить то, что и так берёшь вместе.
  document.getElementById('massMakeKitBtn').onclick = () => {
    const ids = selectedIds();
    if (!ids.length) return toast('Выберите приборы', true);
    showKitForm(null, ids);
  };

  document.getElementById('massSetCompanyBtn').onclick = (e) => {
    showBulkSetCompanyForm();
  };

  // Сервер сказал, что сессия недействительна — возвращаемся ко входу
  window.addEventListener('app:unauthorized', () => {
    state.currentUser = null;
    showAuth();
  });
  window.addEventListener('app:changed', () => {
    setSync(`Приборов: ${state.instruments.length}`);
    renderSummary();
  });
  window.addEventListener('app:refresh-route', renderRoute);

  // Кнопки на экране «ничего не нашлось» — их рисует список, а сбрасывать
  // фильтры и открывать списанные умеет этот файл.
  window.addEventListener('app:reset-filters', () => {
    state.search = ''; state.condition = 'all'; state.verification = 'all';
    state.controlType = 'all'; state.company = 'all';
    document.getElementById('searchInput').value = '';
    for (const id of ['conditionFilter', 'verificationFilter', 'controlTypeFilter', 'companyFilter']) {
      document.getElementById(id).value = 'all';
    }
    renderList(openCard);
    renderSummary();
  });
  window.addEventListener('app:show-retired', () => showRetired());
  // Модуль комплектов не знает про историю браузера — он только сообщает,
  // куда хочет перейти, а маршрутизация живёт здесь, в одном месте.
  window.addEventListener('app:go-list', () => goList());
  window.addEventListener('app:open-kit', (event) => {
    setMassMode(false);
    openKit(event.detail.id);
  });
  window.addEventListener('popstate', renderRoute);
  window.addEventListener('app:control-types-changed', () => {
    loadControlTypes();
  });
  window.addEventListener('app:companies-changed', () => {
    loadCompanies();
  });
}

function setFilter(key, value) {
  state[key] = value;
  renderList(openCard);
  renderSummary();
}

/**
 * Сортировка по колонке. Первый щелчок ставит сортировку по этому полю,
 * второй — переворачивает порядок.
 */
function toggleSort(field) {
  if (state.sort === field) state.sortDesc = !state.sortDesc;
  else { state.sort = field; state.sortDesc = false; }
  markSortedColumn();
  renderList(openCard);
}

function markSortedColumn() {
  document.querySelectorAll('.filter-chip-label[data-sort]').forEach((label) => {
    const on = label.dataset.sort === state.sort;
    label.classList.toggle('sorted', on);
    label.dataset.arrow = on ? (state.sortDesc ? ' ↓' : ' ↑') : '';
  });
}

/**
 * Сводка над фильтрами. Числа кликабельны: каждое ставит фильтры так,
 * чтобы в списке остались ровно те приборы, о которых оно говорит.
 * Считаем по всем приборам, а не по текущей выборке, — иначе цифра
 * прыгала бы вслед за фильтром и ничего не значила.
 */
function renderSummary() {
  const bar = document.getElementById('summaryBar');
  if (!bar) return;
  const all = state.instruments;
  const kinds = all.map((i) => verificationInfo(i).kind);
  const cells = [
    { key: 'all',      n: all.length,                                   label: 'всего' },
    { key: 'free',     n: all.filter((i) => i.status === 'free').length,   label: 'свободно' },
    { key: 'busy',     n: all.filter((i) => i.status === 'busy').length,   label: 'на руках' },
    { key: 'booked',   n: all.filter((i) => i.status === 'booked').length, label: 'в брони' },
    { key: 'expired',  n: kinds.filter((k) => k === 'expired').length,  label: 'поверка истекла', tone: 'bad' },
    { key: 'soon',     n: kinds.filter((k) => k === 'soon').length,
      label: `истекает ≤ ${VERIFICATION_SOON_DAYS} дней`, tone: 'warn' },
  ];

  bar.innerHTML = cells.map((c) => `
    <button class="summary-cell${c.tone ? ' ' + c.tone : ''}${isSummaryActive(c.key) ? ' on' : ''}"
            type="button" data-summary="${c.key}">
      <b>${c.n}</b> ${escapeHtml(c.label)}
    </button>`).join('') +
    '<span class="summary-grow"></span>';

  bar.querySelectorAll('[data-summary]').forEach((btn) => {
    btn.onclick = () => applySummaryFilter(btn.dataset.summary);
  });
}

/** Подсвечиваем то число, которое сейчас и показано в списке. */
function isSummaryActive(key) {
  const noFilters = state.condition === 'all' && state.verification === 'all';
  if (key === 'all') return noFilters;
  if (['free', 'busy', 'booked'].includes(key)) {
    return state.condition === key && state.verification === 'all';
  }
  return state.verification === key && state.condition === 'all';
}

function applySummaryFilter(key) {
  const condition = document.getElementById('conditionFilter');
  const verification = document.getElementById('verificationFilter');

  if (key === 'all') { state.condition = 'all'; state.verification = 'all'; }
  else if (['free', 'busy', 'booked'].includes(key)) { state.condition = key; state.verification = 'all'; }
  else { state.verification = key; state.condition = 'all'; }

  condition.value = state.condition;
  verification.value = state.verification;
  renderList(openCard);
  renderSummary();
}

/**
 * Заполняет фильтр "Классификация" полными названиями — список приходит
 * с сервера (см. loadControlTypes), чтобы админ мог управлять им без
 * правки кода. "Все" и "Не указано" уже есть в index.html и никогда не
 * трогаются — остальные варианты между ними стираем и вставляем заново
 * (функция может вызываться повторно, например, после того как админ
 * что-то добавил или удалил в списке классификаций).
 */
function populateControlTypeFilter() {
  const select = document.getElementById('controlTypeFilter');
  const noneOption = select.querySelector('option[value="none"]');
  select.querySelectorAll('option').forEach((opt) => {
    if (opt.value !== 'all' && opt.value !== 'none') opt.remove();
  });
  for (const [code, full] of getControlTypes()) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = full;
    select.insertBefore(opt, noneOption);
  }
}

/** Получает список классификаций с сервера и сохраняет его для всего приложения. */
async function loadControlTypes() {
  const list = await api.listControlTypes();
  setControlTypes(list);
  populateControlTypeFilter();
}

/**
 * Заполняет фильтр "Привязан" — та же логика, что и для классификаций:
 * список приходит с сервера, "Все" и "Не привязан" уже есть в index.html,
 * остальное стирается и вставляется заново при каждом вызове.
 */
function populateCompanyFilter() {
  const select = document.getElementById('companyFilter');
  const noneOption = select.querySelector('option[value="none"]');
  select.querySelectorAll('option').forEach((opt) => {
    if (opt.value !== 'all' && opt.value !== 'none') opt.remove();
  });
  for (const [code, name] of getCompanies()) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = name;
    select.insertBefore(opt, noneOption);
  }
}

async function loadCompanies() {
  state.company = state.company || 'all';
  const list = await api.listCompanies();
  setCompanies(list);
  populateCompanyFilter();
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
    await loadControlTypes();
    await loadCompanies();
  } catch (err) {
    setSync('Ошибка загрузки');
    toast(err.message, true);
    return;
  }
  markSortedColumn();
  renderSummary();
  renderRoute();
}

function showAuth() {
  document.getElementById('appView').classList.add('hidden');
  document.getElementById('authView').classList.remove('hidden');
}

// ---------- Маршрутизация ----------

/**
 * Три экрана и один адрес. Что показать, решает строка запроса:
 *   ?id=<n>    — карточка прибора
 *   ?kit=<n>   — карточка комплекта (она же проверка перед выездом)
 *   ?kits      — список комплектов
 *   пусто      — список приборов
 * Так работает кнопка «назад» в браузере и так ссылку можно переслать.
 */
function showScreen(name) {
  for (const id of ['listScreen', 'cardScreen', 'kitsScreen']) {
    document.getElementById(id).classList.toggle('hidden', id !== name);
  }
}

function renderRoute() {
  if (!state.currentUser) return;
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const kitId = params.get('kit');

  // «К списку» живёт в шапке рядом с «В ИСУ» — это выход из карточки,
  // а не действие над прибором. Показываем её ровно там, откуда есть
  // куда выходить.
  const backToList = document.getElementById('backToListButton');
  if (backToList) backToList.classList.toggle('hidden', !id && !kitId);

  if (kitId) {
    showScreen('kitsScreen');
    renderKitCard(kitId, goKits);
  } else if (params.has('kits')) {
    showScreen('kitsScreen');
    renderKits(openKit);
  } else if (id) {
    showScreen('cardScreen');
    renderCard(id, goList);
  } else {
    showScreen('listScreen');
    renderList(openCard);
  }
}

function openKit(id) {
  history.pushState(null, '', `?kit=${encodeURIComponent(id)}`);
  renderRoute();
}

function goKits() {
  history.pushState(null, '', '?kits');
  renderRoute();
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
  document.getElementById('massPanel').classList.toggle('hidden', !state.massMode);
  document.getElementById('massToggleBtn').textContent = state.massMode ? 'Отменить выбор' : 'Выбрать';
  if (state.currentUser) renderList(openCard);
  updateMassCount();
}

function selectedIds() {
  return Array.from(document.querySelectorAll('.instrument-checkbox:checked'))
    .map((cb) => Number(cb.value));
}

/**
 * Сколько приборов выбрано — пишем прямо в панели. Массовое списание
 * на десяток лишних позиций отменить нельзя, поэтому число должно быть
 * перед глазами, а не в голове.
 */
function updateMassCount() {
  const node = document.getElementById('massCount');
  if (!node) return;
  const n = selectedIds().length;
  node.textContent = n ? `Выбрано ${n}` : 'Ничего не выбрано';
  node.classList.toggle('is-empty', n === 0);
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

  const questions = {
    return: `Вернуть ${ids.length} прибор(ов)?`,
    'cancel-booking': `Отменить бронирование у ${ids.length} прибор(ов)?`,
    'confirm-booking': `Подтвердить бронирование и выдать ${ids.length} прибор(ов)?`
  };
  if (!confirm(questions[kind])) return;

  const actions = {
    return: () => api.bulkReturn(ids),
    'cancel-booking': () => api.bulkCancelBooking(ids),
    'confirm-booking': () => api.bulkConfirmBooking(ids)
  };
  const result = await run(actions[kind], { button });
  if (result === null) return;

  const verbs = { return: 'возвращено', 'cancel-booking': 'отменено', 'confirm-booking': 'выдано' };
  reportBulkResult(result, verbs[kind]);
  setMassMode(false);
  await refresh();
  renderRoute();
}

function showBulkTransferForm() {
  const ids = selectedIds();
  if (!ids.length) return toast('Выберите приборы', true);

  const others = state.users.filter((u) => u.id !== state.currentUser.id);
  if (!others.length) return toast('Некому передавать', true);

  const extraByUserId = Object.fromEntries(others.map((u) => [u.id, u.extra || '']));

  openModal(`Передать приборы (${ids.length})`, `
    <form id="bulkTransferForm" class="form-grid">
      <label>Новый пользователь
        <select name="to_user_id" required>
          ${others.map((u) => `<option value="${u.id}">${escapeHtml(u.username)}</option>`).join('')}
        </select>
      </label>
      <label>Место использования<input name="taken_where"></label>
      <label>Доп. данные<input name="taken_extra" value="${escapeHtml(extraByUserId[others[0].id] || '')}"></label>
      <p class="row-subtitle">Приборы перейдут к новому пользователю только после того, как он сам подтвердит приём.</p>
      <div class="modal-actions"><button class="primary" type="submit">Предложить передачу (${ids.length})</button></div>
    </form>`);

  const form = document.getElementById('bulkTransferForm');
  form.querySelector('[name="to_user_id"]').addEventListener('change', (event) => {
    form.querySelector('[name="taken_extra"]').value = extraByUserId[event.target.value] || '';
  });

  form.onsubmit = async (event) => {
    event.preventDefault();
    const button = event.target.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(event.target).entries());
    const result = await run(() => api.bulkTransfer(ids, data), { button });
    if (result === null) return;
    closeModal();
    reportBulkResult(result, 'предложено к передаче');
    setMassMode(false);
    await refresh();
    renderRoute();
  };
}

/** Назначает (или снимает) владельца сразу у нескольких выбранных приборов. */
function showBulkSetCompanyForm() {
  const ids = selectedIds();
  if (!ids.length) return toast('Выберите приборы', true);

  const companies = getCompanies();
  if (!companies.length) return toast('Сначала добавьте хотя бы одну компанию (кнопка «Компании» в меню)', true);

  openModal(`Назначить владельца (${ids.length})`, `
    <form id="bulkSetCompanyForm" class="form-grid">
      <label>Владелец
        <select name="company_code">
          <option value="">Не привязан</option>
          ${companies.map(([code, name]) => `<option value="${escapeHtml(code)}">${escapeHtml(name)}</option>`).join('')}
        </select>
      </label>
      <div class="modal-actions"><button class="primary" type="submit">Назначить (${ids.length})</button></div>
    </form>`);

  document.getElementById('bulkSetCompanyForm').onsubmit = async (event) => {
    event.preventDefault();
    const button = event.target.querySelector('button[type="submit"]');
    const companyCode = new FormData(event.target).get('company_code') || null;
    const result = await run(() => api.bulkSetCompany(ids, companyCode), { button });
    if (result === null) return;
    closeModal();
    reportBulkResult(result, 'назначено');
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


/* ---------- Раскладка QR-кодов по папкам приборов ---------- */

/**
 * Раньше эта кнопка рисовала QR-коды в браузере и складывала их плоским
 * списком в общую папку «Оборудование/QR-код»: найти там нужный можно
 * было только по имени, а имена приборов повторяются, и файлы молча
 * затирали друг друга. Плюс перед каждой выгрузкой папка вычищалась —
 * то есть всё, что туда положили руками, пропадало.
 *
 * Теперь QR-код лежит в папке своего прибора и появляется там сам.
 * Кнопка осталась для одного случая: адрес сайта поменялся, и коды надо
 * перерисовать. Рисует их сервер ИСУ — он один знает, где чья папка,
 * и знает настоящий адрес сайта.
 */
async function exportAllQrCodes() {
  if (!confirm(
    'Перерисовать QR-коды всех приборов?\n\n' +
    'Каждый код ляжет в папку своего прибора в ИСУ. ' +
    'Ничего постороннего не удаляется.'
  )) return;

  const base = window.FILEMANAGER_BASE || '';
  try {
    const res = await fetch(`${base}/api/equipment/qr-rebuild`, {
      method: 'POST', credentials: 'include',
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || `HTTP ${res.status}`);
    }
    const { count } = await res.json();
    toast(`Готово: QR-кодов разложено по папкам — ${count}`);
  } catch (err) {
    toast('Не удалось разложить QR-коды: ' + err.message, true);
  }
}

/**
 * PNG того же QR-кода, что показывает карточка прибора.
 *
 * Нужен только для Word-листа с наклейками: там картинки вставляются
 * в документ, а не кладутся файлами. Раскладку по папкам делает сервер
 * ИСУ — он один знает, где чья папка.
 */
function renderQrPng(item) {
  return new Promise((resolve, reject) => {
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed; left:-9999px; top:-9999px;';
    document.body.appendChild(container);

    const url = `${location.origin}${location.pathname}?id=${encodeURIComponent(item.id)}`;
    new QRCode(container, { text: url, width: 220, height: 220 });

    setTimeout(() => {
      const canvas = container.querySelector('canvas');
      if (!canvas) {
        document.body.removeChild(container);
        return reject(new Error('Не удалось построить QR-код'));
      }
      canvas.toBlob((blob) => {
        document.body.removeChild(container);
        if (!blob) return reject(new Error('Не удалось получить изображение'));
        resolve(blob);
      }, 'image/png');
    }, 30);
  });
}

/**
 * Собирает QR-коды выбранных приборов в один Word-файл: лист книжный
 * (портретный), сетка 4×4 (16 QR на странице), красные линии делят лист на 8 равных
 * частей — только по границам строк и ровно по центру (между 2-й и 3-й
 * колонкой), внутри каждой половины QR-коды стоят по два без линии между
 * ними. Заполнение по порядку — сначала левый верхний, дальше по строке.
 * Если приборов больше 16 — начинается новая страница. Под каждым QR —
 * номер прибора. Картинки обычные, их можно менять/удалять прямо в Word.
 */
async function downloadSelectedQrAsWord() {
  const ids = selectedIds();
  if (!ids.length) return toast('Выберите приборы', true);

  const items = ids
    .map((id) => (state.instruments || []).find((i) => i.id === id))
    .filter(Boolean);
  if (!items.length) return toast('Не удалось найти выбранные приборы', true);

  const {
    Document, Packer, Table, TableRow, TableCell, Paragraph, ImageRun, TextRun,
    AlignmentType, BorderStyle, WidthType, PageOrientation, HeightRule, VerticalAlign, PageBreak
  } = docx;

  // Параметры листа A4 (книжная ориентация) и сетки подобраны и проверены
  // вручную (визуальным рендером), чтобы 4 строки гарантированно помещались
  // на одной странице и картинки нигде не заезжали на красные линии.
  const PAGE_W = 11906, PAGE_H = 16838, MARGIN = 400;
  const usableW = PAGE_W - MARGIN * 2;
  const COLS = 4, ROWS = 4;
  const PER_PAGE = COLS * ROWS;
  const COL_WIDTH = Math.floor(usableW / COLS);
  const ROW_HEIGHT = 2450;
  const QR_SIZE_PX = 90;

  const red = { style: BorderStyle.SINGLE, size: 16, color: 'FF0000' };
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };

  async function buildCell(item, colIndex) {
    // Вертикальная красная линия — строго по центру: между 2-й и 3-й
    // колонкой (индексы 1 и 2 при отсчёте с нуля). Больше нигде по
    // вертикали линий нет — только общие верх/низ каждой строки.
    const rightBorder = colIndex === 1 ? red : none;
    const leftBorder = colIndex === 2 ? red : none;

    if (!item) {
      return new TableCell({
        width: { size: COL_WIDTH, type: WidthType.DXA },
        borders: { top: red, bottom: red, left: leftBorder, right: rightBorder },
        children: [new Paragraph('')],
      });
    }

    const blob = await renderQrPng(item);
    // Важно: docx-библиотека объявляет поддержку Blob напрямую, но на
    // практике (проверено) это даёт ПУСТУЮ картинку без единой ошибки —
    // поэтому переводим в Uint8Array сами, это гарантированно работает.
    const data = new Uint8Array(await blob.arrayBuffer());

    return new TableCell({
      width: { size: COL_WIDTH, type: WidthType.DXA },
      verticalAlign: VerticalAlign.CENTER,
      borders: { top: red, bottom: red, left: leftBorder, right: rightBorder },
      margins: { top: 60, bottom: 60, left: 50, right: 50 },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 20 },
          children: [new ImageRun({ data, transformation: { width: QR_SIZE_PX, height: QR_SIZE_PX }, type: 'png' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: displayNo(item), bold: true, size: 16 })],
        }),
      ],
    });
  }

  try {
    const children = [];
    for (let page = 0; page * PER_PAGE < items.length; page++) {
      const pageItems = items.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
      const rows = [];
      for (let r = 0; r < ROWS; r++) {
        const cells = [];
        for (let c = 0; c < COLS; c++) {
          cells.push(await buildCell(pageItems[r * COLS + c] || null, c));
        }
        rows.push(new TableRow({ children: cells, height: { value: ROW_HEIGHT, rule: HeightRule.EXACT } }));
      }
      children.push(new Table({ rows, width: { size: usableW, type: WidthType.DXA }, columnWidths: Array(COLS).fill(COL_WIDTH) }));
      if ((page + 1) * PER_PAGE < items.length) {
        children.push(new Paragraph({ children: [new PageBreak()] }));
      }
    }

    const wordDoc = new Document({
      sections: [{
        properties: {
          page: {
            size: { orientation: PageOrientation.PORTRAIT, width: PAGE_W, height: PAGE_H },
            margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
          },
        },
        children,
      }],
    });
    const blob = await Packer.toBlob(wordDoc);

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'QR-коды.docx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    toast(`Готово: ${items.length} QR-код(ов) в файле`);
  } catch (err) {
    toast('Не удалось собрать файл: ' + err.message, true);
  }
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

  // Клик по любому пункту ВНУТРИ меню — тоже закрывает его (сам пункт
  // при этом уже успевает сработать: его собственный onclick навешен
  // отдельно, в bindEvents(), и выполняется раньше, чем событие дойдёт
  // сюда всплытием).
  dropdown.addEventListener('click', (event) => {
    if (event.target.tagName === 'BUTTON') {
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
  document.getElementById('exportQrButton').onclick = () => {
    dropdown.classList.add('hidden');
    exportAllQrCodes();
  };
  document.getElementById('downloadQrButton').onclick = () => {
    dropdown.classList.add('hidden');
    downloadAllQrCodes();
  };
}

/**
 * Скачивает все QR-коды одним архивом.
 *
 * Архив собирает ИСУ — он и так хранит коды в папках приборов и умеет
 * отдавать их плоским списком с человеческими именами файлов. Своего
 * сборщика «Учёту» заводить незачем: получились бы две разные кучи
 * наклеек, которые однажды разошлись бы.
 */
async function downloadAllQrCodes() {
  toast('Собираю архив с QR-кодами...');
  try {
    const base = window.FILEMANAGER_BASE || '';
    const res = await fetch(`${base}/api/equipment/qr-archive`, { credentials: 'include' });
    if (!res.ok) {
      const message = res.status === 404
        ? 'QR-кодов пока нет — сначала выгрузите их в папки приборов'
        : 'Файловый менеджер не отдал архив';
      return toast(message, true);
    }
    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Наклейки с QR.zip';
    link.click();
    URL.revokeObjectURL(url);
    toast('Архив скачан');
  } catch {
    toast('Не удалось скачать архив', true);
  }
}
