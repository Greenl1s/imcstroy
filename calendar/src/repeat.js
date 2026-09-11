// ============================================================
//  Повторы.
//
//  Повторяющееся дело разворачивается в отдельные строки при создании,
//  а не вычисляется каждый раз при чтении. Это сознательный выбор:
//
//    — перенести или отметить ОДИН день — обычное изменение одной
//      строки, без слоя «исключений из правила», который в календарях
//      обычно и оказывается источником странностей;
//    — чтение месяца остаётся одним запросом с диапазоном по дате.
//
//  Плата — конечный горизонт: серия не бесконечна, у неё есть дата
//  окончания. По умолчанию — полгода вперёд, максимум — два года,
//  и не больше MAX_INSTANCES строк, чтобы одним нажатием нельзя было
//  засыпать базу.
//
//  Даты считаются в UTC-полночь: это не про часовой пояс, а про то,
//  что перевод часов не должен смещать «каждый вторник».
// ============================================================

export const MAX_INSTANCES = 400;
const DEFAULT_MONTHS = 6;
const MAX_MONTHS = 24;

const toUtc = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

const toIso = (ms) => new Date(ms).toISOString().slice(0, 10);

const addDays = (iso, n) => toIso(toUtc(iso) + n * 86400000);

const addMonths = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  // 31 января + месяц: февраля 31-го не бывает. Такой месяц пропускаем,
  // а не сдвигаем на 3 марта — «каждое 31-е» должно означать ровно это.
  if (d > last) return null;
  return toIso(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), d));
};

/** Понедельник—пятница. getUTCDay(): 0 — воскресенье, 6 — суббота. */
const isWeekday = (iso) => {
  const day = new Date(toUtc(iso)).getUTCDay();
  return day >= 1 && day <= 5;
};

/**
 * Даты серии, включая первую.
 *
 * @param {string} startIso   первая дата, YYYY-MM-DD
 * @param {string} rule       none | daily | weekdays | weekly | monthly
 * @param {string|null} untilIso  последняя дата включительно
 * @returns {string[]}
 */
export function expandRepeat(startIso, rule, untilIso = null) {
  if (!rule || rule === 'none') return [startIso];

  const hardStop = addMonths(startIso, MAX_MONTHS) || addDays(startIso, 730);
  let until = untilIso || addMonths(startIso, DEFAULT_MONTHS) || addDays(startIso, 182);
  if (until > hardStop) until = hardStop;
  if (until < startIso) until = startIso;

  const dates = [];
  const push = (iso) => {
    if (iso && iso <= until && dates.length < MAX_INSTANCES) dates.push(iso);
  };

  if (rule === 'monthly') {
    for (let i = 0; dates.length < MAX_INSTANCES; i++) {
      const next = addMonths(startIso, i);
      // Пропущенный месяц (31-е) не обрывает серию — идём дальше.
      if (next === null) {
        if (addMonths(startIso, i + 1) === null && i > 24) break;
        continue;
      }
      if (next > until) break;
      push(next);
    }
    return dates.length ? dates : [startIso];
  }

  const step = rule === 'weekly' ? 7 : 1;
  for (let iso = startIso; iso <= until && dates.length < MAX_INSTANCES; iso = addDays(iso, step)) {
    if (rule === 'weekdays' && !isWeekday(iso)) continue;
    push(iso);
  }

  return dates.length ? dates : [startIso];
}

export const repeatLabel = (rule) => ({
  none: 'Не повторяется',
  daily: 'Каждый день',
  weekdays: 'По будням',
  weekly: 'Каждую неделю',
  monthly: 'Каждый месяц',
}[rule] || 'Не повторяется');
