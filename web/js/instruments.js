import { api } from './api.js';
import { state, refresh, isAdmin } from './state.js';
import {
  escapeAttr, escapeHtml, formData, today, displayNo,
  verificationBadge, verificationText, verificationState,
  statusBadge, statusText, checkTypeText
} from './utils.js';
import { closeModal, field, input, openModal, select, toast, run } from './ui.js';

// Адрес файлового менеджера. Поменяйте здесь, если домен когда-нибудь изменится.
const FILEMANAGER_ORIGIN = 'https://files.imcstroy.ru';

/** Клиентская фильтрация уже загруженного списка. */
export function filteredInstruments() {
  const q = state.search.trim().toLowerCase();

  return state.instruments.filter((i) => {
    const matchesSearch = !q || [i.name, i.serial_number, i.model, i.inventory_no]
      .some((v) => String(v || '').toLowerCase().includes(q));

    const matchesVerification = state.verification === 'all' ||
      verificationState(i.valid_until) === state.verification;

    const matchesStatus = state.condition === 'all' || i.status === state.condition;

    return matchesSearch && matchesVerification && matchesStatus;
  });
}

export function renderList(openCard) {
  const list = filteredInstruments();
  const showCheckboxes = isAdmin() && state.massMode;

  const html = list.length
    ? list.map((item) => `
      <div class="row panel${showCheckboxes ? ' row-selectable' : ''}">
        ${showCheckboxes
          ? `<input type="checkbox" class="instrument-checkbox" value="${escapeAttr(item.id)}">`
          : ''}
        <a class="row-link" href="?id=${escapeAttr(item.id)}" data-open-id="${escapeAttr(item.id)}">
          <div>
            <div class="row-title">${escapeHtml(displayNo(item))} ${escapeHtml(item.name)}</div>
            <div class="row-subtitle">
              ${escapeHtml(item.model || 'Модель не указана')} ·
              ${escapeHtml(item.serial_number || 'Серийный номер не указан')}
            </div>
          </div>
          <div class="row-status-group">
            <div class="row-status-col">
              <span class="badge ${verificationBadge(item.valid_until)}">${verificationText(item.valid_until)}</span>
            </div>
            <div class="row-status-col">
              <span class="badge ${statusBadge(item.status)}">${statusText(item.status)}</span>
            </div>
          </div>
        </a>
      </div>`).join('')
    : '<div class="panel card">Нет приборов по выбранным условиям</div>';

  document.getElementById('instrumentList').innerHTML = html;
  document.querySelectorAll('[data-open-id]').forEach((node) => {
    node.onclick = (event) => {
      event.preventDefault();
      openCard(node.dataset.openId);
    };
  });
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

  // ---------- Кнопки ----------
  let main = '';
  let danger = '';

  if (item.status === 'retired') {
    if (admin) {
      main += '<button class="primary" data-restore>Восстановить</button>';
      main += '<button class="secondary" data-edit>Редактировать</button>';
      danger += '<button class="danger" data-delete>Удалить</button>';
    }
  } else if (item.status === 'free') {
    main += '<button class="primary" data-issue>Взять</button>';
    main += '<button class="secondary" data-book>Забронировать</button>';
  } else if (item.status === 'booked') {
    if (isBookedByMe || admin) {
      main += '<button class="primary" data-confirm-booking>Подтвердить бронирование</button>';
      main += '<button class="danger" data-cancel-booking>Отменить бронирование</button>';
    } else {
      main += `<span class="badge warn">Забронирован: ${escapeHtml(item.booked_by_name || '')}</span>`;
    }
  } else if (item.status === 'busy') {
    if (isOwner || admin) {
      main += '<button class="primary" data-return>Вернуть</button>';
      main += '<button class="secondary" data-transfer>Передать</button>';
    } else {
      main += `<span class="badge warn">Занят: ${escapeHtml(item.taken_by_name || '')}</span>`;
    }
  }

  main += '<button class="secondary" data-qr>QR</button>';
  if (item.has_document) {
    main += '<button class="secondary" data-document>Документ</button>';
  }
  main += '<button class="secondary" data-copy>Копировать</button>';
  main += '<button class="secondary" data-history>История</button>';

  if (admin && item.status !== 'retired') {
    main += '<button class="secondary" data-edit>Редактировать</button>';
    danger += '<button class="danger" data-retire>Списать</button>';
    danger += '<button class="danger" data-delete>Удалить</button>';
  }

  // ---------- Блок «кто держит» ----------
  let holder = '';
  if (item.status === 'busy') {
    holder = `<div class="issued">
      ${field('Кто взял', item.taken_by_name)}
      ${field('Место', item.taken_where)}
      ${field('Доп. данные', item.taken_extra)}
      ${field('Дата выдачи', item.taken_at)}
    </div>`;
  } else if (item.status === 'booked') {
    holder = `<div class="issued booked">
      ${field('Забронировал', item.booked_by_name)}
      ${field('Дата бронирования', item.booked_for)}
      ${field('Доп. информация', item.booked_extra)}
    </div>`;
  } else if (item.status === 'retired') {
    holder = `<div class="issued retired">${field('Дата списания', item.retired_at)}</div>`;
  }

  screen.innerHTML = `
    <article class="panel card">
      ${item.has_photo ? '<div class="photo-box" id="photoBox">Загрузка фото...</div>' : ''}
      <h1>${escapeHtml(item.name)}</h1>
      <div class="badges badges-left">
        <span class="badge ${verificationBadge(item.valid_until)}">${verificationText(item.valid_until)}</span>
        <span class="badge ${statusBadge(item.status)}">${statusText(item.status)}</span>
      </div>
      <div class="card-grid">
        ${field('Номер', displayNo(item))}
        ${field('Серийный номер', item.serial_number)}
        ${field('Модель', item.model)}
        ${field('Тип', checkTypeText(item.check_type))}
        ${field('Дата поверки/калибровки', item.verification_date)}
        ${field('Действительно до', item.valid_until)}
      </div>
      ${item.comment ? field('Комментарий', item.comment) : ''}
      ${holder}
      <div class="actions">${main}</div>
      <div class="actions">${danger}<span class="spacer"></span>
        <button class="secondary" data-back>К списку</button></div>
    </article>`;

  // Фото подгружаем отдельным запросом — оно не тормозит отрисовку карточки
  if (item.has_photo) {
    api.photoUrl(item.id).then((url) => {
      const box = document.getElementById('photoBox');
      if (box && url) box.innerHTML = `<img src="${url}" alt="Фото прибора">`;
    });
  }

  bindCardActions(item, goList);
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
  on('[data-qr]', () => showQr(item));
  on('[data-document]', () => showDocument(item));
  on('[data-copy]', () => copyInfo(item));
  on('[data-history]', () => showHistory(item));

  on('[data-return]', (b) => after(b, () => api.return(item.id), 'Прибор возвращён'));
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

// ---------- Выбор файла из files.imcstroy.ru ----------

/**
 * Открывает files.imcstroy.ru во всплывающем окне в режиме выбора файла.
 * Когда пользователь кликает по файлу, окно шлёт нам сообщение и закрывается.
 * onPicked(path, name) вызывается ровно один раз с выбранным файлом.
 */
function openFilemanagerPicker(onPicked) {
  const origin = encodeURIComponent(location.origin);
  const popup = window.open(
    `${FILEMANAGER_ORIGIN}/?picker=1&origin=${origin}`,
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

export function showInstrumentForm(item = null) {
  const isEdit = Boolean(item);
  const v = item || { check_type: 'verification', comment: '' };

  // Путь к файлу, выбранному в files.imcstroy.ru (если выбрали) —
  // живёт только пока открыта форма, отправляется на сервер при сохранении.
  let pickedPhotoPath = null;
  let pickedDocumentPath = null;

  openModal(isEdit ? 'Редактировать прибор' : 'Добавить прибор', `
    <form id="instrumentForm" class="form-grid">
      ${input('inventory_no', 'Инвентарный номер (необязательно)', v.inventory_no || '')}
      ${input('name', 'Название', v.name || '', 'text', true)}
      ${input('serial_number', 'Серийный номер', v.serial_number || '')}
      ${input('model', 'Модель', v.model || '')}
      ${select('check_type', 'Тип', v.check_type, [['verification', 'Поверка'], ['calibration', 'Калибровка']])}
      ${input('verification_date', 'Дата поверки/калибровки', v.verification_date || '', 'date')}
      ${input('valid_until', 'Действительно до', v.valid_until || '', 'date')}
      ${input('comment', 'Комментарий', v.comment || '')}
      <div class="form-field-group">
        <span class="row-subtitle">Фото прибора</span>
        <div class="actions" style="margin-top:4px;">
          <button type="button" class="secondary" data-pick-photo>Выбрать с БД</button>
          <span class="row-subtitle" data-photo-status></span>
        </div>
      </div>
      <div class="form-field-group">
        <span class="row-subtitle">Фото документа поверки/калибровки</span>
        <div class="actions" style="margin-top:4px;">
          <button type="button" class="secondary" data-pick-document>Выбрать с БД</button>
          <span class="row-subtitle" data-document-status></span>
        </div>
      </div>
      <div class="modal-actions">
        ${isEdit && v.has_photo ? '<button type="button" class="danger" data-remove-photo>Удалить фото</button>' : ''}
        ${isEdit && v.has_document ? '<button type="button" class="danger" data-remove-document>Удалить документ</button>' : ''}
        <button class="primary" type="submit">Сохранить</button>
      </div>
    </form>`);

  const form = document.getElementById('instrumentForm');

  form.querySelector('[data-pick-photo]').onclick = () => {
    openFilemanagerPicker((path, name) => {
      pickedPhotoPath = path;
      form.querySelector('[data-photo-status]').textContent = `Выбрано: ${name}`;
    });
  };

  form.querySelector('[data-pick-document]').onclick = () => {
    openFilemanagerPicker((path, name) => {
      pickedDocumentPath = path;
      form.querySelector('[data-document-status]').textContent = `Выбрано: ${name}`;
    });
  };

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

      return saved;
    }, { button, success: isEdit ? 'Изменения сохранены' : 'Прибор добавлен' });

    if (result === null) return;
    closeModal();
    await refresh();
    // Открываем карточку сохранённого прибора без перезагрузки страницы
    history.pushState(null, '', `?id=${result.id}`);
    window.dispatchEvent(new Event('app:refresh-route'));
  };
}

