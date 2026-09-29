const bcrypt = require("bcryptjs");
const db = require("./db");

/**
 * ИСУ и "Учёт оборудования" используют одну и ту же базу данных.
 * Личность (логин/пароль/роль) — общая таблица users (её же ведёт
 * "Учёт оборудования"). Здесь, в ИСУ, своя только таблица прав на
 * разделы — fm_permissions, привязанная к тому же id пользователя.
 */

const SELECT_JOINED = `
  SELECT u.id, u.username, u.full_name, ${db.nameSql("u")} AS name, u.role,
         COALESCE(p.can_tools, false) AS can_tools,
         COALESCE(p.can_db, false) AS can_db,
         COALESCE(p.can_cases, false) AS can_cases,
         COALESCE(p.can_manage, false) AS can_manage,
         -- Пользователь может быть руководителем проекта. Эксперты сюда
         -- не входят: их справочник живёт в папке «База данных/Эксперты».
         COALESCE(p.can_be_manager, true) AS can_be_manager
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

async function createUser({ username, password, full_name, role, can_tools, can_db, can_cases,
  can_manage, can_be_manager = true }) {
  const hash = await bcrypt.hash(password, 12);
  // Имя не задали — берём логин. Человек без имени выглядел бы на экране
  // пустым местом, а это хуже, чем служебное слово вместо имени.
  const name = String(full_name || "").trim() || String(username || "").trim();
  await checkNameFree(name, null);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO users (username, full_name, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, full_name, full_name AS name, role`,
      [username, name, hash, role === "admin" ? "admin" : "employee"]
    );
    const user = rows[0];
    await client.query(
      `INSERT INTO fm_permissions
         (user_id, can_tools, can_db, can_cases, can_manage, can_be_manager)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [user.id, !!can_tools, !!can_db, !!can_cases, !!can_manage,
       !!can_be_manager]
    );
    await client.query("COMMIT");
    return {
      ...user,
      can_tools: !!can_tools, can_db: !!can_db,
      can_cases: !!can_cases, can_manage: !!can_manage,
      can_be_manager: !!can_be_manager,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Имена пользователей не должны повторяться между учётными записями.
 * Совпадение с именем эксперта допустимо: это два независимых справочника.
 */
async function checkNameFree(name, exceptId) {
  const { rows } = await db.query(
    `SELECT ${db.nameSql("u")} AS name FROM users u
      WHERE lower(${db.nameSql("u")}) = lower($1) AND u.id <> $2 LIMIT 1`,
    [name, exceptId || 0]
  );
  if (rows.length) {
    const err = new Error(`Имя пользователя «${rows[0].name}» уже занято другой учётной записью.`);
    err.status = 400;
    throw err;
  }
}

async function updateUser(id, fields) {
  const userSets = [];
  const userValues = [];
  let i = 1;

  if (fields.username !== undefined) {
    const clean = String(fields.username).trim();
    if (!clean) {
      const err = new Error("Логин не может быть пустым");
      err.status = 400;
      throw err;
    }
    if (/\s/.test(clean)) {
      const err = new Error("В логине не должно быть пробелов — его набирают при входе");
      err.status = 400;
      throw err;
    }
    fields = { ...fields, username: clean };
  }

  let renamed = null;
  if (fields.full_name !== undefined) {
    const clean = String(fields.full_name).trim();
    if (!clean) {
      const err = new Error("Имя не может быть пустым");
      err.status = 400;
      throw err;
    }
    await checkNameFree(clean, id);
    const { rows: before } = await db.query(
      `SELECT ${db.nameSql("u")} AS name FROM users u WHERE u.id = $1`, [id]
    );
    if (before.length && before[0].name !== clean) {
      renamed = { from: before[0].name, to: clean };
    }
    fields = { ...fields, full_name: clean };
  }

  if (fields.username !== undefined) {
    userSets.push(`username = $${i++}`);
    userValues.push(fields.username);
  }
  if (fields.full_name !== undefined) {
    userSets.push(`full_name = $${i++}`);
    userValues.push(fields.full_name);
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

  const PERM_FIELDS = ["can_tools", "can_db", "can_cases", "can_manage", "can_be_manager"];
  if (PERM_FIELDS.some((f) => fields[f] !== undefined)) {
    // На случай, если у пользователя ещё вообще не было своей строки прав ИСУ.
    await db.query(
      `INSERT INTO fm_permissions (user_id, can_tools, can_db, can_cases, can_manage)
       VALUES ($1, false, false, false, false)
       ON CONFLICT (user_id) DO NOTHING`,
      [id]
    );
    const permSets = [];
    const permValues = [];
    let j = 1;
    for (const f of PERM_FIELDS) {
      if (fields[f] === undefined) continue;
      permSets.push(`${f} = $${j++}`);
      permValues.push(!!fields[f]);
    }
    permValues.push(id);
    await db.query(`UPDATE fm_permissions SET ${permSets.join(", ")} WHERE user_id = $${j}`, permValues);
  }

  return { renamed };
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
