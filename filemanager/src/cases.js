const { Router } = require("express");
const fs = require("fs");
const multer = require("multer");
const db = require("./db");
const files = require("./files");
const caseFolders = require("./caseFolders");
const folderPermissions = require("./folderPermissions");
const folderAccess = require("./folderAccess");
const events = require("./events");
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
const planfixPeople = require("./planfixPeople");

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
  const { rows } = await db.query(
    "SELECT * FROM cases WHERE id = $1 AND deleted_at IS NULL", [req.params.id]);
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

// Удалённые проекты (папку убрали в корзину) в списках не показываем:
// запись остаётся в базе ради истории, но выбирать её больше нельзя.
const CASE_LIST_QUERY = `
  SELECT c.*, u.username AS manager_name
  FROM cases c
  LEFT JOIN users u ON u.id = c.manager_id
  WHERE c.deleted_at IS NULL
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
  const { rows } = await db.query(`${CASE_LIST_QUERY} AND c.folder_path = $1`, [path]);
  if (!rows.length) return res.status(404).json({ message: "Не найдено" });
  res.json(rows[0]);
});

// Типовые задачи по стадиям — Приложение 1 рабочей инструкции.
// Живут прямо в коде: это фиксированный по инструкции список, редко
// меняется, а держать отдельную таблицу под него было бы избыточно.
const PLANFIX_STAGES_WITH_TASKS = ["plan", "active", "control"];

/** Список типовых задач для стадии — теперь из общего справочника, а не зашит в код. */
cases.get("/planfix/stage-tasks/:stage", async (req, res) => {
  if (!PLANFIX_STAGES_WITH_TASKS.includes(req.params.stage)) {
    return res.json({ tasks: [] });
  }
  const { rows } = await db.query(
    "SELECT id, name FROM planfix_task_templates WHERE stage = $1 ORDER BY position, id",
    [req.params.stage]
  );
  res.json({ tasks: rows });
});

/**
 * Добавить новую задачу в общий справочник для стадии — доступно всем
 * с правом на "Дела" (не только админу): это рабочий, а не настроечный
 * список, добавлять туда должен уметь любой делопроизводитель.
 */
cases.post("/planfix/stage-tasks", async (req, res) => {
  const stage = req.body?.stage;
  const name = String(req.body?.name || "").trim();
  if (!PLANFIX_STAGES_WITH_TASKS.includes(stage)) {
    return res.status(400).json({ message: "Некорректная стадия" });
  }
  if (!name) return res.status(400).json({ message: "Укажите название задачи" });

  try {
    const { rows: maxPos } = await db.query(
      "SELECT COALESCE(MAX(position), 0) AS max FROM planfix_task_templates WHERE stage = $1",
      [stage]
    );
    const { rows } = await db.query(
      "INSERT INTO planfix_task_templates (stage, name, position) VALUES ($1, $2, $3) RETURNING id, name",
      [stage, name, maxPos[0].max + 1]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ message: "Такая задача уже есть в списке для этой стадии" });
    throw err;
  }
});

/** Удалить задачу из справочника — тоже доступно всем с правом на "Дела". */
cases.delete("/planfix/stage-tasks/:id", auth.requireAdmin, async (req, res) => {
  const { rowCount } = await db.query("DELETE FROM planfix_task_templates WHERE id = $1", [req.params.id]);
  if (!rowCount) return res.status(404).json({ message: "Задача не найдена" });
  res.json({ ok: true });
});

/* ---------------- Перенос из Planfix ---------------- */

const planfixImport = require("./planfixImport");

/** Когда сверялись в последний раз и чем она кончилась. */
cases.get("/planfix/sync-status", async (req, res) => {
  const { rows } = await db.query(
    "SELECT id, started_at, finished_at, trigger, ok, report, error FROM planfix_sync_runs ORDER BY id DESC LIMIT 1"
  );
  res.json({ last: rows[0] || null });
});

/**
 * Запустить сверку вручную. Только администратор: операция читает весь
 * аккаунт Planfix и заводит проекты с папками.
 */
cases.post("/planfix/sync", auth.requireAdmin, async (req, res) => {
  try {
    const report = await planfixImport.runSync({ trigger: "manual" });
    res.json({ ok: true, report });
  } catch (err) {
    console.error("Сверка с Planfix не удалась:", err);
    res.status(500).json({ message: err.message, report: err.report || null });
  }
});

/**
 * Диагностика связи с Planfix: какие есть группы проектов, какие
 * пользовательские поля с их id и как называются статусы задач. Нужна,
 * чтобы настроить сопоставление, не залезая в консоль сервера.
 */
cases.get("/planfix/probe", auth.requireAdmin, async (req, res) => {
  try {
    res.json(await planfixSync.probe());
  } catch (err) {
    res.status(500).json({ message: "Не удалось опросить Planfix: " + err.message });
  }
});

/* ---------------- Связь аккаунтов ИСУ с сотрудниками Planfix ---------------- */

/**
 * Справочник сотрудников Planfix. Отдаём из своей копии — страница
 * должна открываться мгновенно и работать, даже когда Planfix молчит.
 * Нужен всем, у кого есть доступ к делам: из него выбирают исполнителей.
 */
cases.get("/planfix/people", async (req, res) => {
  try {
    res.json({
      people: await planfixPeople.listPeople(),
      syncedAt: await planfixPeople.peopleSyncedAt(),
    });
  } catch (err) {
    res.status(500).json({ message: "Не удалось получить справочник сотрудников: " + err.message });
  }
});

/** Обновить справочник сотрудников из Planfix. */
cases.post("/planfix/people/sync", auth.requireAdmin, async (req, res) => {
  try {
    const result = await planfixPeople.syncPeople();
    res.json({
      ok: true, ...result,
      people: await planfixPeople.listPeople(),
      syncedAt: await planfixPeople.peopleSyncedAt(),
    });
  } catch (err) {
    res.status(502).json({ message: "Planfix не отдал список сотрудников: " + err.message });
  }
});

/** Таблица привязок: кто из пользователей ИСУ кем является в Planfix. */
cases.get("/planfix/bindings", auth.requireAdmin, async (req, res) => {
  try {
    res.json({
      bindings: await planfixPeople.listBindings(),
      people: await planfixPeople.listPeople(),
      syncedAt: await planfixPeople.peopleSyncedAt(),
    });
  } catch (err) {
    res.status(500).json({ message: "Не удалось получить список привязок: " + err.message });
  }
});

/** Привязать пользователя ИСУ к сотруднику Planfix (или снять привязку). */
cases.post("/planfix/bindings/:userId", auth.requireAdmin, async (req, res) => {
  try {
    const result = await planfixPeople.setBinding(
      Number(req.params.userId), req.body?.planfixUserId, req.user.id);
    await planfixPeople.logAction({
      user: req.user, actor: null, action: result.bound ? "bind" : "unbind",
      payload: { userId: Number(req.params.userId), planfixUserId: result.planfixUserId || null }, ok: true,
    });
    res.json({ ok: true, ...result, bindings: await planfixPeople.listBindings() });
  } catch (err) {
    // Занятый сотрудник и неизвестный id — это ошибка ввода, а не сбой:
    // отвечаем 400 с текстом, который можно показать как есть.
    res.status(400).json({ message: err.message });
  }
});

/* ---------------- Задачи всех проектов (отдельная страница) ---------------- */

const folderAccessLib = require("./folderAccess");

/**
 * Сотрудник видит задачи только тех проектов, к папкам которых у него
 * есть доступ. Админ видит всё.
 */
async function visibleTasks(rows, user) {
  if (user.role === "admin") return rows;
  if (!user.can_cases) return [];
  const rules = await folderAccessLib.getUserRules(user.id);
  return rows.filter((r) => folderAccessLib.resolveAccess(rules, r.folder_path));
}

const TASKS_QUERY = `
  SELECT t.id, t.planfix_id, t.name, t.description, t.status_name, t.status_id, t.is_done,
         t.assignees, t.assigner, t.assignee_ids, t.assigner_id,
         t.start_date, t.end_date, t.completed_at,
         cb.username AS completed_by_name,
         c.id AS case_id, c.name AS case_name, c.type AS case_type,
         c.stage AS case_stage, c.folder_path, c.planfix_id AS case_planfix_id
    FROM case_tasks t
    JOIN cases c ON c.id = t.case_id
    LEFT JOIN users cb ON cb.id = t.completed_by
   WHERE c.deleted_at IS NULL
