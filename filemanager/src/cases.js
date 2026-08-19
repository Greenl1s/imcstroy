const { Router } = require("express");
const db = require("./db");
const files = require("./files");
const caseFolders = require("./caseFolders");
const folderPermissions = require("./folderPermissions");
const folderAccess = require("./folderAccess");
const auth = require("./auth");

const cases = Router();
cases.use(auth.requireAuth);

// "Проекты" — это часть раздела "Дела", поэтому те же права: либо админ,
// либо личное разрешение can_cases (как и для остального в этом разделе).
function requireCasesAccess(req, res, next) {
  if (req.user.role === "admin" || req.user.can_cases) return next();
  res.status(403).json({ message: "Нет доступа к разделу «Дела»" });
}
cases.use(requireCasesAccess);

/**
 * Для действий, которые меняют папку конкретного проекта (смена стадии,
 * отмена), дополнительно проверяем персональное право "write" именно на
 * эту папку — так же строго, как и для обычных файловых операций в "Дела".
 * Админа эта проверка не касается — у него доступ есть всегда.
 */
async function requireWriteOnCaseFolder(req, res, next) {
  if (req.user.role === "admin") return next();
  try {
    const rules = await folderAccess.getUserRules(req.user.id);
    if (folderAccess.resolveAccess(rules, req.case.folder_path) !== "write") {
      return res.status(403).json({ message: "Нет прав на изменение этого проекта" });
    }
    next();
  } catch (err) {
    console.error("Не удалось проверить права на папку проекта:", err);
    res.status(500).json({ message: "Не удалось проверить права доступа" });
  }
}

/** Достаёт проект по :id и кладёт в req.case — общее для нескольких роутов. */
async function loadCase(req, res, next) {
  const { rows } = await db.query("SELECT * FROM cases WHERE id = $1", [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: "Проект не найден" });
  req.case = rows[0];
  next();
}

/** Наименование должно строго начинаться с "ЭКС." или "НИ." и иметь содержательный остаток. */
function validateName(type, name) {
  const prefix = type === "expertise" ? "ЭКС." : "НИ.";
  const clean = String(name || "").trim();
  if (!clean.startsWith(prefix)) {
    const err = new Error(`Наименование должно начинаться с «${prefix}»`);
    err.status = 400;
    throw err;
  }
  if (!clean.slice(prefix.length).trim()) {
    const err = new Error("После префикса нужно содержательное название");
    err.status = 400;
    throw err;
  }
  return clean;
}

const CASE_LIST_QUERY = `
  SELECT c.*, u.username AS manager_name
  FROM cases c
  LEFT JOIN users u ON u.id = c.manager_id
`;

/** Живой журнал регистрации — список всех проектов. */
cases.get("/", async (req, res) => {
  const { rows } = await db.query(`${CASE_LIST_QUERY} ORDER BY c.created_at DESC`);
  res.json(rows);
});

/**
 * Ищет дело по точному пути его папки — нужен фронтенду, чтобы понять,
 * является ли открытая сейчас в "Дела" папка отслеживаемым проектом
 * (и, если да, показать кнопки смены стадии прямо в файловом браузере,
 * без отдельного экрана "Проекты").
 */
cases.get("/by-path", async (req, res) => {
  const path = String(req.query.path || "");
  if (!path) return res.status(400).json({ message: "Не указан путь" });
  const { rows } = await db.query(`${CASE_LIST_QUERY} WHERE c.folder_path = $1`, [path]);
  if (!rows.length) return res.status(404).json({ message: "Не найдено" });
  res.json(rows[0]);
});

cases.get("/:id", loadCase, async (req, res) => {
  const { rows } = await db.query(`${CASE_LIST_QUERY} WHERE c.id = $1`, [req.params.id]);
  res.json(rows[0]);
});

