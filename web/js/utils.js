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

/**
 * Состояние поверки/калибровки на сегодня.
 * Если у прибора тип контроля "не требуется" — статус всегда "не требуется",
 * независимо от дат. Иначе — по сроку действия (valid_until): дата в будущем
 * или сегодня — "есть", просрочена или не указана — "нет".
 */
export function verificationState(item) {
  if (item?.check_type === 'none') return 'none';
  const dateText = item?.valid_until;
  if (!dateText) return 'expired';
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return 'expired';
  date.setHours(23, 59, 59, 999);
  return date >= new Date() ? 'valid' : 'expired';
}

export const verificationText = (item) =>
  ({ valid: 'Есть', expired: 'Нет', none: 'Не требуется' })[verificationState(item)];

export const verificationBadge = (item) =>
  ({ valid: 'ok', expired: 'warn', none: 'muted' })[verificationState(item)];

export const statusText = (s) =>
  ({ free: 'Свободен', busy: 'Занят', booked: 'Забронирован', retired: 'Списан' })[s] || s;

export const statusBadge = (s) =>
  ({ free: 'ok', busy: 'warn', booked: 'warn', retired: 'bad' })[s] || 'muted';

export const checkTypeText = (t) =>
  ({ verification: 'Поверка', calibration: 'Калибровка', none: 'Не требуется' })[t] || t;

/** Подпись поля даты на карточке — зависит от типа метрологического контроля. */
export const dateFieldLabel = (checkType) => {
  if (checkType === 'calibration') return 'Дата калибровки';
  if (checkType === 'verification') return 'Дата поверки';
  return 'Дата контроля';
};

/** Подпись поля срока действия на карточке — зависит от типа. */
export const validUntilLabel = (checkType) => {
  if (checkType === 'calibration') return 'Калибровка действует до';
  if (checkType === 'verification') return 'Поверка действует до';
  return 'Действует до';
};

/** Подпись кнопки документа на карточке — зависит от типа. */
export const documentButtonLabel = (checkType) => {
  if (checkType === 'calibration') return 'Калибровка';
  if (checkType === 'verification') return 'Поверка';
  return 'Документ';
};

/** Читает выбранный файл как data URL (для загрузки фото). */
export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });
}

/**
 * Классификация приборов по видам контроля. Раньше список был жёстко
 * зашит здесь в коде — теперь он хранится в базе и управляется
 * администратором (см. showControlTypesManager в instruments.js).
 * Заполняется один раз при входе через setControlTypes().
 */
/**
 * Единая палитра из 10 цветов на классификации и компании — назначается
 * автоматически по порядку в списке (какой пришёл первым от сервера,
 * тот и получает первый цвет). После 10-й записи цвета начинают
 * повторяться — этого достаточно, вряд ли компаний/классификаций будет
 * больше десятка одновременно.
 */
const PALETTE_SIZE = 10;
function buildPalette(list) {
  return Object.fromEntries(list.map((item, i) => [item.code, `palette-${i % PALETTE_SIZE}`]));
}

let CONTROL_TYPES_LIST = [];
let CONTROL_TYPE_COLORS = {};

/** Вызывается один раз при входе — после того как список получен с сервера. */
export function setControlTypes(list) {
  CONTROL_TYPES_LIST = Array.isArray(list) ? list : [];
  CONTROL_TYPE_COLORS = buildPalette(CONTROL_TYPES_LIST);
}

/** Список в старом формате [code, full_name, short_name] — для формы/фильтра. */
export function getControlTypes() {
  return CONTROL_TYPES_LIST.map((t) => [t.code, t.full_name, t.short_name]);
}

/** Короткая подпись для бейджа (ВИК, УЗК...), «Не указано» — если код пустой. */
export const controlTypeShort = (code) => {
  const found = CONTROL_TYPES_LIST.find((t) => t.code === code);
  return found ? found.short_name : 'Не указано';
};

/** Полное название — для всплывающей подсказки при наведении. */
export const controlTypeFull = (code) => {
  const found = CONTROL_TYPES_LIST.find((t) => t.code === code);
  return found ? found.full_name : 'Классификация не указана';
};

/** CSS-класс цвета бейджа — свой у каждой классификации, «Не указано» остаётся серым. */
export const controlTypeBadge = (code) => (code && CONTROL_TYPE_COLORS[code]) || 'muted';

/**
 * Компании, к которым привязаны приборы. Тоже хранится в базе и
 * управляется администратором (см. showCompaniesManager в instruments.js).
 * Заполняется один раз при входе через setCompanies().
 */
let COMPANIES_LIST = [];
let COMPANY_COLORS = {};

export function setCompanies(list) {
  COMPANIES_LIST = Array.isArray(list) ? list : [];
  COMPANY_COLORS = buildPalette(COMPANIES_LIST);
}

/** Список в формате [code, name] — для формы/фильтра. */
export function getCompanies() {
  return COMPANIES_LIST.map((c) => [c.code, c.name]);
}

/** Название компании по коду, «Не привязан» — если код пустой/не найден. */
export const companyName = (code) => {
  const found = COMPANIES_LIST.find((c) => c.code === code);
  return found ? found.name : 'Не привязан';
};

/** CSS-класс цвета бейджа — свой у каждой компании, «Не привязан» остаётся серым. */
export const companyBadge = (code) => (code && COMPANY_COLORS[code]) || 'muted';
