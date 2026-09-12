import { api } from './api.js';
import { state, refresh, isAdmin } from './state.js';
import { openModal, closeModal, toast, run } from './ui.js';
import {
  escapeHtml, escapeAttr, displayNo, today,
  controlTypeShort, controlTypeFull, controlTypeBadge
} from './utils.js';

/**
 * Комплекты приборов.
 *
 * Комплект — сохранённый список приборов, который берётся одной кнопкой.
 * Это шаблон, а не коробка: приборы остаются в общем списке и берутся
 * поштучно как обычно. Один прибор может входить в сколько угодно
 * комплектов; физически он один, поэтому взятый в одном комплекте
 * в остальных покажется занятым.
 *
 * Про состояние: здесь нигде не хранится, «выдан» ли комплект. Каждое
 * открытие спрашивает сервер заново, и сервер считает состояние из
 * статусов приборов. Иначе список неизбежно разошёлся бы с жизнью —
 * прибор можно вернуть поштучно, мимо комплекта.
 */

// ---------- Список комплектов ----------

export async function renderKits(openKit) {
  const node = document.getElementById('kitsScreen');
  node.innerHTML = '<div class="kits-loading">Загружаем комплекты…</div>';

  let list;
  try {
    list = await api.listKits();
  } catch (err) {
    node.innerHTML = `<div class="empty-state"><div class="empty-title">Не удалось загрузить комплекты</div>
      <div class="empty-text">${escapeHtml(err.message)}</div></div>`;
    return;
  }

  node.innerHTML = `
    <div class="kits-head">
      <button class="secondary" type="button" data-kits-back>← К приборам</button>
      <h2>Комплекты</h2>
      <span class="kits-count">${list.length ? `${list.length} шт.` : ''}</span>
      <span class="spacer"></span>
      <button class="primary" type="button" data-kit-new>Собрать комплект</button>
    </div>
    <div class="list kits-list">${
      list.length ? list.map(kitRowHtml).join('') : emptyKitsHtml()
    }</div>`;

  node.querySelector('[data-kits-back]').onclick = () => {
    window.dispatchEvent(new Event('app:go-list'));
  };
  node.querySelectorAll('[data-kit-new]').forEach((b) => (b.onclick = () => showKitForm()));
  node.querySelectorAll('[data-open-kit]').forEach((a) => {
    a.onclick = (event) => {
      event.preventDefault();
      openKit(a.dataset.openKit);
    };
  });
}

/**
 * Строка комплекта. Показываем не «сколько приборов внутри», а что
 * с ними прямо сейчас: комплект, у которого половина на руках,
 * взять нельзя, и человек должен видеть это до того, как нажмёт.
 */
function kitRowHtml(kit) {
  return `
    <div class="row kit-row">
      <a class="row-main" href="?kit=${escapeAttr(kit.id)}" data-open-kit="${escapeAttr(kit.id)}">
        <span class="row-title">${escapeHtml(kit.name)}<i>${kit.total} ${plural(kit.total, 'прибор', 'прибора', 'приборов')}</i></span>
        <span class="row-subtitle">${escapeHtml(kit.description || 'без описания')}${
          kit.created_by_name ? ` · собрал ${escapeHtml(kit.created_by_name)}` : ''
        }</span>
      </a>
      <div class="row-cols kit-cols">${kitStateHtml(kit)}</div>
      <div class="row-act">
        <button class="primary" type="button" data-open-kit="${escapeAttr(kit.id)}">Открыть</button>
      </div>
    </div>`;
}

/** Бейджи состояния комплекта. Пустой комплект — тоже честное состояние. */
function kitStateHtml(kit) {
  if (!kit.total) return '<span class="badge muted">пустой</span>';

  const chips = [];
  const out = kit.busy_count + kit.booked_count + kit.retired_count;
  if (!out) chips.push('<span class="badge ok">весь на месте</span>');
  else if (kit.busy_count) chips.push(`<span class="badge warn">${kit.busy_count} из ${kit.total} на руках</span>`);
  if (kit.booked_count) chips.push(`<span class="badge warn">${kit.booked_count} в брони</span>`);
  if (kit.retired_count) chips.push(`<span class="badge muted">${kit.retired_count} списано</span>`);
  if (kit.check_problem_count) {
    chips.push(`<span class="badge bad">${kit.check_problem_count} без поверки</span>`);
  }
  return chips.join(' ');
}

