import { api } from './api.js';
import { state, refresh, isAdmin } from './state.js';
import { escapeHtml, formData } from './utils.js';
import { closeModal, input, openModal, select, toast, run } from './ui.js';

/**
 * Роль пользователя приходит с сервера и хранится в подписанном токене.
 * Подставить себе role: 'admin' через консоль браузера больше нельзя:
 * сервер проверяет подпись токена при каждом запросе.
 */

export async function showUsersManager() {
  if (!isAdmin()) return toast('Доступ только для администратора', true);

  const rows = state.users.map((u) => `
    <div class="row panel">
      <div>
        <div class="row-title">${escapeHtml(u.username)}</div>
        <div class="row-subtitle">
          ${u.role === 'admin' ? 'Администратор' : 'Пользователь'}${u.extra ? ' · ' + escapeHtml(u.extra) : ''}
        </div>
      </div>
      <div class="badges">
        <button class="secondary" data-edit-user="${u.id}">Изменить</button>
        <button class="danger" data-delete-user="${u.id}">Удалить</button>
      </div>
    </div>`).join('');

  openModal('Пользователи', `
    <div class="form-grid">
      <button class="primary" data-add-user>Добавить пользователя</button>
      ${rows}
    </div>`);

  document.querySelector('[data-add-user]').onclick = () => showUserForm(null);

  document.querySelectorAll('[data-edit-user]').forEach((node) => {
    node.onclick = () => showUserForm(state.users.find((u) => String(u.id) === node.dataset.editUser));
  });

  document.querySelectorAll('[data-delete-user]').forEach((node) => {
    node.onclick = async (event) => {
      const user = state.users.find((u) => String(u.id) === node.dataset.deleteUser);
      if (!confirm(`Удалить пользователя «${user.username}»?`)) return;
      const result = await run(() => api.deleteUser(user.id), {
        button: event.currentTarget,
        success: 'Пользователь удалён'
      });
      if (result === null) return;
      await refresh();
      showUsersManager();
    };
  });
}

/**
 * Форма пользователя.
 *  - Администратор редактирует любого.
 *  - Обычный пользователь открывает её как «Профиль» и может поменять
 *    только свой пароль и доп. информацию (сервер это тоже проверяет).
 */
export function showUserForm(user = null) {
  const admin = isAdmin();
  const isSelf = user && state.currentUser && user.id === state.currentUser.id;
  const isEdit = Boolean(user);

  openModal(isEdit ? (isSelf ? 'Профиль' : 'Изменить пользователя') : 'Добавить пользователя', `
    <form id="userForm" class="form-grid">
      ${admin
        ? input('username', 'Логин', user?.username || '', 'text', !isEdit)
        : `<div class="field"><div class="field-label">Логин</div>
           <div class="field-value">${escapeHtml(user?.username || '')}</div></div>`}
      ${input('password', isEdit ? 'Новый пароль (оставьте пустым, чтобы не менять)' : 'Пароль',
              '', 'password', !isEdit)}
      ${admin && !isSelf
        ? select('role', 'Роль', user?.role || 'employee',
                 [['employee', 'Пользователь'], ['admin', 'Администратор']])
        : ''}
      ${input('extra', 'Доп. информация (телефон, email)', user?.extra || '')}
      <div class="modal-actions"><button class="primary" type="submit">Сохранить</button></div>
    </form>`);

  document.getElementById('userForm').onsubmit = async (event) => {
    event.preventDefault();
    const button = event.target.querySelector('button[type="submit"]');
    const data = formData(event.target);
    if (!data.password) delete data.password; // пустое поле = пароль не меняем

    const result = await run(async () => {
      if (!isEdit) return api.createUser(data);
      if (isSelf && !admin) return api.updateMe({ password: data.password, extra: data.extra });
      return api.updateUser(user.id, data);
    }, { button, success: 'Сохранено' });

    if (result === null) return;

    if (isSelf) {
      state.currentUser = { ...state.currentUser, ...result };
      document.getElementById('currentUserBadge').textContent = badgeText();
    }

    closeModal();
    await refresh();
    if (admin && !isSelf) showUsersManager();
  };
}

export function badgeText() {
  const user = state.currentUser;
  if (!user) return '';
  return user.role === 'admin' ? `${user.username} · администратор` : user.username;
}
