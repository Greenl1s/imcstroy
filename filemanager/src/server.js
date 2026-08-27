const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { ZipArchive } = require("archiver");

const auth = require("./auth");
const db = require("./db");
const filesLib = require("./files");
const onlyoffice = require("./onlyoffice");
const tools = require("./tools");
const users = require("./users");
const fileLink = require("./fileLink");
const folderAccess = require("./folderAccess");
const folderPermissions = require("./folderPermissions");
const gpGenerate = require("./gpGenerate");
const { cases: caseRoutes } = require("./cases");
const { organizations: organizationRoutes } = require("./organizations");
const trash = require("./trash");
const { columnForPath, requireColumnAccess, requireToolsAccess } = require("./permissions");

const app = express();

// "Учёт оборудования" (другой поддомен) должен уметь загружать файлы сюда
// напрямую из браузера (например, массовая выгрузка QR-кодов) — для этого
// нужен CORS с credentials, чтобы прошла общая cookie SSO.
const SSO_DOMAIN = process.env.SSO_COOKIE_DOMAIN;
if (!SSO_DOMAIN) {
  // Раньше при незаданной переменной разрешался ЛЮБОЙ источник вместе с
  // cookie — то есть посторонний сайт мог дёргать наш API от имени
  // вошедшего сотрудника. Теперь в этом случае кросс-доменные запросы
  // просто запрещены (сам сайт продолжает работать как обычно).
  console.warn("SSO_COOKIE_DOMAIN не задана — кросс-доменные запросы к API запрещены");
}
app.use(cors({
  origin: SSO_DOMAIN ? [`https://${SSO_DOMAIN}`, `https://files.${SSO_DOMAIN}`] : false,
  credentials: true,
}));

// За Caddy: настоящий адрес клиента приходит в X-Forwarded-For.
// Нужен для ограничения попыток входа — иначе все запросы выглядят
// как приходящие с одного адреса самого прокси.
// Именно 1, а не true: доверяем ровно одному прокси — нашему Caddy.
// При true подошёл бы и заголовок, подделанный самим клиентом, и защиту
// от перебора можно было бы обойти, подставляя случайные адреса.
app.set("trust proxy", 1);

app.use(express.json());
// Скачивание архива запускается обычной формой (см. web/app.js): так
// браузер сам сохраняет файл и берёт имя из Content-Disposition —
// иначе кириллица в названии архива теряется.
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

const WEB_ROOT = path.join(__dirname, "..", "web");
app.use(express.static(WEB_ROOT));

// Папка для временных файлов при загрузке. Создаём заранее явно —
// иначе multer может упасть с ENOENT, если папки ещё нет в контейнере.
const UPLOAD_TMP_DIR = "/tmp/fm-uploads";
fs.mkdirSync(UPLOAD_TMP_DIR, { recursive: true });
// Ограничение размера файла: без него любой вошедший мог занять весь диск
// одним запросом. По умолчанию 512 МБ, меняется переменной MAX_UPLOAD_MB.
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 512);
const upload = multer({
  dest: UPLOAD_TMP_DIR,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
});

// Временный файл multer удаляем в любом случае — в том числе когда запрос
// отклонён проверкой прав. Раньше такие файлы навсегда оставались в /tmp.
function cleanupTempUpload(req, res, next) {
  res.on("finish", () => {
    const leftovers = [];
    if (req.file && req.file.path) leftovers.push(req.file.path);
    for (const f of req.files || []) if (f && f.path) leftovers.push(f.path);
    for (const p of leftovers) fs.promises.unlink(p).catch(() => {});
  });
  next();
}

// Отдельные корневые папки для колонок "База данных" и "Дела",
// чтобы они не показывали одно и то же содержимое.
const COLUMN_ROOTS = ["/База данных", "/Дела"];
for (const rel of COLUMN_ROOTS) {
  fs.mkdirSync(filesLib.safeResolve(rel), { recursive: true });
}

/* ---------------- Auth ---------------- */

// Простая защита от перебора паролей: считаем неудачные попытки по
// связке "адрес + логин". Хранится в памяти процесса — контейнер один,
// внешнего хранилища ради этого заводить не нужно.
const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginAttempts = new Map();

function loginKey(req, username) {
  return `${req.ip}|${String(username || "").toLowerCase()}`;
}

function loginBlockedFor(key) {
  const entry = loginAttempts.get(key);
  if (!entry) return 0;
  if (Date.now() - entry.first > LOGIN_WINDOW_MS) {
    loginAttempts.delete(key);
    return 0;
  }
  if (entry.count < LOGIN_MAX_ATTEMPTS) return 0;
  return LOGIN_WINDOW_MS - (Date.now() - entry.first);
}

function noteFailedLogin(key) {
  const entry = loginAttempts.get(key);
  if (!entry || Date.now() - entry.first > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, first: Date.now() });
    return;
  }
  entry.count++;
}

