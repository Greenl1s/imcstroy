const AdmZip = require("adm-zip");
const docxPlaceholders = require("./docxPlaceholders");
const docxImages = require("./docxImages");

function escapeXml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .split(/\r?\n/).join('</w:t><w:br/><w:t xml:space="preserve">');
}
function dateRu(value) {
  if (!value) return "";
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(value);
  const months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} г.`;
}
function money(value) {
  const n = Number(String(value || "0").replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n)) return "0,00";
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
const ONES = ["ноль", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять", "десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
const TENS = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
const HUNDS = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];
function triplet(n, female) {
  const out = [];
  if (n >= 100) { out.push(HUNDS[Math.floor(n / 100)]); n %= 100; }
  if (n < 20) { if (n) out.push(ONES[n]); }
  else { out.push(TENS[Math.floor(n / 10)]); n %= 10; if (n) out.push(female && n === 1 ? "одна" : female && n === 2 ? "две" : ONES[n]); }
  return out.join(" ");
}
function plural(n, one, few, many) { const a = n % 100, b = n % 10; return a >= 11 && a <= 19 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; }
function numberWords(raw) {
  let n = Math.max(0, Math.floor(Number(raw) || 0));
  if (!n) return "Ноль";
  const groups = [];
  const names = [["", "", ""], ["тысяча", "тысячи", "тысяч"], ["миллион", "миллиона", "миллионов"], ["миллиард", "миллиарда", "миллиардов"]];
  let rank = 0;
  while (n && rank < names.length) {
    const part = n % 1000;
    if (part) {
      let words = triplet(part, rank === 1);
      if (rank) words += ` ${plural(part, ...names[rank])}`;
      groups.unshift(words);
    }
    n = Math.floor(n / 1000); rank++;
  }
  const s = groups.join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function paragraph(xml, token) {
  const at = xml.indexOf(token);
  if (at < 0) throw Object.assign(new Error(`В образце отсутствует метка ${token}`), { status: 400 });
  const start = xml.lastIndexOf("<w:p", at);
  const end = xml.indexOf("</w:p>", at) + 6;
  if (start < 0 || end < 6) throw new Error(`Не удалось найти абзац ${token}`);
  return { start, end, xml: xml.slice(start, end) };
}
function repeatParagraph(xml, token, values) {
  const mold = paragraph(xml, token);
  const built = (values || []).map((value) => mold.xml.replace(token, escapeXml(value))).join("");
  return xml.slice(0, mold.start) + built + xml.slice(mold.end);
}
function repeatExperts(xml, experts) {
  if (!xml.includes("{{EXPERT_NAME}}")) return xml;
  const name = paragraph(xml, "{{EXPERT_NAME}}");
  const desc = paragraph(xml, "{{EXPERT_DESC_LINE}}");
  const from = Math.min(name.start, desc.start), to = Math.max(name.end, desc.end);
  let built = "";
  for (const expert of experts || []) {
    built += name.xml.replace("{{EXPERT_NAME}}", escapeXml(expert.name));
    for (const line of expert.descLines || []) built += desc.xml.replace("{{EXPERT_DESC_LINE}}", escapeXml(line));
  }
  return xml.slice(0, from) + built + xml.slice(to);
}
function appendImages(zip, xml, groups) {
  const files = groups.flatMap((g) => g.files || []);
  if (!files.length) return xml;
  const adder = docxImages.imageAdder(zip, xml);
  let body = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
  for (const group of groups) {
    if (group.title) body += `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${escapeXml(group.title)}</w:t></w:r></w:p>`;
    for (const file of group.files || []) {
      const p = adder.add(file.buffer, file.name, file.options || {});
      if (p) body += p;
    }
  }
  adder.flush();
  const at = xml.lastIndexOf("<w:sectPr");
  return at >= 0 ? xml.slice(0, at) + body + xml.slice(at) : xml.replace("</w:body>", body + "</w:body>");
}
function trimStitchRows(xml, count) {
  const wanted = Math.max(1, Math.min(6, Math.ceil((Number(count) || 2) / 2)));
  const tableStart = xml.indexOf("<w:tbl>");
  const tableEnd = xml.indexOf("</w:tbl>", tableStart);
  if (tableStart < 0 || tableEnd < 0) return xml;
  const table = xml.slice(tableStart, tableEnd + 8);
  const rows = table.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || [];
  if (rows.length <= wanted) return xml;
  let updated = table;
  for (const row of rows.slice(wanted)) updated = updated.replace(row, "");
  return xml.slice(0, tableStart) + updated + xml.slice(tableEnd + 8);
}
function composed(type, data) {
  const amount = Number(data.costAmount || 0);
  const vatPercent = Number(data.vatPercent || 20);
  const vat = vatPercent ? amount * vatPercent / (100 + vatPercent) : 0;
  const costClause = `${money(amount)} (${numberWords(amount)}) рублей 00 копеек, в том числе НДС ${vatPercent}% — ${money(vat)} (${numberWords(Math.round(vat))}) рублей 00 копеек. ${data.travelClause || ""}`.trim();
  const paymentClause = `с предоплатой ${data.prepaymentPercent || 100}%, на основании выставленного Исполнителем счёта, что составляет ${money(amount)} (${numberWords(amount)}) рублей 00 копеек, в том числе НДС ${vatPercent}% — ${money(vat)} (${numberWords(Math.round(vat))}) рублей 00 копеек`;
  return {
    CONTRACT_DATE: dateRu(data.contractDate), CUSTOMER_INTRO: data.customerIntro,
    CUSTOMER_REPRESENTATIVE: data.customerRepresentative, CUSTOMER_POSITION: data.customerPosition,
    CUSTOMER_AUTHORITY: data.customerAuthority,
    EXECUTOR_INTRO: "директора дирекции научно-технических проектов и экспертиз Воровкина Павла Александровича, действующего на основании доверенности №86 от 05.03.2025 г.",
    WORK_SUBJECT: data.workSubject, TERM_TEXT: data.termText, COST_CLAUSE: costClause,
    PAYMENT_CLAUSE: paymentClause,
    TRAVEL_CLAUSE: data.travelClause ? "Оплата командировочных расходов производится в течение 10 рабочих дней после предоставления Исполнителем документов, подтверждающих фактические расходы." : "",
    CUSTOMER_SHORT_NAME: data.customerShortName, LEGAL_ADDRESS: data.legalAddress, ACTUAL_ADDRESS: data.actualAddress,
    INN_KPP: data.innKpp, OGRN: data.ogrn, PAYMENT_ACCOUNT: data.paymentAccount,
    CORRESPONDENT_ACCOUNT: data.correspondentAccount, BIK: data.bik, PHONE: data.phone, EMAIL: data.email,
    CUSTOMER_INITIALS: data.customerInitials,
    RECIPIENT_ORGANIZATION: data.recipientOrganization, RECIPIENT_PERSON: data.recipientPerson,
    RECIPIENT_GREETING: data.recipientGreeting, EXECUTOR_NAME: data.executorName, EXECUTOR_EXTENSION: data.executorExtension,
    EXPERTISE_TYPE: data.expertiseType, SHEET_COUNT: data.sheetCount, SIGNER_1: data.signer1, SIGNER_2: data.signer2,
    COURT: data.court, CASE_NUMBER: data.caseNumber, JUDGE: data.judge, ORDER_REFERENCE: data.orderReference,
    REMOVED_EXPERT_SHORT: data.removedExpertShort, ADDED_EXPERTS_SHORT: data.addedExpertsShort,
    ADDITIONAL_MATERIALS_INTRO: data.additionalMaterialsIntro, INSPECTION_KIND: data.inspectionKind,
    INSPECTION_DETAILS: data.inspectionDetails, EXTENSION_REASON: data.extensionReason,
    EXTENSION_DAYS: data.extensionDays, EXTENSION_FROM: data.extensionFrom, EXPANSION_BASIS: data.expansionBasis,
    COURT_GENITIVE: data.courtGenitive, JUDGE_GENITIVE: data.judgeGenitive,
    ORDER_DATE: dateRu(data.orderDate), QUESTIONS_DUE_DATE: dateRu(data.questionsDueDate),
    CALLED_EXPERT_DATIVE: data.calledExpertDative, HEARING_DATE: dateRu(data.hearingDate),
    HEARING_HOUR: String(data.hearingHour || "").padStart(2, "0"), HEARING_MINUTE: String(data.hearingMinute || "").padStart(2, "0"),
  };
}
function generate(type, data, templateBuffer, { experts = [], attachmentFiles = [] } = {}) {
  const zip = new AdmZip(templateBuffer);
  const entry = zip.getEntry("word/document.xml");
  if (!entry) throw Object.assign(new Error("Образец повреждён: нет word/document.xml"), { status: 400 });
  let xml = docxPlaceholders.heal(entry.getData().toString("utf8"));
  if (xml.includes("{{QUESTION_ITEM}}")) xml = repeatParagraph(xml, "{{QUESTION_ITEM}}", data.questions);
  if (xml.includes("{{MATERIAL_ITEM}}")) xml = repeatParagraph(xml, "{{MATERIAL_ITEM}}", data.materials);
  if (xml.includes("{{APPLICATION_ITEM}}")) xml = repeatParagraph(xml, "{{APPLICATION_ITEM}}", data.applications);
  xml = repeatExperts(xml, experts);
  for (const [key, value] of Object.entries(composed(type, data))) xml = xml.split(`{{${key}}}`).join(escapeXml(value));
  if (type === "stitch") xml = trimStitchRows(xml, data.cardCount);
  const groups = [];
  if (experts.some((x) => (x.scans || []).length)) groups.push({ title: "Приложение № 1 — сведения об экспертах", files: experts.flatMap((x) => x.scans || []) });
  if (attachmentFiles.length) groups.push({ title: "Приложение № 2 — приказ о прекращении трудового договора", files: attachmentFiles });
  xml = appendImages(zip, xml, groups);
  const leftovers = docxPlaceholders.listPlaceholders(xml);
  if (leftovers.length) throw Object.assign(new Error(`Не заполнены метки образца: ${leftovers.join(", ")}`), { status: 400 });
  zip.updateFile("word/document.xml", Buffer.from(xml, "utf8"));
  return zip.toBuffer();
}

module.exports = { generate, dateRu, numberWords };
