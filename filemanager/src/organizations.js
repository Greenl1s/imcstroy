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

/**
 * Удалить организацию — только администратор, и только если она уже
 * никем не используется (внешний ключ в cases не даст удалить занятую,
 * но проверяем заранее сами, чтобы показать понятную причину).
 */
organizations.delete("/:name", auth.requireAdmin, async (req, res) => {
  const name = decodeURIComponent(req.params.name);

  const { rows: usedBy } = await db.query("SELECT COUNT(*)::int AS c FROM cases WHERE organization = $1", [name]);
  if (usedBy[0].c > 0) {
    return res.status(409).json({
      message: `Эта организация используется в ${usedBy[0].c} проект(ах) — сначала переназначьте их`,
    });
  }

  const { rowCount } = await db.query("DELETE FROM organizations WHERE name = $1", [name]);
  if (!rowCount) return res.status(404).json({ message: "Организация не найдена" });
  res.json({ ok: true });
});

module.exports = { organizations };
