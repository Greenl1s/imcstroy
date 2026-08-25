const { Router } = require("express");
const fs = require("fs");
const multer = require("multer");
const db = require("./db");
const files = require("./files");
const caseFolders = require("./caseFolders");
const folderPermissions = require("./folderPermissions");
const folderAccess = require("./folderAccess");
const attachments = require("./caseAttachments");
const fileTextExtract = require("./fileTextExtract");
const aiExtract = require("./aiExtract");
const caseChat = require("./caseChat");
const auth = require("./auth");
const journalExcel = require("./journalExcel");

/**
 * Пересобирает журнал и никогда не мешает основной операции — если
 * вдруг не получится, ошибка просто пишется в лог. Само дело в базе
 * уже сохранено к этому моменту, это лишь его проекция в Excel.
 */
async function refreshJournalSafely() {
  try {
    await journalExcel.regenerateJournal();
  } catch (err) {
    console.error("Не удалось обновить журнал регистрации:", err.message);
  }
}

const planfixSync = require("./planfixSync");

/**
 * Синхронизирует проект с Planfix и, если это создание новой карточки,
 * сохраняет полученный planfix_id обратно в базу. Никогда не мешает
 * основной операции — Planfix может быть временно недоступен, это не
 * должно ломать работу в ИСУ, только предупреждать в логах.
 */
async function syncPlanfixSafely(caseId) {
  try {
    const { rows } = await db.query("SELECT * FROM cases WHERE id = $1", [caseId]);
    if (!rows.length) return;
    const kase = rows[0];
    const planfixId = await planfixSync.syncProjectToPlanfix(kase);
    if (!kase.planfix_id && planfixId) {
      await db.query("UPDATE cases SET planfix_id = $2 WHERE id = $1", [caseId, planfixId]);
    }
  } catch (err) {
    console.error("Не удалось синхронизировать проект с Planfix:", err.message);
  }
}

const UPLOAD_TMP_DIR = "/tmp/fm-uploads";
fs.mkdirSync(UPLOAD_TMP_DIR, { recursive: true });
const upload = multer({ dest: UPLOAD_TMP_DIR });

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
/** Куда внутри новой папки проекта кладём файл в зависимости от того, что определил ИИ. */
function categoryToSubpath(category, projectName) {
  switch (category) {
    case "запрос":
      return "Планирование проекта/Запрос";
    case "организационные_документы":
      return `${projectName}/Организационные документы`;
    case "первичные_материалы":
    case "определение_суда":
    case "иное":
    default:
      return "Планирование проекта/Первичные материалы для ознакомления";
  }
}

/**
 * Принимает один или несколько файлов, сразу же анализирует каждый через
 * ИИ и складывает их во временный черновик (ещё не внутри "Дела" —
 * туда они переедут только после того, как человек подтвердит форму).
 * Возвращает batchId и результат разбора по каждому файлу — если
 * какой-то конкретный файл не удалось разобрать, это не валит весь
 * запрос, просто у него будет поле error вместо analysis.
 */
cases.post("/analyze-files", upload.array("files", 10), async (req, res) => {
  if (!req.files || !req.files.length) {
    return res.status(400).json({ message: "Файлы не получены" });
  }

  const batchId = attachments.newBatchId();
  const results = [];

  for (const file of req.files) {
    const filename = Buffer.from(file.originalname, "latin1").toString("utf8");
    try {
      const buffer = await fs.promises.readFile(file.path);
      const prepared = await fileTextExtract.prepareFileForAnalysis(buffer, filename);
      const analysis = await aiExtract.analyzeDocument(prepared, filename);
      const key = await attachments.stageFile(batchId, filename, file.path);
      results.push({ key, filename, analysis });
    } catch (err) {
      console.error(`Не удалось разобрать файл "${filename}":`, err.message);
      results.push({ key: null, filename, error: err.message });
    } finally {
      await fs.promises.unlink(file.path).catch(() => {});
    }
  }

  res.json({ batchId, results });
});

/** Отменить черновик — удаляет все временные файлы, если создание проекта не подтвердили. */
cases.post("/analyze-files/:batchId/discard", async (req, res) => {
  await attachments.discardBatch(req.params.batchId);
  res.json({ ok: true });
});

