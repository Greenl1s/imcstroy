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

/**
 * Поле «сколько штук»: кнопки − и + рядом с числом.
 *
 * Обычного type="number" мало: набирать цифры ради «взять две штуки»
 * долго, а на телефоне ещё и неудобно — клавиатура закрывает форму.
 * Кнопки работают и без клавиатуры вовсе.
 *
 * Границы (min/max) остаются на самом поле: их читает и браузер при
 * отправке формы, и обработчик кнопок. Второй список границ рядом
 * разошёлся бы с первым в тот же день.
 */
export function qtyInput(name, label, value, { min = 1, max = 999, hint = '' } = {}) {
  return `<label class="qty-label">${escapeHtml(label)}${
    hint ? `<span class="qty-hint">${escapeHtml(hint)}</span>` : ''}
    <span class="qty-box">
      <button class="secondary" type="button" data-qty-step="-1" aria-label="Меньше">−</button>
      <input name="${escapeAttr(name)}" type="number" inputmode="numeric"
             value="${escapeAttr(value)}" min="${escapeAttr(min)}" max="${escapeAttr(max)}">
      <button class="secondary" type="button" data-qty-step="1" aria-label="Больше">+</button>
    </span>
  </label>`;
}

/**
 * Кнопки − и + работают везде, где есть такое поле, — в том числе в
 * строках, нарисованных уже после загрузки страницы. Поэтому один
 * обработчик на документ, а не по обработчику на каждую кнопку.
 */
document.addEventListener('click', (event) => {
  const button = event.target.closest?.('[data-qty-step]');
  if (!button) return;
  const box = button.closest('.qty-box');
  const input = box?.querySelector('input');
  if (!input) return;
  event.preventDefault();
  const min = Number(input.min || 0);
  const max = Number(input.max || 999);
  const next = (Number(input.value) || 0) + Number(button.dataset.qtyStep);
  input.value = Math.max(min, Math.min(max, next));
  // Форма и счётчики слушают именно input — как при наборе руками.
  input.dispatchEvent(new Event('input', { bubbles: true }));
});

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