function emptyKitsHtml() {
  return `<div class="empty-state">
    <div class="empty-title">Комплектов пока нет</div>
    <div class="empty-text">Комплект — это сохранённый список приборов, которые обычно едут вместе.
      Собрал один раз — дальше берёшь одной кнопкой, не выбирая каждый прибор заново.</div>
    <div class="empty-actions"><button class="primary" type="button" data-kit-new>Собрать комплект</button></div>
  </div>`;
}

// ---------- Карточка комплекта = проверка перед выездом ----------

/**
 * Главный экран функции. Это не форма выдачи, а состояние комплекта
 * на сейчас: что можно взять, что занято и у кого, где просрочена
 * поверка. Решает человек — мы только показываем.
 *
 * Галочки расставляет сервер (поле takeable). Снятая галочка действует
 * ровно на этот выезд: состав комплекта она не меняет, в следующий раз
 * прибор снова будет в списке. Убрать прибор насовсем — отдельная
 * кнопка ниже, в блоке «Состав».
 */
export async function renderKitCard(id, goKits) {
  const node = document.getElementById('kitsScreen');
  node.innerHTML = '<div class="kits-loading">Загружаем комплект…</div>';

  let kit;
  try {
    kit = await api.getKit(id);
  } catch (err) {
    node.innerHTML = `<div class="empty-state"><div class="empty-title">Комплект не открылся</div>
      <div class="empty-text">${escapeHtml(err.message)}</div>
      <div class="empty-actions"><button class="secondary" type="button" data-kits-back>К списку комплектов</button></div>
    </div>`;
    node.querySelector('[data-kits-back]').onclick = goKits;
    return;
  }

  const items = kit.items || [];
  const takeable = items.filter((i) => i.takeable);
  const mine = items.filter((i) => i.status === 'busy' && i.taken_by === state.currentUser?.id);
  const anyBusy = items.some((i) => i.status === 'busy');
  const canReturn = isAdmin() ? anyBusy : mine.length > 0;

  node.innerHTML = `
    <div class="kit-card panel">
      <div class="kit-card-head">
        <button class="secondary" type="button" data-kits-back>← Комплекты</button>
        <div class="kit-card-title">
          <h2>${escapeHtml(kit.name)}</h2>
          <p>${escapeHtml(kit.description || 'без описания')}${
            kit.created_by_name ? ` · собрал ${escapeHtml(kit.created_by_name)}` : ''
          }</p>
        </div>
        <span class="spacer"></span>
        <button class="secondary" type="button" data-kit-rename>Переименовать</button>
        <button class="secondary" type="button" data-kit-copy>Дублировать</button>
        <button class="danger" type="button" data-kit-delete>Удалить комплект</button>
      </div>

      ${items.length ? `
        <div class="kit-summary">${preflightSummary(items)}</div>
        <div class="kit-items">${items.map(preflightRowHtml).join('')}</div>

        <div class="kit-foot">
          <div class="kit-form">
            <label>Место использования<input id="kitWhere"></label>
            <label>Доп. данные<input id="kitExtra" value="${escapeAttr(state.currentUser?.extra || '')}"></label>
            <label>Дата<input id="kitDate" type="date" value="${today()}"></label>
          </div>
          <div class="kit-actions">
            <span class="kit-hint" id="kitHint"></span>
            <button class="secondary" type="button" data-kit-add>Добавить приборы</button>
            ${canReturn ? '<button class="secondary" type="button" data-kit-return>Вернуть комплект</button>' : ''}
            <button class="primary" type="button" data-kit-issue ${takeable.length ? '' : 'disabled'}>Взять</button>
          </div>
        </div>
      ` : `
        <div class="empty-state">
          <div class="empty-title">В комплекте пока нет приборов</div>
          <div class="empty-text">Добавьте те, что обычно едут вместе — дальше комплект будет браться одной кнопкой.</div>
          <div class="empty-actions"><button class="primary" type="button" data-kit-add>Добавить приборы</button></div>
        </div>
      `}
    </div>`;

  bindKitCard(node, kit, goKits);
  updateKitHint();
}

