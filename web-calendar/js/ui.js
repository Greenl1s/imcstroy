import { escapeHtml } from './utils.js';

let toastTimer = null;

export function toast(text, bad = false) {
  const node = document.getElementById('toast');
  node.textContent = text;
  node.className = `toast${bad ? ' bad' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.add('hidden'), 3200);
}

export function openModal(title, html) {
  const modal = document.getElementById('modal');
  modal.innerHTML = `
    <div class="modal-head">
      <h2>${escapeHtml(title)}</h2>
      <button class="ghost" data-close type="button">Закрыть</button>
    </div>
    ${html}`;
  if (!modal.open) modal.showModal();
  modal.querySelectorAll('[data-close]').forEach((b) => (b.onclick = closeModal));
  return modal;
}

export function closeModal() {
  const modal = document.getElementById('modal');
  if (modal.open) modal.close();
}

/**
 * Оборачивает действие: ошибка сервера показывается человеку, а не
 * уходит в консоль, и кнопка не даёт нажать себя дважды.
 * Возвращает null, если не вышло — вызывающему остаётся просто выйти.
 */
export async function run(action, { button, success } = {}) {
  const label = button?.innerHTML;
  if (button) { button.disabled = true; button.textContent = '...'; }
  try {
    const result = await action();
    if (success) toast(success);
    return result;
  } catch (err) {
    toast(err.message || 'Не получилось', true);
    if (err.status === 401) setTimeout(() => location.reload(), 1200);
    return null;
  } finally {
    if (button) { button.disabled = false; button.innerHTML = label; }
  }
}
