const { Router } = require("express");
const db = require("./db");
const auth = require("./auth");

const organizations = Router();
organizations.use(auth.requireAuth);

function requireCasesAccess(req, res, next) {
  if (req.user.role === "admin" || req.user.can_cases) return next();
  res.status(403).json({ message: "Нет доступа к разделу «Дела»" });
}
organizations.use(requireCasesAccess);

/** Список организаций — виден всем с доступом к «Дела», нужен для выпадающего списка. */
organizations.get("/", async (req, res) => {
  const { rows } = await db.query("SELECT name, position FROM organizations ORDER BY position, name");
  res.json(rows);
});

/** Добавить новую организацию — только администратор. */
organizations.post("/", auth.requireAdmin, async (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ message: "Укажите название" });

  try {
    const { rows: maxPos } = await db.query("SELECT COALESCE(MAX(position), 0) AS max FROM organizations");
    const { rows } = await db.query(
      "INSERT INTO organizations (name, position) VALUES ($1, $2) RETURNING name, position",
      [name, maxPos[0].max + 1]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ message: "Такая организация уже есть в списке" });
    throw err;
  }
});

/** Структуру можно удалить после отвязки текущих и архивных проектов. */
organizations.delete("/:name", auth.requireAdmin, async (req, res) => {
  // Express уже декодировал параметр, повторное декодирование ломает «%».
  const name = req.params.name;
  let client;
  try {
    client = await db.connect();
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT name FROM organizations WHERE name = $1 FOR UPDATE", [name]);
    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Структура не найдена" });
    }
    const { rows: usedBy } = await client.query(
      "SELECT COUNT(*)::int AS c FROM cases WHERE organization = $1 AND deleted_at IS NULL", [name]);
    if (usedBy[0].c > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: `Структура используется в ${usedBy[0].c} проект(ах), включая архив. Выберите в них «не указано» или другую структуру.` });
    }
    // Удалённые проекты не блокируют справочник. Старое название остаётся
    // в истории; при восстановлении проекта его структура будет не указана.
    await client.query(
      `INSERT INTO case_history (case_id, action, actor_id, note)
       SELECT id, 'edited', $2, $3 FROM cases WHERE organization = $1 AND deleted_at IS NOT NULL`,
      [name, req.user.id, `Удалена структура «${name}» из справочника; в удалённом проекте установлено «не указано»`]);
    await client.query(
      `UPDATE cases SET organization = NULL, organization_cleared_locally = true, updated_at = now()
       WHERE organization = $1 AND deleted_at IS NOT NULL`, [name]);
    await client.query("DELETE FROM organizations WHERE name = $1", [name]);
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error("Не удалось удалить структуру:", err.message);
    res.status(err.code === "23503" ? 409 : 500).json({ message: err.code === "23503"
      ? "Структуру назначили проекту. Обновите журнал и сначала переназначьте проект."
      : db.notMigrated(err) || "Не удалось удалить структуру. Попробуйте ещё раз." });
  } finally { client?.release(); }
});

module.exports = { organizations };
