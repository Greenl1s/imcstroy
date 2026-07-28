const db = require("./db");

// Система персональных прав действует только внутри "Дела".
const CASES_ROOT = "/Дела";

function normalize(p) {
  const clean = "/" + String(p || "/").replace(/^\/+/, "").replace(/\/+$/, "");
  return clean === "" ? "/" : clean;
}

function isUnderCases(p) {
  const clean = normalize(p);
  return clean === CASES_ROOT || clean.startsWith(CASES_ROOT + "/");
}

async function getUserRules(userId) {
  const res = await db.query(
    "SELECT path, access FROM fm_folder_permissions WHERE user_id = $1",
    [userId]
  );
  const map = new Map();
  for (const row of res.rows) map.set(normalize(row.path), row.access);
  return map;
}

/**
 * Ищет самое конкретное (ближайшее) правило для пути, поднимаясь от него
 * вверх до корня "Дела". Правило на более глубокой вложенной папке всегда
 * побеждает правило на родительской — это и есть "правило поверх".
 * Возвращает 'write' | 'read' | null (доступа нет).
 */
function resolveAccess(rulesMap, path) {
  if (!isUnderCases(path)) return null;
  let candidate = normalize(path);
  while (true) {
    if (rulesMap.has(candidate)) {
      const access = rulesMap.get(candidate);
      return access === "none" ? null : access;
    }
    if (candidate === CASES_ROOT) return null;
    const idx = candidate.lastIndexOf("/");
    candidate = idx <= 0 ? CASES_ROOT : candidate.slice(0, idx);
  }
}

/**
 * Папка сама по себе может быть не разрешена, но внутри нее лежит что-то,
 * к чему доступ всё же есть — тогда её всё равно нужно показать в списке,
 * чтобы пользователь мог до этого добраться (как "Общие папки" в Google Диске).
 */
function isPassThrough(rulesMap, path) {
  const prefix = normalize(path) + "/";
  for (const [rulePath, access] of rulesMap.entries()) {
    if (access === "none") continue;
    if (rulePath.startsWith(prefix)) return true;
  }
  return false;
}

/** Можно ли вообще показать эту папку в списке (не обязательно читать её содержимое напрямую). */
function canList(rulesMap, path) {
  return Boolean(resolveAccess(rulesMap, path)) || isPassThrough(rulesMap, path);
}

module.exports = {
  CASES_ROOT,
  normalize,
  isUnderCases,
  getUserRules,
  resolveAccess,
  isPassThrough,
  canList,
};
