const db = require("./db");

const IDENTITY_API_URL = process.env.IDENTITY_API_URL;

/**
 * Личности пользователей (логин/пароль/роль) теперь целиком живут в
 * "Учёте оборудования" — здесь, в ИСУ, остаются только свои права на
 * разделы (can_tools/can_db/can_cases), привязанные к тому же самому
 * числовому id, что и там.
 */

async function identityFetch(path, options, adminToken) {
  const res = await fetch(`${IDENTITY_API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
      ...(options && options.headers ? options.headers : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Не удалось обратиться к "Учёту оборудования"');
    err.status = res.status;
    throw err;
  }
  return data;
}

async function listPermissionsMap() {
  const res = await db.query("SELECT user_id, can_tools, can_db, can_cases FROM fm_permissions");
  return new Map(res.rows.map((p) => [p.user_id, p]));
}

async function listUsers(adminToken) {
  const identityUsers = await identityFetch("/users", { method: "GET" }, adminToken);
  const permsById = await listPermissionsMap();

  return identityUsers.map((u) => {
    const p = permsById.get(u.id) || { can_tools: false, can_db: false, can_cases: false };
    return {
      id: u.id,
      username: u.username,
      role: u.role,
      can_tools: p.can_tools,
      can_db: p.can_db,
      can_cases: p.can_cases,
    };
  });
}

async function getUser(id, adminToken) {
  const all = await listUsers(adminToken);
  return all.find((u) => String(u.id) === String(id)) || null;
}

async function countAdmins(adminToken) {
  const all = await listUsers(adminToken);
  return all.filter((u) => u.role === "admin").length;
}

async function insertPermissions(userId, { can_tools, can_db, can_cases }) {
  await db.query(
    `INSERT INTO fm_permissions (user_id, can_tools, can_db, can_cases)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE SET
       can_tools = EXCLUDED.can_tools, can_db = EXCLUDED.can_db, can_cases = EXCLUDED.can_cases`,
    [userId, !!can_tools, !!can_db, !!can_cases]
  );
}

async function patchPermissions(userId, fields) {
  const sets = [];
  const values = [userId];
  let i = 2;
  if (fields.can_tools !== undefined) {
    sets.push(`can_tools = $${i++}`);
    values.push(!!fields.can_tools);
  }
  if (fields.can_db !== undefined) {
    sets.push(`can_db = $${i++}`);
    values.push(!!fields.can_db);
  }
  if (fields.can_cases !== undefined) {
    sets.push(`can_cases = $${i++}`);
    values.push(!!fields.can_cases);
  }
  if (!sets.length) return;

  // На случай, если у пользователя ещё вообще не было своей строки прав ИСУ.
  await db.query(
    `INSERT INTO fm_permissions (user_id, can_tools, can_db, can_cases)
     VALUES ($1, false, false, false)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
  await db.query(`UPDATE fm_permissions SET ${sets.join(", ")} WHERE user_id = $1`, values);
}

async function createUser({ username, password, role, can_tools, can_db, can_cases }, adminToken) {
  const identityUser = await identityFetch(
    "/users",
    { method: "POST", body: JSON.stringify({ username, password, role }) },
    adminToken
  );
  await insertPermissions(identityUser.id, { can_tools, can_db, can_cases });
  return {
    id: identityUser.id,
    username: identityUser.username,
    role: identityUser.role,
    can_tools: !!can_tools,
    can_db: !!can_db,
    can_cases: !!can_cases,
  };
}

async function updateUser(id, fields, adminToken) {
  const identityFields = {};
  if (fields.password !== undefined) identityFields.password = fields.password;
  if (fields.role !== undefined) identityFields.role = fields.role;
  if (fields.username !== undefined) identityFields.username = fields.username;

  if (Object.keys(identityFields).length > 0) {
    await identityFetch(`/users/${id}`, { method: "PATCH", body: JSON.stringify(identityFields) }, adminToken);
  }

  if (fields.can_tools !== undefined || fields.can_db !== undefined || fields.can_cases !== undefined) {
    await patchPermissions(id, fields);
  }
}

async function deleteUser(id, adminToken) {
  await identityFetch(`/users/${id}`, { method: "DELETE" }, adminToken);
  await db.query("DELETE FROM fm_permissions WHERE user_id = $1", [id]);
  await db.query("DELETE FROM fm_folder_permissions WHERE user_id = $1", [id]);
}

module.exports = { listUsers, getUser, countAdmins, createUser, updateUser, deleteUser };
