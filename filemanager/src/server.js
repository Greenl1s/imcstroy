const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { ZipArchive } = require("archiver");

const auth = require("./auth");
const db = require("./db");
const settings = require("./settings");
const lookups = require("./lookups");
const filesLib = require("./files");
const onlyoffice = require("./onlyoffice");
const tools = require("./tools");
const users = require("./users");
const fileLink = require("./fileLink");
const folderAccess = require("./folderAccess");
const folderPermissions = require("./folderPermissions");
const gpGenerate = require("./gpGenerate");
const gpDraft = require("./gpDraft");
const expertsLib = require("./experts");
const expertInfo = require("./expertInfo");
const gpTemplate = require("./gpTemplate");
const docxImages = require("./docxImages");
const documentTypes = require("./documentTypes");
const documentTemplate = require("./documentTemplate");
const documentGenerate = require("./documentGenerate");
const documentDraft = require("./documentDraft");
const equipment = require("./equipment");
const { cases: caseRoutes } = require("./cases");
const { organizations: organizationRoutes } = require("./organizations");
const trash = require("./trash");
const caseLifecycle = require("./caseLifecycle");
const events = require("./events");
const permissions = require("./permissions");
const { columnForPath, requireColumnAccess, requireToolsAccess } = permissions;

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

/**
 * Служебный работник приложения (sw.js).
 *
 * Две вещи, без которых он не заработает:
 *   — его нельзя кэшировать, иначе браузер будет неделями держать
 *     старую версию и обновления приложения не доедут;
 *   — заголовок Service-Worker-Allowed разрешает ему управлять всем
 *     адресом, включая /instruments/ и /calendar/, хотя сам файл
 *     лежит в корне.
 */
app.get("/sw.js", (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Service-Worker-Allowed", "/");
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.sendFile(path.join(WEB_ROOT, "sw.js"));
});

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

// Журнал открыт отдельной кнопкой слева. Старую Excel-копию в «Делах»
// убираем при запуске и больше не создаём.
require("./journalExcel").removeStoredJournal().catch((err) => {
  console.error("Не удалось убрать старую папку журнала регистрации:", err.message);
});

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
        name: user.name || user.username,
        role: user.role,
        can_tools: perms.can_tools,
        can_db: perms.can_db,
        can_cases: perms.can_cases,
        can_manage: perms.can_manage,
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
      name: req.user.name,
      role: req.user.role,
      can_tools: req.user.can_tools,
      can_db: req.user.can_db,
      can_cases: req.user.can_cases,
      can_manage: req.user.can_manage,
      planfix_name: req.user.planfix_name,
      planfix_user_id: req.user.planfix_user_id,
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
    // Окно доступно только администратору — показываем настоящую причину,
    // иначе такие сбои приходится ловить по логам контейнера.
    res.status(500).json({ message: "Не удалось получить список прав доступа: " + err.message });
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
    res.status(500).json({ message: "Не удалось сохранить право доступа: " + err.message });
  }
});

app.delete("/api/folder-permissions/:id", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    await folderPermissions.removePermission(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error("Не удалось удалить право доступа:", err);
    res.status(500).json({ message: "Не удалось убрать право доступа: " + err.message });
  }
});

/* ---------------- Панель настроек (только администратор) ----------------

   Всё, что раньше требовало зайти на сервер, поправить .env и
   пересобрать образ. Отдельная приставка /api/admin/ у адресов — не
   украшение: по ней видно, что за этой чертой всё закрыто ролью, и
   забыть повесить проверку на новый маршрут труднее.
   ---------------------------------------------------------------- */

app.get("/api/admin/settings", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    // Читаем из базы заново, а не из памяти: настройки мог поменять
    // другой администратор, и показывать ему чужие правки как свои —
    // худший вид рассинхрона.
    await settings.load();
    res.json({ settings: settings.describe(req.query.group || null) });
  } catch (err) {
    console.error("Не удалось прочитать настройки:", err);
    res.status(500).json({ message: "Не удалось прочитать настройки: " + err.message });
  }
});

app.patch("/api/admin/settings", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const values = req.body && req.body.values;
    if (!values || typeof values !== "object") {
      return res.status(400).json({ message: "Нечего сохранять" });
    }
    const changed = [];
    for (const [key, value] of Object.entries(values)) {
      const result = await settings.set(key, value, req.user.id);
      changed.push(key);
      // В журнал пишем ключ и только его: значение может быть токеном.
      events.log(req.user, "settings", { name: key, details: { cleared: result.cleared } });
    }
    res.json({ ok: true, changed, settings: settings.describe(req.query.group || null) });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ message: err.message });
    console.error("Не удалось сохранить настройки:", err);
    res.status(500).json({ message: "Не удалось сохранить настройки: " + err.message });
  }
});

/* ---------------- Справочники журнала ---------------- */

// Читать может каждый, кому открыты «Дела»: из этих списков выбирают в
// журнале и в карточке проекта. Править — только администратор.
app.get("/api/lookups", auth.requireAuth, async (req, res) => {
  try {
    const [lists, people] = await Promise.all([lookups.all(), lookups.people()]);
    res.json({ ...lists, ...people });
  } catch (err) {
    const notReady = db.notMigrated(err);
    if (notReady) return res.status(503).json({ message: notReady });
    console.error("Не удалось получить справочники:", err);
    res.status(500).json({ message: "Не удалось получить справочники: " + err.message });
  }
});

app.post("/api/admin/lookups", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const value = await lookups.add(req.body?.kind, req.body?.value, req.user.id);
    events.log(req.user, "lookup", {
      name: value, details: { kind: req.body?.kind, action: "добавлено" },
    });
    res.json({ ok: true, value });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

app.delete("/api/admin/lookups", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    await lookups.remove(req.query.kind, req.query.value);
    events.log(req.user, "lookup", {
      name: req.query.value, details: { kind: req.query.kind, action: "убрано" },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

/**
 * Кто что видит: один человек — и сразу всё, к чему у него есть доступ.
 *
 * Разделы (fm_permissions) и правила по папкам «Дел» лежат в разных
 * таблицах и правились в разных окнах, поэтому цельной картины не было
 * ни у кого. Здесь они наконец в одном ответе.
 */
app.get("/api/admin/access", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const list = await users.listUsers();
    const counts = await folderPermissions.countByUser();
    const byId = new Map(counts.map((c) => [c.user_id, c]));
    res.json({
      users: list.map((u) => ({
        ...u,
        folder_rules: byId.get(u.id) ? byId.get(u.id).rules : 0,
        folder_denials: byId.get(u.id) ? byId.get(u.id).denials : 0,
      })),
    });
  } catch (err) {
    const notReady = db.notMigrated(err);
    if (notReady) return res.status(503).json({ message: notReady });
    console.error("Не удалось собрать доступы:", err);
    res.status(500).json({ message: "Не удалось собрать доступы: " + err.message });
  }
});

app.get("/api/admin/access/:userId", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const user = await users.getUser(Number(req.params.userId));
    if (!user) return res.status(404).json({ message: "Сотрудник не найден" });
    const rules = await folderPermissions.listForUser(user.id);
    res.json({ user, rules });
  } catch (err) {
    const notReady = db.notMigrated(err);
    if (notReady) return res.status(503).json({ message: notReady });
    console.error("Не удалось собрать доступы сотрудника:", err);
    res.status(500).json({ message: "Не удалось собрать доступы сотрудника: " + err.message });
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
    const { username, password, full_name, role, can_tools, can_db, can_cases, can_manage,
      can_be_manager, can_be_expert } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: "Укажите логин и пароль" });
    }
    const user = await users.createUser({
      username, password, full_name, role, can_tools, can_db, can_cases, can_manage,
      can_be_manager, can_be_expert,
    });
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
    const { renamed } = await users.updateUser(req.params.id, req.body || {});
    if (renamed) {
      events.log(req.user, "user_rename", {
        name: renamed.to, details: { from: renamed.from, cases: renamed.cases || 0 },
      });
      // Специалисты в файле журнала записаны именами. Файл
      // пересобирается только при правке проекта, поэтому после
      // переименования его надо пересобрать отдельно — иначе он ещё
      // неделю показывал бы прежнее имя.
      require("./journalExcel").regenerateJournal().catch((err) =>
        console.error("Журнал не пересобрался после переименования:", err.message));
    }
    res.json({ ok: true, renamed: renamed || null });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({ message: "Пользователь с таким логином уже существует" });
    }
    if (err.status === 400) return res.status(400).json({ message: err.message });
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

/* ---------------- Оборудование ----------------
   Папка «База данных / Оборудование» — отражение приборов из «Учёта».
   Обе системы ходят в одну базу, поэтому здесь читается и пишется та же
   таблица instruments: заведённый отсюда прибор появляется в «Учёте»
   мгновенно, а не «когда-нибудь подтянется».

   Права те же, что на саму папку: оборудование лежит в колонке
   «База данных», значит доступ к нему — это can_db. */

function requireEquipmentAccess(req, res) {
  if (req.user.role !== "admin" && !req.user.can_db) {
    res.status(403).json({ message: "Нет доступа к этому разделу" });
    return false;
  }
  return true;
}

function requireEquipmentAdmin(req, res) {
  if (!requireEquipmentAccess(req, res)) return false;
  if (req.user.role !== "admin") {
    res.status(403).json({ message: "Редактировать и удалять приборы может только администратор" });
    return false;
  }
  return true;
}

const EQUIPMENT_EDITABLE = [
  "inventory_no", "name", "serial_number", "model", "check_type", "control_type",
  "company_code", "verification_date", "valid_until", "comment", "qty",
];
const EQUIPMENT_CHECK_TYPES = new Set(["verification", "calibration", "none"]);
const equipmentNullify = (value) => String(value ?? "").trim() || null;
const equipmentQty = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 999) : 1;
};

/**
 * Что за папка открыта и что о ней знает «Учёт».
 *
 * Один запрос на открытие папки: интерфейсу нужно решить, показывать ли
 * кнопку «Добавить прибор», полосу прибора или полосу про постороннее.
 * Заодно здесь же происходит сверка раскладки — так папки приходят
 * в порядок ровно тогда, когда на них смотрят, и отдельный фоновый
 * процесс для этого не нужен.
 */