/** Строка сводки над списком: сколько берём, сколько занято, где проблемы. */
function preflightSummary(items) {
  const chips = [];
  const takeable = items.filter((i) => i.takeable).length;
  const blocked = items.filter((i) => i.blocked).length;
  const warned = items.filter((i) => i.takeable && i.warning).length;

  chips.push(`<span class="chip ok">${takeable} можно взять</span>`);
  if (blocked) chips.push(`<span class="chip">${blocked} ${plural(blocked, 'недоступен', 'недоступно', 'недоступно')}</span>`);
  if (warned) chips.push(`<span class="chip warn">${warned} с вопросами по поверке</span>`);
  return chips.join('');
}

/**
 * Одна строка проверки. Занятый прибор — галочка снята и заблокирована:
 * он физически у другого человека, тут решать нечего. Просроченная
 * поверка — галочка стоит, но помечена: это предупреждение, не запрет.
 */
function preflightRowHtml(item) {
  const cls = item.takeable ? (item.warning ? 'kit-item is-warn' : 'kit-item') : 'kit-item is-off';
  const why = item.blocked
    ? `<span class="kit-why bad">${escapeHtml(item.blocked)}</span>`
    : item.warning
      ? `<span class="kit-why warn">${escapeHtml(item.warning)}</span>`
      : `<span class="kit-why">Свободен${item.valid_until ? ` · поверка до ${escapeHtml(item.valid_until)}` : ''}</span>`;

  return `
    <label class="${cls}">
      <input type="checkbox" class="kit-checkbox" value="${escapeAttr(item.id)}"
             ${item.takeable ? 'checked' : 'disabled'}>
      <span class="kit-item-main">
        <span class="kit-item-title">${escapeHtml(item.name)}<i>${escapeHtml(displayNo(item))}</i></span>
        ${why}
      </span>
      <span class="kit-item-badge">
        <span class="badge ${controlTypeBadge(item.control_type)}"
              title="${escapeAttr(controlTypeFull(item.control_type))}">${escapeHtml(controlTypeShort(item.control_type))}</span>
      </span>
      <span class="kit-item-act">
        <button class="secondary" type="button" data-kit-remove="${escapeAttr(item.id)}"
                title="Убрать из состава комплекта насовсем">Убрать</button>
      </span>
    </label>`;
}

function selectedKitIds() {
  return Array.from(document.querySelectorAll('.kit-checkbox:checked')).map((cb) => Number(cb.value));
}

/** Подпись у кнопки «Взять» — число всегда перед глазами, а не в голове. */
function updateKitHint() {
  const hint = document.getElementById('kitHint');
  const button = document.querySelector('[data-kit-issue]');
  if (!hint || !button) return;
  const n = selectedKitIds().length;
  hint.textContent = n ? `Отмечено ${n} — в журнал уйдёт ${n} ${plural(n, 'запись', 'записи', 'записей')}` : 'Ничего не отмечено';
  button.textContent = n ? `Взять ${n}` : 'Взять';
  button.disabled = n === 0;
}