`;

/** Я исполнитель этой задачи? Сравниваем по id, а не по имени. */
function isAssignee(task, planfixUserId) {
  if (!planfixUserId) return false;
  return Array.isArray(task.assignee_ids) && task.assignee_ids.includes(Number(planfixUserId));
}

/** Я поставил эту задачу? */
function isAssigner(task, planfixUserId) {
  if (!planfixUserId) return false;
  return Number(task.assigner_id) === Number(planfixUserId);
}

/**
 * Все задачи разом — для отдельной страницы "Задачи".
 *
 * scope: all | mine (я исполнитель) | assigned (я поставил).
 * done=1/0/all — по завершённости (по умолчанию показываем незавершённые).
 *
 * "Мои" опираются на привязку аккаунта ИСУ к сотруднику Planfix
 * (users.planfix_user_id, её проставляет администратор). Без привязки
 * сказать, какие задачи мои, нельзя — тогда честно отвечаем пустым
 * списком и говорим об этом в поле needsBinding, а не молча.
 */
cases.get("/tasks/all", async (req, res) => {
  try {
    const { rows } = await db.query(`${TASKS_QUERY} ORDER BY t.is_done, t.end_date NULLS LAST, t.planfix_id DESC`);
    const all = await visibleTasks(rows, req.user);
    let list = all;

    const me = req.user.planfix_user_id || null;
    // scope=mine раньше назывался mine=1 — старый адрес продолжает работать.
    const scope = String(req.query.scope || (req.query.mine === "1" ? "mine" : "all"));
    if (scope === "mine") list = list.filter((t) => isAssignee(t, me));
    else if (scope === "assigned") list = list.filter((t) => isAssigner(t, me));

    if (req.query.done === "1") list = list.filter((t) => t.is_done);
    else if (req.query.done !== "all") list = list.filter((t) => !t.is_done);

    const q = String(req.query.q || "").trim().toLowerCase();
    if (q) {
      list = list.filter((t) =>
        t.name.toLowerCase().includes(q) || String(t.case_name || "").toLowerCase().includes(q));
    }

    // Счётчики считаем по всему, что человеку видно, а не по текущему
    // фильтру — иначе цифра прыгает вслед за фильтром и ничего не значит.
    const overdue = (t) => !t.is_done && t.end_date && new Date(t.end_date) < new Date();
    res.json({
      tasks: list.map((t) => ({ ...t, mine: isAssignee(t, me), byMe: isAssigner(t, me) })).slice(0, 500),
      total: list.length,
      me: me ? { planfixUserId: me, name: req.user.planfix_name } : null,
      // Без привязки фильтр "Мои" работать не может — интерфейс покажет
      // подсказку вместо пустого списка без объяснений.
      needsBinding: !me,
      counts: {
        open: all.filter((t) => !t.is_done).length,
        done: all.filter((t) => t.is_done).length,
        overdue: all.filter(overdue).length,
        mine: me ? all.filter((t) => !t.is_done && isAssignee(t, me)).length : 0,
        assigned: me ? all.filter((t) => !t.is_done && isAssigner(t, me)).length : 0,
      },
    });
  } catch (err) {
    console.error("Не удалось получить список задач:", err);
    res.status(500).json({ message: "Не удалось получить список задач: " + err.message });
  }
});

/**
 * Каким статусом Planfix помечает завершение. Берём из окружения, а если
 * там пусто — вычисляем по уже перенесённым задачам: у завершённых виден
 * их статус, самый частый и есть нужный.
 */
async function doneStatusId() {
  const fromEnv = Number(process.env.PLANFIX_DONE_STATUS_ID || 0);
  if (fromEnv) return fromEnv;
  const { rows } = await db.query(
    `SELECT status_id, COUNT(*)::int AS c FROM case_tasks
      WHERE is_done = true AND status_id IS NOT NULL
      GROUP BY status_id ORDER BY c DESC LIMIT 1`
  );
  return rows.length ? Number(rows[0].status_id) : null;
}

/**
 * Завершить задачу. Сначала Planfix, потом у себя: если он не согласился,
 * у нас ничего не меняется и человек видит причину, а не молчаливое
 * расхождение двух систем.
 */
cases.post("/tasks/:id/complete", async (req, res) => {
  try {
    const { rows } = await db.query(`${TASKS_QUERY} AND t.id = $1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Задача не найдена" });
    const [task] = await visibleTasks(rows, req.user);
    if (!task) return res.status(403).json({ message: "Нет доступа к этой задаче" });
    if (task.is_done) return res.json({ ok: true, alreadyDone: true });

    const statusId = await doneStatusId();
    const actor = planfixPeople.actorOf(req.user);
    try {
      await planfixSync.completeTask(task.planfix_id, statusId);
    } catch (err) {
      await planfixPeople.logAction({
        user: req.user, actor, action: "complete", taskId: task.id,
        planfixTaskId: task.planfix_id, caseId: task.case_id, ok: false, error: err.message,
      });
      throw err;
    }
    await planfixPeople.logAction({
      user: req.user, actor, action: "complete", taskId: task.id,
      planfixTaskId: task.planfix_id, caseId: task.case_id,
      payload: { statusId }, ok: true,
    });

    await db.query(
      `UPDATE case_tasks
          SET is_done = true, status_id = $2, completed_at = now(), completed_by = $3, updated_at = now()
        WHERE id = $1`,
      [task.id, statusId, req.user.id]
    );
    events.log(req.user, "task_done", {
      path: task.folder_path,
      name: task.name,
      details: { case: task.case_name },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("Не удалось завершить задачу:", err);
    res.status(502).json({ message: "Planfix не принял завершение задачи: " + err.message });
  }
});

