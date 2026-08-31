/* ============================================================
   НАСТРОЙКИ
   ============================================================ */

// У каждой колонки — своя папка, чтобы содержимое не пересекалось.
// Можно поменять на любые другие подпапки, если понадобится.
const DB_PATH = "/База данных";
const CASES_PATH = "/Дела";

// Режим "выбора файла" для других наших сайтов (например, "Учёт приборов").
// Открывается как всплывающее окно с адресом ?picker=1&origin=<адрес сайта>.
// В этом режиме клик по файлу не открывает его, а отправляет выбор обратно
// в окно, которое открыло этот попап, и закрывает попап.
const pickerParams = new URLSearchParams(location.search);
const PICKER_MODE = pickerParams.get("picker") === "1";
const PICKER_ORIGIN = pickerParams.get("origin") || "";

if (PICKER_MODE) {
  const banner = document.createElement("div");
  banner.textContent = "Режим выбора файла — кликните по файлу, чтобы выбрать его";
  banner.style.cssText =
    "position:fixed;top:0;left:0;right:0;background:var(--accent);color:#fff;" +
    "text-align:center;padding:8px 12px;font-size:13px;z-index:2000;";
  document.addEventListener("DOMContentLoaded", () => {
    document.body.appendChild(banner);
    document.body.style.paddingTop = "36px";
  });
}

/* ============================================================
   Ниже — логика
   ============================================================ */

const els = {
  loginScreen: document.getElementById("loginScreen"),
  loginForm: document.getElementById("loginForm"),
  loginError: document.getElementById("loginError"),
  appScreen: document.getElementById("appScreen"),
  columnsView: document.getElementById("columnsView"),
  folderView: document.getElementById("folderView"),
  dbList: document.getElementById("dbList"),
  casesList: document.getElementById("casesList"),
  toolsList: document.getElementById("toolsList"),
  breadcrumbs: document.getElementById("breadcrumbs"),
  folderList: document.getElementById("folderList"),
  backBtn: document.getElementById("backBtn"),
  folderTitle: document.getElementById("folderTitle"),
  logoutBtn: document.getElementById("logoutBtn"),
  profileInitials: document.getElementById("profileInitials"),
  profileName: document.getElementById("profileName"),
  profileRole: document.getElementById("profileRole"),
  linksBtn: document.getElementById("linksBtn"),
  linksPopover: document.getElementById("linksPopover"),
  trashCount: document.getElementById("trashCount"),
  filesSection: document.getElementById("filesSection"),
  trashList: document.getElementById("trashList"),
  trashSubtitle: document.getElementById("trashSubtitle"),
  trashEmptyBtn: document.getElementById("trashEmptyBtn"),
  trashRefreshBtn: document.getElementById("trashRefreshBtn"),
  recentList: document.getElementById("recentList"),
  recentFilter: document.getElementById("recentFilter"),
  historyList: document.getElementById("historyList"),
  historyActor: document.getElementById("historyActor"),
  historyAction: document.getElementById("historyAction"),
  projectFormOverlay: document.getElementById("projectFormOverlay"),
  projectFormCloseBtn: document.getElementById("projectFormCloseBtn"),
  projectForm: document.getElementById("projectForm"),
  projectFormError: document.getElementById("projectFormError"),
  uploadInput: document.getElementById("uploadInput"),
  createDbBtn: document.getElementById("createDbBtn"),
  createDbMenu: document.getElementById("createDbMenu"),
  createCasesBtn: document.getElementById("createCasesBtn"),
  planfixSyncBtn: document.getElementById("planfixSyncBtn"),
  createCasesMenu: document.getElementById("createCasesMenu"),
  createFolderViewBtn: document.getElementById("createFolderViewBtn"),
  createFolderViewMenu: document.getElementById("createFolderViewMenu"),
  addToolBtn: document.getElementById("addToolBtn"),
  profileBtn: document.getElementById("profileBtn"),
  usersOverlay: document.getElementById("usersOverlay"),
  usersCloseBtn: document.getElementById("usersCloseBtn"),
  usersList: document.getElementById("usersList"),
  createUserBtn: document.getElementById("createUserBtn"),
  uploadPanel: document.getElementById("uploadPanel"),
  uploadPanelTitle: document.getElementById("uploadPanelTitle"),
  uploadPanelList: document.getElementById("uploadPanelList"),
  uploadPanelTotal: document.getElementById("uploadPanelTotal"),
  uploadPanelTotalFill: document.getElementById("uploadPanelTotalFill"),
  uploadPanelCloseBtn: document.getElementById("uploadPanelCloseBtn"),
  uploadTriggerBtn: document.getElementById("uploadTriggerBtn"),
  uploadFolderInput: document.getElementById("uploadFolderInput"),
  chooseFilesBtn: document.getElementById("chooseFilesBtn"),
  chooseFolderBtn: document.getElementById("chooseFolderBtn"),
  folderActions: document.getElementById("folderActions"),
  selectionBar: document.getElementById("selectionBar"),
  selectionCount: document.getElementById("selectionCount"),
  downloadSelectedBtn: document.getElementById("downloadSelectedBtn"),
  moveSelectedBtn: document.getElementById("moveSelectedBtn"),
  deleteSelectedBtn: document.getElementById("deleteSelectedBtn"),
  cancelSelectBtn: document.getElementById("cancelSelectBtn"),
  dbSearchInput: document.getElementById("dbSearchInput"),
  dbSortSelect: document.getElementById("dbSortSelect"),
  casesSearchInput: document.getElementById("casesSearchInput"),
  casesSortSelect: document.getElementById("casesSortSelect"),
  folderSearchInput: document.getElementById("folderSearchInput"),
  folderSortSelect: document.getElementById("folderSortSelect"),
  folderPermOverlay: document.getElementById("folderPermOverlay"),
  folderPermTitle: document.getElementById("folderPermTitle"),
  folderPermCloseBtn: document.getElementById("folderPermCloseBtn"),
  folderPermList: document.getElementById("folderPermList"),
  folderPermUserSelect: document.getElementById("folderPermUserSelect"),
  folderPermAccessSelect: document.getElementById("folderPermAccessSelect"),
  folderPermAddBtn: document.getElementById("folderPermAddBtn"),
  downloadChoiceOverlay: document.getElementById("downloadChoiceOverlay"),
  downloadChoiceCloseBtn: document.getElementById("downloadChoiceCloseBtn"),
  downloadAsZipBtn: document.getElementById("downloadAsZipBtn"),
  downloadFolderBtn: document.getElementById("downloadFolderBtn"),
  downloadAsFolderBtn: document.getElementById("downloadAsFolderBtn"),
  downloadFolderHint: document.getElementById("downloadFolderHint"),
  dbToolbar: document.getElementById("dbToolbar"),
  dbSelectionBar: document.getElementById("dbSelectionBar"),
  dbSelectionCount: document.getElementById("dbSelectionCount"),
  dbDownloadSelectedBtn: document.getElementById("dbDownloadSelectedBtn"),
  dbMoveSelectedBtn: document.getElementById("dbMoveSelectedBtn"),
  dbDeleteSelectedBtn: document.getElementById("dbDeleteSelectedBtn"),
  dbCancelSelectBtn: document.getElementById("dbCancelSelectBtn"),
  casesToolbar: document.getElementById("casesToolbar"),
  casesSelectionBar: document.getElementById("casesSelectionBar"),
  casesSelectionCount: document.getElementById("casesSelectionCount"),
  casesDownloadSelectedBtn: document.getElementById("casesDownloadSelectedBtn"),
  casesDeleteSelectedBtn: document.getElementById("casesDeleteSelectedBtn"),
  casesCancelSelectBtn: document.getElementById("casesCancelSelectBtn"),
  gpOverlay: document.getElementById("gpOverlay"),
  gpCloseBtn: document.getElementById("gpCloseBtn"),
  gpForm: document.getElementById("gpForm"),
  gpCaseSelect: document.getElementById("gpCaseSelect"),
  gpCourtHeader: document.getElementById("gpCourtHeader"),
  gpCaseNumber: document.getElementById("gpCaseNumber"),
  gpCourtGenitive: document.getElementById("gpCourtGenitive"),
  gpCourtRaw: document.getElementById("gpCourtRaw"),
  gpExpertiseType: document.getElementById("gpExpertiseType"),
  gpQuestionsList: document.getElementById("gpQuestionsList"),
  gpAddQuestionBtn: document.getElementById("gpAddQuestionBtn"),
  gpCostAmount: document.getElementById("gpCostAmount"),
  gpCostWords: document.getElementById("gpCostWords"),
  gpTermDays: document.getElementById("gpTermDays"),
  gpTermWords: document.getElementById("gpTermWords"),
  gpExpertsList: document.getElementById("gpExpertsList"),
  gpExpertSearch: document.getElementById("gpExpertSearch"),
  gpExpertsCount: document.getElementById("gpExpertsCount"),
  gpExpertsOrderBox: document.getElementById("gpExpertsOrderBox"),
  gpExpertsOrderList: document.getElementById("gpExpertsOrderList"),
};

