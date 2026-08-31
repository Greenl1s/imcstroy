/**
 * Связь "пользователь ИСУ ↔ сотрудник Planfix".
 *
 * Токен Planfix у нас один, служебный. Чтобы в Planfix было видно, КТО
 * именно поставил задачу или написал комментарий, к каждому аккаунту ИСУ
 * привязан числовой id сотрудника Planfix, и этот id мы передаём в самих
 * запросах (assigner / owner). Привязку проставляет администратор.
 *
 * Справочник сотрудников держим у себя копией: админская страница должна
 * открываться мгновенно и работать даже когда Planfix недоступен.
 */
const db = require("./db");
const planfixSync = require("./planfixSync");

/** Planfix отдаёт id и как число, и как "user:9" — приводим к числу. */
function toNumericId(value) {
  if (value == null) return null;
  const m = String(value).match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

/**
 * Забирает сотрудников из Planfix в наш справочник.
 *
 * Людей не удаляем, а помечаем неактивными: на старых задачах их имена
 * остаются, и если строку убрать, задача осиротеет.
 */
async function syncPeople() {
  const employees = await planfixSync.listPlanfixEmployees();
  const seen = [];

  for (const person of employees) {
    const id = toNumericId(person.id);
    if (!id) continue;
    const name = String(person.name || "").trim() || `Сотрудник #${id}`;
    seen.push(id);
    await db.query(
      `INSERT INTO planfix_people (id, name, email, is_active, synced_at)
            VALUES ($1, $2, $3, TRUE, now())
       ON CONFLICT (id) DO UPDATE
              SET name = EXCLUDED.name,
                  email = COALESCE(EXCLUDED.email, planfix_people.email),
                  is_active = TRUE,
                  synced_at = now()`,
      [id, name, person.email || null]
    );
  }

  let deactivated = 0;
  if (seen.length) {
    const { rowCount } = await db.query(
      `UPDATE planfix_people SET is_active = FALSE
        WHERE is_active = TRUE AND NOT (id = ANY($1::int[]))`,
      [seen]
    );
    deactivated = rowCount;
  }

  const adopted = await adoptOldNameBindings();
  return { total: seen.length, deactivated, adopted };
}

/**
 * Подхватывает привязки, сделанные до появления id: раньше человек
 * выбирал себя по имени, и это имя лежит в users.planfix_name. Если оно
 * однозначно совпадает ровно с одним сотрудником Planfix — ставим id, и
 * человеку не приходится выбирать себя заново.
 *
 * Однозначно — это важно: при двух одинаковых именах не угадываем, а
 * оставляем решение администратору.
 */
async function adoptOldNameBindings() {
  const { rows } = await db.query(
    `UPDATE users u
        SET planfix_user_id = p.id, planfix_bound_at = now()
       FROM planfix_people p
      WHERE u.planfix_user_id IS NULL
        AND u.planfix_name IS NOT NULL
        AND lower(btrim(u.planfix_name)) = lower(btrim(p.name))
        AND p.is_active
        AND NOT EXISTS (SELECT 1 FROM users o WHERE o.planfix_user_id = p.id)
        AND (SELECT COUNT(*) FROM planfix_people d
              WHERE lower(btrim(d.name)) = lower(btrim(u.planfix_name)) AND d.is_active) = 1
      RETURNING u.id`
  );
  return rows.length;
}

/** Справочник для выпадающих списков. По умолчанию — только работающие. */
async function listPeople({ includeInactive = false } = {}) {
  const { rows } = await db.query(
    `SELECT id, name, email, is_active, synced_at FROM planfix_people
      ${includeInactive ? "" : "WHERE is_active"}
      ORDER BY is_active DESC, name`
  );
  return rows;
}

/** Кто когда синхронизировал справочник — чтобы админ видел свежесть. */
async function peopleSyncedAt() {
  const { rows } = await db.query("SELECT max(synced_at) AS at FROM planfix_people");
  return rows[0]?.at || null;
}

/**
 * Таблица привязок для страницы администрирования: все пользователи ИСУ
 * и то, с кем каждый связан.
 */
async function listBindings() {
  const { rows } = await db.query(
    `SELECT u.id, u.username, u.role,
            u.planfix_user_id, u.planfix_bound_at,
            p.name  AS planfix_name,
            p.email AS planfix_email,
            p.is_active AS planfix_active,
            b.username AS bound_by_name,
            u.planfix_name AS legacy_name
       FROM users u
       LEFT JOIN planfix_people p ON p.id = u.planfix_user_id
       LEFT JOIN users b ON b.id = u.planfix_bound_by
      ORDER BY (u.planfix_user_id IS NOT NULL), lower(u.username)`
  );
  return rows;
}

/**
 * Привязать (или отвязать, если planfixUserId пустой) пользователя ИСУ.
 *
 * Одного сотрудника Planfix нельзя привязать к двум аккаунтам ИСУ: иначе
 * на вопрос "кто это сделал" будет два ответа. Такую попытку отклоняем с
 * понятным текстом, а не ошибкой базы.
 */
async function setBinding(userId, planfixUserId, actorId) {
  const target = toNumericId(planfixUserId);

  if (!target) {
    await db.query(
      `UPDATE users SET planfix_user_id = NULL, planfix_name = NULL,
              planfix_bound_at = NULL, planfix_bound_by = $2
        WHERE id = $1`,
      [userId, actorId]
    );
    return { bound: false };
  }

  const { rows: people } = await db.query(
    "SELECT id, name FROM planfix_people WHERE id = $1", [target]);
  if (!people.length) {
    throw new Error("Такого сотрудника нет в справочнике Planfix. Обновите список сотрудников.");
  }

  const { rows: taken } = await db.query(
    "SELECT username FROM users WHERE planfix_user_id = $1 AND id <> $2", [target, userId]);
  if (taken.length) {
    throw new Error(
      `Сотрудник «${people[0].name}» уже привязан к пользователю «${taken[0].username}». ` +
      "Сначала снимите ту привязку."
    );
  }

  await db.query(
    `UPDATE users SET planfix_user_id = $2, planfix_name = $3,
            planfix_bound_at = now(), planfix_bound_by = $4
      WHERE id = $1`,
    [userId, target, people[0].name, actorId]
  );
  return { bound: true, planfixUserId: target, planfixName: people[0].name };
}

/**
 * Кто этот человек в Planfix — для запросов, которые уходят от его имени.
 * Возвращает null, если привязки нет: вызывающий код решает, отказать
 * или отправить без автора.
 */
function actorOf(user) {
  const id = toNumericId(user?.planfix_user_id);
  if (!id) return null;
  return { id, name: user.planfix_name || user.username };
}

/**
 * Журнал действий, ушедших в Planfix. Пишем и удачи, и отказы: без этого
 * на вопрос "кто завершил задачу" ответа не будет — в Planfix всё уйдёт
 * под служебным токеном.
 *
 * Журнал не должен ронять само действие, поэтому ошибки записи глотаем.
 */
async function logAction({ user, actor, action, taskId, planfixTaskId, caseId, payload, ok, error }) {
  try {
    await db.query(
      `INSERT INTO planfix_actions
         (user_id, planfix_user_id, action, task_id, planfix_task_id, case_id, payload, ok, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        user?.id || null, actor?.id || null, action,
        taskId || null, planfixTaskId || null, caseId || null,
        payload ? JSON.stringify(payload) : null,
        !!ok, error ? String(error).slice(0, 1000) : null,
      ]
    );
  } catch (err) {
    console.error("Не удалось записать действие Planfix в журнал:", err.message);
  }
}

module.exports = {
  syncPeople, adoptOldNameBindings, listPeople, peopleSyncedAt,
  listBindings, setBinding, actorOf, logAction, toNumericId,
};
