import { api } from './api.js';
import { state, refresh, isAdmin } from './state.js';
import {
  escapeAttr, escapeHtml, formData, today, displayNo,
  verificationBadge, verificationText, verificationState, verificationInfo, fmtDate,
  statusBadge, statusText, checkTypeText,
  dateFieldLabel, validUntilLabel, documentButtonLabel,
  getControlTypes, controlTypeShort, controlTypeFull, controlTypeBadge,
  getCompanies, companyName, companyBadge,
  qtyOf, heldQty, freeQty, holdersOf, isMultiItem, myHolding, pieces
} from './utils.js';
import { closeModal, field, input, openModal, select, toast, run, qtyInput } from './ui.js';
import { prepareRecognitionPhoto } from './image-fingerprint.js';

// Адрес файлового менеджера. Поменяйте здесь, если домен когда-нибудь изменится.
export const FILEMANAGER_ORIGIN = 'https://files.imcstroy.ru';

/** Клиентская фильтрация уже загруженного списка. */
export function filteredInstruments(source = state.instruments) {
  const q = state.search.trim().toLowerCase();

  const list = source.filter((i) => {
    const matchesSearch = !q || [i.name, i.serial_number, i.model, i.inventory_no]
      .some((v) => String(v || '').toLowerCase().includes(q));

    // Фильтр поверки различает пять случаев вместо прежних трёх:
    // действует, истекает в ближайший месяц, просрочена, не требуется
    // и «срок не заполнен» — последнее раньше сливалось с «нет поверки».
    const matchesVerification = state.verification === 'all' ||
      verificationInfo(i).kind === state.verification;

    const matchesStatus = state.condition === 'all' || i.status === state.condition;

    const matchesControlType = state.controlType === 'all' ||
      (state.controlType === 'none' ? !i.control_type : i.control_type === state.controlType);

    const matchesCompany = state.company === 'all' ||
      (state.company === 'none' ? !i.company_code : i.company_code === state.company);

    return matchesSearch && matchesVerification && matchesStatus && matchesControlType && matchesCompany;
  });

  return sortInstruments(list);
}

/**
 * Сортировка списка. Приборы без значения всегда уходят в конец,
 * в какую бы сторону ни сортировали: пустая строка вверху списка,
 * отсортированного по названию, — это мусор, а не результат.
 */
function sortInstruments(list) {
  const dir = state.sortDesc ? -1 : 1;
  const key = state.sort || 'inventory_no';

  const value = (i) => {
    if (key === 'valid_until') return i.check_type === 'none' ? null : (i.valid_until || null);
    if (key === 'status') return statusText(i.status);
    if (key === 'control_type') return i.control_type ? controlTypeShort(i.control_type) : null;
    if (key === 'company') return i.company_code ? companyName(i.company_code) : null;
    if (key === 'name') return i.name;
    return i.inventory_no || null;
  };

  return [...list].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va === vb) return a.id - b.id;
    if (va === null || va === undefined || va === '') return 1;   // пустые — в конец
    if (vb === null || vb === undefined || vb === '') return -1;
    return dir * String(va).localeCompare(String(vb), 'ru', { numeric: true });
  });
}

/** Ячейка колонки «Поверка»: дата сверху, сколько осталось — снизу. */
function verificationCell(item) {
  const v = verificationInfo(item);
  const tone = v.tone ? ' t-' + v.tone : '';
  if (!v.date) {
    // «Не требуется» и «срок не заполнен» — разные вещи. Второе показываем
    // курсивом: это не свойство прибора, а незаполненное поле.
    const cls = v.kind === 'unset' ? 'col-empty is-unset' : 'col-empty';
    return `<span class="${cls}">${escapeHtml(v.rest)}</span>`;
  }
  return `<span class="col-date${tone}">${escapeHtml(v.date)}</span>
          <span class="col-rest${tone}">${escapeHtml(v.rest)}</span>`;
}

/** Что написано в колонке «Состояние»: у занятого — ещё и кто держит. */
function statusCell(item) {
  if (isMultiItem(item) && item.status !== 'retired') {
    // «Свободно 1 из 3» вместо «Занят»: у многоштучного прибора важно не
    // то, есть ли выданные, а осталось ли что брать.
    const free = freeQty(item);
    const who = holdersOf(item)
      .map((h) => `${h.name} — ${pieces(h.qty)}`).join(', ');
    return `<span class="badge ${free ? 'ok' : 'warn'}">Свободно ${free} из ${qtyOf(item)}</span>` +
      (who ? `<span class="col-who">${escapeHtml(who)}</span>` : '');
  }
  const badge = `<span class="badge ${statusBadge(item.status)}">${statusText(item.status)}</span>`;
  if (item.status === 'busy' && item.taken_by_name) {
    return `${badge}<span class="col-who">${escapeHtml(item.taken_by_name)}</span>`;
  }
  if (item.status === 'booked') {
    const who = item.booked_by_name || '';
    const when = item.booked_for ? ' · ' + fmtDate(item.booked_for) : '';
    return `${badge}<span class="col-who">${escapeHtml(who + when)}</span>`;
  }
  return badge;
}

/**
 * Кнопка действия в строке — та, которую человек нажмёт с наибольшей
 * вероятностью, глядя именно на этот прибор. Остальное остаётся в карточке.
 * Кнопки нет, когда действие человеку недоступно: занятый чужой прибор
 * возвращает тот, кто взял, или администратор.
 */
function rowAction(item) {
  const admin = isAdmin();
  const me = state.currentUser?.id;

  // У многоштучного прибора в строке предлагаем взять, пока есть свободные,
  // а иначе — вернуть своё. Разбираться, сколько именно, человек будет в
  // карточке: в строке для этого нет места, а гадать за него не надо.
  if (isMultiItem(item) && item.status !== 'retired') {
    if (freeQty(item) > 0) return { act: 'issue', label: 'Взять', primary: true };
    if (myHolding(item, me) || admin) return { act: 'return', label: 'Вернуть' };
    return null;
  }

  if (item.status === 'free') return { act: 'issue', label: 'Взять', primary: true };
  if (item.status === 'busy' && (item.taken_by === me || admin)) return { act: 'return', label: 'Вернуть' };
  if (item.status === 'booked' && (item.booked_by === me || admin)) {
    return { act: 'confirm-booking', label: 'Выдать' };
  }
  return null;
}

export function renderList(openCard, options = {}) {
  updatePendingTransfersIndicator();
  const source = options.items || state.instruments;
  const retired = Boolean(options.retired);
  const list = filteredInstruments(source);
  const showCheckboxes = state.massMode && !retired;

  const html = list.length
    ? list.map((item) => {
      const action = showCheckboxes ? null : rowAction(item);
      return `
      <div class="row row-${escapeAttr(item.status)}${showCheckboxes ? ' row-selectable' : ''}"
           data-row-id="${escapeAttr(item.id)}">
        ${showCheckboxes
          ? `<input type="checkbox" class="instrument-checkbox" value="${escapeAttr(item.id)}"
                    aria-label="Выбрать ${escapeAttr(item.name)}">`
          : ''}
        <a class="row-main" href="?id=${escapeAttr(item.id)}" data-open-id="${escapeAttr(item.id)}">
          <span class="row-photo${item.has_photo ? '' : ' is-empty'}" ${item.has_photo ? `data-list-photo="${escapeAttr(item.id)}"` : ''}>${item.has_photo ? '' : '—'}</span>
          <span class="row-identity"><span class="row-title">${escapeHtml(item.name)}<i>${escapeHtml(displayNo(item))}</i></span>
          <span class="row-subtitle">${escapeHtml(item.model || 'модель не указана')} ·
            с/н ${escapeHtml(item.serial_number || 'не указан')}</span></span>
        </a>
        <div class="row-cols">
          <div class="row-col" data-label="Состояние">${statusCell(item)}</div>
          <div class="row-col" data-label="Класс">
            <span class="badge ${controlTypeBadge(item.control_type)}"
                  title="${escapeAttr(controlTypeFull(item.control_type))}">${escapeHtml(controlTypeShort(item.control_type))}</span>
          </div>
          <div class="row-col" data-label="Поверка">${verificationCell(item)}</div>
          <div class="row-col" data-label="Владелец">
            <span class="badge ${item.company_code ? companyBadge(item.company_code) : 'muted'}"
                  title="${escapeAttr(companyName(item.company_code))}">${escapeHtml(companyName(item.company_code))}</span>
          </div>
        </div>
        <div class="row-act">${action
          ? `<button class="${action.primary ? 'primary' : 'secondary'}" type="button"
                     data-row-act="${action.act}" data-row-target="${escapeAttr(item.id)}">${action.label}</button>`
          : ''}</div>
      </div>`;
    }).join('')
    : emptyStateHtml(source.length, retired);

  document.getElementById('listTable')?.classList.toggle('mass-selecting', showCheckboxes);
  document.getElementById('instrumentList').innerHTML = html;
  loadVisibleListPhotos();

  document.querySelectorAll('[data-open-id]').forEach((node) => {
    node.onclick = (event) => {
      event.preventDefault();
      if (showCheckboxes) {
        // В режиме «Выбрать» щелчок по любому месту строки переключает
        // галочку — не обязательно попадать точно в маленький квадратик.
        const checkbox = node.closest('.row')?.querySelector('.instrument-checkbox');
        if (checkbox) checkbox.checked = !checkbox.checked;
        return;
      }
      openCard(node.dataset.openId);
    };
  });

  document.querySelectorAll('[data-row-act]').forEach((btn) => {
    btn.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      runRowAction(btn.dataset.rowAct, Number(btn.dataset.rowTarget), btn);
    };
  });

  bindEmptyState();
}

function loadVisibleListPhotos() {
  const nodes = [...document.querySelectorAll('[data-list-photo]')];
  const load = (node) => {
    const id = node.dataset.listPhoto;
    delete node.dataset.listPhoto;
    api.photoUrl(id).then((url) => { if (url && node.isConnected) node.innerHTML = `<img src="${url}" alt="">`; });
  };
  if (!('IntersectionObserver' in window)) return nodes.forEach(load);
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) { observer.unobserve(entry.target); load(entry.target); }
  }), { rootMargin: '180px' });
  nodes.forEach((node) => observer.observe(node));
}

/**
 * Действие из строки списка. «Взять» и «Забронировать» открывают ту же
 * форму, что и в карточке: место использования — главное, что потом ищут
 * в журнале, и спрашивать его надо в момент выдачи, а не «когда-нибудь».
 */