// Иконки списка — заливкой, а не контуром: папка узнаётся боковым зрением
// по силуэту и цвету, как в привычных файловых менеджерах.
const svgFolder = `<svg class="icon icon-solid" viewBox="0 0 24 24"><path class="folder-tab" d="M2.5 6.6c0-1.2 1-2.1 2.1-2.1h4.2c.6 0 1.1.2 1.5.6l1.6 1.5H12L2.5 9.4V6.6z"/><path class="folder-body" d="M2.5 8.5c0-1.1.9-2 2-2h15c1.1 0 2 .9 2 2v9c0 1.1-.9 2-2 2h-15c-1.1 0-2-.9-2-2v-9z"/></svg>`;
const svgFile = `<svg class="icon icon-solid" viewBox="0 0 24 24"><path class="page-body" d="M6.5 2.5h6.6L19.5 9v11.5c0 1.1-.9 2-2 2h-11c-1.1 0-2-.9-2-2v-16c0-1.1.9-2 2-2z"/><path class="page-fold" d="M13.1 2.5 19.5 9h-4.4c-1.1 0-2-.9-2-2V2.5z"/></svg>`;
const svgLink = `<svg class="icon" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>`;
const svgTrash = `<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>`;
const svgDownload = `<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8"><path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>`;
const svgDots = `<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:currentColor;stroke:none"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>`;
const svgRename = `<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;

/* ---------- Иконки по типу файла ---------- */

const FILE_KINDS = {
  doc: ["doc", "docx", "rtf", "odt", "txt", "md"],
  sheet: ["xls", "xlsx", "xlsm", "csv", "ods"],
  pdf: ["pdf"],
  img: ["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg", "heic", "tif", "tiff"],
  zip: ["zip", "rar", "7z", "tar", "gz"],
};

const KIND_BY_EXT = (() => {
  const map = {};
  for (const [kind, exts] of Object.entries(FILE_KINDS)) {
    for (const ext of exts) map[ext] = kind;
  }
  return map;
})();

function fileKind(name) {
  return KIND_BY_EXT[extOf(name)] || "other";
}

/** Иконка в плитке: по ней тип файла виден боковым зрением, без чтения расширения. */
function iconHtml(entry) {
  if (entry.isDir) return `<span class="ficon ficon-folder">${svgFolder}</span>`;
  return `<span class="ficon ficon-${fileKind(entry.name)}">${svgFile}</span>`;
}

/** Дата и время — двумя выровненными столбцами, как в привычных дисках. */
function whenHtml(ms) {
  const text = formatWhen(ms);
  if (!text) return "";
  const [date, time] = text.split(" ");
  return `<span class="row-when"><span class="when-date">${date}</span><span class="when-time">${time}</span></span>`;
}

function formatSize(bytes) {
  if (bytes === undefined || bytes === null) return "";
  if (bytes < 1024) return bytes + " Б";
  const units = ["КБ", "МБ", "ГБ", "ТБ"];
  let val = bytes / 1024;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
  return val.toFixed(1) + " " + units[i];
}

function extOf(name) {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i + 1).toLowerCase();
}

const OFFICE_EXTS = new Set(["doc", "docx", "odt", "rtf", "xls", "xlsx", "ods", "csv", "ppt", "pptx", "odp"]);
const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "ico"]);

function joinPath(base, name) {
  return (base.endsWith("/") ? base : base + "/") + name;
}

// Папки всегда сверху и сортируются по имени; файлы — по выбранному критерию.
/** Дата изменения одним понятным форматом: 27.08.2026 11:57. */
function formatWhen(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  const p2 = (n) => String(n).padStart(2, "0");
  return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

function sortEntries(entries, sortMode) {
  const [field, dir] = (sortMode || "name-asc").split("-");
  const mul = dir === "desc" ? -1 : 1;
  const byName = (a, b) => a.name.localeCompare(b.name, "ru", { numeric: true }) * mul;
  const byField = (a, b) => {
    if (field === "size") return ((a.size || 0) - (b.size || 0)) * mul;
    if (field === "date") return ((a.mtime || 0) - (b.mtime || 0)) * mul;
    return byName(a, b);
  };
  // Папки всегда впереди файлов, но по дате сортируются на равных.
  const folders = entries.filter((e) => e.isDir).sort(field === "date" ? byField : byName);
  const files = entries.filter((e) => !e.isDir).sort(byField);
  return [...folders, ...files];
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// Строит цепочку "хлебных крошек" от baseTrail/basePath до произвольного
// вложенного fullPath — нужно, чтобы клик по результату поиска (который
// может лежать на любой глубине) вёл в правильное место с корректными крошками.
function buildTrailExtending(baseTrail, basePath, fullPath) {
  const trail = [...baseTrail];
  const baseNorm = basePath.endsWith("/") ? basePath : basePath + "/";
  const relative = fullPath.startsWith(baseNorm) ? fullPath.slice(baseNorm.length) : "";
  const segs = relative.split("/").filter(Boolean);
  let acc = basePath;
  for (const seg of segs) {
    acc = joinPath(acc, seg);
    trail.push({ label: seg, path: acc });
  }
  return trail;
}

async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (res.status === 401) {
    showLogin();
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || ("HTTP " + res.status));
  }
  return res.json();
}

function showLogin(errorMsg) {
  els.appScreen.classList.add("hidden");
  els.loginScreen.classList.remove("hidden");
  els.loginError.textContent = errorMsg || "";
}

function showApp() {
  els.loginScreen.classList.add("hidden");
  els.appScreen.classList.remove("hidden");
}

/* ---------- Ссылка на папку или файл (для своих сотрудников) ---------- */

/**
 * Ссылка не даёт доступа сама по себе — она лишь говорит, куда идти.
 * Открывший её увидит экран входа, а после входа права проверятся как
 * обычно: нет доступа к папке — будет честное сообщение об этом.
 */
function buildShareUrl(entryPath, isDir) {
  const url = new URL(location.origin + "/");
  if (isDir) {
    url.searchParams.set("path", entryPath);
  } else {
    // На файл ссылки нет — открываем папку, где он лежит, и подсвечиваем строку.
    const cut = entryPath.lastIndexOf("/");
    url.searchParams.set("path", cut > 0 ? entryPath.slice(0, cut) : "/");
    url.searchParams.set("sel", entryPath.slice(cut + 1));
  }
  return url.toString();
}

async function copyTextToClipboard(text) {
  // navigator.clipboard есть только на https (и на localhost) — на всякий
  // случай оставляем запасной способ через временное поле ввода.
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.style.cssText = "position:fixed;top:-1000px;opacity:0;";
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(area);
  if (!ok) throw new Error("браузер не разрешил копирование");
}

let toastTimer = null;

function showToast(text) {
  const el = document.getElementById("toast");
  el.textContent = text;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 2600);
}

async function shareLinkFor(entryPath, isDir) {
  const url = buildShareUrl(entryPath, isDir);
  try {
    await copyTextToClipboard(url);
    showToast(isDir ? "Ссылка на папку скопирована" : "Ссылка на файл скопирована");
  } catch (err) {
    // Копирование не прошло — показываем ссылку, чтобы её можно было
    // выделить руками, а не оставлять человека ни с чем.
    prompt("Скопируйте ссылку вручную:", url);
  }
}

/* ---------- Переход по ссылке при открытии страницы ---------- */

// Куда вести после входа: разбираем ?path= (и ?sel=) один раз при загрузке.
// Если пользователь ещё не авторизован, ссылка дождётся его входа.
let pendingDeepLink = (() => {
  if (PICKER_MODE) return null;
  const path = pickerParams.get("path");
  if (!path) return null;
  return { path, sel: pickerParams.get("sel") || "" };
})();

// ?section=recent|trash|history|tasks — открыть сразу нужный раздел.
// "tasks" здесь обязателен: страница задач сама пишет ?section=tasks в
// адрес, и без этого перезагрузка (или ссылка, отправленная коллеге)
// возвращала бы на файлы.
const SECTIONS = ["files", "recent", "trash", "history", "tasks"];
let pendingSection = (() => {
  if (PICKER_MODE) return null;
  const name = pickerParams.get("section");
  return SECTIONS.includes(name) ? name : null;
})();

// Имя строки, которую надо подсветить после отрисовки папки.
let pendingFlashName = "";

function rootTrailFor(path) {
  if (path === CASES_PATH || path.startsWith(CASES_PATH + "/")) {
    return { rootPath: CASES_PATH, rootLabel: "Дела" };
  }
  if (path === DB_PATH || path.startsWith(DB_PATH + "/")) {
    return { rootPath: DB_PATH, rootLabel: "База данных" };
  }
  return null;
}

/** Возвращает true, если ссылка распознана и переход выполнен. */
function openPendingDeepLink() {
  const link = pendingDeepLink;
  pendingDeepLink = null;
  if (!link) return false;

  const root = rootTrailFor(link.path);
  if (!root) return false;

  const trail = buildTrailExtending(
    [{ label: root.rootLabel, path: root.rootPath }],
    root.rootPath,
    link.path
  );
  pendingFlashName = link.sel;
  goToFolder(link.path, trail, false);
  return true;
}

/* ---------- Права доступа и адаптация интерфейса под пользователя ---------- */

let currentUser = null;

/** Инициалы для кружка в панели: из "Иванов Иван" — "ИИ", из "kirill" — "KI". */
/**
 * Вешает обработчик, только если узел есть на странице.
 *
 * Браузер и сервер обновляются не синхронно: пользователь может держать
 * открытой старую страницу или получить закэшированный index.html. Раньше
 * такое несовпадение роняло весь скрипт на первой же отсутствующей кнопке,
 * и переставало работать всё, что описано ниже по файлу. Теперь пропадает
 * только сама кнопка.
 */
// Метка сборки. Она же лежит в index.html: если страница в браузере
// старее скрипта (а такое бывает из-за кэша), молчать об этом нельзя —
// половина кнопок будет отсутствовать.
const APP_BUILD = "2026-08-31.3";

function checkBuildMatch() {
  const meta = document.querySelector('meta[name="build"]');
  const pageBuild = meta ? meta.content : null;
  if (pageBuild === APP_BUILD) return;
  console.warn(`Страница собрана как ${pageBuild || "без метки"}, скрипт — ${APP_BUILD}`);
  setTimeout(() => showToast("Страница устарела — обновите её (Ctrl+F5)"), 1200);
}

function bind(el, event, handler) {
  if (!el) {
    console.warn("Элемент интерфейса не найден — обработчик не назначен", event);
    return;
  }
  el.addEventListener(event, handler);
}

function initialsFor(name) {
  const clean = String(name || "").trim();
  if (!clean) return "—";
  const parts = clean.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

function renderProfileCard() {
  const p = currentUser || {};
  els.profileInitials.textContent = initialsFor(p.username);
  els.profileName.textContent = p.username || "—";
  els.profileRole.textContent = p.role === "admin" ? "Администратор" : "Сотрудник";
}

function applyPermissionsUI() {
  const p = currentUser || {};
  renderProfileCard();
  // Раздел "Инструменты" стал кнопкой "Ссылки" в боковой панели.
  els.linksBtn.parentElement.classList.toggle("hidden", !(p.can_tools || p.role === "admin"));
  document.querySelector('[data-col="db"]').classList.toggle("hidden", !p.can_db);
  document.querySelector('[data-col="cases"]').classList.toggle("hidden", !p.can_cases);
  // Создавать что-либо прямо в корне "Дела" может только администратор —
  // у сотрудника эти пункты всё равно упирались бы в отказ сервера.
  const rootOnlyAdmin = p.role !== "admin";
  // Сверка читает весь аккаунт Planfix и заводит папки — это админское действие.
  // Узлы проверяем: страница у пользователя может быть старее скрипта, и
  // тогда вход не должен падать целиком из-за одной кнопки.
  if (els.planfixSyncBtn) els.planfixSyncBtn.classList.toggle("hidden", rootOnlyAdmin);
  // Очистка истории — тоже админское и необратимое.
  const clearHistoryBtn = document.getElementById("historyClearBtn");
  if (clearHistoryBtn) clearHistoryBtn.classList.toggle("hidden", rootOnlyAdmin);
  if (els.createCasesMenu) {
    els.createCasesMenu.querySelectorAll('[data-create="folder"], [data-create="docx"], [data-create="xlsx"], [data-create="upload"]')
      .forEach((item) => item.classList.toggle("hidden", rootOnlyAdmin));
    els.createCasesMenu.querySelectorAll(".create-menu-sep")
      .forEach((sep) => sep.classList.toggle("hidden", rootOnlyAdmin));
  }

  const allowed = [];
  if (p.can_tools) allowed.push("tools");
  if (p.can_db) allowed.push("db");
  if (p.can_cases) allowed.push("cases");

  return allowed;
}

// Запускает подходящий начальный экран после входа/загрузки страницы.
function enterAppForUser() {
  checkBuildMatch();
  const allowed = applyPermissionsUI();

  // Пришли по ссылке на конкретную папку — открываем сразу её.
  if (allowed.length > 0 && openPendingDeepLink()) {
    showSection("files", false);
    return;
  }

  if (pendingSection && pendingSection !== "files") {
    const section = pendingSection;
    pendingSection = null;
    showColumnsUI();
    loadColumns();
    showSection(section, false);
    return;
  }
  pendingSection = null;

  if (allowed.length === 0) {
    showColumnsUI();
    els.columnsView.innerHTML =
      '<div class="empty-hint" style="padding:2rem;">Нет доступа ни к одному разделу. Обратитесь к администратору.</div>';
    return;
  }

  // Экран с колонками показываем всегда: даже если раздел всего один,
  // пользователь ждёт увидеть свою колонку ("Дела" или "База данных"),
  // а не оказаться сразу внутри неё.
  showColumnsUI();
  loadColumns();
}

/* ---------- Корзина ---------- */

let trashItems = [];

function trashDaysText(days) {
  if (days <= 0) return "сегодня";
  if (days === 1) return "завтра";
  const last = days % 10, tens = days % 100;
  if (last === 1 && tens !== 11) return `${days} день`;
  if (last >= 2 && last <= 4 && (tens < 12 || tens > 14)) return `${days} дня`;
  return `${days} дней`;
}

/** "/Дела/ЭКС.А40/Отчёт.docx" -> "Дела › ЭКС.А40" — где эта запись лежала. */
function parentBreadcrumb(fullPath) {
  const parts = String(fullPath || "").split("/").filter(Boolean);
  parts.pop();
  return parts.join(" › ") || "корень";
}

function updateTrashBadge(count) {
  els.trashCount.textContent = count > 0 ? String(count) : "";
  els.trashCount.classList.toggle("hidden", count === 0);
}

async function refreshTrashBadge() {
  try {
    const { items } = await apiFetch("/api/trash");
    updateTrashBadge(items.length);
  } catch (err) {
    // Значок необязателен — молчим, если не получилось.
  }
}

async function loadTrash() {
  els.trashList.innerHTML = '<div class="empty-hint">Загрузка…</div>';
  try {
    const { items, retentionDays } = await apiFetch("/api/trash");
    trashItems = items || [];
    els.trashSubtitle.textContent =
      `Удалённое хранится ${retentionDays} дней, потом стирается само`;
    updateTrashBadge(trashItems.length);
    renderTrash();
  } catch (err) {
    els.trashList.innerHTML = `<div class="empty-hint">${escapeHtml(err.message)}</div>`;
  }
}

function renderTrash() {
  els.trashList.innerHTML = "";
  els.trashEmptyBtn.classList.toggle("hidden", trashItems.length === 0);

  if (trashItems.length === 0) {
    els.trashList.innerHTML = '<div class="empty-hint">Корзина пуста<br>Сюда попадает всё, что вы удаляете</div>';
    return;
  }

  const head = document.createElement("div");
  head.className = "trash-head";
  head.innerHTML = `
    <span class="th-name">Название</span>
    <span class="th-from">Откуда</span>
    <span class="th-who">Кто удалил</span>
    <span class="th-left">Осталось</span>
    <span class="th-act"></span>
  `;
  els.trashList.appendChild(head);

  for (const item of trashItems) {
    const row = document.createElement("div");
    row.className = "file-row trash-row";
    const entry = { name: item.name, isDir: item.is_dir };
    const soon = item.days_left <= 3;
    row.innerHTML = `
      ${iconHtml(entry)}
      <span class="row-name" title="${escapeHtml(item.original_path)}">${escapeHtml(item.name)}</span>
      <span class="row-path">${escapeHtml(parentBreadcrumb(item.original_path))}</span>
      <span class="who">${escapeHtml(item.deleted_by_name || "—")}</span>
      <span class="left-days${soon ? " warn" : ""}">${trashDaysText(item.days_left)}</span>
      <span class="trash-actions">
        <button class="row-btn" data-act="restore">Восстановить</button>
        <button class="row-btn danger" data-act="purge">Удалить</button>
      </span>
    `;
    row.querySelector('[data-act="restore"]').addEventListener("click", () => restoreFromTrash(item));
    row.querySelector('[data-act="purge"]').addEventListener("click", () => purgeFromTrash(item));
    els.trashList.appendChild(row);
  }
}

async function restoreFromTrash(item) {
  try {
    const result = await apiFetch(`/api/trash/${item.id}/restore`, { method: "POST" });
    const back = (result.reopenedCases || []).length;
    showToast(result.renamed
      ? `Восстановлено под именем «${result.name}» — прежнее было занято`
      : back
        ? `«${item.name}» вернулось на место, проект снова доступен`
        : `«${item.name}» вернулось на место`);
    await loadTrash();
    refreshFilesAfterTrashChange();
  } catch (err) {
    alert("Не удалось восстановить: " + err.message);
  }
}

async function purgeFromTrash(item) {
  if (!confirm(`Удалить «${item.name}» навсегда? Вернуть будет нельзя.`)) return;
  try {
    await apiFetch(`/api/trash/${item.id}`, { method: "DELETE" });
    await loadTrash();
  } catch (err) {
    alert("Не удалось удалить: " + err.message);
  }
}

els.trashRefreshBtn.addEventListener("click", () => loadTrash());

els.trashEmptyBtn.addEventListener("click", async () => {
  const what = currentUser && currentUser.role === "admin"
    ? "всю корзину"
    : "всё, что вы удаляли";
  if (!confirm(`Очистить ${what}? Вернуть будет нельзя.`)) return;
  try {
    const { removed } = await apiFetch("/api/trash/empty", { method: "POST" });
    showToast(removed > 0 ? `Корзина очищена: ${removed}` : "Корзина уже пуста");
    await loadTrash();
  } catch (err) {
    alert("Не удалось очистить корзину: " + err.message);
  }
});

/** После восстановления обновляем то, что сейчас открыто в "Файлах". */
function refreshFilesAfterTrashChange() {
  if (els.folderView.classList.contains("hidden")) loadColumns();
  else renderFolder(currentPath);
  loadDiskUsage();
}

/* ---------- Последние и История ---------- */

// Как называется каждое действие в ленте и каким цветом помечено.
const EVENT_KINDS = {
  upload:      { label: "Загрузка",            tone: "add",   text: (e) => `загрузил ${b(e.target_name)}` },
  create_file: { label: "Новый документ",      tone: "new",   text: (e) => `создал документ ${b(e.target_name)}` },
  create_folder:{ label: "Новая папка",        tone: "new",   text: (e) => `создал папку ${b(e.target_name)}` },
  office_save: { label: "Изменение документа", tone: "edit",  text: (e) => `изменил ${b(e.target_name)}` },
  rename:      { label: "Переименование",      tone: "edit",  text: (e) => `переименовал ${b(e.details.from)} → ${b(e.details.to)}` },
  move:        { label: "Перемещение",         tone: "edit",  text: (e) => `переместил ${b(e.target_name)} в ${escapeHtml(prettyPath(e.details.to))}` },
  copy:        { label: "Копирование",         tone: "new",   text: (e) => `скопировал ${b(e.target_name)}` },
  delete:      { label: "Удаление",            tone: "del",   text: (e) => `удалил ${b(e.target_name)}` },
  restore:     { label: "Восстановление",      tone: "add",   text: (e) => `восстановил ${b(e.target_name)} из корзины` },
  purge:       { label: "Удаление навсегда",   tone: "del",   text: (e) => `удалил навсегда ${b(e.target_name)}` },
  trash_empty: { label: "Очистка корзины",     tone: "del",   text: (e) => `очистил корзину (${e.details.removed || 0})` },
  gp_generate: { label: "Гарантийное письмо",  tone: "new",   text: (e) => `создал гарантийное письмо ${b(e.target_name)}` },
  case_create: { label: "Новый проект",        tone: "new",   text: (e) => `создал проект ${b(e.target_name)}` },
  case_stage:  { label: "Смена стадии",        tone: "stage", text: (e) => `перевёл проект ${b(e.target_name)} на стадию ${stageChip(e.details)}` },
  case_cancel: { label: "Отмена проекта",      tone: "del",   text: (e) => `отменил проект ${b(e.target_name)}` },
};

const STAGE_CLASS = { plan: "stage-plan", active: "stage-active", control: "stage-control", done: "stage-done" };

function b(text) {
  return `<b>${escapeHtml(text || "—")}</b>`;
}

function stageChip(details) {
  const cls = STAGE_CLASS[details && details.to] || "stage-plan";
  return `<span class="stage-badge ${cls}">${escapeHtml((details && details.label) || "—")}</span>`;
}

/** "/Дела/ЭКС.А40/01_Запрос" -> "Дела › ЭКС.А40 › 01_Запрос" */
function prettyPath(fullPath) {
  return String(fullPath || "").split("/").filter(Boolean).join(" › ");
}

function dayLabel(iso) {
  const date = new Date(iso);
  const today = new Date();
  const sameDay = (a, c) => a.toDateString() === c.toDateString();
  if (sameDay(date, today)) return "Сегодня";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(date, yesterday)) return "Вчера";
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function timeLabel(iso) {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

/** Раскладывает список по дням и вставляет подписи "Сегодня"/"Вчера"/дата. */
function appendByDays(container, items, renderRow) {
  let lastDay = null;
  for (const item of items) {
    const day = dayLabel(item.created_at);
    if (day !== lastDay) {
      const label = document.createElement("div");
      label.className = "day-label";
      label.textContent = day;
      container.appendChild(label);
      lastDay = day;
    }
    container.appendChild(renderRow(item));
  }
}

/* ---- Последние ---- */

let recentColumn = "";

async function loadRecent() {
  els.recentList.innerHTML = '<div class="empty-hint">Загрузка…</div>';
  try {
    const query = recentColumn ? `?column=${recentColumn}` : "";
    const { items } = await apiFetch("/api/recent" + query);
    els.recentList.innerHTML = "";
    if (!items.length) {
      els.recentList.innerHTML = '<div class="empty-hint">Пока ничего не добавляли<br>Здесь появятся файлы, которые загрузили или изменили</div>';
      return;
    }
    appendByDays(els.recentList, items, (item) => {
      const row = document.createElement("div");
      row.className = "file-row";
      row.innerHTML = `
        <div class="left">
          ${iconHtml({ name: item.target_name, isDir: false })}
          <span class="row-name">${escapeHtml(item.target_name)}</span>
          <span class="row-path">${escapeHtml(prettyPath(item.target_path.slice(0, item.target_path.lastIndexOf("/"))))}</span>
        </div>
        <div class="right">
          <span class="who">${escapeHtml(item.actor_name || "—")}</span>
          <span class="size">${timeLabel(item.created_at)}</span>
        </div>
      `;
      row.addEventListener("click", () => openFile(item.target_path, item.target_name));
      return row;
    });
  } catch (err) {
    els.recentList.innerHTML = `<div class="empty-hint">${escapeHtml(err.message)}</div>`;
  }
}

els.recentFilter.addEventListener("click", (e) => {
  const btn = e.target.closest(".seg-btn");
  if (!btn) return;
  els.recentFilter.querySelectorAll(".seg-btn").forEach((x) => x.classList.toggle("active", x === btn));
  recentColumn = btn.dataset.column;
  loadRecent();
});

/* ---- История ---- */

let historyActorsLoaded = false;

async function loadHistoryFilters() {
  if (historyActorsLoaded) return;
  // Список действий собираем из словаря — он же задаёт и подписи.
  for (const [key, kind] of Object.entries(EVENT_KINDS)) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = kind.label;
    els.historyAction.appendChild(option);
  }
  try {
    const { actors } = await apiFetch("/api/events/actors");
    for (const actor of actors) {
      const option = document.createElement("option");
      option.value = actor.id;
      option.textContent = actor.name;
      els.historyActor.appendChild(option);
    }
  } catch (err) {
    // Фильтр по сотрудникам не обязателен — лента работает и без него.
  }
  historyActorsLoaded = true;
}

/**
 * Очистка истории целиком. Действие необратимое, поэтому спрашиваем
 * подтверждение и говорим прямо, что вернуть будет нельзя.
 */
bind(document.getElementById("historyClearBtn"), "click", async (e) => {
  const btn = e.currentTarget;
  if (!confirm("Очистить всю историю?\n\nБудут удалены все записи о том, что происходило " +
               "в системе, и опустеет раздел «Последние». Восстановить их будет нельзя.")) return;
  btn.disabled = true;
  try {
    const res = await apiFetch("/api/events/clear", { method: "POST" });
    showToast(`История очищена: удалено записей ${res.removed}`);
    loadHistory();
  } catch (err) {
    alert("Не удалось очистить историю: " + err.message);
  } finally {
    btn.disabled = false;
  }
});

async function loadHistory() {
  els.historyList.innerHTML = '<div class="empty-hint">Загрузка…</div>';
  await loadHistoryFilters();
  try {
    const params = new URLSearchParams();
    if (els.historyAction.value) params.set("action", els.historyAction.value);
    if (els.historyActor.value) params.set("actorId", els.historyActor.value);
    const query = params.toString() ? "?" + params.toString() : "";
    const { items } = await apiFetch("/api/events" + query);

    els.historyList.innerHTML = "";
    if (!items.length) {
      els.historyList.innerHTML = '<div class="empty-hint">Событий пока нет</div>';
      return;
    }
    appendByDays(els.historyList, items, (item) => {
      const kind = EVENT_KINDS[item.action];
      const row = document.createElement("div");
      row.className = "ev";
      const where = item.target_path && item.action !== "rename"
        ? `<span class="row-path">${escapeHtml(prettyPath(item.target_path.slice(0, item.target_path.lastIndexOf("/"))))}</span>`
        : "";
      const text = kind
        ? kind.text(item)
        : `${escapeHtml(item.action)} ${b(item.target_name)}`;
      row.innerHTML = `
        <span class="ev-dot ev-${kind ? kind.tone : "new"}"></span>
        <span class="ev-time">${timeLabel(item.created_at)}</span>
        <span class="ev-text">${b(item.actor_name)} ${text} ${where}</span>
      `;
      return row;
    });
  } catch (err) {
    els.historyList.innerHTML = `<div class="empty-hint">${escapeHtml(err.message)}</div>`;
  }
}

els.historyAction.addEventListener("change", () => loadHistory());
els.historyActor.addEventListener("change", () => loadHistory());

/* ---------- Разделы боковой панели ---------- */

let currentSection = "files";

/**
 * Показывает один из разделов. Содержимое "Файлов" при этом не сбрасывается:
 * ушёл в "Историю", вернулся — та же папка на месте.
 */
function showSection(name, pushHistory) {
  currentSection = name;
  document.querySelectorAll(".section").forEach((el) => {
    el.classList.toggle("hidden", el.dataset.view !== name);
  });
  document.querySelectorAll(".side-item[data-section]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.section === name);
  });
  closeLinksPopover();
  if (name === "trash") loadTrash();
  if (name === "recent") loadRecent();
  if (name === "history") loadHistory();
  if (name === "tasks") loadTasksPage();

  if (!pushHistory || PICKER_MODE) return;
  // В "Файлах" адрес показывает открытую папку (как и раньше),
  // в остальных разделах — сам раздел, чтобы F5 возвращал туда же.
  if (name === "files") {
    const inFolder = !els.folderView.classList.contains("hidden");
    history.pushState({ view: inFolder ? "folder" : "columns", path: currentPath, trail: currentTrail, section: "files" },
      "", inFolder && currentPath ? buildShareUrl(currentPath, true) : "/");
  } else {
    history.pushState({ view: "section", section: name }, "", `/?section=${name}`);
  }
}

document.querySelectorAll(".side-item[data-section]").forEach((btn) => {
  btn.addEventListener("click", () => showSection(btn.dataset.section, true));
});

/* ---------- Всплывающее окно со ссылками ---------- */

function closeLinksPopover() {
  els.linksPopover.classList.add("hidden");
}

els.linksBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const wasHidden = els.linksPopover.classList.contains("hidden");
  els.linksPopover.classList.toggle("hidden", !wasHidden);
  // Список подтягиваем при первом открытии, а не на каждой загрузке страницы.
  if (wasHidden && !toolsLoaded) loadToolsColumn();
});

els.linksPopover.addEventListener("click", (e) => e.stopPropagation());
document.addEventListener("click", closeLinksPopover);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeLinksPopover();
});

/* ---------- Login ---------- */

els.loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  els.loginError.textContent = "";
  const username = document.getElementById("loginUsername").value;
  const password = document.getElementById("loginPassword").value;
  try {
    const { user } = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    currentUser = user;
    showApp();
    history.replaceState({ view: "columns" }, "");
    enterAppForUser();
  } catch (err) {
    els.loginError.textContent = "Не удалось войти: проверьте логин и пароль";
  }
});

els.logoutBtn.addEventListener("click", async () => {
  try { await apiFetch("/api/auth/logout", { method: "POST" }); } catch (e) {}
  currentUser = null;
  showLogin();
});

/* ---------- Профиль / управление пользователями ---------- */

els.profileBtn.addEventListener("click", () => {
  if (currentUser && currentUser.role === "admin") {
    openUsersPanel();
  } else {
    alert(`Пользователь: ${currentUser?.username || "—"}\nРоль: сотрудник`);
  }
});

els.usersCloseBtn.addEventListener("click", () => {
  els.usersOverlay.classList.add("hidden");
});

async function openUsersPanel() {
  els.usersOverlay.classList.remove("hidden");
  await loadUsersList();
}

async function loadUsersList() {
  els.usersList.innerHTML = '<div class="empty-hint">Загрузка…</div>';
  try {
    const { users } = await apiFetch("/api/users");
    renderUsersList(users);
  } catch (err) {
    els.usersList.innerHTML = '<div class="empty-hint">Не удалось загрузить список пользователей</div>';
  }
}

function renderUsersList(list) {
  els.usersList.innerHTML = "";
  if (!list || list.length === 0) {
    els.usersList.innerHTML = '<div class="empty-hint">Пользователей пока нет</div>';
    return;
  }
  for (const u of list) {
    const row = document.createElement("div");
    row.className = "user-row";
    row.innerHTML = `
      <span class="user-name">${escapeHtml(u.username)}</span>
      <span class="role-badge">${u.role === "admin" ? "администратор" : "сотрудник"}</span>
      <label><input type="checkbox" data-perm="can_tools" ${u.can_tools ? "checked" : ""}> Инструменты</label>
      <label><input type="checkbox" data-perm="can_db" ${u.can_db ? "checked" : ""}> База данных</label>
      <label><input type="checkbox" data-perm="can_cases" ${u.can_cases ? "checked" : ""}> Дела</label>
      <button class="delete-btn" title="Удалить пользователя" aria-label="Удалить пользователя">${svgTrash}</button>
    `;
    row.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener("change", async () => {
        try {
          await apiFetch(`/api/users/${u.id}`, {
            method: "PATCH",
            body: JSON.stringify({ [cb.dataset.perm]: cb.checked }),
          });
          if (currentUser && currentUser.username === u.username) {
            currentUser[cb.dataset.perm] = cb.checked;
            applyPermissionsUI();
          }
        } catch (err) {
          alert("Не удалось обновить права: " + err.message);
          cb.checked = !cb.checked;
        }
      });
    });
    row.querySelector(".delete-btn").addEventListener("click", async () => {
      if (!confirm(`Удалить пользователя «${u.username}»?`)) return;
      try {
        await apiFetch(`/api/users/${u.id}`, { method: "DELETE" });
        loadUsersList();
      } catch (err) {
        alert("Не удалось удалить: " + err.message);
      }
    });
    els.usersList.appendChild(row);
  }
}

els.createUserBtn.addEventListener("click", async () => {
  const loginInput = document.getElementById("newUserLogin");
  const passInput = document.getElementById("newUserPassword");
  const roleSelect = document.getElementById("newUserRole");
  const permTools = document.getElementById("newPermTools");
  const permDb = document.getElementById("newPermDb");
  const permCases = document.getElementById("newPermCases");

  const username = loginInput.value.trim();
  const password = passInput.value;
  if (!username || !password) {
    alert("Укажите логин и пароль");
    return;
  }
  try {
    await apiFetch("/api/users", {
      method: "POST",
      body: JSON.stringify({
        username,
        password,
        role: roleSelect.value,
        can_tools: permTools.checked,
        can_db: permDb.checked,
        can_cases: permCases.checked,
      }),
    });
    loginInput.value = "";
    passInput.value = "";
    roleSelect.value = "employee";
    permTools.checked = true;
    permDb.checked = true;
    permCases.checked = true;
    loadUsersList();
  } catch (err) {
    alert("Не удалось создать пользователя: " + err.message);
  }
});

/* ---------- Доступ к папкам/файлам в "Дела" (только для админа) ---------- */

let folderPermPath = null;
let folderPermUsersCache = [];

async function openFolderPermissions(fullPath, name) {
  folderPermPath = fullPath;
  els.folderPermTitle.textContent = `Доступ: ${name}`;
  els.folderPermOverlay.classList.remove("hidden");
  await loadFolderPermUsersList();
  await loadFolderPermRules();
}

async function loadFolderPermUsersList() {
  try {
    const { users } = await apiFetch("/api/users");
    folderPermUsersCache = users;
    els.folderPermUserSelect.innerHTML = users
      .map((u) => `<option value="${u.id}">${escapeHtml(u.username)}</option>`)
      .join("");
  } catch (err) {
    els.folderPermUserSelect.innerHTML = "";
  }
}

async function loadFolderPermRules() {
  els.folderPermList.innerHTML = '<div class="empty-hint">Загрузка…</div>';
  try {
    const { permissions } = await apiFetch(`/api/folder-permissions?path=${encodeURIComponent(folderPermPath)}`);
    renderFolderPermRules(permissions);
  } catch (err) {
    els.folderPermList.innerHTML =
      `<div class="empty-hint">Не удалось загрузить: ${escapeHtml(err.message || "неизвестная ошибка")}</div>`;
  }
}

const FOLDER_ACCESS_LABEL = { read: "Читать", write: "Редактировать", none: "Доступ закрыт" };

function renderFolderPermRules(list) {
  els.folderPermList.innerHTML = "";
  if (!list || list.length === 0) {
    els.folderPermList.innerHTML = '<div class="empty-hint">Доступ никому явно не выдан</div>';
    return;
  }
  for (const perm of list) {
    const row = document.createElement("div");
    row.className = "user-row";
    row.innerHTML = `
      <span class="user-name">${escapeHtml(perm.username)}</span>
      <span class="role-badge">${escapeHtml(FOLDER_ACCESS_LABEL[perm.access] || perm.access)}</span>
      <button class="delete-btn" title="Убрать правило" aria-label="Убрать правило">${svgTrash}</button>
    `;
    row.querySelector(".delete-btn").addEventListener("click", async () => {
      if (!confirm(`Убрать это правило доступа для «${perm.username}»?`)) return;
      try {
        await apiFetch(`/api/folder-permissions/${perm.id}`, { method: "DELETE" });
        loadFolderPermRules();
      } catch (err) {
        alert("Не удалось убрать правило: " + err.message);
      }
    });
    els.folderPermList.appendChild(row);
  }
}

els.folderPermAddBtn.addEventListener("click", async () => {
  const userId = els.folderPermUserSelect.value;
  const access = els.folderPermAccessSelect.value;
  if (!userId) {
    alert("Нет доступных пользователей");
    return;
  }
  try {
    await apiFetch("/api/folder-permissions", {
      method: "POST",
      body: JSON.stringify({ path: folderPermPath, userId: Number(userId), access }),
    });
    loadFolderPermRules();
  } catch (err) {
    alert("Не удалось сохранить: " + err.message);
  }
});

els.folderPermCloseBtn.addEventListener("click", () => {
  els.folderPermOverlay.classList.add("hidden");
});

/* ---------- Columns ---------- */

// Встроенная ссылка, которая была отдельной кнопкой в боковой панели.
// Теперь живёт первым пунктом в том же списке — чтобы все переходы на
// другие наши сайты были собраны в одном месте.
const BUILTIN_LINKS = [{ label: "Учёт оборудования", url: "/instruments/", builtin: true }];

let toolsLoaded = false;

async function loadToolsColumn() {
  els.toolsList.innerHTML = '<div class="empty-hint">Загрузка…</div>';
  try {
    const { links } = await apiFetch("/api/tools");
    renderToolsColumn(links);
    toolsLoaded = true;
  } catch (err) {
    els.toolsList.innerHTML = '<div class="empty-hint">Не удалось загрузить</div>';
  }
}

// Ссылка "внутренняя" (тот же сайт), если после разбора совпадает домен —
// неважно, записана она относительным путём ("/instruments/") или полным
// адресом ("https://files.imcstroy.ru/instruments/").
function isSameOriginUrl(url) {
  try {
    return new URL(url, location.origin).origin === location.origin;
  } catch {
    return false;
  }
}

function renderToolsColumn(links) {
  els.toolsList.innerHTML = "";
  const all = [...BUILTIN_LINKS, ...(links || [])];
  for (const link of all) {
    const row = document.createElement("div");
    row.className = "links-popover-item";
    // Внутренняя ссылка — если после разбора у неё тот же домен, что и у
    // текущей страницы (неважно, записана она относительным путём вроде
    // "/instruments/" или полным адресом "https://files.imcstroy.ru/instruments/").
    // Такие открываем в этой же вкладке. Настоящие внешние — как раньше, в новой.
    const isInternal = isSameOriginUrl(link.url);
    const linkAttrs = isInternal ? "" : 'target="_blank" rel="noopener"';
    row.innerHTML = `
      <a href="${escapeHtml(link.url)}" ${linkAttrs} style="display:flex;align-items:center;gap:10px;color:inherit;text-decoration:none;flex:1;min-width:0;">
        <span class="links-dot"></span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(link.label)}</span>
      </a>
      ${link.builtin ? "" : `<button class="delete-btn" title="Удалить ссылку" aria-label="Удалить ссылку">${svgTrash}</button>`}
    `;
    if (link.builtin) {
      els.toolsList.appendChild(row);
      continue;
    }
    row.querySelector(".delete-btn").addEventListener("click", async (e) => {
      e.preventDefault();
      if (!confirm(`Удалить ссылку «${link.label}»?`)) return;
      try {
        await apiFetch(`/api/tools/${link.id}`, { method: "DELETE" });
        loadToolsColumn();
      } catch (err) {
        alert("Не удалось удалить ссылку: " + err.message);
      }
    });
    els.toolsList.appendChild(row);
  }
}

els.addToolBtn?.addEventListener("click", async () => {
  const label = prompt("Название ссылки (как будет подписана):");
  if (!label) return;
  let url = prompt("Адрес ссылки (например, https://example.com):");
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try {
    await apiFetch("/api/tools", { method: "POST", body: JSON.stringify({ label, url }) });
    loadToolsColumn();
  } catch (err) {
    alert("Не удалось добавить ссылку: " + err.message);
  }
});

// Состояние каждой из файловых колонок: что сейчас показываем (обычный
// список или результаты поиска) и откуда брать данные.
const columnState = {
  db: { rootPath: DB_PATH, rootLabel: "База данных", entries: [], searching: false },
  cases: { rootPath: CASES_PATH, rootLabel: "Дела", entries: [], searching: false },
};

const columnSelectState = {
  db: { active: false, selected: new Set() },
  cases: { active: false, selected: new Set() },
};

function colSelectRefs(key) {
  return key === "db"
    ? {
        toolbar: els.dbToolbar, bar: els.dbSelectionBar, count: els.dbSelectionCount,
        downloadBtn: els.dbDownloadSelectedBtn, deleteBtn: els.dbDeleteSelectedBtn, cancelBtn: els.dbCancelSelectBtn,
      }
    : {
        toolbar: els.casesToolbar, bar: els.casesSelectionBar, count: els.casesSelectionCount,
        downloadBtn: els.casesDownloadSelectedBtn, deleteBtn: els.casesDeleteSelectedBtn, cancelBtn: els.casesCancelSelectBtn,
      };
}

function enterColumnSelectMode(key) {
  const st = columnSelectState[key];
  st.active = true;
  st.selected = new Set();
  const refs = colSelectRefs(key);
  refs.toolbar.classList.add("hidden");
  refs.bar.classList.remove("hidden");
  updateColumnSelectionBar(key);
  renderColumnList(key);
}

function exitColumnSelectMode(key) {
  const st = columnSelectState[key];
  st.active = false;
  st.selected = new Set();
  const refs = colSelectRefs(key);
  refs.bar.classList.add("hidden");
  refs.toolbar.classList.remove("hidden");
  renderColumnList(key);
}

function updateColumnSelectionBar(key) {
  colSelectRefs(key).count.textContent = `Выбрано: ${columnSelectState[key].selected.size}`;
}

function toggleColumnSelect(key, fullPath) {
  const st = columnSelectState[key];
  if (st.selected.has(fullPath)) st.selected.delete(fullPath);
  else st.selected.add(fullPath);
  updateColumnSelectionBar(key);
  renderColumnList(key);
}

async function deleteColumnSelected(key) {
  const st = columnSelectState[key];
  if (st.selected.size === 0) return;
  if (!confirm(`Удалить выбранное (${st.selected.size})? Всё уедет в корзину.`)) return;
  const paths = [...st.selected];
  try {
    const results = await Promise.allSettled(
      paths.map((p) => apiFetch(`/api/resources?path=${encodeURIComponent(p)}`, { method: "DELETE" }))
    );
    const failed = results.filter((r) => r.status === "rejected");
    exitColumnSelectMode(key);
    await loadColumnList(key);
    refreshTrashBadge();
    if (failed.length > 0) alert(`Не удалось удалить ${failed.length} из ${paths.length} элементов`);
  } catch (err) {
    alert("Не удалось удалить выбранное: " + err.message);
  }
}

function downloadColumnSelected(key) {
  const st = columnSelectState[key];
  if (st.selected.size === 0) return;
  const state = columnState[key];
  const items = [...st.selected].map((p) => {
    const found = state.entries.find((e) => e.fullPath === p);
    return { path: p, isDir: found ? found.isDir : false };
  });
  requestDownload(items);
}

els.dbCancelSelectBtn.addEventListener("click", () => exitColumnSelectMode("db"));
els.casesCancelSelectBtn.addEventListener("click", () => exitColumnSelectMode("cases"));
els.dbDeleteSelectedBtn.addEventListener("click", () => deleteColumnSelected("db"));
els.casesDeleteSelectedBtn.addEventListener("click", () => deleteColumnSelected("cases"));
els.dbDownloadSelectedBtn.addEventListener("click", () => downloadColumnSelected("db"));
els.casesDownloadSelectedBtn.addEventListener("click", () => downloadColumnSelected("cases"));

function colRefs(key) {
  return key === "db"
    ? { container: els.dbList, sortSelect: els.dbSortSelect, searchInput: els.dbSearchInput }
    : { container: els.casesList, sortSelect: els.casesSortSelect, searchInput: els.casesSearchInput };
}

async function loadColumnList(key) {
  const state = columnState[key];
  const { container } = colRefs(key);
  try {
    const data = await apiFetch(`/api/resources?path=${encodeURIComponent(state.rootPath)}`);
    state.entries = [
      ...(data.folders || []).map((f) => ({ ...f, isDir: true, fullPath: joinPath(state.rootPath, f.name) })),
      ...(data.files || []).map((f) => ({ ...f, isDir: false, fullPath: joinPath(state.rootPath, f.name) })),
    ];
    state.searching = false;
    renderColumnList(key);
  } catch (err) {
    container.innerHTML = '<div class="empty-hint">Не удалось загрузить</div>';
  }
}

function renderColumnList(key) {
  const state = columnState[key];
  const { container, sortSelect } = colRefs(key);
  const selState = columnSelectState[key];
  const sorted = sortEntries(state.entries, sortSelect.value);
  const counter = document.getElementById(key === "db" ? "dbCount" : "casesCount");
  if (counter) {
    counter.textContent = sorted.length ? String(sorted.length) : "";
    counter.classList.toggle("hidden", sorted.length === 0);
  }
  container.innerHTML = "";
  if (sorted.length === 0) {
    // Сотруднику без выданных правил "Дела" честнее объяснить, что дело не
    // в пустой папке, а в том, что доступ ещё не выдали.
    const noRulesYet = key === "cases" && currentUser && currentUser.role !== "admin";
    container.innerHTML = `<div class="empty-hint">${
      state.searching
        ? "Ничего не найдено"
        : noRulesYet
          ? "Пока нет дел, к которым вам открыт доступ.<br>Обратитесь к администратору."
          : "Здесь пока пусто<br>Перетащите сюда файлы или папки"
    }</div>`;
    return;
  }
  for (const entry of sorted) {
    const row = document.createElement("div");
    row.className = "row-item";
    row.style.justifyContent = "space-between";
    if (selState.active && selState.selected.has(entry.fullPath)) {
      row.style.background = "var(--accent-bg)";
    }
    const pathHint = state.searching
      ? `<span class="search-path-hint" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(entry.fullPath)}</span>`
      : "";
    const canManagePerms = key === "cases" && currentUser && currentUser.role === "admin";
    if (entry.isDir) row.classList.add("is-dir");
    row.innerHTML = `
      ${selState.active ? `<input type="checkbox" class="select-checkbox" ${selState.selected.has(entry.fullPath) ? "checked" : ""}>` : ""}
      <span class="left">
        ${iconHtml(entry)}<span class="row-name">${escapeHtml(entry.name)}</span>${pathHint}
      </span>
      <span class="right">
        ${whenHtml(entry.mtime)}
        ${selState.active || !canManagePerms ? "" : `<button class="perm-btn" title="Доступ" aria-label="Доступ">${svgDots}</button>`}
      </span>
    `;
    row.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showContextMenu(e, entry.fullPath, entry.name, entry.isDir, key);
    });
    row.addEventListener("click", () => {
      if (selState.active) {
        toggleColumnSelect(key, entry.fullPath);
        return;
      }
      if (entry.isDir) {
        const trail = buildTrailExtending([{ label: state.rootLabel, path: state.rootPath }], state.rootPath, entry.fullPath);
        goToFolder(entry.fullPath, trail, true);
      } else {
        openFile(entry.fullPath, entry.name);
      }
    });
    if (!selState.active && canManagePerms) {
      row.querySelector('[title="Доступ"]').addEventListener("click", (e) => {
        e.stopPropagation();
        openFolderPermissions(entry.fullPath, entry.name);
      });
    }
    // Бросок точно на строку-папку — загрузка внутрь неё, а не в корень колонки.
    if (entry.isDir) {
      makeDropTarget(row, () => entry.fullPath, () => loadColumnList(key), { stopPropagation: true });
    }
    container.appendChild(row);
  }
}

async function searchColumn(key, query) {
  const state = columnState[key];
  const { container } = colRefs(key);
  if (!query) {
    await loadColumnList(key);
    return;
  }
  container.innerHTML = '<div class="empty-hint">Поиск…</div>';
  try {
    const { results } = await apiFetch(`/api/search?path=${encodeURIComponent(state.rootPath)}&q=${encodeURIComponent(query)}`);
    state.entries = results.map((r) => ({ ...r, fullPath: r.path }));
    state.searching = true;
    renderColumnList(key);
  } catch (err) {
    container.innerHTML = '<div class="empty-hint">Ошибка поиска</div>';
  }
}

const debouncedDbSearch = debounce((q) => searchColumn("db", q), 300);
const debouncedCasesSearch = debounce((q) => searchColumn("cases", q), 300);
els.dbSearchInput.addEventListener("input", (e) => debouncedDbSearch(e.target.value.trim()));
els.casesSearchInput.addEventListener("input", (e) => debouncedCasesSearch(e.target.value.trim()));
els.dbSortSelect.addEventListener("change", () => renderColumnList("db"));
els.casesSortSelect.addEventListener("change", () => renderColumnList("cases"));

async function loadColumns() {
  els.dbSearchInput.value = "";
  els.casesSearchInput.value = "";
  loadColumnList("db");
  loadColumnList("cases");
}

async function createFolderIn(basePath, onDone) {
  const name = prompt("Название новой папки:");
  if (!name) return;
  const target = joinPath(basePath, name);
  try {
    await apiFetch("/api/folder", { method: "POST", body: JSON.stringify({ path: target }) });
    onDone();
  } catch (err) {
    alert("Не удалось создать папку: " + err.message);
  }
}

async function createDocumentIn(basePath, type, label, onDone) {
  const name = prompt(`Название ${label} (можно без расширения):`);
  if (name === null) return;
  try {
    const { name: savedName } = await apiFetch("/api/create-file", {
      method: "POST",
      body: JSON.stringify({ path: basePath, type, name }),
    });
    await onDone();
    openFile(joinPath(basePath, savedName), savedName);
  } catch (err) {
    alert("Не удалось создать документ: " + err.message);
  }
}

/* ---------- Кнопка «Создать» (колонки и открытая папка) ----------
   Один компонент на все три места: типы документов — строки меню, поэтому
   новый тип добавляется одной строкой и не уплотняет шапку. */

const openCreateMenus = [];

function closeCreateMenus() {
  for (const { btn, menu } of openCreateMenus) {
    menu.classList.add("hidden");
    btn.setAttribute("aria-expanded", "false");
  }
  openCreateMenus.length = 0;
}

document.addEventListener("click", closeCreateMenus);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeCreateMenus();
});

function wireCreateMenu(btn, menu, getTarget) {
  if (!btn || !menu) return;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasOpen = !menu.classList.contains("hidden");
    closeCreateMenus();
    if (wasOpen) return;
    menu.classList.remove("hidden");
    btn.setAttribute("aria-expanded", "true");
    openCreateMenus.push({ btn, menu });
  });
  menu.addEventListener("click", (e) => e.stopPropagation());
  menu.querySelectorAll("[data-create]").forEach((item) => {
    item.addEventListener("click", () => {
      closeCreateMenus();
      const { path, refresh } = getTarget();
      const action = item.dataset.create;
      if (action === "folder") createFolderIn(path, refresh);
      else if (action === "docx") createDocumentIn(path, "docx", "текстового документа", refresh);
      else if (action === "xlsx") createDocumentIn(path, "xlsx", "таблицы", refresh);
      else if (action === "project") openProjectForm();
      else if (action === "gp") openGpForm();
      else if (action === "upload") pickFilesFor(path, refresh);
    });
  });
}

wireCreateMenu(els.createDbBtn, els.createDbMenu, () => ({
  path: DB_PATH,
  refresh: () => loadColumnList("db"),
}));
wireCreateMenu(els.createCasesBtn, els.createCasesMenu, () => ({
  path: CASES_PATH,
  refresh: () => loadColumnList("cases"),
}));
wireCreateMenu(els.createFolderViewBtn, els.createFolderViewMenu, () => ({
  path: currentPath,
  refresh: () => renderFolder(currentPath),
}));

// Куда класть выбранные файлы и что обновить после загрузки. Диалог выбора
// файлов открывается из разных мест, поэтому цель запоминаем явно.
let uploadTarget = null;

function pickFilesFor(path, refresh) {
  uploadTarget = { path, refresh };
  els.uploadInput.click();
}

/* ---------- Гарантийные письма (ГП) ---------- */

let gpQuestionCount = 0;

function gpAddQuestionRow(prefill) {
  gpQuestionCount++;
  const row = document.createElement("div");
  row.className = "gp-question-row";
  row.style.cssText = "display:flex; gap:8px; align-items:flex-start;";
  row.innerHTML = `
    <span style="padding-top:8px; font-size:12px; color:var(--text-muted); min-width:16px;">${gpQuestionCount}.</span>
    <textarea class="gp-question-input" rows="2" style="flex:1; border-radius:8px; border:1px solid var(--border-strong); padding:8px; font-size:13px; font-family:inherit;" placeholder="Текст вопроса экспертизы">${prefill || ""}</textarea>
    <button type="button" class="delete-btn" title="Убрать вопрос" aria-label="Убрать вопрос">${svgTrash}</button>
  `;
  row.querySelector(".delete-btn").addEventListener("click", () => {
    row.remove();
    renumberGpQuestions();
  });
  els.gpQuestionsList.appendChild(row);
}

function renumberGpQuestions() {
  const rows = els.gpQuestionsList.querySelectorAll(".gp-question-row");
  rows.forEach((row, i) => {
    row.querySelector("span").textContent = `${i + 1}.`;
  });
  gpQuestionCount = rows.length;
}

els.gpAddQuestionBtn.addEventListener("click", () => gpAddQuestionRow());

/**
 * Грубое, но практичное склонение названия суда в родительный падеж —
 * покрывает подавляющее большинство реальных названий (они устроены
 * очень единообразно: "[прилагательное(-ые)] суд [города Х]").
 * Правила: "суд" -> "суда"; прилагательные на "-ый"/"-ой"/"-ий" -> "-ого"/"-его"
 * (у нас в судебных названиях это почти всегда твёрдый вариант -> "-ого",
 * включая "-ский" -> "-ского"). "города Х" не трогаем — оно уже в нужном
 * виде, а имена городов эта функция сознательно не склоняет (отдельная,
 * гораздо менее предсказуемая задача).
 */
function toGenitiveCourtName(nominative) {
  // Эти слова в названии суда почти всегда уже стоят в родительном падеже
  // ("суд Калужской ОБЛАСТИ", "суд Приморского КРАЯ") — то есть и они сами,
  // и прилагательное перед ними трогать не нужно, иначе род собьётся
  // (у "область"/"республика" — женский род, а не как у "суда" мужской).
  const ADMIN_NOUN = /^(области|края|округа|района|республики|города)$/i;

  const words = String(nominative || "").trim().split(/\s+/).filter(Boolean);
  const skip = new Array(words.length).fill(false);
  words.forEach((w, i) => {
    if (ADMIN_NOUN.test(w)) {
      skip[i] = true;
      // Прилагательное перед административной единицей ("Калужской") не
      // трогаем — а вот если перед ней стоит "суд" (не прилагательное),
      // его по-прежнему нужно нормально просклонять в "суда".
      if (i > 0 && /(ый|ой|ий)$/i.test(words[i - 1])) skip[i - 1] = true;
      if (i < words.length - 1) skip[i + 1] = true; // имя после него ("Москвы")
    }
  });

  return words
    .map((word, i) => {
      if (skip[i]) return word;
      if (/^суд$/i.test(word)) return "суда";
      if (/(ый|ой|ий)$/i.test(word)) return word.slice(0, -2) + "ого";
      return word;
    })
    .join(" ");
}

/** Число прописью на русском (кардинальное числительное, именительный падеж). */
function numberToWordsRu(num) {
  num = Math.floor(Math.abs(Number(num) || 0));
  if (!num) return "";

  const ONES = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
  const ONES_F = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
  const TEENS = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
  const TENS = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
  const HUNDREDS = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

  function pluralForm(n, one, few, many) {
    const n100 = Math.abs(n) % 100;
    const n10 = n100 % 10;
    if (n100 > 10 && n100 < 20) return many;
    if (n10 > 1 && n10 < 5) return few;
    if (n10 === 1) return one;
    return many;
  }

  function threeDigits(n, feminine) {
    const words = [];
    const h = Math.floor(n / 100);
    const t = n % 100;
    if (h) words.push(HUNDREDS[h]);
    if (t >= 10 && t < 20) {
      words.push(TEENS[t - 10]);
    } else {
      const tens = Math.floor(t / 10);
      const ones = t % 10;
      if (tens) words.push(TENS[tens]);
      if (ones) words.push(feminine ? ONES_F[ones] : ONES[ones]);
    }
    return words;
  }

  const scales = [
    { div: 1000000000, one: "миллиард", few: "миллиарда", many: "миллиардов", feminine: false },
    { div: 1000000, one: "миллион", few: "миллиона", many: "миллионов", feminine: false },
    { div: 1000, one: "тысяча", few: "тысячи", many: "тысяч", feminine: true },
    { div: 1, one: "", few: "", many: "", feminine: false },
  ];

  let remaining = num;
  const parts = [];
  for (const scale of scales) {
    const value = Math.floor(remaining / scale.div);
    remaining %= scale.div;
    if (!value) continue;
    parts.push(...threeDigits(value, scale.feminine));
    if (scale.div > 1) parts.push(pluralForm(value, scale.one, scale.few, scale.many));
  }
  return parts.join(" ");
}

// Порядок экспертов в письме — отдельно от порядка в списке галочек
// (который всегда алфавитный). Пополняется/укорачивается по мере
// отметки галочек, а переставить местами можно стрелками.
let gpExpertOrder = [];

/** Счётчик выбранных — видно, сколько уже отмечено, не пролистывая список. */
function updateGpExpertsCount() {
  if (!els.gpExpertsCount) return;
  const n = gpExpertOrder.length;
  els.gpExpertsCount.textContent = n
    ? `Выбрано: ${n}`
    : "Никого не выбрано";
  els.gpExpertsCount.classList.toggle("has-selection", n > 0);
}

/**
 * Поиск по списку. Уже отмеченных не прячем даже при непопадании в
 * запрос — иначе легко "потерять" выбранного и снять галочку вслепую.
 */
function filterGpExperts() {
  if (!els.gpExpertSearch) return;
  const query = (els.gpExpertSearch.value || "").trim().toLowerCase();
  let shown = 0;
  els.gpExpertsList.querySelectorAll(".picker-item").forEach((item) => {
    const checked = item.querySelector("input").checked;
    const hit = !query || item.dataset.name.includes(query) || checked;
    item.classList.toggle("hidden", !hit);
    if (hit) shown++;
  });
  const empty = els.gpExpertsList.querySelector(".picker-empty");
  if (!shown && !empty) {
    const div = document.createElement("div");
    div.className = "picker-empty";
    div.textContent = "Никого не нашли";
    els.gpExpertsList.appendChild(div);
  } else if (shown && empty) {
    empty.remove();
  }
}


bind(els.gpExpertSearch, "input", filterGpExperts);

function renderGpExpertsOrder() {
  if (!gpExpertOrder.length) {
    els.gpExpertsOrderBox.classList.add("hidden");
    els.gpExpertsOrderList.innerHTML = "";
    return;
  }
  els.gpExpertsOrderBox.classList.remove("hidden");
  els.gpExpertsOrderList.innerHTML = gpExpertOrder
    .map((e, i) => `
      <div style="display:flex; align-items:center; gap:8px; padding:6px 8px; background:var(--bg-page); border-radius:6px; font-size:13px;">
        <span style="flex:0 0 20px; color:var(--text-secondary);">${i + 1}.</span>
        <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(e.name)}</span>
        <button type="button" class="back-btn" data-move-up="${i}" ${i === 0 ? "disabled" : ""} style="padding:2px 8px; font-size:12px;">↑</button>
        <button type="button" class="back-btn" data-move-down="${i}" ${i === gpExpertOrder.length - 1 ? "disabled" : ""} style="padding:2px 8px; font-size:12px;">↓</button>
      </div>`)
    .join("");

  els.gpExpertsOrderList.querySelectorAll("[data-move-up]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.moveUp);
      [gpExpertOrder[i - 1], gpExpertOrder[i]] = [gpExpertOrder[i], gpExpertOrder[i - 1]];
      renderGpExpertsOrder();
    });
  });
  els.gpExpertsOrderList.querySelectorAll("[data-move-down]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.moveDown);
      [gpExpertOrder[i], gpExpertOrder[i + 1]] = [gpExpertOrder[i + 1], gpExpertOrder[i]];
      renderGpExpertsOrder();
    });
  });
}

async function openGpForm() {
  els.gpForm.reset();
  els.gpQuestionsList.innerHTML = "";
  gpQuestionCount = 0;
  gpAddQuestionRow();

  els.gpCaseSelect.innerHTML = '<option value="">Загрузка проектов…</option>';
  try {
    const allCases = await apiFetch("/api/cases");
    // В список ГП не включаем архив целиком — ни отменённые, ни уже
    // завершённые проекты (гарантийное письмо имеет смысл только для
    // тех, что ещё в работе).
    const active = allCases.filter((c) => !c.is_cancelled && c.stage !== "done");
    els.gpCaseSelect.innerHTML = '<option value="">Выберите проект…</option>' + active
      .map((c) => `<option value="${c.id}" data-court="${escapeHtml(c.court_or_customer || "")}" data-case-number="${escapeHtml(c.case_number || "")}">${escapeHtml(c.name)}</option>`)
      .join("");
  } catch {
    els.gpCaseSelect.innerHTML = '<option value="">Не удалось загрузить список проектов</option>';
  }

  els.gpExpertsList.innerHTML = '<div class="empty-hint">Загрузка списка экспертов…</div>';
  if (els.gpExpertSearch) els.gpExpertSearch.value = "";
  els.gpOverlay.classList.remove("hidden");

  gpExpertOrder = [];
  updateGpExpertsCount();
  renderGpExpertsOrder();

  try {
    const { experts } = await apiFetch("/api/experts");
    if (!experts || experts.length === 0) {
      els.gpExpertsList.innerHTML = '<div class="empty-hint">Нет файлов экспертов в «База данных/Эксперты»</div>';
      return;
    }
    els.gpExpertsList.innerHTML = "";
    for (const expert of experts) {
      const label = document.createElement("label");
      label.className = "picker-item";
      label.dataset.name = expert.name.toLowerCase();
      label.innerHTML = `<input type="checkbox" value="${escapeHtml(expert.path)}"><span>${escapeHtml(expert.name)}</span>`;
      const checkbox = label.querySelector("input");
      checkbox.addEventListener("change", () => {
        label.classList.toggle("checked", checkbox.checked);
        if (checkbox.checked) {
          gpExpertOrder.push({ path: expert.path, name: expert.name });
        } else {
          gpExpertOrder = gpExpertOrder.filter((e) => e.path !== expert.path);
        }
        updateGpExpertsCount();
        renderGpExpertsOrder();
      });
      els.gpExpertsList.appendChild(label);
    }
    filterGpExperts();
    updateGpExpertsCount();
  } catch (err) {
    els.gpExpertsList.innerHTML = '<div class="empty-hint">Не удалось загрузить список экспертов</div>';
  }
}

/**
 * Суд для родительного падежа. Предпочитаем "чистое" название, сохранённое
 * при выборе проекта (gpCourtRaw) — так склонение не зависит от того, что
 * ещё дописано в шапку (заказчик, судья). Если проект не выбирали и шапка
 * заполнена вручную — берём первую строку шапки без "В " в начале.
 */
function updateCourtGenitive() {
  const raw = els.gpCourtRaw.value.trim();
  const nominative = raw || els.gpCourtHeader.value.split("\n")[0].replace(/^В\s+/i, "").trim();
  els.gpCourtGenitive.value = toGenitiveCourtName(nominative);
}

function capitalizeFirst(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

// При выборе проекта подтягиваем то, что уже известно — суд и номер дела,
// чтобы меньше вписывать вручную. Родительный падеж суда для текста письма
// считается сам (см. toGenitiveCourtName) — отдельного поля для него в
// форме больше нет.
els.gpCaseSelect.addEventListener("change", () => {
  const opt = els.gpCaseSelect.selectedOptions[0];
  if (!opt || !opt.value) return;
  const court = opt.dataset.court || "";
  const caseNumber = opt.dataset.caseNumber || "";
  if (court) {
    els.gpCourtHeader.value = `В ${court}`;
    els.gpCourtRaw.value = court;
  }
  if (caseNumber) els.gpCaseNumber.value = caseNumber;
  updateCourtGenitive();
});

// Пересчитываем и при ручном редактировании шапки — но только если
// пользователь стёр "чистое" название (иначе правки в остальных строках
// шапки — заказчик, судья — никак не должны сбивать уже верное склонение).
els.gpCourtHeader.addEventListener("input", () => {
  if (!els.gpCourtRaw.value.trim()) updateCourtGenitive();
});

// Стоимость и срок — пользователь вводит только цифры, текстовая форма
// (для документа) пишется сама, поле для неё нередактируемое.
els.gpCostAmount.addEventListener("input", () => {
  els.gpCostWords.value = capitalizeFirst(numberToWordsRu(els.gpCostAmount.value));
});
els.gpTermDays.addEventListener("input", () => {
  els.gpTermWords.value = capitalizeFirst(numberToWordsRu(els.gpTermDays.value));
});

els.gpCloseBtn.addEventListener("click", () => {
  els.gpOverlay.classList.add("hidden");
});

els.gpForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  updateCourtGenitive();

  const caseId = els.gpCaseSelect.value;
  if (!caseId) {
    alert("Выберите проект, к которому относится ГП");
    return;
  }

  const questions = [...els.gpQuestionsList.querySelectorAll(".gp-question-input")]
    .map((t) => t.value.trim())
    .filter(Boolean);
  const expertPaths = gpExpertOrder.map((e) => e.path);

  if (questions.length === 0) {
    alert("Добавьте хотя бы один вопрос экспертизы");
    return;
  }
  if (expertPaths.length === 0) {
    alert("Выберите хотя бы одного эксперта");
    return;
  }

  const submitBtn = els.gpForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "Создаём…";

  try {
    const result = await apiFetch("/api/gp/generate", {
      method: "POST",
      body: JSON.stringify({
        caseId,
        courtHeader: els.gpCourtHeader.value.trim(),
        caseNumber: els.gpCaseNumber.value.trim(),
        courtGenitive: els.gpCourtGenitive.value.trim(),
        expertiseType: els.gpExpertiseType.value.trim(),
        questions,
        costAmount: els.gpCostAmount.value.trim(),
        costWords: els.gpCostWords.value.trim(),
        termDays: els.gpTermDays.value.trim(),
        termWords: els.gpTermWords.value.trim(),
        expertPaths,
      }),
    });
    els.gpOverlay.classList.add("hidden");
    alert(`Готово! Файл «${result.name}» создан в проекте.`);
    // Обновим колонку "Дела", если сейчас открыта именно папка этого проекта
    if (currentPath === result.caseFolderPath) {
      renderFolder(currentPath);
    } else {
      loadColumnList("cases");
    }
  } catch (err) {
    alert("Не удалось создать документ: " + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Создать";
  }
});

/* ---------- Folder (single big panel) view ---------- */

let currentPath = "/";
let currentTrail = [];
let currentFolderEntries = [];
let selectMode = false;
let selectedPaths = new Set();
let folderSearching = false;
let folderSearchResults = [];

function showColumnsUI() {
  els.folderView.classList.add("hidden");
  els.columnsView.classList.remove("hidden");
}

function showFolderUI() {
  els.columnsView.classList.add("hidden");
  els.folderView.classList.remove("hidden");
}

/* ---------- Проекты (экспертизы и НИ) ---------- */

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

const STAGE_LABEL = { plan: "План", active: "Активный", control: "Контроль", done: "Завершён" };

function stageBadgeHtml(project) {
  if (project.is_cancelled) return `<span class="stage-badge stage-cancelled">Отменён</span>`;
  const cls = { plan: "stage-plan", active: "stage-active", control: "stage-control", done: "stage-done" }[project.stage];
  return `<span class="stage-badge ${cls}">${STAGE_LABEL[project.stage]}</span>`;
}

/**
 * Проверяет, является ли открытая сейчас в "Дела" папка отслеживаемым
 * проектом (экспертизой/НИ) — и если да, показывает баннер прямо в шапке
 * папки с кнопками "Перевести на стадию" / "Отменить". Если это обычная
 * папка (или мы вне "Дела" вообще) — баннер скрыт, всё выглядит как
 * обычный файловый менеджер, ничего лишнего не мешает.
 */
async function updateCaseBanner(path) {
  const banner = document.getElementById("caseBanner");
  const chatBox = document.getElementById("caseChatBox");
  const tasksBox = document.getElementById("planfixTasksBox");
  if (!path.startsWith(CASES_PATH)) {
    banner.classList.add("hidden");
    chatBox.classList.add("hidden");
    tasksBox.classList.add("hidden");
    return;
  }
  try {
    const project = await apiFetch(`/api/cases/by-path?path=${encodeURIComponent(path)}`);
    renderCaseBanner(project);
    loadCaseTasks(project);
    openCaseChatFor(project.id);
    openPlanfixTasksFor(project);
  } catch {
    banner.classList.add("hidden");
    chatBox.classList.add("hidden");
    tasksBox.classList.add("hidden");
    document.getElementById("caseTasksBox").classList.add("hidden");
  }
}

function renderCaseBanner(project) {
  const banner = document.getElementById("caseBanner");
  const otherStages = ["plan", "active", "control", "done"].filter((s) => s !== project.stage);

  const actions = [];
  if (!project.is_cancelled && otherStages.length) {
    actions.push(`
      <select id="caseStageSelect" style="padding:6px 10px; border-radius:8px; border:1px solid var(--border);">
        ${otherStages.map((s) => `<option value="${s}">${STAGE_LABEL[s]}</option>`).join("")}
      </select>
      <button class="upload-btn" id="caseAdvanceBtn" type="button">Переместить</button>
    `);
  }
  if (!project.is_cancelled) {
    actions.push(`<button class="back-btn danger-outline" id="caseCancelBtn" type="button">Отменить проект</button>`);
  }

  banner.innerHTML = `
    <div>${stageBadgeHtml(project)} <strong style="margin-left:8px;">${escapeHtml(project.name)}</strong></div>
    <div class="case-banner-actions">${actions.join("")}</div>
  `;
  banner.classList.remove("hidden");
  banner.dataset.caseId = project.id;

  const advanceBtn = document.getElementById("caseAdvanceBtn");
  if (advanceBtn) {
    advanceBtn.addEventListener("click", async () => {
      const targetStage = document.getElementById("caseStageSelect").value;
      advanceBtn.disabled = true;
      try {
        await apiFetch(`/api/cases/${project.id}/advance`, {
          method: "POST",
          body: JSON.stringify({ stage: targetStage }),
        });
        // Баннер виден только когда стоишь ровно в папке проекта — значит
        // этот самый путь только что переехал и больше не существует.
        // Поднимаемся к колонкам и обновляем список "Дела".
        goToColumns(true);
        loadColumnList("cases");
      } catch (err) {
        alert("Не удалось перевести на выбранную стадию: " + err.message);
      } finally {
        advanceBtn.disabled = false;
      }
    });
  }

  const cancelBtn = document.getElementById("caseCancelBtn");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", async () => {
      const reason = prompt("Причина отмены проекта:");
      if (!reason || !reason.trim()) return;
      cancelBtn.disabled = true;
      try {
        await apiFetch(`/api/cases/${project.id}/cancel`, {
          method: "POST",
          body: JSON.stringify({ reason: reason.trim() }),
        });
        goToColumns(true);
        loadColumnList("cases");
      } catch (err) {
        alert("Не удалось отменить проект: " + err.message);
      } finally {
        cancelBtn.disabled = false;
      }
    });
  }
}

/* ---------- Страница «Задачи» ----------
   Все задачи проектов в одном месте: видно, что горит, и можно завершить
   задачу, не уходя в Planfix. Завершение идёт через Planfix — он остаётся
   источником правды, у себя помечаем только после его подтверждения. */

const tasksFilters = { scope: "all", state: "open", q: "" };
let tasksCache = [];
// Справочник сотрудников Planfix — из него выбирают исполнителей.
// Держим один на всю страницу: он меняется редко.
let planfixPeopleCache = null;

async function loadPlanfixPeople(force = false) {
  if (planfixPeopleCache && !force) return planfixPeopleCache;
  const data = await apiFetch("/api/cases/planfix/people");
  planfixPeopleCache = data.people || [];
  return planfixPeopleCache;
}

function planfixPersonName(id) {
  const hit = (planfixPeopleCache || []).find((p) => Number(p.id) === Number(id));
  return hit ? hit.name : null;
}

function taskDateCell(value) {
  const text = value ? formatWhen(new Date(value).getTime()).split(" ")[0] : "";
  return escapeHtml(text);
}

function renderTasksPage(data) {
  const body = document.getElementById("tasksBody");
  const summary = document.getElementById("tasksSummary");
  const counts = data.counts || { open: 0, done: 0, overdue: 0 };

  summary.textContent = counts.overdue
    ? `В работе ${counts.open}, из них просрочено ${counts.overdue}. Завершено ${counts.done}.`
    : `В работе ${counts.open}. Завершено ${counts.done}.`;

  const badge = document.getElementById("casesTasksCount");
  if (badge) {
    badge.textContent = counts.open ? String(counts.open) : "";
    badge.classList.toggle("hidden", !counts.open);
  }

  // Без связи с сотрудником Planfix «Мои» и «Я поставил» показать нечего,
  // и создать задачу от своего имени тоже нельзя. Говорим об этом прямо,
  // а не отдаём пустой список без объяснений.
  const banner = document.getElementById("tasksBanner");
  if (banner) {
    banner.classList.toggle("hidden", !data.needsBinding);
    if (data.needsBinding) {
      banner.textContent = "Ваш аккаунт не связан с сотрудником Planfix — не работают «Мои задачи» " +
        "и постановка задач от вашего имени. Попросите администратора настроить связь: " +
        "Дела → Planfix → «Сотрудники и связь».";
    }
  }

  if (!data.tasks.length) {
    body.innerHTML = `<div class="empty-hint" style="padding:24px;">${
      tasksFilters.q ? "Ничего не нашли" :
      data.needsBinding && tasksFilters.scope !== "all" ? "Сначала нужна связь с сотрудником Planfix" :
      tasksFilters.scope === "mine" ? "На вас сейчас ничего не назначено" :
      tasksFilters.scope === "assigned" ? "Вы пока не ставили задач" :
      tasksFilters.state === "done" ? "Завершённых задач пока нет" :
      "Открытых задач нет — всё сделано"
    }</div>`;
    return;
  }

  const rows = data.tasks.map((t) => {
    const overdue = !t.is_done && t.end_date && new Date(t.end_date) < new Date();
    const typeLabel = t.case_type === "research" ? "Независимые исследования" : "Экспертизы";
    return `
      <tr class="${t.is_done ? "is-done" : ""}${overdue ? " overdue" : ""}" data-task-id="${t.id}">
        <td class="task-num">${t.planfix_id}</td>
        <td class="task-title" data-open-task="${t.id}">${escapeHtml(t.name)}</td>
        <td>
          <span class="task-project-type">${typeLabel}</span>
          <span class="task-project-name" data-open-case="${escapeHtml(t.folder_path)}">${escapeHtml(t.case_name)}</span>
        </td>
        <td class="task-date">${taskDateCell(t.end_date)}</td>
        <td class="task-people">${escapeHtml(t.assigner || "")}</td>
        <td class="task-people">${escapeHtml(t.assignees || "")}</td>
        <td class="task-actions">${
          t.is_done
            ? `<span class="task-done-mark">${svgCheck} завершена</span>`
            : `<button class="task-done-btn" type="button" data-complete="${t.id}">${svgCheck} Завершить</button>`
        }</td>
      </tr>`;
  }).join("");

  body.innerHTML = `
    <table class="tasks-table">
      <thead>
        <tr>
          <th>№</th><th>Название</th><th>Проект</th>
          <th>Окончание</th><th>Постановщик</th><th>Исполнители</th><th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;

  body.querySelectorAll("[data-complete]").forEach((btn) => {
    btn.addEventListener("click", () => completeTask(btn.dataset.complete, btn));
  });
  body.querySelectorAll("[data-open-task]").forEach((cell) => {
    cell.style.cursor = "pointer";
    cell.addEventListener("click", () => openTaskCard(cell.dataset.openTask));
  });
  body.querySelectorAll("[data-open-case]").forEach((cell) => {
    cell.style.cursor = "pointer";
    cell.addEventListener("click", () => {
      const path = cell.dataset.openCase;
      showSection("files", true);
      goToFolder(path, buildTrailExtending([{ label: "Дела", path: CASES_PATH }], CASES_PATH, path), true);
    });
  });
}

