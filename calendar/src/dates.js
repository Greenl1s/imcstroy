// ============================================================
//  Даты рабочего дня — по Москве, а не по UTC.
//
//  Раньше «сегодня» считалось так:
//
//      new Date().toISOString().slice(0, 10)
//
//  toISOString() всегда возвращает время по Гринвичу, а Москва
//  впереди на три часа. С полуночи до 03:00 по Москве это давало
//  ВЧЕРАШНЮЮ дату: прибор, взятый в час ночи, записывался вчерашним
//  днём — и в taken_at, и в дате списания, и в журнале.
//
//  Здесь дата считается по московскому времени независимо от того,
//  в какой зоне запущен контейнер. Тот же приём, что в ИСУ
//  (filemanager/src/taskDates.js): один способ считать дату на обе
//  системы, чтобы «сегодня» у них не разъезжалось.
// ============================================================

const MSK_OFFSET_MINUTES = 3 * 60;

/**
 * Сегодняшняя дата по Москве в виде YYYY-MM-DD.
 *
 * @param {Date} [now] — момент времени; параметр нужен тестам,
 *                       в рабочем коде вызывается без аргументов.
 */
export function todayIso(now = new Date()) {
  const msk = new Date(now.getTime() + MSK_OFFSET_MINUTES * 60 * 1000);
  return msk.toISOString().slice(0, 10);
}

/**
 * Приводит присланное значение к YYYY-MM-DD или к null.
 *
 * Пустая строка, null и мусор дают null — а не «1970-01-01», как
 * получилось бы у new Date(null). Эта ошибка уже случалась в ИСУ,
 * поэтому проверка здесь стоит с самого начала.
 */
export function toIso(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
