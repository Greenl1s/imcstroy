/**
 * Геометрия листа с QR-наклейками.
 *
 * Вынесена в отдельный файл не ради порядка, а ради проверки: считать её
 * в браузере, где живёт сборка Word-файла, — значит не иметь возможности
 * проверить ни одного числа. Здесь это обычная арифметика, и набор
 * unit-qr-sheet гоняет её как есть, теми же формулами, что уходят в файл.
 *
 * Почему числа именно такие.
 *
 * Печатают НЕ на чистой бумаге: в принтер идёт лист самоклейки, заранее
 * нарезанный на восемь наклеек 105×74 мм. Значит задача не «красиво занять
 * лист», а попасть в готовую нарезку. Отсюда два следствия:
 *
 *   — шаг сетки обязан быть точным. Если высота строки на миллиметр
 *     меньше наклейки, к четвёртому ряду набегает почти сантиметр, и код
 *     печатается на стыке;
 *   — полей у страницы нет. Наклейки начинаются от самого края листа,
 *     любое поле сдвинуло бы всю сетку.
 *
 * Мешает этому одно: толщину рамки Word прибавляет к высоте строки даже
 * тогда, когда высота задана жёстко. Пять линий по 1 пт — это 100 твипов,
 * и четыре точных строки по 74 мм в лист уже не помещаются: последняя
 * уезжает на второй лист (так и было — лист рвался надвое).
 *
 * Поэтому недостачу забираем из ПОСЛЕДНЕЙ строки страницы. У неё
 * подрезан только низ — он и так уходит под обрез листа, — а верх, то
 * есть место самой наклейки, остаётся ровно там, где нужно. Шаг у
 * остальных строк при этом точный, и ошибка никуда не копится.
 */

/** Твипы (1/1440 дюйма) из миллиметров — в них Word считает всё. */
export function mmToTwips(mm) {
  return Math.round(mm / 25.4 * 1440);
}

export const A4 = { width: 11906, height: 16838 };

/** Стандартная самоклейка «8 на лист»: два столбца наклеек по четыре ряда. */
export const LABEL = { width: 105, height: 74 };

/**
 * @param {object} [opts]
 * @param {number} [opts.labelHeightMm] высота наклейки — шаг сетки по высоте
 * @param {number} [opts.borderSize]    толщина красной линии в 1/8 пункта
 * @param {number} [opts.tailTwips]     служебный абзац в конце документа
 */
export function sheetGeometry(opts = {}) {
  const labelHeightMm = opts.labelHeightMm ?? LABEL.height;
  const borderSize = opts.borderSize ?? 8;          // 8/8 пункта = 1 пт
  const tailTwips = opts.tailTwips ?? 20;

  const margin = 0;
  const cols = 4;
  const rows = 4;
  const pageWidth = A4.width;
  const pageHeight = A4.height;
  const usableWidth = pageWidth - margin * 2;
  const colWidth = Math.floor(usableWidth / cols);
  const rowHeight = mmToTwips(labelHeightMm);

  // Та самая прибавка от рамок: линий на одну больше, чем строк.
  const borderTwips = borderSize * 20 / 8;
  const spare = (pageHeight - margin * 2) - rowHeight * rows - borderTwips * (rows + 1) - tailTwips;
  const lastRowHeight = spare >= 0 ? rowHeight : rowHeight + spare;

  return {
    margin, cols, rows, perPage: cols * rows,
    pageWidth, pageHeight, usableWidth,
    colWidth, rowHeight, lastRowHeight,
    borderSize, tailTwips, spare,
    /** Занимает ли страница ровно один лист — то, ради чего всё это считается. */
    fitsOnePage:
      rowHeight * (rows - 1) + lastRowHeight + borderTwips * (rows + 1) + tailTwips
        <= pageHeight - margin * 2,
  };
}