async function runRowAction(act, id, button) {
  const item = state.instruments.find((i) => i.id === id);
  if (!item) return;
  const me = state.currentUser?.id;

  if (act === 'issue') return showTakeForm(item);
  // У многоштучного прибора возврат — это ещё и «сколько», поэтому вместо
  // вопроса «да/нет» открывается та же форма, что и в карточке.
  if (act === 'return' && isMultiItem(item)) {
    return showReturnForm(item, myHolding(item, me) ? me : holdersOf(item)[0]?.user_id);
  }

  const questions = {
    return: `Вернуть «${item.name}»?`,
    'confirm-booking': `Подтвердить бронирование и выдать «${item.name}»?`,
  };
  if (!confirm(questions[act])) return;

  const actions = {
    return: () => api.return(item.id),
    'confirm-booking': () => api.confirmBooking(item.id),
  };
  const messages = { return: 'Прибор возвращён', 'confirm-booking': 'Прибор выдан' };

  const result = await run(actions[act], { button, success: messages[act] });
  if (result === null) return;
  await refresh();
  window.dispatchEvent(new Event('app:refresh-route'));
}

/**
 * Пустой список. Раньше здесь была одна строка «Нет приборов по выбранным
 * условиям», из которой непонятно, виноват поиск или фильтры. Теперь видно
 * и то и другое — и чем это исправить.
 */
function emptyStateHtml(total = state.instruments.length, retired = false) {
  const q = state.search.trim();
  const active = [];
  if (state.condition !== 'all') active.push(`состояние «${statusText(state.condition)}»`);
  if (state.controlType !== 'all') {
    active.push(`классификация «${state.controlType === 'none' ? 'не указана' : controlTypeShort(state.controlType)}»`);
  }
  if (state.verification !== 'all') {
    const names = { valid: 'действует', soon: 'истекает в ближайший месяц',
      expired: 'просрочена', none: 'не требуется', unset: 'срок не заполнен' };
    active.push(`поверка — ${names[state.verification] || state.verification}`);
  }
  if (state.company !== 'all') {
    active.push(`владелец «${state.company === 'none' ? 'не привязан' : companyName(state.company)}»`);
  }

  const what = q ? `По запросу «${escapeHtml(q)}»` : (retired ? 'Среди списанных приборов' : 'Среди приборов');
  const where = active.length ? ` c условиями: ${escapeHtml(active.join(', '))},` : '';

  return `<div class="empty-state">
      <div class="empty-title">Ничего не нашлось</div>
      <div class="empty-text">${what}${where} совпадений нет.
        Всего в этом разделе ${total} приборов.</div>
      <div class="empty-actions">
        ${q || active.length ? '<button class="secondary" type="button" data-empty-reset>Сбросить поиск и фильтры</button>' : ''}
        ${retired ? '' : '<button class="secondary" type="button" data-empty-retired>Искать среди списанных</button>'}
      </div>
    </div>`;
}

function bindEmptyState() {
  const reset = document.querySelector('[data-empty-reset]');
  if (reset) reset.onclick = () => window.dispatchEvent(new Event('app:reset-filters'));
  const retired = document.querySelector('[data-empty-retired]');
  if (retired) retired.onclick = () => window.dispatchEvent(new Event('app:show-retired'));
}

export async function renderCard(id, goList) {
  const screen = document.getElementById('cardScreen');
  document.getElementById('listScreen').classList.add('hidden');
  screen.classList.remove('hidden');
  screen.innerHTML = '<div class="panel card">Загрузка...</div>';

  let item;
  try {
    item = await api.getInstrument(id);
  } catch (err) {
    screen.innerHTML = `<div class="panel card">${escapeHtml(err.message)}
      <div class="actions"><button class="secondary" data-back>К списку</button></div></div>`;
    screen.querySelector('[data-back]').onclick = goList;
    return;
  }

  const admin = isAdmin();
  const me = state.currentUser.id;
  const isOwner = item.taken_by === me;
  const isBookedByMe = item.booked_by === me;

  // Наличие: у прибора может быть несколько одинаковых штук (два фонаря —
  // одна карточка). Тогда «занят» и «свободен» перестают быть одним
  // словом на всю карточку: часть на руках, часть на месте.
  const multi = qtyOf(item) > 1;
  const free = freeQty(item);
  const held = heldQty(item);
  const mine = multi ? myHolding(item, me) : null;
  const verification = verificationInfo(item);
  const issuanceBlocked = item.check_type !== 'none' &&
    (verification.kind === 'expired' || verification.kind === 'unset');
  const issuanceBlockText = verification.kind === 'unset'
    ? 'Срок поверки не указан. Выдача и передача запрещены.'
    : 'Поверка просрочена. Выдача и передача запрещены.';

  // ---------- Кнопки ----------
  let main = '';
  let danger = '';

  if (item.status === 'retired') {
    if (admin) {
      main += '<button class="primary" data-restore>Восстановить</button>';
      main += '<button class="secondary" data-edit>Редактировать</button>';
    }
  } else if (multi) {
    // У многоштучного прибора «Взять» живо, пока есть свободные, а
    // «Вернуть» — пока у человека что-то на руках. Одно другому не мешает:
    // можно держать одну штуку и взять вторую.
    if (free > 0 && !issuanceBlocked) main += '<button class="primary" data-issue>Взять прибор</button>';
    if (free > 0 && issuanceBlocked) main += '<button class="primary" disabled>Выдача запрещена</button>';
    if (mine || (admin && held > 0)) main += '<button class="secondary" data-return>Вернуть прибор</button>';
    if (free <= 0 && !mine && !admin) {
      main += `<span class="badge warn">Все ${qtyOf(item)} шт на руках</span>`;
    }
  } else if (item.status === 'free') {
    main += issuanceBlocked
      ? '<button class="primary" disabled>Выдача запрещена</button>'
      : '<button class="primary" data-issue>Взять прибор</button>';
    main += '<button class="secondary" data-book>Забронировать</button>';
  } else if (item.status === 'booked') {
    if (isBookedByMe || admin) {
      main += issuanceBlocked
        ? '<button class="primary" disabled>Выдача запрещена</button>'
        : '<button class="primary" data-confirm-booking>Подтвердить бронирование</button>';
      main += '<button class="danger" data-cancel-booking>Отменить бронирование</button>';
    } else {
      main += `<span class="badge warn">Забронирован: ${escapeHtml(item.booked_by_name || '')}</span>`;
    }
  } else if (item.status === 'busy') {
    if (isOwner || admin) {
      main += '<button class="primary" data-return>Вернуть прибор</button>';
      if (!item.pending_transfer_to) {
        main += issuanceBlocked
          ? '<button class="secondary" disabled>Передача запрещена</button>'
          : '<button class="secondary" data-transfer>Передать</button>';
      }
    } else {
      main += `<span class="badge warn">Занят: ${escapeHtml(item.taken_by_name || '')}</span>`;
    }
  }

  // QR, копирование, история и «Редактировать» переехали вниз карточки
  // (блок card-minor), а документ поверки открывается из блока поверки
  // и из ленты фотографий. В шапке остаются только действия с самим
  // прибором — то, ради чего карточку и открывают.
  if (admin && item.status !== 'retired') {
    danger += '<button class="danger" data-retire>Списать</button>';
    danger += '<button class="danger" data-delete>Удалить</button>';
  } else if (admin && item.status === 'retired') {
    // Списанный прибор списывать уже некуда, но удалить его можно.
    danger += '<button class="danger" data-delete>Удалить</button>';
  }

  // ---------- Блок «где прибор сейчас» ----------
  // Тот же вид, что у характеристик: подпись слева, значение справа,
  // даты — по-человечески (11.11.2026, а не 2026-11-11).
  const kv = (label, value) => (value
    ? `<div class="card-kv"><span class="card-k">${escapeHtml(label)}</span><span class="card-v">${escapeHtml(value)}</span></div>`
    : '');

  let holder = '';
  if (multi) {
    // Кто сколько держит. Строка на человека: «Петров — 2 шт».
    const lines = holdersOf(item).map((h) => `
      <div class="holder-line">
        <span><b>${escapeHtml(h.name)}</b> — ${escapeHtml(pieces(h.qty))}${
          h.taken_where ? ' · ' + escapeHtml(h.taken_where) : ''}${
          h.taken_at ? ', с ' + escapeHtml(fmtDate(h.taken_at)) : ''}</span>
        ${(admin || String(h.user_id) === String(me))
          ? `<button class="secondary" type="button" data-return-holder="${escapeAttr(h.user_id)}"
                     data-return-max="${escapeAttr(h.qty)}">Вернуть</button>`
          : ''}
      </div>`).join('');
    holder = `<div class="card-box holder">
      <h4>Наличие — ${escapeHtml(pieces(qtyOf(item)))}</h4>
      ${kv('Свободно', pieces(free))}
      ${held ? `<div class="holder-sub">На руках — ${escapeHtml(pieces(held))}</div>${lines}`
             : '<div class="holder-sub">На руках никого нет</div>'}
    </div>`;
  } else if (item.status === 'busy') {
    holder = `<div class="card-box holder">
      <h4>Где прибор сейчас</h4>
      ${kv('Взял', item.taken_by_name)}
      ${kv('Место использования', item.taken_where)}
      ${kv('Доп. данные', item.taken_extra)}
      ${kv('Дата выдачи', fmtDate(item.taken_at))}
      ${kv('Ожидает подтверждения от', item.pending_transfer_to_name)}
    </div>`;
  } else if (item.status === 'booked') {
    holder = `<div class="card-box holder">
      <h4>Бронирование</h4>
      ${kv('Забронировал', item.booked_by_name)}
      ${kv('Место использования', item.booked_where)}
      ${kv('Дата бронирования', fmtDate(item.booked_for))}
      ${kv('Доп. информация', item.booked_extra)}
    </div>`;
  } else if (item.status === 'retired') {
    holder = `<div class="card-box holder">
      <h4>Списание</h4>
      ${kv('Дата списания', fmtDate(item.retired_at))}
    </div>`;
  }

  const v = verification;
  const vTone = v.tone ? ' v-' + v.tone : '';

  // Незаполненные поля собираем в одну строку вместо столбца прочерков:
  // одиннадцать «—» подряд не сообщают ничего, кроме того, что карточку не вели.
  const missing = [
    [!item.inventory_no, 'инвентарный номер'],
    [!item.serial_number, 'серийный номер'],
    [!item.model, 'модель'],
    [!item.control_type, 'классификация'],
    [!item.company_code, 'владелец'],
    [!item.verification_date && item.check_type !== 'none', dateFieldLabel(item.check_type).toLowerCase()],
    [!item.valid_until && item.check_type !== 'none', validUntilLabel(item.check_type).toLowerCase()],
  ].filter(([empty]) => empty).map(([, name]) => name);

  const facts = [
    // «1 шт» в каждой карточке — строка, которую глаз перестанет замечать
    // через день, поэтому наличие показывается, только когда штук несколько.
    ['Наличие', multi ? pieces(qtyOf(item)) : ''],
    ['Классификация', item.control_type ? controlTypeFull(item.control_type) : ''],
    ['Владелец', item.company_code ? companyName(item.company_code) : ''],
    ['Метрологический контроль', checkTypeText(item.check_type)],
    [dateFieldLabel(item.check_type), item.verification_date ? fmtDate(item.verification_date) : ''],
    ['Комментарий', item.comment],
  ].filter(([, value]) => value);

  screen.innerHTML = `
    <article class="card-screen">
      <div class="card-gallery">
        <div class="card-photo" id="cardPhoto">
          ${item.has_photo ? 'Загрузка фото...' : 'Фотографии нет'}
        </div>
<!-- Переключателя «Прибор / Поверка» здесь больше нет: в этом месте
             карточки показывается только сам прибор. Документ смотрится
             по строке поверки ниже — там он и открывается целиком, а не
             вписанным в маленькую рамку. -->
        <div class="card-qr">
          <div class="card-qr-box" id="cardQrBox"></div>
          <div class="card-qr-text">
            <b>QR-код прибора</b>
            ${escapeHtml(displayNo(item))} · наклеивается на корпус
          </div>
          <button class="secondary" type="button" data-qr>QR-код</button>
        </div>
      </div>

      <div class="card-main">
        <div class="card-head">
          <div class="card-head-text">
            <h1>${escapeHtml(item.name)}</h1>
            <div class="card-model">${item.model ? escapeHtml(item.model) : 'Модель не указана'}</div>
            <div class="card-ids">
              <span>Инвентарный № <b>${escapeHtml(item.inventory_no || 'не указан')}</b></span>
              <span>Серийный № <b>${escapeHtml(item.serial_number || 'не указан')}</b></span>
            </div>
          </div>
          ${admin && item.status !== 'retired' ? '<button class="card-head-edit" type="button" data-edit>Редактировать</button>' : ''}
        </div>

        <!-- Вся полоса открывает документ, а не кнопка в её углу:
             отдельная кнопка занимала место и делила надвое то, что для
             человека и так одно целое — «поверка». Если документа нет,
             полоса остаётся обычным блоком: нажимать не на что, и делать
             вид, что есть, нечестно. -->
        <div class="card-priority-grid">
          <section class="card-focus card-location">
            <h4>${multi ? 'Наличие и выдача' : item.status === 'booked' ? 'Бронирование' : item.status === 'retired' ? 'Списание' : 'Где прибор сейчас'}</h4>
            <div class="card-focus-body">${holder || '<div class="card-available"><b>Прибор свободен</b><span>Можно оформить выдачу</span></div>'}</div>
            <div class="card-actions">${main}</div>
            ${issuanceBlocked ? `<div class="card-issue-block">${escapeHtml(issuanceBlockText)}</div>` : ''}
          </section>
          <section class="card-focus card-check">
            <h4>${escapeHtml(checkTypeText(item.check_type))}</h4>
        ${item.has_document ? `
        <button type="button" class="card-verif card-verif-open${vTone}" data-document
                title="Открыть ${escapeHtml(documentButtonLabel(item.check_type).toLowerCase())}">
          ${v.date ? `<span class="card-verif-date">${escapeHtml(v.date)}</span>` : ''}
          <span class="card-verif-text">
            <b>${escapeHtml(verifHeadline(item, v))}</b>
            ${item.verification_date ? 'Предыдущая — ' + escapeHtml(fmtDate(item.verification_date)) : 'Дата предыдущей не заполнена'}
          </span>
          <span class="card-verif-go">Открыть свидетельство
            <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </span>
        </button>` : `
        <div class="card-verif${vTone}">
          ${v.date ? `<span class="card-verif-date">${escapeHtml(v.date)}</span>` : ''}
          <span class="card-verif-text">
            <b>${escapeHtml(verifHeadline(item, v))}</b>
            ${item.verification_date ? 'Предыдущая — ' + escapeHtml(fmtDate(item.verification_date)) : 'Дата предыдущей не заполнена'}
          </span>
          <span class="card-verif-none">${escapeHtml(documentButtonLabel(item.check_type))} не приложен${
            item.check_type === 'calibration' ? 'а' : ''}</span>
        </div>`}
          </section>
        </div>

        <div class="card-box">
          <h4>Характеристики</h4>
          ${facts.map(([label, value]) => `
            <div class="card-kv">
              <span class="card-k">${escapeHtml(label)}</span>
              <span class="card-v">${escapeHtml(value)}</span>
            </div>`).join('')}
          ${missing.length
            ? `<div class="card-missing">Не заполнено: <b>${escapeHtml(missing.join(', '))}</b>.${
                admin ? ' Поправить можно в «Редактировать».' : ''}</div>`
            : ''}
        </div>

        <!-- В какие комплекты входит прибор. Подгружается отдельным
             запросом, чтобы карточка не ждала лишнего; пока пусто — блока
             не видно вообще. -->
        <div class="card-box hidden" id="cardKits"></div>

        <!-- Раньше это были неприметные серые кнопки в одну строку
             с «К списку», и «Редактировать» терялось среди них. Теперь
             у каждой значок и заметная рамка, а «К списку» отсюда ушла
             наверх, к «В ИСУ»: это не действие с прибором, а выход
             из карточки, и место ему рядом с другим выходом. -->
        <div class="card-minor">
          <button class="card-act" type="button" data-history>
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            История прибора
          </button>
          <button class="card-act" type="button" data-copy>
            <svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/></svg>
            Копировать данные
          </button>
          ${admin && item.status !== 'retired' && item.check_type !== 'none' ? `
          <button class="card-act card-act-main" type="button" data-add-copy>
            <svg viewBox="0 0 24 24"><rect x="4" y="4" width="12" height="12" rx="2"/><path d="M9 20h9a2 2 0 0 0 2-2V9M10 8v4M8 10h4"/></svg>
            Добавить экземпляр
          </button>` : ''}
          ${admin ? `<button class="card-act" type="button" data-recognition>
            <svg viewBox="0 0 24 24"><path d="M4 7h3l2-3h6l2 3h3v13H4z"/><circle cx="12" cy="13" r="4"/></svg>
            Фото для распознавания
          </button>` : ''}
        </div>

        ${danger ? `
          <div class="card-danger">
            <span class="card-danger-note">Действия администратора. Списание и удаление отменить нельзя.</span>
            ${danger}
          </div>` : ''}
      </div>
    </article>`;

  // Фото подгружаем отдельным запросом — оно не тормозит отрисовку карточки.
  if (item.has_photo) {
    api.photoUrl(item.id).then((url) => {
      const box = document.getElementById('cardPhoto');
      if (box && url) box.innerHTML = `<img src="${url}" alt="Фото прибора">`;
      else if (box) box.textContent = 'Фото не открылось';
    });
  }
  renderCardQr(item);
  bindGallery(item);
  renderCardKits(item);

  bindCardActions(item, goList);
}


