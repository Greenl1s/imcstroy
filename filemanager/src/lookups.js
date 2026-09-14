/* ============================================================
 *  Справочники журнала регистрации.
 *
 *  Списки значений, из которых выбирают в журнале и в карточке
 *  проекта: тип экспертизы и год. Ведёт их администратор; вписать
 *  что-то мимо списка нельзя ни в журнале, ни через запрос.
 *
 *  «Структура» живёт отдельно, в таблице organizations: на неё
 *  ссылаются проекты, и переносить её сюда ради единообразия значило
 *  бы ломать связь. Снаружи разницы не видно — оба списка отдаются
 *  одним ответом.
 * ============================================================ */

const db = require("./db");

/** Какие списки вообще бывают. Чужой вид — ошибка, а не пустой список. */
const KINDS = ["expertise_type", "year"];

function checkKind(kind) {
  if (!KINDS.includes(kind)) {
    const err = new Error(`Неизвестный справочник: ${kind}`);
    err.status = 400;
    throw err;
  }
  return kind;
}

/** Один список. Годы сортируем числом и сверху вниз — свежие первыми. */
async function list(kind) {
  checkKind(kind);
  const order = kind === "year"
    ? "ORDER BY value DESC"
    : "ORDER BY position ASC, value ASC";
  const { rows } = await db.query(
    `SELECT value, position FROM fm_lookups WHERE kind = $1 ${order}`, [kind]
  );
  return rows.map((r) => r.value);
}

/** Все списки разом — так их и читает экран, одним запросом. */
async function all() {
  const [expertiseTypes, years, organizations] = await Promise.all([
    list("expertise_type"),
    list("year"),
    db.query("SELECT name FROM organizations ORDER BY position ASC, name ASC")
      .then((r) => r.rows.map((x) => x.name)),
  ]);
  return { expertise_types: expertiseTypes, years, organizations };
}

async function add(kind, rawValue, userId) {
  checkKind(kind);
  const value = String(rawValue || "").trim();
  if (!value) {
    const err = new Error("Пустое значение в справочник не добавить");
    err.status = 400;
    throw err;
  }
  if (kind === "year" && !/^\d{4}$/.test(value)) {
    const err = new Error(`«${value}» — это не год. Нужны четыре цифры.`);
    err.status = 400;
    throw err;
  }
  await db.query(
    `INSERT INTO fm_lookups (kind, value, created_by) VALUES ($1, $2, $3)
     ON CONFLICT (kind, value) DO NOTHING`,
    [kind, value, userId || null]
  );
  return value;
}

/**
 * Убрать значение из списка.
 *
 * Если оно уже стоит в проектах — отказываем и говорим, в скольких.
 * Молча убрать значило бы оставить в журнале строки со значением,
 * которого «не существует», и починить их было бы уже нечем.
 */
async function remove(kind, rawValue) {
  checkKind(kind);
  const value = String(rawValue || "").trim();
  const column = kind === "year" ? "year::text" : "expertise_type";
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS used FROM cases
      WHERE deleted_at IS NULL AND btrim(${column}) = $1`, [value]
  );
  if (rows[0].used > 0) {
    const err = new Error(
      `«${value}» стоит в ${rows[0].used} ${plural(rows[0].used, "проекте", "проектах", "проектах")}. ` +
      "Сначала поменяйте там, потом убирайте из списка."
    );
    err.status = 409;
    throw err;
  }
  await db.query("DELETE FROM fm_lookups WHERE kind = $1 AND value = $2", [kind, value]);
}

function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/**
 * Значение пришло из Planfix — доводим справочник до него.
 *
 * Planfix нам не подчиняется: там заводят проекты со своими типами
 * экспертиз, и отказывать импорту значило бы терять проекты. Поэтому
 * неизвестное значение не отвергаем, а дописываем в список — тогда оно
 * и в журнале выбирается, и администратор видит, что оно появилось.
 */
async function ensure(kind, rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) return null;
  if (kind === "year" && !/^\d{4}$/.test(value)) return value;
  await db.query(
    `INSERT INTO fm_lookups (kind, value) VALUES ($1, $2)
     ON CONFLICT (kind, value) DO NOTHING`,
    [kind, value]
  );
  return value;
}

/** Есть ли такое значение в списке. Пустое — всегда можно (значит «не указано»). */
async function has(kind, rawValue) {
  const value = String(rawValue ?? "").trim();
  if (!value) return true;
  const { rows } = await db.query(
    "SELECT 1 FROM fm_lookups WHERE kind = $1 AND value = $2", [kind, value]
  );
  return rows.length > 0;
}

/**
 * Кто может стоять руководителем и кто — специалистом.
 *
 * Списки разные: руководителей обычно единицы, специалистов больше.
 * Отдаём с именами, чтобы экран не ходил за ними отдельно.
 */
async function people() {
  const { rows } = await db.query(
    `SELECT u.id, u.username,
            COALESCE(p.can_be_manager, true) AS can_be_manager,
            COALESCE(p.can_be_expert, true)  AS can_be_expert
       FROM users u
       LEFT JOIN fm_permissions p ON p.user_id = u.id
      ORDER BY u.username ASC`
  );
  return {
    managers: rows.filter((r) => r.can_be_manager).map((r) => ({ id: r.id, username: r.username })),
    experts: rows.filter((r) => r.can_be_expert).map((r) => ({ id: r.id, username: r.username })),
  };
}

module.exports = { KINDS, list, all, add, remove, ensure, has, people };
