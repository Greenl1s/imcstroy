const AdmZip = require("adm-zip");
const path = require("path");
const docxImages = require("./docxImages");
const docxPlaceholders = require("./docxPlaceholders");

const TEMPLATE_PATH = path.join(__dirname, "..", "templates", "gp-template.docx");

/**
 * Метки шаблона — места, куда подставляются данные.
 *
 * Список живёт здесь, рядом с подстановкой: разъедься он с ней, и
 * настройки говорили бы «всё на месте» про шаблон, по которому письмо
 * не собирается.
 *
 * REQUIRED — без них письмо не имеет смысла или не соберётся вовсе.
 * OPTIONAL — без них соберётся, но окончания слов будут одинаковыми
 * для одного эксперта и для нескольких.
 */
const REQUIRED = [
  { token: "{{COURT_HEADER}}", what: "шапка письма — кому адресовано" },
  { token: "{{CASE_NUMBER}}", what: "номер дела" },
  { token: "{{COURT_GENITIVE}}", what: "суд в родительном падеже" },
  { token: "{{EXPERTISE_TYPE}}", what: "вид экспертизы" },
  { token: "{{QUESTION_TEXT}}", what: "строка вопроса (размножается по числу вопросов)" },
  { token: "{{COST_TEXT}}", what: "стоимость" },
  { token: "{{TERM_TEXT}}", what: "срок" },
  { token: "{{EXPERT_NAME}}", what: "имя эксперта (размножается по числу экспертов)" },
  { token: "{{EXPERT_DESC_LINE}}", what: "строка сведений эксперта" },
];

const OPTIONAL = [
  { token: "{{Q_SUFFIX_ADJ}}", what: "окончание «по вопрос(ам/у)»" },
  { token: "{{Q_SUFFIX_NOUN}}", what: "окончание «вопрос(ам/у)»" },
  { token: "{{EXPERT_SUFFIX_INFO}}", what: "окончание «об эксперт(ах/е)»" },
  { token: "{{EXPERT_SUFFIX_ASSIGN}}", what: "окончание «эксперт(ам/у)»" },
];

// Экранирует спецсимволы XML и превращает переносы строк внутри значения
// в настоящие переносы строки в Word (<w:br/>), а не в кракозябры.
function escapeXmlText(text) {
  const escaped = String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.split("\n").join('</w:t><w:br/><w:t xml:space="preserve">');
}

