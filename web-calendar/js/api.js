const BASE = window.API_BASE || '/calendar/api/calendar';

// Токен в sessionStorage нужен стенду и проверкам: на боевом сервере
// браузер сам присылает общую cookie sso_token, и заголовок не нужен.
const token = () => {
  try { return sessionStorage.getItem('token'); } catch { return null; }
};

/** Ошибка с телом ответа: конфликт занятости приходит именно так. */
export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data || {};
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;

  const res = await fetch(BASE + path, {
    method, headers,
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let data = null;
  try { data = await res.json(); } catch { /* пустой ответ — это нормально */ }

  if (!res.ok) throw new ApiError(data?.error || 'Сервер не ответил', res.status, data);
  return data;
}

export const api = {
  settings: () => request('/settings'),
  people: () => request('/people'),
  events: (from, to) => request(`/events?from=${from}&to=${to}`),
  create: (data) => request('/events', { method: 'POST', body: data }),
  update: (id, data) => request(`/events/${id}`, { method: 'PATCH', body: data }),
  setDone: (id, done) => request(`/events/${id}/done`, { method: 'POST', body: { done } }),
  remove: (id, series = false) => request(`/events/${id}${series ? '?series=1' : ''}`, { method: 'DELETE' }),
  leave: (id) => request(`/events/${id}/me`, { method: 'DELETE' }),
  busy: (data) => request('/busy', { method: 'POST', body: data }),
};