app.get("/api/equipment/describe", auth.requireAuth, async (req, res) => {
  try {
    if (!requireEquipmentAccess(req, res)) return;
    const path = String(req.query.path || "");
    if (!path.startsWith(equipment.EQUIPMENT_DIR)) return res.json(null);

    // Сверку делаем только в корне: заходя в конкретную папку прибора,
    // человек ждёт, что она откроется, а не что сейчас переедет полсотни
    // соседних.
    if (path.replace(/\/+$/, "") === equipment.EQUIPMENT_DIR) {
      await equipment.sync({ baseUrl: instrumentsBaseUrl(req) });
    }
    res.json(await equipment.describe(path));
  } catch (err) {
    console.error("Оборудование: не удалось описать папку:", err);
    res.status(500).json({ message: "Не удалось прочитать раздел оборудования" });
  }
});

/** Классификации — для выпадающего списка в форме. Из «Учёта», как есть. */
app.get("/api/equipment/control-types", auth.requireAuth, async (req, res) => {
  try {
    if (!requireEquipmentAccess(req, res)) return;
    const types = await equipment.loadControlTypes();
    res.json({ types: [...types.values()] });
  } catch (err) {
    res.json({ types: [] });
  }
});

/** Владельцы (компании) — тоже из «Учёта». */
app.get("/api/equipment/companies", auth.requireAuth, async (req, res) => {
  try {
    if (!requireEquipmentAccess(req, res)) return;
    const { rows } = await db.query("SELECT code, name FROM companies ORDER BY position, code");
    res.json({ companies: rows });
  } catch (err) {
    res.json({ companies: [] });
  }
});

/** Карточки для единого поиска в форме редактирования приборов. */
app.get("/api/equipment/instruments", auth.requireAuth, async (req, res) => {
  try {
    if (!requireEquipmentAdmin(req, res)) return;
    const hasFilter = Object.hasOwn(req.query || {}, "control_type");
    const instruments = await equipment.listInstrumentsForEditor(
      hasFilter ? String(req.query.control_type || "") : undefined
    );
    res.json({ instruments });
  } catch (err) {
    console.error("Оборудование: не удалось получить список приборов:", err);
    res.status(500).json({ message: "Не удалось загрузить список приборов" });
  }
});

/**
 * Завести прибор из файлового менеджера.
 *
 * Поля ровно те же, что в форме «Учёта», — это должна быть одна и та же
 * форма, а не похожая. Пишем в ту же таблицу, поэтому никакой отдельной
 * «синхронизации» не нужно.
 *
 * Сразу после создания раскладываем папку: человек нажал «Сохранить»
 * и должен увидеть папку прибора на месте, а не через сверку когда-нибудь.
 */