/**
 * Блок «Входит в комплекты». Прибор может входить в сколько угодно
 * комплектов — физически он один, поэтому взятый в одном комплекте
 * в остальных покажется занятым. Об этом и написано в подсказке:
 * иначе человек решит, что комплект сломался.
 *
 * Ошибку запроса глотаем молча: это справочный блок, из-за него
 * карточка прибора падать не должна.
 */
async function renderCardKits(item) {
  let list = [];
  try {
    list = await api.instrumentKits(item.id);
  } catch {
    return;
  }
  const box = document.getElementById('cardKits');
  if (!box || !list.length) return;

  box.innerHTML = `<h4>Входит в комплекты</h4>
    ${list.map((k) => `
      <div class="card-kv">
        <span class="card-k"><a href="?kit=${escapeAttr(k.id)}">${escapeHtml(k.name)}</a></span>
        <span class="card-v">${k.total} шт.</span>
      </div>`).join('')}
    <div class="card-missing">Прибор один, а комплектов может быть несколько:
      пока он на руках, в остальных комплектах он будет помечен как занятый.</div>`;
  box.classList.remove('hidden');
}

/** Чипы состояния в шапке карточки: где прибор и чей он. */
function cardStateChips(item) {
  const chips = [];
  if (isMultiItem(item) && item.status !== 'retired') {
    // У многоштучного прибора состояние — это два числа, а не одно слово.
    chips.push(`<span class="card-chip ${freeQty(item) ? 'free' : 'busy'}">Свободно ${
      freeQty(item)} из ${qtyOf(item)}</span>`);
    if (heldQty(item)) {
      chips.push(`<span class="card-chip busy">На руках ${heldQty(item)}</span>`);
    }
  } else if (item.status === 'busy') {
    chips.push(`<span class="card-chip busy">На руках у ${escapeHtml(item.taken_by_name || 'сотрудника')}${
      item.taken_at ? ' с ' + escapeHtml(fmtDate(item.taken_at)) : ''}</span>`);
  } else if (item.status === 'booked') {
    chips.push(`<span class="card-chip warn">Бронь: ${escapeHtml(item.booked_by_name || '')}${
      item.booked_for ? ' на ' + escapeHtml(fmtDate(item.booked_for)) : ''}</span>`);
  } else if (item.status === 'retired') {
    chips.push(`<span class="card-chip">Списан${item.retired_at ? ' ' + escapeHtml(fmtDate(item.retired_at)) : ''}</span>`);
  } else {
    chips.push('<span class="card-chip free">Свободен</span>');
  }
  if (item.control_type) chips.push(`<span class="card-chip">${escapeHtml(controlTypeFull(item.control_type))}</span>`);
  if (item.company_code) chips.push(`<span class="card-chip">${escapeHtml(companyName(item.company_code))}</span>`);
  return chips.join('');
}

/** Заголовок блока поверки — словами, а не «есть/нет». */
function verifHeadline(item, v) {
  const what = checkTypeText(item.check_type).toLowerCase();
  if (v.kind === 'none') return 'Метрологический контроль не требуется';
  if (v.kind === 'unset') return `Срок действия (${what}) не заполнен`;
  // v.rest уже читается как самостоятельная фраза («Просрочено на 29 дней»),
  // поэтому здесь только уточняем, что именно просрочено.
  if (v.kind === 'expired') return `${checkTypeText(item.check_type)}: ${v.rest.toLowerCase()}`;
  if (v.kind === 'soon') return `${checkTypeText(item.check_type)} заканчивается: ${v.rest}`;
  return `${checkTypeText(item.check_type)} действует, ${v.rest}`;
}

