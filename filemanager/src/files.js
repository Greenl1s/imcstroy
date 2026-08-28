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
    // Дату изменения отдаём и для папок — список показывает её в строке
    // так же, как для файлов.
    const stat = await fsp.stat(entryAbs);
    if (entry.isDirectory()) {
      folders.push({ name: entry.name, mtime: stat.mtimeMs });
    } else {
      files.push({ name: entry.name, size: stat.size, mtime: stat.mtimeMs });
    }
  }
  folders.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  files.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  return { folders, files };
}

/** Есть ли такой путь внутри хранилища (без выброса исключения). */
async function pathExists(relPath) {
  try {
    await fsp.stat(safeResolve(relPath));
    return true;
  } catch (err) {
    return false;
  }
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

/**
 * Перемещает файл/папку в ДРУГУЮ родительскую папку (в отличие от
 * renameEntry, которая работает только внутри той же самой). Имя
 * остаётся прежним — меняется только родитель. Нужна для смены стадии
 * проекта: папка физически переезжает из "01. Планы" в "02. Активные
 * проекты" и т.д., со всем содержимым сразу (fs.rename переносит
 * директорию целиком за одну операцию на уровне файловой системы,
 * без обхода и копирования файлов по одному).
 * Возвращает новый относительный путь.
 */
async function moveEntry(relPath, newParentRelPath) {
  const oldAbs = safeResolve(relPath);
  const name = path.basename(oldAbs);
  const newParentAbs = safeResolve(newParentRelPath);
  const newAbs = path.join(newParentAbs, name);

  if (fs.existsSync(newAbs)) {
    throw new Error("Папка или файл с таким именем уже существует в целевой папке");
  }

  // Целевая корневая папка (например "02. Активные проекты") могла ещё
  // не существовать физически — создаём её по пути, если нужно.
  await fsp.mkdir(newParentAbs, { recursive: true });
  await fsp.rename(oldAbs, newAbs);

  const cleanNewParent = "/" + String(newParentRelPath || "/").replace(/^\/+/, "").replace(/\/+$/, "");
  return cleanNewParent === "/" ? "/" + name : cleanNewParent + "/" + name;
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

/**
 * Копирует файл или папку целиком (рекурсивно, со всем содержимым) в
 * другую родительскую папку. Если в целевой папке уже есть что-то с
 * таким же именем — не перезаписывает, а сама подбирает свободное имя
 * (добавляет "(копия)", "(копия 2)" и так далее).
 * Возвращает новый относительный путь.
 */
async function copyEntry(relPath, newParentRelPath) {
  const srcAbs = safeResolve(relPath);
  const name = path.basename(srcAbs);
  const destParentAbs = safeResolve(newParentRelPath);
  await fsp.mkdir(destParentAbs, { recursive: true });

  let destAbs = path.join(destParentAbs, name);
  let suffix = 0;
  while (fs.existsSync(destAbs)) {
    suffix++;
    const ext = path.extname(name);
    const base = path.basename(name, ext);
    const candidateName = suffix === 1 ? `${base} (копия)${ext}` : `${base} (копия ${suffix})${ext}`;
    destAbs = path.join(destParentAbs, candidateName);
  }

  await fsp.cp(srcAbs, destAbs, { recursive: true });

  const cleanNewParent = "/" + String(newParentRelPath || "/").replace(/^\/+/, "").replace(/\/+$/, "");
  const finalName = path.basename(destAbs);
  return cleanNewParent === "/" ? "/" + finalName : cleanNewParent + "/" + finalName;
}


/**
 * Заголовок Content-Disposition для скачиваемого архива.
 *
 * Имя берём по содержимому: одна папка/файл — её название, несколько —
 * общее "files". Кириллицу нельзя писать в filename="" (только ASCII),
 * поэтому даём два варианта: ASCII-запасной для старых браузеров и
 * filename*=UTF-8'' с настоящим русским именем для современных.
 */
function zipContentDisposition(relPaths) {
  const single = Array.isArray(relPaths) && relPaths.length === 1 ? relPaths[0] : null;
  const rawName = single
    ? String(single).split("/").filter(Boolean).pop() || "files"
    : "files";

  // Убираем то, что не годится для имени файла в Windows и macOS.
  const clean = rawName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 120);
  const fileName = clean + ".zip";

  const asciiFallback = clean.replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "").trim();
  const ascii = (/[A-Za-z0-9]/.test(asciiFallback) ? asciiFallback : "archive") + ".zip";

  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

module.exports = {
  DATA_ROOT, zipContentDisposition, safeResolve, listDir, pathExists, ensureDir, removeEntry, renameEntry, moveEntry, copyEntry,
  searchTree, buildTree, absolutePathFor,
};
