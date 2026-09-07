const AdmZip = require("adm-zip");
const fs = require("fs");
const path = require("path");

/**
 * Эксперты.
 *
 * Справочник экспертов живёт не в базе, а прямо в файлах — так было
 * с самого начала, и менять это не нужно: папку эксперта можно открыть,
 * скачать, показать кому угодно обычными средствами, не заводя ещё одну
 * таблицу, которая рано или поздно разойдётся с содержимым диска.
 *
 *   /База данных/Эксперты/<Имя эксперта>/
 *       Сведения.docx        — обязателен, из него ГП берёт абзацы описания
 *       Приложения/          — дипломы, сертификаты, удостоверения
 *
 * Имя папки — это имя эксперта: ровно так он подписан в гарантийном письме.
 *
 * Раньше папку и Сведения.docx делали руками в Word, и эксперт «не
 * появлялся» в списке ГП, если файл назвали иначе или забыли положить.
 * Теперь то же самое делает форма, а имя файла задаёт код.
 */

const EXPERTS_DIR = "/База данных/Эксперты";
const INFO_FILENAME = "Сведения.docx";
const ATTACH_DIRNAME = "Приложения";

/**
 * Собирает простой .docx из строк текста.
 *
 * Библиотеки для записи Word здесь нет и заводить её ради одного файла
 * незачем: .docx — это zip с несколькими xml внутри, и минимально
 * достаточный набор умещается в эту функцию. Шрифт и кегль взяты те же,
 * что в шаблоне ГП (Times New Roman 12 пт = 24 полукегля), чтобы
 * сведения, набранные в системе, и сведения, принесённые в готовом
 * файле, выглядели одинаково.
 *
 * Обратная сторона такой самодельной сборки честная: это именно текст
 * абзацами, без таблиц, картинок и оформления. Если эксперт приносит
 * красиво свёрстанный файл — его нужно приложить как есть, для этого
 * в форме и оставлена загрузка.
 */
function buildInfoDocx(lines) {
  const paragraphs = (lines || [])
    .map((line) => String(line ?? "").trim())
    .filter(Boolean);
  if (!paragraphs.length) throw new Error("Сведения пустые");

  const body = paragraphs.map((text) => `
    <w:p>
      <w:pPr><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/></w:rPr></w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/></w:rPr>
        <w:t xml:space="preserve">${escapeXml(text)}</w:t>
      </w:r>
    </w:p>`).join("");

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="1701"/></w:sectPr></w:body>
</w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const zip = new AdmZip();
  zip.addFile("[Content_Types].xml", Buffer.from(contentTypes, "utf8"));
  zip.addFile("_rels/.rels", Buffer.from(rootRels, "utf8"));
  zip.addFile("word/document.xml", Buffer.from(document, "utf8"));
  return zip.toBuffer();
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Имя папки эксперта.
 *
 * В именах файлов на диске запрещены слэши и служебные символы, а точки
 * и пробелы по краям Windows молча срезает — из-за чего папка «Иванов И.И.»
 * могла превратиться в «Иванов И.И» и перестать совпадать с тем, что
 * человек ввёл. Поэтому чистим и проверяем здесь, один раз.
 */
function normalizeName(raw) {
  const name = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!name) throw badRequest("Укажите имя эксперта");
  if (name.length > 120) throw badRequest("Имя эксперта длиннее 120 символов");
  if (/[\\/:*?"<>|]/.test(name)) {
    throw badRequest('В имени нельзя использовать символы \\ / : * ? " < > |');
  }
  // «.» и «..» — это не имена, а обозначения текущей и родительской папки:
  // такая папка либо не создастся, либо создастся не там, где ожидают.
  //
  // А вот точку в конце («Иванов И.И.») разрешаем: это естественная запись
  // инициалов, хранилище у нас Linux, и там она сохраняется как есть.
  // Оговорка честная: если такую папку скачать и распаковать в Windows,
  // проводник точку в конце срежет — на работе системы это не сказывается,
  // но имя папки на своём компьютере человек увидит без неё.
  if (name === "." || name === "..") {
    throw badRequest("Такое имя использовать нельзя");
  }
  return name;
}

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

/** Путь к папке эксперта в терминах файлового менеджера (не абсолютный). */
const expertPath = (name) => `${EXPERTS_DIR}/${name}`;

/**
 * Приложения эксперта — всё, что лежит в его подпапке «Приложения».
 *
 * Вложенные папки не разворачиваем: приложение — это документ, а не
 * дерево. Если кто-то положит туда папку, она просто не попадёт в список
 * и в ГП, и это лучше, чем молча приложить к письму в суд неизвестно что.
 */
async function listAttachments(safeResolve, name) {
  const dirAbs = safeResolve(`${expertPath(name)}/${ATTACH_DIRNAME}`);
  let entries;
  try {
    entries = await fs.promises.readdir(dirAbs, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isFile() && !e.name.startsWith("."))
    .map((e) => ({
      name: e.name,
      path: `${expertPath(name)}/${ATTACH_DIRNAME}/${e.name}`,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

/** Есть ли у эксперта Сведения.docx — только с ним он годится для ГП. */
async function hasInfo(safeResolve, name) {
  try {
    await fs.promises.access(safeResolve(`${expertPath(name)}/${INFO_FILENAME}`));
    return true;
  } catch {
    return false;
  }
}

/**
 * Заводит папку эксперта и кладёт в неё сведения.
 *
 * Папку создаём через mkdir без recursive: так попытка завести эксперта
 * с уже занятым именем падает с EEXIST, а не молча дописывает файлы
 * в чужую папку поверх существующих сведений.
 */
async function createExpert(safeResolve, { name, infoLines }) {
  const clean = normalizeName(name);
  const dirAbs = safeResolve(expertPath(clean));

  await fs.promises.mkdir(safeResolve(EXPERTS_DIR), { recursive: true });
  try {
    await fs.promises.mkdir(dirAbs);
  } catch (err) {
    if (err.code === "EEXIST") {
      const conflict = new Error(`Эксперт «${clean}» уже есть`);
      conflict.status = 409;
      throw conflict;
    }
    throw err;
  }

  // Подпапку для приложений заводим сразу, даже пустую: человеку видно,
  // куда класть дипломы, и не приходится гадать про имя.
  await fs.promises.mkdir(path.join(dirAbs, ATTACH_DIRNAME), { recursive: true });

  // Сведения текстом — сразу собираем файл. Если их принесут готовым
  // файлом, он придёт следующим запросом через обычную загрузку:
  // папка к этому моменту уже есть.
  if (infoLines && infoLines.length) {
    await fs.promises.writeFile(
      path.join(dirAbs, INFO_FILENAME),
      buildInfoDocx(infoLines)
    );
  }

  return { name: clean, path: expertPath(clean) };
}

module.exports = {
  EXPERTS_DIR,
  INFO_FILENAME,
  ATTACH_DIRNAME,
  buildInfoDocx,
  normalizeName,
  expertPath,
  listAttachments,
  hasInfo,
  createExpert,
};
