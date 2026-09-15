/* ============================================================
 *  Шаблон гарантийного письма: рабочий файл и эталон.
 *
 *  Раньше шаблон лежал внутри образа (filemanager/templates). Поправить
 *  в нём запятую можно было только через меня: собрать образ заново.
 *  Теперь рабочий шаблон живёт в хранилище данных и правится прямо на
 *  сайте, в настройках, обычным редактором Word.
 *
 *  Два файла, и это важно:
 *
 *    ЭТАЛОН   — в образе, /templates/gp-template.docx. Его никто не
 *               правит. Он нужен ровно для одного: вернуть всё как было,
 *               если шаблон испортили.
 *    РАБОЧИЙ  — в хранилище, /.Шаблоны/Гарантийное письмо.docx. Из него
 *               и собираются письма.
 *
 *  Рабочий лежит в хранилище, а не в образе, по двум причинам: правки
 *  переживают пересборку (в образе их стёрло бы первым же обновлением),
 *  и их видит тот самый редактор OnlyOffice, который уже открывает
 *  файлы системы. Папка начинается с точки — файловый менеджер такие не
 *  показывает: шаблон правят в настройках, а не перетаскивают в папках.
 *
 *  Перед каждой перезаписью сохраняется предыдущая версия. Не ради
 *  истории, а ради одного случая: человек правил, сохранил, увидел, что
 *  сломал, — и хочет вернуть вчерашнее, а не эталон трёхлетней давности.
 * ============================================================ */

const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const docxPlaceholders = require("./docxPlaceholders");

const ORIGINAL_PATH = path.join(__dirname, "..", "templates", "gp-template.docx");

const DIR = "/.Шаблоны";
const FILE_NAME = "Гарантийное письмо.docx";
const WORKING_PATH = `${DIR}/${FILE_NAME}`;
const BACKUP_PATH = `${DIR}/Гарантийное письмо (до последней правки).docx`;

/**
 * Что обязано быть в шаблоне, чтобы письмо вообще собралось.
 *
 * Список берём у самого генератора, а не заводим свой: две копии одного
 * перечня однажды разойдутся, и настройки станут показывать «всё на
 * месте» про шаблон, по которому письмо не собирается.
 */
const { REQUIRED, OPTIONAL } = require("./gpGenerate");

const documentXmlOf = (buffer) => {
  const entry = new AdmZip(buffer).getEntry("word/document.xml");
  if (!entry) throw new Error("Файл не похож на .docx (нет word/document.xml внутри)");
  return entry.getData().toString("utf8");
};

/**
 * Рабочий шаблон. Нет — кладём копию эталона.
 *
 * Делается при каждом обращении, а не один раз при запуске: папку могли
 * удалить, хранилище — подменить, контейнер — перезапустить. Дешевле
 * проверить наличие файла, чем однажды не найти шаблон в момент, когда
 * человек нажал «Создать ГП».
 */
async function ensureWorking(safeResolve) {
  const abs = safeResolve(WORKING_PATH);
  try {
    await fs.promises.access(abs);
    return abs;
  } catch { /* нет — заводим */ }
  await fs.promises.mkdir(path.dirname(abs), { recursive: true });
  await fs.promises.copyFile(ORIGINAL_PATH, abs);
  return abs;
}

async function readWorking(safeResolve) {
  return fs.promises.readFile(await ensureWorking(safeResolve));
}

/**
 * Что сейчас с шаблоном: все ли плейсхолдеры на месте.
 *
 * Разорванные на куски собираются перед проверкой — иначе редактор,
 * разложивший «{{CASE_» и «NUMBER}}» по разным кускам, выглядел бы как
 * человек, стёрший плейсхолдер.
 */
function inspect(buffer) {
  let present;
  try {
    present = new Set(docxPlaceholders.listPlaceholders(documentXmlOf(buffer)));
  } catch (err) {
    return { ok: false, broken: true, message: err.message, missing: [], extra: [] };
  }
  const missing = REQUIRED.filter((r) => !present.has(r.token));
  const missingOptional = OPTIONAL.filter((r) => !present.has(r.token));
  const known = new Set([...REQUIRED, ...OPTIONAL].map((r) => r.token));
  const extra = [...present].filter((t) => !known.has(t));
  return {
    ok: missing.length === 0,
    broken: false,
    missing,
    missingOptional,
    extra,
    present: [...present],
  };
}

async function inspectWorking(safeResolve) {
  return inspect(await readWorking(safeResolve));
}

/** Копия «как было» — одна, перед перезаписью. */
async function backup(safeResolve) {
  const abs = safeResolve(WORKING_PATH);
  try {
    await fs.promises.copyFile(abs, safeResolve(BACKUP_PATH));
    return true;
  } catch {
    return false;
  }
}

async function hasBackup(safeResolve) {
  try {
    await fs.promises.access(safeResolve(BACKUP_PATH));
    return true;
  } catch {
    return false;
  }
}

/** Вернуть эталон из образа. Прежний рабочий уходит в копию. */
async function resetToOriginal(safeResolve) {
  const abs = await ensureWorking(safeResolve);
  await backup(safeResolve);
  await fs.promises.copyFile(ORIGINAL_PATH, abs);
  return abs;
}

/** Вернуть то, что было до последней правки. */
async function restoreBackup(safeResolve) {
  if (!(await hasBackup(safeResolve))) {
    const err = new Error("Копии «до последней правки» ещё нет — шаблон не меняли");
    err.status = 400;
    throw err;
  }
  const abs = await ensureWorking(safeResolve);
  const previous = await fs.promises.readFile(safeResolve(BACKUP_PATH));
  const current = await fs.promises.readFile(abs);
  // Меняем местами: вернуть возврат должно быть так же просто.
  await fs.promises.writeFile(safeResolve(BACKUP_PATH), current);
  await fs.promises.writeFile(abs, previous);
  return abs;
}

module.exports = {
  ORIGINAL_PATH,
  DIR,
  FILE_NAME,
  WORKING_PATH,
  BACKUP_PATH,
  REQUIRED,
  OPTIONAL,
  ensureWorking,
  readWorking,
  inspect,
  inspectWorking,
  backup,
  hasBackup,
  resetToOriginal,
  restoreBackup,
};
