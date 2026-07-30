const express = require("express");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { ZipArchive } = require("archiver");

const auth = require("./auth");
const filesLib = require("./files");
const onlyoffice = require("./onlyoffice");
const tools = require("./tools");
const users = require("./users");
const fileLink = require("./fileLink");
const folderAccess = require("./folderAccess");
const folderPermissions = require("./folderPermissions");
const gpGenerate = require("./gpGenerate");
const { columnForPath, requireColumnAccess, requireToolsAccess } = require("./permissions");

const app = express();
app.use(express.json());
app.use(cookieParser());

const WEB_ROOT = path.join(__dirname, "..", "web");
app.use(express.static(WEB_ROOT));

// Папка для временных файлов при загрузке. Создаём заранее явно —
// иначе multer может упасть с ENOENT, если папки ещё нет в контейнере.
const UPLOAD_TMP_DIR = "/tmp/fm-uploads";
fs.mkdirSync(UPLOAD_TMP_DIR, { recursive: true });
const upload = multer({ dest: UPLOAD_TMP_DIR });

// Отдельные корневые папки для колонок "База данных" и "Дела",
// чтобы они не показывали одно и то же содержимое.
const COLUMN_ROOTS = ["/База данных", "/Дела"];
for (const rel of COLUMN_ROOTS) {
  fs.mkdirSync(filesLib.safeResolve(rel), { recursive: true });
}

/* ---------------- Auth ---------------- */

