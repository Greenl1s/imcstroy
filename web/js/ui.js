import { escapeAttr, escapeHtml } from './utils.js';

export function setSync(text) {
  const node = document.getElementById('syncStatus');
  if (node) node.textContent = text;
}

let toastTimer = null;
export function toast(text, isError = false) {
  const node = document.getElementById('toast');
  node.textContent = text;
  node.classList.toggle('toast-error', isError);
  node.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.add('hidden'), 3200);
}

export function openModal(title, html) {
  const modal = document.getElementById('modal');
  modal.innerHTML = `
    <div class="modal-body">
      <div class="modal-head">
        <h1>${escapeHtml(title)}</h1>
        <button class="secondary" data-close type="button">Закрыть</button>
      </div>
      <div class="modal-content">${html}</div>
    </div>`;
  if (!modal.open) modal.showModal();
  modal.querySelectorAll('[data-close]').forEach((node) => (node.onclick = closeModal));
  return modal;
}

export function closeModal() {
  const modal = document.getElementById('modal');
  if (modal.open) modal.close();
}

export function field(label, value, raw = false) {
  return `<div class="field">
    <div class="field-label">${escapeHtml(label)}</div>
    <div class="field-value">${raw ? value : escapeHtml(value || '—')}</div>
  </div>`;
}

export function input(name, label, value = '', type = 'text', required = false) {
  let attrs = `name="${escapeAttr(name)}" type="${escapeAttr(type)}"`;
  if (type !== 'file' && value) attrs += ` value="${escapeAttr(value)}"`;
  if (required) attrs += ' required';
  return `<label>${escapeHtml(label)}<input ${attrs}></label>`;
}

export function select(name, label, value, options) {
  const items = options.map((o) => (Array.isArray(o) ? o : [o, o]));
  const html = items.map(([val, text]) =>
    `<option value="${escapeAttr(val)}"${String(val) === String(value) ? ' selected' : ''}>${escapeHtml(text)}</option>`
  ).join('');
  return `<label>${escapeHtml(label)}<select name="${escapeAttr(name)}">${html}</select></label>`;
}

/**
 * Оборачивает действие: показывает ошибку сервера человеку, а не в консоль,
 * и блокирует кнопку, пока запрос выполняется (защита от двойного клика).
 */
export async function run(action, { button, success } = {}) {
  const label = button?.textContent;
  if (button) {
    button.disabled = true;
    button.textContent = '...';
  }
  try {
    const result = await action();
    if (success) toast(success);
    return result;
  } catch (err) {
    toast(err.message, true);
    return null;
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = label;
    }
  }
}
