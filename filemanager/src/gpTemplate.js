/* ============================================================
 *  Образцы гарантийного письма.
 *
 *  Письма похожи, но не одинаковы: одному делу нужно письмо с
 *  приложением документов, другому — покороче и без стоимости.
 *  Дописывать одно и то же руками каждый раз — работа, которую можно не
 *  делать. Поэтому образцов несколько, и при создании ГП выбирается, по
 *  какому собрать.
 *
 *  Что где лежит:
 *
 *    ЭТАЛОН  — в образе, /templates/gp-template.docx. Не правится
 *              никогда. Из него делается первый образец и к нему же
 *              возвращает кнопка «вернуть исходный».
 *    ОБРАЗЦЫ — в хранилище, /.Шаблоны/ГП/<id>.docx. Их правят люди,
 *              прямо на сайте, обычным редактором Word.
 *    СПИСОК  — /.Шаблоны/ГП/образцы.json: имена, порядок и какой
 *              основной. Имя образца — то, что человек видит в форме;
 *              имя файла — служебное, чтобы переименование образца не
 *              требовало переименовывать файл (и не ломало открытый
 *              редактор).
 *
 *  Больше пяти образцов завести нельзя. Ограничение не техническое:
 *  список, из которого выбирают каждый раз, перестаёт помогать, как
 *  только в нём появляется «Обычное-2 (новое, правленое)».
 *
 *  У каждого образца своя копия «до последней правки». Одна на всех
 *  была бы ловушкой: поправил один образец, потом другой — и вернуть
 *  первый уже нечем.
 * ============================================================ */

const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const docxPlaceholders = require("./docxPlaceholders");

const ORIGINAL_PATH = path.join(__dirname, "..", "templates", "gp-template.docx");

const DIR = "/.Шаблоны/ГП";
const LIST_FILE = `${DIR}/образцы.json`;
const MAX_SAMPLES = 5;

/** Куда переехали образцы: раньше шаблон был один и лежал здесь. */
const LEGACY_WORKING = "/.Шаблоны/Гарантийное письмо.docx";
const LEGACY_BACKUP = "/.Шаблоны/Гарантийное письмо (до последней правки).docx";

/**
 * Список обязательных меток берём у самого генератора, а не заводим
 * свой: две копии одного перечня однажды разойдутся, и настройки станут
 * показывать «всё на месте» про шаблон, по которому письмо не собирается.
 */
const { REQUIRED, OPTIONAL } = require("./gpGenerate");

const fileOf = (id) => `${DIR}/${id}.docx`;
const backupOf = (id) => `${DIR}/${id}.до-правки.docx`;

/** Имя образца — то, что читает человек. Файл называется иначе. */
function cleanName(raw) {
  const name = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!name) throw badRequest("Укажите название образца");
  if (name.length > 60) throw badRequest("Название длиннее 60 знаков");
  return name;
}

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

const documentXmlOf = (buffer) => {
  const entry = new AdmZip(buffer).getEntry("word/document.xml");
  if (!entry) throw new Error("Файл не похож на .docx (нет word/document.xml внутри)");
  return entry.getData().toString("utf8");
};

/**
 * Что сейчас с образцом: все ли метки на месте.
 *
 * Разорванные на куски собираются перед проверкой — иначе редактор,
 * разложивший «{{CASE_» и «NUMBER}}» по разным кускам, выглядел бы как
 * человек, стёрший метку.
 */
function inspect(buffer) {
  let present;
  try {
    present = new Set(docxPlaceholders.listPlaceholders(documentXmlOf(buffer)));
  } catch (err) {
    return { ok: false, broken: true, message: err.message, missing: [], missingOptional: [] };
  }
  const missing = REQUIRED.filter((r) => !present.has(r.token));
  return {
    ok: missing.length === 0,
    broken: false,
    missing,
    missingOptional: OPTIONAL.filter((r) => !present.has(r.token)),
  };
}

/* ---------- Список ---------- */

async function readList(safeResolve) {
  try {
    const raw = await fs.promises.readFile(safeResolve(LIST_FILE), "utf8");
    const data = JSON.parse(raw);
    const items = Array.isArray(data.items) ? data.items : [];
    return {
      defaultId: data.defaultId || (items[0] && items[0].id) || null,
      items: items.filter((i) => i && i.id).map((i) => ({
        id: String(i.id),
        name: String(i.name || i.id),
        updatedAt: i.updatedAt || null,
      })),
    };
  } catch {
    return { defaultId: null, items: [] };
  }
}

