// Мини-копия серверной части: реальная файловая система, реальный /api/upload
// (логика повторяет filemanager/src/server.js), остальное — заглушки,
// достаточные, чтобы фронтенд поднялся и отрисовал колонки/папку.
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const ROOT = process.env.TEST_ROOT || "/home/claude/test/storage";
// Корзина работает на настоящем коде и настоящей базе — так проверяем
// связку фронтенд + сервер + PostgreSQL целиком.
process.env.DATA_ROOT = ROOT;
process.env.PGHOST = process.env.PGHOST || "/tmp";
process.env.PGPORT = process.env.PGPORT || "5433";
process.env.PGUSER = process.env.PGUSER || "pribory";
// База та же, что у «Учёта»: на боевом сервере она одна на обе системы
// (общий контейнер db), и раздел «Оборудование» читает приборы прямо
// из неё. Стенд должен повторять эту схему, иначе проверять раскладку
// папок было бы не на чем.
process.env.PGDATABASE = process.env.PGDATABASE || "uchet";
const trash = require("/home/claude/fm/src/trash.js");
const events = require("/home/claude/fm/src/events.js");
const db = require("/home/claude/fm/src/db.js");
const courtCase = require("/home/claude/fm/src/courtCase.js");
// Справочник исходов, расчёт сроков и календарь берём настоящие: они
// работают на той же базе, и подменять их заглушкой означало бы
// проверять не то, что поедет на сервер.
const courtOutcomes = require("/home/claude/fm/src/courtOutcomes.js");
const workCalendar = require("/home/claude/fm/src/workCalendar.js");
const taskDates = require("/home/claude/fm/src/taskDates.js");
const planfixSync = require("/home/claude/fm/src/planfixSync.js");
const WEB = "/home/claude/fm/web";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
const upload = multer({ dest: "/tmp/uploads" });

function safeResolve(rel) {
  const abs = path.resolve(ROOT, "." + path.posix.normalize("/" + (rel || "/")));
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) throw new Error("Недопустимый путь");
  return abs;
}
function sanitizeRelativePath(p) {
  return p.split("/").filter((s) => s && s !== "." && s !== "..").join(path.sep);
}

let USER = {
  id: 1, username: "test", role: "admin",
  can_tools: true, can_db: true, can_cases: true, can_manage: true,
};
let loggedIn = true;
app.get("/__auth", (req, res) => { loggedIn = req.query.state !== "out"; res.json({ loggedIn }); });
// Позволяет тесту войти "другим" пользователем: ролью и набором прав.
app.get("/__user", (req, res) => {
  const on = (v, def) => (v === undefined ? def : v === "1" || v === "true");
  USER = {
    id: Number(req.query.id || 2),
    username: req.query.username || "anna",
    role: req.query.role || "employee",
    can_tools: on(req.query.tools, false),
    can_db: on(req.query.db, false),
    can_cases: on(req.query.cases, true),
    // Руководитель центра: только он подтверждает отмену начатой
    // экспертизы и правит производственный календарь.
    can_manage: on(req.query.manage, false),
    // Связь с сотрудником Planfix: без неё "Мои задачи" и постановка
    // задач от своего имени не работают.
    planfix_user_id: req.query.pf ? Number(req.query.pf) : null,
    planfix_name: req.query.pfname || null,
  };
  if (req.query.resetPerms) { folderPerms = []; folderPermSeq = 1; }
  res.json({ user: USER });
});
app.get("/api/auth/me", (req, res) =>
  loggedIn ? res.json({ user: USER }) : res.status(401).json({ message: "unauthorized" })
);
app.post("/api/auth/login", (req, res) => { loggedIn = true; res.json({ user: USER }); });
// Список вынесен в переменную: тот же набор нужен и журналу — там из
// него строится выпадающий список «Руководитель».
const USERS = [
  { id: 1, username: "kirill", role: "admin" },
  { id: 2, username: "anna", role: "employee" },
];
app.get("/api/users", (req, res) => res.json({ users: USERS }));

/* --- персональный доступ к папкам: список в памяти --- */
let folderPerms = [];
let folderPermSeq = 1;
app.get("/api/folder-permissions", (req, res) => {
  if (USER.role !== "admin") return res.status(403).json({ message: "Доступ запрещён" });
  res.json({ permissions: folderPerms.filter((p) => p.path === req.query.path) });
});
app.post("/api/folder-permissions", (req, res) => {
  if (USER.role !== "admin") return res.status(403).json({ message: "Доступ запрещён" });
  const { path: p, userId, access } = req.body || {};
  if (!p || !userId || !["read", "write", "none"].includes(access)) {
    return res.status(400).json({ message: "Укажите папку, пользователя и уровень доступа" });
  }
  const username = userId === 1 ? "kirill" : "anna";
  const existing = folderPerms.find((x) => x.path === p && x.user_id === userId);
  if (existing) existing.access = access;
  else folderPerms.push({ id: folderPermSeq++, path: p, user_id: userId, username, access });
  res.json({ ok: true });
});
app.delete("/api/folder-permissions/:id", (req, res) => {
  folderPerms = folderPerms.filter((x) => String(x.id) !== req.params.id);
  res.json({ ok: true });
});
app.get("/api/tools", (req, res) => res.json({ links: [] }));
/* --- Эксперты: работаем с настоящей файловой системой стенда ---
   Раньше здесь был захардкоженный список из пяти имён. Проверить на нём
   заведение эксперта нельзя: он не зависит от того, что на диске.
   Теперь читаем и пишем по-настоящему, тем же кодом, что и боевой
   сервер (src/experts.js). */
const expertsLib = require("/home/claude/fm/src/experts.js");

app.get("/api/experts", async (req, res) => {
  const dirAbs = safeResolve(expertsLib.EXPERTS_DIR);
  let entries = [];
  try {
    entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  } catch {
    return res.json({ experts: [] });
  }
  const experts = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    experts.push({
      name: entry.name,
      path: expertsLib.expertPath(entry.name),
      has_info: await expertsLib.hasInfo(safeResolve, entry.name),
      attachments: await expertsLib.listAttachments(safeResolve, entry.name),
    });
  }
  experts.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  res.json({ experts });
});