// Чтобы список не рос бесконечно, раз в час выкидываем просроченные записи.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of loginAttempts) {
    if (now - entry.first > LOGIN_WINDOW_MS) loginAttempts.delete(key);
  }
}, 60 * 60 * 1000).unref();

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: "Введите логин и пароль" });
    }

    const key = loginKey(req, username);
    const blockedMs = loginBlockedFor(key);
    if (blockedMs > 0) {
      const minutes = Math.ceil(blockedMs / 60000);
      res.setHeader("Retry-After", Math.ceil(blockedMs / 1000));
      return res.status(429).json({
        message: `Слишком много попыток входа. Попробуйте через ${minutes} мин.`,
      });
    }

    const user = await auth.verifyLogin(username, password);
    if (!user) {
      noteFailedLogin(key);
      return res.status(401).json({ message: "Неверный логин или пароль" });
    }
    loginAttempts.delete(key);

    const token = auth.issueToken(user);
    auth.setAuthCookie(res, token);
    const perms = await auth.getPermissions(user.id);

    res.json({
      user: {
        username: user.username,
        role: user.role,
        can_tools: perms.can_tools,
        can_db: perms.can_db,
        can_cases: perms.can_cases,
      },
    });
  } catch (err) {
    console.error("Ошибка входа:", err);
    res.status(500).json({ message: "Внутренняя ошибка сервера, попробуйте позже" });
  }
});

app.post("/api/auth/logout", (req, res) => {
  auth.clearAuthCookie(res);
  res.json({ ok: true });
});

app.get("/api/auth/me", auth.requireAuth, (req, res) => {
  res.json({
    user: {
      username: req.user.username,
      role: req.user.role,
      can_tools: req.user.can_tools,
      can_db: req.user.can_db,
      can_cases: req.user.can_cases,
    },
  });
});

/* ---------------- Инструменты (ссылки) ---------------- */

app.get("/api/tools", auth.requireAuth, requireToolsAccess, async (req, res) => {
  try {
    const links = await tools.listLinks();
    res.json({ links });
  } catch (err) {
    console.error("Не удалось получить ссылки:", err);
    res.status(500).json({ message: "Не удалось получить ссылки" });
  }
});

app.post("/api/tools", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const { label, url } = req.body || {};
    if (!label || !url) {
      return res.status(400).json({ message: "Укажите название и адрес ссылки" });
    }
    const link = await tools.addLink(label, url);
    res.json({ link });
  } catch (err) {
    console.error("Не удалось добавить ссылку:", err);
    res.status(500).json({ message: "Не удалось добавить ссылку" });
  }
});

app.delete("/api/tools/:id", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    await tools.removeLink(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error("Не удалось удалить ссылку:", err);
    res.status(500).json({ message: "Не удалось удалить ссылку" });
  }
});

/* ---------------- Персональный доступ к папкам/файлам в "Дела" (только администратор) ---------------- */

app.get("/api/folder-permissions", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const path = req.query.path;
    if (!path) return res.status(400).json({ message: "Не указан путь" });
    const permissions = await folderPermissions.listForPath(path);
    res.json({ permissions });
  } catch (err) {
    console.error("Не удалось получить список прав доступа:", err);
    res.status(500).json({ message: "Не удалось получить список прав доступа" });
  }
});

app.post("/api/folder-permissions", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const { path, userId, access } = req.body || {};
    if (!path || !userId || !["read", "write", "none"].includes(access)) {
      return res.status(400).json({ message: "Укажите папку, пользователя и уровень доступа" });
    }
    const permission = await folderPermissions.setPermission(path, userId, access);
    res.json({ permission });
  } catch (err) {
    console.error("Не удалось сохранить право доступа:", err);
    res.status(500).json({ message: "Не удалось сохранить право доступа" });
  }
});

app.delete("/api/folder-permissions/:id", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    await folderPermissions.removePermission(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error("Не удалось удалить право доступа:", err);
    res.status(500).json({ message: "Не удалось удалить право доступа" });
  }
});

/* ---------------- Проекты (экспертизы и НИ) ---------------- */

app.use("/api/cases", caseRoutes);
app.use("/api/organizations", organizationRoutes);

/* ---------------- Пользователи и права доступа (только администратор) ---------------- */

app.get("/api/users", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    res.json({ users: await users.listUsers() });
  } catch (err) {
    console.error("Не удалось получить список пользователей:", err);
    res.status(500).json({ message: "Не удалось получить список пользователей" });
  }
});

/** Место на диске сервера — для виджета в боковой панели. Доступно любому вошедшему. */
app.get("/api/disk-usage", auth.requireAuth, async (req, res) => {
  try {
    const stats = await fs.promises.statfs(filesLib.DATA_ROOT);
    const total = stats.blocks * stats.bsize;
    const free = stats.bavail * stats.bsize;
    const used = total - free;
    const trashBytes = await trash.usedBytes().catch(() => 0);
    res.json({
      total, free, used,
      percentUsed: total > 0 ? Math.round((used / total) * 100) : 0,
      trashBytes,
    });
  } catch (err) {
    console.error("Не удалось получить сведения о месте на диске:", err);
    res.status(500).json({ message: "Не удалось получить сведения о месте на диске" });
  }
});

