import { api } from './api.js';
import { state, refresh, isAdmin } from './state.js';
import { escapeHtml, getControlTypes, setControlTypes, getCompanies, setCompanies } from './utils.js';
import { openModal, closeModal, toast, setSync, run } from './ui.js';
import { badgeText, showUserForm, showUsersManager } from './auth.js';
import { renderCard, renderList, showInstrumentForm, FILEMANAGER_ORIGIN, showPendingTransfersModal, showControlTypesManager, showCompaniesManager } from './instruments.js';
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

  document.getElementById('searchInput').oninput = (e) => setFilter('search', e.target.value);
  document.getElementById('verificationFilter').onchange = (e) => setFilter('verification', e.target.value);
  document.getElementById('conditionFilter').onchange = (e) => setFilter('condition', e.target.value);
  document.getElementById('controlTypeFilter').onchange = (e) => setFilter('controlType', e.target.value);
  document.getElementById('companyFilter').onchange = (e) => setFilter('company', e.target.value);

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
  document.getElementById('massConfirmBookingBtn').onclick = (e) => {
    closeMassActionsMenu();
    bulkSimple(e.currentTarget, 'confirm-booking');
  };
  document.getElementById('massCancelBookingBtn').onclick = (e) => {
    closeMassActionsMenu();
    bulkSimple(e.currentTarget, 'cancel-booking');
  };
  document.getElementById('massTransferBtn').onclick = () => {
    closeMassActionsMenu();
    showBulkTransferForm();
  };

  document.getElementById('massQrWordBtn').onclick = () => {
    closeMassActionsMenu();
    downloadSelectedQrAsWord();
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

/* ---------- Массовая выгрузка QR-кодов в ИСУ ---------- */

const QR_EXPORT_PATH = '/База данных/Оборудование/QR-код';

// Убирает символы, недопустимые в имени файла на большинстве ОС.
function sanitizeFilename(name) {
  return String(name).replace(/[\\/:*?"<>|]/g, '-').trim() || 'без_названия';
}

// Строит PNG того же QR-кода, что показывает кнопка "QR" на карточке
// (тот же URL, та же библиотека) — просто в скрытом контейнере, без модалки.
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
 * Удаляет всё, что сейчас лежит в папке QR-кодов, перед новой выгрузкой —
 * иначе там годами копились бы QR-коды переименованных или удалённых
 * приборов. Если папки ещё вообще нет (самый первый запуск) — просто
 * ничего не делаем, удалять нечего.
 */
async function clearQrFolder() {
  let listing;
  try {
    const res = await fetch(`${FILEMANAGER_ORIGIN}/api/resources?path=${encodeURIComponent(QR_EXPORT_PATH)}`, {
      credentials: 'include',
    });
    if (!res.ok) return; // папки ещё нет — нечего чистить
    listing = await res.json();
  } catch {
    return; // ИСУ недоступна — не блокируем сам экспорт из-за этого
  }

  const entries = [...(listing.folders || []), ...(listing.files || [])];
  await Promise.all(
    entries.map((entry) => {
      const fullPath = `${QR_EXPORT_PATH}/${entry.name}`;
      return fetch(`${FILEMANAGER_ORIGIN}/api/resources?path=${encodeURIComponent(fullPath)}`, {
        method: 'DELETE',
        credentials: 'include',
      }).catch(() => {});
    })
  );
}

async function exportAllQrCodes() {
  const items = state.instruments || [];
  if (!items.length) return toast('Нет приборов для выгрузки', true);
  if (!confirm(
    `Выгрузить QR-коды всех приборов (${items.length}) в ИСУ?\n\n` +
    'Всё, что сейчас лежит в «База данных/Оборудование/QR-код», будет удалено и заменено новыми файлами.'
  )) return;

  await clearQrFolder();

  let success = 0;
  const failed = [];

  for (const item of items) {
    try {
      const blob = await renderQrPng(item);
      const filename = `${sanitizeFilename(item.name)}.png`;
      const form = new FormData();
      form.append('path', QR_EXPORT_PATH);
      form.append('file', blob, filename);

      const res = await fetch(`${FILEMANAGER_ORIGIN}/api/upload`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      success++;
    } catch (err) {
      failed.push({ name: item.name, message: err.message });
    }
  }

  if (failed.length === 0) {
    toast(`Готово: ${success} QR-код(ов) выгружено в ИСУ`);
  } else {
    const details = failed.map((f) => `${f.name} (${f.message})`).join('; ');
    toast(`Выгружено: ${success}. Не удалось: ${failed.length} — ${details}`, true);
  }
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
}