app.post("/api/equipment/instruments", auth.requireAuth, async (req, res) => {
  try {
    if (!requireEquipmentAdmin(req, res)) return;
    const body = req.body || {};
    const name = String(body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Укажите название прибора" });

    const check_type = EQUIPMENT_CHECK_TYPES.has(body.check_type) ? body.check_type : "verification";
    const qty = equipmentQty(body.qty);
    if (check_type !== "none" && qty !== 1) {
      return res.status(400).json({
        message: "Для поверки или калибровки каждый экземпляр создаётся отдельной карточкой",
      });
    }

    const { rows } = await db.query(
      `INSERT INTO instruments
         (inventory_no, name, serial_number, model, check_type, control_type,
           company_code, verification_date, valid_until, comment, qty)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        equipmentNullify(body.inventory_no), name, equipmentNullify(body.serial_number), equipmentNullify(body.model),
        check_type, equipmentNullify(body.control_type), equipmentNullify(body.company_code),
        equipmentNullify(body.verification_date), equipmentNullify(body.valid_until),
        String(body.comment || "").trim(), qty,
      ]
    );
    const instrument = rows[0];

    // История «Учёта» — тем же журналом, что и при заведении из «Учёта»:
    // иначе приборы, заведённые отсюда, появлялись бы из ниоткуда.
    await db.query(
      `INSERT INTO history (instrument_id, instrument_name, action, actor_id, actor_name, note)
       VALUES ($1, $2, 'create', $3, $4, $5)`,
      [instrument.id, instrument.name, req.user.id, req.user.username,
       `Добавлен из файлового менеджера (${req.user.username})`]
    ).catch((err) => console.error("Оборудование: не удалось записать историю:", err.message));

    await equipment.sync({ baseUrl: instrumentsBaseUrl(req) });
    const { rows: fresh } = await db.query("SELECT * FROM instruments WHERE id = $1", [instrument.id]);
    events.log(req.user, "upload", { path: fresh[0].folder_path || equipment.EQUIPMENT_DIR, name: instrument.name });
    res.status(201).json({ instrument: fresh[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Прибор с таким инвентарным номером уже есть" });
    }
    if (err.code === "42P01") {
      return res.status(503).json({ message: "Раздел «Учёт оборудования» ещё не развёрнут в этой базе" });
    }
    console.error("Оборудование: не удалось завести прибор:", err);
    res.status(500).json({ message: "Не удалось завести прибор: " + err.message });
  }
});

/** Редактирование той же карточки, которую показывает «Учёт оборудования». */
app.patch("/api/equipment/instruments/:id", auth.requireAuth, async (req, res) => {
  try {
    if (!requireEquipmentAdmin(req, res)) return;
    const id = Number(req.params.id);
    const updates = EQUIPMENT_EDITABLE.filter((key) => Object.hasOwn(req.body || {}, key));
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: "Некорректный номер прибора" });
    if (!updates.length) return res.status(400).json({ message: "Нет изменений для сохранения" });

    const { rows: currentRows } = await db.query(
      `SELECT i.*, COALESCE((SELECT SUM(h.qty)::int FROM instrument_holdings h
                             WHERE h.instrument_id = i.id), 0) AS held_qty
         FROM instruments i WHERE i.id = $1`, [id]
    );
    if (!currentRows.length) return res.status(404).json({ message: "Прибор не найден" });
    const current = currentRows[0];
    const nextCheck = updates.includes("check_type") && EQUIPMENT_CHECK_TYPES.has(req.body.check_type)
      ? req.body.check_type : current.check_type;
    const nextQty = updates.includes("qty") ? equipmentQty(req.body.qty) : equipmentQty(current.qty);
    const changesMultiplicity = nextCheck !== current.check_type || nextQty !== equipmentQty(current.qty);
    if (nextCheck !== "none" && nextQty !== 1 && changesMultiplicity) {
      return res.status(409).json({
        message: "Для поверки или калибровки каждый экземпляр должен иметь отдельную карточку",
      });
    }
    if (nextQty < Number(current.held_qty || 0)) {
      return res.status(409).json({ message: `На руках ${current.held_qty} шт. Сначала примите возврат.` });
    }

    const valueFor = (key) => {
      if (key === "name") return String(req.body[key] || "").trim();
      if (key === "comment") return String(req.body[key] || "").trim();
      if (key === "qty") return nextQty;
      if (key === "check_type") return EQUIPMENT_CHECK_TYPES.has(req.body[key]) ? req.body[key] : "verification";
      return equipmentNullify(req.body[key]);
    };
    if (updates.includes("name") && !valueFor("name")) {
      return res.status(400).json({ message: "Укажите название прибора" });
    }
    const casts = { check_type: "::check_type" };
    const set = updates.map((key, index) => `${key} = $${index + 2}${casts[key] || ""}`).join(", ");
    const { rows } = await db.query(
      `UPDATE instruments SET ${set} WHERE id = $1 RETURNING *`,
      [id, ...updates.map(valueFor)]
    );
    const instrument = rows[0];
    await db.query(
      `INSERT INTO history (instrument_id, instrument_name, action, actor_id, actor_name, note)
       VALUES ($1, $2, 'update', $3, $4, $5)`,
      [instrument.id, instrument.name, req.user.id, req.user.name || req.user.username,
       "Карточка изменена из ИСУ"]
    ).catch((err) => console.error("Оборудование: не удалось записать историю:", err.message));

    await equipment.sync({ baseUrl: instrumentsBaseUrl(req) });
    const { rows: fresh } = await db.query("SELECT * FROM instruments WHERE id = $1", [id]);
    events.log(req.user, "instrument_update", { path: fresh[0].folder_path, name: instrument.name });
    res.json({ instrument: fresh[0] });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ message: "Прибор с таким инвентарным номером уже есть" });
    console.error("Оборудование: не удалось изменить прибор:", err);
    res.status(500).json({ message: "Не удалось сохранить прибор: " + err.message });
  }
});

/** Удаление карточки только из формы. Файлы синхронизация переносит в архив. */
app.delete("/api/equipment/instruments/:id", auth.requireAuth, async (req, res) => {
  let client;
  try {
    if (!requireEquipmentAdmin(req, res)) return;
    const id = Number(req.params.id);
    client = await db.connect();
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT * FROM instruments WHERE id = $1 FOR UPDATE", [id]);
    if (!rows.length) {
      await client.query("ROLLBACK");
      client.release();
      client = null;
      return res.status(404).json({ message: "Прибор не найден" });
    }
    const instrument = rows[0];
    await client.query(
      `INSERT INTO history (instrument_id, instrument_name, action, actor_id, actor_name, note)
       VALUES ($1, $2, 'delete', $3, $4, $5)`,
      [instrument.id, instrument.name, req.user.id, req.user.name || req.user.username,
       "Прибор удалён из ИСУ; папка сохранена в архиве"]
    );
    await client.query("DELETE FROM instruments WHERE id = $1", [id]);
    await client.query("COMMIT");
    client.release();
    client = null;
    await equipment.sync({ baseUrl: instrumentsBaseUrl(req) });
    events.log(req.user, "delete", { path: instrument.folder_path, name: instrument.name });
    res.json({ ok: true });
  } catch (err) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error("Оборудование: не удалось удалить прибор:", err);
    res.status(500).json({ message: "Не удалось удалить прибор: " + err.message });
  } finally {
    if (client) client.release();
  }
});

/**
 * Адрес «Учёта» для QR-кода — из самого запроса.
 *
 * Отсканировал наклейку — попал в карточку прибора на том же сайте,
 * с которого её напечатали. Прописывать домен в настройках не нужно:
 * при переезде сайта коды перерисуются сами, по новому адресу.
 * INSTRUMENTS_PUBLIC_URL остаётся на случай, когда сервер стоит за
 * чем-то, что не сообщает настоящий адрес.
 */
function instrumentsBaseUrl(req) {
  if (process.env.INSTRUMENTS_PUBLIC_URL) return process.env.INSTRUMENTS_PUBLIC_URL;
  const host = req.get("x-forwarded-host") || req.get("host");
  if (!host) return "/instruments/";
  const proto = req.get("x-forwarded-proto") || req.protocol || "https";
  return `${proto}://${host}/instruments/`;
}

/**
 * Наклейки с QR — все коды одним архивом.
 *
 * Перед сборкой перерисовываем: адрес сайта мог поменяться, а печатать
 * наклейку с кодом, ведущим в никуда, — худшее, что тут может случиться.
 * Списанные приборы в архив не идут: наклейки нужны на рабочие.
 */
app.get("/api/equipment/qr-archive", auth.requireAuth, async (req, res) => {
  try {
    if (!requireEquipmentAccess(req, res)) return;
    await equipment.sync({ baseUrl: instrumentsBaseUrl(req) });
    await equipment.rebuildQr(instrumentsBaseUrl(req));

    const items = await equipment.qrFiles();
    if (!items.length) return res.status(404).json({ message: "QR-кодов пока нет" });

    const fileName = "Наклейки с QR.zip";
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition",
      `attachment; filename="qr.zip"; filename*=UTF-8''${encodeURIComponent(fileName)}`);

    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.on("error", (err) => {
      console.error("Оборудование: не удалось собрать архив QR:", err);
      res.destroy();
    });
    archive.pipe(res);
    // Плоский архив, имя файла = имя папки прибора: распаковал и сразу
    // видно, какая наклейка на какой прибор.
    for (const item of items) archive.file(filesLib.safeResolve(item.path), { name: item.name });
    await archive.finalize();
  } catch (err) {
    console.error("Оборудование: не удалось выдать QR:", err);
    res.status(500).json({ message: "Не удалось собрать архив: " + err.message });
  }
});

/**
 * Перерисовать QR у всех приборов и разложить по их папкам.
 *
 * Этим же адресом пользуется кнопка «Выгрузить все QR-коды» в «Учёте»:
 * раньше она складывала всё плоским списком в одну общую папку, теперь
 * каждый код лежит у своего прибора.
 */
app.post("/api/equipment/qr-rebuild", auth.requireAuth, async (req, res) => {
  try {
    if (!requireEquipmentAccess(req, res)) return;
    await equipment.sync({ baseUrl: instrumentsBaseUrl(req) });
    const count = await equipment.rebuildQr(instrumentsBaseUrl(req));
    res.json({ count });
  } catch (err) {
    console.error("Оборудование: не удалось разложить QR:", err);
    res.status(500).json({ message: "Не удалось разложить QR-коды: " + err.message });
  }
});

/**
 * Куда класть файл, загруженный с компьютера.
 *
 * Сам файл идёт обычной загрузкой /api/upload — сюда браузер только
 * спрашивает адрес папки. Так у оборудования не появляется своего
 * приёма файлов со своими ограничениями размера и своей проверкой прав.
 */
app.get("/api/equipment/upload-dir", auth.requireAuth, async (req, res) => {
  try {
    if (!requireEquipmentAccess(req, res)) return;
    const dir = await equipment.uploadDirFor(Number(req.query.id), req.query.kind);
    res.json({ path: dir });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

/**
 * Отметить загруженный файл фотографией прибора (или документом поверки).
 *
 * Сюда приходит ровно то, что человек сам приложил в форме прибора,
 * поэтому прежняя ссылка заменяется: приложили новое свидетельство —
 * карточка должна показывать новое.
 */
app.post("/api/equipment/adopt-file", auth.requireAuth, async (req, res) => {
  try {
    if (!requireEquipmentAccess(req, res)) return;
    const adopted = await equipment.adoptUploadedFile(
      Number(req.body?.id), String(req.body?.path || ""), req.body?.kind
    );
    res.json({ adopted });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ---------------- Гарантийные письма (ГП) ---------------- */

// Устройство папки эксперта, сборка "Сведения.docx" и разбор приложений
// живут в отдельном модуле — здесь только маршруты.
const EXPERTS_DIR = expertsLib.EXPERTS_DIR;
const EXPERT_INFO_FILENAME = expertsLib.INFO_FILENAME;

function isManagedExpertPath(value) {
  const clean = String(value || "").replace(/\\/g, "/").replace(/\/+$/, "");
  return clean === EXPERTS_DIR || clean.startsWith(EXPERTS_DIR + "/");
}

function rejectManagedExpertMutation(res, ...pathsToCheck) {
  if (!pathsToCheck.some(isManagedExpertPath)) return false;
  res.status(409).json({
    message: "Папки и файлы экспертов изменяются только через форму «Редактировать эксперта»",
  });
  return true;
}

function rejectManagedEquipmentFolderMutation(res, relPath) {
  const reason = equipment.deleteGuard(relPath);
  if (!reason) return false;
  res.status(409).json({ message: reason });
  return true;
}

function requireExpertsAccess(req, res) {
  if (req.user.role !== "admin" && !req.user.can_db) {
    res.status(403).json({ message: "Нет доступа к этому разделу" });
    return false;
  }
  return true;
}

/**
 * Список экспертов.
 *
 * Отдаём и тех, у кого ещё нет "Сведения.docx": папка эксперта может быть
 * заведена, а файл — не дописан. Раньше такой эксперт просто не появлялся
 * в списке, и было непонятно, потерялся он или его не заводили. Теперь он
 * виден с пометкой has_info = false, а выбрать его для ГП по-прежнему
 * нельзя — брать в письмо нечего.
 */
app.get("/api/experts", auth.requireAuth, async (req, res) => {
  try {
    if (!requireExpertsAccess(req, res)) return;
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
      experts.push({
        name: entry.name,
        path: expertsLib.expertPath(entry.name),
        has_info: await expertsLib.hasInfo(filesLib.safeResolve, entry.name),
        attachments: await expertsLib.listAttachments(filesLib.safeResolve, entry.name),
      });
    }
    experts.sort((a, b) => a.name.localeCompare(b.name, "ru"));
    res.json({ experts });
  } catch (err) {
    console.error("Не удалось получить список экспертов:", err);
    res.status(500).json({ message: "Не удалось получить список экспертов" });
  }
});

/**
 * Завести эксперта — только папка и подпапка «Приложения».
 *
 * Сведения сюда больше не идут. Раньше их набирали прямо здесь или
 * приносили готовым файлом, и получалось, что у одного эксперта
 * сведения — набор абзацев, у другого — чужой файл неизвестного
 * устройства, а сканы лежат рядом и ни с чем не связаны. Теперь
 * сведения заводит отдельный инструмент, один для всех, и он же
 * связывает пункт с подтверждающим документом.
 */
app.post("/api/experts", auth.requireAuth, async (req, res) => {
  try {
    if (!requireExpertsAccess(req, res)) return;

    const expert = await expertsLib.createExpert(filesLib.safeResolve, {
      name: req.body?.name,
    });

    events.log(req.user, "upload", { path: expert.path, name: expert.name });
    res.status(201).json({ expert });
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error("Не удалось завести эксперта:", err);
    res.status(status).json({
      message: status === 500 ? "Не удалось завести эксперта" : err.message,
    });
  }
});

/* ---------- Сведения об эксперте: пункты и подтверждающие сканы ----------

   Раньше сведения приносили готовым файлом и просто клали в папку, а
   сканы лежали рядом кучей. Связи «этот диплом подтверждает этот пункт»
   не было ни на диске, ни в голове у системы — и в письмо документы
   уходили в том порядке, в каком их когда-то назвали.

   Теперь сведения — это список пунктов, у каждого свои сканы. Из них
   собираются два файла в папке эксперта и приложение к ГП, и порядок
   везде один и тот же. */

/** Папка эксперта по имени + проверка, что она вообще есть. */
async function expertDirOr404(name, res) {
  let clean;
  try {
    clean = expertsLib.normalizeName(name);
  } catch (err) {
    res.status(400).json({ message: err.message });
    return null;
  }
  const dir = expertsLib.expertPath(clean);
  try {
    const stat = await fs.promises.stat(filesLib.safeResolve(dir));
    if (!stat.isDirectory()) throw new Error("не папка");
  } catch {
    res.status(404).json({ message: `Эксперта «${clean}» нет в папке экспертов` });
    return null;
  }
  return { name: clean, dir };
}

/**
 * Переименовать эксперта.
 *
 * Отдельным действием, а не полем в общем сохранении: это правка,
 * которая задевает проекты, и подтверждать её надо осознанно.
 */
app.patch("/api/experts/:name", auth.requireAuth, async (req, res) => {
  try {
    if (!requireExpertsAccess(req, res)) return;
    const found = await expertDirOr404(req.params.name, res);
    if (!found) return;

    const result = await expertsLib.renameExpert(filesLib.safeResolve, {
      rebuildDocs: expertInfo.rebuildDocs,
      readItems: expertInfo.read,
    }, found.name, req.body?.name);

    if (result.renamed) {
      events.log(req.user, "rename", {
        path: expertsLib.expertPath(result.to),
        name: `Эксперт «${result.from}» → «${result.to}»`,
      });
    }
    res.json({ ok: true, ...result });
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error("Не удалось переименовать эксперта:", err);
    res.status(status).json({
      message: status === 500 ? "Не удалось переименовать эксперта" : err.message,
    });
  }
});

/** Все сканы эксперта и то, к каким пунктам они прикреплены. */
app.get("/api/experts/:name/scans", auth.requireAuth, async (req, res) => {
  try {
    if (!requireExpertsAccess(req, res)) return;
    const found = await expertDirOr404(req.params.name, res);
    if (!found) return;

    const stored = await expertInfo.read(filesLib.safeResolve, found.dir);
    const usedBy = new Map();
    stored.items.forEach((item, i) => {
      for (const file of item.files) {
        if (!usedBy.has(file)) usedBy.set(file, []);
        usedBy.get(file).push(i + 1);
      }
    });
    const scans = await expertsLib.listAttachments(filesLib.safeResolve, found.name);
    res.json({
      scans: scans.map((s) => ({ name: s.name, path: s.path, items: usedBy.get(s.name) || [] })),
    });
  } catch (err) {
    console.error("Не удалось прочитать приложения эксперта:", err);
    res.status(500).json({ message: "Не удалось прочитать приложения" });
  }
});

/**
 * Убрать скан с диска.
 *
 * В корзину, а не насовсем: сканы — подтверждающие документы, и вернуть
 * ошибочно удалённый должно быть можно. Из пунктов ссылка на него
 * убирается здесь же, иначе следующее сохранение собрало бы документ с
 * дырой на месте картинки.
 */
app.delete("/api/experts/:name/scans/:file", auth.requireAuth, async (req, res) => {
  try {
    if (!requireExpertsAccess(req, res)) return;
    const found = await expertDirOr404(req.params.name, res);
    if (!found) return;

    const fileName = path.basename(String(req.params.file));
    const relPath = `${found.dir}/${expertInfo.ATTACH_DIRNAME}/${fileName}`;
    await trash.moveToTrash(relPath, req.user.id);

    const stored = await expertInfo.read(filesLib.safeResolve, found.dir);
    const items = stored.items.map((item) => ({
      ...item,
      files: item.files.filter((f) => f !== fileName),
      image_options: Object.fromEntries(
        Object.entries(item.image_options || {}).filter(([name]) => name !== fileName)
      ),
    }));
    if (items.length) {
      await expertInfo.write(filesLib.safeResolve, found.dir, items);
      await expertInfo.rebuildDocs(filesLib.safeResolve, found.dir, found.name, items);
    }
    events.log(req.user, "delete", { path: relPath, name: fileName });
    res.json({ ok: true, items });
  } catch (err) {
    console.error("Не удалось убрать скан:", err);
    res.status(400).json({ message: "Не удалось убрать скан: " + err.message });
  }
});

/** Удалить эксперта целиком — папку со всем содержимым, в корзину. */
app.delete("/api/experts/:name", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    if (!requireExpertsAccess(req, res)) return;
    const found = await expertDirOr404(req.params.name, res);
    if (!found) return;

    await trash.moveToTrash(found.dir, req.user.id);
    events.log(req.user, "delete", { path: found.dir, name: found.name });
    res.json({ ok: true });
  } catch (err) {
    console.error("Не удалось удалить эксперта:", err);
    res.status(400).json({ message: "Не удалось удалить эксперта: " + err.message });
  }
});

app.get("/api/experts/:name/info", auth.requireAuth, async (req, res) => {
  try {
    if (!requireExpertsAccess(req, res)) return;
    const found = await expertDirOr404(req.params.name, res);
    if (!found) return;

    let stored = await expertInfo.read(filesLib.safeResolve, found.dir);
    let imported = null;
    // Пунктов ещё нет, но старый файл со сведениями лежит — показываем
    // его текст пунктами. Ничего не сохраняем: человек сначала увидит,
    // что подтянулось, и только его «Сохранить» это закрепит.
    if (!stored.items.length) {
      const legacy = await expertInfo.importLegacy(
        filesLib.safeResolve, found.dir, found.name, gpGenerate.extractParagraphTexts);
      if (legacy.items.length) {
        stored = { items: legacy.items };
        imported = legacy.from;
      }
    }

    res.json({
      name: found.name,
      items: stored.items,
      imported,
      broken: Boolean(stored.broken),
      scans: (await expertsLib.listAttachments(filesLib.safeResolve, found.name))
        .map((a) => a.name),
    });
  } catch (err) {
    console.error("Не удалось прочитать сведения эксперта:", err);
    res.status(500).json({ message: "Не удалось прочитать сведения эксперта" });
  }
});

/**
 * Сохранить пункты и пересобрать оба файла сведений.
 *
 * Сканы к этому моменту уже лежат в папке «Приложения» — их кладёт
 * отдельный запрос ниже. Здесь только порядок и привязка: так правку
 * текста можно сохранить, даже если сеть отвалилась на середине
 * загрузки картинок.
 */
app.put("/api/experts/:name/info", auth.requireAuth, async (req, res) => {
  try {
    if (!requireExpertsAccess(req, res)) return;
    const found = await expertDirOr404(req.params.name, res);
    if (!found) return;

    const raw = Array.isArray(req.body?.items) ? req.body.items : [];
    const items = raw
      .map((it) => ({
        text: String(it?.text ?? "").replace(/\s+/g, " ").trim(),
        files: (Array.isArray(it?.files) ? it.files : [])
          .map((f) => path.basename(String(f)))
          .filter(Boolean),
        image_options: Object.fromEntries(
          Object.entries(it?.image_options && typeof it.image_options === "object" ? it.image_options : {})
            .map(([name, options]) => [path.basename(String(name)), expertInfo.normalizeImageOptions(options)])
        ),
      }))
      .filter((it) => it.text);
    if (!items.length) {
      return res.status(400).json({ message: "Добавьте хотя бы один пункт сведений" });
    }

    await expertInfo.write(filesLib.safeResolve, found.dir, items);
    const { missing } = await expertInfo.rebuildDocs(
      filesLib.safeResolve, found.dir, found.name, items);

    events.log(req.user, "upload", {
      path: `${found.dir}/${expertInfo.infoFileName(found.name)}`,
      name: expertInfo.infoFileName(found.name),
    });
    res.json({
      ok: true,
      items,
      missing,
      preview_path: `${found.dir}/${expertInfo.infoWithDocsFileName(found.name)}`,
    });
  } catch (err) {
    console.error("Не удалось сохранить сведения эксперта:", err);
    res.status(500).json({ message: "Не удалось сохранить сведения эксперта" });
  }
});

/**
 * Скан к пункту.
 *
 * Принимаем только картинки — их и только их можно вшить в Word. PDF
 * пришлось бы сначала превращать в изображения, а это отдельный
 * инструмент на сервере, который иногда не срабатывает; молча положить
 * в папку файл, который не попадёт ни в один документ, хуже, чем сразу
 * сказать «сфотографируйте или сохраните картинкой».
 */
app.post("/api/experts/:name/scans", auth.requireAuth, upload.single("file"),
  cleanupTempUpload, async (req, res) => {
  try {
    if (!requireExpertsAccess(req, res)) return;
    const found = await expertDirOr404(req.params.name, res);
    if (!found) return;
    if (!req.file) return res.status(400).json({ message: "Файл не получен" });

    const buffer = await fs.promises.readFile(req.file.path);
    const ext = docxImages.imageExtension(buffer);
    if (!ext) {
      return res.status(400).json({
        message: "Это не картинка. Скан нужен изображением — JPG или PNG: " +
          "только его можно вшить в документ Word.",
      });
    }

    const originalName = Buffer.from(req.file.originalname, "latin1").toString("utf8");
    const attachDirRel = `${found.dir}/${expertInfo.ATTACH_DIRNAME}`;
    const attachDirAbs = filesLib.safeResolve(attachDirRel);
    await fs.promises.mkdir(attachDirAbs, { recursive: true });

    // Имя с таким же названием уже есть — не затираем: у эксперта вполне
    // может быть два «Диплом.jpg» с разных курсов.
    const base = path.basename(originalName).replace(/[\\/]/g, "-") || `Скан.${ext}`;
    let fileName = base;
    for (let i = 2; fs.existsSync(path.join(attachDirAbs, fileName)); i++) {
      const dot = base.lastIndexOf(".");
      fileName = dot > 0 ? `${base.slice(0, dot)} (${i})${base.slice(dot)}` : `${base} (${i})`;
    }

    await fs.promises.writeFile(path.join(attachDirAbs, fileName), buffer);
    events.log(req.user, "upload", { path: `${attachDirRel}/${fileName}`, name: fileName });
    res.status(201).json({ name: fileName });
  } catch (err) {
    console.error("Не удалось сохранить скан:", err);
    res.status(500).json({ message: "Не удалось сохранить скан" });
  }
});

/* ---------- Образцы гарантийного письма ----------

   Образцы правятся прямо на сайте тем же редактором OnlyOffice, которым
   в системе открываются остальные документы: это настоящие страницы
   Word со всем оформлением, колонтитулами и отступами.

   Заводить, править, скачивать и удалять образцы может только
   администратор. ВЫБИРАТЬ образец при создании письма — любой, кто это
   письмо создаёт: иначе смысл теряется. Поэтому список отдаётся двумя
   разными адресами с разными правами. */

/** Короткий список для формы создания ГП — без состояния меток. */
app.get("/api/gp/templates", auth.requireAuth, async (req, res) => {
  try {
    const { items, defaultId } = await gpTemplate.listSamples(filesLib.safeResolve, { withState: false });
    res.json({ items: items.map((i) => ({ id: i.id, name: i.name, isDefault: i.isDefault })), defaultId });
  } catch (err) {
    console.error("Не удалось прочитать список образцов ГП:", err);
    res.status(500).json({ message: "Не удалось прочитать список образцов" });
  }
});

app.get("/api/admin/gp-templates", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const list = await gpTemplate.listSamples(filesLib.safeResolve);
    res.json({ ...list, required: gpTemplate.REQUIRED, optional: gpTemplate.OPTIONAL });
  } catch (err) {
    console.error("Не удалось прочитать образцы ГП:", err);
    res.status(500).json({ message: "Не удалось прочитать образцы писем" });
  }
});

app.post("/api/admin/gp-templates", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const created = await gpTemplate.createSample(filesLib.safeResolve, {
      name: req.body?.name,
      fromId: req.body?.fromId,
    });
    events.log(req.user, "settings_change", {
      path: gpTemplate.fileOf(created.id), name: `Образец ГП «${created.name}» заведён`,
    });
    res.status(201).json({ ok: true, ...created });
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error("Не удалось завести образец ГП:", err);
    res.status(status).json({ message: status === 500 ? "Не удалось завести образец" : err.message });
  }
});

app.patch("/api/admin/gp-templates/:id", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    if (req.body?.name !== undefined) {
      await gpTemplate.renameSample(filesLib.safeResolve, req.params.id, req.body.name);
    }
    if (req.body?.isDefault) {
      await gpTemplate.setDefault(filesLib.safeResolve, req.params.id);
    }
    res.json({ ok: true, ...(await gpTemplate.listSamples(filesLib.safeResolve)) });
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error("Не удалось изменить образец ГП:", err);
    res.status(status).json({ message: status === 500 ? "Не удалось изменить образец" : err.message });
  }
});