async function writeList(safeResolve, list) {
  await fs.promises.mkdir(safeResolve(DIR), { recursive: true });
  await fs.promises.writeFile(
    safeResolve(LIST_FILE),
    JSON.stringify({ version: 1, defaultId: list.defaultId, items: list.items }, null, 2),
    "utf8"
  );
}

/** Свободный id: t1…t9. Файлы лежат под ними, имена живут в списке. */
function nextId(list) {
  const used = new Set(list.items.map((i) => i.id));
  for (let n = 1; n < 100; n++) {
    const id = `t${n}`;
    if (!used.has(id)) return id;
  }
  throw new Error("не нашлось свободного имени файла образца");
}

/**
 * Приводит хранилище в рабочее состояние.
 *
 * Три случая, и все встречаются на живом сервере:
 *   — образцов ещё нет: заводим один из эталона;
 *   — остался шаблон от прежней, одношаблонной версии: он и становится
 *     первым образцом. Терять правки, которые человек уже внёс, нельзя;
 *   — список есть, но файла образца нет (удалили мимо системы): такой
 *     образец выбрасываем из списка, иначе выбор в форме приведёт в пустоту.
 */
async function ensure(safeResolve) {
  await fs.promises.mkdir(safeResolve(DIR), { recursive: true });
  let list = await readList(safeResolve);

  // Выбрасываем то, чего нет на диске.
  const alive = [];
  for (const item of list.items) {
    try {
      await fs.promises.access(safeResolve(fileOf(item.id)));
      alive.push(item);
    } catch { /* файла нет — пункт списка бессмыслен */ }
  }
  let changed = alive.length !== list.items.length;
  list.items = alive;

  if (!list.items.length) {
    const id = nextId(list);
    let from = ORIGINAL_PATH;
    let name = "Обычное";
    try {
      // Шаблон прежней версии — переносим его правки, а не эталон.
      await fs.promises.access(safeResolve(LEGACY_WORKING));
      from = safeResolve(LEGACY_WORKING);
    } catch { /* прежнего нет — берём эталон */ }
    await fs.promises.copyFile(from, safeResolve(fileOf(id)));
    try {
      await fs.promises.copyFile(safeResolve(LEGACY_BACKUP), safeResolve(backupOf(id)));
    } catch { /* прежней копии не было */ }
    list.items.push({ id, name, updatedAt: new Date().toISOString() });
    changed = true;
  }

  if (!list.defaultId || !list.items.some((i) => i.id === list.defaultId)) {
    list.defaultId = list.items[0].id;
    changed = true;
  }
  if (changed) await writeList(safeResolve, list);
  return list;
}

/** Список для экрана: с состоянием меток у каждого образца. */
async function listSamples(safeResolve, { withState = true } = {}) {
  const list = await ensure(safeResolve);
  const items = [];
  for (const item of list.items) {
    const row = { ...item, isDefault: item.id === list.defaultId };
    if (withState) {
      try {
        row.state = inspect(await fs.promises.readFile(safeResolve(fileOf(item.id))));
      } catch (err) {
        row.state = { ok: false, broken: true, message: err.message, missing: [], missingOptional: [] };
      }
      row.hasBackup = await exists(safeResolve, backupOf(item.id));
    }
    items.push(row);
  }
  return { items, defaultId: list.defaultId, max: MAX_SAMPLES };
}

async function exists(safeResolve, relPath) {
  try {
    await fs.promises.access(safeResolve(relPath));
    return true;
  } catch {
    return false;
  }
}

async function find(safeResolve, id) {
  const list = await ensure(safeResolve);
  const item = list.items.find((i) => i.id === String(id));
  if (!item) throw badRequest("Такого образца нет");
  return { item, list };
}

/** Содержимое образца. Без id — основного: по нему собирают чаще всего. */
async function readSample(safeResolve, id) {
  const list = await ensure(safeResolve);
  const wanted = id ? String(id) : list.defaultId;
  const item = list.items.find((i) => i.id === wanted);
  if (!item) throw badRequest("Такого образца нет — выберите другой");
  return { item, buffer: await fs.promises.readFile(safeResolve(fileOf(item.id))) };
}

