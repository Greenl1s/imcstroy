/* ============================================================
 *  Сведения об эксперте: пункты и подтверждающие сканы.
 *
 *  Раньше сведения были просто файлом, который клали в папку руками.
 *  Файл — это текст, и связи «вот этот диплом подтверждает вот этот
 *  пункт» в нём нет: сканы лежали кучей в соседней папке, а в письмо
 *  попадали в том порядке, в каком их назвали. Теперь сведения — это
 *  список пунктов, и у каждого пункта свои сканы.
 *
 *  Как это лежит на диске:
 *
 *    /База данных/Эксперты/<Имя>/
 *        Сведения <Имя>.docx                — текст пунктами
 *        Сведения <Имя> с документами.docx  — тот же текст + сканы
 *        Приложения/                        — сами сканы
 *        .сведения.json                     — что к чему относится
 *
 *  Оба .docx собираются заново при каждом сохранении и правятся ТОЛЬКО
 *  через форму: это выгрузка из .сведения.json, а не источник. Править
 *  их в Word можно, но следующее сохранение затрёт правку — так и
 *  написано в форме.
 *
 *  Почему связь в json, а не в базе: справочник экспертов с самого
 *  начала живёт в файлах, папку можно скачать и унести целиком. Заведи
 *  мы таблицу — через полгода она разойдётся с содержимым диска, и
 *  чинить пришлось бы обоими руками. Имя файла начинается с точки:
 *  файловый менеджер такие не показывает, и человек видит в папке ровно
 *  свои документы.
 * ============================================================ */

const AdmZip = require("adm-zip");
const fs = require("fs");
const path = require("path");
const docxImages = require("./docxImages");

const STORE_FILENAME = ".сведения.json";
const ATTACH_DIRNAME = "Приложения";

/** Имена двух файлов сведений. Имя эксперта — в имени файла: так его
 *  видно, даже если файл вынули из папки и переслали почтой. */
const infoFileName = (expertName) => `Сведения ${expertName}.docx`;
const infoWithDocsFileName = (expertName) => `Сведения ${expertName} с документами.docx`;

function normalizeImageOptions(value) {
  const rotation = [0, 90, 180, 270].includes(Number(value?.rotation))
    ? Number(value.rotation) : 0;
  const widthPercent = [50, 75, 100].includes(Number(value?.width_percent))
    ? Number(value.width_percent) : 100;
  return { rotation, width_percent: widthPercent };
}

function escapeXml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ---------- Хранилище ---------- */

/**
 * Читает сведения эксперта.
 *
 * Возвращает { items: [{ text, files: [имя файла, ...] }] }. Если
 * json ещё нет — пусто; подтягиванием старого текста занимается
 * importLegacy, и делает это явно, а не втихую при каждом чтении.
 */
async function read(safeResolve, expertDir) {
  let raw;
  try {
    raw = await fs.promises.readFile(safeResolve(`${expertDir}/${STORE_FILENAME}`), "utf8");
  } catch {
    return { items: [] };
  }
  try {
    const data = JSON.parse(raw);
    const items = Array.isArray(data.items) ? data.items : [];
    return {
      items: items.map((it) => ({
        text: String(it?.text ?? "").trim(),
        files: Array.isArray(it?.files) ? it.files.map(String).filter(Boolean) : [],
        image_options: Object.fromEntries(
          Object.entries(it?.image_options && typeof it.image_options === "object" ? it.image_options : {})
            .map(([name, options]) => [String(name), normalizeImageOptions(options)])
        ),
      })).filter((it) => it.text || it.files.length),
    };
  } catch {
    // Файл испорчен — не роняем всю папку эксперта из-за одной строки.
    // Пусто честнее, чем половина сведений неизвестной давности.
    return { items: [], broken: true };
  }
}

async function write(safeResolve, expertDir, items) {
  const payload = {
    version: 2,
    updated_at: new Date().toISOString(),
    items: items.map((it) => ({
      text: it.text,
      files: it.files,
      image_options: Object.fromEntries(
        it.files.map((name) => [name, normalizeImageOptions(it.image_options?.[name])])
      ),
    })),
  };
  await fs.promises.writeFile(
    safeResolve(`${expertDir}/${STORE_FILENAME}`),
    JSON.stringify(payload, null, 2),
    "utf8"
  );
}

/**
 * Подтягивает пункты из старого файла сведений, набранного вручную.
 *
 * У экспертов, заведённых до этой правки, вся биография лежит абзацами
 * в .docx. Терять её и заставлять набирать заново нельзя, поэтому при
 * первом открытии формы абзацы становятся пунктами — без сканов, их
 * прикрепляют руками.
 *
 * Первый абзац пропускаем, если он совпадает с именем эксперта: в
 * старых файлах сверху стоит ФИО, а в ГП имя подставляется отдельно, и
 * иначе оно задвоилось бы.
 */
