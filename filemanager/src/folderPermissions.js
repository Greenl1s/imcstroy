const db = require("./db");
const { normalize } = require("./folderAccess");

async function listForPath(path) {
  const res = await db.query(
    `SELECT fp.id, fp.path, fp.access, u.id AS user_id, u.username
     FROM fm_folder_permissions fp
     JOIN fm_users u ON u.id = fp.user_id
     WHERE fp.path = $1
     ORDER BY u.username ASC`,
    [normalize(path)]
  );
  return res.rows;
}

async function setPermission(path, userId, access) {
  const res = await db.query(
    `INSERT INTO fm_folder_permissions (path, user_id, access)
     VALUES ($1, $2, $3)
     ON CONFLICT (path, user_id) DO UPDATE SET access = EXCLUDED.access
     RETURNING id, path, access, user_id`,
    [normalize(path), userId, access]
  );
  return res.rows[0];
}

async function removePermission(id) {
  await db.query("DELETE FROM fm_folder_permissions WHERE id = $1", [id]);
}

/** При удалении файла/папки чистим все правила, которые к ней относились. */
async function removeRulesUnderPath(path) {
  const clean = normalize(path);
  await db.query(
    "DELETE FROM fm_folder_permissions WHERE path = $1 OR path LIKE $2",
    [clean, clean + "/%"]
  );
}

/** При переименовании файла/папки переносим все связанные правила на новый путь. */
async function renamePath(oldPath, newPath) {
  const oldClean = normalize(oldPath);
  const newClean = normalize(newPath);

  await db.query("UPDATE fm_folder_permissions SET path = $2 WHERE path = $1", [oldClean, newClean]);

  const res = await db.query("SELECT id, path FROM fm_folder_permissions WHERE path LIKE $1", [oldClean + "/%"]);
  for (const row of res.rows) {
    const suffix = row.path.slice(oldClean.length);
    await db.query("UPDATE fm_folder_permissions SET path = $2 WHERE id = $1", [row.id, newClean + suffix]);
  }
}

module.exports = { listForPath, setPermission, removePermission, removeRulesUnderPath, renamePath };
