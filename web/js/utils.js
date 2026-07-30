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

/** Классификация приборов по видам контроля. Код — то, что хранится в базе. */
export const CONTROL_TYPES = [
  ['vik', 'Визуально-измерительный контроль', 'ВИК'],
  ['uzk', 'Ультразвуковой контроль', 'УЗК'],
  ['elk', 'Электрический контроль', 'ЭЛК'],
  ['tk',  'Тепловой контроль', 'ТК'],
  ['ak',  'Акустический контроль', 'АК'],
  ['kbt', 'Контроль бетона', 'КБТ'],
  ['rgk', 'Радиографический контроль', 'РГК'],
  ['gdz', 'Геодезическое оборудование', 'ГДЗ'],
  ['vspom', 'Вспомогательные приборы', 'ВСПОМ']
];

const CONTROL_TYPE_SHORT = Object.fromEntries(CONTROL_TYPES.map(([code, , short]) => [code, short]));
const CONTROL_TYPE_FULL = Object.fromEntries(CONTROL_TYPES.map(([code, full]) => [code, full]));

/** Короткая подпись для бейджа (ВИК, УЗК...), «Не указано» — если код пустой. */
export const controlTypeShort = (code) => CONTROL_TYPE_SHORT[code] || 'Не указано';

/** Полное название — для всплывающей подсказки при наведении. */
export const controlTypeFull = (code) => CONTROL_TYPE_FULL[code] || 'Классификация не указана';

/**
 * CSS-класс цвета бейджа. Три цветовые семьи, каждая — темнее внутри себя:
 *   голубая:              ВИК → АК → УЗК → КБТ (от светлого к тёмному)
 *   сине-зелёная (бирюза): ЭЛК → РГК (от светлого к тёмному)
 *   оранжево-коричневая:  ТК → ГДЗ (от светлого к тёмному)
 * «Не указано» остаётся нейтральным серым (класс muted), как и раньше.
 */
export const controlTypeBadge = (code) =>
  ({ vik: 'ctrl-vik', ak: 'ctrl-ak', uzk: 'ctrl-uzk', kbt: 'ctrl-kbt',
     elk: 'ctrl-elk', rgk: 'ctrl-rgk',
     tk: 'ctrl-tk', gdz: 'ctrl-gdz' }[code] || 'muted');
// Примечание: у "vspom" (Вспомогательные приборы) нет отдельного цвета —
// используется нейтральный "muted", как и для "не указано". Если захотите
// свой цвет — добавьте правило .ctrl-vspom в style.css и впишите его сюда.
