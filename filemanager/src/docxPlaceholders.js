/* ============================================================
 *  Плейсхолдеры в шаблоне Word: собрать разорванное.
 *
 *  Word (и OnlyOffice) хранят абзац не одной строкой, а набором кусков
 *  <w:t>. Границы между ними произвольные: они появляются от правки в
 *  середине слова, от проверки орфографии, от смены языка — от чего
 *  угодно. Человек видит «{{CASE_NUMBER}}», а в файле лежит
 *  «{{CASE_» + «NUMBER}}» в двух кусках, а то и в трёх.
 *
 *  Пока шаблон правили только в коде, это сходило с рук: файл лежал
 *  как есть и не пересобирался. Как только шаблон стало можно править
 *  прямо на сайте, всё изменилось: ЛЮБОЕ сохранение в редакторе
 *  пересобирает документ и вполне может разложить плейсхолдер на куски.
 *  Подстановка по точному совпадению строки после этого молча ничего не
 *  находит — и в письмо уходит «{{CASE_NUMBER}}» вместо номера дела.
 *
 *  Поэтому перед любой подстановкой мы проходим по абзацам и собираем
 *  разорванные плейсхолдеры обратно в один кусок. Оформление при этом
 *  берётся от первого куска — того, где плейсхолдер начинается.
 * ============================================================ */

const PLACEHOLDER = /\{\{[A-Z_0-9]+\}\}/g;

/** Куски текста абзаца: сам тег, его содержимое и место в строке. */
function runsOf(paragraphXml) {
  const runs = [];
  const re = /<w:t(\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  let m;
  while ((m = re.exec(paragraphXml)) !== null) {
    runs.push({
      start: m.index,
      end: m.index + m[0].length,
      attrs: m[1] || "",
      inner: m[2],
      whole: m[0],
    });
  }
  return runs;
}

/**
 * Собирает разорванные плейсхолдеры одного абзаца.
 *
 * Возвращает исправленный xml абзаца (или тот же, если всё цело).
 */
function healParagraph(paragraphXml) {
  const runs = runsOf(paragraphXml);
  if (runs.length < 2) return paragraphXml;

  // Склеенный текст абзаца и карта «позиция в тексте → кусок».
  let text = "";
  for (const run of runs) {
    run.textStart = text.length;
    text += run.inner;
    run.textEnd = text.length;
  }
  if (!/\{\{/.test(text)) return paragraphXml;

  // Правки собираем и применяем с конца, чтобы не сбить позиции.
  const edits = [];
  PLACEHOLDER.lastIndex = 0;
  let found;
  while ((found = PLACEHOLDER.exec(text)) !== null) {
    const from = found.index;
    const to = from + found[0].length;
    const touched = runs.filter((r) => r.textEnd > from && r.textStart < to);
    if (touched.length < 2) continue;   // и так целиком в одном куске

    // Весь плейсхолдер переносим в первый задетый кусок — вместе с тем,
    // что было в нём до плейсхолдера; из остальных вырезаем их часть.
    for (let i = 0; i < touched.length; i++) {
      const run = touched[i];
      const localFrom = Math.max(0, from - run.textStart);
      const localTo = Math.min(run.inner.length, to - run.textStart);
      const before = run.inner.slice(0, localFrom);
      const after = run.inner.slice(localTo);
      const inner = i === 0 ? before + found[0] + after : before + after;
      edits.push({ start: run.start, end: run.end, replacement: buildRun(run.attrs, inner) });
    }
  }
  if (!edits.length) return paragraphXml;

  edits.sort((a, b) => b.start - a.start);
  let out = paragraphXml;
  for (const edit of edits) {
    out = out.slice(0, edit.start) + edit.replacement + out.slice(edit.end);
  }
  return out;
}

/**
 * Пустой кусок оставляем пустым, но не выбрасываем: в нём могут висеть
 * настройки оформления соседнего текста, и удаление куска целиком иногда
 * ломает разметку абзаца сильнее, чем пустая строка.
 */
function buildRun(attrs, inner) {
  const needSpace = /^\s|\s$/.test(inner) && !/xml:space="preserve"/.test(attrs);
  const finalAttrs = needSpace ? `${attrs} xml:space="preserve"` : attrs;
  return `<w:t${finalAttrs}>${inner}</w:t>`;
}

/** То же самое для всего документа. */
function heal(documentXml) {
  return documentXml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (p) => healParagraph(p));
}

/** Какие плейсхолдеры есть в документе (после сборки разорванных). */
function listPlaceholders(documentXml) {
  const healed = heal(documentXml);
  const names = new Set();
  let m;
  PLACEHOLDER.lastIndex = 0;
  while ((m = PLACEHOLDER.exec(healed)) !== null) names.add(m[0]);
  return [...names];
}

module.exports = { heal, healParagraph, listPlaceholders, PLACEHOLDER };