async function createSample(safeResolve, { name, fromId }) {
  const list = await ensure(safeResolve);
  if (list.items.length >= MAX_SAMPLES) {
    throw badRequest(`Больше ${MAX_SAMPLES} образцов не бывает — удалите ненужный`);
  }
  const clean = cleanName(name);
  if (list.items.some((i) => i.name.toLowerCase() === clean.toLowerCase())) {
    throw badRequest(`Образец «${clean}» уже есть`);
  }
  const id = nextId(list);
  // Новый образец — копия существующего: почти всегда его и хотят
  // немного переделать. Пустой файл был бы бесполезен, а эталон часто
  // уже не похож на то, что рассылают сейчас.
  const source = fromId
    ? safeResolve(fileOf((list.items.find((i) => i.id === String(fromId)) || {}).id || ""))
    : ORIGINAL_PATH;
  await fs.promises.copyFile(fs.existsSync(source) ? source : ORIGINAL_PATH, safeResolve(fileOf(id)));
  list.items.push({ id, name: clean, updatedAt: new Date().toISOString() });
  await writeList(safeResolve, list);
  return { id, name: clean };
}

async function renameSample(safeResolve, id, name) {
  const { item, list } = await find(safeResolve, id);
  const clean = cleanName(name);
  if (list.items.some((i) => i.id !== item.id && i.name.toLowerCase() === clean.toLowerCase())) {
    throw badRequest(`Образец «${clean}» уже есть`);
  }
  item.name = clean;
  await writeList(safeResolve, list);
  return item;
}

async function setDefault(safeResolve, id) {
  const { item, list } = await find(safeResolve, id);
  list.defaultId = item.id;
  await writeList(safeResolve, list);
  return item;
}

async function removeSample(safeResolve, id) {
  const { item, list } = await find(safeResolve, id);
  if (list.items.length <= 1) {
    throw badRequest("Это последний образец — без него письмо будет не из чего собрать");
  }
  list.items = list.items.filter((i) => i.id !== item.id);
  if (list.defaultId === item.id) list.defaultId = list.items[0].id;
  await writeList(safeResolve, list);
  // Файл убираем после списка: оборвись мы посередине, лучше остаться с
  // лишним файлом на диске, чем со ссылкой на файл, которого нет.
  for (const p of [fileOf(item.id), backupOf(item.id)]) {
    try { await fs.promises.unlink(safeResolve(p)); } catch { /* уже нет */ }
  }
  return item;
}

/** Копия «как было» — своя у каждого образца, ровно перед перезаписью. */
async function backup(safeResolve, id) {
  try {
    await fs.promises.copyFile(safeResolve(fileOf(id)), safeResolve(backupOf(id)));
    return true;
  } catch {
    return false;
  }
}

/** Отметить, что образец правили: в списке видно, когда это было. */
async function touch(safeResolve, id) {
  const list = await ensure(safeResolve);
  const item = list.items.find((i) => i.id === String(id));
  if (!item) return;
  item.updatedAt = new Date().toISOString();
  await writeList(safeResolve, list);
}

async function resetToOriginal(safeResolve, id) {
  const { item } = await find(safeResolve, id);
  await backup(safeResolve, item.id);
  await fs.promises.copyFile(ORIGINAL_PATH, safeResolve(fileOf(item.id)));
  await touch(safeResolve, item.id);
  return item;
}

/** Вернуть то, что было до последней правки. Обратимо: файлы меняются местами. */
async function restoreBackup(safeResolve, id) {
  const { item } = await find(safeResolve, id);
  if (!(await exists(safeResolve, backupOf(item.id)))) {
    throw badRequest("Копии «до последней правки» ещё нет — образец не меняли");
  }
  const current = await fs.promises.readFile(safeResolve(fileOf(item.id)));
  const previous = await fs.promises.readFile(safeResolve(backupOf(item.id)));
  await fs.promises.writeFile(safeResolve(backupOf(item.id)), current);
  await fs.promises.writeFile(safeResolve(fileOf(item.id)), previous);
  await touch(safeResolve, item.id);
  return item;
}

/** Путь образца по файлу — чтобы узнать образец по адресу из редактора. */
function idByPath(relPath) {
  const m = new RegExp(`^${DIR}/(t\\d+)\\.docx$`).exec(String(relPath || ""));
  return m ? m[1] : null;
}

module.exports = {
  ORIGINAL_PATH, DIR, LIST_FILE, MAX_SAMPLES,
  REQUIRED, OPTIONAL,
  fileOf, backupOf, idByPath,
  inspect, ensure, listSamples, readSample, find,
  createSample, renameSample, setDefault, removeSample,
  backup, touch, resetToOriginal, restoreBackup,
};