function bindKitCard(node, kit, goKits) {
  node.querySelectorAll('[data-kits-back]').forEach((b) => (b.onclick = goKits));
  node.querySelectorAll('.kit-checkbox').forEach((cb) => (cb.onchange = updateKitHint));

  const rename = node.querySelector('[data-kit-rename]');
  if (rename) rename.onclick = () => showKitForm(kit);

  const del = node.querySelector('[data-kit-delete]');
  if (del) del.onclick = () => confirmDeleteKit(kit, goKits);

  // Копия открывается сразу: обычно её и делают затем, чтобы тут же
  // поправить состав под следующий выезд.
  const copy = node.querySelector('[data-kit-copy]');
  if (copy) copy.onclick = async (event) => {
    const made = await run(() => api.copyKit(kit.id), {
      button: event.currentTarget, success: 'Копия готова',
    });
    if (made === null) return;
    history.pushState(null, '', `?kit=${made.id}`);
    window.dispatchEvent(new Event('app:refresh-route'));
  };

  node.querySelectorAll('[data-kit-add]').forEach((b) => {
    b.onclick = () => showAddItemsForm(kit);
  });

  node.querySelectorAll('[data-kit-remove]').forEach((b) => {
    b.onclick = async (event) => {
      // Кнопка живёт внутри <label>, иначе щелчок по ней переключал бы галочку.
      event.preventDefault();
      event.stopPropagation();
      const instrumentId = Number(b.dataset.kitRemove);
      const item = (kit.items || []).find((i) => i.id === instrumentId);
      if (!confirm(
        `Убрать «${item?.name || 'прибор'}» из комплекта «${kit.name}» насовсем?\n\n` +
        'Сам прибор никуда не денется — он просто перестанет входить в этот комплект. ' +
        'Если нужно пропустить его только на этот выезд, снимите галочку и ничего не убирайте.'
      )) return;
      const result = await run(() => api.removeKitItem(kit.id, instrumentId), { button: b });
      if (result === null) return;
      toast('Убран из комплекта');
      window.dispatchEvent(new Event('app:refresh-route'));
    };
  });

  const ret = node.querySelector('[data-kit-return]');
  if (ret) {
    ret.onclick = async (event) => {
      const result = await run(() => api.returnKit(kit.id), { button: event.currentTarget });
      if (result === null) return;
      reportKitResult(result, 'возвращено');
      await refresh();
      window.dispatchEvent(new Event('app:refresh-route'));
    };
  }

  const issue = node.querySelector('[data-kit-issue]');
  if (issue) {
    issue.onclick = async (event) => {
      const ids = selectedKitIds();
      if (!ids.length) return toast('Ничего не отмечено', true);
      const data = {
        taken_where: document.getElementById('kitWhere')?.value || '',
        taken_extra: document.getElementById('kitExtra')?.value || '',
        taken_at: document.getElementById('kitDate')?.value || today()
      };
      const result = await run(() => api.issueKit(kit.id, ids, data), { button: event.currentTarget });
      if (result === null) return;
      reportKitResult(result, 'взято');
      await refresh();
      window.dispatchEvent(new Event('app:refresh-route'));
    };
  }
}

/**
 * Результат групповой операции. Показываем и удачи, и неудачи с причиной:
 * «взято 4» без упоминания пятого прибора — это ложь умолчанием.
 */
function reportKitResult(result, verbPast) {
  const { succeeded = [], failed = [] } = result || {};
  if (!failed.length) return toast(`${capitalize(verbPast)}: ${succeeded.length}`);
  const details = failed.map((f) => f.message).join('; ');
  toast(`${capitalize(verbPast)}: ${succeeded.length}. Не удалось: ${failed.length} (${details})`, true);
}

// ---------- Создание, переименование, удаление ----------

/**
 * Одна форма и на создание, и на переименование: поля те же,
 * разница только в заголовке и в том, какой запрос уходит.
 * ids — приборы, отмеченные галочками в общем списке (создание «из выбора»).
 */
export function showKitForm(kit = null, ids = []) {
  const isNew = !kit;
  openModal(isNew ? 'Новый комплект' : 'Переименовать комплект', `
    <form id="kitForm" class="form-grid">
      <label>Название<input name="name" value="${escapeAttr(kit?.name || '')}" required maxlength="120"></label>
      <label>Описание<input name="description" value="${escapeAttr(kit?.description || '')}"></label>
      ${isNew && ids.length ? `<p class="hint">В комплект попадут отмеченные приборы: ${ids.length} шт.</p>` : ''}
      ${isNew && !ids.length ? '<p class="hint">Приборы можно будет добавить сразу после создания.</p>' : ''}
      <div class="modal-actions">
        <button class="primary" type="submit">${isNew ? 'Создать' : 'Сохранить'}</button>
      </div>
    </form>`);

  document.getElementById('kitForm').onsubmit = async (event) => {
    event.preventDefault();
    const button = event.target.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(event.target).entries());
    const result = await run(
      () => (isNew ? api.createKit({ ...data, ids }) : api.updateKit(kit.id, data)),
      { button }
    );
    if (result === null) return;
    closeModal();
    toast(isNew ? 'Комплект создан' : 'Сохранено');
    window.dispatchEvent(new CustomEvent('app:open-kit', { detail: { id: result.id } }));
  };
}

