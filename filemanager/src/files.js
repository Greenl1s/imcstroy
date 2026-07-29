const fs = require("fs");
const fsp = fs.promises;
const path = require("path");

const DATA_ROOT = process.env.DATA_ROOT || "/data";

// Превращает путь, присланный клиентом (например "/Дела/Отчёт"),
// в безопасный абсолютный путь внутри DATA_ROOT.
// Не даёт выйти за пределы DATA_ROOT через "..".
function safeResolve(relPath) {
  const clean = path.normalize("/" + (relPath || "/")).replace(/^([/\\])+/, "/");
  const abs = path.join(DATA_ROOT, clean);
  if (abs !== DATA_ROOT && !abs.startsWith(DATA_ROOT + path.sep)) {
    throw new Error("Недопустимый путь");
  }
  return abs;
}

async function listDir(relPath) {
  const abs = safeResolve(relPath);
  const entries = await fsp.readdir(abs, { withFileTypes: true });
  const folders = [];
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const entryAbs = path.join(abs, entry.name);
    if (entry.isDirectory()) {
      folders.push({ name: entry.name });
    } else {
      const stat = await fsp.stat(entryAbs);
      files.push({ name: entry.name, size: stat.size, mtime: stat.mtimeMs });
    }
  }
  folders.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  files.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  return { folders, files };
}

async function ensureDir(relPath) {
  const abs = safeResolve(relPath);
  await fsp.mkdir(abs, { recursive: true });
}

async function removeEntry(relPath) {
  const abs = safeResolve(relPath);
  await fsp.rm(abs, { recursive: true, force: true });
}

// Переименовывает файл/папку внутри той же родительской папки.
// Возвращает новый относительный путь.
async function renameEntry(relPath, newName) {
  const cleanName = String(newName || "").trim().replace(/[\\/]/g, "");
  if (!cleanName) {
    throw new Error("Пустое имя недопустимо");
  }
  const oldAbs = safeResolve(relPath);
  const parentAbs = path.dirname(oldAbs);
  const newAbs = path.join(parentAbs, cleanName);

  if (fs.existsSync(newAbs)) {
    throw new Error("Файл или папка с таким именем уже существует");
  }

  await fsp.rename(oldAbs, newAbs);

  const cleanRelPath = "/" + relPath.replace(/^\/+/, "").replace(/\/+$/, "");
  const parentRel = cleanRelPath.slice(0, cleanRelPath.lastIndexOf("/")) || "/";
  return parentRel === "/" ? "/" + cleanName : parentRel + "/" + cleanName;
}

// Рекурсивно ищет файлы и папки по подстроке в имени (без учёта регистра),
// начиная от relPath и ниже по всем вложенным папкам.
// Возвращает плоский список с относительным путём каждого совпадения.
async function searchTree(relPath, query, limit = 300) {
  const rootAbs = safeResolve(relPath);
  const rootRel = "/" + relPath.replace(/^\/+/, "").replace(/\/+$/, "");
  const needle = query.toLowerCase();
  const results = [];

  async function walk(dirAbs, dirRel) {
    if (results.length >= limit) return;
    let entries;
    try {
      entries = await fsp.readdir(dirAbs, { withFileTypes: true });
    } catch (err) {
      return;
    }
    for (const entry of entries) {
      if (results.length >= limit) return;
      if (entry.name.startsWith(".")) continue;
      const entryAbs = path.join(dirAbs, entry.name);
      const entryRel = dirRel === "/" ? "/" + entry.name : dirRel + "/" + entry.name;
      const isDir = entry.isDirectory();
      if (entry.name.toLowerCase().includes(needle)) {
        if (isDir) {
          results.push({ name: entry.name, path: entryRel, isDir: true });
        } else {
          const stat = await fsp.stat(entryAbs);
          results.push({ name: entry.name, path: entryRel, isDir: false, size: stat.size, mtime: stat.mtimeMs });
        }
      }
      if (isDir) {
        await walk(entryAbs, entryRel);
      }
    }
  }

  await walk(rootAbs, rootRel === "/" ? "/" : rootRel);
  return results;
}

function absolutePathFor(relPath) {
  return safeResolve(relPath);
}

// Строит полное дерево папки (вложенные подпапки и файлы), рекурсивно.
// Используется для скачивания "как обычную папку" через File System Access API
// в браузере — там нужно заранее знать всю структуру, чтобы воссоздать её
// на диске пользователя.
async function buildTree(relPath) {
  const abs = safeResolve(relPath);
  const stat = await fsp.stat(abs);

  if (!stat.isDirectory()) {
    return { name: path.basename(abs), isDir: false };
  }

  const entries = await fsp.readdir(abs, { withFileTypes: true });
  const children = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const childRel = relPath.endsWith("/") ? relPath + entry.name : relPath + "/" + entry.name;
    if (entry.isDirectory()) {
      children.push(await buildTree(childRel));
    } else {
      children.push({ name: entry.name, isDir: false });
    }
  }
  return { name: path.basename(abs), isDir: true, children };
}

module.exports = { DATA_ROOT, safeResolve, listDir, ensureDir, removeEntry, renameEntry, searchTree, buildTree, absolutePathFor };