app.post("/api/users", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const { username, password, role, can_tools, can_db, can_cases } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: "Укажите логин и пароль" });
    }
    const user = await users.createUser({ username, password, role, can_tools, can_db, can_cases });
    res.json({ user });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({ message: "Пользователь с таким логином уже существует" });
    }
    console.error("Не удалось создать пользователя:", err);
    res.status(500).json({ message: "Не удалось создать пользователя" });
  }
});

app.patch("/api/users/:id", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    await users.updateUser(req.params.id, req.body || {});
    res.json({ ok: true });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({ message: "Пользователь с таким логином уже существует" });
    }
    console.error("Не удалось обновить пользователя:", err);
    res.status(500).json({ message: "Не удалось обновить пользователя" });
  }
});

app.delete("/api/users/:id", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    if (String(req.user.id) === String(req.params.id)) {
      return res.status(400).json({ message: "Нельзя удалить самого себя" });
    }
    const target = await users.getUser(req.params.id);
    if (!target) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }
    if (target.role === "admin") {
      const adminCount = await users.countAdmins();
      if (adminCount <= 1) {
        return res.status(400).json({ message: "Нельзя удалить последнего администратора" });
      }
    }
    await users.deleteUser(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error("Не удалось удалить пользователя:", err);
    res.status(500).json({ message: "Не удалось удалить пользователя" });
  }
});

/* ---------------- Гарантийные письма (ГП) ---------------- */

const EXPERTS_DIR = "/База данных/Эксперты";
// У каждого эксперта — своя папка, а сведения для ГП берутся из одного
// файла с фиксированным именем внутри неё. Остальное (фото, сертификаты
// и т.д.) можно класть туда же свободно — система их не трогает.
const EXPERT_INFO_FILENAME = "Сведения.docx";

app.get("/api/experts", auth.requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin" && !req.user.can_db) {
      return res.status(403).json({ message: "Нет доступа к этому разделу" });
    }
    const dirAbs = filesLib.safeResolve(EXPERTS_DIR);
    let entries;
    try {
      entries = await fs.promises.readdir(dirAbs, { withFileTypes: true });
    } catch (err) {
      return res.json({ experts: [] }); // папки с экспертами ещё нет — просто пустой список
    }

    const experts = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const infoAbs = path.join(dirAbs, entry.name, EXPERT_INFO_FILENAME);
      try {
        await fs.promises.access(infoAbs);
      } catch {
        continue; // в папке эксперта нет "Сведения.docx" — пока нечего выбрать, пропускаем
      }
      experts.push({ name: entry.name, path: EXPERTS_DIR + "/" + entry.name });
    }
    experts.sort((a, b) => a.name.localeCompare(b.name, "ru"));
    res.json({ experts });
  } catch (err) {
    console.error("Не удалось получить список экспертов:", err);
    res.status(500).json({ message: "Не удалось получить список экспертов" });
  }
});