function confirmDeleteKit(kit, goKits) {
  openModal('Удалить комплект', `
    <p>Удалить комплект «${escapeHtml(kit.name)}»?</p>
    <p class="hint">Приборы не пострадают: исчезнет только запись о том,
       что они были собраны вместе. Те, что сейчас на руках, так и останутся на руках.</p>
    <div class="modal-actions">
      <button class="secondary" type="button" data-close>Отмена</button>
      <button class="danger" type="button" id="kitDeleteConfirm">Удалить</button>
    </div>`);

  document.getElementById('kitDeleteConfirm').onclick = async (event) => {
    const result = await run(() => api.deleteKit(kit.id), { button: event.currentTarget });
    if (result === null) return;
    closeModal();
    toast('Комплект удалён');
    goKits();
  };
}

/**
 * Добавить приборы в состав. Показываем весь список с поиском;
 * те, что уже в комплекте, отмечены и подписаны — чтобы человек
 * не гадал, почему прибор «не добавляется».
 */
function showAddItemsForm(kit) {
  const already = new Set((kit.items || []).map((i) => i.id));
  const all = state.instruments.filter((i) => i.status !== 'retired');

  openModal(`Добавить приборы в «${kit.name}»`, `
    <input id="kitPickSearch" class="search-full" placeholder="Поиск по названию, модели, серийному или инв. номеру">
    <div class="kit-pick" id="kitPickList">${all.map((i) => pickRowHtml(i, already)).join('')}</div>
    <div class="modal-actions">
      <span class="kit-pick-count" id="kitPickCount"></span>
      <button class="primary" type="button" id="kitPickAdd">Добавить</button>
    </div>`);

  const search = document.getElementById('kitPickSearch');
  const listNode = document.getElementById('kitPickList');
  const count = document.getElementById('kitPickCount');

  const refreshCount = () => {
    const n = listNode.querySelectorAll('.kit-pick-cb:checked:not(:disabled)').length;
    count.textContent = n ? `Выбрано ${n}` : 'Ничего не выбрано';
  };
  refreshCount();
  listNode.addEventListener('change', refreshCount);

  search.oninput = () => {
    const q = search.value.trim().toLowerCase();
    listNode.querySelectorAll('.kit-pick-row').forEach((row) => {
      row.classList.toggle('hidden', q ? !row.dataset.hay.includes(q) : false);
    });
  };

  document.getElementById('kitPickAdd').onclick = async (event) => {
    const ids = Array.from(listNode.querySelectorAll('.kit-pick-cb:checked:not(:disabled)'))
      .map((cb) => Number(cb.value));
    if (!ids.length) return toast('Не выбрано ни одного прибора', true);
    const result = await run(() => api.addKitItems(kit.id, ids), { button: event.currentTarget });
    if (result === null) return;
    closeModal();
    toast(`Добавлено: ${ids.length}`);
    window.dispatchEvent(new Event('app:refresh-route'));
  };
}

function pickRowHtml(item, already) {
  const inKit = already.has(item.id);
  const hay = [item.name, item.model, item.serial_number, item.inventory_no]
    .filter(Boolean).join(' ').toLowerCase();
  return `
    <label class="kit-pick-row${inKit ? ' is-in' : ''}" data-hay="${escapeAttr(hay)}">
      <input type="checkbox" class="kit-pick-cb" value="${escapeAttr(item.id)}"
             ${inKit ? 'checked disabled' : ''}>
      <span class="kit-pick-main">
        <span class="kit-pick-title">${escapeHtml(item.name)}<i>${escapeHtml(displayNo(item))}</i></span>
        <span class="kit-pick-sub">${escapeHtml(item.model || 'модель не указана')} ·
          с/н ${escapeHtml(item.serial_number || 'не указан')}</span>
      </span>
      ${inKit ? '<span class="badge muted">уже в комплекте</span>' : ''}
    </label>`;
}

// ---------- Мелочи ----------

function capitalize(text) {
  return `${text[0].toUpperCase()}${text.slice(1)}`;
}

/** 1 прибор / 2 прибора / 5 приборов. Тот же приём, что в utils.js. */
function plural(n, one, few, many) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
}