async function loadTasksPage() {
  const body = document.getElementById("tasksBody");
  body.innerHTML = '<div class="empty-hint" style="padding:24px;">Загрузка…</div>';
  const params = new URLSearchParams();
  params.set("scope", tasksFilters.scope);
  params.set("done", tasksFilters.state === "done" ? "1" : "0");
  if (tasksFilters.q) params.set("q", tasksFilters.q);
  try {
    const data = await apiFetch(`/api/cases/tasks/all?${params.toString()}`);
    tasksCache = data.tasks;
    renderTasksPage(data);
  } catch (err) {
    body.innerHTML = `<div class="empty-hint" style="padding:24px;">Не удалось загрузить задачи: ${escapeHtml(err.message)}</div>`;
  }
}

async function completeTask(id, btn) {
  const task = tasksCache.find((t) => String(t.id) === String(id));
  if (task && !confirm(`Завершить задачу «${task.name}»?\nОна будет закрыта и в Planfix.`)) return;
  btn.disabled = true;
  try {
    await apiFetch(`/api/cases/tasks/${id}/complete`, { method: "POST" });
    showToast("Задача завершена");
    loadTasksPage();
  } catch (err) {
    btn.disabled = false;
    alert("Не удалось завершить задачу: " + err.message);
  }
}