app.post("/api/gp/generate", auth.requireAuth, async (req, res) => {
  try {
    const body = req.body || {};

    // ГП теперь всегда привязано к конкретному проекту — сохраняется
    // прямо в его "Планирование проекта/ГП", а не в общую фиксированную папку.
    const caseId = Number(body.caseId);
    if (!caseId) {
      return res.status(400).json({ message: "Выберите проект, к которому относится ГП" });
    }
    const { rows: caseRows } = await db.query("SELECT * FROM cases WHERE id = $1", [caseId]);
    if (!caseRows.length) {
      return res.status(404).json({ message: "Проект не найден" });
    }
    const kase = caseRows[0];
    const gpOutputDir = `${kase.folder_path}/Планирование проекта/ГП`;

    if (req.user.role !== "admin") {
      if (!req.user.can_cases) {
        return res.status(403).json({ message: "Нет доступа к этому разделу" });
      }
      const rules = await folderAccess.getUserRules(req.user.id);
      if (folderAccess.resolveAccess(rules, kase.folder_path) !== "write") {
        return res.status(403).json({ message: "Нет прав на создание файлов в этом проекте" });
      }
    }

    const questions = Array.isArray(body.questions) ? body.questions.map((q) => String(q || "").trim()).filter(Boolean) : [];
    const expertPaths = Array.isArray(body.expertPaths) ? body.expertPaths : [];

    if (!questions.length) {
      return res.status(400).json({ message: "Добавьте хотя бы один вопрос экспертизы" });
    }
    if (!expertPaths.length) {
      return res.status(400).json({ message: "Выберите хотя бы одного эксперта" });
    }

    const experts = [];
    for (const p of expertPaths) {
      // Проверяем не только начало пути, но и отсутствие ".." — иначе
      // "/База данных/Эксперты/../../<чужая папка>" проходило проверку.
      if (typeof p !== "string" || !p.startsWith(EXPERTS_DIR + "/") || p.split(/[\\/]/).includes("..")) {
        return res.status(400).json({ message: "Недопустимый путь к папке эксперта" });
      }
      const infoAbs = filesLib.safeResolve(p + "/" + EXPERT_INFO_FILENAME);
      let buffer;
      try {
        buffer = await fs.promises.readFile(infoAbs);
      } catch (err) {
        return res.status(400).json({ message: `Не удалось прочитать файл «${EXPERT_INFO_FILENAME}» в папке: ${p}` });
      }
      const descLines = gpGenerate.extractParagraphTexts(buffer);
      const name = path.basename(p); // имя папки эксперта — как он подписывается в письме
      experts.push({ name, descLines });
    }

    const data = {
      courtHeader: String(body.courtHeader || ""),
      caseNumber: String(body.caseNumber || ""),
      courtGenitive: String(body.courtGenitive || ""),
      expertiseType: String(body.expertiseType || ""),
      questions,
      costText: `${body.costAmount || ""} (${body.costWords || ""})`,
      termText: `${body.termDays || ""} (${body.termWords || ""})`,
      experts,
    };

    const buffer = gpGenerate.generateGP(data);

    const safeCaseNumber = String(body.caseNumber || "без номера").replace(/[\\/]/g, "-");
    const fileName = `ГП по делу № ${safeCaseNumber}.docx`;
    const destDir = filesLib.safeResolve(gpOutputDir);
    await fs.promises.mkdir(destDir, { recursive: true });
    const destPath = path.join(destDir, fileName);

    if (fs.existsSync(destPath)) {
      return res.status(400).json({ message: "Файл с таким названием уже существует в этом проекте" });
    }

    await fs.promises.writeFile(destPath, buffer);
    res.json({ ok: true, name: fileName, path: gpOutputDir + "/" + fileName, caseFolderPath: kase.folder_path });
  } catch (err) {
    console.error("Не удалось создать ГП:", err);
    res.status(500).json({ message: "Не удалось создать документ: " + err.message });
  }
});

/* ---------------- File browsing ---------------- */

function joinRelPath(base, name) {
  const b = base.endsWith("/") ? base : base + "/";
  return b + name;
}

app.get("/api/resources", auth.requireAuth, requireColumnAccess(), async (req, res) => {
  try {
    const data = await filesLib.listDir(req.query.path || "/");

    // В "Дела" у обычных пользователей может быть доступ не ко всему —
    // прячем из списка то, что не разрешено (и не является "проходной"
    // папкой на пути к разрешённому).
    if (req.user.role !== "admin" && columnForPath(req.query.path) === "cases") {
      const base = req.query.path || "/";
      const rules = req.folderRules;
      data.folders = (data.folders || []).filter((f) =>
        folderAccess.canList(rules, joinRelPath(base, f.name))
      );
      data.files = (data.files || []).filter((f) =>
        Boolean(folderAccess.resolveAccess(rules, joinRelPath(base, f.name)))
      );
    }

    res.json(data);
  } catch (err) {
    res.status(400).json({ message: "Не удалось прочитать папку: " + err.message });
  }
});

app.post("/api/folder", auth.requireAuth, requireColumnAccess({ write: true }), async (req, res) => {
  try {
    await filesLib.ensureDir(req.body.path);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ message: "Не удалось создать папку: " + err.message });
  }
});

app.get("/api/search", auth.requireAuth, requireColumnAccess(), async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) {
      return res.json({ results: [] });
    }
    let results = await filesLib.searchTree(req.query.path || "/", q);

    // Поиск не должен показывать то, до чего пользователь не имеет права
    // добраться, даже если оно лежит внутри разрешённой ему папки на глубине.
    if (req.user.role !== "admin" && columnForPath(req.query.path) === "cases") {
      const rules = req.folderRules;
      results = results.filter((r) => Boolean(folderAccess.resolveAccess(rules, r.path)));
    }

    res.json({ results });
  } catch (err) {
    console.error("Ошибка поиска:", err);
    res.status(400).json({ message: "Не удалось выполнить поиск: " + err.message });
  }
});

// Рекурсивно фильтрует дерево, оставляя только то, что пользователю доступно
// (используется для скачивания "как обычную папку" — там нужно точно знать,
// что реально можно скачать, ещё до начала записи на диск пользователя).
function filterTreeForUser(node, fullPath, rules) {
  if (!node.isDir) {
    return folderAccess.resolveAccess(rules, fullPath) ? node : null;
  }
  if (!folderAccess.canList(rules, fullPath)) return null;
  const filteredChildren = [];
  for (const child of node.children || []) {
    const childPath = joinRelPath(fullPath, child.name);
    const filtered = filterTreeForUser(child, childPath, rules);
    if (filtered) filteredChildren.push(filtered);
  }
  return { ...node, children: filteredChildren };
}

