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
  return `<tr>
    <td data-label="Прибор"><b>${escapeHtml(item.instrument_name)}</b>
      <small>${[item.inventory_no, item.model, item.serial_number ? `с/н ${item.serial_number}` : ''].filter(Boolean).map(escapeHtml).join(' · ')}</small>
      ${quantity > 1 ? `<small>Выдано ${quantity} шт. · возвращено ${quantity-remaining} шт.</small>` : ''}</td>
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

const forms = (n, one, few, many) => n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many;
export function durationText(seconds) {
  let minutes = Math.floor(Math.max(0, Number(seconds) || 0) / 60);
  const days = Math.floor(minutes / 1440); minutes %= 1440;
  const hours = Math.floor(minutes / 60); minutes %= 60;
  if (!days && !hours && !minutes) return seconds > 0 ? 'Меньше минуты' : '0 минут';
  return [days ? `${days} ${forms(days,'день','дня','дней')}` : '', hours ? `${hours} ${forms(hours,'час','часа','часов')}` : '', `${minutes} ${forms(minutes,'минута','минуты','минут')}`].filter(Boolean).join(' ');
}

export function instrumentRow(item) {
  const id = escapeHtml(String(item.instrument_id));
  const busy = Number(item.active_count) > 0;
  const caption = busy ? 'В работе' : item.status === 'retired' ? 'Списан' : item.status === 'booked' ? 'В брони' : 'Свободен';
  const projects = Number(item.project_count);
  const time = Number(item.unknown_time_count) && !Number(item.duration_seconds) ? 'Нет точных данных' : durationText(item.duration_seconds);
  return `<tr class="loan-summary-row" data-instrument="${id}">
    <td data-label="Прибор / модель"><a class="loan-card-link" href="?id=${encodeURIComponent(item.instrument_id)}"><b>${escapeHtml(item.instrument_name)}</b></a>
      <small>${[item.inventory_no,item.model,item.serial_number ? `с/н ${item.serial_number}` : ''].filter(Boolean).map(escapeHtml).join(' · ')}</small></td>
    <td data-label="Выдач в проекты"><strong>${Number(item.project_loan_count) || 0}</strong><small>${projects ? `В ${projects} ${forms(projects,'проекте','разных проектах','разных проектах')}` : Number(item.loan_count) ? 'Без привязки к проекту' : 'Не выдавался'}</small></td>
    <td data-label="Общее время в работе"><b>${time}</b>${Number(item.unknown_time_count) && Number(item.duration_seconds) ? '<small>Без выдач с неизвестным временем</small>' : ''}</td>
    <td data-label="Сейчас"><span class="loan-status ${busy ? 'is-active' : item.status === 'retired' || item.status === 'booked' ? 'is-neutral' : 'is-returned'}">${caption}</span>${Number(item.active_quantity)>1 ? `<small>На руках: ${Number(item.active_quantity)} шт.</small>` : ''}</td>
    <td class="loan-expand-cell"><button class="loan-expand" type="button" aria-expanded="false" aria-controls="loan-detail-${id}" aria-label="История выдач: ${escapeHtml(item.instrument_name)}">⌄</button></td>
  </tr><tr class="loan-detail-row" hidden><td colspan="5"><div id="loan-detail-${id}" class="loan-detail"></div></td></tr>`;
}

const historyTable = items => `<div class="loan-table-scroll"><table class="loan-table loan-history-table">
  <thead><tr><th>Прибор / модель</th><th>Сотрудник</th><th>Проект</th><th>Место использования</th><th>Выдан: дата и время</th><th>Возвращён: дата и время</th><th>Состояние</th></tr></thead>
  <tbody>${items.map(loanRow).join('')}</tbody></table></div>`;

export async function renderStatistics() {
  const current = ++revision;
  const screen = document.getElementById('statisticsScreen');
  screen.innerHTML = `<div class="loan-panel">
    <div class="loan-heading"><div><h2>Статистика оборудования</h2><p>История с 07.10.2026 и все приборы на руках. Время по Москве.</p></div><button type="button" data-loan-refresh>Обновить</button></div>
    <div class="loan-filters" role="group" aria-label="Список приборов">
      <button type="button" data-loan-filter="all">Все приборы</button>
      <button type="button" data-loan-filter="active">В работе</button>
    </div>
    <div class="loan-results" aria-live="polite">Загружаем статистику…</div>
    <p class="loan-footnote">Название открывает карточку, остальная часть строки — историю. Общее время — сумма длительности отдельных выдач, включая текущие; количество штук её не умножает. У старых записей время может отсутствовать.</p>
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
  const details = new Map();
  const selectedFilter = filter;
  async function loadDetail(row, before = '') {
    const id = row.dataset.instrument;
    const detail = row.nextElementSibling.querySelector('.loan-detail');
    const state = details.get(id) || {items:[],next:null,loaded:false,loading:false};
    if (state.loading) return;
    state.loading=true; details.set(id,state);
    if (!before) detail.innerHTML='<div class="loan-empty">Загружаем историю…</div>';
    const more = detail.querySelector('[data-loan-more]'); if(more) more.disabled=true;
    try {
      const data = await api.loanStatistics(selectedFilter,before,id);
      if (current !== revision) return;
      state.items = before ? state.items.concat(data.items) : data.items;
      state.next=data.next;state.loaded=true;
      detail.innerHTML=`<p class="loan-detail-title">${selectedFilter === 'active' ? 'Текущие выдачи' : 'История выдач'} · ${escapeHtml(row.querySelector('.loan-card-link').textContent)}</p>`+
        (state.items.length ? historyTable(state.items) : '<div class="loan-empty">Выдач за этот период нет</div>')+
        (state.next ? '<button type="button" class="loan-more" data-loan-more>Показать ещё</button>' : '');
    } catch(err) {
      if(current !== revision) return;
      const error = `<p class="loan-detail-error">Не удалось загрузить историю: ${escapeHtml(err.message)}</p>`;
      detail.innerHTML=(state.items.length ? historyTable(state.items) : '')+error+'<button type="button" class="loan-more" data-loan-retry>Повторить загрузку</button>';
    } finally { state.loading=false; }
  }
  results.addEventListener('click', event => {
    const link = event.target.closest?.('.loan-card-link');
    if(link) {
      if(event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); history.pushState(null,'',link.getAttribute('href'));
      window.dispatchEvent(new PopStateEvent('popstate')); return;
    }
    const more = event.target.closest?.('[data-loan-more], [data-loan-retry]');
    if(more) {
      const row=more.closest('.loan-detail-row').previousElementSibling;
      loadDetail(row,details.get(row.dataset.instrument)?.next || '');return;
    }
    const row = event.target.closest?.('.loan-summary-row');
    if(!row || event.button !== 0) return;
    const expanded=row.classList.toggle('is-expanded');
    row.nextElementSibling.hidden=!expanded;
    const button=row.querySelector('.loan-expand');button.setAttribute('aria-expanded',String(expanded));button.textContent=expanded?'⌃':'⌄';
    if(expanded && !details.get(row.dataset.instrument)?.loaded) loadDetail(row);
  });
  async function load() {
    try {
      const data = await api.loanInstruments(selectedFilter);
      if (current !== revision || screen.classList.contains('hidden')) return;
      const totals = data.counts || {};
      const countKey = {all:'total',active:'active'};
      const labels = {all:'Все приборы',active:'В работе'};
      for (const button of buttons) {
        const key=button.dataset.loanFilter;
        button.textContent = `${labels[key]} (${totals[countKey[key]] || 0})`;
      }
      results.innerHTML = data.items.length ? `<table class="loan-table loan-summary-table"><thead><tr><th>Прибор / модель</th><th>Выдач в проекты</th><th>Общее время в работе</th><th>Сейчас</th><th></th></tr></thead><tbody>${data.items.map(instrumentRow).join('')}</tbody></table>`
        : `<div class="loan-empty">${selectedFilter==='active' ? 'Приборов в работе нет' : 'Приборов пока нет'}</div>`;
    } catch (err) {
      if(current !== revision) return;
      results.innerHTML=`<div class="loan-empty">Не удалось загрузить статистику: ${escapeHtml(err.message)}</div>`;
    }
  }
  await load();
}