/**
 * Одна задача, доступная текущему пользователю. Общий кусок для карточки,
 * правки и комментариев: права на задачу — это права на папку её проекта.
 */
async function loadVisibleTask(req, res) {
  const { rows } = await db.query(`${TASKS_QUERY} AND t.id = $1`, [req.params.id]);
  if (!rows.length) {
    res.status(404).json({ message: "Задача не найдена" });
    return null;
  }
  const [task] = await visibleTasks(rows, req.user);
  if (!task) {
    res.status(403).json({ message: "Нет доступа к этой задаче" });
    return null;
  }
  return task;
}

/** Кто может менять задачу — тот же, кто может писать в папку проекта. */
async function canWriteTask(user, task) {
  if (user.role === "admin") return true;
  if (!user.can_cases) return false;
  const rules = await folderAccess.getUserRules(user.id);
  return folderAccess.resolveAccess(rules, task.folder_path) === "write";
}

/**
 * Карточка задачи: то, что лежит у нас, плюс комментарии прямо из
 * Planfix. Комментарии не кэшируем — они меняются чаще, чем идёт
 * синхронизация, и показать вчерашние хуже, чем не показать никаких.
 * Если Planfix недоступен, карточка всё равно открывается.
 */
cases.get("/tasks/:id", async (req, res) => {
  try {
    const task = await loadVisibleTask(req, res);
    if (!task) return;
    let comments = [];
    let commentsError = null;
    try {
      comments = await planfixSync.listTaskComments(task.planfix_id);
    } catch (err) {
      commentsError = err.message;
    }
    res.json({
      task: {
        ...task,
        mine: isAssignee(task, req.user.planfix_user_id),
        byMe: isAssigner(task, req.user.planfix_user_id),
      },
      comments,
      commentsError,
      canWrite: await canWriteTask(req.user, task),
    });
  } catch (err) {
    console.error("Не удалось открыть задачу:", err);
    res.status(500).json({ message: "Не удалось открыть задачу: " + err.message });
  }
});