app.delete("/api/admin/gp-templates/:id", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const removed = await gpTemplate.removeSample(filesLib.safeResolve, req.params.id);
    events.log(req.user, "settings_change", {
      path: gpTemplate.fileOf(removed.id), name: `Образец ГП «${removed.name}» удалён`,
    });
    res.json({ ok: true, ...(await gpTemplate.listSamples(filesLib.safeResolve)) });
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error("Не удалось удалить образец ГП:", err);
    res.status(status).json({ message: status === 500 ? "Не удалось удалить образец" : err.message });
  }
});

app.post("/api/admin/gp-templates/:id/reset", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const to = String(req.body?.to || "original");
    if (to === "backup") await gpTemplate.restoreBackup(filesLib.safeResolve, req.params.id);
    else await gpTemplate.resetToOriginal(filesLib.safeResolve, req.params.id);
    res.json({ ok: true, ...(await gpTemplate.listSamples(filesLib.safeResolve)) });
  } catch (err) {
    const status = err.status || 500;
    if (status === 500) console.error("Не удалось вернуть образец ГП:", err);
    res.status(status).json({ message: status === 500 ? "Не удалось вернуть образец" : err.message });
  }
});

/**
 * Настройки редактора для образца.
 *
 * Отдельно от общего /api/onlyoffice/config: тот отвечает за файлы в
 * колонках и проверяет права по папкам, а образцы лежат вне колонок и
 * правятся только администратором. Смешивать две проверки — значит
 * однажды открыть шаблон тому, кому открыт всего лишь раздел «Файлы».
 */