bind(document.getElementById("casesTasksBtn"), "click", () => showSection("tasks", true));

document.querySelectorAll("#tasksScope .seg-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    tasksFilters.scope = btn.dataset.scope;
    document.querySelectorAll("#tasksScope .seg-btn").forEach((b) => b.classList.toggle("active", b === btn));
    loadTasksPage();
  });
});

document.querySelectorAll("#tasksState .seg-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    tasksFilters.state = btn.dataset.state;
    document.querySelectorAll("#tasksState .seg-btn").forEach((b) => b.classList.toggle("active", b === btn));
    loadTasksPage();
  });
});

bind(document.getElementById("tasksSearch"), "input", debounce((e) => {
  tasksFilters.q = e.target.value.trim();
  loadTasksPage();
}, 300));

/* ---------- Карточка задачи ----------
   Подробности, комментарии из Planfix и правка исполнителей и срока.
   Любое изменение сначала уходит в Planfix и только после его согласия
   отражается у нас — как и завершение. */

const taskCardOverlay = document.getElementById("taskCardOverlay");
let taskCardId = null;

function closeTaskCard() {
  if (taskCardOverlay) taskCardOverlay.classList.add("hidden");
  taskCardId = null;
}
bind(document.getElementById("taskCardClose"), "click", closeTaskCard);
bind(taskCardOverlay, "click", (e) => { if (e.target === taskCardOverlay) closeTaskCard(); });

function commentHtml(c) {
  const when = c.at ? escapeHtml(String(c.at)) : "";
  return `
    <div class="task-comment">
      <div class="task-comment-head">
        <span class="task-comment-author">${escapeHtml(c.author || "—")}</span>
        <span class="task-comment-date">${when}</span>
      </div>
      <div class="task-comment-text">${escapeHtml(c.text || "")}</div>
    </div>`;
}

