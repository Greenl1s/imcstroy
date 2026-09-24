const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DIR = "/.Черновики документов";
const META = "черновик.json";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const dirOf = (id) => `${DIR}/${id}`;
const metaPath = (id) => `${dirOf(id)}/${META}`;
const filePath = (meta) => `${dirOf(meta.id)}/${meta.fileName}`;

function cleanId(raw) {
  const id = String(raw || "");
  if (!/^[a-f0-9]{16}$/.test(id)) { const e = new Error("Черновик не найден"); e.status = 404; throw e; }
  return id;
}

async function create(safeResolve, { userId, buffer, meta }) {
  await sweep(safeResolve);
  const id = crypto.randomBytes(8).toString("hex");
  await fs.promises.mkdir(safeResolve(dirOf(id)), { recursive: true });
  const stored = { id, userId, createdAt: new Date().toISOString(), ...meta };
  await fs.promises.writeFile(safeResolve(filePath(stored)), buffer);
  await fs.promises.writeFile(safeResolve(metaPath(id)), JSON.stringify(stored, null, 2), "utf8");
  return stored;
}

async function read(safeResolve, rawId, userId) {
  const id = cleanId(rawId);
  let stored;
  try { stored = JSON.parse(await fs.promises.readFile(safeResolve(metaPath(id)), "utf8")); }
  catch { const e = new Error("Черновик не найден или уже сохранён"); e.status = 404; throw e; }
  if (String(stored.userId) !== String(userId)) { const e = new Error("Это черновик другого сотрудника"); e.status = 403; throw e; }
  return stored;
}

async function remove(safeResolve, rawId) {
  await fs.promises.rm(safeResolve(dirOf(cleanId(rawId))), { recursive: true, force: true });
}

async function sweep(safeResolve) {
  let entries = [];
  try { entries = await fs.promises.readdir(safeResolve(DIR), { withFileTypes: true }); } catch { return; }
  const now = Date.now();
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const stat = await fs.promises.stat(safeResolve(dirOf(entry.name)));
      if (now - stat.mtimeMs > MAX_AGE_MS) await fs.promises.rm(safeResolve(dirOf(entry.name)), { recursive: true, force: true });
    } catch { /* уборка не должна мешать созданию */ }
  }
}

module.exports = { DIR, create, read, remove, filePath, cleanId };