/** Складывает в архив только то, что осталось после фильтрации по правам. */
function addTreeToArchive(archive, node, fullPath, archiveName) {
  if (!node.isDir) {
    archive.file(filesLib.safeResolve(fullPath), { name: archiveName });
    return;
  }
  if (!node.children || node.children.length === 0) {
    // Пустая (после фильтрации) папка — сохраняем саму папку, без содержимого.
    archive.append(null, { name: archiveName + "/" });
    return;
  }
  for (const child of node.children) {
    addTreeToArchive(archive, child, joinRelPath(fullPath, child.name), archiveName + "/" + child.name);
  }
}

// Отдаёт полную структуру папки (вложенные подпапки и файлы) одним запросом —
// нужно фронтенду, чтобы воссоздать ту же структуру на диске пользователя
// при скачивании "как обычную папку" через File System Access API.
app.get("/api/tree", auth.requireAuth, requireColumnAccess(), async (req, res) => {
  try {
    let tree = await filesLib.buildTree(req.query.path);
    if (req.user.role !== "admin" && columnForPath(req.query.path) === "cases") {
      tree = filterTreeForUser(tree, req.query.path, req.folderRules);
      if (!tree) {
        return res.status(403).json({ message: "Нет доступа к этой папке" });
      }
    }
    res.json({ tree });
  } catch (err) {
    console.error("Не удалось построить дерево папки:", err);
    res.status(400).json({ message: "Не удалось прочитать структуру: " + err.message });
  }
});

const TEMPLATES_DIR = path.join(__dirname, "..", "templates");
const FILE_TEMPLATES = {
  docx: { file: "empty.docx", defaultName: "Новый документ.docx" },
  xlsx: { file: "empty.xlsx", defaultName: "Новая таблица.xlsx" },
};

app.post("/api/create-file", auth.requireAuth, requireColumnAccess({ write: true }), async (req, res) => {
  try {
    const { type } = req.body || {};
    let { name } = req.body || {};
    const template = FILE_TEMPLATES[type];
    if (!template) {
      return res.status(400).json({ message: "Неизвестный тип документа" });
    }
    const ext = "." + type;
    name = (name || "").trim() || template.defaultName;
    // без слэшей — это просто имя файла, не путь
    name = name.replace(/[\\/]/g, "");
    if (!name.toLowerCase().endsWith(ext)) {
      name += ext;
    }

    const targetDir = filesLib.safeResolve(req.body.path || "/");
    await fs.promises.mkdir(targetDir, { recursive: true });
    const destPath = path.join(targetDir, name);

    if (fs.existsSync(destPath)) {
      return res.status(400).json({ message: "Файл с таким именем уже существует" });
    }

    await fs.promises.copyFile(path.join(TEMPLATES_DIR, template.file), destPath);
    res.json({ ok: true, name });
  } catch (err) {
    console.error("Не удалось создать документ:", err);
    res.status(500).json({ message: "Не удалось создать документ: " + err.message });
  }
});

// Удаление не стирает файл, а переносит его в корзину: оттуда его можно
// вернуть в течение срока хранения. Персональные правила доступа уезжают
// вместе с записью (см. trash.js) — сами по себе они здесь больше не чистятся.
app.delete("/api/resources", auth.requireAuth, requireColumnAccess({ write: true }), async (req, res) => {
  try {
    await trash.moveToTrash(req.query.path, req.user.id);
    res.json({ ok: true });
  } catch (err) {
    console.error("Не удалось переместить в корзину:", err);
    res.status(400).json({ message: "Не удалось удалить: " + err.message });
  }
});

/* ---------------- Корзина ---------------- */

app.get("/api/trash", auth.requireAuth, async (req, res) => {
  try {
    const items = await trash.listTrash(req.user);
    res.json({ items, retentionDays: trash.RETENTION_DAYS });
  } catch (err) {
    console.error("Не удалось получить корзину:", err);
    res.status(500).json({ message: "Не удалось получить содержимое корзины" });
  }
});

app.post("/api/trash/:id/restore", auth.requireAuth, async (req, res) => {
  try {
    const result = await trash.restore(req.params.id, req.user);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message });
  }
});

app.delete("/api/trash/:id", auth.requireAuth, async (req, res) => {
  try {
    await trash.purge(req.params.id, req.user);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message });
  }
});

// Очистка вручную: сотрудник убирает своё, администратор — всю корзину.
app.post("/api/trash/empty", auth.requireAuth, async (req, res) => {
  try {
    const removed = await trash.empty(req.user);
    res.json({ ok: true, removed });
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message });
  }
});

app.post("/api/rename", auth.requireAuth, requireColumnAccess({ write: true }), async (req, res) => {
  try {
    const { path: oldPath, newName } = req.body || {};
    if (!oldPath || !newName) {
      return res.status(400).json({ message: "Укажите путь и новое имя" });
    }
    const newPath = await filesLib.renameEntry(oldPath, newName);
    if (columnForPath(oldPath) === "cases") {
      await folderPermissions.renamePath(oldPath, newPath);
    }
    res.json({ ok: true, path: newPath });
  } catch (err) {
    res.status(400).json({ message: "Не удалось переименовать: " + err.message });
  }
});