function showTakeForm(item) {
  openModal('Взять прибор', `
    <form id="takeForm" class="form-grid">
      ${field('Кто берёт', state.currentUser.username)}
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

function showTransferForm(item) {
  const others = state.users.filter((u) => u.id !== item.taken_by);
  if (!others.length) return toast('Некому передавать', true);

  openModal('Передать прибор', `
    <form id="transferForm" class="form-grid">
      ${select('to_user_id', 'Новый пользователь', '', others.map((u) => [u.id, u.username]))}
      ${input('taken_where', 'Место использования', item.taken_where || '')}
      ${input('taken_extra', 'Доп. данные', item.taken_extra || '')}
      <div class="modal-actions"><button class="primary" type="submit">Передать</button></div>
    </form>`);

  document.getElementById('transferForm').onsubmit = async (event) => {
    event.preventDefault();
    const button = event.target.querySelector('button[type="submit"]');
    const result = await run(
      () => api.transfer(item.id, formData(event.target)),
      { button, success: 'Прибор передан' }
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
      ${field('Кто бронирует', state.currentUser.username)}
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
 * Раньше документ был всегда картинкой. Теперь, если он привязан из
 * files.imcstroy.ru, это может быть PDF, docx и что угодно ещё —
 * показываем превью только для картинок, иначе даём кнопку "Открыть".
 */
async function showDocument(item) {
  openModal('Документ', '<p class="qr-caption">Загрузка...</p>');

  const result = await api.documentUrl(item.id);
  if (!result) {
    return openModal('Документ', '<p class="qr-caption">Не удалось загрузить документ</p>');
  }

  const { url, contentType } = result;
  const isImage = contentType.startsWith('image/');

  const preview = isImage
    ? `<div class="qr-box"><img src="${url}" alt="Фото документа" class="document-photo"></div>`
    : `<p class="qr-caption">Файл: ${escapeHtml(contentType || 'неизвестный тип')}</p>`;

  openModal('Документ', `
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
    `Действительно до: ${item.valid_until || '—'}`
  ].join('\n');

  try {
    await navigator.clipboard.writeText(text);
    toast('Информация скопирована');
  } catch {
    toast('Браузер не разрешил копирование', true);
  }
}