/**
 * Новая задача в Planfix из ИСУ. Постановщиком становится тот, кто
 * нажал кнопку — по привязке его аккаунта.
 *
 * Задачу заводим только в Planfix: он — источник правды. У себя она
 * появится ближайшей синхронизацией, поэтому её же сразу и запускаем
 * для этого проекта, чтобы человек увидел результат, а не пустоту.
 */
cases.post("/tasks", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const caseId = Number(req.body?.caseId || 0);
  if (!name) return res.status(400).json({ message: "Не указано название задачи" });
  if (!caseId) return res.status(400).json({ message: "Не выбран проект" });

  try {
    const { rows } = await db.query(
      "SELECT id, name, planfix_id, folder_path FROM cases WHERE id = $1 AND deleted_at IS NULL", [caseId]);
    const kase = rows[0];
    if (!kase) return res.status(404).json({ message: "Проект не найден" });
    if (!(await canWriteTask(req.user, kase))) {
      return res.status(403).json({ message: "Нет прав на изменение этого проекта" });
    }
    if (!kase.planfix_id) {
      return res.status(400).json({
        message: "У проекта ещё нет карточки в Planfix — дождитесь синхронизации и попробуйте снова",
      });
    }

    const actor = planfixPeople.actorOf(req.user);
    if (!actor) {
      return res.status(409).json({
        message: "Ваш аккаунт не связан с сотрудником Planfix, поэтому задачу нельзя поставить от вашего имени. " +
                 "Попросите администратора настроить связь в разделе «Сотрудники Planfix».",
        needsBinding: true,
      });
    }

    let created;
    try {
      created = await planfixSync.createPlanfixTask({
        name,
        description: String(req.body?.description || ""),
        projectId: kase.planfix_id,
        assigneeIds: req.body?.assigneeIds || [],
        deadlineIso: req.body?.deadline || null,
        actor,
      });
    } catch (err) {
      await planfixPeople.logAction({
        user: req.user, actor, action: "create", caseId: kase.id,
        payload: { name }, ok: false, error: err.message,
      });
      throw err;
    }

    await planfixPeople.logAction({
      user: req.user, actor, action: "create", caseId: kase.id,
      planfixTaskId: created.id, payload: { name, authorApplied: created.authorApplied }, ok: true,
    });
    events.log(req.user, "task_created", {
      path: kase.folder_path, name, details: { case: kase.name },
    });

    // Подтягиваем к себе только что созданную задачу, чтобы она сразу
    // появилась в списке. Если не вышло — не беда: она приедет ближайшей
    // синхронизацией, и в Planfix она уже есть.
    let synced = false;
    try {
      synced = await planfixImport.importOneTask(created.id, kase.id);
    } catch (err) {
      console.error("Задача создана, но не подтянулась сразу:", err.message);
    }

    res.json({
      ok: true,
      planfixTaskId: created.id,
      synced,
      // Если Planfix не дал назначить постановщика, интерфейс скажет об
      // этом честно: имя ушло подписью в описании, а не потерялось.
      authorApplied: created.authorApplied,
      authorError: created.authorError,
    });
  } catch (err) {
    console.error("Не удалось создать задачу:", err);
    res.status(502).json({ message: "Planfix не принял новую задачу: " + err.message });
  }
});