app.get("/api/admin/gp-templates/:id/editor", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const { item } = await gpTemplate.find(filesLib.safeResolve, req.params.id);
    const { config, scriptUrl } = onlyoffice.buildEditorConfig({
      relPath: gpTemplate.fileOf(item.id),
      fileName: `${item.name}.docx`,
      userId: req.user.id,
      userName: req.user.name || req.user.username,
      canEdit: true,
    });
    res.json({ config, scriptUrl });
  } catch (err) {
    console.error("Не удалось открыть образец ГП:", err);
    res.status(err.status || 400).json({ message: err.message });
  }
});

/** Скачать образец — только администратору: это рабочий документ конторы. */
app.get("/api/admin/gp-templates/:id/download", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const { item, buffer } = await gpTemplate.readSample(filesLib.safeResolve, req.params.id);
    res.setHeader("Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(item.name + ".docx")}`);
    res.send(buffer);
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message });
  }
});

/* ---------------- Гарантийное письмо ---------------- */

/**
 * ПОЧЕМУ ПИСЬМО СНАЧАЛА ПОКАЗЫВАЮТ, А ПОТОМ СОХРАНЯЮТ.
 *
 * Письмо уходит в суд. Пока оно собиралось сразу в папку дела, ошибку
 * было видно только там же: в папке оставался файл «вроде не тот», рядом
 * появлялся второй, и через месяц никто не мог сказать, какой отправляли.
 *
 * Теперь письмо собирается в черновик (см. gpDraft.js), показывается
 * целиком — обоими файлами, с приложением и без, — и переезжает в дело
 * только по кнопке «Сохранить».
 *
 * Проверки у предпросмотра и у сохранения ОДНИ И ТЕ ЖЕ и живут в
 * prepareGp: два пути, проверяющих «почти одно и то же», однажды
 * разойдутся, и один начнёт пускать то, что другой не пускает.
 */

/** Кто имеет право создавать файлы в папке проекта. */
async function assertCanWriteToCase(req, kase) {
  if (req.user.role === "admin") return;
  if (!req.user.can_cases) {
    const err = new Error("Нет доступа к этому разделу");
    err.status = 403;
    throw err;
  }
  const rules = await folderAccess.getUserRules(req.user.id);
  if (folderAccess.resolveAccess(rules, kase.folder_path) !== "write") {
    const err = new Error("Нет прав на создание файлов в этом проекте");
    err.status = 403;
    throw err;
  }
}