/** Фото прибора в карточке открывается на весь экран по щелчку. */
function bindGallery(item) {
  const box = document.getElementById('cardPhoto');
  if (!box) return;
  box.onclick = () => {
    const img = box.querySelector('img');
    if (img) showLightbox(img.src, item.name);
  };
}

/**
 * Картинка во весь экран.
 *
 * Нужна ровно затем, чтобы прочитать мелкий текст на свидетельстве:
 * в рамке карточки или окна сроки видно, но не разобрать. Поэтому
 * есть точный масштаб, колесо мыши, перемещение и жест двумя пальцами.
 */
export function showLightbox(src, caption = '') {
  // Именно <dialog> и showModal(): документ открывается поверх окна,
  // которое само уже модальное. Обычный div с любым z-index оказался
  // бы ПОД ним — модальные окна живут в собственном слое браузера.
  const node = document.createElement('dialog');
  node.className = 'lightbox';
  node.innerHTML = `
    <div class="lightbox-bar">
      <span class="lightbox-caption">${escapeHtml(caption)}</span>
      <span class="lightbox-hint">Колесо мыши или кнопки — масштаб, изображение можно двигать</span>
      <div class="lightbox-tools" aria-label="Масштаб документа">
        <button type="button" data-zoom-out aria-label="Уменьшить">−</button>
        <span class="lightbox-zoom-value" data-zoom-value>100%</span>
        <button type="button" data-zoom-in aria-label="Увеличить">+</button>
        <button type="button" data-zoom-reset aria-label="Вписать в экран">Вписать</button>
      </div>
      <button class="lightbox-close" type="button" aria-label="Закрыть">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>
    <div class="lightbox-stage"><div class="lightbox-canvas"><img src="${escapeAttr(src)}" alt="${escapeAttr(caption)}"></div></div>`;

  const close = () => {
    if (node.open) node.close();
    node.remove();
  };
  // Esc у <dialog> работает сам, но закрытый диалог остаётся в дереве —
  // убираем узел, чтобы они не копились.
  node.addEventListener('close', () => {
    window.removeEventListener('resize', fitImage);
    node.remove();
  });

  node.querySelector('.lightbox-close').onclick = close;
  node.onclick = (e) => { if (e.target === node) close(); };

  const img = node.querySelector('img');
  const stage = node.querySelector('.lightbox-stage');
  const canvas = node.querySelector('.lightbox-canvas');
  const zoomValue = node.querySelector('[data-zoom-value]');
  let zoom = 1;
  let baseWidth = 1;
  let baseHeight = 1;

  const redraw = (nextZoom, focusX = stage.clientWidth / 2, focusY = stage.clientHeight / 2) => {
    const oldWidth = Math.max(1, canvas.scrollWidth);
    const oldHeight = Math.max(1, canvas.scrollHeight);
    const xRatio = (stage.scrollLeft + focusX) / oldWidth;
    const yRatio = (stage.scrollTop + focusY) / oldHeight;
    zoom = Math.max(0.5, Math.min(5, nextZoom));
    const imageWidth = Math.round(baseWidth * zoom);
    const imageHeight = Math.round(baseHeight * zoom);
    img.style.width = `${imageWidth}px`;
    img.style.height = `${imageHeight}px`;
    canvas.style.width = `${Math.max(stage.clientWidth - 32, imageWidth)}px`;
    canvas.style.height = `${Math.max(stage.clientHeight - 32, imageHeight)}px`;
    zoomValue.textContent = `${Math.round(zoom * 100)}%`;
    requestAnimationFrame(() => {
      stage.scrollLeft = xRatio * canvas.scrollWidth - focusX;
      stage.scrollTop = yRatio * canvas.scrollHeight - focusY;
    });
  };

  const fitImage = () => {
    if (!img.naturalWidth || !img.naturalHeight) return;
    const fit = Math.min(
      Math.max(1, stage.clientWidth - 32) / img.naturalWidth,
      Math.max(1, stage.clientHeight - 32) / img.naturalHeight,
      1
    );
    baseWidth = Math.max(1, Math.round(img.naturalWidth * fit));
    baseHeight = Math.max(1, Math.round(img.naturalHeight * fit));
    redraw(1);
  };
  img.onload = fitImage;
  if (img.complete) fitImage();

  node.querySelector('[data-zoom-in]').onclick = () => redraw(zoom * 1.25);
  node.querySelector('[data-zoom-out]').onclick = () => redraw(zoom / 1.25);
  node.querySelector('[data-zoom-reset]').onclick = () => redraw(1);
  img.ondblclick = (event) => {
    event.preventDefault();
    const rect = stage.getBoundingClientRect();
    redraw(zoom > 1 ? 1 : 2, event.clientX - rect.left, event.clientY - rect.top);
  };
  stage.addEventListener('wheel', (event) => {
    event.preventDefault();
    const rect = stage.getBoundingClientRect();
    redraw(zoom * (event.deltaY < 0 ? 1.15 : 1 / 1.15),
      event.clientX - rect.left, event.clientY - rect.top);
  }, { passive: false });

  // Перетаскивание работает и мышью, и одним пальцем. Два пальца
  // меняют масштаб, поэтому на телефоне не нужны крошечные жесты по кнопкам.
  const pointers = new Map();
  let drag = null;
  let pinch = null;
  const distance = () => {
    const [a, b] = [...pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  stage.onpointerdown = (event) => {
    stage.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) {
      drag = { x: event.clientX, y: event.clientY, left: stage.scrollLeft, top: stage.scrollTop };
      stage.classList.add('is-dragging');
    } else if (pointers.size === 2) {
      pinch = { distance: distance(), zoom };
      drag = null;
    }
  };
  stage.onpointermove = (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2 && pinch?.distance) {
      redraw(pinch.zoom * distance() / pinch.distance);
    } else if (drag && pointers.size === 1) {
      stage.scrollLeft = drag.left - (event.clientX - drag.x);
      stage.scrollTop = drag.top - (event.clientY - drag.y);
    }
  };
  const pointerUp = (event) => {
    pointers.delete(event.pointerId);
    pinch = null;
    drag = null;
    stage.classList.remove('is-dragging');
  };
  stage.onpointerup = pointerUp;
  stage.onpointercancel = pointerUp;

  document.body.appendChild(node);
  node.showModal();
  requestAnimationFrame(fitImage);
  window.addEventListener('resize', fitImage);
}

/** Маленький QR прямо в карточке — его печатают на наклейку. */
function renderCardQr(item) {
  const box = document.getElementById('cardQrBox');
  if (!box || typeof QRCode === 'undefined') return;
  box.innerHTML = '';
  new QRCode(box, {
    text: `${location.origin}${location.pathname}?id=${item.id}`,
    width: 84, height: 84,
    correctLevel: QRCode.CorrectLevel.M,
  });
}

function bindCardActions(item, goList) {
  const root = document.getElementById('cardScreen');
  const on = (selector, handler) => {
    const node = root.querySelector(selector);
    if (node) node.onclick = (event) => handler(event.currentTarget);
  };

  // После любой операции сервер возвращает новое состояние — просто
  // перечитываем данные и перерисовываем экран.
  const after = async (button, fn, message) => {
    const result = await run(fn, { button, success: message });
    if (result === null) return;
    await refresh();
    window.dispatchEvent(new Event('app:refresh-route'));
  };

  on('[data-back]', goList);
  on('[data-issue]', () => showTakeForm(item));
  on('[data-book]', () => showBookForm(item));
  on('[data-transfer]', () => showTransferForm(item));
  on('[data-edit]', () => showInstrumentForm(item));
  on('[data-add-copy]', () => showInstrumentForm(null, { copyFrom: item }));
  on('[data-qr]', () => showQr(item));
  on('[data-document]', () => showDocument(item));
  on('[data-copy]', () => copyInfo(item));
  on('[data-history]', () => showHistory(item));
  on('[data-recognition]', () => showRecognitionPhotos(item));

  if (isMultiItem(item)) {
    // Кнопка в шапке возвращает СВОЁ; кнопка в строке держателя — его.
    on('[data-return]', () => showReturnForm(item, state.currentUser.id));
    root.querySelectorAll('[data-return-holder]').forEach((node) => {
      node.onclick = () => showReturnForm(item, node.dataset.returnHolder);
    });
  } else {
    on('[data-return]', (b) => after(b, () => api.return(item.id), 'Прибор возвращён'));
  }
  on('[data-confirm-booking]', (b) => {
    if (!confirm('Подтвердить бронирование и выдать прибор?')) return;
    after(b, () => api.confirmBooking(item.id), 'Прибор выдан');
  });
  on('[data-cancel-booking]', (b) => {
    if (!confirm('Отменить бронирование?')) return;
    after(b, () => api.cancelBooking(item.id), 'Бронирование отменено');
  });
  on('[data-retire]', (b) => {
    if (!confirm('Списать прибор?')) return;
    after(b, () => api.retire(item.id), 'Прибор списан');
  });
  on('[data-restore]', (b) => {
    if (!confirm('Восстановить прибор из списанных?')) return;
    after(b, () => api.restore(item.id), 'Прибор восстановлен');
  });
  on('[data-delete]', async (b) => {
    if (!confirm('Удалить прибор безвозвратно? Это действие нельзя отменить.')) return;
    const result = await run(() => api.deleteInstrument(item.id), { button: b, success: 'Прибор удалён' });
    if (result === null) return;
    await refresh();
    goList();
  });
}

