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
const courtCase = require("./courtCase");
const courtOutcomes = require("./courtOutcomes");
const workCalendar = require("./workCalendar");

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
 * Руководитель центра. По инструкции именно он принимает решение об отмене
 * уже начатой экспертизы (п. 29.3) и о нестандартных случаях оплаты
 * (п. 27.3), поэтому применение таких исходов закрыто для остальных.
 *
 * Признак живёт в fm_permissions.can_manage, а не в users.role: таблица
 * users общая с "Учётом оборудования", и новое значение роли сломало бы
 * соседний сайт. Администратор считается руководителем — иначе некому
 * будет разблокировать процесс, если руководитель в отпуске.
 */
function isManager(user) {
  return user.role === "admin" || !!user.can_manage;
}

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
  res.json(courtCase.decorateCases(rows));
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
  res.json(courtCase.decorateCase(rows[0]));
});

/**
 * Разбор номера дела — для подсказки прямо во время набора в карточке.
 *
 * Отдельный маленький адрес нужен, чтобы правило «что считается номером
 * арбитражного дела» жило в одном месте. Иначе такой же разбор пришлось
 * бы повторить в браузере, и однажды две копии разошлись бы.
 */
cases.get("/court-number", (req, res) => {
  const value = req.query.value;
  const number = courtCase.normalizeCaseNumber(value);
  res.json({ number, url: number ? courtCase.kadUrl(number) : null });
});

// Типовые задачи по стадиям — Приложение 1 рабочей инструкции.
// Живут прямо в коде: это фиксированный по инструкции список, редко
// меняется, а держать отдельную таблицу под него было бы избыточно.
const PLANFIX_STAGES_WITH_TASKS = ["plan", "active", "control"];