function gpFail(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * Эксперты для письма: сведения пунктами и сканы в порядке пунктов.
 *
 * Читается заново и при предпросмотре, и при сохранении — намеренно:
 * между «посмотрел» и «сохранил» сканы могли добавить или удалить, и
 * письмо должно уйти с тем, что есть сейчас, а не с тем, что было.
 */
async function readExpertsForGp(expertPaths) {
  const experts = [];
  for (const p of expertPaths) {
    // Проверяем не только начало пути, но и отсутствие ".." — иначе
    // "/База данных/Эксперты/../../<чужая папка>" проходило проверку.
    if (typeof p !== "string" || !p.startsWith(EXPERTS_DIR + "/") || p.split(/[\\/]/).includes("..")) {
      throw gpFail("Недопустимый путь к папке эксперта");
    }
    const name = path.basename(p); // имя папки эксперта — как он подписывается в письме

    // Сведения берём из пунктов, а не из .docx: в пунктах есть то, чего
    // в файле нет и быть не может, — какой скан какой пункт
    // подтверждает. Файл остаётся выгрузкой для чтения.
    const stored = await expertInfo.read(filesLib.safeResolve, p);
    let items = stored.items;
    if (!items.length) {
      // Эксперт заведён до этой правки: пунктов ещё нет, но текст
      // лежит в старом файле. Берём его — без сканов, но письмо
      // должно получиться.
      const legacy = await expertInfo.importLegacy(
        filesLib.safeResolve, p, name, gpGenerate.extractParagraphTexts);
      items = legacy.items;
    }
    if (!items.length) {
      throw gpFail(`У эксперта «${name}» не заполнены сведения. ` +
        "Откройте «Сведения об эксперте» в папке «Эксперты».");
    }

    // Сканы — в порядке пунктов: первым в биографии стоит диплом,
    // значит первым подтверждением в приложении будет он же.
    const scans = [];
    for (const item of items) {
      for (const fileName of item.files) {
        try {
          scans.push({
            name: fileName,
            options: item.image_options?.[fileName],
            buffer: await fs.promises.readFile(
              filesLib.safeResolve(`${p}/${expertInfo.ATTACH_DIRNAME}/${fileName}`)),
          });
        } catch {
          // Скан удалили мимо системы — письмо всё равно должно уйти.
        }
      }
    }
    experts.push({ name, descLines: items.map((i) => i.text), scans });
  }
  return experts;
}

/* ---------------- Документы по шаблонам ---------------- */

app.get("/api/documents/catalog", auth.requireAuth, (req, res) => {
  res.json({ items: documentTypes.publicCatalog() });
});

app.get("/api/documents/templates/:type", auth.requireAuth, async (req, res) => {
  try {
    const type = documentTypes.get(req.params.type).id;
    const list = await documentTemplate.listSamples(filesLib.safeResolve, type, { withState: false });
    res.json(list);
  } catch (err) { res.status(err.status || 500).json({ message: err.message }); }
});

app.get("/api/admin/document-templates/:type", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try { res.json(await documentTemplate.listSamples(filesLib.safeResolve, documentTypes.get(req.params.type).id)); }
  catch (err) { res.status(err.status || 500).json({ message: err.message }); }
});
app.post("/api/admin/document-templates/:type", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const type = documentTypes.get(req.params.type).id;
    const created = await documentTemplate.createSample(filesLib.safeResolve, type, req.body || {});
    events.log(req.user, "settings_change", { path: documentTemplate.fileOf(type, created.id), name: `Создан образец «${created.name}»` });
    res.status(201).json({ ok: true, ...created });
  } catch (err) { res.status(err.status || 500).json({ message: err.message }); }
});
app.patch("/api/admin/document-templates/:type/:id", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const type = documentTypes.get(req.params.type).id;
    await documentTemplate.updateSample(filesLib.safeResolve, type, req.params.id, {
      name: req.body?.name, makeDefault: Boolean(req.body?.isDefault),
    });
    res.json({ ok: true, ...(await documentTemplate.listSamples(filesLib.safeResolve, type)) });
  } catch (err) { res.status(err.status || 500).json({ message: err.message }); }
});
app.delete("/api/admin/document-templates/:type/:id", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const type = documentTypes.get(req.params.type).id;
    await documentTemplate.removeSample(filesLib.safeResolve, type, req.params.id);
    res.json({ ok: true, ...(await documentTemplate.listSamples(filesLib.safeResolve, type)) });
  } catch (err) { res.status(err.status || 500).json({ message: err.message }); }
});
app.post("/api/admin/document-templates/:type/:id/reset", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const type = documentTypes.get(req.params.type).id;
    await documentTemplate.restore(filesLib.safeResolve, type, req.params.id, req.body?.to);
    res.json({ ok: true, ...(await documentTemplate.listSamples(filesLib.safeResolve, type)) });
  } catch (err) { res.status(err.status || 500).json({ message: err.message }); }
});
app.get("/api/admin/document-templates/:type/:id/editor", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const type = documentTypes.get(req.params.type).id;
    const { item } = await documentTemplate.find(filesLib.safeResolve, type, req.params.id);
    const { config, scriptUrl } = onlyoffice.buildEditorConfig({
      relPath: documentTemplate.fileOf(type, item.id), fileName: `${item.name}.docx`,
      userId: req.user.id, userName: req.user.name || req.user.username, canEdit: true,
    });
    res.json({ config, scriptUrl });
  } catch (err) { res.status(err.status || 500).json({ message: err.message }); }
});
app.get("/api/admin/document-templates/:type/:id/download", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const type = documentTypes.get(req.params.type).id;
    const { item, buffer } = await documentTemplate.readSample(filesLib.safeResolve, type, req.params.id);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(item.name + ".docx")}`);
    res.send(buffer);
  } catch (err) { res.status(err.status || 500).json({ message: err.message }); }
});

function documentOutputDir(type, kase) {
  if (type.folder === "planning-contract") return `${kase.folder_path}/Планирование проекта/Договор`;
  if (type.folder === "planning-correspondence") return `${kase.folder_path}/Планирование проекта/Переписка`;
  if (type.folder === "conclusion") return `${kase.folder_path}/${kase.name}/Заключение`;
  return `${kase.folder_path}/${kase.name}/Организационные документы/Ходатайства`;
}
function safeDocumentName(value) {
  return String(value || "документ").replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
}
function requiredDocumentFields(type, data, files) {
  for (const [name, title, kind, required] of type.fields) {
    if (!required) continue;
    const value = kind === "files" ? files : data[name];
    if ((Array.isArray(value) && !value.length) || (!Array.isArray(value) && !String(value ?? "").trim())) {
      throw gpFail(`Заполните поле «${title}»`);
    }
  }
  if (type.id === "stitch") {
    const count = Number(data.cardCount);
    if (!Number.isInteger(count) || count < 2 || count > 12 || count % 2) {
      throw gpFail("Количество карточек должно быть чётным: от 2 до 12");
    }
  }
}

app.post("/api/documents/:type/preview", auth.requireAuth,
  upload.array("attachments", 20), cleanupTempUpload, async (req, res) => {
  try {
    const type = documentTypes.get(req.params.type);
    const data = JSON.parse(req.body?.payload || "{}");
    const caseId = Number(data.caseId);
    if (!caseId) throw gpFail("Выберите проект");
    const { rows } = await db.query("SELECT * FROM cases WHERE id = $1 AND deleted_at IS NULL", [caseId]);
    if (!rows.length) throw gpFail("Проект не найден или удалён", 404);
    const kase = rows[0];
    await assertCanWriteToCase(req, kase);
    requiredDocumentFields(type, data, req.files || []);

    const expertPaths = Array.isArray(data.expertPaths) ? data.expertPaths : [];
    const experts = expertPaths.length ? await readExpertsForGp(expertPaths) : [];
    data.addedExpertsShort = experts.map((x) => x.name).join(", ");
    if (data.removedExpertShort && data.removedExpertShort.includes("/")) data.removedExpertShort = path.basename(data.removedExpertShort);
    const attachments = [];
    for (const file of req.files || []) {
      const buffer = await fs.promises.readFile(file.path);
      if (!docxImages.imageSize(buffer)) throw gpFail(`Файл «${file.originalname}» не является изображением JPEG или PNG`);
      attachments.push({ name: file.originalname, buffer });
    }
    const { item: sample, buffer: templateBuffer } = await documentTemplate.readSample(filesLib.safeResolve, type.id, data.templateId);
    const state = documentTemplate.inspect(type.id, templateBuffer);
    if (!state.ok) throw gpFail(`Образец «${sample.name}» повреждён: не хватает ${state.missing.map((x) => x.token).join(", ")}`);
    const buffer = documentGenerate.generate(type.id, data, templateBuffer, { experts, attachmentFiles: attachments });
    const outputDir = documentOutputDir(type, kase);
    const suffix = safeDocumentName(data.caseNumber || kase.case_number || kase.name);
    const fileName = `${type.filePrefix} ${suffix}.docx`;
    if (fs.existsSync(path.join(filesLib.safeResolve(outputDir), fileName))) throw gpFail(`Файл «${fileName}» уже существует`);
    const draft = await documentDraft.create(filesLib.safeResolve, { userId: req.user.id, buffer, meta: {
      type: type.id, caseId, caseFolderPath: kase.folder_path, outputDir, fileName,
    } });
    res.json({ ok: true, draftId: draft.id, fileName, outputDir });
  } catch (err) {
    if (!err.status) console.error("Не удалось собрать документ:", err);
    res.status(err.status || 500).json({ message: err.status ? err.message : "Не удалось собрать документ: " + err.message });
  }
});
app.get("/api/documents/preview/:id/editor", auth.requireAuth, async (req, res) => {
  try {
    const meta = await documentDraft.read(filesLib.safeResolve, req.params.id, req.user.id);
    const { config, scriptUrl } = onlyoffice.buildEditorConfig({
      relPath: documentDraft.filePath(meta), fileName: meta.fileName,
      userId: req.user.id, userName: req.user.name || req.user.username, canEdit: true,
    });
    res.json({ config, scriptUrl });
  } catch (err) { res.status(err.status || 500).json({ message: err.message }); }
});
app.post("/api/documents/preview/:id/save", auth.requireAuth, async (req, res) => {
  try {
    const meta = await documentDraft.read(filesLib.safeResolve, req.params.id, req.user.id);
    const { rows } = await db.query("SELECT * FROM cases WHERE id = $1 AND deleted_at IS NULL", [meta.caseId]);
    if (!rows.length) throw gpFail("Проект не найден или удалён", 404);
    await assertCanWriteToCase(req, rows[0]);
    const dir = filesLib.safeResolve(meta.outputDir);
    await fs.promises.mkdir(dir, { recursive: true });
    const target = path.join(dir, meta.fileName);
    if (fs.existsSync(target)) throw gpFail(`Файл «${meta.fileName}» уже существует`);
    await fs.promises.copyFile(filesLib.safeResolve(documentDraft.filePath(meta)), target);
    events.log(req.user, "document_generate", { path: `${meta.outputDir}/${meta.fileName}`, name: meta.fileName });
    await documentDraft.remove(filesLib.safeResolve, meta.id);
    res.json({ ok: true, name: meta.fileName, path: `${meta.outputDir}/${meta.fileName}`, caseFolderPath: meta.caseFolderPath });
  } catch (err) { res.status(err.status || 500).json({ message: err.message }); }
});
app.delete("/api/documents/preview/:id", auth.requireAuth, async (req, res) => {
  try { const meta = await documentDraft.read(filesLib.safeResolve, req.params.id, req.user.id); await documentDraft.remove(filesLib.safeResolve, meta.id); res.json({ ok: true }); }
  catch (err) { res.status(err.status || 500).json({ message: err.message }); }
});

/** Имена файлов письма. Одно место на всё: их сверяют ещё и на занятость. */
function gpFileNames(caseNumber) {
  const safe = String(caseNumber || "без номера").replace(/[\\/]/g, "-");
  return {
    plainName: `ГП по делу № ${safe}.docx`,
    withDocsName: `ГП по делу № ${safe} с приложением.docx`,
  };
}

/** Проверяем ОБА имени разом: иначе одно ляжет, а второе упадёт. */
function assertNamesFree(destDir, names) {
  for (const name of names) {
    if (fs.existsSync(path.join(destDir, name))) {
      throw gpFail(`Файл «${name}» уже есть в этом проекте`);
    }
  }
}

/**
 * Всё, что нужно для письма: проект, права, данные, образец.
 * Бросает ошибку с полем status — её и отдают запросы.
 */
async function prepareGp(req) {
  const body = req.body || {};

  // ГП всегда привязано к проекту — сохраняется прямо в его
  // "Планирование проекта/ГП", а не в общую фиксированную папку.
  const caseId = Number(body.caseId);
  if (!caseId) throw gpFail("Выберите проект, к которому относится ГП");

  const { rows: caseRows } = await db.query(
    "SELECT * FROM cases WHERE id = $1 AND deleted_at IS NULL", [caseId]);
  if (!caseRows.length) throw gpFail("Проект не найден или удалён", 404);

  const kase = caseRows[0];
  const gpOutputDir = `${kase.folder_path}/Планирование проекта/ГП`;
  await assertCanWriteToCase(req, kase);

  const questions = Array.isArray(body.questions)
    ? body.questions.map((q) => String(q || "").trim()).filter(Boolean) : [];
  const expertPaths = Array.isArray(body.expertPaths) ? body.expertPaths : [];
  if (!questions.length) throw gpFail("Добавьте хотя бы один вопрос экспертизы");
  if (!expertPaths.length) throw gpFail("Выберите хотя бы одного эксперта");

  const experts = await readExpertsForGp(expertPaths);

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

  // Образец — тот, что выбрали в форме; не выбрали — основной.
  const { item: sample, buffer: templateBuffer } =
    await gpTemplate.readSample(filesLib.safeResolve, body.templateId);
  const templateState = gpTemplate.inspect(templateBuffer);
  if (!templateState.ok) {
    throw gpFail(`Образец «${sample.name}» испорчен: не хватает ` +
      templateState.missing.map((m) => m.token).join(", ") +
      ". Откройте «Настройки → Шаблон ГП» и верните метки на место " +
      "или нажмите «Вернуть исходный шаблон».");
  }

  return {
    kase, gpOutputDir, data, experts, expertPaths, templateBuffer,
    caseId, ...gpFileNames(body.caseNumber),
  };
}

/** Письмо прямо в дело, без предпросмотра. */
app.post("/api/gp/generate", auth.requireAuth, async (req, res) => {
  try {
    const p = await prepareGp(req);
    const built = gpGenerate.generateGP(p.data, p.templateBuffer);

    const destDir = filesLib.safeResolve(p.gpOutputDir);
    await fs.promises.mkdir(destDir, { recursive: true });
    assertNamesFree(destDir, [p.plainName, p.withDocsName]);

    const written = await writeGpFiles(req, p.gpOutputDir, destDir, {
      plainName: p.plainName, withDocsName: p.withDocsName,
      plain: built.plain, withAttachments: built.withAttachments,
    });

    res.json({
      ok: true, name: p.plainName, path: p.gpOutputDir + "/" + p.plainName,
      caseFolderPath: p.kase.folder_path,
      files: written, noScans: !built.withAttachments,
    });
  } catch (err) {
    if (!err.status) console.error("Не удалось создать ГП:", err);
    res.status(err.status || 500).json({
      message: err.status ? err.message : "Не удалось создать документ: " + err.message,
    });
  }
});

/** Запись обоих писем и обе записи в журнале — одним местом. */
async function writeGpFiles(req, gpOutputDir, destDir, { plainName, withDocsName, plain, withAttachments }) {
  await fs.promises.writeFile(path.join(destDir, plainName), plain);
  events.log(req.user, "gp_generate", { path: gpOutputDir + "/" + plainName, name: plainName });
  const written = [plainName];

  // Второе письмо — то же самое, но со вшитыми сканами. Отдельные копии
  // файлов рядом не кладём: документы теперь внутри письма, и папка с их
  // дубликатами только сбивала бы с толку — непонятно, что отправлять.
  if (withAttachments) {
    await fs.promises.writeFile(path.join(destDir, withDocsName), withAttachments);
    events.log(req.user, "gp_generate", { path: gpOutputDir + "/" + withDocsName, name: withDocsName });
    written.push(withDocsName);
  }
  return written;
}

/**
 * Предпросмотр: собрать письмо в черновик и показать.
 *
 * Занятость имён проверяется УЖЕ ЗДЕСЬ, хотя сохранения ещё не было:
 * узнать, что письмо по этому делу уже есть, лучше до того, как человек
 * вычитал две страницы.
 */
app.post("/api/gp/preview", auth.requireAuth, async (req, res) => {
  try {
    const p = await prepareGp(req);
    const destDir = filesLib.safeResolve(p.gpOutputDir);
    if (fs.existsSync(destDir)) {
      assertNamesFree(destDir, [p.plainName, p.withDocsName]);
    }

    const built = gpGenerate.generateGP(p.data, p.templateBuffer);
    const draft = await gpDraft.create(filesLib.safeResolve, {
      userId: req.user.id,
      plain: built.plain,
      withAttachments: built.withAttachments,
      meta: {
        caseId: p.caseId,
        caseFolderPath: p.kase.folder_path,
        gpOutputDir: p.gpOutputDir,
        plainName: p.plainName,
        withDocsName: p.withDocsName,
        expertPaths: p.expertPaths,
      },
    });

    res.json({
      ok: true,
      draftId: draft.id,
      plainName: draft.plainName,
      withDocsName: draft.withDocsName,
      noScans: draft.noScans,
      gpOutputDir: draft.gpOutputDir,
    });
  } catch (err) {
    if (!err.status) console.error("Не удалось собрать предпросмотр ГП:", err);
    res.status(err.status || 500).json({
      message: err.status ? err.message : "Не удалось собрать письмо: " + err.message,
    });
  }
});

/**
 * Пересобрать письмо с приложением из текущего текста.
 *
 * Вызывается перед тем, как показать его: человек мог только что
 * поправить текст в редакторе, и показать ему старую редакцию — значит
 * соврать ровно в том месте, ради которого предпросмотр и сделан.
 */
async function rebuildWithDocs(req, meta) {
  const experts = await readExpertsForGp(meta.expertPaths);
  const plain = await gpDraft.readPlain(filesLib.safeResolve, meta);
  const withDocs = gpGenerate.attachScans(plain, experts);
  if (withDocs) await gpDraft.writeWithDocs(filesLib.safeResolve, meta, withDocs);
  return { experts, plain, withDocs };
}

app.post("/api/gp/preview/:id/rebuild", auth.requireAuth, async (req, res) => {
  try {
    const meta = await gpDraft.read(filesLib.safeResolve, req.params.id, req.user.id);
    const { withDocs } = await rebuildWithDocs(req, meta);
    res.json({ ok: true, noScans: !withDocs });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

/** Окно редактора для файла черновика. Править можно только текст. */
app.get("/api/gp/preview/:id/editor", auth.requireAuth, async (req, res) => {
  try {
    const meta = await gpDraft.read(filesLib.safeResolve, req.params.id, req.user.id);
    const wantDocs = req.query.file === "docs";
    if (wantDocs && meta.noScans) {
      throw gpFail("У этого письма нет приложения: ни у одного эксперта нет сканов");
    }
    // Письмо с приложением открывается ТОЛЬКО на просмотр: оно
    // пересобирается из текстового, и правка в нём всё равно пропала бы
    // при сохранении. Лучше не дать её сделать, чем потерять молча.
    const { config, scriptUrl } = onlyoffice.buildEditorConfig({
      relPath: wantDocs ? gpDraft.withDocsPath(meta) : gpDraft.plainPath(meta),
      fileName: wantDocs ? meta.withDocsName : meta.plainName,
      userId: req.user.id,
      userName: req.user.name || req.user.username,
      canEdit: !wantDocs,
    });
    res.json({ config, scriptUrl, canEdit: !wantDocs });
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message });
  }
});

/** Сохранить письмо в дело. */
app.post("/api/gp/preview/:id/save", auth.requireAuth, async (req, res) => {
  try {
    const meta = await gpDraft.read(filesLib.safeResolve, req.params.id, req.user.id);

    // Права проверяем ЗАНОВО: между предпросмотром и сохранением их
    // могли отозвать, а письмо кладётся именно сейчас.
    const { rows } = await db.query(
      "SELECT * FROM cases WHERE id = $1 AND deleted_at IS NULL", [meta.caseId]);
    if (!rows.length) throw gpFail("Проект не найден или удалён", 404);
    await assertCanWriteToCase(req, rows[0]);

    // Приложение собирается из текущего текста письма — с правками,
    // если их вносили в редакторе.
    const { plain, withDocs } = await rebuildWithDocs(req, meta);

    const destDir = filesLib.safeResolve(meta.gpOutputDir);
    await fs.promises.mkdir(destDir, { recursive: true });
    assertNamesFree(destDir, [meta.plainName, meta.withDocsName]);

    const written = await writeGpFiles(req, meta.gpOutputDir, destDir, {
      plainName: meta.plainName, withDocsName: meta.withDocsName,
      plain, withAttachments: withDocs,
    });
    await gpDraft.remove(filesLib.safeResolve, meta.id);

    res.json({
      ok: true, name: meta.plainName, path: meta.gpOutputDir + "/" + meta.plainName,
      caseFolderPath: meta.caseFolderPath,
      files: written, noScans: !withDocs,
    });
  } catch (err) {
    if (!err.status) console.error("Не удалось сохранить ГП:", err);
    res.status(err.status || 500).json({
      message: err.status ? err.message : "Не удалось сохранить письмо: " + err.message,
    });
  }
});

/** Отказались — черновик убираем сразу, а не ждём суток. */
app.delete("/api/gp/preview/:id", auth.requireAuth, async (req, res) => {
  try {
    const meta = await gpDraft.read(filesLib.safeResolve, req.params.id, req.user.id);
    await gpDraft.remove(filesLib.safeResolve, meta.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
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
    if (rejectManagedExpertMutation(res, req.body?.path)) return;
    if (String(req.body?.path || "").startsWith(equipment.EQUIPMENT_DIR + "/")) {
      return res.status(409).json({
        message: "Папки оборудования создаются автоматически из карточек приборов",
      });
    }
    await filesLib.ensureDir(req.body.path);
    events.log(req.user, "create_folder", { path: req.body.path, isDir: true });
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
    if (rejectManagedExpertMutation(res, req.body?.path)) return;
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
    const relPath = (req.body.path || "/").replace(/\/+$/, "") + "/" + name;
    events.log(req.user, "create_file", { path: relPath, name });
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
    if (rejectManagedExpertMutation(res, req.query.path)) return;
    if (rejectManagedEquipmentFolderMutation(res, req.query.path)) return;
    await trash.moveToTrash(req.query.path, req.user.id);
    events.log(req.user, "delete", { path: req.query.path });
    // Удалили папку проекта — сам проект больше не должен предлагаться
    // в выборе (ГП и прочее). Запись остаётся в журнале с отметкой.
    const closed = await caseLifecycle.markDeletedByPath(req.query.path);
    res.json({ ok: true, closedCases: closed });
    if (closed.length) refreshJournalAfterCaseChange();
  } catch (err) {
    console.error("Не удалось переместить в корзину:", err);
    res.status(400).json({ message: "Не удалось удалить: " + err.message });
  }
});

/** Журнал — проекция базы, после смены состава проектов его пересобираем. */
function refreshJournalAfterCaseChange() {
  require("./journalExcel").regenerateJournal().catch((err) => {
    console.error("Не удалось обновить журнал регистрации:", err.message);
  });
}

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
    events.log(req.user, "restore", { path: result.path, name: result.name });
    // Папка вернулась — вернулся и проект.
    const reopened = await caseLifecycle.unmarkDeletedByPath(result.path);
    res.json({ ok: true, ...result, reopenedCases: reopened });
    if (reopened.length) refreshJournalAfterCaseChange();
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message });
  }
});

app.delete("/api/trash/:id", auth.requireAuth, async (req, res) => {
  try {
    const entry = await trash.getEntry(req.params.id);
    await trash.purge(req.params.id, req.user);
    if (entry) events.log(req.user, "purge", { path: entry.original_path, name: entry.name, isDir: entry.is_dir });
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message });
  }
});

// Очистка вручную: сотрудник убирает своё, администратор — всю корзину.
app.post("/api/trash/empty", auth.requireAuth, async (req, res) => {
  try {
    const removed = await trash.empty(req.user);
    events.log(req.user, "trash_empty", { details: { removed } });
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
    if (rejectManagedExpertMutation(res, oldPath)) return;
    if (rejectManagedEquipmentFolderMutation(res, oldPath)) return;
    const newPath = await filesLib.renameEntry(oldPath, newName);
    if (columnForPath(oldPath) === "cases") {
      await folderPermissions.renamePath(oldPath, newPath);
    }
    events.log(req.user, "rename", {
      path: newPath,
      details: { from: path.posix.basename(oldPath), to: path.posix.basename(newPath) },
    });
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
    if (rejectManagedExpertMutation(res, sourcePath, destination)) return;
    if (rejectManagedEquipmentFolderMutation(res, sourcePath)) return;

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
    events.log(req.user, "move", { path: newPath, details: { from: sourcePath, to: destination } });
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
    if (rejectManagedExpertMutation(res, sourcePath, destination)) return;
    if (rejectManagedEquipmentFolderMutation(res, sourcePath)) return;

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
    events.log(req.user, "copy", { path: newPath, details: { from: sourcePath } });
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
    if (rejectManagedExpertMutation(res, req.body?.path)) return;
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

    const relDest = (req.body.path || "/").replace(/\/+$/, "") + "/" + (rawRelativePath || fixedName).split(path.sep).join("/");
    events.log(req.user, "upload", { path: relDest, name: path.basename(destPath) });

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

/* ---------------- История и последние ---------------- */

app.get("/api/events", auth.requireAuth, async (req, res) => {
  try {
    const items = await events.list(req.user, {
      limit: req.query.limit,
      action: req.query.action || null,
      actorId: req.query.actorId || null,
    });
    res.json({ items });
  } catch (err) {
    console.error("Не удалось получить историю:", err);
    res.status(500).json({ message: "Не удалось получить историю" });
  }
});

/**
 * Полная очистка истории. Только для администратора и только целиком —
 * выборочно стирать записи нельзя намеренно: история для того и нужна,
 * чтобы по ней можно было что-то восстановить, а «подчищенная» история
 * хуже, чем никакой.
 *
 * Раздел «Последние» строится на тех же записях, поэтому опустеет и он.
 */
app.post("/api/events/clear", auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await db.query("DELETE FROM fm_events");
    console.log(`История очищена пользователем ${req.user.username}: удалено записей ${rowCount}`);
    res.json({ ok: true, removed: rowCount });
  } catch (err) {
    console.error("Не удалось очистить историю:", err);
    res.status(500).json({ message: "Не удалось очистить историю: " + err.message });
  }
});

app.get("/api/events/actors", auth.requireAuth, async (req, res) => {
  try {
    res.json({ actors: await events.listActors() });
  } catch (err) {
    res.status(500).json({ message: "Не удалось получить список сотрудников" });
  }
});

app.get("/api/recent", auth.requireAuth, async (req, res) => {
  try {
    const items = await events.recent(req.user, {
      limit: req.query.limit,
      column: req.query.column || null,
    });
    res.json({ items });
  } catch (err) {
    console.error("Не удалось получить последние файлы:", err);
    res.status(500).json({ message: "Не удалось получить последние файлы" });
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
      req.query.mode !== "view" && (
        req.user.role === "admin" ||
        columnForPath(relPath) !== "cases" ||
        req.folderAccess === "write"
      );
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
// которым нужно показать файл, привязанный к их собственной записи —
// фото прибора или скан документа поверки.
//
// Здесь проверяются ДВЕ вещи, и обе обязательны:
//   1) подпись токена — что запрос действительно от нашего сервиса;
//   2) права того ЧЕЛОВЕКА, чей id указан в токене, на этот путь.
//
// Раньше проверялась только подпись. Из-за этого любой вошедший в "Учёт
// приборов" видел содержимое привязанного файла, даже если в ИСУ ему эту
// папку не показывают: права на папки "Дел" обходились через соседний сайт.
app.get("/internal/linked-file", async (req, res) => {
  let payload;
  try {
    payload = fileLink.verifyFileLinkToken(req.query.token, req.query.path);
  } catch (err) {
    return res.status(403).json({ message: "Недействительный токен" });
  }

  try {
    if (!(await permissions.canUserReadPath(payload.viewerId, req.query.path))) {
      // Тот же ответ, что и при обычном отказе в доступе: наличие или
      // отсутствие файла по чужому пути так не выяснить.
      return res.status(403).json({ message: "Нет доступа к этому файлу" });
    }
    const abs = filesLib.safeResolve(req.query.path);
    res.sendFile(abs);
  } catch (err) {
    console.error("Не удалось отдать привязанный файл:", err);
    res.status(403).json({ message: "Нет доступа к этому файлу" });
  }
});

// Эталонные снимки распознавания физически лежат в папке прибора в ИСУ.
// Публичного доступа у этих методов нет: короткий токен подписывает API
// «Учёта оборудования», а путь сервер строит сам по id прибора.
app.post("/internal/instrument-recognition/:id",
  express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "4mb" }),
  async (req, res) => {
    try {
      fileLink.verifyServiceToken(req.query.token, {
        action: "recognition-upload", instrumentId: Number(req.params.id),
      });
      const types = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
      const ext = types[req.headers["content-type"]];
      if (!ext || !Buffer.isBuffer(req.body) || !req.body.length) {
        return res.status(400).json({ message: "Нужно фото JPEG, PNG или WebP" });
      }
      const dir = await equipment.uploadDirFor(Number(req.params.id), "recognition");
      const name = `Распознавание-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const relPath = `${dir}/${name}`;
      await fs.promises.writeFile(filesLib.safeResolve(relPath), req.body);
      res.status(201).json({ path: relPath, size: req.body.length });
    } catch (err) {
      res.status(err.status || 403).json({ message: err.message });
    }
  });

