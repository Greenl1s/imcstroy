const AdmZip = require("adm-zip");
const path = require("path");
const docxImages = require("./docxImages");

const TEMPLATE_PATH = path.join(__dirname, "..", "templates", "gp-template.docx");

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
    throw new Error(`Плейсхолдер ${token} не найден в шаблоне ГП — шаблон повреждён`);
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
function generateGP(data) {
  return {
    plain: buildGP(data, false),
    withAttachments: countScans(data) ? buildGP(data, true) : null,
  };
}

const countScans = (data) =>
  (data.experts || []).reduce((sum, e) => sum + (e.scans || []).length, 0);

function buildGP(data, withAttachments) {
  const zip = new AdmZip(TEMPLATE_PATH);
  const docEntry = zip.getEntry("word/document.xml");
  if (!docEntry) {
    throw new Error("Шаблон ГП повреждён (нет word/document.xml)");
  }
  let xml = docEntry.getData().toString("utf8");

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

module.exports = { generateGP, extractParagraphTexts };