/** Список типовых задач для стадии — теперь из общего справочника, а не зашит в код. */
cases.get("/planfix/stage-tasks/:stage", async (req, res) => {
  if (!PLANFIX_STAGES_WITH_TASKS.includes(req.params.stage)) {
    // Для завершённых и отменённых проектов типовых задач не бывает.
    // Говорим это отдельным полем, чтобы интерфейс не выдавал пустой
    // список за «список пуст, добавьте задачу».
    return res.json({ tasks: [], stage: req.params.stage, supported: false });
  }
  const { rows } = await db.query(
    "SELECT id, name FROM planfix_task_templates WHERE stage = $1 ORDER BY position, id",
    [req.params.stage]
  );
  res.json({ tasks: rows, stage: req.params.stage, supported: true });
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

/**
 * Проставляет каждой строке признак «мне можно её менять» — по правам на
 * папку проекта. Правила читаем один раз на весь список, а не на каждую
 * задачу отдельно.
 */
async function withWriteFlag(rows, user, folderOf) {
  const me = user.planfix_user_id || null;
  const decorate = (r, canWrite) => ({
    ...r, mine: isAssignee(r, me), byMe: isAssigner(r, me), can_write: canWrite,
  });

  if (user.role === "admin") return rows.map((r) => decorate(r, true));
  if (!user.can_cases) return rows.map((r) => decorate(r, false));

  const rules = await folderAccess.getUserRules(user.id);
  return rows.map((r) => decorate(r, folderAccess.resolveAccess(rules, folderOf(r)) === "write"));
}

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
      // can_write считаем здесь, а не спрашиваем потом по одной задаче:
      // без него интерфейс показывал бы кнопки, которые сервер всё равно
      // отклонит, а это хуже, чем их отсутствие.
      tasks: await withWriteFlag(list.slice(0, 500), req.user, (t) => t.folder_path),
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
  // Задач может быть сразу несколько: в папке проекта отмечают галочками
  // весь список стадии и ставят их одним нажатием. Одна задача — частный
  // случай того же самого.
  const names = (Array.isArray(req.body?.names) ? req.body.names : [req.body?.name])
    .map((n) => String(n || "").trim())
    .filter(Boolean);
  const caseId = Number(req.body?.caseId || 0);
  if (!names.length) return res.status(400).json({ message: "Не указано ни одной задачи" });
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

    // Каждую задачу отправляем отдельно и результат по каждой возвращаем
    // свой: если Planfix споткнулся на третьей из пяти, первые две уже
    // созданы, и делать вид, что не создалось ничего, — врать.
    const results = [];
    for (const name of names) {
      try {
        const created = await planfixSync.createPlanfixTask({
          name,
          description: String(req.body?.description || ""),
          projectId: kase.planfix_id,
          assigneeIds: req.body?.assigneeIds || [],
          deadlineIso: req.body?.deadline || null,
          actor,
        });
        await planfixPeople.logAction({
          user: req.user, actor, action: "create", caseId: kase.id,
          planfixTaskId: created.id, payload: { name, authorApplied: created.authorApplied }, ok: true,
        });
        events.log(req.user, "task_created", {
          path: kase.folder_path, name, details: { case: kase.name },
        });
        try {
          await planfixImport.importOneTask(created.id, kase.id);
        } catch (err) {
          // Не беда: задача приедет ближайшей синхронизацией, в Planfix
          // она уже есть.
          console.error("Задача создана, но не подтянулась сразу:", err.message);
        }
        results.push({
          name, ok: true, planfixTaskId: created.id,
          authorApplied: created.authorApplied, authorError: created.authorError,
        });
      } catch (err) {
        await planfixPeople.logAction({
          user: req.user, actor, action: "create", caseId: kase.id,
          payload: { name }, ok: false, error: err.message,
        });
        results.push({ name, ok: false, error: err.message });
      }
    }

    const failed = results.filter((r) => !r.ok);
    res.status(failed.length && failed.length === results.length ? 502 : 200).json({
      ok: !failed.length,
      results,
      created: results.length - failed.length,
      // Если Planfix не дал назначить постановщика, интерфейс скажет об
      // этом честно: имя ушло подписью в описании, а не потерялось.
      authorApplied: results.every((r) => !r.ok || r.authorApplied !== false),
      message: failed.length
        ? `Не удалось поставить: ${failed.map((f) => `«${f.name}» (${f.error})`).join("; ")}`
        : undefined,
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

/**
 * Удалить задачу — для случая «поставил не то».
 *
 * Порядок тот же, что у завершения: сначала Planfix, и только если он
 * согласился — убираем у себя. Иначе получилось бы, что в ИСУ задачи
 * нет, а в Planfix она висит и вернётся ближайшей синхронизацией.
 *
 * Восстановить удалённую задачу нельзя, поэтому запись об удалении
 * остаётся и в журнале действий Planfix, и в общей истории: кто, когда
 * и что именно убрал.
 */
cases.delete("/tasks/:id", async (req, res) => {
  try {
    const task = await loadVisibleTask(req, res);
    if (!task) return;
    if (!(await canWriteTask(req.user, task))) {
      return res.status(403).json({ message: "Нет прав на удаление этой задачи" });
    }

    const actor = planfixPeople.actorOf(req.user);
    try {
      await planfixSync.deletePlanfixTask(task.planfix_id);
    } catch (err) {
      await planfixPeople.logAction({
        user: req.user, actor, action: "delete", taskId: task.id,
        planfixTaskId: task.planfix_id, caseId: task.case_id,
        payload: { name: task.name }, ok: false, error: err.message,
      });
      throw err;
    }

    await db.query("DELETE FROM case_tasks WHERE id = $1", [task.id]);
    await planfixPeople.logAction({
      user: req.user, actor, action: "delete", taskId: task.id,
      planfixTaskId: task.planfix_id, caseId: task.case_id,
      payload: { name: task.name }, ok: true,
    });
    events.log(req.user, "task_deleted", {
      path: task.folder_path, name: task.name, details: { case: task.case_name },
    });

    res.json({ ok: true, name: task.name });
  } catch (err) {
    console.error("Не удалось удалить задачу:", err);
    res.status(502).json({ message: "Planfix не дал удалить задачу: " + err.message });
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

// Только цифры: иначе этот маршрут перехватывал бы справочники, которые
// объявлены ниже ("/court-outcomes", "/instruction-steps",
// "/work-calendar"), и они отвечали бы «проект не найден».
cases.get("/:id(\\d+)", loadCase, async (req, res) => {
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
      organization, party1, party2, judge_name, expertise_type,
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
                folder_path = $14, expertise_type = $15, updated_at = now()
          WHERE id = $1 RETURNING *`,
        [deletedTwin[0].id, type, stage, court_or_customer || null, case_number || null,
         manager_id || null, experts || null, year || null, description || null,
         organization || null, party1 || null, party2 || null, judge_name || null, folderPath,
         expertise_type || null]
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
          organization, party1, party2, judge_name, folder_path, expertise_type)
       VALUES ($1,$2,$3,'waiting',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [type, cleanName, stage, court_or_customer || null, case_number || null,
       manager_id || null, experts || null, year || null, description || null,
       organization || null, party1 || null, party2 || null, judge_name || null, folderPath,
       expertise_type || null]
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
/**
 * Правка карточки проекта.
 *
 * Здесь можно менять и тип проекта (экспертиза / независимое
 * исследование / без типа): у проектов, приехавших из Planfix, тип
 * иногда не распознаётся по группе, и такой проект попадает в «Прочее».
 * Исправлять это должно быть можно руками, не пересоздавая проект.
 *
 * Папку при смене типа НЕ переименовываем: имя папки — это то, как
 * проект называют люди, и переименование увело бы за собой пути, права
 * доступа и ссылки. Тип живёт в карточке, а список группируется по нему.
 *
 * Стадия здесь не меняется намеренно: её смена двигает папку, и для
 * этого есть отдельное действие «Переместить» со своей записью в
 * истории.
 */
cases.patch("/:id", loadCase, requireWriteOnCaseFolder, async (req, res) => {
  const fields = [
    "court_or_customer", "case_number", "manager_id", "experts", "year", "description", "status",
    "organization", "party1", "party2", "judge_name", "expertise_type",
  ];
  const sets = [];
  const values = [req.params.id];
  for (const f of fields) {
    if (req.body?.[f] !== undefined) {
      values.push(req.body[f] === "" ? null : req.body[f]);
      sets.push(`${f} = $${values.length}`);
    }
  }

  if (req.body?.type !== undefined) {
    // null — это «Прочее»: проект есть, но к экспертизам и НИ не относится.
    const type = req.body.type === "" || req.body.type === null ? null : String(req.body.type);
    if (type !== null && !["expertise", "research"].includes(type)) {
      return res.status(400).json({ message: "Некорректный тип проекта" });
    }
    values.push(type);
    sets.push(`type = $${values.length}`);
  }

  if (!sets.length) return res.status(400).json({ message: "Нечего обновлять" });

  const { rows } = await db.query(
    `UPDATE cases SET ${sets.join(", ")}, updated_at = now() WHERE id = $1 RETURNING *`,
    values
  );

  // Смена типа меняет то, в какой группе проект виден, — это стоит
  // отдельной записи в истории проекта, чтобы потом было понятно, кто
  // и когда его перенёс.
  if (req.body?.type !== undefined && req.body.type !== req.case.type) {
    const label = (t) => (t === "expertise" ? "Экспертизы" : t === "research" ? "Независимые исследования" : "Прочее");
    await db.query(
      `INSERT INTO case_history (case_id, action, actor_id, note)
       VALUES ($1, 'edited', $2, $3)`,
      [req.case.id, req.user.id, `Тип проекта: «${label(req.case.type)}» → «${label(rows[0].type)}»`]
    );
  }

  events.log(req.user, "case_edit", {
    path: req.case.folder_path, name: req.case.name, isDir: true,
  });

  res.json(courtCase.decorateCase(rows[0]));
  refreshJournalSafely();
  syncPlanfixSafely(req.params.id);
});

// Строгий порядок движения по стадиям — без пропусков, как в инструкции.
const NEXT_STAGE = { plan: "active", active: "control", control: "done" };
const STAGE_LABEL = { plan: "План", active: "Активный", control: "Контроль", done: "Завершённый" };

/** Перевести проект на следующую стадию — папка переезжает, журнал обновляется. */
/**
 * Перевод проекта на другую стадию: папка переезжает, права едут за ней,
 * пишется история и ключевое событие.
 *
 * Вынесено из роута отдельной функцией, потому что то же самое делает
 * применение решения суда (п. 17.2 инструкции: «изменить этап и
 * переместить папку»). Дублировать этот код в двух местах нельзя — они
 * бы разошлись.
 *
 * status: чем заменить статус. По умолчанию «Ожидание», как было раньше;
 * инструкция для перехода в «Активный» требует «В работе» (п. 17.2).
 */
async function moveCaseToStage(kase, targetStage, user, { status = "waiting", note } = {}) {
  if (kase.is_cancelled) throw Object.assign(new Error("Проект отменён"), { status: 409 });
  if (!targetStage || !STAGE_LABEL[targetStage]) {
    throw Object.assign(new Error("Некорректная стадия"), { status: 400 });
  }
  if (targetStage === kase.stage) {
    throw Object.assign(new Error("Проект уже на этой стадии"), { status: 409 });
  }

  const newParent = caseFolders.stageRootPath(targetStage);
  const newPath = await files.moveEntry(kase.folder_path, newParent);
  await folderPermissions.renamePath(kase.folder_path, newPath);

  const { rows: updated } = await db.query(
    `UPDATE cases
        SET stage = $2, folder_path = $3, status = $4, updated_at = now(),
            archived_at = CASE WHEN $2 = 'done' THEN now() ELSE archived_at END
      WHERE id = $1 RETURNING *`,
    [kase.id, targetStage, newPath, status]
  );

  await db.query(
    `INSERT INTO case_history (case_id, action, from_stage, to_stage, actor_id, note)
     VALUES ($1, 'stage_changed', $2, $3, $4, $5)`,
    [kase.id, kase.stage, targetStage, user.id,
     note || `Переведён на стадию «${STAGE_LABEL[targetStage]}»`]
  );

  events.log(user, "case_stage", {
    path: newPath,
    name: kase.name,
    isDir: true,
    details: { from: kase.stage, to: targetStage, label: STAGE_LABEL[targetStage] },
  });

  refreshJournalSafely();
  syncPlanfixSafely(kase.id);
  return updated[0];
}

cases.post("/:id/advance", loadCase, requireWriteOnCaseFolder, async (req, res) => {
  try {
    // Стадию можно указать явно (выбор из списка на карточке) — если не
    // указана, используем прежнее поведение "на следующую по порядку".
    const targetStage = req.body?.stage || NEXT_STAGE[req.case.stage];
    res.json(await moveCaseToStage(req.case, targetStage, req.user));
  } catch (err) {
    console.error("Не удалось изменить стадию:", err);
    res.status(err.status || 500).json({ message: err.message || "Не удалось изменить стадию" });
  }
});

/** Отменить проект — с любой стадии. Папка переезжает в архив «Отменённые». */
/**
 * Отмена проекта: папка в «04. Архив / Отмененные», причина в историю
 * (раздел 29 инструкции). Тоже отдельной функцией — её вызывает и роут,
 * и применение решения суда.
 */
async function cancelCase(kase, user, reason) {
  if (kase.is_cancelled) throw Object.assign(new Error("Проект уже отменён"), { status: 409 });
  const clean = String(reason || "").trim();
  if (!clean) throw Object.assign(new Error("Укажите причину отмены"), { status: 400 });

  const newParent = caseFolders.cancelledRootPath();
  const newPath = await files.moveEntry(kase.folder_path, newParent);
  await folderPermissions.renamePath(kase.folder_path, newPath);

  const { rows: updated } = await db.query(
    `UPDATE cases
        SET is_cancelled = true, cancel_reason = $2, folder_path = $3,
            updated_at = now(), archived_at = now()
      WHERE id = $1 RETURNING *`,
    [kase.id, clean, newPath]
  );

  await db.query(
    `INSERT INTO case_history (case_id, action, from_stage, actor_id, note)
     VALUES ($1, 'cancelled', $2, $3, $4)`,
    [kase.id, kase.stage, user.id, clean]
  );

  events.log(user, "case_cancel", {
    path: kase.folder_path, name: kase.name, isDir: true, details: { reason: clean },
  });

  refreshJournalSafely();
  syncPlanfixSafely(kase.id);
  return updated[0];
}

cases.post("/:id/cancel", loadCase, requireWriteOnCaseFolder, async (req, res) => {
  try {
    res.json(await cancelCase(req.case, req.user, req.body?.reason));
  } catch (err) {
    console.error("Не удалось отменить проект:", err);
    res.status(err.status || 500).json({ message: err.message || "Не удалось отменить проект" });
  }
});

/* ---------------- Что установил суд ----------------
   Раздел 16.3, 24.3 и 29 рабочей инструкции. Программа НЕ применяет
   решение сама: она считает предложение и ждёт подтверждения, потому
   что перевод стадии двигает папку и меняет Planfix. */

/** Справочник исходов — для выбора в окне и для правки правил. */
cases.get("/court-outcomes", async (req, res) => {
  try {
    res.json({
      outcomes: await courtOutcomes.listOutcomes(req.query.stage || null),
      rules: courtOutcomes.RULE_KINDS,
      applies: courtOutcomes.APPLIES,
    });
  } catch (err) {
    res.status(500).json({ message: "Не удалось получить справочник исходов: " + err.message });
  }
});

/**
 * Правка правил. Доступна всем с доступом к «Делам» — так решил
 * заказчик. Чтобы регламент не разъезжался с документом незаметно,
 * каждое изменение пишется в историю системы с автором и датой.
 */
cases.post("/court-outcomes", async (req, res) => {
  try {
    const saved = await courtOutcomes.saveOutcome(req.body?.id || null, req.body, req.user.id);
    events.log(req.user, "outcome_rule", {
      name: saved.name, details: { action: req.body?.id ? "изменено" : "добавлено" },
    });
    res.json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

cases.delete("/court-outcomes/:id", async (req, res) => {
  try {
    const outcome = await courtOutcomes.getOutcome(req.params.id);
    if (!outcome) return res.status(404).json({ message: "Исход не найден" });
    await courtOutcomes.removeOutcome(req.params.id);
    events.log(req.user, "outcome_rule", { name: outcome.name, details: { action: "убрано" } });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/** Порядок работы по стадиям — шаги из инструкции. */
cases.get("/instruction-steps", async (req, res) => {
  try {
    res.json({ steps: await courtOutcomes.listSteps() });
  } catch (err) {
    res.status(500).json({ message: "Не удалось получить порядок работы: " + err.message });
  }
});

/** История решений суда по проекту. */
cases.get("/:id/court-events", loadCase, async (req, res) => {
  const { rows } = await db.query(
    `SELECT e.*, c.username AS created_by_name, a.username AS applied_by_name
       FROM case_court_events e
       LEFT JOIN users c ON c.id = e.created_by
       LEFT JOIN users a ON a.id = e.applied_by
      WHERE e.case_id = $1
      ORDER BY e.event_date DESC, e.id DESC`,
    [req.params.id]
  );
  res.json({ events: rows });
});

/**
 * Записать решение суда и получить предложение.
 *
 * Запись ложится в историю сразу — даже если предложение потом не
 * применят: движение дела важно само по себе, и его же будет заполнять
 * автоматика, когда подключим картотеку.
 */
cases.post("/:id/court-events", loadCase, requireWriteOnCaseFolder, async (req, res) => {
  try {
    const outcome = await courtOutcomes.getOutcome(req.body?.outcomeId);
    if (!outcome) return res.status(400).json({ message: "Выберите, что установил суд" });

    const eventDate = workCalendar.toIso(workCalendar.parseIso(req.body?.eventDate));
    if (!eventDate) return res.status(400).json({ message: "Укажите дату определения" });

    const input = {
      eventDate,
      hearingDate: workCalendar.toIso(workCalendar.parseIso(req.body?.hearingDate)),
      expertiseDue: workCalendar.toIso(workCalendar.parseIso(req.body?.expertiseDue)),
    };
    const plan = await courtOutcomes.buildPlan(req.case, outcome, input);

    const { rows } = await db.query(
      `INSERT INTO case_court_events
         (case_id, outcome_id, outcome_name, event_date, hearing_date, expertise_due,
          note, source, plan, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'manual',$8::jsonb,$9) RETURNING *`,
      [req.case.id, outcome.id, outcome.name, eventDate, input.hearingDate, input.expertiseDue,
       String(req.body?.note || "").trim() || null, JSON.stringify(plan), req.user.id]
    );

    events.log(req.user, "court_event", {
      path: req.case.folder_path, name: req.case.name, isDir: true,
      details: { outcome: outcome.name, date: eventDate },
    });

    res.status(201).json({ event: rows[0], plan });
  } catch (err) {
    console.error("Не удалось записать решение суда:", err);
    res.status(500).json({ message: "Не удалось записать решение суда: " + err.message });
  }
});

/** Удалить ошибочно вписанное решение — пока оно не применено. */
cases.delete("/court-events/:id", async (req, res) => {
  const { rows } = await db.query(
    `SELECT e.*, c.folder_path FROM case_court_events e
       JOIN cases c ON c.id = e.case_id WHERE e.id = $1`, [req.params.id]);
  const event = rows[0];
  if (!event) return res.status(404).json({ message: "Запись не найдена" });
  if (event.applied) {
    return res.status(409).json({
      message: "Это решение уже применено — запись удалить нельзя. Она нужна, чтобы было видно, почему проект переехал.",
    });
  }
  if (!(await canWriteTask(req.user, { folder_path: event.folder_path }))) {
    return res.status(403).json({ message: "Нет прав на изменение этого проекта" });
  }
  await db.query("DELETE FROM case_court_events WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

/**
 * Применить предложение: перевести стадию, поменять статус, поставить
 * задачи. Всё, что здесь происходит, человек уже увидел на экране.
 */
cases.post("/court-events/:id/apply", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM case_court_events WHERE id = $1", [req.params.id]);
    const event = rows[0];
    if (!event) return res.status(404).json({ message: "Запись не найдена" });
    if (event.applied) return res.status(409).json({ message: "Это решение уже применено" });

    const { rows: kases } = await db.query(
      "SELECT * FROM cases WHERE id = $1 AND deleted_at IS NULL", [event.case_id]);
    const kase = kases[0];
    if (!kase) return res.status(404).json({ message: "Проект не найден" });
    if (!(await canWriteTask(req.user, kase))) {
      return res.status(403).json({ message: "Нет прав на изменение этого проекта" });
    }

    const outcome = await courtOutcomes.getOutcome(event.outcome_id);
    if (!outcome) return res.status(400).json({ message: "Исход убран из справочника — применить нечего" });

    // Инструкция прямо требует решения руководителя для отмены активной
    // экспертизы (п. 29.3) и нестандартных случаев оплаты (п. 27.3).
    if (outcome.requires_manager && !isManager(req.user)) {
      return res.status(403).json({
        message: "По инструкции это решение принимает руководитель центра. Попросите его подтвердить.",
      });
    }

    // Пересчитываем предложение заново, а не берём сохранённое: правила
    // и календарь могли поправить между записью и применением.
    const plan = await courtOutcomes.buildPlan(kase, outcome, {
      eventDate: workCalendar.toIso(event.event_date),
      hearingDate: workCalendar.toIso(event.hearing_date),
      expertiseDue: workCalendar.toIso(event.expertise_due),
    });

    if (plan.needsDecision) {
      return res.status(409).json({
        message: "Для этого случая инструкция не задаёт, что делать дальше — переведите проект вручную.",
      });
    }

    const done = [];
    const reason = `${outcome.name} (определение от ${workCalendar.toIso(event.event_date)})`;

    if (plan.cancel) {
      await cancelCase(kase, req.user, reason);
      done.push("Проект отменён, папка перенесена в «04. Архив / Отмененные».");
    } else if (plan.targetStage) {
      await moveCaseToStage(kase, plan.targetStage, req.user,
        { status: plan.targetStatus || "waiting", note: reason });
      done.push(`Проект переведён на стадию «${courtOutcomes.STAGE_LABEL[plan.targetStage]}», папка перенесена.`);
    } else if (plan.targetStatus) {
      await db.query("UPDATE cases SET status = $2, updated_at = now() WHERE id = $1",
        [kase.id, plan.targetStatus]);
      done.push(`Статус изменён на «${courtOutcomes.STATUS_LABEL[plan.targetStatus]}».`);
      syncPlanfixSafely(kase.id);
    }

    // Задачи ставим последними: если Planfix недоступен, проект уже
    // переведён правильно, а задачи можно поставить руками.
    const taskResults = [];
    if (plan.tasks.length && kase.planfix_id) {
      const actor = planfixPeople.actorOf(req.user);
      for (const t of plan.tasks) {
        try {
          const created = await planfixSync.createPlanfixTask({
            name: t.name,
            description: t.hint || "",
            projectId: kase.planfix_id,
            deadlineIso: t.due || null,
            actor,
          });
          try { await planfixImport.importOneTask(created.id, kase.id); } catch { /* приедет сверкой */ }
          taskResults.push({ name: t.name, ok: true });
        } catch (err) {
          taskResults.push({ name: t.name, ok: false, error: err.message });
        }
      }
      const failed = taskResults.filter((t) => !t.ok);
      done.push(failed.length
        ? `Поставлено задач: ${taskResults.length - failed.length} из ${taskResults.length}.`
        : `Поставлено задач: ${taskResults.length}.`);
    } else if (plan.tasks.length) {
      done.push("Задачи не поставлены: у проекта ещё нет карточки в Planfix.");
    }

    await db.query(
      `UPDATE case_court_events
          SET applied = true, applied_at = now(), applied_by = $2, plan = $3::jsonb
        WHERE id = $1`,
      [event.id, req.user.id, JSON.stringify(plan)]
    );

    await db.query(
      `INSERT INTO case_history (case_id, action, actor_id, note)
       VALUES ($1, 'court_event', $2, $3)`,
      [kase.id, req.user.id, `${reason}. ${done.join(" ")}`]
    );

    res.json({ ok: true, done, tasks: taskResults, plan });
  } catch (err) {
    console.error("Не удалось применить решение суда:", err);
    res.status(err.status || 500).json({ message: err.message || "Не удалось применить решение суда" });
  }
});

/* ---------------- Производственный календарь ----------------
   Инструкция считает сроки в рабочих днях, поэтому праздники и переносы
   надо заводить руками: они каждый год свои и постановление о переносах
   выходит только осенью на следующий год. Пока год не заведён, расчёт
   честно помечается ненадёжным, а не подсовывает неверную дату. */

cases.get("/work-calendar", async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    res.json({
      year,
      days: await workCalendar.listCalendar(year),
      years: await workCalendar.knownYears(),
    });
  } catch (err) {
    res.status(500).json({ message: "Не удалось получить календарь: " + err.message });
  }
});

/** Правка календаря — только админ или руководитель: от этих дат зависят
 *  сроки по всем проектам сразу, и случайная правка тихо сдвинет их все. */
function requireManager(req, res, next) {
  if (isManager(req.user)) return next();
  res.status(403).json({
    message: "Производственный календарь ведёт администратор или руководитель центра.",
  });
}

cases.post("/work-calendar", requireManager, async (req, res) => {
  try {
    const day = await workCalendar.setDay(
      req.body?.day, req.body?.kind, req.body?.note, req.user.id);
    events.log(req.user, "work_calendar", {
      name: day.day,
      details: { action: day.kind === "holiday" ? "выходной" : "рабочий день" },
    });
    res.json(day);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

cases.delete("/work-calendar/:day", requireManager, async (req, res) => {
  try {
    const removed = await workCalendar.removeDay(req.params.day);
    if (!removed) return res.status(404).json({ message: "Такой отметки в календаре нет" });
    events.log(req.user, "work_calendar", {
      name: req.params.day, details: { action: "отметка убрана" },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message });
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