app.delete("/internal/instrument-recognition", async (req, res) => {
  try {
    fileLink.verifyServiceToken(req.query.token, {
      action: "recognition-delete", path: req.query.path,
    });
    const relPath = String(req.query.path || "");
    if (!relPath.endsWith("/" + path.posix.basename(relPath)) ||
        !relPath.includes(`/${equipment.RECOGNITION_DIRNAME}/`)) {
      return res.status(400).json({ message: "Некорректный путь фотографии" });
    }
    await fs.promises.unlink(filesLib.safeResolve(relPath));
    res.status(204).end();
  } catch (err) {
    if (err.code === "ENOENT") return res.status(404).json({ message: "Файл не найден" });
    res.status(403).json({ message: err.message });
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
      // Образец письма — особый файл: его правят люди, и испортить его
      // проще всего. Копию «как было» делаем ровно здесь, перед самой
      // перезаписью. Делать её при открытии редактора нельзя: открыл
      // вкладку дважды, ничего не поправив, — и копия стала равна
      // текущему, возвращаться некуда.
      const sampleId = gpTemplate.idByPath(req.query.path);
      if (sampleId) await gpTemplate.backup(filesLib.safeResolve, sampleId);
      const documentSample = documentTemplate.identifyPath(req.query.path);
      if (documentSample) {
        await documentTemplate.backup(filesLib.safeResolve, documentSample.type, documentSample.id);
      }
      await fs.promises.writeFile(abs, buffer);
      console.log(`OnlyOffice callback: файл "${req.query.path}" успешно сохранён (${buffer.length} байт)`);
      // Кто именно правил документ, OnlyOffice сообщает в users — берём первого.
      const editorId = Array.isArray(req.body.users) && req.body.users.length ? req.body.users[0] : null;
      const editor = await auth.userForEvent(editorId);
      events.log(editor, "office_save", { path: req.query.path });
      if (sampleId) await gpTemplate.touch(filesLib.safeResolve, sampleId);
      if (documentSample) {
        await documentTemplate.touch(filesLib.safeResolve, documentSample.type, documentSample.id);
      }
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
// Проекты, чьи папки исчезли мимо интерфейса, помечаем удалёнными —
// иначе они продолжают предлагаться в выборе.
setTimeout(async () => {
  try {
    const lost = await caseLifecycle.markLostCases();
    if (lost.length) console.log(`Проекты без папок помечены удалёнными: ${lost.join(", ")}`);
  } catch (err) {
    console.error("Не удалось сверить проекты с диском:", err.message);
  }
}, 20 * 1000).unref();

setTimeout(runTrashCleanup, 30 * 1000).unref();
setInterval(runTrashCleanup, 6 * 60 * 60 * 1000).unref();

// Сверка с Planfix: раз в 15 минут забираем новые проекты и задачи.
// Планфикс — источник правды, мы только читаем; если он недоступен,
// следующий заход просто повторит попытку.
const planfixImport = require("./planfixImport");

async function runPlanfixSync() {
  // Нет токена — сверять нечем и незачем: молча пропускаем заход, а не
  // сыплем ошибками каждые пятнадцать минут.
  if (!settings.get("planfix_token")) return;
  try {
    const report = await planfixImport.runSync({ trigger: "schedule" });
    const touched = report.created.length + report.adopted.length + report.updated.length;
    if (touched || report.tasksSynced) {
      console.log(
        `Planfix: проектов затронуто ${touched} (новых ${report.created.length}), ` +
        `папок создано ${report.foldersCreated}, задач ${report.tasksSynced}`
      );
    }
  } catch (err) {
    console.error("Сверка с Planfix не удалась:", err.message);
  }
}

/**
 * Расписание сверки ставим после того, как настройки прочитаны из базы:
 * частота задаётся в панели, и читать её до загрузки значило бы всегда
 * брать умолчание. Само расписание ставится один раз при запуске —
 * изменение частоты вступает в силу после перезапуска сервиса, и так
 * и написано на экране настроек.
 */
function schedulePlanfixSync() {
  const minutes = settings.num("planfix_sync_minutes");
  if (minutes <= 0) return;
  setTimeout(runPlanfixSync, 60 * 1000).unref();
  setInterval(runPlanfixSync, minutes * 60 * 1000).unref();
}

const PORT = process.env.PORT || 3000;

// Настройки читаем до того, как начали принимать запросы: иначе первый
// же запрос увидел бы умолчания вместо того, что задал администратор.
// Не прочитались (нет таблицы — миграцию ещё не накатили) — работаем
// на .env, как работали раньше, и говорим об этом в журнал.
settings.load()
  .then((ok) => {
    if (!ok) console.warn("Настройки из базы не прочитаны — работаем на переменных окружения");
  })
  .catch(() => {})
  .finally(() => {
    schedulePlanfixSync();
    app.listen(PORT, () => {
      console.log(`filemanager запущен на порту ${PORT}`);
    });
  });
