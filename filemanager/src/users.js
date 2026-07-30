const bcrypt = require("bcryptjs");
const db = require("./db");

/**
 * ИСУ и "Учёт оборудования" используют одну и ту же базу данных.
 * Личность (логин/пароль/роль) — общая таблица users (её же ведёт
 * "Учёт оборудования"). Здесь, в ИСУ, своя только таблица прав на
 * разделы — fm_permissions, привязанная к тому же id пользователя.
 */

const SELECT_JOINED = `
  SELECT u.id, u.username, u.role,
         COALESCE(p.can_tools, false) AS can_tools,
         COALESCE(p.can_db, false) AS can_db,
         COALESCE(p.can_cases, false) AS can_cases
  FROM users u
  LEFT JOIN fm_permissions p ON p.user_id = u.id
`;

async function listUsers() {
  const res = await db.query(`${SELECT_JOINED} ORDER BY u.id ASC`);
  return res.rows;
}

async function getUser(id) {
  const res = await db.query(`${SELECT_JOINED} WHERE u.id = $1`, [id]);
  return res.rows[0] || null;
}

async function countAdmins() {
  const res = await db.query("SELECT COUNT(*)::int AS c FROM users WHERE role = 'admin'");
  return res.rows[0].c;
}

async function createUser({ username, password, role, can_tools, can_db, can_cases }) {
  const hash = await bcrypt.hash(password, 12);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO users (username, password_hash, role)
       VALUES ($1, $2, $3)
       RETURNING id, username, role`,
      [username, hash, role === "admin" ? "admin" : "employee"]
    );
    const user = rows[0];
    await client.query(
      `INSERT INTO fm_permissions (user_id, can_tools, can_db, can_cases)
       VALUES ($1, $2, $3, $4)`,
      [user.id, !!can_tools, !!can_db, !!can_cases]
    );
    await client.query("COMMIT");
    return { ...user, can_tools: !!can_tools, can_db: !!can_db, can_cases: !!can_cases };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function updateUser(id, fields) {
  const userSets = [];
  const userValues = [];
  let i = 1;

  if (fields.username !== undefined) {
    userSets.push(`username = $${i++}`);
    userValues.push(fields.username);
  }
  if (fields.password) {
    userSets.push(`password_hash = $${i++}`);
    userValues.push(await bcrypt.hash(fields.password, 12));
  }
  if (fields.role !== undefined) {
    userSets.push(`role = $${i++}`);
    userValues.push(fields.role === "admin" ? "admin" : "employee");
  }
  if (userSets.length) {
    userValues.push(id);
    await db.query(`UPDATE users SET ${userSets.join(", ")} WHERE id = $${i}`, userValues);
  }

  if (fields.can_tools !== undefined || fields.can_db !== undefined || fields.can_cases !== undefined) {
    // На случай, если у пользователя ещё вообще не было своей строки прав ИСУ.
    await db.query(
      `INSERT INTO fm_permissions (user_id, can_tools, can_db, can_cases)
       VALUES ($1, false, false, false)
       ON CONFLICT (user_id) DO NOTHING`,
      [id]
    );
    const permSets = [];
    const permValues = [];
    let j = 1;
    if (fields.can_tools !== undefined) { permSets.push(`can_tools = $${j++}`); permValues.push(!!fields.can_tools); }
    if (fields.can_db !== undefined) { permSets.push(`can_db = $${j++}`); permValues.push(!!fields.can_db); }
    if (fields.can_cases !== undefined) { permSets.push(`can_cases = $${j++}`); permValues.push(!!fields.can_cases); }
    permValues.push(id);
    await db.query(`UPDATE fm_permissions SET ${permSets.join(", ")} WHERE user_id = $${j}`, permValues);
  }
}

async function deleteUser(id) {
  // Освобождаем приборы, которые числились за удаляемым пользователем в
  // "Учёте оборудования" — иначе там сработает ограничение целостности.
  await db.query(
    `UPDATE instruments SET status = 'free', taken_by = NULL, taken_where = NULL,
            taken_extra = NULL, taken_at = NULL
      WHERE taken_by = $1`,
    [id]
  );
  await db.query(
    `UPDATE instruments SET status = 'free', booked_by = NULL, booked_for = NULL,
            booked_extra = NULL, booked_where = NULL
      WHERE booked_by = $1`,
    [id]
  );
  await db.query("DELETE FROM fm_permissions WHERE user_id = $1", [id]);
  await db.query("DELETE FROM fm_folder_permissions WHERE user_id = $1", [id]);
  await db.query("DELETE FROM users WHERE id = $1", [id]);
}

module.exports = { listUsers, getUser, countAdmins, createUser, updateUser, deleteUser };
