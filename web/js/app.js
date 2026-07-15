import { api, getToken } from './api.js';
import { state, refresh, isAdmin } from './state.js';
import { escapeHtml } from './utils.js';
import { openModal, closeModal, toast, setSync, run } from './ui.js';
import { badgeText, showUserForm, showUsersManager } from './auth.js';
import { renderCard, renderList, showInstrumentForm } from './instruments.js';
import { exportAllInstruments, exportExpiringInstruments } from './export.js';
import { displayNo, verificationBadge, verificationText } from './utils.js';

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

  document.getElementById('massToggleBtn').onclick = () => setMassMode(!state.massMode);
  document.getElementById('massRetireBtn').onclick = (e) => bulk(e.currentTarget, 'retire');
  document.getElementById('massDeleteBtn').onclick = (e) => bulk(e.currentTarget, 'delete');

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
  state.massMode = enabled && isAdmin();
  const display = state.massMode ? 'inline-flex' : 'none';
  document.getElementById('massRetireBtn').style.display = display;
  document.getElementById('massDeleteBtn').style.display = display;
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
          <span class="badge ${verificationBadge(item.valid_until)}">${verificationText(item.valid_until)}</span>
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