cases.post("/", async (req, res) => {
  try {
    const {
      type, name, stage, direct_assignment,
      court_or_customer, case_number, manager_id, experts, year, description,
      organization, party1, party2, judge_name,
      batchId, fileAssignments,
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
         (type, name, stage, status, court_or_customer, case_number, manager_id, experts, year, description,
          organization, party1, party2, judge_name, folder_path)
       VALUES ($1,$2,$3,'waiting',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [type, cleanName, stage, court_or_customer || null, case_number || null,
       manager_id || null, experts || null, year || null, description || null,
       organization || null, party1 || null, party2 || null, judge_name || null, folderPath]
    );
    const created = rows[0];

    await db.query(
      `INSERT INTO case_history (case_id, action, to_stage, actor_id, note)
       VALUES ($1, 'created', $2, $3, 'Проект создан')`,
      [created.id, stage, req.user.id]
    );

    // Раскладываем заранее проанализированные и подтверждённые вложения —
    // делаем это ПОСЛЕ успешной записи в базу: если запись в базу вдруг
    // не удастся, файлы останутся целыми в черновике, а не потеряются
    // где-то на полпути к папке несуществующего проекта.
    if (batchId && Array.isArray(fileAssignments)) {
      for (const item of fileAssignments) {
        try {
          const subPath = categoryToSubpath(item.category, cleanName);
          await attachments.commitStagedFile(batchId, item.key, `${folderPath}/${subPath}`);
        } catch (err) {
          console.error(`Не удалось разместить файл "${item.key}":`, err.message);
        }
      }
      await attachments.discardBatch(batchId);
    }

    res.status(201).json(created);
    refreshJournalSafely();
    syncPlanfixSafely(created.id);
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
  const fields = [
    "court_or_customer", "case_number", "manager_id", "experts", "year", "description", "status",
    "organization", "party1", "party2", "judge_name",
  ];
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
  refreshJournalSafely();
  syncPlanfixSafely(req.params.id);
});

// Строгий порядок движения по стадиям — без пропусков, как в инструкции.
const NEXT_STAGE = { plan: "active", active: "control", control: "done" };
const STAGE_LABEL = { plan: "План", active: "Активный", control: "Контроль", done: "Завершённый" };

/** Перевести проект на следующую стадию — папка переезжает, журнал обновляется. */
cases.post("/:id/advance", loadCase, requireWriteOnCaseFolder, async (req, res) => {
  try {
    const kase = req.case;
    if (kase.is_cancelled) return res.status(409).json({ message: "Проект отменён" });

    // Стадию можно указать явно (выбор из списка на карточке) — если не
    // указана, используем прежнее поведение "на следующую по порядку".
    const targetStage = req.body?.stage || NEXT_STAGE[kase.stage];
    if (!targetStage || !STAGE_LABEL[targetStage]) {
      return res.status(400).json({ message: "Некорректная стадия" });
    }
    if (targetStage === kase.stage) {
      return res.status(409).json({ message: "Проект уже на этой стадии" });
    }

    const newParent = caseFolders.stageRootPath(targetStage);
    const newPath = await files.moveEntry(kase.folder_path, newParent);
    await folderPermissions.renamePath(kase.folder_path, newPath);

    const { rows: updated } = await db.query(
      `UPDATE cases
          SET stage = $2, folder_path = $3, status = 'waiting', updated_at = now(),
              archived_at = CASE WHEN $2 = 'done' THEN now() ELSE archived_at END
        WHERE id = $1 RETURNING *`,
      [kase.id, targetStage, newPath]
    );

    await db.query(
      `INSERT INTO case_history (case_id, action, from_stage, to_stage, actor_id, note)
       VALUES ($1, 'stage_changed', $2, $3, $4, $5)`,
      [kase.id, kase.stage, targetStage, req.user.id, `Переведён на стадию «${STAGE_LABEL[targetStage]}»`]
    );

    res.json(updated[0]);
    refreshJournalSafely();
    syncPlanfixSafely(kase.id);
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
    refreshJournalSafely();
    syncPlanfixSafely(kase.id);
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

/** История переписки с ИИ-ассистентом по этому проекту — от старых к новым. */
cases.get("/:id/chat", loadCase, async (req, res) => {
  const { rows } = await db.query(
    `SELECT id, role, content, created_at FROM case_chat_messages WHERE case_id = $1 ORDER BY created_at ASC`,
    [req.params.id]
  );
  res.json(rows);
});

/**
 * Отправить сообщение ИИ-ассистенту по этому проекту. Право на само
 * общение с ассистентом — то же, что и на запись в проект (write) —
 * ассистент ведь может и менять данные проекта по просьбе.
 */
cases.post("/:id/chat", loadCase, requireWriteOnCaseFolder, async (req, res) => {
  const message = String(req.body?.message || "").trim();
  if (!message) return res.status(400).json({ message: "Пустое сообщение" });

  try {
    const { rows: history } = await db.query(
      `SELECT role, content FROM case_chat_messages WHERE case_id = $1 ORDER BY created_at ASC LIMIT 30`,
      [req.case.id]
    );

    const answer = await caseChat.chatWithProject(req.case, history, message, req.user.id);

    await db.query(
      `INSERT INTO case_chat_messages (case_id, role, content) VALUES ($1, 'user', $2), ($1, 'assistant', $3)`,
      [req.case.id, message, answer]
    );

    res.json({ answer });
    refreshJournalSafely(); // на случай, если ассистент поменял стадию/поля по просьбе
    syncPlanfixSafely(req.case.id);
  } catch (err) {
    console.error("Ошибка чата с ассистентом:", err);
    res.status(500).json({ message: "Не удалось получить ответ: " + err.message });
  }
});

module.exports = { cases };