function decodeXmlEntities(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// Находит параграф (<w:p ...>...</w:p>), внутри которого встречается token.
function findParagraph(xml, token) {
  const tokenIdx = xml.indexOf(token);
  if (tokenIdx === -1) {
    // Человек правит шаблон сам, поэтому сообщение должно говорить, что
    // делать, а не только что случилось.
    const err = new Error(
      `В шаблоне письма не хватает метки ${token}. Откройте «Настройки → Шаблон ГП»: ` +
      "верните метку на место или нажмите «Вернуть исходный шаблон»."
    );
    err.status = 400;
    throw err;
  }
  const pStart = xml.lastIndexOf("<w:p ", tokenIdx);
  if (pStart === -1) {
    throw new Error(`Не удалось найти начало параграфа для ${token}`);
  }
  const pEndTag = xml.indexOf("</w:p>", tokenIdx) + "</w:p>".length;
  return { start: pStart, end: pEndTag, xml: xml.slice(pStart, pEndTag) };
}

function replaceRange(xml, start, end, replacement) {
  return xml.slice(0, start) + replacement + xml.slice(end);
}

/**
 * Достаёт текст каждого параграфа из docx-файла с биографией эксперта.
 * Пустые параграфы (пустые строки-разделители) пропускаются.
 */
function extractParagraphTexts(docxBuffer) {
  const zip = new AdmZip(docxBuffer);
  const entry = zip.getEntry("word/document.xml");
  if (!entry) {
    throw new Error("Файл не похож на .docx (нет word/document.xml внутри)");
  }
  const xml = entry.getData().toString("utf8");
  const paraMatches = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
  const texts = paraMatches.map((p) => {
    const runs = p.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
    const joined = runs.map((r) => r.replace(/<w:t[^>]*>/, "").replace("</w:t>", "")).join("");
    return decodeXmlEntities(joined).trim();
  });
  return texts.filter((t) => t.length > 0);
}

/**
 * data = {
 *   courtHeader, caseNumber, courtGenitive, expertiseType,
 *   questions: [str, ...],
 *   costText, termText,
 *   experts: [{ name, descLines: [str, ...], scans: [{ name, buffer }] }, ...],
 * }
 *
 * Возвращает { plain, withAttachments } — два Buffer'а.
 *
 * Два письма, а не одно с картинками: в суд идёт с приложениями, а в
 * работе (согласовать, поправить, переслать) удобнее текстовое — оно
 * весит килобайты, а не десятки мегабайт. Собираются оба разом из одних
 * и тех же данных, поэтому разойтись не могут.
 *
 * withAttachments === null, если ни у одного выбранного эксперта нет ни
 * одного скана: пустое «Приложение» на отдельном листе — это обещание,
 * которое документ не выполняет.
 */
function generateGP(data, templateBuffer) {
  return {
    plain: buildGP(data, false, templateBuffer),
    withAttachments: countScans(data) ? buildGP(data, true, templateBuffer) : null,
  };
}

const countScans = (data) =>
  (data.experts || []).reduce((sum, e) => sum + (e.scans || []).length, 0);

function buildGP(data, withAttachments, templateBuffer) {
  // Шаблон приходит буфером: он лежит в хранилище и правится людьми.
  // Без него берём эталон из образа — на случай, если рабочего файла
  // ещё нет (первый запуск) или его читал не тот, кто умеет.
  const zip = new AdmZip(templateBuffer || TEMPLATE_PATH);
  const docEntry = zip.getEntry("word/document.xml");
  if (!docEntry) {
    throw new Error("Шаблон ГП повреждён (нет word/document.xml)");
  }
  // Собираем плейсхолдеры, разорванные редактором на куски. Без этого
  // первое же сохранение шаблона на сайте оставило бы в письме
  // «{{CASE_NUMBER}}» вместо номера дела — и заметили бы это в суде.
  let xml = docxPlaceholders.heal(docEntry.getData().toString("utf8"));

  // Проверяем ДО подстановки и все метки разом. Раньше отсутствие
  // «простой» метки проходило молча: подстановка просто не находила,
  // что менять, и письмо уходило без номера дела — а заметить это
  // можно было только вычитав готовый документ.
  const present = new Set(docxPlaceholders.listPlaceholders(xml));
  const missing = REQUIRED.filter((r) => !present.has(r.token));
  if (missing.length) {
    const err = new Error(
      "В шаблоне письма не хватает меток: " + missing.map((m) => m.token).join(", ") +
      ". Откройте «Настройки → Шаблон ГП»: верните их в текст или нажмите " +
      "«Вернуть исходный шаблон»."
    );
    err.status = 400;
    throw err;
  }

  const questionCount = data.questions.length;
  const expertCount = data.experts.length;

  const simpleReplacements = {
    "{{COURT_HEADER}}": data.courtHeader,
    "{{CASE_NUMBER}}": data.caseNumber,
    "{{COURT_GENITIVE}}": data.courtGenitive,
    "{{EXPERTISE_TYPE}}": data.expertiseType,
    "{{COST_TEXT}}": data.costText,
    "{{TERM_TEXT}}": data.termText,
    "{{Q_SUFFIX_ADJ}}": questionCount > 1 ? "ым" : "ому",
    "{{Q_SUFFIX_NOUN}}": questionCount > 1 ? "ам" : "у",
    "{{EXPERT_SUFFIX_INFO}}": expertCount > 1 ? "ах" : "е",
    "{{EXPERT_SUFFIX_ASSIGN}}": expertCount > 1 ? "ам" : "у",
  };

  for (const [token, value] of Object.entries(simpleReplacements)) {
    xml = xml.split(token).join(escapeXmlText(value));
  }

  // ---------- Вопросы: клонируем параграф-образец нумерованного списка ----------
  const qMold = findParagraph(xml, "{{QUESTION_TEXT}}");
  const questionsXml = data.questions
    .map((q) => qMold.xml.replace("{{QUESTION_TEXT}}", escapeXmlText(q)))
    .join("");
  xml = replaceRange(xml, qMold.start, qMold.end, questionsXml);

  // ---------- Эксперты: имя + N строк описания + пустая строка, на каждого ----------
  const nameMold = findParagraph(xml, "{{EXPERT_NAME}}");
  const descMold = findParagraph(xml, "{{EXPERT_DESC_LINE}}");
  const blankStart = descMold.end;
  const blankEndTag = xml.indexOf("</w:p>", blankStart) + "</w:p>".length;
  const blankXml = xml.slice(blankStart, blankEndTag);

  let expertsXml = "";
  for (const expert of data.experts) {
    expertsXml += nameMold.xml.replace("{{EXPERT_NAME}}", escapeXmlText(expert.name));
    for (const line of expert.descLines) {
      expertsXml += descMold.xml.replace("{{EXPERT_DESC_LINE}}", escapeXmlText(line));
    }
    expertsXml += blankXml;
  }
  xml = replaceRange(xml, nameMold.start, blankEndTag, expertsXml);

  // ---------- Приложения ----------
  // Перечня файлов в строке «Приложение:» больше нет: сканы теперь
  // вшиты в само письмо, и перечислять рядом ещё и имена файлов,
  // которых в конверте нет, значило бы сбивать с толку.
  if (withAttachments) xml = appendScans(zip, xml, data.experts || []);

  zip.updateFile("word/document.xml", Buffer.from(xml, "utf8"));
  return zip.toBuffer();
}

/**
 * Приложение в конце письма.
 *
 * Порядок здесь не случайный и держится осознанно: эксперты идут в том
 * же порядке, в каком перечислены текстом выше, у эксперта — пункты
 * сверху вниз, у пункта — его сканы. То есть если первым в биографии
 * стоит диплом бакалавра, то и первым подтверждением будет он. Иначе
 * читающему в суде пришлось бы сличать документы с текстом наугад.
 */
function appendScans(zip, xml, experts) {
  const adder = docxImages.imageAdder(zip, xml);

  let body = PAGE_BREAK_PARAGRAPH +
    titleParagraph("Приложение") +
    titleParagraph("Документы, подтверждающие имеющиеся допуски и квалификацию экспертов");

  let added = 0;
  for (const expert of experts) {
    for (const scan of expert.scans || []) {
      const paragraph = adder.add(scan.buffer, scan.name);
      if (!paragraph) continue;   // не картинка — молча мимо, письмо важнее
      body += paragraph;
      added++;
    }
  }
  if (!added) return xml;

  adder.flush();
  const sectPrAt = xml.lastIndexOf("<w:sectPr");
  return xml.slice(0, sectPrAt) + body + xml.slice(sectPrAt);
}

const FONT_RPR = '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/>';

const PAGE_BREAK_PARAGRAPH = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

const titleParagraph = (text) =>
  `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="120"/><w:rPr>${FONT_RPR}<w:b/></w:rPr></w:pPr>` +
  `<w:r><w:rPr>${FONT_RPR}<w:b/></w:rPr><w:t xml:space="preserve">${escapeXmlText(text)}</w:t></w:r></w:p>`;

module.exports = { generateGP, extractParagraphTexts, REQUIRED, OPTIONAL };
