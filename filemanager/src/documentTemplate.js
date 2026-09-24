const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const docxPlaceholders = require("./docxPlaceholders");
const documentTypes = require("./documentTypes");

const ROOT = "/.Шаблоны/Документы";
const MAX_SAMPLES = 5;
const typeDir = (type) => `${ROOT}/${type}`;
const listPath = (type) => `${typeDir(type)}/образцы.json`;
const fileOf = (type, id) => `${typeDir(type)}/${id}.docx`;
const backupOf = (type, id) => `${typeDir(type)}/${id}.до-правки.docx`;
const originalOf = (type) => path.join(__dirname, "..", "templates", "documents", documentTypes.get(type).templateFile);

function bad(message, status = 400) { const e = new Error(message); e.status = status; return e; }
function cleanName(raw) {
  const name = String(raw || "").replace(/\s+/g, " ").trim();
  if (!name) throw bad("Укажите название образца");
  if (name.length > 60) throw bad("Название длиннее 60 знаков");
  return name;
}
function inspect(type, buffer) {
  try {
    const entry = new AdmZip(buffer).getEntry("word/document.xml");
    if (!entry) throw new Error("нет word/document.xml");
    const expected = new Set(docxPlaceholders.listPlaceholders(
      new AdmZip(originalOf(type)).getEntry("word/document.xml").getData().toString("utf8")));
    const actual = new Set(docxPlaceholders.listPlaceholders(entry.getData().toString("utf8")));
    const missing = [...expected].filter((token) => !actual.has(token)).map((token) => ({ token }));
    return { ok: !missing.length, broken: false, missing, missingOptional: [] };
  } catch (err) {
    return { ok: false, broken: true, message: err.message, missing: [], missingOptional: [] };
  }
}
async function readList(safeResolve, type) {
  try {
    const data = JSON.parse(await fs.promises.readFile(safeResolve(listPath(type)), "utf8"));
    return { defaultId: data.defaultId || null, items: (data.items || []).filter((x) => x && x.id) };
  } catch { return { defaultId: null, items: [] }; }
}
async function writeList(safeResolve, type, list) {
  await fs.promises.mkdir(safeResolve(typeDir(type)), { recursive: true });
  await fs.promises.writeFile(safeResolve(listPath(type)), JSON.stringify({ version: 1, ...list }, null, 2), "utf8");
}
async function exists(safeResolve, rel) { try { await fs.promises.access(safeResolve(rel)); return true; } catch { return false; } }
function nextId(list) {
  for (let n = 1; n < 100; n++) if (!list.items.some((x) => x.id === `t${n}`)) return `t${n}`;
  throw bad("Не нашлось свободного имени образца");
}
async function ensure(safeResolve, rawType) {
  const type = documentTypes.get(rawType).id;
  await fs.promises.mkdir(safeResolve(typeDir(type)), { recursive: true });
  const list = await readList(safeResolve, type);
  list.items = (await Promise.all(list.items.map(async (item) =>
    (await exists(safeResolve, fileOf(type, item.id))) ? item : null))).filter(Boolean);
  if (!list.items.length) {
    const id = "t1";
    await fs.promises.copyFile(originalOf(type), safeResolve(fileOf(type, id)));
    list.items.push({ id, name: "Основной", updatedAt: new Date().toISOString() });
  }
  if (!list.items.some((x) => x.id === list.defaultId)) list.defaultId = list.items[0].id;
  await writeList(safeResolve, type, list);
  return list;
}
async function listSamples(safeResolve, type, { withState = true } = {}) {
  const list = await ensure(safeResolve, type);
  const items = [];
  for (const item of list.items) {
    const row = { ...item, isDefault: item.id === list.defaultId };
    if (withState) {
      row.state = inspect(type, await fs.promises.readFile(safeResolve(fileOf(type, item.id))));
      row.hasBackup = await exists(safeResolve, backupOf(type, item.id));
    }
    items.push(row);
  }
  return { items, defaultId: list.defaultId, max: MAX_SAMPLES };
}
async function find(safeResolve, type, id) {
  const list = await ensure(safeResolve, type);
  const item = list.items.find((x) => x.id === String(id));
  if (!item) throw bad("Такого образца нет", 404);
  return { item, list };
}
async function readSample(safeResolve, type, id) {
  const list = await ensure(safeResolve, type);
  const wanted = id || list.defaultId;
  const item = list.items.find((x) => x.id === wanted);
  if (!item) throw bad("Такого образца нет", 404);
  return { item, buffer: await fs.promises.readFile(safeResolve(fileOf(type, item.id))) };
}
async function createSample(safeResolve, type, { name, fromId }) {
  const list = await ensure(safeResolve, type);
  if (list.items.length >= MAX_SAMPLES) throw bad(`Можно создать не больше ${MAX_SAMPLES} образцов`);
  const clean = cleanName(name);
  if (list.items.some((x) => x.name.toLowerCase() === clean.toLowerCase())) throw bad(`Образец «${clean}» уже есть`);
  const id = nextId(list);
  const source = fromId && list.items.some((x) => x.id === fromId) ? safeResolve(fileOf(type, fromId)) : originalOf(type);
  await fs.promises.copyFile(source, safeResolve(fileOf(type, id)));
  list.items.push({ id, name: clean, updatedAt: new Date().toISOString() });
  await writeList(safeResolve, type, list);
  return { id, name: clean };
}
async function updateSample(safeResolve, type, id, { name, makeDefault }) {
  const { item, list } = await find(safeResolve, type, id);
  if (name !== undefined) {
    const clean = cleanName(name);
    if (list.items.some((x) => x.id !== item.id && x.name.toLowerCase() === clean.toLowerCase())) throw bad(`Образец «${clean}» уже есть`);
    item.name = clean;
  }
  if (makeDefault) list.defaultId = item.id;
  await writeList(safeResolve, type, list);
}
async function removeSample(safeResolve, type, id) {
  const { item, list } = await find(safeResolve, type, id);
  if (list.items.length <= 1) throw bad("Нельзя удалить последний образец");
  list.items = list.items.filter((x) => x.id !== item.id);
  if (list.defaultId === item.id) list.defaultId = list.items[0].id;
  await writeList(safeResolve, type, list);
  for (const rel of [fileOf(type, id), backupOf(type, id)]) try { await fs.promises.unlink(safeResolve(rel)); } catch { /* нет файла */ }
  return item;
}
async function backup(safeResolve, type, id) {
  try { await fs.promises.copyFile(safeResolve(fileOf(type, id)), safeResolve(backupOf(type, id))); return true; } catch { return false; }
}
async function touch(safeResolve, type, id) {
  const { item, list } = await find(safeResolve, type, id);
  item.updatedAt = new Date().toISOString();
  await writeList(safeResolve, type, list);
}
async function restore(safeResolve, type, id, source) {
  await find(safeResolve, type, id);
  const from = source === "backup" ? backupOf(type, id) : null;
  if (from) {
    if (!(await exists(safeResolve, from))) throw bad("Копии до последней правки ещё нет");
    const current = await fs.promises.readFile(safeResolve(fileOf(type, id)));
    const previous = await fs.promises.readFile(safeResolve(from));
    await fs.promises.writeFile(safeResolve(from), current);
    await fs.promises.writeFile(safeResolve(fileOf(type, id)), previous);
  } else {
    await backup(safeResolve, type, id);
    await fs.promises.copyFile(originalOf(type), safeResolve(fileOf(type, id)));
  }
  await touch(safeResolve, type, id);
}
function identifyPath(relPath) {
  const escaped = ROOT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`^${escaped}/([^/]+)/(t\\d+)\\.docx$`).exec(String(relPath || ""));
  if (!m || !documentTypes.TYPES[m[1]]) return null;
  return { type: m[1], id: m[2] };
}

module.exports = { ROOT, MAX_SAMPLES, fileOf, backupOf, inspect, listSamples, readSample, find,
  createSample, updateSample, removeSample, backup, touch, restore, identifyPath };
