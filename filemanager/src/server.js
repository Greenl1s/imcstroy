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

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: "Введите логин и пароль" });
    }
    const user = await auth.verifyLogin(username, password);
    if (!user) {
      return res.status(401).json({ message: "Неверный логин или пароль" });
    }
    const token = auth.signToken(user);
    auth.setAuthCookie(res, token);
    res.json({
      user: {
        username: user.username,
        role: user.role,
        can_tools: user.can_tools,
        can_db: user.can_db,
        can_cases: user.can_cases,
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

/* ---------------- Пользователи и права доступа (только администратор) ---------------- */

app.get("/api/users", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    res.json({ users: await users.listUsers() });
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

/* ---------------- File browsing ---------------- */

app.get("/api/resources", auth.requireAuth, requireColumnAccess, async (req, res) => {
  try {
    const data = await filesLib.listDir(req.query.path || "/");
    res.json(data);
  } catch (err) {
    res.status(400).json({ message: "Не удалось прочитать папку: " + err.message });
  }
});

app.post("/api/folder", auth.requireAuth, requireColumnAccess, async (req, res) => {
  try {
    await filesLib.ensureDir(req.body.path);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ message: "Не удалось создать папку: " + err.message });
  }
});

app.get("/api/search", auth.requireAuth, requireColumnAccess, async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) {
      return res.json({ results: [] });
    }
    const results = await filesLib.searchTree(req.query.path || "/", q);
    res.json({ results });
  } catch (err) {
    console.error("Ошибка поиска:", err);
    res.status(400).json({ message: "Не удалось выполнить поиск: " + err.message });
  }
});

const TEMPLATES_DIR = path.join(__dirname, "..", "templates");
const FILE_TEMPLATES = {
  docx: { file: "empty.docx", defaultName: "Новый документ.docx" },
  xlsx: { file: "empty.xlsx", defaultName: "Новая таблица.xlsx" },
};

app.post("/api/create-file", auth.requireAuth, requireColumnAccess, async (req, res) => {
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

app.delete("/api/resources", auth.requireAuth, requireColumnAccess, async (req, res) => {
  try {
    await filesLib.removeEntry(req.query.path);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ message: "Не удалось удалить: " + err.message });
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

app.post("/api/upload", auth.requireAuth, requireColumnAccess, upload.single("file"), async (req, res) => {
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

app.get("/api/download", auth.requireAuth, requireColumnAccess, (req, res) => {
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
app.get("/api/view", auth.requireAuth, requireColumnAccess, (req, res) => {
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
      for (const p of paths) {
        const col = columnForPath(p);
        const allowed = (col === "db" && req.user.can_db) || (col === "cases" && req.user.can_cases);
        if (!allowed) {
          return res.status(403).json({ message: "Нет доступа к одному из выбранных элементов" });
        }
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

app.get("/api/onlyoffice/config", auth.requireAuth, requireColumnAccess, (req, res) => {
  try {
    const relPath = req.query.path;
    const fileName = path.basename(relPath);
    const { config, scriptUrl } = onlyoffice.buildEditorConfig({
      relPath,
      fileName,
      userId: req.user.id,
      userName: req.user.username,
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