async function openTaskCard(id) {
  if (!taskCardOverlay) return;
  taskCardId = id;
  taskCardOverlay.classList.remove("hidden");
  const body = document.getElementById("taskCardBody");
  body.innerHTML = '<div class="empty-hint" style="padding:24px;">Загрузка…</div>';

  let data;
  try {
    data = await apiFetch(`/api/cases/tasks/${id}`);
    await loadPlanfixPeople();
  } catch (err) {
    body.innerHTML = `<div class="empty-hint" style="padding:24px;">Не удалось открыть задачу: ${escapeHtml(err.message)}</div>`;
    return;
  }
  if (taskCardId !== id) return; // карточку успели закрыть или открыть другую

  const t = data.task;
  const head = document.getElementById("taskCardHead");
  if (head) head.textContent = `Задача №${t.planfix_id}`;

  const selected = new Set((t.assignee_ids || []).map(Number));
  const peopleRows = (planfixPeopleCache || []).map((p) => `
    <label class="picker-item">
      <input type="checkbox" value="${p.id}" ${selected.has(Number(p.id)) ? "checked" : ""}>
      <span>${escapeHtml(p.name)}</span>
    </label>`).join("");

  body.innerHTML = `
    <h3 class="task-card-title">${escapeHtml(t.name)}</h3>
    <div class="task-card-meta">
      <span>${escapeHtml(t.case_type === "research" ? "Независимые исследования" : "Экспертизы")}</span>
      <span class="task-card-project" data-open-case="${escapeHtml(t.folder_path)}">${escapeHtml(t.case_name)}</span>
      <span>${escapeHtml(t.status_name || "")}</span>
    </div>
    ${t.description ? `<p class="task-card-desc">${escapeHtml(t.description)}</p>` : ""}
    <dl class="task-card-facts">
      <dt>Постановщик</dt><dd>${escapeHtml(t.assigner || "—")}</dd>
      <dt>Исполнители</dt><dd>${escapeHtml(t.assignees || "—")}</dd>
      <dt>Срок</dt><dd>${taskDateCell(t.end_date) || "—"}</dd>
      ${t.completed_by_name ? `<dt>Завершил в ИСУ</dt><dd>${escapeHtml(t.completed_by_name)}</dd>` : ""}
    </dl>

    ${data.canWrite && !t.is_done ? `
      <section class="task-card-block">
        <h4>Изменить</h4>
        <label class="task-card-field">Срок
          <input type="date" id="taskCardDeadline" value="${t.end_date ? escapeHtml(String(t.end_date).slice(0, 10)) : ""}">
        </label>
        <div class="picker" style="margin-top:10px;">
          <div class="picker-head">
            <span class="row-subtitle">Исполнители</span>
            <span class="picker-count" id="taskCardAssigneesCount"></span>
          </div>
          <div class="picker-search">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <input type="search" id="taskCardAssigneesSearch" placeholder="Поиск сотрудника" autocomplete="off">
          </div>
          <div class="picker-list" id="taskCardAssignees">${peopleRows}</div>
        </div>
        <div class="modal-actions" style="margin-top:10px;">
          <button class="primary" type="button" id="taskCardSave">Сохранить в Planfix</button>
        </div>
      </section>` : ""}

    <section class="task-card-block">
      <h4>Комментарии</h4>
      <div id="taskCardComments">${
        data.commentsError
          ? `<p class="row-subtitle">Не удалось получить комментарии из Planfix: ${escapeHtml(data.commentsError)}</p>`
          : (data.comments.length ? data.comments.map(commentHtml).join("") : '<p class="row-subtitle">Пока пусто</p>')
      }</div>
      <textarea id="taskCardCommentText" rows="2" placeholder="Написать комментарий" class="task-comment-input"></textarea>
      <div class="modal-actions" style="margin-top:8px;">
        <button class="primary" type="button" id="taskCardCommentSend">Отправить</button>
      </div>
    </section>`;

  const countAssignees = () => {
    const el = document.getElementById("taskCardAssigneesCount");
    if (!el) return;
    const n = body.querySelectorAll("#taskCardAssignees input:checked").length;
    el.textContent = n ? `Выбрано: ${n}` : "Никого не выбрано";
  };
  countAssignees();
  body.querySelectorAll("#taskCardAssignees input").forEach((cb) =>
    cb.addEventListener("change", countAssignees));

  bind(document.getElementById("taskCardAssigneesSearch"), "input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    body.querySelectorAll("#taskCardAssignees .picker-item").forEach((item) => {
      item.classList.toggle("hidden", !!q && !item.textContent.toLowerCase().includes(q));
    });
  });

  bind(document.getElementById("taskCardSave"), "click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const assigneeIds = [...body.querySelectorAll("#taskCardAssignees input:checked")].map((c) => Number(c.value));
    const deadline = document.getElementById("taskCardDeadline").value || null;
    try {
      await apiFetch(`/api/cases/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ assigneeIds, deadline }),
      });
      showToast("Изменения ушли в Planfix");
      closeTaskCard();
      loadTasksPage();
    } catch (err) {
      btn.disabled = false;
      alert("Не удалось изменить задачу: " + err.message);
    }
  });

  bind(document.getElementById("taskCardCommentSend"), "click", async (e) => {
    const btn = e.currentTarget;
    const field = document.getElementById("taskCardCommentText");
    const text = field.value.trim();
    if (!text) return;
    btn.disabled = true;
    try {
      const res = await apiFetch(`/api/cases/tasks/${id}/comment`, {
        method: "POST", body: JSON.stringify({ text }),
      });
      field.value = "";
      showToast(res.authorApplied === false
        ? "Комментарий отправлен, но Planfix не дал подписать его вами — имя ушло в тексте"
        : "Комментарий отправлен");
      openTaskCard(id);
    } catch (err) {
      btn.disabled = false;
      alert("Не удалось отправить комментарий: " + err.message);
    }
  });

  const projectLink = body.querySelector("[data-open-case]");
  if (projectLink) {
    projectLink.style.cursor = "pointer";
    projectLink.addEventListener("click", () => {
      const path = projectLink.dataset.openCase;
      closeTaskCard();
      showSection("files", true);
      goToFolder(path, buildTrailExtending([{ label: "Дела", path: CASES_PATH }], CASES_PATH, path), true);
    });
  }
}

/* ---------- Новая задача ----------
   Одно окно на два места: страница «Задачи» и папка самого проекта.
   Разница только в том, что из папки проект уже известен именять его
   там нельзя. Список задач — общий справочник типовых задач той стадии,
   на которой сейчас проект: у проекта на контроле предлагаются задачи
   контроля. Вписанная своя задача сохраняется в тот же справочник, то
   есть появляется и во втором месте тоже. */

const taskNewOverlay = document.getElementById("taskNewOverlay");

// Проект, ради которого окно открыли из его папки (иначе null).
let taskNewLockedCase = null;
// Что уже отмечено к постановке, и справочник задач текущей стадии.
let taskNewChosen = [];
let taskNewTemplates = [];
let taskNewStage = null;

function closeTaskNew() {
  if (taskNewOverlay) taskNewOverlay.classList.add("hidden");
  hideTaskNameList();
}
bind(document.getElementById("taskNewClose"), "click", closeTaskNew);
bind(taskNewOverlay, "click", (e) => { if (e.target === taskNewOverlay) closeTaskNew(); });

/* --- выбранные задачи --- */

function renderChosenTasks() {
  const box = document.getElementById("taskNewChosen");
  if (!box) return;
  box.innerHTML = taskNewChosen.map((name, i) => `
    <span class="chosen-task">
      <span>${escapeHtml(name)}</span>
      <button type="button" class="chosen-task-remove" data-remove="${i}" aria-label="Убрать">✕</button>
    </span>`).join("");
  box.querySelectorAll("[data-remove]").forEach((btn) =>
    btn.addEventListener("click", () => {
      taskNewChosen.splice(Number(btn.dataset.remove), 1);
      renderChosenTasks();
    }));

  const submit = document.getElementById("taskNewSubmit");
  if (submit) {
    submit.textContent = taskNewChosen.length > 1
      ? `Поставить задачи (${taskNewChosen.length})`
      : "Поставить задачу";
  }
}

function addChosenTask(name) {
  const clean = String(name || "").trim();
  if (!clean) return false;
  // Ту же самую задачу дважды в один проект ставить незачем.
  if (taskNewChosen.some((n) => n.toLowerCase() === clean.toLowerCase())) return false;
  taskNewChosen.push(clean);
  renderChosenTasks();
  return true;
}

/* --- всплывающий список задач стадии --- */

function hideTaskNameList() {
  const list = document.getElementById("taskNewNameList");
  if (list) list.classList.add("hidden");
}

function renderTaskNameList(filter = "") {
  const list = document.getElementById("taskNewNameList");
  if (!list) return;
  const q = String(filter).trim().toLowerCase();
  const items = taskNewTemplates.filter((t) => !q || t.name.toLowerCase().includes(q));

  if (!items.length) {
    list.innerHTML = `<div class="combo-empty">${
      taskNewStage === null ? "Сначала выберите проект"
        : taskNewTemplates.length ? "В списке ничего не нашли — можно вписать свою"
        : "Для этой стадии список пуст — впишите свою задачу"
    }</div>`;
  } else {
    list.innerHTML = items.map((t) => {
      const picked = taskNewChosen.some((n) => n.toLowerCase() === t.name.toLowerCase());
      return `<button type="button" class="combo-item${picked ? " picked" : ""}" data-name="${escapeHtml(t.name)}">
        ${escapeHtml(t.name)}${picked ? '<span class="combo-picked">выбрана</span>' : ""}
      </button>`;
    }).join("");
    list.querySelectorAll("[data-name]").forEach((btn) =>
      btn.addEventListener("mousedown", (e) => {
        // mousedown, а не click: click срабатывает уже после blur поля,
        // к этому моменту список успевает закрыться.
        e.preventDefault();
        addChosenTask(btn.dataset.name);
        document.getElementById("taskNewName").value = "";
        renderTaskNameList();
      }));
  }
  list.classList.remove("hidden");
}

/** Тянет справочник задач той стадии, на которой стоит выбранный проект. */
async function loadTaskTemplatesForCase(kase) {
  const hint = document.getElementById("taskNewStageHint");
  taskNewTemplates = [];
  taskNewStage = kase ? kase.stage : null;
  if (!kase) {
    if (hint) hint.textContent = "";
    return;
  }
  try {
    const data = await apiFetch(`/api/cases/planfix/stage-tasks/${kase.stage}`);
    taskNewTemplates = data.tasks || [];
    if (hint) {
      hint.textContent = data.supported
        ? `Список задач стадии «${STAGE_LABEL[kase.stage] || kase.stage}» — ${taskNewTemplates.length}`
        : `Для стадии «${STAGE_LABEL[kase.stage] || kase.stage}» типовых задач не предусмотрено`;
    }
  } catch (err) {
    if (hint) hint.textContent = "Не удалось загрузить список задач: " + err.message;
  }
}

bind(document.getElementById("taskNewNameToggle"), "click", () => {
  const list = document.getElementById("taskNewNameList");
  if (list && !list.classList.contains("hidden")) return hideTaskNameList();
  document.getElementById("taskNewName").focus();
  renderTaskNameList(document.getElementById("taskNewName").value);
});

bind(document.getElementById("taskNewName"), "focus", (e) => renderTaskNameList(e.target.value));
bind(document.getElementById("taskNewName"), "input", (e) => renderTaskNameList(e.target.value));
bind(document.getElementById("taskNewName"), "blur", () => setTimeout(hideTaskNameList, 120));
bind(document.getElementById("taskNewName"), "keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    if (addChosenTask(e.target.value)) e.target.value = "";
    hideTaskNameList();
  }
  if (e.key === "Escape") hideTaskNameList();
});

/**
 * «Добавить в список» — задача и отмечается к постановке, и сохраняется
 * в справочник стадии. Именно так она появляется и в папке проекта, и
 * на странице «Задачи»: справочник у них общий.
 */
bind(document.getElementById("taskNewNameAdd"), "click", async () => {
  const input = document.getElementById("taskNewName");
  const hint = document.getElementById("taskNewHint");
  const name = input.value.trim();
  if (!name) { input.focus(); return; }
  if (!taskNewStage) { hint.textContent = "Сначала выберите проект"; return; }

  addChosenTask(name);
  input.value = "";
  hint.textContent = "";
  try {
    const saved = await apiFetch("/api/cases/planfix/stage-tasks", {
      method: "POST",
      body: JSON.stringify({ stage: taskNewStage, name }),
    });
    taskNewTemplates.push({ id: saved.id, name: saved.name });
    showToast("Задача добавлена в список стадии");
  } catch (err) {
    // "уже есть в списке" — не ошибка: к постановке она уже отмечена.
    if (!/уже есть/i.test(err.message)) {
      hint.textContent = "В список не сохранилось: " + err.message + ". К постановке задача всё равно отмечена.";
    }
  }
  renderTaskNameList();
});

/**
 * Открывает окно. lockedCase — проект, если окно вызвано из его папки:
 * тогда проект подставлен и не меняется.
 */
async function openTaskNew(lockedCase = null) {
  if (!taskNewOverlay) return;
  taskNewOverlay.classList.remove("hidden");
  const hint = document.getElementById("taskNewHint");
  const submit = document.getElementById("taskNewSubmit");
  const lockNote = document.getElementById("taskNewCaseLocked");
  hint.textContent = "";
  submit.disabled = false;

  document.getElementById("taskNewForm").reset();
  document.getElementById("taskNewAssigneesCount").textContent = "Никого не выбрано";
  taskNewLockedCase = lockedCase;
  taskNewChosen = [];
  taskNewTemplates = [];
  taskNewStage = null;
  renderChosenTasks();
  hideTaskNameList();

  const select = document.getElementById("taskNewCase");
  try {
    const [allCases, people] = await Promise.all([
      apiFetch("/api/cases"),
      loadPlanfixPeople(),
    ]);
    // Ставить задачу можно только в проект, у которого уже есть карточка
    // в Planfix, и только в живой: в отменённый или завершённый — незачем.
    const list = allCases.filter((c) => c.planfix_id && !c.is_cancelled && c.stage !== "done");

    if (lockedCase) {
      select.innerHTML = `<option value="${lockedCase.id}">${escapeHtml(lockedCase.name)}</option>`;
      select.value = String(lockedCase.id);
      select.disabled = true;
      lockNote.classList.remove("hidden");
      lockNote.textContent = "Задача уйдёт в этот проект — вы открыли окно из его папки.";
      await loadTaskTemplatesForCase(lockedCase);
    } else {
      select.disabled = false;
      lockNote.classList.add("hidden");
      select.innerHTML = '<option value="">Выберите проект…</option>' +
        list.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
      if (!list.length) {
        hint.textContent = "Нет проектов, связанных с Planfix. Сначала выполните перенос из Planfix.";
      }
      // Список задач зависит от стадии выбранного проекта — грузим его,
      // как только проект выбран, и перегружаем при смене.
      select.onchange = async () => {
        const kase = list.find((c) => String(c.id) === select.value) || null;
        await loadTaskTemplatesForCase(kase);
        // Список перерисовываем, только если он и так открыт: сам собой
        // выпадать при выборе проекта он не должен.
        const nameList = document.getElementById("taskNewNameList");
        if (nameList && !nameList.classList.contains("hidden")) {
          renderTaskNameList(document.getElementById("taskNewName").value);
        }
      };
    }

    document.getElementById("taskNewAssigneesList").innerHTML = people.map((p) => `
      <label class="picker-item">
        <input type="checkbox" value="${p.id}">
        <span>${escapeHtml(p.name)}</span>
      </label>`).join("") || '<p class="row-subtitle">Справочник сотрудников пуст — обновите его в окне Planfix.</p>';

    document.querySelectorAll("#taskNewAssigneesList input").forEach((cb) =>
      cb.addEventListener("change", () => {
        const n = document.querySelectorAll("#taskNewAssigneesList input:checked").length;
        document.getElementById("taskNewAssigneesCount").textContent =
          n ? `Выбрано: ${n}` : "Никого не выбрано";
      }));
  } catch (err) {
    hint.textContent = "Не удалось загрузить списки: " + err.message;
    submit.disabled = true;
  }
}

bind(document.getElementById("tasksNewBtn"), "click", () => openTaskNew());

bind(document.getElementById("taskNewAssigneesSearch"), "input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  document.querySelectorAll("#taskNewAssigneesList .picker-item").forEach((item) => {
    item.classList.toggle("hidden", !!q && !item.textContent.toLowerCase().includes(q));
  });
});

bind(document.getElementById("taskNewForm"), "submit", async (e) => {
  e.preventDefault();
  const submit = document.getElementById("taskNewSubmit");
  const hint = document.getElementById("taskNewHint");
  const input = document.getElementById("taskNewName");

  // То, что человек набрал, но не успел отметить, тоже считаем задачей:
  // иначе нажатие «Поставить» молча выбросило бы набранный текст.
  addChosenTask(input.value);
  input.value = "";
  if (!taskNewChosen.length) {
    hint.textContent = "Выберите задачу из списка или впишите свою";
    return;
  }
  const caseId = Number(document.getElementById("taskNewCase").value ||
    (taskNewLockedCase ? taskNewLockedCase.id : 0));
  if (!caseId) { hint.textContent = "Выберите проект"; return; }

  submit.disabled = true;
  hint.textContent = "Отправляю в Planfix…";
  try {
    const res = await apiFetch("/api/cases/tasks", {
      method: "POST",
      body: JSON.stringify({
        caseId,
        names: taskNewChosen,
        // Описание при постановке не спрашиваем: название задачи говорит
        // само за себя, а подробности пишут комментарием уже в карточке.
        deadline: document.getElementById("taskNewDeadline").value || null,
        assigneeIds: [...document.querySelectorAll("#taskNewAssigneesList input:checked")]
          .map((c) => Number(c.value)),
      }),
    });

    // Часть задач могла не пройти — тогда окно не закрываем, оставляем
    // в нём только непоставленные и показываем причину.
    const failed = (res.results || []).filter((r) => !r.ok);
    if (failed.length) {
      taskNewChosen = failed.map((r) => r.name);
      renderChosenTasks();
      submit.disabled = false;
      hint.textContent = res.message || "Часть задач поставить не удалось";
      if (res.created) showToast(`Поставлено задач: ${res.created}`);
      return;
    }

    closeTaskNew();
    showToast(res.authorApplied === false
      ? "Задачи созданы, но Planfix не дал назначить вас постановщиком — имя ушло в описании"
      : (res.created > 1 ? `Поставлено задач: ${res.created}` : "Задача поставлена"));
    if (document.getElementById("tasksSection") &&
        !document.getElementById("tasksSection").classList.contains("hidden")) {
      loadTasksPage();
    }
    if (taskNewLockedCase) loadPlanfixTasksList();
  } catch (err) {
    submit.disabled = false;
    hint.textContent = "Не удалось: " + err.message;
  }
});

/* ---------- Связь аккаунтов с сотрудниками Planfix (администрирование) ---------- */

const pfPeopleOverlay = document.getElementById("pfPeopleOverlay");

bind(document.getElementById("pfPeopleClose"), "click",
  () => pfPeopleOverlay && pfPeopleOverlay.classList.add("hidden"));
bind(pfPeopleOverlay, "click", (e) => {
  if (e.target === pfPeopleOverlay) pfPeopleOverlay.classList.add("hidden");
});

function renderBindings(data) {
  const body = document.getElementById("pfPeopleBody");
  const synced = document.getElementById("pfPeopleSynced");
  if (synced) {
    synced.textContent = data.syncedAt
      ? `Список обновлён ${formatWhen(new Date(data.syncedAt).getTime())}`
      : "Список сотрудников ещё ни разу не загружали";
  }

  const options = (selectedId) => '<option value="">— не связан —</option>' +
    (data.people || []).map((p) =>
      `<option value="${p.id}" ${Number(p.id) === Number(selectedId) ? "selected" : ""}>${escapeHtml(p.name)}</option>`
    ).join("");

  body.innerHTML = `
    <table class="tasks-table pf-bindings">
      <thead><tr><th>Пользователь ИСУ</th><th>Сотрудник в Planfix</th><th>Когда связали</th></tr></thead>
      <tbody>${(data.bindings || []).map((b) => `
        <tr data-user="${b.id}">
          <td>
            <span class="task-title">${escapeHtml(b.username)}</span>
            ${b.role === "admin" ? '<span class="task-project-type">администратор</span>' : ""}
          </td>
          <td>
            <select data-bind-user="${b.id}">${options(b.planfix_user_id)}</select>
            ${b.planfix_user_id && b.planfix_active === false
              ? '<span class="task-project-type">этого сотрудника уже нет в Planfix</span>' : ""}
            ${!b.planfix_user_id && b.legacy_name
              ? `<span class="task-project-type">раньше выбирал себя как «${escapeHtml(b.legacy_name)}»</span>` : ""}
          </td>
          <td class="task-date">${b.planfix_bound_at
            ? escapeHtml(formatWhen(new Date(b.planfix_bound_at).getTime()))
            : "—"}${b.bound_by_name ? `<span class="task-project-type">${escapeHtml(b.bound_by_name)}</span>` : ""}</td>
        </tr>`).join("")}
      </tbody>
    </table>`;

  body.querySelectorAll("[data-bind-user]").forEach((select) => {
    select.addEventListener("change", async () => {
      const previous = select.dataset.previous || "";
      select.disabled = true;
      try {
        const res = await apiFetch(`/api/cases/planfix/bindings/${select.dataset.bindUser}`, {
          method: "POST",
          body: JSON.stringify({ planfixUserId: select.value || null }),
        });
        showToast(res.bound ? `Связано: ${res.planfixName}` : "Связь снята");
        renderBindings({ ...data, bindings: res.bindings });
      } catch (err) {
        // Возвращаем прежнее значение: иначе на экране будет связь,
        // которой на самом деле нет.
        select.value = previous;
        select.disabled = false;
        alert(err.message);
      }
    });
    select.dataset.previous = select.value;
  });
}

async function openPlanfixPeople() {
  if (!pfPeopleOverlay) return;
  // Открываем вместо окна Planfix, а не поверх него: два окна друг на
  // друге путают, а нижнее ещё и перехватывает нажатия.
  if (planfixOverlay) planfixOverlay.classList.add("hidden");
  pfPeopleOverlay.classList.remove("hidden");
  const body = document.getElementById("pfPeopleBody");
  body.innerHTML = '<div class="empty-hint" style="padding:24px;">Загрузка…</div>';
  try {
    const data = await apiFetch("/api/cases/planfix/bindings");
    planfixPeopleCache = data.people || [];
    renderBindings(data);
  } catch (err) {
    body.innerHTML = `<div class="empty-hint" style="padding:24px;">Не удалось загрузить: ${escapeHtml(err.message)}</div>`;
  }
}

bind(document.getElementById("planfixPeopleBtn"), "click", openPlanfixPeople);

bind(document.getElementById("pfPeopleSyncBtn"), "click", async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  const wasText = btn.textContent;
  btn.textContent = "Обновляю…";
  try {
    const res = await apiFetch("/api/cases/planfix/people/sync", { method: "POST" });
    planfixPeopleCache = res.people || [];
    showToast(res.adopted
      ? `Сотрудников: ${res.total}. Связано по прежним именам: ${res.adopted}`
      : `Сотрудников: ${res.total}`);
    const data = await apiFetch("/api/cases/planfix/bindings");
    renderBindings(data);
  } catch (err) {
    alert("Не удалось обновить список: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = wasText;
  }
});

/* ---- Окно Planfix: диагностика и перенос ----
   Кнопка в шапке колонки открывает окно, а не запускает перенос сразу:
   операция читает весь аккаунт Planfix и заводит папки, такое не должно
   случаться от одного случайного клика. */

const planfixOverlay = document.getElementById("planfixOverlay");
const planfixResult = document.getElementById("planfixResult");

function syncSummary(report) {
  const parts = [];
  if (report.created.length) parts.push(`новых проектов ${report.created.length}`);
  if (report.adopted.length) parts.push(`подхвачено папок ${report.adopted.length}`);
  if (report.updated.length) parts.push(`обновлено ${report.updated.length}`);
  if (report.foldersCreated) parts.push(`создано папок ${report.foldersCreated}`);
  if (report.tasksSynced) parts.push(`задач ${report.tasksSynced}`);
  if (report.skipped.length) parts.push(`пропущено ${report.skipped.length}`);
  if (report.errors.length) parts.push(`ошибок ${report.errors.length}`);
  return parts.length ? parts.join(", ") : "изменений нет";
}

function pfTable(headers, rows) {
  return `<table class="pf-table">
    <tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>
    ${rows.map((r) => `<tr>${r.join("")}</tr>`).join("")}
  </table>`;
}

/** Показывает, что видно в Planfix: группы, поля и статусы задач. */
function renderProbe(data) {
  const typeLabel = { expertise: "Экспертизы", research: "Независимые исследования" };

  const groups = pfTable(["Группа проектов", "id", "Проектов", "Переносится как"],
    data.groups.map((g) => [
      `<td>${escapeHtml(g.name)}</td>`,
      `<td class="num">${g.id ?? "—"}</td>`,
      `<td class="num">${g.count}</td>`,
      g.mappedTo
        ? `<td class="pf-ok">${typeLabel[g.mappedTo]}</td>`
        : `<td class="pf-warn">не переносится — определим по префиксу «ЭКС.»/«НИ.»</td>`,
    ]));

  const usedIds = new Set((data.fieldMapping || []).map((m) => Number(m.id)).filter(Boolean));
  const fields = pfTable(["Поле проекта", "id", "Пример значения"],
    data.fields.map((f) => [
      `<td>${escapeHtml(f.name || "(без названия)")}${usedIds.has(Number(f.id)) ? ' <span class="pf-ok">— читаем</span>' : ""}</td>`,
      `<td class="num">${f.id}</td>`,
      `<td>${escapeHtml(String(f.sample == null ? "—" : f.sample)).slice(0, 60)}</td>`,
    ]));

  const mapping = pfTable(["Что нужно импорту", "Какое поле берём"],
    (data.fieldMapping || []).map((m) => [
      `<td>${escapeHtml(m.need)}</td>`,
      m.id
        ? `<td class="pf-ok num">${m.id}</td>`
        : '<td class="pf-warn">не найдено — эти данные не перенесутся</td>',
    ]));

  const statuses = pfTable(["Статус задачи", "Задач", "Считается завершённой"],
    data.taskStatuses.map((st) => [
      `<td>${escapeHtml(st.name)}</td>`,
      `<td class="num">${st.count}</td>`,
      st.treatedAsDone ? '<td class="pf-ok">да</td>' : "<td>нет</td>",
    ]));

  planfixResult.innerHTML = `
    <div class="pf-block">
      <h3>Группы проектов</h3>
      ${groups}
    </div>
    <div class="pf-block">
      <h3>Поля проекта</h3>
      ${data.fields.length
        ? fields
        : `<p class="pf-warn">Planfix не вернул ни одного поля. Справочник полей опрошен по адресам: ${
            escapeHtml((data.catalogueTried || []).join("; ") || "—")}</p>`}
      ${data.projectsSampled && !data.projectsWithValues
        ? '<p class="pf-warn">Значения полей не пришли ни у одного проекта — переносить карточки не по чему.</p>'
        : ""}
    </div>
    <div class="pf-block">
      <h3>Что импорт читает</h3>
      ${mapping}
      <p class="page-sub">Поля определяются по названию${
        data.catalogueSource ? ` (справочник: ${escapeHtml(data.catalogueSource)})` : ""
      }; настраивать id вручную не нужно.</p>
    </div>
    <div class="pf-block">
      <h3>Статусы задач</h3>
      ${statuses}
      <p class="page-sub">Свои названия завершённых статусов добавляются в .env: PLANFIX_DONE_STATUSES="Сдана,Принята".</p>
    </div>
    <p class="page-sub">Смотрели ${data.projectsSampled} проектов (значения полей пришли у ${data.projectsWithValues}) и ${data.tasksSampled} задач.</p>
  `;
}

function renderSyncReport(report) {
  const list = (title, items, render) =>
    items.length
      ? `<div class="pf-block"><h3>${title} (${items.length})</h3>
           <ul class="pf-list">${items.slice(0, 50).map(render).join("")}</ul>
           ${items.length > 50 ? `<p class="page-sub">…и ещё ${items.length - 50}</p>` : ""}
         </div>`
      : "";

  planfixResult.innerHTML = `
    <p class="row-subtitle"><strong>Итог: ${escapeHtml(syncSummary(report))}</strong></p>
    ${(report.warnings || []).map((w) => `<p class="pf-warn">${escapeHtml(w)}</p>`).join("")}
    ${list("Новые проекты", report.created, (x) =>
      `<li>${escapeHtml(x.name)}${x.foldersCreated ? ` — папок создано ${x.foldersCreated}` : ""}</li>`)}
    ${list("Подхвачены существующие папки", report.adopted, (x) => `<li>${escapeHtml(x.name)} — ${escapeHtml(x.folder)}</li>`)}
    ${list("Обновлены", report.updated, (x) => `<li>${escapeHtml(x.name)}: ${escapeHtml(x.changes.join(", "))}</li>`)}
    ${list("Пропущены", report.skipped, (x) => `<li>${escapeHtml(x.name)} — ${escapeHtml(x.why)}</li>`)}
    ${list("Ошибки", report.errors, (x) => `<li>${escapeHtml(x.name)} — ${escapeHtml(x.error)}</li>`)}
    <p class="page-sub">Просмотрено проектов ${report.projectsSeen}, задач ${report.tasksSeen}, без изменений ${report.unchanged}.</p>
  `;
}

async function showLastSync() {
  const el = document.getElementById("planfixLastSync");
  try {
    const { last } = await apiFetch("/api/cases/planfix/sync-status");
    if (!last) { el.textContent = "Сверки ещё не было."; return; }
    const when = formatWhen(new Date(last.finished_at || last.started_at).getTime());
    el.textContent = last.ok
      ? `Последняя сверка: ${when} — ${syncSummary(last.report || { created: [], adopted: [], updated: [], skipped: [], errors: [] })}`
      : `Последняя сверка ${when} закончилась ошибкой: ${last.error || "причина не записана"}`;
  } catch (err) {
    el.textContent = "Не удалось узнать, когда сверялись: " + err.message;
  }
}

bind(els.planfixSyncBtn, "click", () => {
  planfixOverlay.classList.remove("hidden");
  planfixResult.innerHTML = "";
  showLastSync();
});

bind(document.getElementById("planfixCloseBtn"), "click", () => {
  planfixOverlay.classList.add("hidden");
});

bind(document.getElementById("planfixProbeBtn"), "click", async () => {
  const btn = document.getElementById("planfixProbeBtn");
  btn.disabled = true;
  planfixResult.innerHTML = '<div class="empty-hint" style="padding:16px;">Спрашиваю Planfix…</div>';
  try {
    renderProbe(await apiFetch("/api/cases/planfix/probe"));
  } catch (err) {
    planfixResult.innerHTML = `<div class="empty-hint" style="padding:16px;">${escapeHtml(err.message)}</div>`;
  } finally {
    btn.disabled = false;
  }
});

bind(document.getElementById("planfixRunBtn"), "click", async () => {
  const btn = document.getElementById("planfixRunBtn");
  btn.disabled = true;
  planfixResult.innerHTML = '<div class="empty-hint" style="padding:16px;">Переношу проекты и задачи…</div>';
  try {
    const { report } = await apiFetch("/api/cases/planfix/sync", { method: "POST" });
    renderSyncReport(report);
    showToast("Planfix: " + syncSummary(report));
    showLastSync();
    if (currentSection === "files") {
      if (els.folderView && !els.folderView.classList.contains("hidden")) renderFolder(currentPath);
      else loadColumnList("cases");
    }
  } catch (err) {
    planfixResult.innerHTML = `<div class="empty-hint" style="padding:16px;">Не удалось перенести: ${escapeHtml(err.message)}</div>`;
  } finally {
    btn.disabled = false;
  }
});

/* ---- Задачи проекта: зеркало Planfix ----
   Показываем то, что уже перенесено сверкой, а не ходим в чужой API на
   каждое открытие папки: страница открывается мгновенно и работает,
   даже когда Planfix недоступен. */

function taskDateText(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const p2 = (n) => String(n).padStart(2, "0");
  return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function taskRowHtml(task) {
  const overdue = !task.is_done && task.end_date && new Date(task.end_date) < new Date();
  const due = taskDateText(task.end_date);
  return `
    <div class="task-row${task.is_done ? " task-done" : ""}">
      <span class="task-mark">${task.is_done ? svgCheck : ""}</span>
      <span class="task-name">${escapeHtml(task.name)}</span>
      <span class="task-who">${escapeHtml(task.assignees || "")}</span>
      <span class="task-due${overdue ? " task-overdue" : ""}">${escapeHtml(due)}</span>
    </div>`;
}

async function loadCaseTasks(project) {
  const box = document.getElementById("caseTasksBox");
  const body = document.getElementById("caseTasksBody");
  const title = document.getElementById("caseTasksTitle");
  box.classList.remove("hidden");
  body.innerHTML = '<div class="empty-hint" style="padding:12px;">Загрузка…</div>';

  let data;
  try {
    data = await apiFetch(`/api/cases/${project.id}/tasks`);
  } catch (err) {
    title.textContent = "Задачи проекта";
    body.innerHTML = `<div class="empty-hint" style="padding:12px;">Не удалось загрузить: ${escapeHtml(err.message)}</div>`;
    return;
  }

  const open = data.tasks.filter((t) => !t.is_done);
  const done = data.tasks.filter((t) => t.is_done);
  title.textContent = data.tasks.length
    ? `Задачи проекта — в работе ${open.length}, завершено ${done.length}`
    : "Задачи проекта";

  if (!data.tasks.length) {
    body.innerHTML = `<div class="empty-hint" style="padding:12px;">${
      project.planfix_id
        ? "По этому проекту в Planfix пока нет задач."
        : "Проект ещё не связан с Planfix — задачи появятся после сверки."
    }</div>`;
    return;
  }

  body.innerHTML = `
    ${open.length ? `<div class="task-group">Сейчас в работе</div>${open.map(taskRowHtml).join("")}` : ""}
    ${done.length ? `<div class="task-group">Завершённые</div>${done.map(taskRowHtml).join("")}` : ""}
  `;
}

bind(document.getElementById("caseTasksToggle"), "click", () => {
  const body = document.getElementById("caseTasksBody");
  const arrow = document.getElementById("caseTasksArrow");
  body.classList.toggle("hidden");
  arrow.textContent = body.classList.contains("hidden") ? "▸" : "▾";
});

/* ---- Чат-ассистент внутри карточки проекта ---- */

let caseChatCurrentId = null;

function openCaseChatFor(caseId) {
  const chatBox = document.getElementById("caseChatBox");
  chatBox.classList.remove("hidden");
  if (caseChatCurrentId === caseId) return; // уже открыт этот же проект — не перезагружаем зря
  caseChatCurrentId = caseId;
  document.getElementById("caseChatMessages").innerHTML = "";
  // Сворачиваем при переходе к новому проекту — раскроется, если понадобится.
  document.getElementById("caseChatBody").classList.add("hidden");
  document.getElementById("caseChatArrow").textContent = "▾";
}

document.getElementById("caseChatToggle").addEventListener("click", async () => {
  const body = document.getElementById("caseChatBody");
  const arrow = document.getElementById("caseChatArrow");
  const opening = body.classList.contains("hidden");
  body.classList.toggle("hidden");
  arrow.textContent = opening ? "▴" : "▾";
  if (opening && caseChatCurrentId) {
    await loadCaseChatHistory(caseChatCurrentId);
  }
});

async function loadCaseChatHistory(caseId) {
  const container = document.getElementById("caseChatMessages");
  try {
    const history = await apiFetch(`/api/cases/${caseId}/chat`);
    if (!history.length) {
      container.innerHTML = '<div class="row-subtitle" style="text-align:center;">Пока пусто — задайте вопрос по проекту</div>';
      return;
    }
    container.innerHTML = "";
    for (const m of history) appendCaseChatMessage(m.role, m.content);
    container.scrollTop = container.scrollHeight;
  } catch (err) {
    container.innerHTML = `<div class="row-subtitle">Не удалось загрузить историю: ${escapeHtml(err.message)}</div>`;
  }
}

function appendCaseChatMessage(role, text, pending) {
  const container = document.getElementById("caseChatMessages");
  const bubble = document.createElement("div");
  bubble.className = `case-chat-msg ${role}${pending ? " pending" : ""}`;
  bubble.textContent = text;
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
  return bubble;
}

document.getElementById("caseChatForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.getElementById("caseChatInput");
  const text = input.value.trim();
  if (!text || !caseChatCurrentId) return;

  input.value = "";
  const sendBtn = document.getElementById("caseChatSendBtn");
  sendBtn.disabled = true;

  appendCaseChatMessage("user", text);
  const pendingBubble = appendCaseChatMessage("assistant", "Думаю…", true);

  try {
    const { answer } = await apiFetch(`/api/cases/${caseChatCurrentId}/chat`, {
      method: "POST",
      body: JSON.stringify({ message: text }),
    });
    pendingBubble.textContent = answer;
    pendingBubble.classList.remove("pending");
  } catch (err) {
    pendingBubble.textContent = "Не удалось получить ответ: " + err.message;
    pendingBubble.classList.remove("pending");
  } finally {
    sendBtn.disabled = false;
  }
});

/* ---- Задачи Planfix прямо в папке проекта ----
   Здесь показываем список типовых задач текущей стадии — тот же самый
   справочник, что и в окне постановки. Само окно тоже то же самое:
   кнопка открывает его с уже подставленным проектом. Раньше здесь была
   своя отдельная форма, и два места жили каждое своей жизнью. */

let planfixTasksCurrentProject = null;

function openPlanfixTasksFor(project) {
  const box = document.getElementById("planfixTasksBox");
  if (!box) return;
  box.classList.remove("hidden");
  if (planfixTasksCurrentProject && planfixTasksCurrentProject.id === project.id) return;
  planfixTasksCurrentProject = project;
  const list = document.getElementById("planfixTasksList");
  if (list) list.innerHTML = "";
  const err = document.getElementById("planfixTasksError");
  if (err) err.textContent = "";
  document.getElementById("planfixTasksBody").classList.add("hidden");
  document.getElementById("planfixTasksArrow").textContent = "▾";
}

bind(document.getElementById("planfixTasksToggle"), "click", async () => {
  const body = document.getElementById("planfixTasksBody");
  const arrow = document.getElementById("planfixTasksArrow");
  const opening = body.classList.contains("hidden");
  body.classList.toggle("hidden");
  arrow.textContent = opening ? "▴" : "▾";
  if (opening && planfixTasksCurrentProject) await loadPlanfixTasksList();
});

/** Список типовых задач стадии проекта — только показать, что есть. */
async function loadPlanfixTasksList() {
  const list = document.getElementById("planfixTasksList");
  const errorEl = document.getElementById("planfixTasksError");
  if (!list || !planfixTasksCurrentProject) return;
  errorEl.textContent = "";
  list.innerHTML = '<div class="row-subtitle">Загрузка…</div>';

  try {
    const data = await apiFetch(
      `/api/cases/planfix/stage-tasks/${planfixTasksCurrentProject.stage}`);
    const stageName = STAGE_LABEL[planfixTasksCurrentProject.stage] || planfixTasksCurrentProject.stage;
    if (!data.supported) {
      list.innerHTML = `<div class="row-subtitle">Для стадии «${escapeHtml(stageName)}» типовых задач не предусмотрено</div>`;
      return;
    }
    list.innerHTML = `<div class="row-subtitle">Задачи стадии «${escapeHtml(stageName)}»:</div>` +
      (data.tasks.length
        ? `<ul class="stage-task-list">${data.tasks
            .map((t) => `<li>${escapeHtml(t.name)}</li>`).join("")}</ul>`
        : '<div class="row-subtitle">Список пока пуст — впишите свою задачу в окне постановки, она сюда добавится</div>');
  } catch (err) {
    list.innerHTML = "";
    errorEl.textContent = "Не удалось загрузить: " + err.message;
  }
}

// Кнопка открывает то же окно, что и на странице «Задачи», но проект в
// нём уже выбран и не меняется.
bind(document.getElementById("planfixTasksCreateBtn"), "click", () => {
  if (!planfixTasksCurrentProject) return;
  openTaskNew(planfixTasksCurrentProject);
});

/* ---- Форма создания проекта ---- */

/** Заполняет выпадающий список "Структура" из справочника организаций. */
async function loadOrganizationsSelect() {
  const select = document.getElementById("pfOrganization");
  const current = select.value;
  select.innerHTML = '<option value="">Не выбрана</option>';
  try {
    const orgs = await apiFetch("/api/organizations");
    for (const o of orgs) {
      const opt = document.createElement("option");
      opt.value = o.name;
      opt.textContent = o.name;
      select.appendChild(opt);
    }
    if (current) select.value = current;
  } catch { /* список организаций необязателен для работы формы */ }
}

/* ---- Материалы при создании проекта (без ИИ — просто выбор папки) ---- */

// Файлы копятся здесь локально (браузер), реально загружаются на сервер
// только в момент отправки формы — чтобы не заливать лишнее, если
// передумали и убрали файл до создания проекта.
let pfPendingFiles = { zapros: [], materials: [] };

function resetPendingProjectFiles() {
  pfPendingFiles = { zapros: [], materials: [] };
  document.getElementById("pfAttachZapros").value = "";
  document.getElementById("pfAttachMaterials").value = "";
  renderPendingFileList("zapros");
  renderPendingFileList("materials");
}

function renderPendingFileList(zone) {
  const suffix = zone === "zapros" ? "Zapros" : "Materials";
  const container = document.getElementById(`pfAttach${suffix}List`);
  const counter = document.getElementById(`pfAttach${suffix}Count`);
  const hint = document.getElementById(`pfAttach${suffix}Hint`);
  const items = pfPendingFiles[zone];

  counter.textContent = items.length ? String(items.length) : "";
  counter.classList.toggle("hidden", items.length === 0);
  // Подсказку про перетаскивание убираем, когда файлы уже набраны —
  // чтобы список не тонул в служебном тексте.
  hint.classList.toggle("hidden", items.length > 0);

  container.innerHTML = items
    .map((f, i) => `
      <div class="pf-attach-file-row">
        <span class="pf-attach-file-name">${escapeHtml(f.label)}</span>
        <span class="pf-attach-file-size">${formatSize(f.file.size)}</span>
        <button type="button" data-remove-zone="${zone}" data-remove-index="${i}" title="Убрать">✕</button>
      </div>`)
    .join("");
  container.querySelectorAll("[data-remove-index]").forEach((btn) => {
    btn.addEventListener("click", () => {
      pfPendingFiles[btn.dataset.removeZone].splice(Number(btn.dataset.removeIndex), 1);
      renderPendingFileList(btn.dataset.removeZone);
    });
  });
}

/**
 * Добавляет файлы в зону, отсеивая повторы: один и тот же файл легко
 * перетащить дважды, и тогда он загрузился бы в проект в двух экземплярах.
 * Считаем совпадением одинаковые имя, размер и время изменения.
 */
function addPendingFiles(zone, incoming) {
  const known = new Set(pfPendingFiles[zone].map((f) => `${f.label}|${f.file.size}|${f.file.lastModified}`));
  let added = 0, skipped = 0;

  for (const item of incoming) {
    const file = item instanceof File ? item : item.file;
    // Внутри проекта структура своя ("01_Запрос" и т.д.), поэтому файлы из
    // перетащенной папки раскладываются плоско — но в списке показываем,
    // откуда что взялось.
    const label = (item.relativePath || file.webkitRelativePath || file.name);
    const key = `${label}|${file.size}|${file.lastModified}`;
    if (known.has(key)) { skipped++; continue; }
    known.add(key);
    pfPendingFiles[zone].push({ file, label });
    added++;
  }

  renderPendingFileList(zone);
  if (skipped > 0) {
    showToast(added > 0
      ? `Добавлено файлов: ${added}, повторов пропущено: ${skipped}`
      : `Эти файлы уже добавлены (${skipped})`);
  }
  return added;
}

function wireAttachZone(zone, buttonId, inputId) {
  const button = document.getElementById(buttonId);
  const input = document.getElementById(inputId);
  const dropZone = document.getElementById(zone === "zapros" ? "pfAttachZaprosZone" : "pfAttachMaterialsZone");

  button.addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    addPendingFiles(zone, Array.from(input.files));
    input.value = ""; // чтобы можно было выбрать тот же файл повторно, если удалили и передумали
  });

  // Перетаскивание прямо в зону — файлы и целые папки, сразу несколько.
  // Разбор перетащенного тот же, что и в файловом менеджере.
  let dragCounter = 0;
  dropZone.addEventListener("dragover", (e) => {
    if (!dragHasFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
  });
  dropZone.addEventListener("dragenter", (e) => {
    if (!dragHasFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter++;
    dropZone.classList.add("drag-over");
  });
  dropZone.addEventListener("dragleave", (e) => {
    if (!dragHasFiles(e)) return;
    e.stopPropagation();
    dragCounter = Math.max(0, dragCounter - 1);
    if (dragCounter === 0) dropZone.classList.remove("drag-over");
  });
  dropZone.addEventListener("drop", async (e) => {
    if (!dragHasFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.fmHandled = true;
    dragCounter = 0;
    dropZone.classList.remove("drag-over");
    const items = await extractDroppedItems(e.dataTransfer);
    if (items.length) addPendingFiles(zone, items);
  });
}
wireAttachZone("zapros", "pfAttachZaprosBtn", "pfAttachZapros");
wireAttachZone("materials", "pfAttachMaterialsBtn", "pfAttachMaterials");

/**
 * Загружает выбранные файлы на сервер (обе зоны — в один и тот же
 * черновик) и возвращает {batchId, fileAssignments} для отправки вместе
 * с созданием проекта. Если файлов вообще не было — возвращает null.
 */
async function uploadPendingProjectFiles() {
  const hasFiles = pfPendingFiles.zapros.length || pfPendingFiles.materials.length;
  if (!hasFiles) return null;

  let batchId = null;
  const fileAssignments = [];

  // Сервер принимает ограниченное число файлов за один запрос, а из
  // перетащенной папки их может быть много — отправляем пачками.
  const BATCH_SIZE = 20;

  async function uploadZone(files, category) {
    for (let from = 0; from < files.length; from += BATCH_SIZE) {
      const chunk = files.slice(from, from + BATCH_SIZE);
      const formData = new FormData();
      for (const f of chunk) formData.append("files", f.file);
      const url = batchId ? `/api/cases/stage-files?batchId=${encodeURIComponent(batchId)}` : "/api/cases/stage-files";
      const res = await fetch(url, { method: "POST", credentials: "include", body: formData });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Не удалось загрузить файлы");
      const data = await res.json();
      batchId = data.batchId;
      for (const r of data.results) {
        if (r.key) fileAssignments.push({ key: r.key, category });
        else throw new Error(`Не удалось загрузить файл «${r.filename}»: ${r.error}`);
      }
    }
  }

  await uploadZone(pfPendingFiles.zapros, "запрос");
  await uploadZone(pfPendingFiles.materials, "первичные_материалы");

  return { batchId, fileAssignments };
}

async function openProjectForm() {
  els.projectFormError.textContent = "";
  els.projectForm.reset();
  await loadOrganizationsSelect();
  resetPendingProjectFiles();

  const managerSelect = document.getElementById("pfManager");
  managerSelect.innerHTML = '<option value="">Не выбран</option>';
  try {
    const { users } = await apiFetch("/api/users");
    for (const u of users) {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = u.username;
      managerSelect.appendChild(opt);
    }
  } catch { /* без списка руководителей форма всё равно рабочая */ }

  els.projectFormOverlay.classList.remove("hidden");
}

els.projectFormCloseBtn.addEventListener("click", () => els.projectFormOverlay.classList.add("hidden"));

/* ---- Управление списком организаций ("Структура") ---- */

const orgManageOverlay = document.getElementById("orgManageOverlay");
const orgList = document.getElementById("orgList");
const orgManageError = document.getElementById("orgManageError");

async function renderOrgList() {
  orgManageError.textContent = "";
  orgList.innerHTML = '<div class="row-subtitle">Загрузка…</div>';
  try {
    const orgs = await apiFetch("/api/organizations");
    if (!orgs.length) {
      orgList.innerHTML = '<div class="row-subtitle">Список пока пуст</div>';
      return;
    }
    orgList.innerHTML = orgs.map((o) => `
      <div style="display:flex; align-items:center; gap:8px; padding:6px 8px; background:var(--bg-page); border-radius:6px; font-size:13px;">
        <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(o.name)}</span>
        <button type="button" class="back-btn danger-outline" data-org-delete="${escapeHtml(o.name)}" style="padding:2px 8px; font-size:12px;">Удалить</button>
      </div>`).join("");
    orgList.querySelectorAll("[data-org-delete]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm(`Удалить организацию «${btn.dataset.orgDelete}»?`)) return;
        try {
          await apiFetch(`/api/organizations/${encodeURIComponent(btn.dataset.orgDelete)}`, { method: "DELETE" });
          await renderOrgList();
          await loadOrganizationsSelect();
        } catch (err) {
          orgManageError.textContent = err.message;
        }
      });
    });
  } catch (err) {
    orgList.innerHTML = "";
    orgManageError.textContent = err.message;
  }
}

document.getElementById("pfManageOrgBtn").addEventListener("click", () => {
  orgManageOverlay.classList.remove("hidden");
  renderOrgList();
});
document.getElementById("orgManageCloseBtn").addEventListener("click", () => orgManageOverlay.classList.add("hidden"));

document.getElementById("orgAddForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  orgManageError.textContent = "";
  const input = document.getElementById("orgAddName");
  const name = input.value.trim();
  if (!name) return;
  try {
    await apiFetch("/api/organizations", { method: "POST", body: JSON.stringify({ name }) });
    input.value = "";
    await renderOrgList();
    await loadOrganizationsSelect();
  } catch (err) {
    orgManageError.textContent = err.message;
  }
});

els.projectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.projectFormError.textContent = "";

  const type = document.getElementById("pfType").value;
  const stage = document.getElementById("pfStage").value;
  const rawName = document.getElementById("pfName").value.trim();
  const prefix = type === "expertise" ? "ЭКС." : "НИ.";
  const name = rawName.startsWith(prefix) ? rawName : prefix + rawName;

  const submitBtn = els.projectForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  let uploaded = null;
  try {
    submitBtn.textContent = "Загружаем файлы…";
    uploaded = await uploadPendingProjectFiles();
  } catch (err) {
    els.projectFormError.textContent = "Не удалось загрузить файлы: " + err.message;
    submitBtn.disabled = false;
    submitBtn.textContent = "Создать проект";
    return;
  }
  submitBtn.textContent = "Создать проект";

  const body = {
    type, stage, name,
    direct_assignment: stage === "active",
    court_or_customer: document.getElementById("pfCourt").value.trim() || null,
    case_number: document.getElementById("pfCaseNumber").value.trim() || null,
    manager_id: document.getElementById("pfManager").value || null,
    year: document.getElementById("pfYear").value || null,
    organization: document.getElementById("pfOrganization").value.trim() || null,
    party1: document.getElementById("pfParty1").value.trim() || null,
    party2: document.getElementById("pfParty2").value.trim() || null,
    judge_name: document.getElementById("pfJudgeName").value.trim() || null,
    experts: document.getElementById("pfExperts").value.trim() || null,
    description: document.getElementById("pfDescription").value.trim() || null,
    ...(uploaded ? { batchId: uploaded.batchId, fileAssignments: uploaded.fileAssignments } : {}),
  };

  try {
    await apiFetch("/api/cases", { method: "POST", body: JSON.stringify(body) });
    els.projectFormOverlay.classList.add("hidden");
    resetPendingProjectFiles();
    // Обновляем список: если мы сейчас внутри "Дела" — перерисовываем
    // открытую папку, иначе (на экране колонок) — саму колонку "Дела".
    if (currentPath && currentPath.startsWith(CASES_PATH)) {
      renderFolder(currentPath);
    } else {
      loadColumnList("cases");
    }
  } catch (err) {
    els.projectFormError.textContent = err.message;
    // Файлы уже загружены на сервер (в черновик), а сам проект — нет.
    // Подчищаем черновик, чтобы он не остался висеть без дела.
    if (uploaded?.batchId) {
      apiFetch(`/api/cases/analyze-files/${uploaded.batchId}/discard`, { method: "POST" }).catch(() => {});
    }
  } finally {
    submitBtn.disabled = false;
  }
});

// Переход в колонки. pushHistory=false используется при обработке
// кнопки "назад" браузера, чтобы не создавать новую запись в истории.
function goToColumns(pushHistory) {
  currentTrail = [];
  exitSelectMode(false);
  showColumnsUI();
  loadColumns();
  if (pushHistory) {
    history.pushState({ view: "columns" }, "", PICKER_MODE ? null : "/");
  }
}

// Переход в папку (первое открытие из колонок, клик по подпапке или по хлебной крошке).
// trail передаётся уже обновлённым вызывающей стороной.
function goToFolder(path, trail, pushHistory) {
  currentTrail = trail;
  currentPath = path;
  exitSelectMode(false);
  showFolderUI();
  renderFolder(path);
  if (pushHistory) {
    // Адрес меняется вместе с папкой: ссылку можно скопировать прямо из
    // строки браузера, а F5 оставит человека там же, где он был.
    history.pushState({ view: "folder", path, trail }, "", PICKER_MODE ? null : buildShareUrl(path, true));
  }
}

window.addEventListener("popstate", (e) => {
  const state = e.state;
  if (state && state.view === "section") {
    showSection(state.section, false);
    return;
  }
  showSection("files", false);
  if (!state || state.view === "columns") {
    goToColumns(false);
  } else if (state.view === "folder") {
    goToFolder(state.path, state.trail || [], false);
  }
});

async function renderFolder(path) {
  folderSearching = false;
  folderSearchResults = [];
  if (els.folderSearchInput) els.folderSearchInput.value = "";
  renderBreadcrumbs();
  els.folderList.innerHTML = '<div class="empty-hint">Загрузка…</div>';
  updateCaseBanner(path);
  try {
    const data = await apiFetch(`/api/resources?path=${encodeURIComponent(path)}`);
    currentFolderEntries = [
      ...(data.folders || []).map((f) => ({ ...f, isDir: true })),
      ...(data.files || []).map((f) => ({ ...f, isDir: false })),
    ].map((entry) => ({
      ...entry,
      fullPath: (path.endsWith("/") ? path : path + "/") + entry.name,
    }));
    renderFolderRows();
  } catch (err) {
    currentFolderEntries = [];
    // Сообщение сервера («Нет доступа к этой папке») полезнее общей фразы —
    // особенно когда человек пришёл по ссылке от коллеги.
    const reason = err && err.message && err.message !== "unauthorized"
      ? escapeHtml(err.message)
      : "Не удалось загрузить содержимое";
    els.folderList.innerHTML = `<div class="empty-hint">${reason}</div>`;
  }
}

// Перерисовывает список из уже загруженных данных (currentFolderEntries
// либо, в режиме поиска, folderSearchResults) — без повторного запроса
// к серверу. Используется при переключении режима выбора, отметке
// чекбоксов и смене сортировки.
// Корни стадий внутри "Дела" — именно в них лежат папки проектов, и
// именно там имеет смысл делить список на "Экспертизы" и "Независимые
// исследования", как это сделано в Планфиксе.
const STAGE_ROOT_PATHS = [
  `${CASES_PATH}/01.Планы`,
  `${CASES_PATH}/02.Активные проекты`,
  `${CASES_PATH}/03.Проекты на контроле`,
  `${CASES_PATH}/04.Архив/Завершенные`,
  `${CASES_PATH}/04.Архив/Отмененные`,
];

const PROJECT_GROUPS = [
  { label: "Экспертизы", test: (name) => name.startsWith("ЭКС.") },
  { label: "Независимые исследования", test: (name) => name.startsWith("НИ.") },
  { label: "Прочее", test: () => true },
];

/**
 * Делит содержимое папки стадии на группы по типу проекта. Пустые группы
 * не показываются: если на стадии одни НИ — будет только их заголовок.
 * Возвращает null там, где деление не имеет смысла (обычная папка).
 */
function groupProjectEntries(list, path) {
  if (!STAGE_ROOT_PATHS.includes(path)) return null;
  const dirs = list.filter((e) => e.isDir);
  const rest = list.filter((e) => !e.isDir);
  if (!dirs.length) return null;

  const groups = PROJECT_GROUPS.map((g) => ({ label: g.label, items: [] }));
  for (const entry of dirs) {
    const idx = PROJECT_GROUPS.findIndex((g) => g.test(entry.name));
    groups[idx].items.push(entry);
  }
  const filled = groups.filter((g) => g.items.length);
  // Один-единственный тип, да ещё и "Прочее" — заголовок ничего не
  // добавляет, показываем обычным списком.
  if (filled.length === 1 && filled[0].label === "Прочее") return null;
  if (rest.length) filled.push({ label: "Файлы", items: rest });
  return filled;
}

function renderFolderRows() {
  const source = folderSearching ? folderSearchResults : currentFolderEntries;
  const list = sortEntries(source, els.folderSortSelect.value);
  // Считаем по самому пути, а не по началу "хлебных крошек": в папку можно
  // попасть по ссылке или из карточки проекта, и тогда крошки начинаются не
  // с корня "Дела", а кнопка доступа пропадала.
  const inCasesTree = String(currentPath || "").startsWith(CASES_PATH);
  const canManagePerms = inCasesTree && currentUser && currentUser.role === "admin";
  els.folderList.innerHTML = "";
  if (list.length === 0) {
    els.folderList.innerHTML = `<div class="empty-hint">${
      folderSearching
        ? "Ничего не найдено"
        : "Папка пуста<br>Перетащите файлы или папки прямо сюда"
    }</div>`;
    return;
  }
  const groups = folderSearching ? null : groupProjectEntries(list, currentPath);
  const ordered = groups ? groups.flatMap((g) => [{ groupLabel: g.label }, ...g.items]) : list;

  for (const entry of ordered) {
    if (entry.groupLabel) {
      const head = document.createElement("div");
      head.className = "row-group";
      head.textContent = entry.groupLabel;
      els.folderList.appendChild(head);
      continue;
    }
    const row = document.createElement("div");
    row.className = "file-row" + (entry.isDir ? " is-dir" : "") + (selectMode ? " selectable" : "") + (selectedPaths.has(entry.fullPath) ? " selected" : "");
    const pathHint = folderSearching
      ? `<span class="search-path-hint">${escapeHtml(entry.fullPath)}</span>`
      : "";
    row.innerHTML = `
      ${selectMode ? `<input type="checkbox" class="select-checkbox" ${selectedPaths.has(entry.fullPath) ? "checked" : ""}>` : ""}
      <div class="left">${iconHtml(entry)}<span class="row-name">${escapeHtml(entry.name)}</span>${pathHint}</div>
      <div class="right">
        <span class="size">${entry.isDir ? "" : formatSize(entry.size)}</span>
        ${whenHtml(entry.mtime)}
        ${selectMode || !canManagePerms ? "" : `<button class="perm-btn" title="Доступ" aria-label="Доступ">${svgDots}</button>`}
      </div>
    `;
    row.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showContextMenu(e, entry.fullPath, entry.name, entry.isDir, "folder");
    });
    row.addEventListener("click", (e) => {
      if (selectMode) {
        toggleSelect(entry.fullPath);
        return;
      }
      if (entry.isDir) {
        const trail = buildTrailExtending(currentTrail, currentPath, entry.fullPath);
        goToFolder(entry.fullPath, trail, true);
      } else {
        openFile(entry.fullPath, entry.name);
      }
    });
    if (!selectMode && canManagePerms) {
      row.querySelector('[title="Доступ"]').addEventListener("click", (e) => {
        e.stopPropagation();
        openFolderPermissions(entry.fullPath, entry.name);
      });
    }
    // Бросок точно на строку-папку — загрузка внутрь неё, а не в текущую.
    if (entry.isDir) {
      makeDropTarget(row, () => entry.fullPath, () => renderFolder(currentPath), { stopPropagation: true });
    }
    if (pendingFlashName && entry.name === pendingFlashName) {
      row.classList.add("row-flash");
      row.scrollIntoView({ block: "center" });
      pendingFlashName = "";
    }
    els.folderList.appendChild(row);
  }
}

async function searchFolder(query) {
  if (!query) {
    folderSearching = false;
    folderSearchResults = [];
    renderFolderRows();
    return;
  }
  els.folderList.innerHTML = '<div class="empty-hint">Поиск…</div>';
  try {
    const { results } = await apiFetch(`/api/search?path=${encodeURIComponent(currentPath)}&q=${encodeURIComponent(query)}`);
    folderSearchResults = results.map((r) => ({ ...r, fullPath: r.path }));
    folderSearching = true;
    renderFolderRows();
  } catch (err) {
    els.folderList.innerHTML = '<div class="empty-hint">Ошибка поиска</div>';
  }
}

const debouncedFolderSearch = debounce((q) => searchFolder(q), 300);
els.folderSearchInput.addEventListener("input", (e) => debouncedFolderSearch(e.target.value.trim()));
els.folderSortSelect.addEventListener("change", () => renderFolderRows());

/**
 * Шапка папки состоит из двух строк:
 *   1) путь до текущей папки — только родители, каждый кликабелен;
 *   2) стрелка «на уровень выше» и название текущей папки крупно.
 * Так видно и где ты находишься, и куда вернёшься одним движением.
 */
function renderBreadcrumbs() {
  const parents = currentTrail.slice(0, -1);
  const current = currentTrail[currentTrail.length - 1];

  els.breadcrumbs.innerHTML = "";
  parents.forEach((crumb, i) => {
    const span = document.createElement("span");
    span.className = "crumb";
    span.textContent = crumb.label;
    span.addEventListener("click", () => {
      goToFolder(crumb.path, currentTrail.slice(0, i + 1), true);
    });
    els.breadcrumbs.appendChild(span);

    if (i < parents.length - 1) {
      const sep = document.createElement("span");
      sep.className = "crumb-sep";
      sep.textContent = "›";
      els.breadcrumbs.appendChild(sep);
    }
  });
  els.breadcrumbs.classList.toggle("hidden", parents.length === 0);

  els.folderTitle.textContent = current ? current.label : "";
  els.backBtn.classList.remove("hidden");
}

els.backBtn.addEventListener("click", () => {
  if (currentTrail.length > 1) {
    const parentTrail = currentTrail.slice(0, -1);
    const parent = parentTrail[parentTrail.length - 1];
    goToFolder(parent.path, parentTrail, true);
    return;
  }
  goToColumns(true);
});

// «На главную» — сразу к колонкам, минуя все промежуточные папки.
bind(document.getElementById("folderHomeBtn"), "click", () => goToColumns(true));

// Стрелка «назад» на странице задач: она открывается из колонки «Дела»,
// туда же и возвращает.
bind(document.getElementById("tasksBackBtn"), "click", () => {
  showSection("files", true);
  goToColumns(true);
});

/* ---------- Режим выбора (массовое удаление / скачивание / перемещение) ---------- */

function enterFolderSelectMode() {
  selectMode = true;
  selectedPaths = new Set();
  els.folderActions.classList.add("hidden");
  els.selectionBar.classList.remove("hidden");
  // В "Дела" перемещение вручную отключено — папки переезжают сами при
  // смене стадии проекта. Кнопку показываем только для "База данных".
  const inCases = currentTrail[0] && currentTrail[0].path === CASES_PATH;
  els.moveSelectedBtn.classList.toggle("hidden", inCases);
  updateSelectionBar();
  renderFolderRows();
}

els.cancelSelectBtn.addEventListener("click", () => {
  exitSelectMode(true);
});

function exitSelectMode(rerender) {
  const wasSelecting = selectMode;
  selectMode = false;
  selectedPaths = new Set();
  els.selectionBar.classList.add("hidden");
  els.folderActions.classList.remove("hidden");
  if (rerender && wasSelecting) renderFolderRows();
}

function toggleSelect(fullPath) {
  if (selectedPaths.has(fullPath)) {
    selectedPaths.delete(fullPath);
  } else {
    selectedPaths.add(fullPath);
  }
  updateSelectionBar();
  renderFolderRows();
}

function updateSelectionBar() {
  els.selectionCount.textContent = `Выбрано: ${selectedPaths.size}`;
}

els.deleteSelectedBtn.addEventListener("click", async () => {
  if (selectedPaths.size === 0) return;
  if (!confirm(`Удалить выбранное (${selectedPaths.size})? Всё уедет в корзину.`)) return;
  const paths = [...selectedPaths];
  try {
    const results = await Promise.allSettled(
      paths.map((p) => apiFetch(`/api/resources?path=${encodeURIComponent(p)}`, { method: "DELETE" }))
    );
    const failed = results.filter((r) => r.status === "rejected");
    exitSelectMode(false);
    await renderFolder(currentPath);
    refreshTrashBadge();
    if (failed.length > 0) {
      alert(`Не удалось удалить ${failed.length} из ${paths.length} элементов`);
    }
  } catch (err) {
    alert("Не удалось удалить выбранное: " + err.message);
  }
});

els.downloadSelectedBtn.addEventListener("click", () => {
  if (selectedPaths.size === 0) return;
  const source = folderSearching ? folderSearchResults : currentFolderEntries;
  const items = [...selectedPaths].map((p) => {
    const found = source.find((e) => e.fullPath === p);
    return { path: p, isDir: found ? found.isDir : false };
  });
  requestDownload(items);
});

/**
 * Удалили папку проекта — он перестаёт предлагаться в выборе (ГП и
 * прочее). Это важное следствие, поэтому говорим о нём вслух, а не
 * оставляем человека гадать, куда делся проект из списка.
 */
function reportClosedCases(res) {
  const closed = (res && res.closedCases) || [];
  if (!closed.length) return;
  showToast(closed.length === 1
    ? `Проект «${closed[0]}» больше не предлагается в выборе`
    : `Проектов убрано из выбора: ${closed.length}`);
}

/* ---------- Контекстное меню (правый клик по файлу/папке) ---------- */

let ctxMenuTarget = null; // { path, name, isDir, context }
const ctxMenuEl = document.getElementById("itemContextMenu");

function showContextMenu(event, path, name, isDir, context) {
  ctxMenuTarget = { path, name, isDir, context };

  // В "Дела" перемещение вручную отключено — папки переезжают сами при
  // смене стадии проекта. Пункт меню показываем только вне "Дела".
  const inCases = context === "cases" || path.startsWith(CASES_PATH);
  ctxMenuEl.querySelector('[data-ctx-action="move"]').classList.toggle("hidden", inCases);

  // Настройка персонального доступа есть только внутри "Дела" и только у
  // администратора. Раньше это была лишь кнопка "…", появлявшаяся при
  // наведении, — её было легко не найти.
  const canManagePerms = inCases && currentUser && currentUser.role === "admin";
  ctxMenuEl.querySelector('[data-ctx-action="perms"]').classList.toggle("hidden", !canManagePerms);

  const menuWidth = 210, menuHeight = 310; // с запасом, чтобы не вылезало за край экрана
  const x = Math.min(event.clientX, window.innerWidth - menuWidth - 8);
  const y = Math.min(event.clientY, window.innerHeight - menuHeight - 8);
  ctxMenuEl.style.left = `${Math.max(8, x)}px`;
  ctxMenuEl.style.top = `${Math.max(8, y)}px`;
  ctxMenuEl.classList.remove("hidden");
}

function hideContextMenu() {
  ctxMenuEl.classList.add("hidden");
  ctxMenuTarget = null;
}

document.addEventListener("click", hideContextMenu);
document.addEventListener("contextmenu", (e) => {
  if (!ctxMenuEl.contains(e.target)) hideContextMenu();
});

/** Обновляет список после действия — учитывает, что мы сейчас смотрим (колонка/папка) и поиск ли активен. */
function refreshContext(context) {
  if (context === "db" || context === "cases") {
    const state = columnState[context];
    if (state.searching) searchColumn(context, colRefs(context).searchInput.value.trim());
    else loadColumnList(context);
  } else {
    if (folderSearching) searchFolder(els.folderSearchInput.value.trim());
    else renderFolder(currentPath);
  }
}

/** "Выбрать" из контекстного меню — включает нужный режим выбора (их три разных) и сразу отмечает объект. */
function enterSelectModeFor(context, fullPath) {
  if (context === "db" || context === "cases") {
    if (!columnSelectState[context].active) enterColumnSelectMode(context);
    toggleColumnSelect(context, fullPath);
  } else {
    if (!selectMode) enterFolderSelectMode();
    toggleSelect(fullPath);
  }
}

async function copyItemInPlace(sourcePath, context) {
  const parent = sourcePath.slice(0, sourcePath.lastIndexOf("/")) || "/";
  try {
    await apiFetch("/api/copy", { method: "POST", body: JSON.stringify({ path: sourcePath, destination: parent }) });
    refreshContext(context);
  } catch (err) {
    alert("Не удалось скопировать: " + err.message);
  }
}

ctxMenuEl.querySelectorAll("[data-ctx-action]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const target = ctxMenuTarget;
    hideContextMenu();
    if (!target) return;
    const action = btn.dataset.ctxAction;

    if (action === "select") {
      enterSelectModeFor(target.context, target.path);
    } else if (action === "download") {
      requestDownload([{ path: target.path, isDir: target.isDir }]);
    } else if (action === "rename") {
      promptRename(target.path, target.name, () => refreshContext(target.context), target.isDir);
    } else if (action === "move") {
      openMoveModal([{ path: target.path, isDir: target.isDir }], () => refreshContext(target.context));
    } else if (action === "copy") {
      await copyItemInPlace(target.path, target.context);
    } else if (action === "share") {
      await shareLinkFor(target.path, target.isDir);
    } else if (action === "perms") {
      openFolderPermissions(target.path, target.name);
    } else if (action === "delete") {
      if (!confirm(`Удалить «${target.name}»? Объект уедет в корзину.`)) return;
      try {
        const res = await apiFetch(`/api/resources?path=${encodeURIComponent(target.path)}`, { method: "DELETE" });
        refreshContext(target.context);
        refreshTrashBadge();
        reportClosedCases(res);
      } catch (err) {
        alert("Не удалось удалить: " + err.message);
      }
    }
  });
});

/* ---------- Окно "Куда переместить" ---------- */

let moveState = null;

function rootForPath(fullPath) {
  return fullPath.startsWith(CASES_PATH) ? { path: CASES_PATH, label: "Дела" } : { path: DB_PATH, label: "База данных" };
}

async function openMoveModal(items, onDone) {
  if (!items.length) return;
  const root = rootForPath(items[0].path);
  moveState = { items, root, currentPath: root.path, onDone };
  document.getElementById("moveError").textContent = "";
  document.getElementById("moveOverlay").classList.remove("hidden");
  await loadMoveFolder(root.path);
}

async function loadMoveFolder(targetPath) {
  moveState.currentPath = targetPath;
  renderMoveBreadcrumbs();
  const list = document.getElementById("moveFolderList");
  list.innerHTML = '<div class="empty-hint">Загрузка…</div>';
  try {
    const data = await apiFetch(`/api/resources?path=${encodeURIComponent(targetPath)}`);
    const folders = (data.folders || []).map((f) => ({ name: f.name, fullPath: joinPath(targetPath, f.name) }));

    // Папку(и), которую(ые) перемещаем, и всё, что внутри них, — делаем
    // недоступными для захода/выбора: нельзя переместить папку саму в себя.
    const movingPaths = moveState.items.filter((it) => it.isDir).map((it) => it.path);
    const isBlocked = (p) => movingPaths.some((mp) => p === mp || p.startsWith(mp + "/"));

    if (!folders.length) {
      list.innerHTML = '<div class="empty-hint">Здесь нет вложенных папок</div>';
    } else {
      list.innerHTML = folders.map((f) => {
        const disabled = isBlocked(f.fullPath);
        return `<div class="move-folder-row${disabled ? " disabled" : ""}" data-move-path="${escapeHtml(f.fullPath)}">
          ${svgFolder} <span>${escapeHtml(f.name)}</span>
        </div>`;
      }).join("");
      list.querySelectorAll(".move-folder-row:not(.disabled)").forEach((row) => {
        row.addEventListener("click", () => loadMoveFolder(row.dataset.movePath));
      });
    }
  } catch (err) {
    list.innerHTML = `<div class="empty-hint">Не удалось загрузить: ${escapeHtml(err.message)}</div>`;
  }
}

function renderMoveBreadcrumbs() {
  const rel = moveState.currentPath.slice(moveState.root.path.length);
  const parts = rel.split("/").filter(Boolean);
  const crumbs = [{ label: moveState.root.label, path: moveState.root.path }];
  let acc = moveState.root.path;
  for (const part of parts) {
    acc = acc + "/" + part;
    crumbs.push({ label: part, path: acc });
  }
  document.getElementById("moveBreadcrumbs").innerHTML = crumbs
    .map((c, i) => `<span data-move-crumb="${escapeHtml(c.path)}" style="cursor:pointer; ${i === crumbs.length - 1 ? "font-weight:600;" : "color:var(--accent);"}">${escapeHtml(c.label)}</span>`)
    .join(' <span style="color:var(--text-muted);">/</span> ');
  document.querySelectorAll("[data-move-crumb]").forEach((el) => {
    el.addEventListener("click", () => loadMoveFolder(el.dataset.moveCrumb));
  });
}

document.getElementById("moveCloseBtn").addEventListener("click", () => {
  document.getElementById("moveOverlay").classList.add("hidden");
  moveState = null;
});

document.getElementById("moveNewFolderBtn").addEventListener("click", async () => {
  const name = prompt("Название новой папки:");
  if (!name || !name.trim()) return;
  try {
    await apiFetch("/api/folder", { method: "POST", body: JSON.stringify({ path: joinPath(moveState.currentPath, name.trim()) }) });
    await loadMoveFolder(moveState.currentPath);
  } catch (err) {
    document.getElementById("moveError").textContent = err.message;
  }
});

document.getElementById("moveConfirmBtn").addEventListener("click", async () => {
  const btn = document.getElementById("moveConfirmBtn");
  btn.disabled = true;
  document.getElementById("moveError").textContent = "";
  try {
    for (const item of moveState.items) {
      await apiFetch("/api/move", { method: "POST", body: JSON.stringify({ path: item.path, destination: moveState.currentPath }) });
    }
    document.getElementById("moveOverlay").classList.add("hidden");
    const onDone = moveState.onDone;
    moveState = null;
    if (onDone) onDone();
  } catch (err) {
    document.getElementById("moveError").textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

/** Перемещение сразу нескольких отмеченных объектов — из панели массовых действий. */
function moveColumnSelected(key) {
  const st = columnSelectState[key];
  if (st.selected.size === 0) return;
  const state = columnState[key];
  const items = [...st.selected].map((p) => {
    const found = state.entries.find((e) => e.fullPath === p);
    return { path: p, isDir: found ? found.isDir : false };
  });
  openMoveModal(items, () => {
    exitColumnSelectMode(key);
    loadColumnList(key);
  });
}

els.dbMoveSelectedBtn.addEventListener("click", () => moveColumnSelected("db"));

els.moveSelectedBtn.addEventListener("click", () => {
  if (selectedPaths.size === 0) return;
  const source = folderSearching ? folderSearchResults : currentFolderEntries;
  const items = [...selectedPaths].map((p) => {
    const found = source.find((e) => e.fullPath === p);
    return { path: p, isDir: found ? found.isDir : false };
  });
  openMoveModal(items, () => {
    exitSelectMode(false);
    renderFolder(currentPath);
  });
});

/* ---------- Upload (с наглядным прогрессом) ---------- */

const svgCheck = `<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2.5"><path d="M20 6 9 17l-5-5"/></svg>`;
const svgError = `<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2.5"><path d="M12 8v5M12 16h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>`;

let activeUploadItems = [];

// Страховка на уровне всей страницы: без этого браузер по умолчанию
// открывает/скачивает перетащенный файл сам, если отпустить его мимо
// всех зон загрузки.
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", async (e) => {
  e.preventDefault();
  // Событие уже обработала конкретная зона (колонка, папка, строка-папка) —
  // второй раз грузить не нужно.
  if (e.fmHandled) return;
  if (!dragHasFiles(e)) return;
  // Отпустили где-то мимо зон (пустое место страницы, шапка, полоса
  // прокрутки). Если открыта папка — грузим в неё, это почти всегда то,
  // что человек и имел в виду. На экране с колонками цели нет: там надо
  // бросать в саму колонку, она для этого подсвечивается.
  if (els.folderView.classList.contains("hidden")) return;
  const items = await extractDroppedItems(e.dataTransfer);
  if (!items.length) return;
  document.getElementById("uploadModalOverlay").classList.add("hidden");
  uploadFiles(items, currentPath, () => renderFolder(currentPath));
});

