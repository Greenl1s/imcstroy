import { api } from './api.js';
import { escapeHtml } from './utils.js';

let filter = 'all';
let revision = 0;
const dateTime = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});
function stamp(moment, fallback) {
  if (moment && !Number.isNaN(Date.parse(moment))) return escapeHtml(dateTime.format(new Date(moment)));
  if (fallback) {
    const [y,m,d] = String(fallback).slice(0,10).split('-');
    return `${escapeHtml(`${d}.${m}.${y}`)}<small>Время не сохранено</small>`;
  }
  return 'Не сохранено';
}

export function loanRow(item) {
  const remaining = Number(item.remaining);
  const quantity = Number(item.quantity);
  const active = remaining > 0;
  const caption = active ? `В работе${quantity > 1 ? ` · ${remaining} из ${quantity} шт.` : ''}` : 'Возвращён';
  const cardId = String(item.instrument_id || '');
  const hasCard = /^[1-9]\d*$/.test(cardId);
  return `<tr>
    <td data-label="Прибор"${hasCard ? ' class="loan-instrument-cell"' : ''}>${hasCard ? `<a class="loan-instrument-link" href="?id=${encodeURIComponent(cardId)}" aria-label="Открыть карточку: ${escapeHtml(item.instrument_name)}">` : ''}<b>${escapeHtml(item.instrument_name)}</b>
      <small>${[item.inventory_no, item.model, item.serial_number ? `с/н ${item.serial_number}` : ''].filter(Boolean).map(escapeHtml).join(' · ')}</small>
      ${quantity > 1 ? `<small>Выдано ${quantity} шт. · возвращено ${quantity-remaining} шт.</small>` : ''}${hasCard ? '</a>' : ''}</td>
    <td data-label="Сотрудник">${escapeHtml(item.holder_name)}${item.issued_to_name && item.issued_to_name !== item.holder_name ? `<small>Брал: ${escapeHtml(item.issued_to_name)}</small>` : ''}</td>
    <td data-label="Проект">${escapeHtml(item.project_name || 'Без привязки к проекту')}</td>
    <td data-label="Место использования">${escapeHtml(item.place || 'Не указано')}</td>
    <td data-label="Выдан">${stamp(item.issued_at, item.issue_date)}</td>
    <td data-label="Возвращён">${active
      ? (item.last_returned_at ? `${stamp(item.last_returned_at)}<small>Частичный возврат; осталось ${remaining} шт.</small>` : '<span class="loan-muted">Ещё не возвращён</span>')
      : stamp(item.returned_at)}</td>
    <td data-label="Состояние"><span class="loan-status ${active ? 'is-active' : 'is-returned'}">${caption}</span></td>
  </tr>`;
}

export async function renderStatistics() {
  const current = ++revision;
  const screen = document.getElementById('statisticsScreen');
  screen.innerHTML = `<div class="loan-panel">
    <div class="loan-heading"><div><h2>Выдача и возврат приборов</h2><p>История с 07.10.2026 и все приборы на руках. Время по Москве.</p></div><button type="button" data-loan-refresh>Обновить</button></div>
    <div class="loan-filters" role="group" aria-label="Состояние выдач">
      <button type="button" data-loan-filter="all">Все</button>
      <button type="button" data-loan-filter="active">В работе</button>
      <button type="button" data-loan-filter="returned">Возвращённые</button>
    </div>
    <div class="loan-results" aria-live="polite">Загружаем статистику…</div>
    <p class="loan-footnote">Одна строка — одна выдача. Повторные выдачи показываются отдельно. У старых записей время может отсутствовать.</p>
  </div>`;
  const buttons = [...screen.querySelectorAll('[data-loan-filter]')];
  for (const button of buttons) {
    const selected = button.dataset.loanFilter === filter;
    button.classList.toggle('is-selected',selected);
    button.setAttribute('aria-pressed',String(selected));
    button.onclick = () => { filter = button.dataset.loanFilter; renderStatistics(); };
  }
  screen.querySelector('[data-loan-refresh]').onclick = renderStatistics;
  const results = screen.querySelector('.loan-results');
  results.addEventListener('click', event => {
    const link = event.target.closest?.('.loan-instrument-link');
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    history.pushState(null, '', link.getAttribute('href'));
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  let items = [];
  async function load(before = '') {
    try {
      const data = await api.loanStatistics(filter,before);
      if (current !== revision || screen.classList.contains('hidden')) return;
      items = before ? items.concat(data.items) : data.items;
      const totals = data.counts || {};
      const countKey = {all:'total',active:'active',returned:'returned'};
      const labels = {all:'Все',active:'В работе',returned:'Возвращённые'};
      for (const button of buttons) {
        const key=button.dataset.loanFilter;
        button.textContent = `${labels[key]} (${totals[countKey[key]] || 0})`;
      }
      results.innerHTML = items.length ? `<div class="loan-table-scroll"><table class="loan-table">
        <thead><tr><th>Прибор</th><th>Сотрудник</th><th>Проект</th><th>Место использования</th><th>Выдан: дата и время</th><th>Возвращён: дата и время</th><th>Состояние</th></tr></thead>
        <tbody>${items.map(loanRow).join('')}</tbody></table></div>`
        : `<div class="loan-empty">${filter==='active' ? 'Приборов в работе нет' : filter==='returned' ? 'Возвращённых выдач пока нет' : 'Выдач пока нет'}</div>`;
      if (data.next) {
        const more=document.createElement('button');more.type='button';more.className='loan-more';more.textContent='Показать ещё';
        more.onclick=async()=>{more.disabled=true;await load(data.next);};results.appendChild(more);
      }
    } catch (err) {
      if(current !== revision) return;
      if (!items.length) results.innerHTML=`<div class="loan-empty">Не удалось загрузить статистику: ${escapeHtml(err.message)}</div>`;
      else { const more=results.querySelector('.loan-more');if(more){more.disabled=false;more.textContent='Повторить загрузку';} }
    }
  }
  await load();
}