/** Эталонные ракурсы, по которым быстрый экран камеры узнаёт прибор. */
async function showRecognitionPhotos(item) {
  openModal(`Распознавание: ${item.name}`, '<p class="qr-caption">Загрузка фотографий…</p>');
  let photos;
  try { photos = await api.listRecognitionPhotos(item.id); }
  catch (error) { return openModal('Фото для распознавания', `<p class="qr-caption">${escapeHtml(error.message)}</p>`); }

  openModal(`Распознавание: ${item.name}`, `
    <div class="recognition-help">
      <b>Добавьте 6–10 разных фотографий.</b>
      <span>Держите прибор целиком в центре кадра и не прижимайте к краям. Фон будет полностью удалён и не попадёт в распознавание. Если прибор сливается со столом, выберите более контрастный фон.</span>
    </div>
    <label class="recognition-add primary">Добавить фото
      <input id="recognitionFile" type="file" accept="image/*" capture="environment">
    </label>
    ${photos.length ? '<button class="secondary recognition-reprocess" type="button" data-reprocess-photos>Обновить старые фото: убрать фон</button>' : ''}
    <div class="recognition-grid" id="recognitionGrid">
      ${photos.length ? photos.map((p) => `<div class="recognition-photo" data-photo="${p.id}"><div class="recognition-thumb">Загрузка…</div><button class="danger" type="button" data-delete-photo="${p.id}">Удалить</button></div>`).join('') : '<p class="qr-caption">Эталонных фотографий пока нет.</p>'}
    </div>
    <p class="qr-caption">Сохранено: ${photos.length} из 24. После добавления фото сразу участвует в поиске.</p>`);

  for (const photo of photos) {
    api.recognitionPhotoUrl(photo.id).then((url) => {
      const box = document.querySelector(`[data-photo="${photo.id}"] .recognition-thumb`);
      if (box && url) box.innerHTML = `<img src="${url}" alt="Эталонный ракурс">`;
    });
  }
  document.querySelectorAll('[data-delete-photo]').forEach((button) => {
    button.onclick = async () => {
      if (!confirm('Удалить этот эталонный снимок?')) return;
      const result = await run(() => api.deleteRecognitionPhoto(button.dataset.deletePhoto), { button, success: 'Фотография удалена' });
      if (result !== null) showRecognitionPhotos(item);
    };
  });
  const reprocess = document.querySelector('[data-reprocess-photos]');
  if (reprocess) reprocess.onclick = async () => {
    reprocess.disabled = true;
    try {
      for (let index = 0; index < photos.length; index++) {
        reprocess.textContent = `Обрабатываю ${index + 1} из ${photos.length}…`;
        const blob = await api.recognitionPhotoBlob(photos[index].id);
        const prepared = await prepareRecognitionPhoto(new File([blob], `recognition-${photos[index].id}.jpg`, { type: blob.type || 'image/jpeg' }));
        await api.updateRecognitionPhoto(photos[index].id, { data_url: prepared.dataUrl, descriptors: prepared.descriptors });
      }
      toast('Старые фотографии обновлены, фон исключён');
      showRecognitionPhotos(item);
    } catch (error) {
      toast(error.message, true); reprocess.disabled = false;
      reprocess.textContent = 'Повторить обработку старых фото';
    }
  };
  const input = document.getElementById('recognitionFile');
  input.onchange = async () => {
    const file = input.files?.[0]; if (!file) return;
    const label = input.closest('label'); label.classList.add('is-loading');
    try {
      const prepared = await prepareRecognitionPhoto(file);
      await api.addRecognitionPhoto(item.id, { data_url: prepared.dataUrl, descriptors: prepared.descriptors });
      toast('Фотография добавлена, фон удалён'); showRecognitionPhotos(item);
    } catch (error) { toast(error.message, 'error'); label.classList.remove('is-loading'); }
  };
}

// ---------- Выбор файла из files.imcstroy.ru ----------

/**
 * Открывает files.imcstroy.ru во всплывающем окне в режиме выбора файла.
 * Когда пользователь кликает по файлу, окно шлёт нам сообщение и закрывается.
 * onPicked(path, name) вызывается ровно один раз с выбранным файлом.
 */
/**
 * Открывает окно выбора файла в файловом менеджере.
 *
 * startPath — папка, с которой окно откроется. Раньше выбор всегда
 * начинался с корня, и до фотографии прибора надо было доходить руками
 * через «Оборудование → классификация → прибор → Изображения». Теперь
 * вызывающая сторона говорит, где искать, — она это знает.
 *
 * Если папки нет (прибор ещё не сохранён либо заведён до автоматизации),
 * открываем «Оборудование»: всё равно ближе к цели, чем корень.
 */
function openFilemanagerPicker(onPicked, startPath) {
  const origin = encodeURIComponent(location.origin);
  const path = startPath ? `&path=${encodeURIComponent(startPath)}` : '';
  const popup = window.open(
    `${FILEMANAGER_ORIGIN}/?picker=1&origin=${origin}${path}`,
    'filemanager-picker',
    'width=1100,height=720'
  );
  if (!popup) {
    toast('Браузер заблокировал всплывающее окно — разрешите всплывающие окна для этого сайта', true);
    return;
  }
  const handler = (event) => {
    if (event.origin !== FILEMANAGER_ORIGIN) return;
    if (!event.data || event.data.type !== 'filemanager:file-selected') return;
    window.removeEventListener('message', handler);
    onPicked(event.data.path, event.data.name);
  };
  window.addEventListener('message', handler);
}

// ---------- Формы ----------