async function importLegacy(safeResolve, expertDir, expertName, extractParagraphTexts) {
  const candidates = [
    infoFileName(expertName),
    "Сведения.docx",
  ];
  for (const fileName of candidates) {
    let buffer;
    try {
      buffer = await fs.promises.readFile(safeResolve(`${expertDir}/${fileName}`));
    } catch {
      continue;
    }
    let lines;
    try {
      lines = extractParagraphTexts(buffer);
    } catch {
      continue;
    }
    const cleaned = lines
      .map((l) => String(l).replace(/^[-–—•]\s*/, "").trim())
      .filter(Boolean);
    if (cleaned.length && cleaned[0].toLowerCase() === String(expertName).toLowerCase()) {
      cleaned.shift();
    }
    if (cleaned.length) {
      return { items: cleaned.map((text) => ({ text, files: [] })), from: fileName };
    }
  }
  return { items: [] };
}

/* ---------- Сборка .docx ---------- */

const FONT = '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/>';

function textParagraph(text, { bold = false, center = false } = {}) {
  const rPr = `<w:rPr>${FONT}${bold ? "<w:b/>" : ""}</w:rPr>`;
  const jc = center ? '<w:jc w:val="center"/>' : '<w:jc w:val="both"/>';
  return `<w:p><w:pPr>${jc}<w:rPr>${FONT}</w:rPr></w:pPr>` +
    `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

const SECT_PR = '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
  '<w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="1701"/></w:sectPr>';

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;

function wrapDocument(bodyXml) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>${bodyXml}${SECT_PR}</w:body></w:document>`;
}

function newDocxZip(documentXml) {
  const zip = new AdmZip();
  zip.addFile("[Content_Types].xml", Buffer.from(CONTENT_TYPES, "utf8"));
  zip.addFile("_rels/.rels", Buffer.from(ROOT_RELS, "utf8"));
  zip.addFile("word/_rels/document.xml.rels", Buffer.from(DOC_RELS, "utf8"));
  zip.addFile("word/document.xml", Buffer.from(documentXml, "utf8"));
  return zip;
}

/**
 * Сведения текстом: имя, дальше пункты через «- ».
 *
 * Дефис ставим здесь, а не храним в тексте пункта: в гарантийное письмо
 * тот же пункт уходит без дефиса, там своё оформление. Храни мы его в
 * тексте — пришлось бы вычищать на выходе, а значит иногда не вычистить.
 */
function buildInfoDocx(expertName, items) {
  const body = [
    textParagraph(expertName, { bold: true }),
    ...items.map((it) => textParagraph(`- ${it.text}`)),
  ].join("");
  return newDocxZip(wrapDocument(body)).toBuffer();
}

/**
 * Те же сведения, но под каждым пунктом — его сканы.
 *
 * Скан идёт сразу за своим пунктом, а не общей кучей в конце: смысл
 * файла в том, чтобы видеть, чем именно подтверждён этот пункт.
 */
function buildInfoWithDocsDocx(expertName, items, filesByName) {
  const documentXml = wrapDocument("");
  const zip = newDocxZip(documentXml);
  const adder = docxImages.imageAdder(zip, documentXml);

  let body = textParagraph(expertName, { bold: true });
  for (const item of items) {
    body += textParagraph(`- ${item.text}`);
    for (const fileName of item.files) {
      const buffer = filesByName.get(fileName);
      if (!buffer) continue;
      const paragraph = adder.add(buffer, fileName, item.image_options?.[fileName]);
      if (paragraph) body += paragraph;
    }
  }

  zip.updateFile("word/document.xml", Buffer.from(wrapDocument(body), "utf8"));
  adder.flush();
  return zip.toBuffer();
}

/**
 * Пересобирает оба файла сведений по сохранённым пунктам.
 *
 * Оба разом и всегда: если собирать по отдельности, рано или поздно они
 * разойдутся, и человек отправит в суд текст одной давности, а
 * подтверждения — другой.
 */
async function rebuildDocs(safeResolve, expertDir, expertName, items) {
  const filesByName = new Map();
  for (const item of items) {
    for (const fileName of item.files) {
      if (filesByName.has(fileName)) continue;
      try {
        filesByName.set(
          fileName,
          await fs.promises.readFile(safeResolve(`${expertDir}/${ATTACH_DIRNAME}/${fileName}`))
        );
      } catch {
        // Скан удалили мимо системы — пункт останется без него, но
        // документ всё равно должен собраться.
      }
    }
  }

  const dirAbs = safeResolve(expertDir);
  await fs.promises.writeFile(
    path.join(dirAbs, infoFileName(expertName)),
    buildInfoDocx(expertName, items)
  );
  await fs.promises.writeFile(
    path.join(dirAbs, infoWithDocsFileName(expertName)),
    buildInfoWithDocsDocx(expertName, items, filesByName)
  );
  return { missing: [...new Set(items.flatMap((i) => i.files))].filter((f) => !filesByName.has(f)) };
}

module.exports = {
  STORE_FILENAME,
  ATTACH_DIRNAME,
  infoFileName,
  infoWithDocsFileName,
  read,
  write,
  importLegacy,
  buildInfoDocx,
  buildInfoWithDocsDocx,
  rebuildDocs,
  textParagraph,
  normalizeImageOptions,
};
