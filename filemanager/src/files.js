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

function absolutePathFor(relPath) {
  return safeResolve(relPath);
}

module.exports = { DATA_ROOT, safeResolve, listDir, ensureDir, removeEntry, absolutePathFor };