export function showInstrumentForm(item = null, { copyFrom = null } = {}) {
  const isEdit = Boolean(item);
  const isCopy = Boolean(copyFrom);
  const v = item || (copyFrom ? {
    name: copyFrom.name,
    model: copyFrom.model,
    check_type: copyFrom.check_type,
    control_type: copyFrom.control_type,
    company_code: copyFrom.company_code,
    comment: copyFrom.comment,
    qty: 1,
  } : { check_type: 'verification', comment: '', qty: 1 });

  // Путь к файлу, выбранному в files.imcstroy.ru (если выбрали) —
  // живёт только пока открыта форма, отправляется на сервер при сохранении.
  let pickedPhotoPath = null;
  let pickedDocumentPath = null;

  openModal(isEdit ? 'Редактировать прибор' : isCopy ? 'Добавить экземпляр прибора' : 'Добавить прибор', `
    <form id="instrumentForm" class="form-grid">
      ${isCopy ? `<div class="instrument-copy-note"><b>Новая отдельная карточка</b><span>Общие данные и фото взяты из прибора ${escapeHtml(displayNo(copyFrom))}. Укажите серийный и инвентарный номера, даты и приложите его собственное свидетельство.</span></div>` : ''}
      ${input('inventory_no', 'Инвентарный номер (необязательно)', v.inventory_no || '')}
      ${input('name', 'Название', v.name || '', 'text', true)}
      ${input('serial_number', 'Серийный номер', v.serial_number || '')}
      ${input('model', 'Модель', v.model || '')}
      ${qtyInput('qty', 'Наличие, шт', qtyOf(v), {
        min: Math.max(1, heldQty(v)),
        hint: heldQty(v) ? `на руках ${heldQty(v)} — меньше поставить нельзя` : 'одинаковых штук',
      })}
      ${select('check_type', 'Тип метрологического контроля', v.check_type, [
        ['verification', 'Поверка'],
        ['calibration', 'Калибровка'],
        ['none', 'Не требуется']
      ])}
      ${select('control_type', 'Классификация', v.control_type || '',
        [['', 'Не указано'], ...getControlTypes().map(([code, full, short]) => [code, `${full} (${short})`])])}
      ${select('company_code', 'Владелец', v.company_code || '',
        [['', 'Не привязан'], ...getCompanies()])}
      ${input('verification_date', 'Дата поверки/калибровки', v.verification_date || '', 'date')}
      ${input('valid_until', 'Действительно до', v.valid_until || '', 'date')}
      ${input('comment', 'Комментарий', v.comment || '')}
      <div class="form-field-group">
        <span class="row-subtitle">Фото прибора</span>
        <div class="actions" style="margin-top:4px;">
          <button type="button" class="secondary" data-pick-photo>Выбрать с БД</button>
          <button type="button" class="secondary" data-upload-photo>С компьютера</button>
          <span class="row-subtitle" data-photo-status></span>
        </div>
        <input type="file" accept="image/*" multiple hidden data-photo-input>
      </div>
      <div class="form-field-group">
        <span class="row-subtitle">Фото документа поверки/калибровки</span>
        <div class="actions" style="margin-top:4px;">
          <!-- Съёмку ставим первой: на объекте свидетельство держат в
               руках, а не ищут в папках. Кнопка появляется только там,
               где камера есть, — показывает её код ниже. -->
          <button type="button" class="primary hidden" data-shoot-document>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><circle cx="12" cy="12.5" r="3.5"/></svg>
            Снять камерой
          </button>
          <button type="button" class="secondary" data-pick-document>Выбрать с БД</button>
          <button type="button" class="secondary" data-upload-document>С компьютера</button>
          <span class="row-subtitle" data-document-status></span>
        </div>
        <!-- capture говорит телефону открыть заднюю камеру сразу, минуя
             выбор «камера или галерея». На компьютере он не действует,
             но туда кнопка и не попадает. -->
        <input type="file" multiple hidden data-document-input>
        <input type="file" accept="image/*" capture="environment" hidden data-camera-input>
        <div class="shot-preview hidden" data-shot-preview>
          <img alt="Снимок документа поверки" data-shot-image>
          <div class="shot-preview-side">
            <span class="row-subtitle" data-shot-name></span>
            <span class="shot-hint">Проверьте, читаются ли даты. Снимок уйдёт в папку прибора, когда нажмёте «Сохранить».</span>
            <div class="actions">
              <button type="button" class="secondary" data-shoot-again>Переснять</button>
              <button type="button" class="secondary" data-shot-drop>Убрать</button>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-actions">
        ${isEdit && v.has_photo ? '<button type="button" class="danger" data-remove-photo>Удалить фото</button>' : ''}
        ${isEdit && v.has_document ? '<button type="button" class="danger" data-remove-document>Удалить документ</button>' : ''}
        <button class="primary" type="submit">Сохранить</button>
      </div>
    </form>`);

  const form = document.getElementById('instrumentForm');

  // Количество относится только к одинаковым вспомогательным предметам,
  // которым не нужны собственные свидетельства. Для поверяемого прибора
  // каждый физический экземпляр всегда хранится отдельной карточкой.
  const checkTypeInput = form.querySelector('[name="check_type"]');
  const qtyLabel = form.querySelector('.qty-label');
  const qtyField = form.querySelector('[name="qty"]');
  const syncQtyMode = () => {
    const auxiliary = checkTypeInput.value === 'none';
    qtyLabel.classList.toggle('qty-single-card', !auxiliary);
    qtyLabel.querySelectorAll('[data-qty-step]').forEach((button) => { button.disabled = !auxiliary; });
    qtyField.readOnly = !auxiliary;
    if (!auxiliary && !isEdit) qtyField.value = '1';
    const hint = qtyLabel.querySelector('.qty-hint');
    if (hint) hint.textContent = auxiliary
      ? 'одинаковых вспомогательных приборов в одной карточке'
      : 'для каждого экземпляра создаётся отдельная карточка';
  };
  checkTypeInput.addEventListener('change', syncQtyMode);
  syncQtyMode();

  // Папка прибора известна из карточки. Фото ищем в «Изображениях»,
  // свидетельство — в «Поверке»: там они и лежат, если их клали через
  // эту же форму или из файлового менеджера.
  const EQUIPMENT_ROOT = '/База данных/Оборудование';
  const folderFor = (sub) => (v.folder_path ? `${v.folder_path}/${sub}` : EQUIPMENT_ROOT);

  form.querySelector('[data-pick-photo]').onclick = () => {
    openFilemanagerPicker((path, name) => {
      pickedPhotoPath = path;
      form.querySelector('[data-photo-status]').textContent = `Выбрано: ${name}`;
    }, folderFor('Изображения'));
  };

  form.querySelector('[data-pick-document]').onclick = () => {
    openFilemanagerPicker((path, name) => {
      pickedDocumentPath = path;
      form.querySelector('[data-document-status]').textContent = `Выбрано: ${name}`;
    }, folderFor('Поверка'));
  };

  // Загрузка с компьютера. Раньше файл можно было только выбрать из уже
  // лежащего в файловом менеджере — то есть сначала положить его туда
  // руками, а потом найти. Теперь можно приложить прямо здесь, и файл
  // сам ляжет в папку прибора: снимки в «Изображения», свидетельства
  // в «Поверку». Раскладывает их ИСУ — он один знает, где чья папка.
  for (const kind of ['photo', 'document']) {
    const input = form.querySelector(`[data-${kind}-input]`);
    form.querySelector(`[data-upload-${kind}]`).onclick = () => input.click();
    input.onchange = () => {
      const n = input.files.length;
      form.querySelector(`[data-${kind}-status]`).textContent = n
        ? `С компьютера: ${n === 1 ? input.files[0].name : `${n} файла(ов)`}`
        : '';
      // Выбрали файл с компьютера — значит выбранное «с БД» уже неактуально.
      if (n) { if (kind === 'photo') pickedPhotoPath = null; else pickedDocumentPath = null; }
      // ...и снятое камерой тоже: документ у прибора один, и держать
      // на экране снимок, который уже не пойдёт в дело, — обман.
      if (n && kind === 'document') {
        form.querySelector('[data-shot-preview]').classList.add('hidden');
      }
    };
  }

  /* ------------------------------------------------------------------
     Снять свидетельство камерой.

     На объекте документ держат в руках, а телефон уже в кармане: путь
     «снял — проверил — сохранил» короче любого выбора файлов. Снимок
     идёт ровно тем же путём, что и приложенный с компьютера файл:
     ложится в папку «Поверка» этого прибора в ИСУ, становится его
     документом, а сразу после сохранения открывается привычное окно
     со сроками.

     Подтверждение — это сам предпросмотр: снимок видно, и пока не
     нажато «Сохранить», ничего никуда не ушло. Отдельного вопроса
     «точно?» не задаём: он заставил бы вглядываться в мелкую картинку
     дважды.
     ------------------------------------------------------------------ */
  const shootBtn = form.querySelector('[data-shoot-document]');
  const cameraInput = form.querySelector('[data-camera-input]');
  const shotBox = form.querySelector('[data-shot-preview]');
  let shotUrl = '';

  // Кнопку показываем, только если камера у устройства действительно
  // есть: на настольном компьютере без вебкамеры она бы открыла обычный
  // выбор файлов, то есть повторила бы соседнюю кнопку.
  if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
    navigator.mediaDevices.enumerateDevices()
      .then((devices) => {
        if (devices.some((d) => d.kind === 'videoinput')) shootBtn.classList.remove('hidden');
      })
      .catch(() => { /* не смогли спросить — кнопку не показываем */ });
  }

  const dropShot = () => {
    if (shotUrl) { URL.revokeObjectURL(shotUrl); shotUrl = ''; }
    cameraInput.value = '';
    form.querySelector('[data-document-input]').files = new DataTransfer().files;
    shotBox.classList.add('hidden');
    form.querySelector('[data-document-status]').textContent = '';
  };

  shootBtn.onclick = () => cameraInput.click();
  form.querySelector('[data-shoot-again]').onclick = () => cameraInput.click();
  form.querySelector('[data-shot-drop]').onclick = dropShot;

  cameraInput.onchange = () => {
    const shot = cameraInput.files[0];
    if (!shot) return;

    // Телефоны называют снимки как придётся — от «image.jpg» до
    // случайного набора цифр. Даём имя, по которому файл потом узнают
    // в папке: что это и когда снято. Время в имени не украшение —
    // без него второй снимок за день молча затёр бы первый.
    const now = new Date();
    const two = (n) => String(n).padStart(2, '0');
    const kind = form.querySelector('[name="check_type"]')?.value;
    const what = kind === 'calibration' ? 'Калибровка' : 'Поверка';
    const ext = (shot.name.match(/\.[a-z0-9]+$/i) || ['.jpg'])[0].toLowerCase();
    const name = `${what} ${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`
      + ` ${two(now.getHours())}-${two(now.getMinutes())}${ext}`;

    // Кладём снимок в то же поле, куда попадают файлы с компьютера:
    // дальше форма не должна знать, откуда взялся документ.
    const box = new DataTransfer();
    box.items.add(new File([shot], name, { type: shot.type || 'image/jpeg' }));
    form.querySelector('[data-document-input]').files = box.files;
    pickedDocumentPath = null;

    if (shotUrl) URL.revokeObjectURL(shotUrl);
    shotUrl = URL.createObjectURL(shot);
    form.querySelector('[data-shot-image]').src = shotUrl;
    form.querySelector('[data-shot-name]').textContent = name;
    shotBox.classList.remove('hidden');
    form.querySelector('[data-document-status]').textContent = 'Снято камерой';
  };

  // Снимок мелкий, а проверять надо даты — даём рассмотреть его во весь
  // экран тем же окном, что и документ в карточке.
  form.querySelector('[data-shot-image]').onclick = () => {
    if (shotUrl) showLightbox(shotUrl, 'Снимок документа поверки');
  };

  // Закрыли форму — отпускаем ссылку на снимок, иначе он висел бы
  // в памяти до перезагрузки страницы.
  document.getElementById('modal').addEventListener('close', () => {
    if (shotUrl) URL.revokeObjectURL(shotUrl);
  }, { once: true });

  const removePhoto = form.querySelector('[data-remove-photo]');
  if (removePhoto) {
    removePhoto.onclick = async (event) => {
      if (!confirm('Удалить фото?')) return;
      const ok = await run(() => api.deletePhoto(item.id), { button: event.currentTarget, success: 'Фото удалено' });
      if (ok === null) return;
      closeModal();
      await refresh();
      window.dispatchEvent(new Event('app:refresh-route'));
    };
  }

  const removeDocument = form.querySelector('[data-remove-document]');
  if (removeDocument) {
    removeDocument.onclick = async (event) => {
      if (!confirm('Удалить документ?')) return;
      const ok = await run(() => api.deleteDocument(item.id), { button: event.currentTarget, success: 'Документ удалён' });
      if (ok === null) return;
      closeModal();
      await refresh();
      window.dispatchEvent(new Event('app:refresh-route'));
    };
  }

  form.onsubmit = async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const data = formData(form);
    if (copyFrom?.has_photo) data.copy_photo_from_id = copyFrom.id;

    // Приложили ли новый документ поверки — неважно, с БД или с компьютера.
    // Если да, после сохранения покажем его и спросим сроки: сроки берутся
    // с самого документа, а он в этот момент уже перед глазами.
    const documentAdded = Boolean(pickedDocumentPath) ||
      form.querySelector('[data-document-input]').files.length > 0;
    let uploadProblem = '';

    const result = await run(async () => {
      const saved = isEdit
        ? await api.updateInstrument(item.id, data)
        : await api.createInstrument(data);

      if (pickedPhotoPath) {
        await api.linkPhoto(saved.id, pickedPhotoPath);
      }
      if (pickedDocumentPath) {
        await api.linkDocument(saved.id, pickedDocumentPath);
      }

      // Файлы с компьютера кладём после сохранения: до него у прибора
      // нет номера, а значит и папки, в которую их класть.
      //
      // Неудача здесь не отменяет сохранения: прибор уже в базе, и
      // ронять из-за картинки всю форму — значит заставить человека
      // сохранять второй раз и завести двойника. Запоминаем, что не
      // вышло, и скажем об этом отдельно.
      try {
        await uploadToInstrumentFolder(saved.id, form.querySelector('[data-photo-input]').files, 'photo');
        await uploadToInstrumentFolder(saved.id, form.querySelector('[data-document-input]').files, 'document');
      } catch (err) {
        uploadProblem = err.message || 'Файлы не загрузились — прибор сохранён без них';
      }

      return saved;
    }, { button, success: isEdit ? 'Изменения сохранены' : isCopy ? 'Экземпляр добавлен' : 'Прибор добавлен' });

    if (result === null) return;
    if (uploadProblem) toast(uploadProblem, true);
    if (documentAdded) {
      await askVerificationDates({ ...result, check_type: data.check_type || result.check_type });
    }
    closeModal();
    await refresh();
    // Открываем карточку сохранённого прибора без перезагрузки страницы
    history.pushState(null, '', `?id=${result.id}`);
    window.dispatchEvent(new Event('app:refresh-route'));
  };
}

/**
 * Кладёт выбранные с компьютера файлы в папку прибора.
 *
 * Идёт напрямую в ИСУ по относительным адресам: оба сервиса живут на
 * одном домене (files.<домен>), общий вход действует на обоих, и своего
 * приёма файлов «Учёту» заводить не надо — используется тот же
 * /api/upload, что и везде в файловом менеджере.
 *
 * Первый файл становится фотографией карточки (или её документом):
 * приложили новое свидетельство — карточка показывает новое, а не
 * прошлогоднее.
 *
 * Если ИСУ недоступен — говорим об этом, но сам прибор уже сохранён:
 * терять карточку из-за неудачной загрузки картинки нельзя.
 */
async function uploadToInstrumentFolder(instrumentId, fileList, kind) {
  const files = Array.from(fileList || []);
  if (!files.length) return;

  const base = window.FILEMANAGER_BASE || '';
  const dirRes = await fetch(`${base}/api/equipment/upload-dir?id=${instrumentId}&kind=${kind}`,
    { credentials: 'include' });
  if (!dirRes.ok) throw new Error('Файловый менеджер не принял файлы — прибор сохранён без них');
  const { path: dir } = await dirRes.json();

  let first = true;
  for (const file of files) {
    const form = new FormData();
    form.append('file', file);
    form.append('path', dir);
    form.append('relativePath', file.name);
    const res = await fetch(`${base}/api/upload`, { method: 'POST', credentials: 'include', body: form });
    if (!res.ok) throw new Error(`Не удалось загрузить «${file.name}»`);
    if (first) {
      await fetch(`${base}/api/equipment/adopt-file`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: instrumentId, path: `${dir}/${file.name}`, kind }),
      }).catch(() => {});
      first = false;
    }
  }
}

