const bcrypt = require("bcryptjs");
const db = require("./db");

async function listUsers() {
  const res = await db.query(
    "SELECT id, username, role, can_tools, can_db, can_cases FROM fm_users ORDER BY id ASC"
  );
  return res.rows;
}

async function getUser(id) {
  const res = await db.query(
    "SELECT id, username, role, can_tools, can_db, can_cases FROM fm_users WHERE id = $1",
    [id]
  );
  return res.rows[0] || null;
}

async function countAdmins() {
  const res = await db.query("SELECT COUNT(*)::int AS c FROM fm_users WHERE role = 'admin'");
  return res.rows[0].c;
}

async function createUser({ username, password, role, can_tools, can_db, can_cases }) {
  const hash = await bcrypt.hash(password, 10);
  const res = await db.query(
    `INSERT INTO fm_users (username, password_hash, role, can_tools, can_db, can_cases)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, username, role, can_tools, can_db, can_cases`,
    [username, hash, role === "admin" ? "admin" : "employee", !!can_tools, !!can_db, !!can_cases]
  );
  return res.rows[0];
}

async function updateUser(id, fields) {
  const sets = [];
  const values = [];
  let i = 1;

  if (fields.password) {
    sets.push(`password_hash = $${i++}`);
    values.push(await bcrypt.hash(fields.password, 10));
  }
  if (fields.role !== undefined) {
    sets.push(`role = $${i++}`);
    values.push(fields.role === "admin" ? "admin" : "employee");
  }
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
  if (sets.length === 0) return;

  values.push(id);
  await db.query(`UPDATE fm_users SET ${sets.join(", ")} WHERE id = $${i}`, values);
}

async function deleteUser(id) {
  await db.query("DELETE FROM fm_users WHERE id = $1", [id]);
}

module.exports = { listUsers, getUser, countAdmins, createUser, updateUser, deleteUser };