// Скачать целиком папку, в которой находимся, — тем же путём, что и
// скачивание выбранных объектов: архивом или, если браузер умеет, в
// выбранную папку на диске с сохранением структуры.
els.downloadFolderBtn.addEventListener("click", () => {
  if (!currentPath) return;
  requestDownload([{ path: currentPath, isDir: true }]);
});

els.uploadTriggerBtn.addEventListener("click", () => {
  uploadTarget = null;
  document.getElementById("uploadModalOverlay").classList.remove("hidden");
});

document.getElementById("uploadModalCloseBtn").addEventListener("click", () => {
  document.getElementById("uploadModalOverlay").classList.add("hidden");
});

els.chooseFilesBtn.addEventListener("click", () => {
  els.uploadInput.click();
});

els.chooseFolderBtn.addEventListener("click", () => {
  els.uploadFolderInput.click();
});

els.uploadInput.addEventListener("change", () => {
  const files = Array.from(els.uploadInput.files || []);
  els.uploadInput.value = "";
  document.getElementById("uploadModalOverlay").classList.add("hidden");
  const target = uploadTarget;
  uploadTarget = null;
  if (files.length === 0) return;
  if (target) uploadFiles(files, target.path, target.refresh);
  else uploadFiles(files, currentPath, () => renderFolder(currentPath));
});