function showTakeForm(item) {
  const multi = isMultiItem(item);
  const free = freeQty(item);
  if (multi && free <= 0) return toast('Свободных штук нет', true);

  openModal('Взять прибор', `
    <form id="takeForm" class="form-grid">
      ${field('Кто берёт', state.currentUser.name)}
      ${multi ? qtyInput('qty', 'Сколько штук', 1,
        { min: 1, max: free, hint: `свободно ${free} из ${qtyOf(item)}` }) : ''}
      ${input('taken_where', 'Место использования', '')}
      ${input('taken_extra', 'Доп. данные', state.currentUser.extra || '')}
      ${input('taken_at', 'Дата', today(), 'date')}
      <div class="modal-actions"><button class="primary" type="submit">Взять</button></div>
    </form>`);

  document.getElementById('takeForm').onsubmit = async (event) => {
    event.preventDefault();
    const button = event.target.querySelector('button[type="submit"]');
    const result = await run(
      () => api.issue(item.id, formData(event.target)),
      { button, success: 'Прибор выдан' }
    );
    if (result === null) return;
    closeModal();
    await refresh();
    window.dispatchEvent(new Event('app:refresh-route'));
  };
}

/**
 * Возврат штук многоштучного прибора.
 *
 * По умолчанию возвращается ВСЁ, что у человека на руках: так и бывает
 * почти всегда — сдают то, что брали. Но если взяли три фонаря, а вернуть
 * готовы два, число можно уменьшить.
 */
function showReturnForm(item, holderId) {
  const holding = myHolding(item, holderId);
  if (!holding) return toast('За этим человеком ничего не числится', true);

  const mine = String(holderId) === String(state.currentUser.id);
  openModal('Вернуть прибор', `
    <form id="returnForm" class="form-grid">
      ${field('Кто возвращает', holding.name)}
      ${qtyInput('qty', 'Сколько штук', holding.qty,
        { min: 1, max: holding.qty, hint: `на руках ${holding.qty}` })}
      ${mine ? '' : '<p class="row-subtitle">Возврат за другого сотрудника попадёт в историю прибора.</p>'}
      <div class="modal-actions"><button class="primary" type="submit">Вернуть</button></div>
    </form>`);

  document.getElementById('returnForm').onsubmit = async (event) => {
    event.preventDefault();
    const button = event.target.querySelector('button[type="submit"]');
    const result = await run(
      () => api.return(item.id, { ...formData(event.target), holder_id: holding.user_id }),
      { button, success: 'Прибор возвращён' }
    );
    if (result === null) return;
    closeModal();
    await refresh();
    window.dispatchEvent(new Event('app:refresh-route'));
  };
}

function showTransferForm(item) {
  const others = state.users.filter((u) => u.id !== item.taken_by);
  if (!others.length) return toast('Некому передавать', true);

  // "Доп. данные" подставляем из профиля выбранного пользователя — но поле
  // остаётся обычным текстовым, его можно поправить вручную перед передачей.
  const extraByUserId = Object.fromEntries(others.map((u) => [u.id, u.extra || '']));

  openModal('Передать прибор', `
    <form id="transferForm" class="form-grid">
      ${select('to_user_id', 'Новый пользователь', '', others.map((u) => [u.id, u.name]))}
      ${input('taken_where', 'Место использования', item.taken_where || '')}
      ${input('taken_extra', 'Доп. данные', extraByUserId[others[0].id] || '')}
      <p class="row-subtitle">Прибор перейдёт к новому пользователю только после того, как он сам подтвердит приём.</p>
      <div class="modal-actions"><button class="primary" type="submit">Предложить передачу</button></div>
    </form>`);

  const form = document.getElementById('transferForm');
  form.querySelector('[name="to_user_id"]').addEventListener('change', (event) => {
    form.querySelector('[name="taken_extra"]').value = extraByUserId[event.target.value] || '';
  });

  form.onsubmit = async (event) => {
    event.preventDefault();
    const button = event.target.querySelector('button[type="submit"]');
    const result = await run(
      () => api.transfer(item.id, formData(event.target)),
      { button, success: 'Передача предложена, ожидает подтверждения' }
    );
    if (result === null) return;
    closeModal();
    await refresh();
    window.dispatchEvent(new Event('app:refresh-route'));
  };
}

function showBookForm(item) {
  openModal('Забронировать прибор', `
    <form id="bookForm" class="form-grid">
      ${field('Кто бронирует', state.currentUser.name)}
      ${input('booked_where', 'Куда бронируем (место использования)', '')}
      ${input('booked_for', 'Дата бронирования', today(), 'date', true)}
      ${input('booked_extra', 'Доп. информация', state.currentUser.extra || '')}
      <div class="modal-actions"><button class="primary" type="submit">Забронировать</button></div>
    </form>`);

  document.getElementById('bookForm').onsubmit = async (event) => {
    event.preventDefault();
    const button = event.target.querySelector('button[type="submit"]');
    const result = await run(
      () => api.book(item.id, formData(event.target)),
      { button, success: 'Прибор забронирован' }
    );
    if (result === null) return;
    closeModal();
    await refresh();
    window.dispatchEvent(new Event('app:refresh-route'));
  };
}

// ---------- История прибора ----------

const ACTION_TEXT = {
  create: 'Добавлен', update: 'Изменён', delete: 'Удалён',
  issue: 'Выдан', return: 'Возвращён', transfer: 'Передан',
  book: 'Забронирован', cancel_booking: 'Бронь отменена',
  confirm_booking: 'Бронь подтверждена',
  retire: 'Списан', restore: 'Восстановлен'
};

async function showHistory(item) {
  openModal('История', '<div class="list">Загрузка...</div>');
  let rows;
  try {
    rows = await api.instrumentHistory(item.id);
  } catch (err) {
    return openModal('История', `<div class="panel card">${escapeHtml(err.message)}</div>`);
  }

  const html = rows.length
    ? rows.map((row) => `
      <div class="row panel">
        <div>
          <div class="row-title">${escapeHtml(ACTION_TEXT[row.action] || row.action)}</div>
          <div class="row-subtitle">
            ${escapeHtml(new Date(row.created_at).toLocaleString('ru'))} ·
            ${escapeHtml(row.actor_name)}
            ${row.note ? ' · ' + escapeHtml(row.note) : ''}
            ${row.place ? ' · ' + escapeHtml(row.place) : ''}
          </div>
        </div>
      </div>`).join('')
    : '<div class="panel card">Событий пока нет</div>';

  openModal(`История: ${item.name}`, `<div class="list">${html}</div>`);
}

// ---------- Управление классификациями (только администратор) ----------

export async function showControlTypesManager() {
  openModal('Классификации', '<p class="qr-caption">Загрузка...</p>');
  let list;
  try {
    list = await api.listControlTypes();
  } catch (err) {
    return openModal('Классификации', `<p class="qr-caption">${escapeHtml(err.message)}</p>`);
  }
  renderControlTypesManager(list);
}

function renderControlTypesManager(list) {
  const rows = list.map((t) => `
    <div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--line);">
      <div style="flex:1; min-width:0;">
        <strong>${escapeHtml(t.full_name)}</strong> (${escapeHtml(t.short_name)})
        <div style="font-size:12px; color:var(--muted);">код: ${escapeHtml(t.code)}</div>
      </div>
      <button type="button" class="danger" data-delete-code="${escapeHtml(t.code)}">Удалить</button>
    </div>`).join('');

  openModal('Классификации', `
    <div style="max-height:300px; overflow-y:auto;">${rows || '<p class="qr-caption">Пока пусто</p>'}</div>
    <form id="addControlTypeForm" class="form-grid" style="margin-top:16px;">
      <div class="row-subtitle">Добавить новую</div>
      ${input('code', 'Код (латиницей, без пробелов)', '')}
      ${input('full_name', 'Полное название', '')}
      ${input('short_name', 'Короткое название', '')}
      <div class="modal-actions"><button class="primary" type="submit">Добавить</button></div>
    </form>`);

  document.querySelectorAll('[data-delete-code]').forEach((btn) => {
    btn.onclick = async () => {
      const code = btn.dataset.deleteCode;
      if (!confirm(`Удалить классификацию «${code}»?`)) return;
      try {
        await api.deleteControlType(code);
        await showControlTypesManager();
        window.dispatchEvent(new Event('app:control-types-changed'));
      } catch (err) {
        alert('Не удалось удалить: ' + err.message);
      }
    };
  });

  document.getElementById('addControlTypeForm').onsubmit = async (event) => {
    event.preventDefault();
    const button = event.target.querySelector('button[type="submit"]');
    const data = formData(event.target);
    const result = await run(() => api.createControlType(data), { button, success: 'Классификация добавлена' });
    if (result === null) return;
    await showControlTypesManager();
    window.dispatchEvent(new Event('app:control-types-changed'));
  };
}

// ---------- Управление компаниями (только администратор) ----------

export async function showCompaniesManager() {
  openModal('Компании', '<p class="qr-caption">Загрузка...</p>');
  let list;
  try {
    list = await api.listCompanies();
  } catch (err) {
    return openModal('Компании', `<p class="qr-caption">${escapeHtml(err.message)}</p>`);
  }
  renderCompaniesManager(list);
}

function renderCompaniesManager(list) {
  const rows = list.map((c) => `
    <div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--line);">
      <div style="flex:1; min-width:0;">
        <strong>${escapeHtml(c.name)}</strong>
        <div style="font-size:12px; color:var(--muted);">код: ${escapeHtml(c.code)}</div>
      </div>
      <button type="button" class="danger" data-delete-code="${escapeHtml(c.code)}">Удалить</button>
    </div>`).join('');

  openModal('Компании', `
    <div style="max-height:300px; overflow-y:auto;">${rows || '<p class="qr-caption">Пока пусто</p>'}</div>
    <form id="addCompanyForm" class="form-grid" style="margin-top:16px;">
      <div class="row-subtitle">Добавить новую</div>
      ${input('code', 'Код (латиницей, без пробелов)', '')}
      ${input('name', 'Название', '')}
      <div class="modal-actions"><button class="primary" type="submit">Добавить</button></div>
    </form>`);

  document.querySelectorAll('[data-delete-code]').forEach((btn) => {
    btn.onclick = async () => {
      const code = btn.dataset.deleteCode;
      if (!confirm(`Удалить компанию «${code}»?`)) return;
      try {
        await api.deleteCompany(code);
        await showCompaniesManager();
        window.dispatchEvent(new Event('app:companies-changed'));
      } catch (err) {
        alert('Не удалось удалить: ' + err.message);
      }
    };
  });

  document.getElementById('addCompanyForm').onsubmit = async (event) => {
    event.preventDefault();
    const button = event.target.querySelector('button[type="submit"]');
    const data = formData(event.target);
    const result = await run(() => api.createCompany(data), { button, success: 'Компания добавлена' });
    if (result === null) return;
    await showCompaniesManager();
    window.dispatchEvent(new Event('app:companies-changed'));
  };
}

