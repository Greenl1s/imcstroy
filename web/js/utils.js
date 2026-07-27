export const $ = (id) => document.getElementById(id);
export const today = () => new Date().toISOString().slice(0, 10);
export const pad = (value) => String(value).padStart(2, '0');

export function escapeHtml(value = '') {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
export const escapeAttr = escapeHtml;

export const formData = (form) => Object.fromEntries(new FormData(form).entries());

/** Номер, который видит человек: инвентарный, а если его нет — внутренний id. */
export const displayNo = (item) =>
  item.inventory_no ? item.inventory_no : `#${item.id}`;

/** Состояние поверки на сегодня. */
export function verificationState(dateText) {
  if (!dateText) return 'none';
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return 'none';
  date.setHours(23, 59, 59, 999);
  return date >= new Date() ? 'valid' : 'expired';
}

export const verificationText = (d) =>
  ({ valid: 'Поверен', expired: 'Не поверен', none: 'Без поверки' })[verificationState(d)];

export const verificationBadge = (d) =>
  ({ valid: 'ok', expired: 'warn', none: 'muted' })[verificationState(d)];

export const statusText = (s) =>
  ({ free: 'Свободен', busy: 'Занят', booked: 'Забронирован', retired: 'Списан' })[s] || s;

export const statusBadge = (s) =>
  ({ free: 'ok', busy: 'warn', booked: 'warn', retired: 'bad' })[s] || 'muted';

export const checkTypeText = (t) =>
  ({ verification: 'Поверка', calibration: 'Калибровка' })[t] || t;

/** Читает выбранный файл как data URL (для загрузки фото). */
export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });
}

/** Классификация приборов по видам контроля. Код — то, что хранится в базе. */
export const CONTROL_TYPES = [
  ['vik', 'Визуально-измерительный контроль', 'ВИК'],
  ['uzk', 'Ультразвуковой контроль', 'УЗК'],
  ['elk', 'Электрический контроль', 'ЭЛК'],
  ['tk',  'Тепловой контроль', 'ТК'],
  ['ak',  'Акустический контроль', 'АК'],
  ['kbt', 'Контроль бетона', 'КБТ'],
  ['rgk', 'Радиографический контроль', 'РГК'],
  ['gdz', 'Геодезическое оборудование', 'ГДЗ']
];

const CONTROL_TYPE_SHORT = Object.fromEntries(CONTROL_TYPES.map(([code, , short]) => [code, short]));
const CONTROL_TYPE_FULL = Object.fromEntries(CONTROL_TYPES.map(([code, full]) => [code, full]));

/** Короткая подпись для бейджа (ВИК, УЗК...), «Не указано» — если код пустой. */
export const controlTypeShort = (code) => CONTROL_TYPE_SHORT[code] || 'Не указано';

/** Полное название — для всплывающей подсказки при наведении. */
export const controlTypeFull = (code) => CONTROL_TYPE_FULL[code] || 'Классификация не указана';