// Адрес API "Учёта оборудования" — единственного места, где теперь
// проверяются логин и пароль. ИСУ больше не хранит паролей у себя.
const IDENTITY_API_URL = process.env.IDENTITY_API_URL;
if (!IDENTITY_API_URL) {
  throw new Error('Переменная окружения IDENTITY_API_URL не задана (адрес API "Учёта оборудования")');
}

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: "Введите логин и пароль" });
    }

    let upstream;
    try {
      const upstreamRes = await fetch(`${IDENTITY_API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      upstream = await upstreamRes.json();
      if (!upstreamRes.ok) {
        return res.status(upstreamRes.status).json({ message: upstream.error || "Неверный логин или пароль" });
      }
    } catch (err) {
      console.error('Не удалось проверить логин через "Учёт оборудования":', err);
      return res.status(502).json({ message: "Сервис входа временно недоступен, попробуйте позже" });
    }

    auth.setAuthCookie(res, upstream.token);
    const perms = await auth.getPermissions(upstream.user.id);

    res.json({
      user: {
        username: upstream.user.username,
        role: upstream.user.role,
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

/* ---------------- Пользователи и права доступа (только администратор) ---------------- */

app.get("/api/users", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    res.json({ users: await users.listUsers(req.cookies[auth.COOKIE_NAME]) });
  } catch (err) {
    console.error("Не удалось получить список пользователей:", err);
    res.status(500).json({ message: "Не удалось получить список пользователей" });
  }
});

app.post("/api/users", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const { username, password, role, can_tools, can_db, can_cases } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: "Укажите логин и пароль" });
    }
    const user = await users.createUser(
      { username, password, role, can_tools, can_db, can_cases },
      req.cookies[auth.COOKIE_NAME]
    );
    res.json({ user });
  } catch (err) {
    if (err.status === 409) {
      return res.status(400).json({ message: "Пользователь с таким логином уже существует" });
    }
    console.error("Не удалось создать пользователя:", err);
    res.status(err.status || 500).json({ message: err.message || "Не удалось создать пользователя" });
  }
});

app.patch("/api/users/:id", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    await users.updateUser(req.params.id, req.body || {}, req.cookies[auth.COOKIE_NAME]);
    res.json({ ok: true });
  } catch (err) {
    console.error("Не удалось обновить пользователя:", err);
    res.status(err.status || 500).json({ message: err.message || "Не удалось обновить пользователя" });
  }
});

app.delete("/api/users/:id", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    if (String(req.user.id) === String(req.params.id)) {
      return res.status(400).json({ message: "Нельзя удалить самого себя" });
    }
    const target = await users.getUser(req.params.id, req.cookies[auth.COOKIE_NAME]);
    if (!target) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }
    if (target.role === "admin") {
      const adminCount = await users.countAdmins(req.cookies[auth.COOKIE_NAME]);
      if (adminCount <= 1) {
        return res.status(400).json({ message: "Нельзя удалить последнего администратора" });
      }
    }
    await users.deleteUser(req.params.id, req.cookies[auth.COOKIE_NAME]);
    res.json({ ok: true });
  } catch (err) {
    console.error("Не удалось удалить пользователя:", err);
    res.status(err.status || 500).json({ message: err.message || "Не удалось удалить пользователя" });
  }
});

/* ---------------- Гарантийные письма (ГП) ---------------- */

const EXPERTS_DIR = "/База данных/Эксперты";

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
    const experts = entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".docx"))
      .map((e) => ({
        name: e.name.replace(/\.docx$/i, ""),
        path: EXPERTS_DIR + "/" + e.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
    res.json({ experts });
  } catch (err) {
    console.error("Не удалось получить список экспертов:", err);
    res.status(500).json({ message: "Не удалось получить список экспертов" });
  }
});

const GP_OUTPUT_DIR = "/Дела/Планы";

app.post("/api/gp/generate", auth.requireAuth, async (req, res) => {
  try {
    // Готовый файл всегда уходит строго в "Дела/Планы" — проверяем право
    // на запись именно туда, а не на путь, присланный в запросе.
    if (req.user.role !== "admin") {
      if (!req.user.can_cases) {
        return res.status(403).json({ message: "Нет доступа к этому разделу" });
      }
      const rules = await folderAccess.getUserRules(req.user.id);
      if (folderAccess.resolveAccess(rules, GP_OUTPUT_DIR) !== "write") {
        return res.status(403).json({ message: "Нет прав на создание файлов в «Дела/Планы»" });
      }
    }

    const body = req.body || {};
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
      if (typeof p !== "string" || !p.startsWith(EXPERTS_DIR + "/")) {
        return res.status(400).json({ message: "Недопустимый путь к файлу эксперта" });
      }
      const abs = filesLib.safeResolve(p);
      let buffer;
      try {
        buffer = await fs.promises.readFile(abs);
      } catch (err) {
        return res.status(400).json({ message: `Не удалось прочитать файл эксперта: ${p}` });
      }
      const descLines = gpGenerate.extractParagraphTexts(buffer);
      const name = path.basename(p).replace(/\.docx$/i, "");
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
    const destDir = filesLib.safeResolve(GP_OUTPUT_DIR);
    await fs.promises.mkdir(destDir, { recursive: true });
    const destPath = path.join(destDir, fileName);

    if (fs.existsSync(destPath)) {
      return res.status(400).json({ message: "Файл с таким названием уже существует в «Дела/Планы»" });
    }

    await fs.promises.writeFile(destPath, buffer);
    res.json({ ok: true, name: fileName, path: GP_OUTPUT_DIR + "/" + fileName });
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

app.delete("/api/resources", auth.requireAuth, requireColumnAccess({ write: true }), async (req, res) => {
  try {
    await filesLib.removeEntry(req.query.path);
    if (columnForPath(req.query.path) === "cases") {
      await folderPermissions.removeRulesUnderPath(req.query.path);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ message: "Не удалось удалить: " + err.message });
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

// Убирает ".." и пустые сегменты из относительного пути, присланного
// клиентом при загрузке папки — чтобы нельзя было вылезти за пределы
// целевой директории через специально сформированный путь.
function sanitizeRelativePath(relPath) {
  return relPath
    .split(/[\\/]+/)
    .filter((seg) => seg && seg !== "." && seg !== "..")
    .join("/");
}

app.post("/api/upload", auth.requireAuth, upload.single("file"), requireColumnAccess({ write: true }), async (req, res) => {
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
    const paths = Array.isArray(req.body && req.body.paths) ? req.body.paths : [];
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

    const absPaths = paths.map((p) => filesLib.safeResolve(p));

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="files.zip"');

    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.on("error", (err) => {
      console.error("Ошибка формирования zip:", err);
      res.destroy();
    });
    archive.pipe(res);

    for (const abs of absPaths) {
      const stat = await fs.promises.stat(abs);
      const name = path.basename(abs);
      if (stat.isDirectory()) {
        archive.directory(abs, name);
      } else {
        archive.file(abs, { name });
      }
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
    onlyoffice.verifyInternalToken(req.query.token, req.query.path);
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`filemanager запущен на порту ${PORT}`);
});
