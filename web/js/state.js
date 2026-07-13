import { api } from './api.js';

export const state = {
  instruments: [],   // все, кроме списанных
  users: [],
  currentUser: null,

  // фильтры
  search: '',
  verification: 'all',
  condition: 'all',
  userFilter: 'all',
  massMode: false
};

/**
 * Перезагружает данные с сервера и сообщает интерфейсу, что надо перерисоваться.
 *
 * Раньше приложение правило массив в памяти браузера и потом выгружало его
 * целиком обратно в базу. Теперь наоборот: изменение делает сервер, а браузер
 * просто заново спрашивает актуальное состояние. Поэтому чужие изменения
 * видны сразу и ничего не затирается.
 */
export async function refresh() {
  const [instruments, users] = await Promise.all([
    api.listInstruments(),
    api.listUsers()
  ]);
  state.instruments = instruments;
  state.users = users;
  window.dispatchEvent(new Event('app:changed'));
}

export const isAdmin = () => state.currentUser?.role === 'admin';

export const userName = (id) =>
  state.users.find((u) => u.id === id)?.username || '';
