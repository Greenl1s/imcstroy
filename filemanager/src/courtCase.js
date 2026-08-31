/**
 * Номер арбитражного дела и ссылка на карточку в КАД.
 *
 * В поле «Номер дела/договора» лежит и номер судебного дела
 * («А40-183194/2015»), и номер договора («12/2026-ЭКС»). Ссылку на
 * картотеку имеет смысл показывать только для первого — поэтому здесь
 * не «сделать ссылку из чего угодно», а «узнать, дело ли это вообще».
 *
 * Отдельным модулем это сделано на будущее: когда появится источник
 * данных о движении дела (официальный API или сторонний), он встанет
 * сюда же, а всё остальное приложение продолжит спрашивать номер и
 * ссылку одинаково.
 */

// Номер дела: буква суда, номер региона, номер дела, год.
// Букву «А» пишут и кириллицей, и латиницей — принимаем обе, а хранить
// и показывать будем кириллическую, как в самой картотеке.
// Хвост после года («-3-1», «(2)») встречается в обособленных спорах:
// он допускается, но в ссылку не идёт — карточка ищется по основному.
const CASE_NUMBER_RE = /^\s*([АAаa])\s*(\d{1,3})\s*[-–—]\s*(\d{1,7})\s*\/\s*(\d{2,4})\s*(.*)$/u;

const KAD_CARD_URL = "https://kad.arbitr.ru/Card";

/**
 * Приводит номер к виду, принятому в картотеке: «А40-183194/2015».
 * Возвращает null, если это не номер арбитражного дела.
 */
function normalizeCaseNumber(raw) {
  const value = String(raw == null ? "" : raw).trim();
  if (!value) return null;
  const m = value.match(CASE_NUMBER_RE);
  if (!m) return null;

  const [, , region, number, yearRaw, tail] = m;
  // Хвост допускаем только осмысленный: буквы, цифры, скобки, дефисы.
  // Иначе «А40-1/2026 и ещё что-то текстом» сойдёт за номер дела.
  if (tail && !/^[-–—()\s\d\p{L}]*$/u.test(tail)) return null;

  // Двузначный год встречается в рукописных записях: 15 -> 2015.
  const year = yearRaw.length === 4 ? yearRaw : String(2000 + Number(yearRaw));
  if (Number(year) < 1992 || Number(year) > 2100) return null;

  return `А${Number(region)}-${Number(number)}/${year}`;
}

function isArbitrationCaseNumber(raw) {
  return normalizeCaseNumber(raw) !== null;
}

/**
 * Ссылка на карточку дела в картотеке арбитражных дел.
 * null — если номер не похож на судебное дело (например, это договор).
 */
function kadUrl(raw) {
  const number = normalizeCaseNumber(raw);
  if (!number) return null;
  return `${KAD_CARD_URL}?number=${encodeURIComponent(number)}`;
}

/**
 * Дополняет карточку проекта разобранным номером дела и ссылкой.
 * Ничего не запрашивает наружу: это чистое преобразование строки.
 */
function decorateCase(row) {
  if (!row) return row;
  const number = normalizeCaseNumber(row.case_number);
  return { ...row, court_case_number: number, kad_url: number ? kadUrl(number) : null };
}

function decorateCases(rows) {
  return (rows || []).map(decorateCase);
}

module.exports = {
  normalizeCaseNumber, isArbitrationCaseNumber, kadUrl,
  decorateCase, decorateCases, KAD_CARD_URL,
};