app.post("/api/experts", async (req, res) => {
  try {
    const infoText = String(req.body?.infoText || "");
    const infoLines = infoText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const expert = await expertsLib.createExpert(safeResolve, { name: req.body?.name, infoLines });
    res.status(201).json({ expert });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});
app.get("/api/disk-usage", (req, res) => res.json({ free: 1e10, used: 1e10, total: 2e10, percentUsed: 50 }));
/* --- проекты и их задачи: минимальная имитация боевых ответов --- */
const PROJECTS = {
  "/Дела/01.Планы/ЭКС.Гараж (Талдом)": {
    id: 11, name: "ЭКС.Гараж (Талдом)", type: "expertise", stage: "plan", status: "waiting",
    is_cancelled: false, planfix_id: 792, case_number: "А41-58392/2026", folder_path: "/Дела/01.Планы/ЭКС.Гараж (Талдом)",
  },
  "/Дела/01.Планы/НИ.Аммиак": {
    id: 12, name: "НИ.Аммиак", type: "research", stage: "plan", status: "waiting",
    is_cancelled: false, planfix_id: null, folder_path: "/Дела/01.Планы/НИ.Аммиак",
  },
  // Проект на контроле: у него свой список типовых задач — по нему
  // проверяется, что список зависит от стадии выбранного проекта.
  "/Дела/03.Проекты на контроле/НИ.Барвиха": {
    id: 13, name: "НИ.Барвиха", type: "research", stage: "control", status: "in_progress",
    is_cancelled: false, planfix_id: 801, case_number: "А41-777/2026", folder_path: "/Дела/03.Проекты на контроле/НИ.Барвиха",
  },
  // Приехал из Planfix без распознанного типа: по названию в группу не
  // попадает, поправить можно только в карточке.
  "/Дела/03.Проекты на контроле/ЭКСПЕРТИЗА НИЦ": {
    id: 14, name: "ЭКСПЕРТИЗА НИЦ", type: null, stage: "control", status: "waiting",
    is_cancelled: false, planfix_id: 802, case_number: "А40-1/2026",
    folder_path: "/Дела/03.Проекты на контроле/ЭКСПЕРТИЗА НИЦ",
  },
};
// Применение решения суда двигает проект между стадиями, а сервер живёт
// один на все наборы тестов. Держим исходный снимок, чтобы набор мог
// вернуть проекты как было и не ломать соседние.
// Поля журнала регистрации. В заглушке они раньше не заводились: ни один
// набор их не смотрел. Экран журнала показывает ровно их, поэтому
// раскладываем осмысленно — часть заполнена, часть намеренно пуста,
// чтобы было на чём проверить и фильтры, и подпись «не заполнено».
const JOURNAL_EXTRA = {
  11: { organization: "АО «НИЦ Строительство»", expertise_type: "Строительно-техническая",
        year: 2026, description: "Гараж, обследование конструкций", manager_id: 1,
        experts: "Гиясов Б.И., Давыдов А.Е.", court_or_customer: "Арбитражный суд Московской области",
        party1: "ООО «Гараж-Строй»", party2: "Администрация Талдома", judge_name: "Орлов Д.С." },
  12: { organization: "АО «НИЦ Строительство»", expertise_type: null,
        year: 2026, description: null, manager_id: null,
        experts: null, court_or_customer: null, party1: null, party2: null, judge_name: null },
  13: { organization: "АНО НТЦиНИ", expertise_type: "Землеустроительная",
        year: 2025, description: "Аммиакопровод", manager_id: 1,
        experts: "Коляскин В.Ю.", court_or_customer: "ПАО «Тольяттиазот»",
        party1: null, party2: null, judge_name: null },
  14: { organization: "НИУ ВШЭ", expertise_type: null, year: 2024,
        description: null, manager_id: null, experts: null,
        court_or_customer: "Арбитражный суд города Москвы",
        party1: null, party2: null, judge_name: null },
};
for (const p of Object.values(PROJECTS)) Object.assign(p, JOURNAL_EXTRA[p.id] || {});

const PROJECTS_SNAPSHOT = JSON.stringify(PROJECTS);
app.get("/__projects", (req, res) => {
  if (req.query.reset) {
    for (const k of Object.keys(PROJECTS)) delete PROJECTS[k];
    Object.assign(PROJECTS, JSON.parse(PROJECTS_SNAPSHOT));
    // Стадия задачи берётся от её проекта, поэтому возвращать проекты на
    // место, не вернув стадию задачам, значило бы оставить за собой
    // рассинхрон для следующего набора.
    for (const t of ALL_TASKS) {
      const p = Object.values(PROJECTS).find((x) => x.id === t.case_id);
      if (p) t.case_stage = p.stage;
    }
  }
  res.json({ projects: Object.values(PROJECTS) });
});

const PROJECT_TASKS = {
  11: [
    { id: 1, planfix_id: 888, name: "Принять решение об участии", status_name: "Новая",
      is_done: false, assignees: "Павел Челышков", assigner: "Кирилл Базаев", end_date: "2026-08-25" },
    { id: 2, planfix_id: 913, name: "Контроль судебного процесса", status_name: "В работе",
      is_done: false, assignees: "Кирилл Базаев", assigner: "Кирилл Базаев", end_date: "2026-09-25" },
    { id: 3, planfix_id: 889, name: "Подготовить ГП", status_name: "Завершенная",
      is_done: true, assignees: "Кирилл Базаев", assigner: "Кирилл Базаев", end_date: "2026-08-24" },
  ],
  12: [],
};

app.get("/api/cases", (req, res) => res.json(courtCase.decorateCases(Object.values(PROJECTS))));

// Разбор номера дела — тем же кодом, что и на боевом сервере.
app.get("/api/cases/court-number", (req, res) => {
  const number = courtCase.normalizeCaseNumber(req.query.value);
  res.json({ number, url: number ? courtCase.kadUrl(number) : null });
});

/* ---------------- Оборудование ----------------
   Раскладку папок держит тот же модуль, что и на боевом сервере, —
   проверять её на подделке не имело бы смысла. База у стенда та же
   (PGDATABASE=uchet), поэтому приборы настоящие. */

const equipment = require("/home/claude/fm/src/equipment.js");

app.get("/api/equipment/describe", async (req, res) => {
  try {
    const p = String(req.query.path || "");
    if (!p.startsWith(equipment.EQUIPMENT_DIR)) return res.json(null);
    if (p.replace(/\/+$/, "") === equipment.EQUIPMENT_DIR) await equipment.sync({ baseUrl: QR_BASE });
    res.json(await equipment.describe(p));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/equipment/control-types", async (req, res) => {
  const types = await equipment.loadControlTypes().catch(() => new Map());
  res.json({ types: [...types.values()] });
});

app.get("/api/equipment/companies", async (req, res) => {
  const { rows } = await db.query("SELECT code, name FROM companies ORDER BY position, code").catch(() => ({ rows: [] }));
  res.json({ companies: rows });
});

app.post("/api/equipment/instruments", async (req, res) => {
  try {
    const body = req.body || {};
    const name = String(body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Укажите название прибора" });
    const nullify = (v) => (String(v ?? "").trim() === "" ? null : String(v).trim());
    const CHECK = ["verification", "calibration", "none"];
    const { rows } = await db.query(
      `INSERT INTO instruments (inventory_no, name, serial_number, model, check_type,
         control_type, company_code, verification_date, valid_until, comment)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [nullify(body.inventory_no), name, nullify(body.serial_number), nullify(body.model),
       CHECK.includes(body.check_type) ? body.check_type : "verification",
       nullify(body.control_type), nullify(body.company_code),
       nullify(body.verification_date), nullify(body.valid_until), String(body.comment || "").trim()]
    );
    await equipment.sync({ baseUrl: QR_BASE });
    const { rows: fresh } = await db.query("SELECT * FROM instruments WHERE id = $1", [rows[0].id]);
    res.status(201).json({ instrument: fresh[0] });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ message: "Прибор с таким инвентарным номером уже есть" });
    res.status(500).json({ message: err.message });
  }
});

const QR_BASE = "http://localhost:3999/instruments/";

app.get("/api/equipment/qr-archive", async (req, res) => {
  try {
    await equipment.sync({ baseUrl: QR_BASE });
    await equipment.rebuildQr(QR_BASE);
    const items = await equipment.qrFiles();
    if (!items.length) return res.status(404).json({ message: "QR-кодов пока нет" });
    const { ZipArchive } = require("/home/claude/fm/node_modules/archiver");
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="qr.zip"`);
    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.on("error", () => res.destroy());
    archive.pipe(res);
    for (const item of items) archive.file(safeResolve(item.path), { name: item.name });
    await archive.finalize();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/equipment/qr-rebuild", async (req, res) => {
  try {
    await equipment.sync({ baseUrl: QR_BASE });
    res.json({ count: await equipment.rebuildQr(QR_BASE) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/equipment/upload-dir", async (req, res) => {
  try {
    res.json({ path: await equipment.uploadDirFor(Number(req.query.id), req.query.kind) });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

app.post("/api/equipment/adopt-file", async (req, res) => {
  const adopted = await equipment.adoptFirstImage(
    Number(req.body?.id), String(req.body?.path || ""), req.body?.kind).catch(() => false);
  res.json({ adopted });
});

/* ---------------- Журнал регистрации ---------------- */

const journalExcel = require("/home/claude/fm/src/journalExcel.js");

/** Права те же, что и на папку дела, — как в «Списке дел». */
function journalVisible() {
  const rule = (p, level) => folderPerms.some((r) =>
    r.user_id === USER.id && (level ? r.access === level : r.access !== "none") &&
    (p.folder_path === r.path || p.folder_path.startsWith(r.path + "/")));
  return Object.values(PROJECTS)
    .filter((p) => USER.role === "admin" || rule(p, null))
    .map((p) => ({
      ...p,
      manager_name: p.manager_id ? (USERS.find((u) => u.id === p.manager_id) || {}).username || null : null,
      can_write: USER.role === "admin" || rule(p, "write"),
    }));
}

const uniqueSorted = (values) =>
  [...new Set(values.map((v) => (v == null ? "" : String(v).trim())).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "ru"));

app.get("/api/cases/journal", (req, res) => {
  const rows = journalVisible();
  res.json({
    rows,
    managers: USERS.map((u) => ({ id: u.id, username: u.username })),
    organizations: uniqueSorted(rows.map((r) => r.organization)),
    expertise_types: uniqueSorted(rows.map((r) => r.expertise_type)),
    years: uniqueSorted(rows.map((r) => r.year)).sort((a, b) => String(b).localeCompare(String(a))),
  });
});

app.post("/api/cases/journal/export", async (req, res) => {
  const all = journalVisible();
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : null;
  let sheets, fileName;
  if (ids && ids.length) {
    const byId = new Map(all.map((r) => [r.id, r]));
    const picked = ids.map((id) => byId.get(id)).filter(Boolean);
    if (!picked.length) return res.status(400).json({ message: "Нечего выгружать" });
    sheets = [{ name: "ВЫБОРКА", rows: picked }];
    fileName = "Журнал регистрации (выборка).xlsx";
  } else {
    sheets = [
      { name: "ТЕКУЩИЕ", rows: all.filter((r) => !journalExcel.isArchive(r)) },
      { name: "АРХИВ", rows: all.filter(journalExcel.isArchive) },
    ];
    fileName = "Журнал регистрации.xlsx";
  }
  const buffer = await journalExcel.buildWorkbook(sheets).xlsx.writeBuffer();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition",
    `attachment; filename="journal.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  res.send(Buffer.from(buffer));
});

/* ---------------- Список дел ---------------- */

app.get("/api/cases/registry", (req, res) => {
  const today = taskDates.todayIso();
  const all = tasksNow();

  let list = Object.values(PROJECTS);
  const rule = (p, level) => folderPerms.some((r) =>
    r.user_id === USER.id && (level ? r.access === level : r.access !== "none") &&
    (p.folder_path === r.path || p.folder_path.startsWith(r.path + "/")));
  // Права те же, что и на папку дела.
  if (USER.role !== "admin") list = list.filter((p) => rule(p, null));

  const cases = list
    .map((p) => {
      const mine = all.filter((t) => t.case_id === p.id && !t.is_done);
      return {
        ...courtCase.decorateCase(p),
        open_tasks: mine.length,
        overdue_tasks: mine.filter((t) => taskDates.dueState(t, today).state === "overdue").length,
        archive_kind: p.is_cancelled ? "cancelled" : p.stage === "done" ? "done" : null,
        can_write: USER.role === "admin" || rule(p, "write"),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));

  res.json({ today, cases });
});

/**
 * Перевод дела на другую стадию — тем же адресом, что и на боевом
 * сервере. Папку в заглушке не двигаем по-настоящему, но путь дела
 * меняем: по нему проверяется, что переезд виден и в списке, и в папках.
 */
app.post("/api/cases/:id/advance", (req, res) => {
  const project = findProject(req.params.id);
  if (!project) return res.status(404).json({ message: "Проект не найден" });
  const stage = String(req.body?.stage || "");
  if (!STAGE_FOLDER[stage]) return res.status(400).json({ message: "Некорректная стадия" });

  delete PROJECTS[project.folder_path];
  project.stage = stage;
  project.folder_path = `${STAGE_FOLDER[stage]}/${project.name}`;
  PROJECTS[project.folder_path] = project;

  // Задачи дела едут вместе с ним: стадия у них берётся от проекта.
  for (const t of ALL_TASKS) if (t.case_id === project.id) t.case_stage = stage;

  res.json({ ok: true, stage });
});

app.get("/api/cases/by-path", (req, res) => {
  const project = PROJECTS[String(req.query.path || "")];
  if (!project) return res.status(404).json({ message: "нет" });
  // Сколько задач горит — это всё, что полоса в папке говорит о задачах.
  const today = taskDates.todayIso();
  const overdue = tasksNow().filter((t) =>
    t.case_id === project.id && taskDates.dueState(t, today).state === "overdue").length;
  res.json({ ...courtCase.decorateCase(project), overdue_tasks: overdue });
});

app.get("/api/organizations", (req, res) =>
  res.json([{ id: 1, name: "НИЦ" }, { id: 2, name: "Филиал" }]));

// Правка карточки проекта: тип, статус и остальные поля.
app.patch("/api/cases/:id", (req, res) => {
  const project = Object.values(PROJECTS).find((p) => p.id === Number(req.params.id));
  if (!project) return res.status(404).json({ message: "Проект не найден" });
  if (req.body?.type !== undefined) {
    const t = req.body.type === "" || req.body.type === null ? null : String(req.body.type);
    if (t !== null && !["expertise", "research"].includes(t)) {
      return res.status(400).json({ message: "Некорректный тип проекта" });
    }
    project.type = t;
  }
  for (const f of ["status", "expertise_type", "court_or_customer", "case_number",
                   "manager_id", "year", "organization", "party1", "party2",
                   "judge_name", "experts", "description"]) {
    if (req.body?.[f] !== undefined) project[f] = req.body[f];
  }
  res.json(courtCase.decorateCase(project));
});

/* ---------------- Карточка проекта ---------------- */

app.get("/api/cases/:id/card", (req, res) => {
  const project = findProject(req.params.id);
  if (!project) return res.status(404).json({ message: "Проект не найден" });

  // Право смотреть карточку — то же, что и на папку проекта.
  const canSee = USER.role === "admin" || folderPerms.some((r) =>
    r.user_id === USER.id && r.access !== "none" &&
    (project.folder_path === r.path || project.folder_path.startsWith(r.path + "/")));
  if (!canSee) return res.status(403).json({ message: "Нет доступа к этому проекту" });

  const canWrite = USER.role === "admin" || folderPerms.some((r) =>
    r.user_id === USER.id && r.access === "write" &&
    (project.folder_path === r.path || project.folder_path.startsWith(r.path + "/")));

  const today = taskDates.todayIso();
  const me = USER.planfix_user_id || null;
  const tasks = tasksNow()
    .filter((t) => t.case_id === project.id)
    // Тот же порядок, что и на боевом сервере: сначала открытые по сроку,
    // задачи без срока в конец, потом завершённые.
    .sort((a, b) => (a.is_done - b.is_done)
      || String(a.end_date || "9999").localeCompare(String(b.end_date || "9999"))
      || a.id - b.id)
    .map((t) => {
      const d = taskDates.dueState(t, today);
      return {
        ...t, due_state: d.state, due_iso: d.due, days_left: d.daysLeft,
        mine: me ? (t.assignee_ids || []).includes(me) : false,
        can_write: canWrite,
        can_remove: canWrite && (USER.role === "admin" || Number(t.assigner_id) === me),
      };
    });

  res.json({
    project: {
      ...courtCase.decorateCase(project),
      manager_name: project.manager_name || null,
      planfix_url: planfixSync.projectWebUrl(project.planfix_id),
    },
    canWrite,
    today,
    tasks,
    taskCounts: {
      open: tasks.filter((t) => !t.is_done).length,
      done: tasks.filter((t) => t.is_done).length,
      overdue: tasks.filter((t) => t.due_state === "overdue").length,
    },
    courtEvents: courtEvents.filter((e) => e.case_id === project.id).slice().reverse(),
    history: (CASE_HISTORY[project.id] || []),
    hasPlanfix: !!project.planfix_id,
    tasksSyncedAt: null,
  });
});

// История проекта: в заглушке заранее заданная, настоящую пишет сервер.
const CASE_HISTORY = {
  11: [
    { id: 1, action: "updated", note: null, created_at: "2026-08-20T10:00:00Z", actor_name: "kirill" },
    { id: 2, action: "created", note: null, created_at: "2026-08-12T09:00:00Z", actor_name: "kirill" },
  ],
};

app.get("/api/cases/:id/tasks", (req, res) => {
  const list = (PROJECT_TASKS[req.params.id] || []).filter((t) => !deletedTaskIds.includes(t.id));
  res.json({ tasks: list, syncedAt: new Date().toISOString() });
});

/* ---------------- Что установил суд ---------------- */

const STAGE_FOLDER = {
  plan: "/Дела/01.Планы",
  active: "/Дела/02.Активные проекты",
  control: "/Дела/03.Проекты на контроле",
  done: "/Дела/04.Архив/Завершенные",
};
let courtEvents = [];
let courtEventSeq = 1;
// Задачи, которые ИСУ поставила при применении решения, — тест смотрит,
// что именно ушло бы в Planfix.
let plannedTasks = [];
app.get("/__plannedtasks", (req, res) => {
  if (req.query.reset) plannedTasks = [];
  res.json({ tasks: plannedTasks });
});
app.get("/__courtevents", (req, res) => {
  if (req.query.reset) { courtEvents = []; courtEventSeq = 1; }
  res.json({ events: courtEvents });
});

function isManagerStub() { return USER.role === "admin" || !!USER.can_manage; }
function findProject(id) {
  return Object.values(PROJECTS).find((p) => p.id === Number(id)) || null;
}

app.get("/api/cases/court-outcomes", async (req, res) => {
  try {
    res.json({
      outcomes: await courtOutcomes.listOutcomes(req.query.stage || null),
      rules: courtOutcomes.RULE_KINDS,
      applies: courtOutcomes.APPLIES,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post("/api/cases/court-outcomes", async (req, res) => {
  try { res.json(await courtOutcomes.saveOutcome(req.body?.id || null, req.body, USER.id)); }
  catch (err) { res.status(400).json({ message: err.message }); }
});

app.delete("/api/cases/court-outcomes/:id", async (req, res) => {
  try {
    const ok = await courtOutcomes.removeOutcome(req.params.id);
    if (!ok) return res.status(404).json({ message: "Исход не найден" });
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

app.get("/api/cases/instruction-steps", async (req, res) => {
  try { res.json({ steps: await courtOutcomes.listSteps() }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

app.get("/api/cases/:id/court-events", (req, res) => {
  res.json({
    events: courtEvents
      .filter((e) => e.case_id === Number(req.params.id))
      .slice()
      .reverse(),
  });
});

app.post("/api/cases/:id/court-events", async (req, res) => {
  try {
    const project = findProject(req.params.id);
    if (!project) return res.status(404).json({ message: "Проект не найден" });
    const outcome = await courtOutcomes.getOutcome(req.body?.outcomeId);
    if (!outcome) return res.status(400).json({ message: "Выберите, что установил суд" });
    const eventDate = workCalendar.toIso(workCalendar.parseIso(req.body?.eventDate));
    if (!eventDate) return res.status(400).json({ message: "Укажите дату определения" });

    const input = {
      eventDate,
      hearingDate: workCalendar.toIso(workCalendar.parseIso(req.body?.hearingDate)),
      expertiseDue: workCalendar.toIso(workCalendar.parseIso(req.body?.expertiseDue)),
    };
    const plan = await courtOutcomes.buildPlan(project, outcome, input);
    const event = {
      id: courtEventSeq++, case_id: project.id, outcome_id: outcome.id,
      outcome_name: outcome.name, event_date: eventDate,
      hearing_date: input.hearingDate, expertise_due: input.expertiseDue,
      note: String(req.body?.note || "").trim() || null,
      source: "manual", plan, applied: false, applied_at: null,
      created_by_name: USER.username, applied_by_name: null,
    };
    courtEvents.push(event);
    res.status(201).json({ event, plan });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.delete("/api/cases/court-events/:id", (req, res) => {
  const event = courtEvents.find((e) => e.id === Number(req.params.id));
  if (!event) return res.status(404).json({ message: "Запись не найдена" });
  if (event.applied) {
    return res.status(409).json({
      message: "Это решение уже применено — запись удалить нельзя. Она нужна, чтобы было видно, почему проект переехал.",
    });
  }
  courtEvents = courtEvents.filter((e) => e.id !== event.id);
  res.json({ ok: true });
});

app.post("/api/cases/court-events/:id/apply", async (req, res) => {
  try {
    const event = courtEvents.find((e) => e.id === Number(req.params.id));
    if (!event) return res.status(404).json({ message: "Запись не найдена" });
    if (event.applied) return res.status(409).json({ message: "Это решение уже применено" });
    const project = findProject(event.case_id);
    if (!project) return res.status(404).json({ message: "Проект не найден" });
    const outcome = await courtOutcomes.getOutcome(event.outcome_id);
    if (!outcome) return res.status(400).json({ message: "Исход убран из справочника — применить нечего" });

    if (outcome.requires_manager && !isManagerStub()) {
      return res.status(403).json({
        message: "По инструкции это решение принимает руководитель центра. Попросите его подтвердить.",
      });
    }

    const plan = await courtOutcomes.buildPlan(project, outcome, {
      eventDate: event.event_date,
      hearingDate: event.hearing_date,
      expertiseDue: event.expertise_due,
    });
    if (plan.needsDecision) {
      return res.status(409).json({
        message: "Для этого случая инструкция не задаёт, что делать дальше — переведите проект вручную.",
      });
    }

    const done = [];
    if (plan.cancel) {
      // Папку в заглушке не двигаем — проверяем состояние проекта.
      delete PROJECTS[project.folder_path];
      project.is_cancelled = true;
      project.stage = "done";
      project.folder_path = "/Дела/04.Архив/Отмененные/" + project.name;
      PROJECTS[project.folder_path] = project;
      done.push("Проект отменён, папка перенесена в «04. Архив / Отмененные».");
    } else if (plan.targetStage) {
      delete PROJECTS[project.folder_path];
      project.stage = plan.targetStage;
      project.status = plan.targetStatus || "waiting";
      project.folder_path = `${STAGE_FOLDER[plan.targetStage]}/${project.name}`;
      PROJECTS[project.folder_path] = project;
      done.push(`Проект переведён на стадию «${courtOutcomes.STAGE_LABEL[plan.targetStage]}», папка перенесена.`);
    } else if (plan.targetStatus) {
      project.status = plan.targetStatus;
      done.push(`Статус изменён на «${courtOutcomes.STATUS_LABEL[plan.targetStatus]}».`);
    }

    const taskResults = [];
    if (plan.tasks.length && project.planfix_id) {
      for (const t of plan.tasks) {
        plannedTasks.push({ project: project.name, name: t.name, due: t.due });
        taskResults.push({ name: t.name, ok: true });
      }
      done.push(`Поставлено задач: ${taskResults.length}.`);
    } else if (plan.tasks.length) {
      done.push("Задачи не поставлены: у проекта ещё нет карточки в Planfix.");
    }

    event.applied = true;
    event.applied_at = new Date().toISOString();
    event.applied_by_name = USER.username;
    event.plan = plan;
    res.json({ ok: true, done, tasks: taskResults, plan });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ---------------- Производственный календарь ---------------- */

app.get("/api/cases/work-calendar", async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    res.json({
      year,
      days: await workCalendar.listCalendar(year),
      years: await workCalendar.knownYears(),
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post("/api/cases/work-calendar", async (req, res) => {
  if (!isManagerStub()) {
    return res.status(403).json({
      message: "Производственный календарь ведёт администратор или руководитель центра.",
    });
  }
  try { res.json(await workCalendar.setDay(req.body?.day, req.body?.kind, req.body?.note, USER.id)); }
  catch (err) { res.status(400).json({ message: err.message }); }
});

app.delete("/api/cases/work-calendar/:day", async (req, res) => {
  if (!isManagerStub()) {
    return res.status(403).json({
      message: "Производственный календарь ведёт администратор или руководитель центра.",
    });
  }
  try {
    const ok = await workCalendar.removeDay(req.params.day);
    if (!ok) return res.status(404).json({ message: "Такой отметки в календаре нет" });
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

let lastSyncCalls = 0;
app.get("/__synccalls", (req, res) => { if (req.query.reset) lastSyncCalls = 0; res.json({ lastSyncCalls }); });
app.post("/api/cases/planfix/sync", (req, res) => {
  if (USER.role !== "admin") return res.status(403).json({ message: "Доступ запрещён" });
  lastSyncCalls++;
  res.json({
    ok: true,
    report: {
      projectsSeen: 9, tasksSeen: 5, tasksSynced: 3, foldersCreated: 4, unchanged: 1,
      created: [{ name: "ЭКС.Новый" }], adopted: [], updated: [{ name: "НИ.Аммиак", changes: ["номер договора"] }],
      skipped: [{ name: "Просто папка", why: "не понятен тип" }], errors: [],
    },
  });
});
/* --- страница задач ---
   Исполнители и постановщик теперь ещё и числами: страница опирается на
   связь аккаунта ИСУ с сотрудником Planfix, а не на совпадение имён. */
const PF_PEOPLE = [
  { id: 9, name: "Кирилл Базаев", email: "kb@example.org", is_active: true },
  { id: 14, name: "Павел Челышков", email: null, is_active: true },
  { id: 21, name: "анна", email: null, is_active: true },
];
const BASE_TASKS = [
  { id: 1, planfix_id: 913, name: "Контроль судебного процесса", is_done: false,
    assigner: "Кирилл Базаев", assignees: "Кирилл Базаев", assigner_id: 9, assignee_ids: [9],
    end_date: "2026-09-25", description: "Следить за ходом дела",
    case_id: 11, case_name: "ЭКС.Транснефть", case_type: "expertise", case_stage: "plan",
    folder_path: "/Дела/01.Планы/ЭКС.Гараж (Талдом)" },
  { id: 2, planfix_id: 871, name: "Написать ГП", is_done: false,
    assigner: "Павел Челышков", assignees: "Кирилл Базаев", assigner_id: 14, assignee_ids: [9],
    end_date: "2026-08-07",
    case_id: 11, case_name: "ЭКС.Вешних вод", case_type: "expertise", case_stage: "plan",
    folder_path: "/Дела/01.Планы/ЭКС.Гараж (Талдом)" },
  { id: 3, planfix_id: 834, name: "Отправка заключения наземная часть", is_done: false,
    assigner: "Кирилл Базаев", assignees: "Кирилл Базаев, Павел Челышков", assigner_id: 9, assignee_ids: [9, 14],
    end_date: "2026-07-17",
    case_id: 12, case_name: "НИ.Протвино", case_type: "research", case_stage: "plan",
    folder_path: "/Дела/01.Планы/НИ.Аммиак" },
  { id: 4, planfix_id: 889, name: "Подготовить ГП", is_done: true,
    assigner: "Кирилл Базаев", assignees: "анна", assigner_id: 9, assignee_ids: [21],
    end_date: "2026-08-24",
    case_id: 11, case_name: "ЭКС.Транснефть", case_type: "expertise", case_stage: "plan",
    folder_path: "/Дела/01.Планы/ЭКС.Гараж (Талдом)" },
];

/**
 * Отдельный набор задач для проверки фильтров.
 *
 * Сроки здесь считаются ОТ СЕГОДНЯШНЕГО ДНЯ, а не записаны числами: иначе
 * набор про «просрочено» и «срок сегодня» протух бы через сутки после
 * написания. Держим его отдельно от основного, чтобы не сдвинуть счётчики,
 * на которые опираются другие наборы.
 */
function shiftDays(n) {
  const d = new Date(taskDates.todayIso() + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function filterTasks() {
  return [
    { id: 101, planfix_id: 1001, name: "Просроченная экспертиза", is_done: false,
      assigner: "Кирилл Базаев", assignees: "Кирилл Базаев", assigner_id: 9, assignee_ids: [9],
      end_date: shiftDays(-3),
      case_id: 11, case_name: "ЭКС.Гараж (Талдом)", case_type: "expertise", case_stage: "plan",
      folder_path: "/Дела/01.Планы/ЭКС.Гараж (Талдом)" },
    { id: 102, planfix_id: 1002, name: "Сегодняшняя экспертиза", is_done: false,
      assigner: "Кирилл Базаев", assignees: "Павел Челышков", assigner_id: 9, assignee_ids: [14],
      end_date: shiftDays(0),
      case_id: 11, case_name: "ЭКС.Гараж (Талдом)", case_type: "expertise", case_stage: "plan",
      folder_path: "/Дела/01.Планы/ЭКС.Гараж (Талдом)" },
    { id: 103, planfix_id: 1003, name: "Исследование через три дня", is_done: false,
      assigner: "Кирилл Базаев", assignees: "Павел Челышков", assigner_id: 9, assignee_ids: [14],
      end_date: shiftDays(3),
      case_id: 13, case_name: "НИ.Барвиха", case_type: "research", case_stage: "control",
      folder_path: "/Дела/03.Проекты на контроле/НИ.Барвиха" },
    { id: 104, planfix_id: 1004, name: "Исследование через месяц", is_done: false,
      assigner: "Кирилл Базаев", assignees: "Кирилл Базаев", assigner_id: 9, assignee_ids: [9],
      end_date: shiftDays(30),
      case_id: 12, case_name: "НИ.Аммиак", case_type: "research", case_stage: "plan",
      folder_path: "/Дела/01.Планы/НИ.Аммиак" },
    // Без срока: по инструкции у части задач срока не бывает, и они не
    // должны молча пропадать из фильтров по сроку.
    { id: 105, planfix_id: 1005, name: "Получение материалов дела", is_done: false,
      assigner: "Кирилл Базаев", assignees: "Кирилл Базаев", assigner_id: 9, assignee_ids: [9],
      end_date: null,
      case_id: 13, case_name: "НИ.Барвиха", case_type: "research", case_stage: "control",
      folder_path: "/Дела/03.Проекты на контроле/НИ.Барвиха" },
    // Проект без распознанного типа — приехал из Planfix как есть.
    { id: 106, planfix_id: 1006, name: "Задача проекта без типа", is_done: false,
      assigner: "Павел Челышков", assignees: "Павел Челышков", assigner_id: 14, assignee_ids: [14],
      end_date: shiftDays(5),
      case_id: 14, case_name: "ЭКСПЕРТИЗА НИЦ", case_type: null, case_stage: "control",
      folder_path: "/Дела/03.Проекты на контроле/ЭКСПЕРТИЗА НИЦ" },
  ];
}

let ALL_TASKS = BASE_TASKS;
app.get("/__tasksfixture", (req, res) => {
  ALL_TASKS = req.query.set === "filters" ? filterTasks() : BASE_TASKS;
  completedIds = [];
  deletedTaskIds = [];
  taskPatches = [];
  res.json({ set: req.query.set === "filters" ? "filters" : "base", count: ALL_TASKS.length });
});
let completedIds = [];
let createdTasks = [];
let postedComments = [];
let taskPatches = [];
app.get("/__completed", (req, res) => { if (req.query.reset) completedIds = []; res.json({ completedIds }); });
app.get("/__taskwrites", (req, res) => {
  if (req.query.reset) { createdTasks = []; postedComments = []; taskPatches = []; }
  res.json({ createdTasks, postedComments, taskPatches });
});

function tasksNow() {
  // Номер дела в задаче не хранится: боевой сервер берёт его из проекта
  // тем же JOIN. Повторяем это здесь, чтобы номер не разъехался с карточкой.
  const numberOf = (caseId) =>
    (Object.values(PROJECTS).find((p) => p.id === caseId) || {}).case_number || null;
  return ALL_TASKS.filter((t) => !deletedTaskIds.includes(t.id)).map((t) => {
    const patch = taskPatches.filter((p) => p.id === t.id).slice(-1)[0];
    return {
      ...t, case_number: numberOf(t.case_id),
      ...(patch ? patch.body : {}), is_done: t.is_done || completedIds.includes(t.id),
    };
  });
}

app.get("/api/cases/tasks/all", (req, res) => {
  const me = USER.planfix_user_id || null;
  const all = tasksNow();
  let list = all;

  const scope = String(req.query.scope || (req.query.mine === "1" ? "mine" : "all"));
  if (scope === "mine") list = list.filter((t) => me && (t.assignee_ids || []).includes(me));
  else if (scope === "assigned") list = list.filter((t) => me && Number(t.assigner_id) === me);

  if (req.query.done === "1") list = list.filter((t) => t.is_done);
  else if (req.query.done !== "all") list = list.filter((t) => !t.is_done);

  const q = String(req.query.q || "").toLowerCase();
  if (q) list = list.filter((t) => t.name.toLowerCase().includes(q) || t.case_name.toLowerCase().includes(q));

  // Сроки считает тот же модуль, что и боевой сервер: подменять его
  // заглушкой значило бы проверять не то, что поедет на сервер.
  const today = taskDates.todayIso();

  const due = String(req.query.due || "any");
  if (taskDates.DUE_FILTERS.includes(due) && due !== "any") {
    list = list.filter((t) => taskDates.matchesDueFilter(t, due, today));
  }

  const type = String(req.query.type || "any");
  if (type === "none") list = list.filter((t) => !t.case_type);
  else if (type === "expertise" || type === "research") list = list.filter((t) => t.case_type === type);

  const stage = String(req.query.stage || "any");
  if (["plan", "active", "control", "done"].includes(stage)) {
    list = list.filter((t) => t.case_stage === stage);
  }

  const assignee = Number(req.query.assignee || 0);
  if (assignee) list = list.filter((t) => (t.assignee_ids || []).includes(assignee));

  const people = new Map();
  for (const t of all) {
    const names = String(t.assignees || "").split(",").map((s) => s.trim());
    (t.assignee_ids || []).forEach((id, i) => {
      if (id && !people.has(id)) people.set(id, names[i] || `Сотрудник ${id}`);
    });
  }

  res.json({
    // Право на правку приходит с каждой задачей: интерфейс по нему
    // решает, показывать ли удаление.
    tasks: list.map((t) => {
      const d = taskDates.dueState(t, today);
      const canWrite = USER.role === "admin" || USER.can_cases;
      return {
        ...t,
        can_write: canWrite,
        // Убрать задачу может тот, кто её поставил, и администратор.
        can_remove: canWrite && (USER.role === "admin" || Number(t.assigner_id) === me),
        due_state: d.state, due_iso: d.due, days_left: d.daysLeft,
      };
    }),
    total: list.length,
    today,
    facets: {
      assignees: [...people.entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name, "ru")),
    },
    me: me ? { planfixUserId: me, name: USER.planfix_name } : null,
    needsBinding: !me,
    counts: {
      open: all.filter((t) => !t.is_done).length,
      done: all.filter((t) => t.is_done).length,
      overdue: all.filter((t) => taskDates.dueState(t, today).state === "overdue").length,
      mine: me ? all.filter((t) => !t.is_done && (t.assignee_ids || []).includes(me)).length : 0,
      assigned: me ? all.filter((t) => !t.is_done && Number(t.assigner_id) === me).length : 0,
    },
  });
});

app.get("/api/cases/planfix/people", (req, res) =>
  res.json({ people: PF_PEOPLE.filter((p) => p.is_active), syncedAt: "2026-08-30T10:00:00Z" }));

app.get("/api/cases/tasks/:id", (req, res) => {
  const task = tasksNow().find((t) => t.id === Number(req.params.id));
  if (!task) return res.status(404).json({ message: "Задача не найдена" });
  const comments = [
    { id: 1, text: "Материалы получены", author: "Павел Челышков", at: "29.08.2026 10:12" },
    ...postedComments.filter((c) => c.id === task.id)
      .map((c, i) => ({ id: 100 + i, text: c.text, author: "Кирилл Базаев", at: "31.08.2026 09:00" })),
  ];
  res.json({
    task: { ...task, mine: (task.assignee_ids || []).includes(USER.planfix_user_id) },
    comments,
    commentsError: null,
    canWrite: USER.role === "admin" || USER.can_cases,
  });
});

app.post("/api/cases/tasks", (req, res) => {
  if (!USER.planfix_user_id) {
    return res.status(409).json({
      message: "Ваш аккаунт не связан с сотрудником Planfix, поэтому задачу нельзя поставить от вашего имени.",
      needsBinding: true,
    });
  }
  const names = (Array.isArray(req.body?.names) ? req.body.names : [req.body?.name])
    .map((n) => String(n || "").trim()).filter(Boolean);
  createdTasks.push({ ...req.body, names });
  // "Провалить" задачу можно по названию — так тест проверяет частичный отказ.
  const results = names.map((name, i) => /провал/i.test(name)
    ? { name, ok: false, error: "нет прав" }
    : { name, ok: true, planfixTaskId: 900 + i, authorApplied: true });
  const failed = results.filter((r) => !r.ok);
  res.status(failed.length === results.length ? 502 : 200).json({
    ok: !failed.length, results, created: results.length - failed.length, authorApplied: true,
    message: failed.length
      ? `Не удалось поставить: ${failed.map((f) => `«${f.name}» (${f.error})`).join("; ")}` : undefined,
  });
});

/* --- справочник типовых задач по стадиям (общий для окна и папки) --- */
let STAGE_TASKS = {
  plan: [{ id: 1, name: "Принять решение об участии" }, { id: 2, name: "Подготовить ГП" }],
  active: [{ id: 3, name: "Выехать на осмотр" }],
  control: [{ id: 4, name: "Контроль судебного процесса" }, { id: 5, name: "Отправка заключения" }],
};
let stageTaskSeq = 100;
app.get("/__stagetasks", (req, res) => {
  if (req.query.reset) {
    STAGE_TASKS = {
      plan: [{ id: 1, name: "Принять решение об участии" }, { id: 2, name: "Подготовить ГП" }],
      active: [{ id: 3, name: "Выехать на осмотр" }],
      control: [{ id: 4, name: "Контроль судебного процесса" }, { id: 5, name: "Отправка заключения" }],
    };
  }
  res.json(STAGE_TASKS);
});
app.delete("/api/cases/planfix/stage-tasks/:id", (req, res) => {
  if (USER.role !== "admin") return res.status(403).json({ message: "Требуются права администратора" });
  const id = Number(req.params.id);
  let found = false;
  for (const stage of Object.keys(STAGE_TASKS)) {
    const before = STAGE_TASKS[stage].length;
    STAGE_TASKS[stage] = STAGE_TASKS[stage].filter((t) => t.id !== id);
    if (STAGE_TASKS[stage].length < before) found = true;
  }
  if (!found) return res.status(404).json({ message: "Задача не найдена" });
  res.json({ ok: true });
});

app.get("/api/cases/planfix/stage-tasks/:stage", (req, res) => {
  const stage = req.params.stage;
  if (!["plan", "active", "control"].includes(stage)) {
    return res.json({ tasks: [], stage, supported: false });
  }
  res.json({ tasks: STAGE_TASKS[stage] || [], stage, supported: true });
});
app.post("/api/cases/planfix/stage-tasks", (req, res) => {
  const stage = req.body?.stage;
  const name = String(req.body?.name || "").trim();
  if (!["plan", "active", "control"].includes(stage)) {
    return res.status(400).json({ message: "Некорректная стадия" });
  }
  if (!name) return res.status(400).json({ message: "Укажите название задачи" });
  const list = STAGE_TASKS[stage] || (STAGE_TASKS[stage] = []);
  if (list.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
    return res.status(409).json({ message: "Такая задача уже есть в списке для этой стадии" });
  }
  const row = { id: ++stageTaskSeq, name };
  list.push(row);
  res.status(201).json(row);
});

app.patch("/api/cases/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  const body = { ...req.body };
  if (body.assigneeIds) {
    body.assignee_ids = body.assigneeIds;
    body.assignees = body.assigneeIds
      .map((x) => (PF_PEOPLE.find((p) => p.id === Number(x)) || {}).name).filter(Boolean).join(", ");
  }
  if (body.deadline !== undefined) body.end_date = body.deadline;
  taskPatches.push({ id, body });
  res.json({ ok: true });
});

let deletedTaskIds = [];
app.get("/__deletedtasks", (req, res) => {
  if (req.query.reset) deletedTaskIds = [];
  res.json({ deletedTaskIds });
});
app.delete("/api/cases/tasks/:id", (req, res) => {
  const id = Number(req.params.id);
  // Задачу 3 Planfix «не отдаёт» — так проверяется, что при отказе она
  // остаётся на месте, а человек видит причину.
  if (id === 3) return res.status(502).json({ message: "Planfix не дал отменить задачу: нет прав" });
  const task = ALL_TASKS.find((t) => t.id === id);
  if (!task) return res.status(404).json({ message: "Задача не найдена" });
  // Убрать задачу может только тот, кто её поставил, и администратор —
  // то же правило, что и на боевом сервере.
  const me = USER.planfix_user_id || null;
  if (USER.role !== "admin" && Number(task.assigner_id) !== me) {
    return res.status(403).json({
      message: "Убрать задачу может только тот, кто её поставил. " +
        "Эту задачу поставил " + (task.assigner || "другой сотрудник") + ".",
    });
  }
  if (!deletedTaskIds.includes(id)) deletedTaskIds.push(id);
  res.json({ ok: true, name: task.name });
});

app.post("/api/cases/tasks/:id/comment", (req, res) => {
  postedComments.push({ id: Number(req.params.id), text: String(req.body?.text || "") });
  res.json({ ok: true, authorApplied: true });
});

/* --- привязка аккаунтов ИСУ к сотрудникам Planfix (админ) --- */
const ISU_USERS = [
  { id: 1, username: "kirill", role: "admin", planfix_user_id: null, legacy_name: "Кирилл Базаев" },
  { id: 2, username: "pavel", role: "user", planfix_user_id: 14, planfix_bound_at: "2026-08-30T12:00:00Z" },
  { id: 3, username: "anna", role: "user", planfix_user_id: null, legacy_name: null },
];
function bindingsPayload() {
  return {
    bindings: ISU_USERS.map((u) => {
      const p = PF_PEOPLE.find((x) => x.id === Number(u.planfix_user_id));
      return { ...u, planfix_name: p ? p.name : null, planfix_active: p ? p.is_active : null,
               bound_by_name: u.planfix_user_id ? "kirill" : null };
    }),
    people: PF_PEOPLE.filter((p) => p.is_active),
    syncedAt: "2026-08-30T10:00:00Z",
  };
}
app.get("/api/cases/planfix/bindings", (req, res) => {
  if (USER.role !== "admin") return res.status(403).json({ message: "Требуются права администратора" });
  res.json(bindingsPayload());
});
app.post("/api/cases/planfix/bindings/:userId", (req, res) => {
  if (USER.role !== "admin") return res.status(403).json({ message: "Требуются права администратора" });
  const target = req.body?.planfixUserId ? Number(req.body.planfixUserId) : null;
  const user = ISU_USERS.find((u) => u.id === Number(req.params.userId));
  if (!user) return res.status(404).json({ message: "Пользователь не найден" });
  const taken = ISU_USERS.find((u) => u.id !== user.id && Number(u.planfix_user_id) === target);
  if (target && taken) {
    const person = PF_PEOPLE.find((p) => p.id === target);
    return res.status(400).json({
      message: `Сотрудник «${person.name}» уже привязан к пользователю «${taken.username}». Сначала снимите ту привязку.`,
    });
  }
  user.planfix_user_id = target;
  user.planfix_bound_at = target ? new Date().toISOString() : null;
  if (user.id === USER.id) {
    USER.planfix_user_id = target;
    USER.planfix_name = target ? (PF_PEOPLE.find((p) => p.id === target) || {}).name : null;
  }
  res.json({
    ok: true, bound: !!target,
    planfixUserId: target,
    planfixName: target ? (PF_PEOPLE.find((p) => p.id === target) || {}).name : null,
    ...bindingsPayload(),
  });
});
app.post("/api/cases/planfix/people/sync", (req, res) => {
  if (USER.role !== "admin") return res.status(403).json({ message: "Требуются права администратора" });
  res.json({ ok: true, total: PF_PEOPLE.length, deactivated: 0, adopted: 1, ...bindingsPayload() });
});

app.post("/api/cases/tasks/:id/complete", (req, res) => {
  const id = Number(req.params.id);
  if (id === 3) return res.status(502).json({ message: "Planfix не принял завершение задачи: нет прав" });
  if (!completedIds.includes(id)) completedIds.push(id);
  res.json({ ok: true });
});

app.get("/api/cases/planfix/sync-status", (req, res) => res.json({
  last: { id: 7, started_at: "2026-08-28T09:00:00Z", finished_at: "2026-08-28T09:01:00Z", trigger: "schedule", ok: true,
    report: { created: [{ name: "ЭКС.Старый" }], adopted: [], updated: [], skipped: [], errors: [], foldersCreated: 8, tasksSynced: 5 } },
}));

app.get("/api/cases/planfix/probe", (req, res) => {
  if (USER.role !== "admin") return res.status(403).json({ message: "Доступ запрещён" });
  res.json({
    projectsSampled: 60, tasksSampled: 40, projectsWithValues: 58,
    expertiseFieldConfigured: 76020,
    catalogueSource: "/project/fields",
    catalogueTried: [],
    fieldMapping: [
      { need: "Этап проекта", id: 76010 },
      { need: "Статус проекта", id: 76040 },
      { need: "Структура", id: 76014 },
      { need: "Номер договора / дела", id: 76006 },
      { need: "Тип экспертизы", id: 76020 },
    ],
    groups: [
      { id: 2642, name: "Экспертизы", count: 41, mappedTo: "expertise", example: "ЭКС.Транснефть" },
      { id: 2644, name: "Независимые исследования", count: 17, mappedTo: "research", example: "НИ.Аммиак" },
      { id: 2650, name: "Управление и развитие", count: 2, mappedTo: null, example: "Регламенты" },
    ],
    fields: [
      { id: 76006, name: "Номер договора / Номер дела", sample: "А40-124224/2024", usedBy: 30 },
      { id: 76010, name: "Этап проекта", sample: "Контроль", usedBy: 60 },
      { id: 76014, name: "Структура", sample: 'АО "НИЦ Строительство"', usedBy: 60 },
      { id: 76020, name: "Тип экспертизы", sample: "Строительно-техническая", usedBy: 44 },
      { id: 76040, name: "Статус проекта", sample: "Ожидание", usedBy: 60 },
    ],
    taskStatuses: [
      { name: "Новая", id: 1, count: 18, treatedAsDone: false },
      { name: "В работе", id: 2, count: 14, treatedAsDone: false },
      { name: "Завершенная", id: 3, count: 8, treatedAsDone: true },
    ],
  });
});

app.get("/api/resources", (req, res) => {
  try {
    if (!loggedIn) return res.status(401).json({ message: "unauthorized" });
    // Имитация закрытой папки, чтобы проверить сообщение о правах.
    if (String(req.query.path || "").includes("Закрытая")) {
      return res.status(403).json({ message: "Нет доступа к этой папке" });
    }
    const abs = safeResolve(req.query.path);
    const names = fs.existsSync(abs) ? fs.readdirSync(abs) : [];
    const folders = [], files = [];
    for (const n of names) {
      const st = fs.statSync(path.join(abs, n));
      if (st.isDirectory()) folders.push({ name: n, mtime: st.mtimeMs });
      else files.push({ name: n, size: st.size, mtime: st.mtimeMs });
    }
    // У сотрудника внутри "Дела" видно только то, на что выдано правило —
    // как на боевом сервере.
    const p = String(req.query.path || "/");
    if (USER.role !== "admin" && (p === "/Дела" || p.startsWith("/Дела/"))) {
      const ok = (name) => folderPerms.some((r) =>
        r.user_id === USER.id && r.access !== "none" &&
        (r.path === p + "/" + name || (p + "/" + name).startsWith(r.path + "/") || r.path === p));
      return res.json({ folders: folders.filter((f) => ok(f.name)), files: files.filter((f) => ok(f.name)) });
    }
    res.json({ folders, files });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

let inFlight = 0, maxInFlight = 0;
app.get("/__stats", (req, res) => res.json({ maxInFlight }));
app.post("/api/upload", upload.single("file"), (req, res) => {
  inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
  const delay = Number(process.env.UPLOAD_DELAY || 0);
  const finish = () => { inFlight--; };
  try {
    if (!req.file) return res.status(400).json({ message: "Файл не получен" });
    const targetDir = safeResolve(req.body.path || "/");
    fs.mkdirSync(targetDir, { recursive: true });
    const fixedName = Buffer.from(req.file.originalname, "latin1").toString("utf8");
    const rel = req.body.relativePath ? sanitizeRelativePath(req.body.relativePath) : "";
    const destPath = path.join(targetDir, rel || fixedName);
    if (destPath !== targetDir && !destPath.startsWith(targetDir + path.sep)) throw new Error("Недопустимый путь файла");
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(req.file.path, destPath);
    fs.unlinkSync(req.file.path);
    const relDest = (req.body.path || "/").replace(/\/+$/, "") + "/" + (rel || fixedName).split(path.sep).join("/");
    events.log(CURRENT_USER, "upload", { path: relDest, name: path.basename(destPath) });
    setTimeout(() => { finish(); res.json({ ok: true }); }, delay);
  } catch (err) {
    finish();
    res.status(400).json({ message: err.message });
  }
});

let lastZipRequest = null;
app.get("/__lastzip", (req, res) => res.json(lastZipRequest || {}));
// Повторяет поведение боевого сервера: принимает paths и из JSON, и из
// формы, имя архива отдаёт заголовком.
const filesLib = require("/home/claude/fm/src/files.js");
app.post("/api/download-zip", (req, res) => {
  let paths = (req.body && req.body.paths) || [];
  if (typeof paths === "string") { try { paths = JSON.parse(paths); } catch (e) { paths = []; } }
  if (!Array.isArray(paths)) paths = [];
  lastZipRequest = { paths };
  if (String(paths[0] || "").includes("Закрытая")) {
    return res.status(403).json({ message: "Нет доступа к одному из выбранных элементов" });
  }
  if (req.body && (req.body.dryRun === true || req.body.dryRun === "true")) {
    return res.json({ ok: true });
  }
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", filesLib.zipContentDisposition(paths));
  res.send(Buffer.from("PK\x05\x06" + "\0".repeat(18), "binary"));
});

app.get("/__dlget", (req, res) => {
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", filesLib.zipContentDisposition(["/x/Оборудование"]));
  res.send(Buffer.from("PK\x05\x06" + "\0".repeat(18), "binary"));
});

/* --- корзина: настоящие обработчики --- */
const CURRENT_USER = { id: 1, role: "admin", username: "kirill" };

app.delete("/api/resources", async (req, res) => {
  try {
    await trash.moveToTrash(req.query.path, CURRENT_USER.id);
    events.log(CURRENT_USER, "delete", { path: req.query.path });
    // Имитируем ответ боевого сервера: если удалили папку проекта,
    // он сообщает, какие проекты ушли из выбора.
    const project = PROJECTS[String(req.query.path || "")];
    res.json({ ok: true, closedCases: project ? [project.name] : [] });
  } catch (err) {
    res.status(400).json({ message: "Не удалось удалить: " + err.message });
  }
});

app.get("/api/events", async (req, res) => {
  try {
    res.json({ items: await events.list(CURRENT_USER, { action: req.query.action, actorId: req.query.actorId }) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});
app.get("/api/events/actors", async (req, res) => {
  try { res.json({ actors: await events.listActors() }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
// Очистка истории — как на боевом сервере, только для администратора и
// на настоящей таблице: так проверяется и запрет, и сам результат.
app.post("/api/events/clear", async (req, res) => {
  if (USER.role !== "admin") return res.status(403).json({ message: "Требуются права администратора" });
  try {
    const { rowCount } = await db.query("DELETE FROM fm_events");
    res.json({ ok: true, removed: rowCount });
  } catch (err) { res.status(500).json({ message: err.message }); }
});
app.get("/api/recent", async (req, res) => {
  try { res.json({ items: await events.recent(CURRENT_USER, { column: req.query.column }) }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

app.get("/api/trash", async (req, res) => {
  try {
    const items = await trash.listTrash(CURRENT_USER);
    res.json({ items, retentionDays: trash.RETENTION_DAYS });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/trash/:id/restore", async (req, res) => {
  try {
    const restored = await trash.restore(req.params.id, CURRENT_USER);
    events.log(CURRENT_USER, "restore", { path: restored.path, name: restored.name });
    res.json({ ok: true, ...restored });
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message });
  }
});

app.delete("/api/trash/:id", async (req, res) => {
  try {
    await trash.purge(req.params.id, CURRENT_USER);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message });
  }
});

app.post("/api/trash/empty", async (req, res) => {
  try {
    res.json({ ok: true, removed: await trash.empty(CURRENT_USER) });
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message });
  }
});

app.use(express.static(WEB));
app.listen(3999, () => console.log("stub on 3999, root=" + ROOT));
