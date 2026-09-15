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
         -- Умолчание TRUE, а не FALSE: у человека может не быть строки
         -- прав вовсе, и тогда он должен оставаться в списках журнала —
         -- ровно как было до появления этих галочек.
         COALESCE(p.can_be_manager, true) AS can_be_manager,
         COALESCE(p.can_be_expert, true)  AS can_be_expert
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
  can_manage, can_be_manager = true, can_be_expert = true }) {
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
         (user_id, can_tools, can_db, can_cases, can_manage, can_be_manager, can_be_expert)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [user.id, !!can_tools, !!can_db, !!can_cases, !!can_manage,
       !!can_be_manager, !!can_be_expert]
    );
    await client.query("COMMIT");
    return {
      ...user,
      can_tools: !!can_tools, can_db: !!can_db,
      can_cases: !!can_cases, can_manage: !!can_manage,
      can_be_manager: !!can_be_manager, can_be_expert: !!can_be_expert,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Переименование: переносим имя всюду, где оно записано ТЕКСТОМ.
 *
 * Почти везде человек хранится номером, и переименование его не задевает.
 * Исключение одно — cases.experts: специалисты проекта записаны строкой
 * через запятую, именами. Не перенести имя туда значило бы не просто
 * показать старое: сохранить такую карточку стало бы нельзя вовсе —
 * проверка справочников сказала бы «не значится специалистом» про
 * человека, который в списке есть.
 *
 * Речь именно об ИМЕНИ (full_name), а не о логине: в проектах записано
 * то, что видно на экране. Смена логина этих строк не касается вовсе —
 * логин теперь нигде, кроме входа, и не показывается.
 *
 * История «Учёта оборудования» НЕ трогается: там имя сохранено копией на
 * момент события — запись о том, что было, а не справка о том, как
 * человека зовут сейчас.
 */
async function renameInCases(client, oldName, newName) {
  const { rows } = await client.query(
    `SELECT id, experts FROM cases
      WHERE deleted_at IS NULL AND experts IS NOT NULL AND experts <> ''`
  );
  let touched = 0;
  for (const row of rows) {
    const parts = String(row.experts).split(",").map((x) => x.trim()).filter(Boolean);
    if (!parts.includes(oldName)) continue;
    const next = parts.map((n) => (n === oldName ? newName : n)).join(", ");
    await client.query("UPDATE cases SET experts = $1 WHERE id = $2", [next, row.id]);
    touched++;
  }
  return touched;
}

/**
 * Имя должно быть одно на всю контору.
 *
 * Причина не в аккуратности, а в устройстве данных: специалисты проекта
 * записаны строкой через запятую — ИМЕНАМИ. Два человека с одинаковым
 * именем в этой строке неразличимы, и никто — ни человек, ни система —
 * не скажет, который из них в проекте.
 *
 * Сравниваем без учёта регистра: «Иванов» и «иванов» для человека одно
 * и то же лицо, и разрешить такую пару значило бы сделать вид, что нет.
 */
async function checkNameFree(name, exceptId) {
  const { rows } = await db.query(
    `SELECT ${db.nameSql("u")} AS name FROM users u
      WHERE lower(${db.nameSql("u")}) = lower($1) AND u.id <> $2 LIMIT 1`,
    [name, exceptId || 0]
  );
  if (rows.length) {
    const err = new Error(
      `Имя «${rows[0].name}» уже занято. Имена должны различаться: в проектах ` +
      "специалисты записаны именами, и двух одинаковых там не различить."
    );
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

  // Смену имени делаем отдельно и до всего остального: нужно старое имя,
  // а после UPDATE его уже не спросишь.
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
    if (renamed) {
      // Имя и его следы в проектах меняем одной транзакцией: иначе
      // сбой посередине оставил бы половину проектов ссылаться на
      // человека, которого уже нет под таким именем.
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        await client.query(`UPDATE users SET ${userSets.join(", ")} WHERE id = $${i}`, userValues);
        renamed.cases = await renameInCases(client, renamed.from, renamed.to);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    } else {
      await db.query(`UPDATE users SET ${userSets.join(", ")} WHERE id = $${i}`, userValues);
    }
  }

  const PERM_FIELDS = ["can_tools", "can_db", "can_cases", "can_manage",
    "can_be_manager", "can_be_expert"];
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
