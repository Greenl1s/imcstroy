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
 * ЧТО ОТЪЕДАЕТ ВЫСОТУ, ХОТЯ И НЕ ДОЛЖНО БЫ
 *
 * 1. Толщина рамки. Word прибавляет её к высоте строки даже тогда, когда
 *    высота задана жёстко. Пять линий — это borderTwips × 5.
 * 2. Отступы колонтитулов. Их полагается ставить в ноль вместе с полями:
 *    иначе Word держит под них место (по умолчанию 708 твипов — 1,25 см),
 *    и на лист встаёт только ТРИ ряда, а четвёртый уезжает на вторую
 *    страницу. Именно это и происходило: число кодов тут ни при чём,
 *    просто при пяти кодах пустая четвёртая строка на втором листе была
 *    особенно заметна.
 * 3. Служебный абзац после таблицы. Он обязателен по формату, и его
 *    высоту тоже надо считать.
 *
 * Остаток всё равно уходит в минус — четыре точных строки по 74 мм в А4 не
 * помещаются. Недостачу забираем из ПОСЛЕДНЕЙ строки страницы: у неё
 * подрезан только низ, который и так уходит под обрез листа.
 *
 * И чтобы подрезка никак не влияла на место кода, содержимое ячейки
 * прижато к ВЕРХУ с отступом cellTopPad — верх строки совпадает с верхом
 * наклейки, и код стоит на одном и том же месте в любой строке, хоть
 * полной, хоть укороченной. Будь он отцентрован по высоте ячейки, он бы
 * в последнем ряду поехал вверх вместе с укороченным низом.
 */

/** Твипы (1/1440 дюйма) из миллиметров — в них Word считает всё. */
export function mmToTwips(mm) {
  return Math.round(mm / 25.4 * 1440);
}

export const A4 = { width: 11906, height: 16838 };

/** Стандартная самоклейка «8 на лист»: два столбца наклеек по четыре ряда. */
export const LABEL = { width: 105, height: 74 };

/** 1 пиксель картинки при 96 dpi — столько твипов. */
const PX = 15;

/**
 * @param {object} [opts]
 * @param {number} [opts.labelHeightMm] высота наклейки — шаг сетки по высоте
 * @param {number} [opts.borderSize]    толщина красной линии в 1/8 пункта
 * @param {number} [opts.tailTwips]     служебный абзац в конце документа
 * @param {number} [opts.qrSizePx]      сторона QR-кода в пикселях
 * @param {number} [opts.reserveTwips]  запас у нижнего края листа
 */
export function sheetGeometry(opts = {}) {
  const labelHeightMm = opts.labelHeightMm ?? LABEL.height;
  const borderSize = opts.borderSize ?? 8;          // 8/8 пункта = 1 пт
  const tailTwips = opts.tailTwips ?? 20;
  const qrSizePx = opts.qrSizePx ?? 90;
  // Запас на случай, если Word придержит у нижнего края что-то ещё, о чём
  // я не знаю. Стоит он дёшево: подрезается только низ последней строки,
  // а места кодов не двигает вовсе — они прижаты к верху своих строк.
  const reserveTwips = opts.reserveTwips ?? 200;

  const margin = 0;
  const header = 0;      // вместе с полями: иначе Word держит место под
  const footer = 0;      // колонтитулы и четвёртый ряд не влезает
  const cols = 4;
  const rows = 4;
  const pageWidth = A4.width;
  const pageHeight = A4.height;
  const usableWidth = pageWidth - margin * 2;
  const colWidth = Math.floor(usableWidth / cols);
  const rowHeight = mmToTwips(labelHeightMm);

  const borderTwips = borderSize * 20 / 8;
  // Сколько высоты листа реально отдано под таблицу.
  const usableHeight = pageHeight
    - Math.max(margin, header) - Math.max(margin, footer)
    - reserveTwips;
  const spare = usableHeight - rowHeight * rows - borderTwips * (rows + 1) - tailTwips;
  const lastRowHeight = spare >= 0 ? rowHeight : rowHeight + spare;

  // Высота содержимого ячейки: код плюс строчка с номером под ним.
  const captionTwips = 220;
  const contentHeight = qrSizePx * PX + captionTwips;
  // Отступ сверху такой, чтобы код выглядел стоящим по центру наклейки.
  const cellTopPad = Math.max(0, Math.round((rowHeight - contentHeight) / 2));

  return {
    margin, header, footer, cols, rows, perPage: cols * rows,
    pageWidth, pageHeight, usableWidth, usableHeight,
    colWidth, rowHeight, lastRowHeight,
    borderSize, borderTwips, tailTwips, reserveTwips, spare,
    qrSizePx, cellTopPad, contentHeight,
    /** Занимает ли страница ровно один лист — то, ради чего всё это считается. */
    fitsOnePage:
      rowHeight * (rows - 1) + lastRowHeight + borderTwips * (rows + 1) + tailTwips
        <= usableHeight,
    /** Не срежется ли содержимое: у строки жёсткая высота, лишнее Word обрежет. */
    contentFits: cellTopPad + contentHeight <= lastRowHeight,
  };
}
