const AdmZip = require("adm-zip");
const path = require("path");

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
 *   experts: [{ name, descLines: [str, ...] }, ...],
 * }
 * Возвращает Buffer готового .docx.
 */
function generateGP(data) {
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
  xml = fillAttachments(xml, data.attachments || []);

  docEntry.setData(Buffer.from(xml, "utf8"));
  return zip.toBuffer();
}

/**
 * Строка «Приложение:» превращается в перечень приложенных документов.
 *
 * В шаблоне это обычный абзац с общей фразой «Приложение: Документы,
 * подтверждающие квалификацию экспертов» — без плейсхолдера. Плейсхолдер
 * сюда сознательно НЕ добавлен: тогда пришлось бы заменить и сам шаблон
 * на сервере, а он у людей уже правленый, и подменять его — значит
 * молча стереть чужие изменения. Поэтому ищем абзац по тексту.
 *
 * Если приложений нет — оставляем прежнюю фразу как была. Если абзац
 * не нашёлся (шаблон переписали) — тоже ничего не делаем: письмо должно
 * получиться в любом случае, пусть и без перечня.
 */
function fillAttachments(xml, attachments) {
  if (!attachments.length) return xml;

  const marker = findAttachmentParagraph(xml);
  if (!marker) return xml;

  const head = marker.xml.replace(marker.text, escapeXmlText("Приложение:"));
  const items = attachments
    .map((name, i) => marker.xml.replace(marker.text, escapeXmlText(`${i + 1}. ${name}`)))
    .join("");

  return replaceRange(xml, marker.start, marker.end, head + items);
}

/**
 * Находит абзац, начинающийся со слова «Приложение», и возвращает его
 * вместе с текстом ровно в том виде, в каком он лежит внутри <w:t> —
 * заменять надо именно эту подстроку, иначе слетит разметка абзаца.
 *
 * Word умеет разбивать одну фразу на несколько <w:t> (например, после
 * правки в середине), поэтому берём самый длинный кусок текста в абзаце:
 * заменяем его, а остальные обнуляем.
 */
function findAttachmentParagraph(xml) {
  const paragraphs = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
  for (const p of paragraphs) {
    const runs = p.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
    const joined = decodeXmlEntities(
      runs.map((r) => r.replace(/<w:t[^>]*>/, "").replace("</w:t>", "")).join("")
    ).trim();
    if (!/^Приложение/i.test(joined)) continue;

    // Самый длинный <w:t> в абзаце — тот, где лежит основная фраза.
    let longest = "";
    for (const r of runs) {
      const inner = r.replace(/<w:t[^>]*>/, "").replace("</w:t>", "");
      if (inner.length > longest.length) longest = inner;
    }
    if (!longest) continue;

    const start = xml.indexOf(p);
    // Лишние куски фразы убираем, чтобы «Приложение:» не задвоилось.
    let cleaned = p;
    for (const r of runs) {
      const inner = r.replace(/<w:t[^>]*>/, "").replace("</w:t>", "");
      if (inner !== longest) cleaned = cleaned.replace(r, r.replace(inner, ""));
    }
    return { start, end: start + p.length, xml: cleaned, text: longest };
  }
  return null;
}

module.exports = { generateGP, extractParagraphTexts };