/**
 * Перемещает файл/папку в другую папку — в отличие от переименования,
 * тут родитель меняется. requireColumnAccess проверил права на исходный
 * путь (req.body.path); права на папку назначения проверяем сами ниже,
 * потому что назначение может быть в совсем другом месте "Дела" со
 * своими персональными правилами доступа.
 */
app.post("/api/move", auth.requireAuth, requireColumnAccess({ write: true }), async (req, res) => {
  try {
    const { path: sourcePath, destination } = req.body || {};
    if (!sourcePath || !destination) {
      return res.status(400).json({ message: "Укажите путь и папку назначения" });
    }

    const sourceColumn = columnForPath(sourcePath);
    const destColumn = columnForPath(destination);

    if (sourceColumn === "cases") {
      return res.status(400).json({
        message: "В разделе «Дела» перемещение вручную отключено — папки переезжают сами при смене стадии проекта",
      });
    }
    if (!sourceColumn || sourceColumn !== destColumn) {
      return res.status(400).json({ message: "Перемещать можно только внутри одного и того же раздела" });
    }

    const sourceAbs = filesLib.safeResolve(sourcePath);
    const destAbs = filesLib.safeResolve(destination);
    if (destAbs === sourceAbs || destAbs.startsWith(sourceAbs + path.sep)) {
      return res.status(400).json({ message: "Нельзя переместить папку саму в себя" });
    }

    if (req.user.role !== "admin" && sourceColumn === "cases") {
      const rules = await folderAccess.getUserRules(req.user.id);
      if (folderAccess.resolveAccess(rules, destination) !== "write") {
        return res.status(403).json({ message: "Нет прав на запись в папку назначения" });
      }
    }

    const newPath = await filesLib.moveEntry(sourcePath, destination);
    if (sourceColumn === "cases") {
      await folderPermissions.renamePath(sourcePath, newPath);
    }
    res.json({ ok: true, path: newPath });
  } catch (err) {
    res.status(400).json({ message: "Не удалось переместить: " + err.message });
  }
});

/** Копирует файл/папку целиком в другую папку — оригинал остаётся на месте. */
app.post("/api/copy", auth.requireAuth, requireColumnAccess({ write: true }), async (req, res) => {
  try {
    const { path: sourcePath, destination } = req.body || {};
    if (!sourcePath || !destination) {
      return res.status(400).json({ message: "Укажите путь и папку назначения" });
    }

    const sourceColumn = columnForPath(sourcePath);
    const destColumn = columnForPath(destination);
    if (!sourceColumn || sourceColumn !== destColumn) {
      return res.status(400).json({ message: "Копировать можно только внутри одного и того же раздела" });
    }

    const sourceAbs = filesLib.safeResolve(sourcePath);
    const destAbs = filesLib.safeResolve(destination);
    if (destAbs === sourceAbs || destAbs.startsWith(sourceAbs + path.sep)) {
      return res.status(400).json({ message: "Нельзя скопировать папку саму в себя" });
    }

    if (req.user.role !== "admin" && sourceColumn === "cases") {
      const rules = await folderAccess.getUserRules(req.user.id);
      if (folderAccess.resolveAccess(rules, destination) !== "write") {
        return res.status(403).json({ message: "Нет прав на запись в папку назначения" });
      }
    }

    const newPath = await filesLib.copyEntry(sourcePath, destination);
    res.json({ ok: true, path: newPath });
  } catch (err) {
    res.status(400).json({ message: "Не удалось скопировать: " + err.message });
  }
});

// Убирает ".." и пустые сегменты из относительного пути, присланного
// клиентом при загрузке папки — чтобы нельзя было вылезти за пределы
// целевой директории через специально сформированный путь.
function sanitizeRelativePath(relPath) {
  return relPath
    .split(/[\\/]+/)
    .filter((seg) => seg && seg !== "." && seg !== "..")
    .join("/");
}

app.post("/api/upload", auth.requireAuth, upload.single("file"), cleanupTempUpload, requireColumnAccess({ write: true }), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Файл не получен" });
    }
    const targetDir = filesLib.safeResolve(req.body.path || "/");
    await fs.promises.mkdir(targetDir, { recursive: true });

    // multer/busboy старых версий отдают имя файла в кодировке latin1,
    // из-за чего кириллица превращается в кракозябры — перекодируем обратно в utf8.
    const fixedName = Buffer.from(req.file.originalname, "latin1").toString("utf8");

    // При загрузке целой папки браузер присылает относительный путь файла
    // внутри неё (например "Отчёты/Июль/файл.docx") в поле relativePath —
    // нужно воссоздать эту структуру подпапок на диске.
    const rawRelativePath = req.body.relativePath ? sanitizeRelativePath(req.body.relativePath) : "";
    const destPath = path.join(targetDir, rawRelativePath || fixedName);

    if (destPath !== targetDir && !destPath.startsWith(targetDir + path.sep)) {
      throw new Error("Недопустимый путь файла");
    }

    await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
    await fs.promises.copyFile(req.file.path, destPath);
    await fs.promises.unlink(req.file.path);

    res.json({ ok: true });
  } catch (err) {
    console.error("Не удалось загрузить файл:", err);
    res.status(400).json({ message: "Не удалось загрузить файл: " + err.message });
  }
});

