const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const files = require("./files");

// Отдельная "черновая" папка внутри DATA_ROOT — не часть "Дела", поэтому
// никогда не показывается в файловом браузере (имя начинается с точки,
// а listDir уже и так пропускает скрытые файлы/папки).
const STAGING_ROOT = ".staging";

function stagingDirFor(batchId) {
  return path.join(files.absolutePathFor("/" + STAGING_ROOT), batchId);
}

function newBatchId() {
  return crypto.randomBytes(12).toString("hex");
}

/** Сохраняет файл во временную папку черновика, возвращает ключ для дальнейшей ссылки на него. */
async function stageFile(batchId, filename, sourcePath) {
  const dir = stagingDirFor(batchId);
  await fs.promises.mkdir(dir, { recursive: true });
  const key = crypto.randomBytes(8).toString("hex") + "-" + filename;
  await fs.promises.copyFile(sourcePath, path.join(dir, key));
  return key;
}

function stagedFilePath(batchId, key) {
  const dir = stagingDirFor(batchId);
  const resolved = path.join(dir, key);
  // Защита от выхода за пределы своей же папки черновика через "../".
  if (!resolved.startsWith(dir + path.sep)) {
    throw new Error("Недопустимый ключ файла");
  }
  return resolved;
}

/** Переносит один заранее проанализированный файл в его финальное место внутри проекта. */
async function commitStagedFile(batchId, key, destDirRelPath) {
  const src = stagedFilePath(batchId, key);
  const destDirAbs = files.absolutePathFor(destDirRelPath);
  await fs.promises.mkdir(destDirAbs, { recursive: true });
  const originalName = key.slice(key.indexOf("-") + 1);
  let destPath = path.join(destDirAbs, originalName);

  // Если файл с таким именем уже есть в проекте — не перетираем, добавляем суффикс.
  let suffix = 1;
  while (fs.existsSync(destPath)) {
    const ext = path.extname(originalName);
    const base = path.basename(originalName, ext);
    destPath = path.join(destDirAbs, `${base} (${++suffix})${ext}`);
  }

  await fs.promises.rename(src, destPath);
  return destPath;
}

/** Удаляет всю папку черновика целиком — вызывается после подтверждения или отмены. */
async function discardBatch(batchId) {
  await fs.promises.rm(stagingDirFor(batchId), { recursive: true, force: true });
}

module.exports = { newBatchId, stageFile, commitStagedFile, discardBatch, stagingDirFor };
