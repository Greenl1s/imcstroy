import { api } from './api.js';
import { state, refresh, isAdmin } from './state.js';
import { escapeHtml, getControlTypes, setControlTypes, getCompanies, setCompanies,
  qtyOf, pieces, plural } from './utils.js';
import { openModal, closeModal, toast, setSync, run, qtyInput } from './ui.js';
import { badgeText, showUserForm, showUsersManager } from './auth.js';
import { renderCard, renderList, showInstrumentForm, FILEMANAGER_ORIGIN, showPendingTransfersModal, showControlTypesManager, showCompaniesManager } from './instruments.js';
import { exportAllInstruments, exportExpiringInstruments } from './export.js';
import { renderKits, renderKitCard, showKitForm } from './kits.js';
import { displayNo, verificationBadge, verificationText, today, verificationInfo,
  VERIFICATION_SOON_DAYS } from './utils.js';
import { sheetGeometry } from './qr-sheet.js';

let retiredItems = [];
let routeRevision = 0;

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

  // Без сети просить пароль бессмысленно: проверить его некому. Честно
  // говорим, что случилось, вместо формы, которая всё равно не сработает.
  if (!navigator.onLine) {
    const note = document.querySelector('#authView .auth-panel p');
    if (note) note.textContent =
      'Нет связи с сервером. Войти сейчас не получится — пароль проверяет сервер.';
  }
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
  document.getElementById('recognitionScannerButton').onclick = () => { location.href = './scanner.html'; };
  document.getElementById('navInstrumentsButton').onclick = () => { setSidebarActive('navInstrumentsButton'); goList(); };
  document.getElementById('navKitsButton').onclick = () => { setSidebarActive('navKitsButton'); goKits(); };
  document.getElementById('navScannerButton').onclick = () => { location.href = './scanner.html'; };
  document.getElementById('navRetiredButton').onclick = () => { setSidebarActive('navRetiredButton'); showRetired(); };
  document.getElementById('mobileInstrumentsButton').onclick = goList;
  document.getElementById('mobileKitsButton').onclick = goKits;
  document.getElementById('mobileScannerButton').onclick = openScanner;
  document.getElementById('mobileScannerHero').onclick = openScanner;
  document.getElementById('mobileMenuButton').onclick = () => document.getElementById('menuButton').click();

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
    showQrCountForm();
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
    renderVisibleList();
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

function setSidebarActive(id) {
  document.querySelectorAll('.sidebar-link').forEach((button) =>
    button.classList.toggle('is-active', button.id === id));
}

function setMobileActive(id) {
  document.querySelectorAll('.mobile-bottom-nav button').forEach((button) =>
    button.classList.toggle('is-active', button.id === id));
}

function openScanner() {
  location.href = './scanner.html';
}

function isRetiredRoute() {
  return new URLSearchParams(location.search).has('retired');
}

function renderVisibleList() {
  renderList(openCard, isRetiredRoute() ? { items: retiredItems, retired: true } : {});
}

function setFilter(key, value) {
  state[key] = value;
  renderVisibleList();
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
  renderVisibleList();
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
  renderVisibleList();
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
 *   ?retired   — списанные приборы
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
  const revision = ++routeRevision;
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const kitId = params.get('kit');
  const pageTitle = document.getElementById('pageTitle');

  // «К списку» живёт в шапке рядом с «В ИСУ» — это выход из карточки,
  // а не действие над прибором. Показываем её ровно там, откуда есть
  // куда выходить.
  const backToList = document.getElementById('backToListButton');
  if (backToList) backToList.classList.toggle('hidden', !id && !kitId);

  if (kitId) {
    if (pageTitle) pageTitle.textContent = 'Комплект';
    setSidebarActive('navKitsButton');
    setMobileActive('mobileKitsButton');
    showScreen('kitsScreen');
    renderKitCard(kitId, goKits);
  } else if (params.has('kits')) {
    if (pageTitle) pageTitle.textContent = 'Комплекты';
    setSidebarActive('navKitsButton');
    setMobileActive('mobileKitsButton');
    showScreen('kitsScreen');
    renderKits(openKit);
  } else if (id) {
    if (pageTitle) pageTitle.textContent = 'Карточка прибора';
    setSidebarActive('navInstrumentsButton');
    setMobileActive('mobileInstrumentsButton');
    showScreen('cardScreen');
    renderCard(id, goList);
  } else if (params.has('retired')) {
    if (pageTitle) pageTitle.textContent = 'Списанные';
    setSidebarActive('navRetiredButton');
    setMobileActive('mobileInstrumentsButton');
    showScreen('listScreen');
    document.getElementById('listScreen').classList.add('retired-view');
    document.getElementById('instrumentList').innerHTML = '<div class="empty-state"><div class="empty-title">Загружаем списанные…</div></div>';
    api.listRetired().then((items) => {
      if (revision !== routeRevision || !isRetiredRoute()) return;
      retiredItems = items;
      renderVisibleList();
    }).catch((err) => {
      if (revision !== routeRevision || !isRetiredRoute()) return;
      document.getElementById('instrumentList').innerHTML = `<div class="empty-state"><div class="empty-title">Не удалось загрузить списанные</div><div class="empty-text">${escapeHtml(err.message)}</div></div>`;
    });
  } else {
    if (pageTitle) pageTitle.textContent = 'Приборы';
    setSidebarActive('navInstrumentsButton');
    setMobileActive('mobileInstrumentsButton');
    showScreen('listScreen');
    document.getElementById('listScreen').classList.remove('retired-view');
    renderVisibleList();
  }
}