// ---------- Передачи, ожидающие подтверждения ----------

/**
 * Показывает/прячет кнопку-"уведомление" о передачах, ожидающих решения
 * ИМЕННО текущего пользователя. Вызывается при каждом рендере списка —
 * так индикатор всегда в актуальном состоянии, без отдельного опроса сервера.
 */
function updatePendingTransfersIndicator() {
  const btn = document.getElementById('pendingTransfersBtn');
  const countEl = document.getElementById('pendingTransfersCount');
  if (!btn || !countEl || !state.currentUser) return;

  const count = (state.instruments || []).filter(
    (i) => Number(i.pending_transfer_to) === Number(state.currentUser.id)
  ).length;

  countEl.textContent = count;
  btn.style.display = count > 0 ? 'inline-flex' : 'none';
}

function reportBulkTransferDecision(result, verb) {
  const { succeeded = [], failed = [] } = result || {};
  if (!failed.length) {
    toast(`Готово: ${succeeded.length} — ${verb}`);
  } else {
    const details = failed.map((f) => f.message).join('; ');
    toast(`${verb}: ${succeeded.length}. Не удалось: ${failed.length} — ${details}`, true);
  }
}

/** Окно со списком приборов, которые кто-то передаёт текущему пользователю. */
export function showPendingTransfersModal() {
  const pending = (state.instruments || []).filter(
    (i) => Number(i.pending_transfer_to) === Number(state.currentUser?.id)
  );
  if (!pending.length) {
    return toast('Нет передач, ожидающих вашего решения');
  }

  const rows = pending.map((item) => `
    <label style="display:flex; align-items:flex-start; gap:10px; padding:10px; border:1px solid var(--line); border-radius:8px; cursor:pointer;">
      <input type="checkbox" class="pending-transfer-checkbox" value="${item.id}" checked
             style="margin-top:3px; flex-shrink:0; width:16px; height:16px; accent-color:var(--primary);">
      <div style="flex:1; min-width:0;">
        <div style="font-weight:600;">${escapeHtml(displayNo(item))} ${escapeHtml(item.name)}</div>
        <div style="font-size:13px; color:var(--muted);">
          от ${escapeHtml(item.taken_by_name || '—')}${item.pending_transfer_where ? ` · место: ${escapeHtml(item.pending_transfer_where)}` : ''}
        </div>
      </div>
    </label>`).join('');

  openModal(`Передачи, ожидающие подтверждения (${pending.length})`, `
    <div style="display:flex; flex-direction:column; gap:8px; max-height:50vh; overflow-y:auto;">${rows}</div>
    <div class="modal-actions">
      <button class="danger" type="button" data-reject-selected>Отклонить выбранные</button>
      <button class="primary" type="button" data-accept-selected>Принять выбранные</button>
    </div>`);

  const selectedIds = () =>
    Array.from(document.querySelectorAll('.pending-transfer-checkbox:checked')).map((cb) => Number(cb.value));

  document.querySelector('[data-accept-selected]').onclick = async (event) => {
    const ids = selectedIds();
    if (!ids.length) return toast('Ничего не выбрано', true);
    const result = await run(() => api.bulkAcceptTransfer(ids), { button: event.currentTarget });
    if (result === null) return;
    closeModal();
    reportBulkTransferDecision(result, 'принято');
    await refresh();
    window.dispatchEvent(new Event('app:refresh-route'));
  };

  document.querySelector('[data-reject-selected]').onclick = async (event) => {
    const ids = selectedIds();
    if (!ids.length) return toast('Ничего не выбрано', true);
    if (!confirm(`Отклонить передачу ${ids.length} прибор(ов)? Они останутся у прежнего держателя.`)) return;
    const result = await run(() => api.bulkRejectTransfer(ids), { button: event.currentTarget });
    if (result === null) return;
    closeModal();
    reportBulkTransferDecision(result, 'отклонено');
    await refresh();
    window.dispatchEvent(new Event('app:refresh-route'));
  };
}

// ---------- Прочее ----------

function showQr(item) {
  const url = `${location.origin}${location.pathname}?id=${encodeURIComponent(item.id)}`;
  openModal('QR-код', `
    <div id="qrBox" class="qr-box"></div>
    <p class="qr-caption">${escapeHtml(item.name)}</p>
    <div class="modal-actions"><button class="primary" data-download-qr>Скачать</button></div>`);

  new QRCode(document.getElementById('qrBox'), { text: url, width: 220, height: 220 });

  document.querySelector('[data-download-qr]').onclick = () => {
    const box = document.getElementById('qrBox');
    const source = box.querySelector('canvas')?.toDataURL('image/png') || box.querySelector('img')?.src;
    if (!source) return toast('QR-код ещё не готов', true);
    const link = document.createElement('a');
    link.href = source;
    link.download = `qr-${item.id}.png`;
    link.click();
  };
}

/**
 * Приложили новый документ поверки — показываем его и спрашиваем сроки.
 *
 * Сроки написаны на самом свидетельстве, и переписывать их по памяти,
 * закрыв документ, — лишний повод ошибиться. Поэтому документ остаётся
 * перед глазами, а под ним стоят обе даты, уже заполненные тем, что
 * сейчас в карточке. Не тронули — останется как было; поправили —
 * сохранится поправленное.
 *
 * Всегда завершается: и «Сохранить сроки», и «Оставить как было», и
 * крестик закрытия одинаково возвращают управление форме, чтобы она
 * могла открыть карточку прибора.
 */
async function askVerificationDates(item) {
  // «Новая поверка», «Новая калибровка», «Новый документ» — род разный,
  // поэтому подпись собирается целиком, а не приклеиванием слова.
  const title = item.check_type === 'calibration' ? 'Новая калибровка — сроки'
    : item.check_type === 'verification' ? 'Новая поверка — сроки'
    : 'Новый документ — сроки';
  openModal(title, '<p class="qr-caption">Загрузка документа…</p>');

  const result = await api.documentUrl(item.id);
  const isImage = Boolean(result) && (result.contentType || '').startsWith('image/');

  // Документ мог не открыться (или это PDF, который в модалке не покажешь) —
  // спросить сроки всё равно надо, просто без картинки.
  const preview = isImage
    ? `<div class="verif-dates-preview"><img src="${result.url}" alt="Документ поверки"></div>`
    : `<p class="verif-dates-hint">${result
        ? 'Файл нельзя показать прямо здесь — откройте его в соседней вкладке.'
        : 'Документ не удалось загрузить, но сроки можно вписать и так.'}
       ${result ? '<button type="button" class="secondary" data-open-doc>Открыть документ</button>' : ''}</p>`;

  openModal(title, `
    <form id="verificationDatesForm">
      ${preview}
      <p class="verif-dates-hint">Сверьте сроки с документом. Оставите как есть — даты не изменятся.</p>
      <div class="form-grid">
        ${input('verification_date', dateFieldLabel(item.check_type), item.verification_date || '', 'date')}
        ${input('valid_until', validUntilLabel(item.check_type), item.valid_until || '', 'date')}
      </div>
      <div class="modal-actions">
        <button type="button" class="secondary" data-keep-dates>Оставить как было</button>
        <button class="primary" type="submit">Сохранить сроки</button>
      </div>
    </form>`);

  const modal = document.getElementById('modal');
  const form = document.getElementById('verificationDatesForm');

  const openDoc = form.querySelector('[data-open-doc]');
  if (openDoc) openDoc.onclick = () => window.open(result.url, '_blank');

  // Сроки написаны на свидетельстве мелко: в рамке окна их видно, но не
  // прочитать. Щелчок по картинке открывает её во весь экран.
  const shot = form.querySelector('.verif-dates-preview img');
  if (shot) shot.onclick = () => showLightbox(shot.src, documentButtonLabel(item.check_type));

  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };

    // Закрыли крестиком или Esc — это тоже ответ «оставить как было».
    modal.addEventListener('close', finish, { once: true });
    form.querySelector('[data-keep-dates]').onclick = finish;

    form.onsubmit = async (event) => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      const dates = {
        verification_date: form.querySelector('[name="verification_date"]').value || null,
        valid_until: form.querySelector('[name="valid_until"]').value || null
      };

      // Ничего не поменяли — незачем и запрос слать.
      if (dates.verification_date === (item.verification_date || null) &&
          dates.valid_until === (item.valid_until || null)) {
        return finish();
      }

      const saved = await run(() => api.updateInstrument(item.id, dates),
        { button, success: 'Сроки сохранены' });
      if (saved === null) return;
      finish();
    };
  });
}

/**
 * Раньше документ был всегда картинкой. Теперь, если он привязан из
 * files.imcstroy.ru, это может быть PDF, docx и что угодно ещё —
 * показываем превью только для картинок, иначе даём кнопку "Открыть".
 */
async function showDocument(item) {
  const title = documentButtonLabel(item.check_type);
  openModal(title, '<p class="qr-caption">Загрузка...</p>');

  const result = await api.documentUrl(item.id);
  if (!result) {
    return openModal(title, '<p class="qr-caption">Не удалось загрузить документ</p>');
  }

  const { url, contentType } = result;
  const isImage = contentType.startsWith('image/');

  const preview = isImage
    ? `<div class="qr-box"><img src="${url}" alt="Фото документа" class="document-photo"></div>`
    : `<p class="qr-caption">Файл: ${escapeHtml(contentType || 'неизвестный тип')}</p>`;

  openModal(title, `
    ${preview}
    <p class="qr-caption">${escapeHtml(item.name)}</p>
    <div class="modal-actions">
      ${isImage ? '' : '<button class="secondary" data-open-document>Открыть в новой вкладке</button>'}
      <button class="primary" data-download-document>Скачать</button>
    </div>`);

  const openBtn = document.querySelector('[data-open-document]');
  if (openBtn) {
    openBtn.onclick = () => window.open(url, '_blank');
  }

  const shot = document.querySelector('.document-photo');
  if (shot) shot.onclick = () => showLightbox(shot.src, `${title} · ${item.name}`);

  document.querySelector('[data-download-document]').onclick = () => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `document-${item.id}`;
    link.click();
  };
}

async function copyInfo(item) {
  const text = [
    `Номер: ${displayNo(item)}`,
    `Название: ${item.name}`,
    `Серийный номер: ${item.serial_number || '—'}`,
    `Модель: ${item.model || '—'}`,
    `Тип: ${checkTypeText(item.check_type)}`,
    `Классификация: ${controlTypeFull(item.control_type)}`,
    `Действительно до: ${item.valid_until || '—'}`
  ].join('\n');

  try {
    await navigator.clipboard.writeText(text);
    toast('Информация скопирована');
  } catch {
    toast('Браузер не разрешил копирование', true);
  }
}