els.uploadFolderInput.addEventListener("change", () => {
  const files = Array.from(els.uploadFolderInput.files || []);
  els.uploadFolderInput.value = "";
  document.getElementById("uploadModalOverlay").classList.add("hidden");
  if (files.length > 0) uploadFiles(files, currentPath, () => renderFolder(currentPath));
});

els.uploadPanelCloseBtn.addEventListener("click", () => {
  els.uploadPanel.classList.add("hidden");
});

// Зона в окне "Загрузить" — как и раньше.
makeDropTarget(
  document.getElementById("uploadDropzone"),
  () => currentPath,
  () => {
    document.getElementById("uploadModalOverlay").classList.add("hidden");
    renderFolder(currentPath);
  }
);

// Перетаскивание прямо в интерфейс, без открытия окна "Загрузить":
//  - бросок в открытую папку грузит в неё;
//  - бросок в колонку "База данных"/"Дела" грузит в корень этой колонки;
//  - бросок точно на строку-папку грузит внутрь этой папки
//    (см. makeDropTarget с stopPropagation в renderFolderRows/renderColumnList).
makeDropTarget(els.folderView, () => currentPath, () => renderFolder(currentPath));

for (const key of ["db", "cases"]) {
  const column = document.querySelector(`.col[data-col="${key}"]`);
  if (column) {
    makeDropTarget(column, () => columnState[key].rootPath, () => loadColumnList(key));
  }
}