/**
 * Правка задачи: исполнители и срок. Как и с завершением, сначала
 * меняем в Planfix и только после его согласия — у себя.
 */
cases.patch("/tasks/:id", async (req, res) => {
  try {
    const task = await loadVisibleTask(req, res);
    if (!task) return;
    if (!(await canWriteTask(req.user, task))) {
      return res.status(403).json({ message: "Нет прав на изменение этой задачи" });
    }

    const patch = {};
    if (req.body?.assigneeIds !== undefined) {
      patch.assigneeIds = (req.body.assigneeIds || []).map(Number).filter(Boolean);
    }
    if (req.body?.deadline !== undefined) patch.deadlineIso = req.body.deadline || null;
    if (!Object.keys(patch).length) {
      return res.status(400).json({ message: "Нечего менять" });
    }

    const actor = planfixPeople.actorOf(req.user);
    try {
      await planfixSync.updatePlanfixTask(task.planfix_id, patch);
    } catch (err) {
      await planfixPeople.logAction({
        user: req.user, actor, action: "update", taskId: task.id,
        planfixTaskId: task.planfix_id, caseId: task.case_id, payload: patch, ok: false, error: err.message,
      });
      throw err;
    }
    await planfixPeople.logAction({
      user: req.user, actor, action: "update", taskId: task.id,
      planfixTaskId: task.planfix_id, caseId: task.case_id, payload: patch, ok: true,
    });

    // Имена исполнителей берём из своего справочника, чтобы список
    // обновился сразу, не дожидаясь синхронизации.
    if (patch.assigneeIds) {
      const { rows: named } = await db.query(
        "SELECT name FROM planfix_people WHERE id = ANY($1::int[]) ORDER BY name", [patch.assigneeIds]);
      await db.query(
        "UPDATE case_tasks SET assignee_ids = $2, assignees = $3, updated_at = now() WHERE id = $1",
        [task.id, patch.assigneeIds.length ? patch.assigneeIds : null,
         named.map((r) => r.name).join(", ") || null]
      );
    }
    if (patch.deadlineIso !== undefined) {
      await db.query("UPDATE case_tasks SET end_date = $2, updated_at = now() WHERE id = $1",
        [task.id, patch.deadlineIso]);
    }

    events.log(req.user, "task_changed", {
      path: task.folder_path, name: task.name, details: { case: task.case_name },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("Не удалось изменить задачу:", err);
    res.status(502).json({ message: "Planfix не принял изменение задачи: " + err.message });
  }
});

/** Комментарий к задаче от имени текущего пользователя. */
cases.post("/tasks/:id/comment", async (req, res) => {
  const text = String(req.body?.text || "").trim();
  if (!text) return res.status(400).json({ message: "Комментарий пустой" });

  try {
    const task = await loadVisibleTask(req, res);
    if (!task) return;

    const actor = planfixPeople.actorOf(req.user);
    let added;
    try {
      added = await planfixSync.addTaskComment(task.planfix_id, text, actor);
    } catch (err) {
      await planfixPeople.logAction({
        user: req.user, actor, action: "comment", taskId: task.id,
        planfixTaskId: task.planfix_id, caseId: task.case_id, ok: false, error: err.message,
      });
      throw err;
    }
    await planfixPeople.logAction({
      user: req.user, actor, action: "comment", taskId: task.id,
      planfixTaskId: task.planfix_id, caseId: task.case_id,
      payload: { authorApplied: added.authorApplied }, ok: true,
    });
    res.json({ ok: true, authorApplied: added.authorApplied, authorError: added.authorError });
  } catch (err) {
    console.error("Не удалось добавить комментарий:", err);
    res.status(502).json({ message: "Planfix не принял комментарий: " + err.message });
  }
});

/** Задачи проекта: текущие и завершённые, зеркало Planfix. */
cases.get("/:id/tasks", loadCase, async (req, res) => {
  const { rows } = await db.query(
    `SELECT id, planfix_id, name, status_name, is_done, assignees, assigner, start_date, end_date
       FROM case_tasks WHERE case_id = $1
      ORDER BY is_done ASC, end_date NULLS LAST, id`,
    [req.params.id]
  );
  res.json({
    tasks: rows,
    syncedAt: req.case.planfix_tasks_synced_at || null,
  });
});

/** Список сотрудников Planfix — для выбора исполнителя. */
cases.get("/planfix/employees", async (req, res) => {
  try {
    const employees = await planfixSync.listPlanfixEmployees();
    res.json({ employees });
  } catch (err) {
    res.status(500).json({ message: "Не удалось получить список сотрудников Planfix: " + err.message });
  }
});

/** Создаёт выбранные задачи в Planfix для проекта — с исполнителем и сроком, если указаны. */
cases.post("/:id/planfix-tasks", loadCase, requireWriteOnCaseFolder, async (req, res) => {
  const kase = req.case;
  if (!kase.planfix_id) {
    return res.status(400).json({ message: "У проекта ещё нет карточки в Planfix — подождите синхронизации и попробуйте снова" });
  }

  const tasks = Array.isArray(req.body?.tasks) ? req.body.tasks : [];
  if (!tasks.length) return res.status(400).json({ message: "Не выбрано ни одной задачи" });

  const results = [];
  for (const t of tasks) {
    const name = String(t?.name || "").trim();
    if (!name) continue;
    try {
      const created = await planfixSync.createPlanfixTask({
        name,
        projectId: kase.planfix_id,
        assigneeId: t.assigneeId || null,
        deadlineIso: t.deadline || null,
        actor: planfixPeople.actorOf(req.user),
      });
      await planfixPeople.logAction({
        user: req.user, actor: planfixPeople.actorOf(req.user), action: "create",
        planfixTaskId: created.id, caseId: kase.id, payload: { name }, ok: true,
      });
      results.push({ name, ok: true, taskId: created.id, authorApplied: created.authorApplied });
    } catch (err) {
      results.push({ name, ok: false, error: err.message });
    }
  }
  res.json({ results });
});

cases.get("/:id", loadCase, async (req, res) => {
  const { rows } = await db.query(`${CASE_LIST_QUERY} AND c.id = $1`, [req.params.id]);
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

/**
 * Простая загрузка файлов в черновик — без распознавания ИИ, просто
 * складывает файлы, чтобы потом раскидать по нужным папкам при создании
 * проекта. Можно передать уже существующий batchId (query-параметр),
 * если загружаем вторую партию файлов в тот же черновик (например,
 * сначала в "Запрос", потом ещё и в "Первичные материалы").
 */
// Файлы приходят пачками (см. web/app.js): из перетащенной папки их может
// быть много, поэтому запас по количеству за один запрос — с избытком.
cases.post("/stage-files", upload.array("files", 50), async (req, res) => {
  if (!req.files || !req.files.length) {
    return res.status(400).json({ message: "Файлы не получены" });
  }

  const batchId = req.query.batchId || attachments.newBatchId();
  const results = [];

  for (const file of req.files) {
    const filename = Buffer.from(file.originalname, "latin1").toString("utf8");
    try {
      const key = await attachments.stageFile(batchId, filename, file.path);
      results.push({ key, filename });
    } catch (err) {
      console.error(`Не удалось загрузить файл "${filename}":`, err.message);
      results.push({ key: null, filename, error: err.message });
    } finally {
      await fs.promises.unlink(file.path).catch(() => {});
    }
  }

  res.json({ batchId, results });
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

    // Проект с таким названием мог быть удалён раньше: его запись осталась
    // ради истории. Тогда заводим не вторую строку, а оживляем прежнюю —
    // иначе упрёмся в уникальность наименования и получим невнятный отказ.
    const { rows: deletedTwin } = await db.query(
      "SELECT id FROM cases WHERE name = $1 AND deleted_at IS NOT NULL", [cleanName]);
    if (deletedTwin.length) {
      const { rows: revived } = await db.query(
        `UPDATE cases
            SET deleted_at = NULL, type = $2, stage = $3, status = 'waiting', is_cancelled = false,
                court_or_customer = $4, case_number = $5, manager_id = $6, experts = $7, year = $8,
                description = $9, organization = $10, party1 = $11, party2 = $12, judge_name = $13,
                folder_path = $14, updated_at = now()
          WHERE id = $1 RETURNING *`,
        [deletedTwin[0].id, type, stage, court_or_customer || null, case_number || null,
         manager_id || null, experts || null, year || null, description || null,
         organization || null, party1 || null, party2 || null, judge_name || null, folderPath]
      );
      const restored = revived[0];
      await db.query(
        `INSERT INTO case_history (case_id, action, to_stage, actor_id, note)
         VALUES ($1, 'created', $2, $3, 'Проект заведён заново после удаления')`,
        [restored.id, stage, req.user.id]
      );
      events.log(req.user, "case_create", { path: folderPath, name: cleanName, isDir: true, details: { stage } });
      res.status(201).json(restored);
      refreshJournalSafely();
      syncPlanfixSafely(restored.id);
      return;
    }

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

    events.log(req.user, "case_create", {
      path: folderPath,
      name: cleanName,
      isDir: true,
      details: { stage },
    });

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

    events.log(req.user, "case_stage", {
      path: newPath,
      name: kase.name,
      isDir: true,
      details: { from: kase.stage, to: targetStage, label: STAGE_LABEL[targetStage] },
    });

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

    events.log(req.user, "case_cancel", {
      path: kase.folder_path,
      name: kase.name,
      isDir: true,
      details: { reason },
    });

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
