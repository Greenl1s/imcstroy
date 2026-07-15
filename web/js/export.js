import { state } from './state.js';
import { checkTypeText, today } from './utils.js';
import { toast } from './ui.js';

const HEADERS = [
  '№ п/п', 'Наименование', 'Серийный номер', 'Модель',
  'Тип документа (Поверка/калибровка)', 'Дата поверки', 'Действительно до',
  'Ссылка на документ'
];

const COLUMN_WIDTHS = [
  { wch: 6 }, { wch: 35 }, { wch: 16 }, { wch: 22 },
  { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 42 }
];

function toRows(items) {
  return items.map((item, index) => [
    index + 1,
    item.name || '',
    item.serial_number || '',
    item.model || '',
    checkTypeText(item.check_type),
    item.verification_date || '',
    item.valid_until || '',
    item.document_url || ''
  ]);
}

function downloadWorkbook(rows, filename) {
  if (typeof XLSX === 'undefined') {
    toast('Не удалось загрузить библиотеку для Excel — проверьте интернет-соединение и обновите страницу', true);
    return;
  }
  const sheet = XLSX.utils.aoa_to_sheet([HEADERS, ...rows]);
  sheet['!cols'] = COLUMN_WIDTHS;
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Приборы');
  XLSX.writeFile(book, filename);
}

/** Полная таблица приборов — все, что сейчас в работе (списанные сюда не входят). */
export function exportAllInstruments() {
  if (!state.instruments.length) return toast('Нет приборов для выгрузки', true);
  downloadWorkbook(toRows(state.instruments), `приборы-${today()}.xlsx`);
}

/**
 * Только те приборы, у которых поверка/калибровка заканчивается до конца
 * текущего года включительно — либо уже закончилась (просрочена).
 * Приборы без даты поверки в список не попадают: сравнивать нечего.
 */
export function exportExpiringInstruments() {
  const year = new Date().getFullYear();
  const cutoff = new Date(year, 11, 31, 23, 59, 59);
  const items = state.instruments.filter(
    (i) => i.valid_until && new Date(i.valid_until) <= cutoff
  );
  if (!items.length) return toast('Нет приборов с истекающей или истёкшей поверкой', true);
  downloadWorkbook(toRows(items), `окончание-поверок-${year}.xlsx`);
}