/**
 * items — либо обычный File[] (тогда relativePath берётся из
 * встроенного file.webkitRelativePath, если он есть — так работает выбор
 * папки через диалог), либо уже готовые {file, relativePath} — так
 * приходят файлы из перетаскивания, где relativePath собран вручную.
 * targetPath — куда грузим; onDone — что обновить после завершения
 * (разное для колонок и для открытой папки).
 */
function uploadFiles(items, targetPath, onDone) {
  const normalized = items.map((it) =>
    it instanceof File ? { file: it, relativePath: it.webkitRelativePath || "" } : it
  );

  activeUploadItems = normalized.map((it, i) => ({
    id: `${Date.now()}_${i}`,
    file: it.file,
    relativePath: it.relativePath,
    name: it.relativePath || it.file.name,
    loaded: 0,
    total: it.file.size || 0,
    progress: 0,
    status: "queued", // queued | uploading | done | error
    error: "",
    els: null, // ссылки на уже созданные узлы строки — чтобы не пересоздавать её
  }));

  els.uploadPanel.classList.remove("hidden");
  buildUploadPanel();
  runUploadQueue(targetPath, onDone);
}

// Грузим не все файлы разом: браузер всё равно держит ограниченное число
// соединений, а прогресс при сотне параллельных запросов скачет и врёт.
const MAX_PARALLEL_UPLOADS = 3;

function runUploadQueue(targetPath, onDone) {
  const queue = activeUploadItems.slice();
  let nextIndex = 0;
  let running = 0;
  let finished = 0;
  const total = queue.length;

  function pump() {
    while (running < MAX_PARALLEL_UPLOADS && nextIndex < total) {
      startUpload(queue[nextIndex++]);
    }
  }

  function startUpload(item) {
    running++;
    item.status = "uploading";
    scheduleUploadPanelUpdate();

    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", item.file);
    form.append("path", targetPath);
    // Если файл пришёл как часть папки — сохраняем структуру подпапок на сервере.
    if (item.relativePath) {
      form.append("relativePath", item.relativePath);
    }

    xhr.upload.addEventListener("progress", (e) => {
      if (!e.lengthComputable) return;
      item.loaded = e.loaded;
      item.total = e.total;
      item.progress = Math.round((e.loaded / e.total) * 100);
      scheduleUploadPanelUpdate();
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        item.status = "done";
        item.progress = 100;
        item.loaded = item.total;
      } else {
        item.status = "error";
        try {
          item.error = JSON.parse(xhr.responseText).message || "Ошибка загрузки";
        } catch (e) {
          item.error = "HTTP " + xhr.status;
        }
      }
      settle();
    });

    xhr.addEventListener("error", () => {
      item.status = "error";
      item.error = "Ошибка сети";
      settle();
    });

    xhr.open("POST", "/api/upload");
    xhr.withCredentials = true;
    xhr.send(form);

    function settle() {
      running--;
      finished++;
      scheduleUploadPanelUpdate();
      if (finished === total) {
        if (onDone) onDone();
        if (!activeUploadItems.some((i) => i.status === "error")) {
          setTimeout(() => {
            els.uploadPanel.classList.add("hidden");
          }, 1800);
        }
      } else {
        pump();
      }
    }
  }

  pump();
}

/* ---- Панель прогресса загрузки ---- */

// Строки списка создаются ОДИН раз на всю загрузку, дальше меняются
// только цифры и ширина полоски. Раньше список перерисовывался целиком
// на каждое событие прогресса — из-за этого заново проигрывалась
// анимация появления строк и панель мигала.
function buildUploadPanel() {
  els.uploadPanelList.innerHTML = "";
  const fragment = document.createDocumentFragment();

  for (const item of activeUploadItems) {
    const row = document.createElement("div");
    row.className = "upload-item";
    row.innerHTML = `
      <div class="upload-item-top">
        <span class="upload-item-name"></span>
        <span class="upload-item-status"></span>
      </div>
      <div class="upload-progress-track">
        <div class="upload-progress-fill"></div>
      </div>
      <div class="upload-item-error hidden"></div>
    `;
    const nameEl = row.querySelector(".upload-item-name");
    nameEl.textContent = item.name;
    nameEl.title = item.name;
    item.els = {
      row,
      status: row.querySelector(".upload-item-status"),
      fill: row.querySelector(".upload-progress-fill"),
      error: row.querySelector(".upload-item-error"),
      lastStatusHtml: "",
      lastWidth: "",
      lastFillClass: "",
    };
    fragment.appendChild(row);
  }

  els.uploadPanelList.appendChild(fragment);
  // Много файлов — список внутри панели прокручивается сам,
  // а не растягивает панель на пол-экрана.
  els.uploadPanelList.classList.toggle("scrollable", activeUploadItems.length > 5);
  updateUploadPanel();
}

let uploadPanelFrame = null;

// События прогресса приходят десятками в секунду; перерисовываем не чаще
// одного раза на кадр — иначе браузер захлёбывается и картинка дёргается.
function scheduleUploadPanelUpdate() {
  if (uploadPanelFrame !== null) return;
  uploadPanelFrame = requestAnimationFrame(() => {
    uploadPanelFrame = null;
    updateUploadPanel();
  });
}

function updateUploadPanel() {
  const total = activeUploadItems.length;
  const doneCount = activeUploadItems.filter((i) => i.status === "done").length;
  const errorCount = activeUploadItems.filter((i) => i.status === "error").length;
  const settled = doneCount + errorCount;

  // Общий процент считаем по байтам, а не по числу файлов: иначе на
  // одном большом файле полоска стоит на месте, а потом прыгает на 100%.
  const totalBytes = activeUploadItems.reduce((sum, i) => sum + (i.total || 0), 0);
  const loadedBytes = activeUploadItems.reduce(
    (sum, i) => sum + (i.status === "done" ? i.total || 0 : i.loaded || 0),
    0
  );
  const overall = totalBytes > 0 ? Math.round((loadedBytes / totalBytes) * 100) : (settled / total) * 100;

  let title;
  if (settled < total) {
    title = total === 1
      ? `Загрузка файла — ${Math.round(overall)}%`
      : `Загрузка: ${doneCount} из ${total} · ${Math.round(overall)}%`;
  } else if (errorCount === 0) {
    title = total === 1 ? "Файл загружен" : `Загружено файлов: ${total}`;
  } else {
    title = `Готово, с ошибками: ${errorCount} из ${total}`;
  }
  setText(els.uploadPanelTitle, title);

  if (els.uploadPanelTotalFill) {
    const width = `${settled === total && errorCount === 0 ? 100 : Math.round(overall)}%`;
    if (els.uploadPanelTotalFill.dataset.pct !== width) {
      els.uploadPanelTotalFill.dataset.pct = width;
      els.uploadPanelTotalFill.style.transform = `scaleX(${parseFloat(width) / 100})`;
    }
    els.uploadPanelTotalFill.classList.toggle("has-error", errorCount > 0 && settled === total);
    // Общая полоска не нужна, когда файл всего один — у него своя.
    els.uploadPanelTotal.classList.toggle("hidden", total < 2);
  }

  for (const item of activeUploadItems) {
    if (!item.els) continue;
    const { els: nodes } = item;

    const statusHtml =
      item.status === "done" ? `<span class="status-done">${svgCheck}</span>`
      : item.status === "error" ? `<span class="status-error">${svgError}</span>`
      : item.status === "queued" ? "в очереди"
      // Байты ушли, но сервер ещё не ответил — честнее написать
      // "сохранение", чем держать 100% и ждать.
      : item.progress >= 100 ? "сохранение"
      : `${item.progress}%`;
    if (statusHtml !== nodes.lastStatusHtml) {
      nodes.status.innerHTML = statusHtml;
      nodes.lastStatusHtml = statusHtml;
    }

    const width = `${item.status === "error" ? 100 : item.progress}%`;
    if (width !== nodes.lastWidth) {
      nodes.fill.style.transform = `scaleX(${parseFloat(width) / 100})`;
      nodes.lastWidth = width;
    }
    const fillClass = `upload-progress-fill ${item.status}`;
    if (fillClass !== nodes.lastFillClass) {
      nodes.fill.className = fillClass;
      nodes.lastFillClass = fillClass;
    }

    if (item.status === "error") {
      if (nodes.error.textContent !== item.error) nodes.error.textContent = item.error;
      nodes.error.classList.remove("hidden");
    } else if (!nodes.error.classList.contains("hidden")) {
      nodes.error.classList.add("hidden");
    }
  }
}

function setText(el, text) {
  if (el && el.textContent !== text) el.textContent = text;
}

/* ---- Перетаскивание файлов/папок из проводника компьютера ---- */

/** Читает ВСЕ записи в папке — readEntries() может отдавать частями, поэтому вызываем, пока не пусто. */
function readAllDirectoryEntries(dirEntry) {
  const reader = dirEntry.createReader();
  return new Promise((resolve, reject) => {
    let all = [];
    function readBatch() {
      reader.readEntries((batch) => {
        if (!batch.length) { resolve(all); return; }
        all = all.concat(batch);
        readBatch();
      }, reject);
    }
    readBatch();
  });
}

/**
 * Рекурсивно разбирает одну "запись" (файл или папку) из перетаскивания.
 * parentPath === null означает "самый верхний уровень, без обёртки папкой"
 * — так файл, брошенный сам по себе (не внутри папки), грузится как
 * обычно, без relativePath. Если же это была папка (или файл внутри
 * папки) — relativePath строится вручную, начиная с имени этой папки.
 */
async function readEntryRecursively(entry, parentPath) {
  const fullRelPath = parentPath !== null ? `${parentPath}/${entry.name}` : entry.name;

  if (entry.isFile) {
    const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
    return [{ file, relativePath: parentPath === null ? "" : fullRelPath }];
  }
  if (entry.isDirectory) {
    const children = await readAllDirectoryEntries(entry);
    const nested = await Promise.all(children.map((child) => readEntryRecursively(child, fullRelPath)));
    return nested.flat();
  }
  return [];
}

/** Достаёт файлы (с сохранением структуры папок) из события drop. */
async function extractDroppedItems(dataTransfer) {
  const entries = [];
  for (const item of dataTransfer.items) {
    if (item.kind !== "file") continue;
    const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
    if (entry) {
      entries.push(entry);
    } else {
      const file = item.getAsFile();
      if (file) entries.push({ isFile: true, isDirectory: false, name: file.name, file: (cb) => cb(file) });
    }
  }
  const results = await Promise.all(entries.map((entry) => readEntryRecursively(entry, null)));
  return results.flat();
}

/**
 * Вешает обработку перетаскивания на элемент. getTargetPath() вызывается
 * в момент drop (не заранее) — так цель всегда актуальна, даже если
 * список успел перерисоваться. stopPropagation нужен для строк-папок:
 * иначе событие всплывёт и сработает ещё и обработчик всей области.
 */
function makeDropTarget(element, getTargetPath, onDone, options = {}) {
  let dragCounter = 0; // dragenter/dragleave у вложенных элементов иначе мигает подсветкой
  element.addEventListener("dragover", (e) => {
    if (!dragHasFiles(e)) return;
    e.preventDefault();
    if (options.stopPropagation) e.stopPropagation();
  });
  element.addEventListener("dragenter", (e) => {
    if (!dragHasFiles(e)) return;
    e.preventDefault();
    if (options.stopPropagation) e.stopPropagation();
    dragCounter++;
    element.classList.add("drag-over");
  });
  element.addEventListener("dragleave", (e) => {
    if (!dragHasFiles(e)) return;
    if (options.stopPropagation) e.stopPropagation();
    dragCounter = Math.max(0, dragCounter - 1);
    if (dragCounter === 0) element.classList.remove("drag-over");
  });
  element.addEventListener("drop", async (e) => {
    if (!dragHasFiles(e)) return;
    e.preventDefault();
    if (options.stopPropagation) e.stopPropagation();
    // Метка для обработчика на window: эту цель уже отработали.
    e.fmHandled = true;
    dragCounter = 0;
    element.classList.remove("drag-over");
    const items = await extractDroppedItems(e.dataTransfer);
    if (items.length) uploadFiles(items, getTargetPath(), onDone);
  });
}

/**
 * Перетаскивают ли именно файлы/папки с компьютера. Без этой проверки
 * подсветка зоны загорается и от перетаскивания выделенного текста или
 * элементов самой страницы, а drop по ним ничего бы не загрузил.
 */
function dragHasFiles(e) {
  const types = e.dataTransfer && e.dataTransfer.types;
  if (!types) return false;
  return Array.from(types).includes("Files");
}

/* ---------- Open file (PDF / OnlyOffice в новой вкладке, остальное — скачивание) ---------- */

function openFile(relPath, fileName) {
  if (PICKER_MODE) {
    if (window.opener && PICKER_ORIGIN) {
      window.opener.postMessage(
        { type: "filemanager:file-selected", path: relPath, name: fileName },
        PICKER_ORIGIN
      );
    }
    window.close();
    return;
  }
  const ext = extOf(fileName);
  if (ext === "pdf" || IMAGE_EXTS.has(ext)) {
    window.open(`/api/view?path=${encodeURIComponent(relPath)}`, "_blank");
    return;
  }
  if (OFFICE_EXTS.has(ext)) {
    window.open(`/office.html?path=${encodeURIComponent(relPath)}`, "_blank");
    return;
  }
  window.location.href = `/api/download?path=${encodeURIComponent(relPath)}`;
}

async function promptRename(fullPath, currentName, onDone, isDir) {
  // Для файлов не даём трогать расширение — показываем в поле только имя без
  // него, а при сохранении дописываем обратно. Для папок (нет расширения)
  // ничего не отрезаем.
  let baseName = currentName;
  let ext = "";
  if (!isDir) {
    const dotIndex = currentName.lastIndexOf(".");
    if (dotIndex > 0) {
      baseName = currentName.slice(0, dotIndex);
      ext = currentName.slice(dotIndex);
    }
  }

  const newBaseName = prompt("Новое имя:", baseName);
  if (!newBaseName || newBaseName === baseName) return;
  const newName = newBaseName + ext;

  try {
    await apiFetch("/api/rename", {
      method: "POST",
      body: JSON.stringify({ path: fullPath, newName }),
    });
    onDone();
  } catch (err) {
    alert("Не удалось переименовать: " + err.message);
  }
}

function downloadFile(relPath) {
  window.location.href = `/api/download?path=${encodeURIComponent(relPath)}`;
}

/* ---------- Скачивание: выбор ZIP / обычная папка ---------- */

function supportsDirectoryPicker() {
  return typeof window.showDirectoryPicker === "function";
}

let pendingDownloadItems = [];

// items: [{ path, isDir }]. Один файл — скачиваем сразу, без вопросов.
// Иначе (папка и/или несколько элементов) — спрашиваем, как скачать.
function requestDownload(items) {
  if (!items || items.length === 0) return;
  if (items.length === 1 && !items[0].isDir) {
    downloadFile(items[0].path);
    return;
  }
  pendingDownloadItems = items;
  const supported = supportsDirectoryPicker();
  els.downloadAsFolderBtn.classList.toggle("hidden", !supported);
  els.downloadFolderHint.classList.toggle("hidden", supported);
  els.downloadChoiceOverlay.classList.remove("hidden");
}

els.downloadChoiceCloseBtn.addEventListener("click", () => {
  els.downloadChoiceOverlay.classList.add("hidden");
});

els.downloadAsZipBtn.addEventListener("click", async () => {
  els.downloadChoiceOverlay.classList.add("hidden");
  await performZipDownload(pendingDownloadItems.map((i) => i.path));
});

els.downloadAsFolderBtn.addEventListener("click", async () => {
  els.downloadChoiceOverlay.classList.add("hidden");
  await performFolderDownload(pendingDownloadItems);
});

/**
 * Скачивание архива в два шага.
 *   1) Обычный запрос «а можно?» — если прав нет, показываем сообщение
 *      сервера, а не оставляем человека без объяснений.
 *   2) Сам архив качаем отправкой формы в невидимый iframe: тогда имя
 *      файла задаёт сервер заголовком Content-Disposition и кириллица
 *      в названии сохраняется. Через fetch + blob имя берётся из
 *      атрибута download, а из него браузер русские буквы выбрасывает —
 *      архив сохранялся как безымянный "download".
 */
async function performZipDownload(paths) {
  try {
    await apiFetch("/api/download-zip", {
      method: "POST",
      body: JSON.stringify({ paths, dryRun: true }),
    });
  } catch (err) {
    if (err.message !== "unauthorized") alert("Не удалось скачать: " + err.message);
    return;
  }
  submitZipDownloadForm(paths);
}

function submitZipDownloadForm(paths) {
  const frameId = "zipDownloadFrame";
  let frame = document.getElementById(frameId);
  if (!frame) {
    frame = document.createElement("iframe");
    frame.id = frameId;
    frame.name = frameId;
    frame.style.display = "none";
    document.body.appendChild(frame);
  }

  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/api/download-zip";
  form.target = frameId;
  form.style.display = "none";

  const field = document.createElement("input");
  field.type = "hidden";
  field.name = "paths";
  field.value = JSON.stringify(paths);
  form.appendChild(field);

  document.body.appendChild(form);
  form.submit();
  setTimeout(() => form.remove(), 1000);
}

async function performFolderDownload(items) {
  if (!supportsDirectoryPicker()) {
    alert("Ваш браузер не поддерживает сохранение папки напрямую. Используйте «Скачать как ZIP».");
    return;
  }
  let rootHandle;
  try {
    rootHandle = await window.showDirectoryPicker();
  } catch (err) {
    return; // пользователь отменил выбор папки на компьютере
  }
  try {
    for (const item of items) {
      if (item.isDir) {
        const { tree } = await apiFetch(`/api/tree?path=${encodeURIComponent(item.path)}`);
        await writeTreeToHandle(tree, rootHandle, item.path);
      } else {
        await writeFileToHandle(item.path, rootHandle);
      }
    }
    alert("Готово! Файлы сохранены в выбранную папку.");
  } catch (err) {
    alert("Не удалось сохранить: " + err.message);
  }
}

async function writeTreeToHandle(node, parentHandle, currentPath) {
  if (node.isDir) {
    const dirHandle = await parentHandle.getDirectoryHandle(node.name, { create: true });
    for (const child of node.children || []) {
      await writeTreeToHandle(child, dirHandle, joinPath(currentPath, child.name));
    }
  } else {
    const fileHandle = await parentHandle.getFileHandle(node.name, { create: true });
    const writable = await fileHandle.createWritable();
    const res = await fetch(`/api/download?path=${encodeURIComponent(currentPath)}`, { credentials: "same-origin" });
    if (!res.ok) throw new Error(`Не удалось скачать ${node.name}`);
    const blob = await res.blob();
    await writable.write(blob);
    await writable.close();
  }
}

async function writeFileToHandle(relPath, parentHandle) {
  const name = relPath.split("/").filter(Boolean).pop();
  const fileHandle = await parentHandle.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  const res = await fetch(`/api/download?path=${encodeURIComponent(relPath)}`, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Не удалось скачать ${name}`);
  const blob = await res.blob();
  await writable.write(blob);
  await writable.close();
}

/* ---------- Init ---------- */

/** Виджет места на диске в боковой панели — грузится один раз при входе. */
/**
 * "10/70ГБ" — свободно/всего одной строкой. Единица измерения общая для
 * обоих чисел (берётся по общему объёму — он всегда больше), чтобы не
 * получилось так, что одно число тихо оказалось в терабайтах, а другое в
 * гигабайтах и запутало.
 */
function formatFreeOfTotal(freeBytes, totalBytes) {
  const freeGb = freeBytes / 1024 ** 3;
  const totalGb = totalBytes / 1024 ** 3;

  if (totalGb >= 1000) {
    return `${(freeGb / 1024).toFixed(1)}/${(totalGb / 1024).toFixed(1)}ТБ`;
  }
  const fmt = (v) => (v >= 10 ? String(Math.round(v)) : v.toFixed(1));
  return `${fmt(freeGb)}/${fmt(totalGb)}ГБ`;
}

async function loadDiskUsage() {
  try {
    const data = await apiFetch("/api/disk-usage");
    const gb = (bytes) => (bytes / 1024 ** 3).toFixed(1);
    const fill = document.getElementById("diskUsageFill");
    const freeEl = document.getElementById("diskUsageFree");
    const widget = document.getElementById("diskUsageWidget");

    fill.style.transform = `scaleX(${data.percentUsed / 100})`;
    fill.classList.remove("disk-warn", "disk-danger");
    if (data.percentUsed >= 90) fill.classList.add("disk-danger");
    else if (data.percentUsed >= 75) fill.classList.add("disk-warn");

    // Под полоской — "свободно/всего" одной строкой (например "10/70ГБ").
    freeEl.textContent = formatFreeOfTotal(data.free, data.total);
    widget.title = `Свободно: ${gb(data.free)} ГБ\nЗанято: ${gb(data.used)} ГБ\nВсего: ${gb(data.total)} ГБ (${data.percentUsed}%)`;
  } catch {
    // Виджет необязателен для работы — просто оставляем плейсхолдер, если не получилось.
  }
}

(async function init() {
  try {
    const { user } = await apiFetch("/api/auth/me");
    currentUser = user;
    showApp();
    history.replaceState({ view: "columns" }, "");
    enterAppForUser();
    loadDiskUsage();
    refreshTrashBadge();
  } catch (err) {
    showLogin();
  }
})();