/** Создать новый проект — сразу с папкой и структурой на диске. */
cases.post("/", async (req, res) => {
  try {
    const {
      type, name, stage, direct_assignment,
      court_or_customer, case_number, manager_id, experts, year, description,
    } = req.body || {};

    if (!["expertise", "research"].includes(type)) {
      return res.status(400).json({ message: "Некорректный тип проекта" });
    }
    if (!["plan", "active"].includes(stage)) {
      return res.status(400).json({ message: "Начальная стадия — только «План» или «Активный»" });
    }
    const cleanName = validateName(type, name);

    const folderPath = await caseFolders.createCaseFolders({
      name: cleanName, stage, directAssignment: !!direct_assignment,
    });

    const { rows } = await db.query(
      `INSERT INTO cases
         (type, name, stage, status, court_or_customer, case_number, manager_id, experts, year, description, folder_path)
       VALUES ($1,$2,$3,'waiting',$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [type, cleanName, stage, court_or_customer || null, case_number || null,
       manager_id || null, experts || null, year || null, description || null, folderPath]
    );
    const created = rows[0];

    await db.query(
      `INSERT INTO case_history (case_id, action, to_stage, actor_id, note)
       VALUES ($1, 'created', $2, $3, 'Проект создан')`,
      [created.id, stage, req.user.id]
    );

    res.status(201).json(created);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Проект с таким наименованием уже существует" });
    }
    console.error("Не удалось создать проект:", err);
    res.status(err.status || 500).json({ message: err.message || "Не удалось создать проект" });
  }
});

/** Обновить редактируемые поля карточки (без смены стадии). */
cases.patch("/:id", loadCase, requireWriteOnCaseFolder, async (req, res) => {
  const fields = ["court_or_customer", "case_number", "manager_id", "experts", "year", "description", "status"];
  const sets = [];
  const values = [req.params.id];
  for (const f of fields) {
    if (req.body?.[f] !== undefined) {
      values.push(req.body[f]);
      sets.push(`${f} = $${values.length}`);
    }
  }
  if (!sets.length) return res.status(400).json({ message: "Нечего обновлять" });

  const { rows } = await db.query(
    `UPDATE cases SET ${sets.join(", ")}, updated_at = now() WHERE id = $1 RETURNING *`,
    values
  );
  res.json(rows[0]);
});

// Строгий порядок движения по стадиям — без пропусков, как в инструкции.
const NEXT_STAGE = { plan: "active", active: "control", control: "done" };
const STAGE_LABEL = { plan: "План", active: "Активный", control: "Контроль", done: "Завершённый" };

/** Перевести проект на следующую стадию — папка переезжает, журнал обновляется. */
cases.post("/:id/advance", loadCase, requireWriteOnCaseFolder, async (req, res) => {
  try {
    const kase = req.case;
    if (kase.is_cancelled) return res.status(409).json({ message: "Проект отменён" });
    const nextStage = NEXT_STAGE[kase.stage];
    if (!nextStage) return res.status(409).json({ message: "Проект уже на последней стадии" });

    const newParent = caseFolders.stageRootPath(nextStage);
    const newPath = await files.moveEntry(kase.folder_path, newParent);
    await folderPermissions.renamePath(kase.folder_path, newPath);

    const { rows: updated } = await db.query(
      `UPDATE cases
          SET stage = $2, folder_path = $3, status = 'waiting', updated_at = now(),
              archived_at = CASE WHEN $2 = 'done' THEN now() ELSE archived_at END
        WHERE id = $1 RETURNING *`,
      [kase.id, nextStage, newPath]
    );

    await db.query(
      `INSERT INTO case_history (case_id, action, from_stage, to_stage, actor_id, note)
       VALUES ($1, 'stage_changed', $2, $3, $4, $5)`,
      [kase.id, kase.stage, nextStage, req.user.id, `Переведён на стадию «${STAGE_LABEL[nextStage]}»`]
    );

    res.json(updated[0]);
  } catch (err) {
    console.error("Не удалось изменить стадию:", err);
    res.status(err.status || 500).json({ message: err.message || "Не удалось изменить стадию" });
  }
});

/** Отменить проект — с любой стадии. Папка переезжает в архив «Отменённые». */
cases.post("/:id/cancel", loadCase, requireWriteOnCaseFolder, async (req, res) => {
  try {
    const kase = req.case;
    if (kase.is_cancelled) return res.status(409).json({ message: "Проект уже отменён" });

    const reason = String(req.body?.reason || "").trim();
    if (!reason) return res.status(400).json({ message: "Укажите причину отмены" });

    const newParent = caseFolders.cancelledRootPath();
    const newPath = await files.moveEntry(kase.folder_path, newParent);
    await folderPermissions.renamePath(kase.folder_path, newPath);

    const { rows: updated } = await db.query(
      `UPDATE cases
          SET is_cancelled = true, cancel_reason = $2, folder_path = $3,
              updated_at = now(), archived_at = now()
        WHERE id = $1 RETURNING *`,
      [kase.id, reason, newPath]
    );

    await db.query(
      `INSERT INTO case_history (case_id, action, from_stage, actor_id, note)
       VALUES ($1, 'cancelled', $2, $3, $4)`,
      [kase.id, kase.stage, req.user.id, reason]
    );

    res.json(updated[0]);
  } catch (err) {
    console.error("Не удалось отменить проект:", err);
    res.status(err.status || 500).json({ message: err.message || "Не удалось отменить проект" });
  }
});

/** История проекта — читаемая версия case_history. */
cases.get("/:id/history", loadCase, async (req, res) => {
  const { rows } = await db.query(
    `SELECT h.*, u.username AS actor_name
       FROM case_history h
       LEFT JOIN users u ON u.id = h.actor_id
      WHERE h.case_id = $1
      ORDER BY h.created_at DESC`,
    [req.params.id]
  );
  res.json(rows);
});

module.exports = { cases };
