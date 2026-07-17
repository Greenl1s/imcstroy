/**
 * Единственное место, через которое приложение общается с сервером.
 * Никаких ключей доступа к базе в браузере больше нет — только токен,
 * выданный сервером после проверки пароля.
 */

const BASE = (window.API_BASE || '/api').replace(/\/$/, '');

let token = sessionStorage.getItem('token') || null;

export function getToken() {
  return token;
}

export function setToken(value) {
  token = value;
  if (value) sessionStorage.setItem('token', value);
  else sessionStorage.removeItem('token');
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(BASE + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new Error('Нет связи с сервером');
  }

  // Токен протух или пользователя удалили — возвращаемся на экран входа
  if (response.status === 401) {
    setToken(null);
    window.dispatchEvent(new Event('app:unauthorized'));
    throw new Error('Сессия истекла, войдите заново');
  }

  if (!response.ok) {
    let message = `Ошибка сервера (${response.status})`;
    try {
      const data = await response.json();
      if (data?.error) message = data.error;
    } catch { /* тело не JSON — оставляем общий текст */ }
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  // ---------- Вход ----------
  async login(username, password) {
    const data = await request('/auth/login', {
      method: 'POST',
      body: { username, password }
    });
    setToken(data.token);
    return data.user;
  },

  logout() {
    setToken(null);
  },

  me: () => request('/auth/me'),
  updateMe: (data) => request('/auth/me', { method: 'PATCH', body: data }),

  // ---------- Пользователи ----------
  listUsers: () => request('/users'),
  createUser: (data) => request('/users', { method: 'POST', body: data }),
  updateUser: (id, data) => request(`/users/${id}`, { method: 'PATCH', body: data }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),

  // ---------- Приборы ----------
  listInstruments: () => request('/instruments'),
  listRetired: () => request('/instruments?status=retired'),
  getInstrument: (id) => request(`/instruments/${id}`),
  createInstrument: (data) => request('/instruments', { method: 'POST', body: data }),
  updateInstrument: (id, data) => request(`/instruments/${id}`, { method: 'PATCH', body: data }),
  deleteInstrument: (id) => request(`/instruments/${id}`, { method: 'DELETE' }),

  // ---------- Операции ----------
  issue: (id, data) => request(`/instruments/${id}/issue`, { method: 'POST', body: data }),
  return: (id) => request(`/instruments/${id}/return`, { method: 'POST', body: {} }),
  transfer: (id, data) => request(`/instruments/${id}/transfer`, { method: 'POST', body: data }),
  book: (id, data) => request(`/instruments/${id}/book`, { method: 'POST', body: data }),
  cancelBooking: (id) => request(`/instruments/${id}/cancel-booking`, { method: 'POST', body: {} }),
  confirmBooking: (id) => request(`/instruments/${id}/confirm-booking`, { method: 'POST', body: {} }),
  retire: (id) => request(`/instruments/${id}/retire`, { method: 'POST', body: {} }),
  restore: (id) => request(`/instruments/${id}/restore`, { method: 'POST', body: {} }),
  bulkRetire: (ids) => request('/instruments/bulk/retire', { method: 'POST', body: { ids } }),
  bulkDelete: (ids) => request('/instruments/bulk/delete', { method: 'POST', body: { ids } }),

  // ---------- История ----------
  instrumentHistory: (id) => request(`/instruments/${id}/history`),

  // ---------- Фото ----------
  uploadPhoto: (id, dataUrl) =>
    request(`/instruments/${id}/photo`, { method: 'PUT', body: { data_url: dataUrl } }),
  deletePhoto: (id) => request(`/instruments/${id}/photo`, { method: 'DELETE' }),

  /**
   * Картинку нельзя вставить в <img src>, потому что к запросу нужно
   * приложить токен. Поэтому скачиваем её и делаем локальную ссылку.
   */
  async photoUrl(id) {
    const response = await fetch(`${BASE}/instruments/${id}/photo`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!response.ok) return null;
    return URL.createObjectURL(await response.blob());
  },

  // ---------- Фото документа (замена ссылки на документ) ----------
  uploadDocument: (id, dataUrl) =>
    request(`/instruments/${id}/document`, { method: 'PUT', body: { data_url: dataUrl } }),
  deleteDocument: (id) => request(`/instruments/${id}/document`, { method: 'DELETE' }),

  async documentUrl(id) {
    const response = await fetch(`${BASE}/instruments/${id}/document`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!response.ok) return null;
    return URL.createObjectURL(await response.blob());
  }
};