app.get("/api/download", auth.requireAuth, requireColumnAccess(), (req, res) => {
  try {
    const abs = filesLib.safeResolve(req.query.path);
    res.download(abs);
  } catch (err) {
    res.status(400).json({ message: "Не удалось скачать файл: " + err.message });
  }
});

// В отличие от /api/download — не заставляет браузер скачивать файл,
// а отдаёт его "как есть", чтобы браузер сам решил, показать его
// (например, PDF) или предложить сохранить.
app.get("/api/view", auth.requireAuth, requireColumnAccess(), (req, res) => {
  try {
    const abs = filesLib.safeResolve(req.query.path);
    res.setHeader("Content-Disposition", "inline");
    res.sendFile(abs);
  } catch (err) {
    res.status(400).json({ message: "Не удалось открыть файл: " + err.message });
  }
});

// Скачивание нескольких выбранных файлов/папок разом — упаковываем в zip на лету.
app.post("/api/download-zip", auth.requireAuth, async (req, res) => {
  try {
    // Из fetch приходит массив, из формы — та же строка в JSON.
    let paths = (req.body && req.body.paths) || [];
    if (typeof paths === "string") {
      try { paths = JSON.parse(paths); } catch (e) { paths = []; }
    }
    if (!Array.isArray(paths)) paths = [];
    if (paths.length === 0) {
      return res.status(400).json({ message: "Не выбрано ни одного элемента" });
    }

    if (req.user.role !== "admin") {
      let casesRules = null;
      for (const p of paths) {
        const col = columnForPath(p);
        if (col === "db") {
          if (!req.user.can_db) {
            return res.status(403).json({ message: "Нет доступа к одному из выбранных элементов" });
          }
          continue;
        }
        if (col === "cases") {
          if (!req.user.can_cases) {
            return res.status(403).json({ message: "Нет доступа к одному из выбранных элементов" });
          }
          if (!casesRules) casesRules = await folderAccess.getUserRules(req.user.id);
          if (!folderAccess.resolveAccess(casesRules, p)) {
            return res.status(403).json({ message: "Нет доступа к одному из выбранных элементов" });
          }
          continue;
        }
        return res.status(403).json({ message: "Нет доступа к одному из выбранных элементов" });
      }
    }

    // Фронтенд сначала спрашивает «а можно?» обычным запросом — так он
    // покажет понятную ошибку. Сам архив потом качается формой, чтобы имя
    // файла задал этот сервер (см. web/app.js).
    if (req.body && (req.body.dryRun === true || req.body.dryRun === "true")) {
      return res.json({ ok: true });
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", filesLib.zipContentDisposition(paths));

    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.on("error", (err) => {
      console.error("Ошибка формирования zip:", err);
      res.destroy();
    });
    archive.pipe(res);

    // Для обычного пользователя в "Дела" архив собираем по отфильтрованному
    // дереву: иначе запрет на вложенную папку обходился скачиванием
    // родительской одним архивом.
    let casesRulesForZip = null;
    if (req.user.role !== "admin" && paths.some((p) => columnForPath(p) === "cases")) {
      casesRulesForZip = await folderAccess.getUserRules(req.user.id);
    }

    for (const rel of paths) {
      const abs = filesLib.safeResolve(rel);
      const stat = await fs.promises.stat(abs);
      const name = path.basename(abs);

      if (!stat.isDirectory()) {
        archive.file(abs, { name });
        continue;
      }
      if (!casesRulesForZip || columnForPath(rel) !== "cases") {
        archive.directory(abs, name);
        continue;
      }

      const tree = filterTreeForUser(await filesLib.buildTree(rel), rel, casesRulesForZip);
      if (!tree) continue;
      addTreeToArchive(archive, tree, rel, name);
    }

    await archive.finalize();
  } catch (err) {
    console.error("Не удалось создать zip-архив:", err);
    if (!res.headersSent) {
      res.status(500).json({ message: "Не удалось скачать выбранное: " + err.message });
    } else {
      res.end();
    }
  }
});

/* ---------------- OnlyOffice ---------------- */

app.get("/api/onlyoffice/config", auth.requireAuth, requireColumnAccess(), (req, res) => {
  try {
    const relPath = req.query.path;
    const fileName = path.basename(relPath);
    // В "Дела" доступ мог быть только "читать" — тогда открываем строго
    // в режиме просмотра, без возможности редактировать и сохранить.
    const canEdit =
      req.user.role === "admin" ||
      columnForPath(relPath) !== "cases" ||
      req.folderAccess === "write";
    const { config, scriptUrl } = onlyoffice.buildEditorConfig({
      relPath,
      fileName,
      userId: req.user.id,
      userName: req.user.username,
      canEdit,
    });
    res.json({ config, scriptUrl });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Вызывается сервером документов OnlyOffice напрямую (без пользовательской cookie),
// поэтому проверяем отдельный короткоживущий токен из query, а не auth.requireAuth.
app.get("/internal/raw", (req, res) => {
  try {
    onlyoffice.verifyInternalToken(req.query.token, req.query.path);
    const abs = filesLib.safeResolve(req.query.path);
    res.sendFile(abs);
  } catch (err) {
    res.status(403).json({ message: "Недействительный токен" });
  }
});

// То же самое, но для ДРУГИХ наших сервисов (например, "Учёт приборов"),
// которым нужно один раз "привязать" файл к своей записи и потом показывать
// его сколько угодно раз, без входа пользователя в файловый менеджер.
// Токен не истекает — в отличие от /internal/raw, который живёт только
// на время одной сессии редактирования в OnlyOffice.
app.get("/internal/linked-file", (req, res) => {
  try {
    fileLink.verifyFileLinkToken(req.query.token, req.query.path);
    const abs = filesLib.safeResolve(req.query.path);
    res.sendFile(abs);
  } catch (err) {
    res.status(403).json({ message: "Недействительный токен" });
  }
});

app.post("/api/onlyoffice/callback", express.json(), async (req, res) => {
  try {
    // requireEdit: сохранять можно только тем токеном, который выдан для
    // редактирования. Токен просмотра сюда больше не подходит.
    onlyoffice.verifyInternalToken(req.query.token, req.query.path, { requireEdit: true });
  } catch (err) {
    console.error("OnlyOffice callback: недействительный/просроченный токен для", req.query.path, "-", err.message);
    return res.status(403).json({ error: 1, message: "Недействительный токен" });
  }

  const { status, url } = req.body || {};
  console.log(`OnlyOffice callback: path="${req.query.path}" status=${status}`);

  // status 2 = документ готов к сохранению, 6 = принудительное сохранение
  if (status === 2 || status === 6) {
    try {
      const abs = filesLib.safeResolve(req.query.path);
      // Ссылку на сохранённый документ принимаем только от нашего же
      // OnlyOffice — иначе колбэком можно заставить сервер сходить
      // по чужому адресу и записать что угодно в файл.
      if (!onlyoffice.isAllowedOnlyOfficeUrl(url)) {
        throw new Error("Ссылка на сохранённый файл ведёт не к OnlyOffice: " + url);
      }
      const fetchUrl = onlyoffice.toInternalOnlyOfficeUrl(url);
      const response = await fetch(fetchUrl);
      if (!response.ok) {
        throw new Error(`не удалось скачать сохранённый файл у OnlyOffice, HTTP ${response.status}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      await fs.promises.writeFile(abs, buffer);
      console.log(`OnlyOffice callback: файл "${req.query.path}" успешно сохранён (${buffer.length} байт)`);
    } catch (err) {
      console.error("Не удалось сохранить документ из OnlyOffice:", err);
      return res.json({ error: 1 });
    }
  }
  res.json({ error: 0 });
});

/* ---------------- Обработка ошибок загрузки ---------------- */

// Multer бросает свою ошибку (например, файл больше разрешённого) —
// без этого обработчика клиент получал бы страницу с текстом ошибки
// вместо понятного сообщения.
app.use((err, req, res, next) => {
  if (err && err.name === "MulterError") {
    const message = err.code === "LIMIT_FILE_SIZE"
      ? `Файл слишком большой: максимум ${MAX_UPLOAD_MB} МБ`
      : "Не удалось принять файл: " + err.message;
    return res.status(400).json({ message });
  }
  if (err) {
    console.error("Необработанная ошибка запроса:", err);
    if (res.headersSent) return next(err);
    return res.status(500).json({ message: "Внутренняя ошибка сервера" });
  }
  next();
});

/* ---------------- Frontend fallback ---------------- */

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/internal/")) return next();
  res.sendFile(path.join(WEB_ROOT, "index.html"));
});

/* ---------------- Start ---------------- */

// Страховка: если где-то всё же проскочит необработанная ошибка,
// логируем её, но не даём процессу упасть целиком.
process.on("unhandledRejection", (err) => {
  console.error("Необработанная ошибка (unhandledRejection):", err);
});

// Уборка корзины: сразу при запуске и дальше раз в шесть часов.
// Отдельный планировщик ради этого не нужен — контейнер и так работает
// постоянно, а операция короткая.
async function runTrashCleanup() {
  try {
    const { removed, orphans } = await trash.purgeExpired();
    if (removed || orphans) {
      console.log(`Корзина: удалено просроченных ${removed}, потерянных папок ${orphans}`);
    }
  } catch (err) {
    console.error("Не удалось очистить корзину:", err);
  }
}
setTimeout(runTrashCleanup, 30 * 1000).unref();
setInterval(runTrashCleanup, 6 * 60 * 60 * 1000).unref();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`filemanager запущен на порту ${PORT}`);
});
