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
 *       Сведения <Имя>.docx                — текст пунктами
 *       Сведения <Имя> с документами.docx  — тот же текст со сканами
 *       Приложения/                        — сами сканы
 *       .сведения.json                     — пункты и что к чему приложено
 *
 * Собирает и обновляет эти файлы expertInfo.js; здесь — только папка
 * эксперта и ответ на вопрос, есть ли у него сведения вообще.
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

/**
 * Есть ли чему попасть в письмо.
 *
 * Сведения теперь хранятся пунктами (.сведения.json), но у экспертов,
 * заведённых раньше, они лежат абзацами в .docx. Годятся оба: во втором
 * случае пункты подтянутся из файла при первом открытии формы. Считать
 * годным только новый формат значило бы объявить всех прежних экспертов
 * незаполненными в день обновления.
 */
async function hasInfo(safeResolve, name) {
  const dir = expertPath(name);
  try {
    const raw = await fs.promises.readFile(safeResolve(`${dir}/.сведения.json`), "utf8");
    const data = JSON.parse(raw);
    if (Array.isArray(data.items) && data.items.some((i) => String(i?.text || "").trim())) return true;
  } catch { /* нет или испорчен — смотрим старые файлы */ }

  for (const fileName of [`Сведения ${name}.docx`, INFO_FILENAME]) {
    try {
      await fs.promises.access(safeResolve(`${dir}/${fileName}`));
      return true;
    } catch { /* следующий */ }
  }
  return false;
}

/**
 * Заводит папку эксперта и кладёт в неё сведения.
 *
 * Папку создаём через mkdir без recursive: так попытка завести эксперта
 * с уже занятым именем падает с EEXIST, а не молча дописывает файлы
 * в чужую папку поверх существующих сведений.
 */
async function createExpert(safeResolve, { name }) {
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

  return { name: clean, path: expertPath(clean) };
}

module.exports = {
  EXPERTS_DIR,
  INFO_FILENAME,
  ATTACH_DIRNAME,
  normalizeName,
  expertPath,
  listAttachments,
  hasInfo,
  createExpert,
};