function openKit(id) {
  history.pushState(null, '', `?kit=${encodeURIComponent(id)}`);
  renderRoute();
}

function goKits() {
  document.getElementById('listScreen').classList.remove('retired-view');
  history.pushState(null, '', '?kits');
  renderRoute();
}

function openCard(id) {
  history.pushState(null, '', `?id=${encodeURIComponent(id)}`);
  renderRoute();
}

function goList() {
  document.getElementById('listScreen').classList.remove('retired-view');
  history.pushState(null, '', location.pathname);
  showScreen('listScreen');
  renderRoute();
}

// ---------- Массовые операции ----------

function setMassMode(enabled) {
  state.massMode = enabled;
  document.getElementById('massPanel').classList.toggle('hidden', !state.massMode);
  document.getElementById('massToggleBtn').textContent = state.massMode ? 'Отменить выбор' : 'Выбрать';
  if (state.currentUser) renderVisibleList();
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
          ${others.map((u) => `<option value="${u.id}">${escapeHtml(u.name)}</option>`).join('')}
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
      <p>Кто берёт: ${escapeHtml(state.currentUser.name)}</p>
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
      <p>Кто бронирует: ${escapeHtml(state.currentUser.name)}</p>
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

function showRetired() {
  state.condition = 'all';
  document.getElementById('conditionFilter').value = 'all';
  setMassMode(false);
  history.pushState(null, '', '?retired');
  renderRoute();
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
 *
 * Сетка занимает лист целиком и разложена под готовую самоклейку 105×74 мм
 * («8 на лист»): печатают на заранее нарезанной бумаге, и линии обязаны
 * попадать в рез. Все размеры и причины — в qr-sheet.js.
 */
/**
 * Сначала спрашиваем, сколько наклеек нужно на каждый прибор.
 *
 * Наклейку клеят на КАЖДЫЙ предмет, а не на карточку: три одинаковых
 * фонаря — три наклейки с одним и тем же кодом. Поэтому напротив прибора
 * сразу стоит его наличие, а не единица: чаще всего это и есть ответ, и
 * менять ничего не придётся.
 *
 * Ноль означает «этот не печатать» — иначе пришлось бы возвращаться в
 * список и снимать галочку ради одной строки.
 */
function showQrCountForm() {
  const ids = selectedIds();
  if (!ids.length) return toast('Выберите приборы', true);

  const items = ids
    .map((id) => (state.instruments || []).find((i) => i.id === id))
    .filter(Boolean);
  if (!items.length) return toast('Не удалось найти выбранные приборы', true);

  const perPage = sheetGeometry().perPage;

  openModal('Сколько наклеек печатать', `
    <form id="qrCountForm">
      <p class="row-subtitle qr-count-note">
        Подставлено наличие прибора. Поменяйте, если нужно иначе; ноль — не печатать.
      </p>
      <table class="qr-count-table">
        <thead>
          <tr><th>Прибор</th><th class="num">Наличие</th><th class="num">Наклеек</th></tr>
        </thead>
        <tbody>
          ${items.map((item) => `
            <tr>
              <td>
                <b>${escapeHtml(item.name)}</b>
                <span class="row-subtitle">${escapeHtml(displayNo(item))}${
                  item.model ? ' · ' + escapeHtml(item.model) : ''}</span>
              </td>
              <td class="num">${escapeHtml(pieces(qtyOf(item)))}</td>
              <td class="num">
                ${qtyInput(`qty_${item.id}`, '', qtyOf(item), { min: 0, max: 99 })}
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
      <div class="qr-count-total" id="qrCountTotal"></div>
      <div class="modal-actions">
        <button class="primary" type="submit" id="qrCountGo">Выгрузить в Word</button>
      </div>
    </form>`);

  const form = document.getElementById('qrCountForm');
  const counts = () => items.map((item) => ({
    item,
    n: Math.max(0, Number(form.elements[`qty_${item.id}`].value) || 0),
  }));

  const retotal = () => {
    const total = counts().reduce((sum, c) => sum + c.n, 0);
    const pages = Math.ceil(total / perPage) || 0;
    const rest = pages * perPage - total;
    document.getElementById('qrCountTotal').innerHTML = total
      ? `<b>Всего ${escapeHtml(plural(total, 'наклейка', 'наклейки', 'наклеек'))}</b> — ${
          escapeHtml(plural(pages, 'лист', 'листа', 'листов'))}${
          rest ? `, ${pages === 1 ? 'на нём' : 'на последнем'} останется ${
            escapeHtml(plural(rest, 'свободное место', 'свободных места', 'свободных мест'))}` : ''}`
      : '<b>Ничего не выбрано</b> — поставьте хотя бы одну наклейку';
    document.getElementById('qrCountGo').disabled = !total;
  };
  form.addEventListener('input', retotal);
  retotal();

  form.onsubmit = async (event) => {
    event.preventDefault();
    const chosen = counts().filter((c) => c.n > 0);
    if (!chosen.length) return;
    closeModal();
    // Дублирование и есть весь смысл окна: один и тот же код повторяется
    // столько раз, сколько предметов, — лист собирается из этого списка.
    await downloadSelectedQrAsWord(chosen.flatMap(({ item, n }) => Array(n).fill(item)));
  };
}

async function downloadSelectedQrAsWord(items) {
  if (!items || !items.length) return toast('Выберите приборы', true);

  const {
    Document, Packer, Table, TableRow, TableCell, Paragraph, ImageRun, TextRun,
    AlignmentType, BorderStyle, WidthType, PageOrientation, HeightRule, VerticalAlign
  } = docx;

  // Вся арифметика листа — в qr-sheet.js: там же объяснено, почему полей
  // нет, почему шаг обязан быть точным и почему подрезана последняя строка.
  const {
    pageWidth: PAGE_W, pageHeight: PAGE_H, margin: MARGIN, usableWidth: usableW,
    header: HEADER_TW, footer: FOOTER_TW,
    cols: COLS, rows: ROWS, perPage: PER_PAGE,
    colWidth: COL_WIDTH, rowHeight: ROW_HEIGHT, lastRowHeight: LAST_ROW_HEIGHT,
    borderSize: BORDER_SZ, tailTwips: TAIL_TW,
    qrSizePx: QR_SIZE_PX, cellTopPad: CELL_TOP_PAD,
  } = sheetGeometry();

  const red = { style: BorderStyle.SINGLE, size: BORDER_SZ, color: 'FF0000' };
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
      // Код прижат к ВЕРХУ строки и отодвинут вниз на постоянный отступ.
      // Не по центру ячейки: у последней строки низ подрезан, и при
      // центровке код в нижнем ряду поехал бы вверх относительно наклейки.
      // Верх строки — это верх наклейки, и от него считать надёжно.
      verticalAlign: VerticalAlign.TOP,
      borders: { top: red, bottom: red, left: leftBorder, right: rightBorder },
      margins: { top: CELL_TOP_PAD, bottom: 0, left: 50, right: 50 },
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
    // Таблица одна на весь файл, даже если страниц несколько. Раньше на
    // каждую страницу делалась своя, а между ними ставился разрыв страницы —
    // теперь строки заполняют лист целиком, и абзац с разрывом сам не влезал
    // бы: он уезжал на следующий лист и утаскивал разрыв за собой, оставляя
    // пустые страницы. Строка, которой не хватило места, и так переходит на
    // новый лист — этого достаточно.
    const pages = Math.max(1, Math.ceil(items.length / PER_PAGE));
    const rows = [];
    for (let page = 0; page < pages; page++) {
      const pageItems = items.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
      for (let r = 0; r < ROWS; r++) {
        const cells = [];
        for (let c = 0; c < COLS; c++) {
          cells.push(await buildCell(pageItems[r * COLS + c] || null, c));
        }
        rows.push(new TableRow({
          children: cells,
          cantSplit: true,
          height: {
            value: r === ROWS - 1 ? LAST_ROW_HEIGHT : ROW_HEIGHT,
            rule: HeightRule.EXACT,
          },
        }));
      }
    }
    const children = [
      new Table({
        rows,
        width: { size: usableW, type: WidthType.DXA },
        columnWidths: Array(COLS).fill(COL_WIDTH),
      }),
      // Абзац после таблицы обязателен по формату документа. Обычный съел бы
      // полсантиметра и утащил последнюю строку на новый лист — поэтому он
      // здесь микроскопический.
      new Paragraph({ spacing: { before: 0, after: 0, line: TAIL_TW, lineRule: 'exact' } }),
    ];

    const wordDoc = new Document({
      sections: [{
        properties: {
          page: {
            size: { orientation: PageOrientation.PORTRAIT, width: PAGE_W, height: PAGE_H },
            // header и footer — обязательно: без них библиотека ставит свои
            // 1,25 см, Word держит под колонтитулы место, и на лист влезает
            // ТРИ ряда вместо четырёх. Именно из-за этого таблица разъезжалась.
            margin: {
              top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN,
              header: HEADER_TW, footer: FOOTER_TW,
            },
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
