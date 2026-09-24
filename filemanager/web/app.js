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
  breadcrumbs: document.getElementById("breadcrumbs"),
  folderList: document.getElementById("folderList"),
  backBtn: document.getElementById("backBtn"),
  folderTitle: document.getElementById("folderTitle"),
  logoutBtn: document.getElementById("logoutBtn"),
  profileInitials: document.getElementById("profileInitials"),
  profileName: document.getElementById("profileName"),
  profileRole: document.getElementById("profileRole"),
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
  createSideBtn: document.getElementById("createSideBtn"),
  createSideMenu: document.getElementById("createSideMenu"),
  planfixSyncBtn: document.getElementById("planfixSyncBtn"),
  profileBtn: document.getElementById("profileBtn"),
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
  expertOverlay: document.getElementById("expertOverlay"),
  expertForm: document.getElementById("expertForm"),
  expertName: document.getElementById("expertName"),
  expertError: document.getElementById("expertError"),
  addExpertBtn: document.getElementById("addExpertBtn"),
  gpForm: document.getElementById("gpForm"),
  gpCaseSelect: document.getElementById("gpCaseSelect"),
  gpTemplateSelect: document.getElementById("gpTemplateSelect"),
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
    const err = new Error(body.message || ("HTTP " + res.status));
    // Код и тело ответа нужны вызывающему: по ним он отличает «нельзя»
    // от «нельзя без подтверждения». Раньше наружу уходил только текст.
    err.status = res.status;
    err.data = body;
    throw err;
  }
  return res.json();
}

function showLogin(errorMsg) {
  els.appScreen.classList.add("hidden");
  els.loginScreen.classList.remove("hidden");
  // Без сети просить пароль бессмысленно: проверить его некому. Честно
  // говорим, что случилось, вместо формы, которая всё равно не сработает.
  if (!navigator.onLine) {
    els.loginError.textContent =
      "Нет связи с сервером. Войти сейчас не получится — пароль проверяет сервер.";
    return;
  }
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
  // В режиме выбора файла ссылка на папку тоже работает — и это важно.
  // «Учёт» открывает выбор фотографии прибора и сразу говорит, в какой
  // папке искать: в «Изображениях» этого прибора. Раньше окно всегда
  // открывалось в корне, и до нужной папки надо было доходить руками
  // через три уровня — при том, что вызывающая сторона прекрасно знает,
  // куда вести.
  const path = pickerParams.get("path");
  if (!path) return null;
  return { path, sel: pickerParams.get("sel") || "" };
})();

// ?section=recent|trash|history|tasks — открыть сразу нужный раздел.
// "tasks" здесь обязателен: страница задач сама пишет ?section=tasks в
// адрес, и без этого перезагрузка (или ссылка, отправленная коллеге)
// возвращала бы на файлы.
const SECTIONS = ["files", "recent", "trash", "history", "tasks", "case", "registry", "journal"];
let pendingSection = (() => {
  if (PICKER_MODE) return null;
  const name = pickerParams.get("section");
  return SECTIONS.includes(name) ? name : null;
})();
// Карточка проекта живёт по адресу ?section=case&id=11 — чтобы ссылку
// можно было отправить коллеге и чтобы F5 не выкидывал на файлы.
let pendingCaseId = PICKER_MODE ? null : (pickerParams.get("id") || null);
// «Список дел» помнит открытую стадию: ?section=registry&stage=plan.
let pendingRegistryStage = PICKER_MODE ? null : (pickerParams.get("stage") || null);

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
const APP_BUILD = "2026-09-24.3";

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
  els.profileInitials.textContent = initialsFor(p.name || p.username);
  els.profileName.textContent = p.name || p.username || "—";
  els.profileRole.textContent = p.role === "admin" ? "Администратор" : "Сотрудник";
}

function applyPermissionsUI() {
  const p = currentUser || {};
  renderProfileCard();
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
  // Настройки задевают всех сразу — пункт виден только администратору.
  // Сервер всё равно проверяет роль сам: спрятанная кнопка защитой не
  // считается, она лишь убирает со стола то, чем всё равно нельзя
  // воспользоваться.
  const settingsBtn = document.getElementById("settingsBtn");
  if (settingsBtn) settingsBtn.classList.toggle("hidden", rootOnlyAdmin);
  // В панели пункты «Новый проект» и «Гарантийное письмо» живут по тем же
  // правилам, что и в колонке «Дела»: нет доступа к делам — нет и пунктов.
  if (els.createSideMenu) {
    els.createSideMenu.querySelectorAll(".side-create-case, #createSideSep")
      .forEach((item) => item.classList.toggle("hidden", !p.can_cases));
    els.createSideMenu.querySelectorAll('[data-create="folder"], [data-create="docx"], [data-create="xlsx"], [data-create="upload"]')
      .forEach((item) => item.classList.toggle("hidden", !p.can_db));
  }
  if (els.createSideBtn) {
    // Ни дел, ни файлов — создавать нечего, кнопку прячем совсем.
    els.createSideBtn.classList.toggle("hidden", !p.can_db && !p.can_cases);
  }
  const documentMenuButton = document.getElementById("documentMenuBtn");
  if (documentMenuButton) documentMenuButton.closest(".side-documents").classList.toggle("hidden", !p.can_cases);

  const allowed = [];
  if (p.can_tools) allowed.push("tools");
  if (p.can_db) allowed.push("db");
  if (p.can_cases) allowed.push("cases");

  return allowed;
}

// Запускает подходящий начальный экран после входа/загрузки страницы.
function enterAppForUser() {
  checkBuildMatch();

  // Место на диске и счётчик корзины раньше запрашивались только при
  // запуске страницы. Войти можно двумя путями — с уже живой сессией
  // (тогда запуск и есть вход) и через форму входа, и во втором случае
  // виджеты оставались пустыми до перезагрузки. Запрашиваем их здесь:
  // это единственное место, через которое проходят оба пути.
  loadDiskUsage();
  refreshTrashBadge();

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
    // Фильтры задач и открытая карточка восстанавливаются из адреса:
    // иначе перезагрузка молча сбрасывала бы отбор, и человек решил бы,
    // что задачи пропали.
    if (section === "tasks") tasksFiltersFromUrl(pickerParams);
    if (section === "registry" && pendingRegistryStage) {
      registryStage = REGISTRY_STAGES.some((x) => x.key === pendingRegistryStage)
        ? pendingRegistryStage : null;
      pendingRegistryStage = null;
    }
    if (section === "case" && pendingCaseId) {
      const id = pendingCaseId;
      pendingCaseId = null;
      openCaseCard(id, false);
      return;
    }
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
  case_edit:   { label: "Правка проекта",      tone: "stage", text: (e) => `изменил карточку проекта ${b(e.target_name)}` },
  task_created:{ label: "Новая задача",        tone: "new",   text: (e) => `поставил задачу ${b(e.target_name)}` },
  task_done:   { label: "Задача завершена",    tone: "add",   text: (e) => `завершил задачу ${b(e.target_name)}` },
  task_changed:{ label: "Правка задачи",       tone: "stage", text: (e) => `изменил задачу ${b(e.target_name)}` },
  task_deleted:{ label: "Задача удалена",      tone: "del",   text: (e) => `удалил задачу ${b(e.target_name)}` },
  // Настройки задевают всех, поэтому их правка попадает в историю. Имя
  // настройки пишем, значение — никогда: там может лежать токен.
  user_rename: { label: "Логин изменён",       tone: "stage", text: (e) => `переименовал ${b(e.details.from)} → ${b(e.target_name)}${
                   e.details.cases ? ` (поправлено проектов: ${e.details.cases})` : ""}` },
  settings:    { label: "Настройки",           tone: "stage", text: (e) => (e.details && e.details.cleared
                   ? `вернул настройку ${b(e.target_name)} к прежнему значению`
                   : `изменил настройку ${b(e.target_name)}`) },
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
  if (name === "trash") loadTrash();
  if (name === "recent") loadRecent();
  if (name === "history") loadHistory();
  if (name === "tasks") loadTasksPage();
  if (name === "registry") loadRegistry();
  if (name === "journal") loadJournal();
  if (name === "settings") loadSettings();
  // Карточку не грузим здесь: её открывает openCaseCard, потому что ей
  // нужен ещё и номер проекта, а showSection знает только имя раздела.

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
  btn.addEventListener("click", () => {
    // «Главная» всегда возвращает к двум колонкам («База данных» и «Дела»),
    // даже если раздел уже открыт и человек стоит глубоко в папках.
    // Раньше раздел помнил последнюю папку: нажимаешь «Файлы» — и ничего
    // не происходит, потому что ты и так «в файлах». Теперь это надёжный
    // способ вернуться в начало из любого места.
    if (btn.dataset.section === "files") goToColumns(false);
    showSection(btn.dataset.section, true);
  });
});

/* ---------- Оборудование ----------
   Папка «База данных / Оборудование» — отражение приборов из «Учёта».
   Классификация — папка, прибор — папка внутри неё, фотографии —
   в подпапке «Изображения», свидетельства — в «Поверке».

   Синхронизировать нечего: обе системы ходят в одну базу, и прибор,
   заведённый здесь, появляется в «Учёте» сразу. Раскладку папок держит
   сервер (src/equipment.js) — здесь только показ и форма. */

const EQUIPMENT_PATH = DB_PATH + "/Оборудование";
const INSTRUMENTS_APP_URL = "/instruments/";

let equipmentHere = null;   // что сервер сказал про открытую папку
let equipmentTypes = [];    // классификации, они же папки
let equipmentCompanies = [];

/**
 * Открыли папку — спрашиваем сервер, что это за место.
 *
 * Решение принимает он: только сервер знает и базу, и диск. Заодно в
 * корне он приводит раскладку в порядок, поэтому отдельный фоновый
 * процесс сверки не нужен — папки становятся на места тогда, когда
 * на них смотрят.
 */
async function updateEquipment(path) {
  const banner = document.getElementById("equipmentBanner");
  const button = document.getElementById("addInstrumentBtn");
  const inEquipment = path === EQUIPMENT_PATH || path.startsWith(EQUIPMENT_PATH + "/");

  equipmentHere = null;
  banner.classList.add("hidden");
  if (button) button.classList.toggle("hidden", !inEquipment);
  // Архив наклеек — только в корне: он про все приборы сразу, и
  // предлагать его, стоя в папке одного прибора, было бы странно.
  const qrButton = document.getElementById("qrArchiveBtn");
  if (qrButton) qrButton.classList.toggle("hidden", path !== EQUIPMENT_PATH);
  if (!inEquipment) return;

  try {
    equipmentHere = await apiFetch(`/api/equipment/describe?path=${encodeURIComponent(path)}`);
  } catch {
    return; // раздела «Учёт» может не быть в этой базе — молча живём дальше
  }
  if (!equipmentHere) return;
  renderEquipmentBanner(equipmentHere);
  // Раскладка могла измениться (сверка в корне) — перечитываем список.
  if (equipmentHere.kind === "root" && currentPath === path) renderFolderAfterSync(path);
}

/** После сверки список папок мог поменяться — перечитываем его один раз. */
let equipmentSyncedFor = null;
function renderFolderAfterSync(path) {
  if (equipmentSyncedFor === path) return;
  equipmentSyncedFor = path;
  renderFolder(path);
}

function renderEquipmentBanner(info) {
  const banner = document.getElementById("equipmentBanner");
  if (info.kind === "instrument") {
    banner.innerHTML = instrumentStripHtml(info.instrument);
    banner.className = "eq-banner";
  } else if (info.kind === "root" && info.strangers && info.strangers.length) {
    // Разовая история: до автоматизации в папке уже что-то лежало.
    // Ничего не двигаем и не удаляем — только говорим, что оно есть.
    if (localStorage.getItem("eqStrangersHidden") === "1") return;
    const dirs = info.strangers.filter((x) => x.isDir).length;
    const rest = info.strangers.length - dirs;
    banner.innerHTML = `
      <span class="eq-strong">Здесь лежит ${[
        dirs ? plural(dirs, "папка", "папки", "папок") : "",
        rest ? plural(rest, "файл", "файла", "файлов") : "",
      ].filter(Boolean).join(" и ")}, не относящихся к приборам</span>
      <span class="eq-fact">${info.strangers.slice(0, 3).map((x) => `«${escapeHtml(x.name)}»`).join(", ")}${
        info.strangers.length > 3 ? " и другое" : ""}. Их никто не трогал.</span>
      <span class="eq-spacer"></span>
      <button type="button" class="eq-btn" id="eqHideStrangers">Больше не показывать</button>`;
    banner.className = "eq-banner eq-warn";
    bind(document.getElementById("eqHideStrangers"), "click", () => {
      localStorage.setItem("eqStrangersHidden", "1");
      banner.classList.add("hidden");
    });
  } else {
    banner.classList.add("hidden");
    return;
  }
  banner.classList.remove("hidden");

  const card = document.getElementById("eqOpenCard");
  if (card) {
    card.onclick = () => {
      location.href = `${INSTRUMENTS_APP_URL}?id=${encodeURIComponent(info.instrument.id)}`;
    };
  }
}

const EQ_STATUS = { free: "Свободен", busy: "Занят", booked: "Забронирован", retired: "Списан" };

/** Полоса прибора: где он, чем помечен, до какого числа поверка. */
function instrumentStripHtml(item) {
  // Наличие: у прибора может быть несколько одинаковых штук, и тогда
  // «Занят» ничего не говорит — важно, осталось ли что брать.
  const qty = Number(item.qty) || 1;
  const held = Number(item.held_qty) || 0;
  const multi = qty > 1 && item.status !== "retired";
  const where = multi
    ? `Свободно ${qty - held} из ${qty}`
    : (item.status === "busy"
      ? `${EQ_STATUS.busy}${item.taken_by_name ? " — у " + escapeHtml(item.taken_by_name) : ""}${
          item.taken_at ? " с " + escapeHtml(fmtEqDate(item.taken_at)) : ""}`
      : EQ_STATUS[item.status] || item.status);
  const tone = multi
    ? (qty - held > 0 ? "ok" : "busy")
    : ({ free: "ok", busy: "busy", booked: "busy", retired: "muted" }[item.status] || "muted");

  return `
    <span class="eq-badge eq-${tone}">${where}</span>
    ${item.taken_where ? `<span class="eq-fact">${escapeHtml(item.taken_where)}</span>` : ""}
    ${item.control_type_short
      ? `<span class="eq-badge eq-plain" title="${escapeHtml(item.control_type_name || "")}">${escapeHtml(item.control_type_short)}</span>`
      : `<span class="eq-badge eq-plain">классификация не указана</span>`}
    ${eqVerificationHtml(item)}
    ${item.serial_number ? `<span class="eq-fact">с/н ${escapeHtml(item.serial_number)}</span>` : ""}
    <span class="eq-spacer"></span>
    <button type="button" class="eq-btn eq-accent" id="eqOpenCard">Карточка в «Учёте» →</button>`;
}

/** Срок поверки словами: важно не «есть ли», а когда кончается. */
function eqVerificationHtml(item) {
  if (item.check_type === "none") return '<span class="eq-fact">контроль не требуется</span>';
  if (!item.valid_until) return '<span class="eq-badge eq-warn-b">срок поверки не заполнен</span>';
  const days = Math.round(
    (Date.parse(String(item.valid_until).slice(0, 10) + "T00:00:00Z") -
     Date.parse(new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10) + "T00:00:00Z")) / 86400000
  );
  if (days < 0) {
    return `<span class="eq-badge eq-bad">поверка просрочена ${plural(Math.abs(days), "день", "дня", "дней")}</span>`;
  }
  if (days <= 30) {
    return `<span class="eq-badge eq-warn-b">поверка кончается через ${plural(days, "день", "дня", "дней")}</span>`;
  }
  return `<span class="eq-fact">поверка до ${escapeHtml(fmtEqDate(item.valid_until))}</span>`;
}

const fmtEqDate = (value) => {
  const s = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
};

/**
 * Наклейки с QR — все коды одним архивом.
 *
 * У каждого прибора QR лежит в его собственной папке и появляется сам.
 * Эта кнопка нужна для другого: распечатать наклейки пачкой. Сервер
 * перед сборкой перерисовывает коды по текущему адресу сайта — печатать
 * наклейку с кодом, ведущим в никуда, хуже, чем не печатать вовсе.
 */
bind(document.getElementById("qrArchiveBtn"), "click", async (e) => {
  const button = e.currentTarget;
  const label = button.querySelector("span").textContent;
  button.disabled = true;
  button.querySelector("span").textContent = "Собираем…";
  try {
    const res = await fetch("/api/equipment/qr-archive", { credentials: "same-origin" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `Ошибка ${res.status}`);
    }
    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = "Наклейки с QR.zip";
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Отпускаем память не сразу: часть браузеров не успевает начать
    // скачивание, если ссылку отозвать в тот же миг.
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    showToast("Наклейки собраны");
  } catch (err) {
    showToast("Не удалось собрать наклейки: " + err.message);
  } finally {
    button.disabled = false;
    button.querySelector("span").textContent = label;
  }
});

/* ---------- Форма «Добавить прибор» ---------- */

bind(document.getElementById("addInstrumentBtn"), "click", () => openInstrumentForm());
bind(document.getElementById("instrumentCloseBtn"), "click", () => {
  document.getElementById("instrumentOverlay").classList.add("hidden");
});

async function openInstrumentForm() {
  const form = document.getElementById("instrumentForm");
  form.reset();
  document.getElementById("instrumentError").textContent = "";
  document.getElementById("instrumentOverlay").classList.remove("hidden");

  if (!equipmentTypes.length) {
    try {
      equipmentTypes = (await apiFetch("/api/equipment/control-types")).types || [];
      equipmentCompanies = (await apiFetch("/api/equipment/companies")).companies || [];
    } catch { /* пусто — значит выбирать не из чего */ }
  }
  const typeSelect = document.getElementById("instrumentControlType");
  typeSelect.innerHTML = '<option value="">Не указано</option>' + equipmentTypes
    .map((t) => `<option value="${escapeHtml(t.code)}">${escapeHtml(t.full_name)} (${escapeHtml(t.short_name)})</option>`)
    .join("");
  document.getElementById("instrumentCompany").innerHTML = '<option value="">Не привязан</option>' +
    equipmentCompanies.map((c) => `<option value="${escapeHtml(c.code)}">${escapeHtml(c.name)}</option>`).join("");

  // Стоим внутри папки классификации — подставляем её: человек уже
  // сказал, куда кладёт прибор, спрашивать второй раз незачем.
  const hint = document.getElementById("instrumentTypeHint");
  hint.textContent = "";
  if (equipmentHere && equipmentHere.kind === "classification") {
    const match = equipmentTypes.find((t) => t.full_name === equipmentHere.name);
    if (match) {
      typeSelect.value = match.code;
      hint.textContent = "Подставлена по папке, в которой вы стоите. Можно поменять — прибор попадёт в другую папку.";
    }
  }
  form.querySelector('[name="name"]').focus();
}

bind(document.getElementById("instrumentForm"), "submit", async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const button = document.getElementById("instrumentSubmitBtn");
  const error = document.getElementById("instrumentError");
  const data = Object.fromEntries(new FormData(form).entries());
  const photos = Array.from(document.getElementById("instrumentPhotos").files || []);
  const docs = Array.from(document.getElementById("instrumentDocs").files || []);

  error.textContent = "";
  if (!String(data.name || "").trim()) return (error.textContent = "Укажите название прибора");

  button.disabled = true;
  const label = button.textContent;
  button.textContent = "Сохраняем…";
  try {
    const { instrument } = await apiFetch("/api/equipment/instruments", {
      method: "POST", body: JSON.stringify(data),
    });
    // Файлы идут той же загрузкой, что и всё остальное в системе.
    // Первый снимок становится фотографией карточки — но только если
    // своей у прибора ещё нет.
    await uploadInstrumentFiles(instrument.id, photos, "photo");
    await uploadInstrumentFiles(instrument.id, docs, "document");

    document.getElementById("instrumentOverlay").classList.add("hidden");
    showToast(`Прибор «${instrument.name}» добавлен`);
    equipmentSyncedFor = null;
    if (currentPath.startsWith(EQUIPMENT_PATH)) renderFolder(currentPath);
  } catch (err) {
    error.textContent = err.message;
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
});

async function uploadInstrumentFiles(instrumentId, fileList, kind) {
  if (!fileList.length) return;
  const { path: dir } = await apiFetch(
    `/api/equipment/upload-dir?id=${instrumentId}&kind=${encodeURIComponent(kind)}`);
  let first = true;
  for (const file of fileList) {
    await uploadOneFile(file, dir, file.name);
    if (first) {
      await apiFetch("/api/equipment/adopt-file", {
        method: "POST",
        body: JSON.stringify({ id: instrumentId, path: `${dir}/${file.name}`, kind }),
      }).catch(() => {});
      first = false;
    }
  }
}

/* ---------- Эксперты ----------
   Справочник экспертов лежит в файлах: /База данных/Эксперты/<Имя>/,
   внутри два файла сведений (текстом и со вшитыми сканами) и подпапка
   «Приложения» с самими сканами.

   Заведение эксперта и его сведения — РАЗНЫЕ действия. Раньше это было
   одним: заводя папку, тут же набирали биографию или приносили готовый
   файл. Из-за этого сведения у каждого были устроены по-своему, а сканы
   лежали рядом кучей и ни с чем не связаны — в письмо они попадали в
   том порядке, в каком их когда-то назвали. */

const EXPERTS_PATH = DB_PATH + "/Эксперты";

/** Кнопка нужна ровно в одной папке — в самой папке «Эксперты». */
/**
 * Какие кнопки экспертов уместны в этой папке.
 *
 * В самой папке «Эксперты» — завести нового и поправить любого (форма
 * спросит, кого). В папке конкретного эксперта — сразу его: спрашивать
 * «кого правим», стоя в его папке, незачем.
 */
function updateExpertButton(path) {
  if (!els.addExpertBtn) return;
  const inRoot = path === EXPERTS_PATH;
  const insideExpert = path.startsWith(EXPERTS_PATH + "/") &&
    path.slice(EXPERTS_PATH.length + 1).indexOf("/") === -1;

  els.addExpertBtn.classList.toggle("hidden", !inRoot);
  document.getElementById("expertInfoBtn").classList.toggle("hidden", !inRoot);
  document.getElementById("expertInfoThisBtn").classList.toggle("hidden", !insideExpert);
}

/** Имя эксперта из пути его папки. */
const expertNameFromPath = (path) =>
  path.startsWith(EXPERTS_PATH + "/") ? path.slice(EXPERTS_PATH.length + 1).split("/")[0] : null;

bind(els.addExpertBtn, "click", () => openExpertForm());
bind(document.getElementById("expertCloseBtn"), "click", closeExpertForm);

function openExpertForm() {
  els.expertForm.reset();
  els.expertError.textContent = "";
  els.expertOverlay.classList.remove("hidden");
  els.expertName.focus();
}

function closeExpertForm() {
  els.expertOverlay.classList.add("hidden");
}

/**
 * Заводим только папку.
 *
 * Раньше здесь же набирали сведения или приносили их готовым файлом —
 * и получалось, что у одного эксперта сведения устроены так, у другого
 * иначе, а сканы лежат рядом и ни с чем не связаны. Теперь сведения
 * заводит отдельный инструмент, один для всех.
 */
bind(els.expertForm, "submit", async (e) => {
  e.preventDefault();
  const button = document.getElementById("expertSubmitBtn");
  const name = els.expertName.value.trim();

  els.expertError.textContent = "";
  if (!name) return (els.expertError.textContent = "Укажите имя эксперта");

  button.disabled = true;
  const label = button.textContent;
  button.textContent = "Заводим…";
  try {
    const { expert } = await apiFetch("/api/experts", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    closeExpertForm();
    showToast(`Эксперт «${expert.name}» заведён — заполните сведения`);
    if (currentPath === EXPERTS_PATH) renderFolder(currentPath);
    // Ведём дальше сами: без сведений эксперта нельзя выбрать в ГП, и
    // оставить человека на этом месте значило бы оставить работу
    // сделанной наполовину.
    openExpertInfo(expert.name);
  } catch (err) {
    els.expertError.textContent = err.message;
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
});

/* ---------- Сведения об эксперте ----------

   Пункт биографии и сканы, которые его подтверждают, — вместе. Раньше
   это были две несвязанные вещи: текст в одном файле, сканы кучей в
   соседней папке. Из-за этого в письмо документы уходили в том порядке,
   в каком их когда-то назвали, а не в том, в каком идёт текст.

   Сканы улетают на сервер сразу при выборе, а пункты сохраняются
   отдельной кнопкой. Так набранный текст не пропадает, если картинка
   не долетела, — и наоборот. */

let expertInfoState = { name: null, items: [] };
let expertInfoWanted = null;
// Имя эксперта, если форму открыли из его папки: тогда переключаться
// между экспертами нельзя — форма про него одного.
let expertInfoOnly = null;

bind(document.getElementById("expertInfoBtn"), "click", () => openExpertInfo());
bind(document.getElementById("expertInfoThisBtn"), "click", () => {
  const name = expertNameFromPath(currentPath);
  if (name) openExpertInfo(name, { only: true });
});
bind(document.getElementById("expertInfoCloseBtn"), "click", () => {
  document.getElementById("expertInfoOverlay").classList.add("hidden");
});

async function openExpertInfo(preselect, { only = false } = {}) {
  const overlay = document.getElementById("expertInfoOverlay");
  const who = document.getElementById("expertInfoWho");
  document.getElementById("expertInfoError").textContent = "";
  expertInfoOnly = only ? preselect : null;
  // Из папки эксперта список «кого правим» не нужен: и так понятно.
  document.getElementById("expertInfoWhoWrap").classList.toggle("hidden", Boolean(expertInfoOnly));
  document.getElementById("expertInfoHead").textContent = expertInfoOnly
    ? `Эксперт: ${expertInfoOnly}` : "Редактировать эксперта";
  // Пока список грузится, показывать прошлого человека нельзя: можно
  // успеть набрать в его пунктах и не понять, чьи они.
  document.getElementById("expertInfoItems").innerHTML =
    '<div class="empty-hint">Загрузка…</div>';
  document.getElementById("expertInfoImported").style.display = "none";
  document.getElementById("expertInfoDelete").classList.toggle(
    "hidden", !currentUser || currentUser.role !== "admin");
  overlay.classList.remove("hidden");

  // Открыли снова — возвращаемся к тому, с кем работали: почти всегда
  // это продолжение того же дела, а не начало нового.
  const keep = preselect || expertInfoState.name;

  try {
    const { experts } = await apiFetch("/api/experts");
    if (!experts.length) {
      document.getElementById("expertInfoError").textContent =
        "Экспертов ещё нет — сначала заведите эксперта.";
      who.innerHTML = "";
      document.getElementById("expertInfoItems").innerHTML = "";
      return;
    }
    who.innerHTML = experts
      .map((e) => `<option value="${escapeHtml(e.name)}">${escapeHtml(e.name)}</option>`).join("");
    if (keep && experts.some((e) => e.name === keep)) who.value = keep;
    await loadExpertInfo(who.value);
  } catch (err) {
    document.getElementById("expertInfoError").textContent = err.message;
  }
}

bind(document.getElementById("expertInfoWho"), "change", (e) => {
  loadExpertInfo(e.target.value).catch((err) => {
    document.getElementById("expertInfoError").textContent = err.message;
  });
});

async function loadExpertInfo(name) {
  // Пока ответ идёт, человек мог выбрать другого — и тогда прилетевшее
  // старое перетёрло бы уже показанное. Запоминаем, кого спрашивали
  // последним, и чужой ответ выбрасываем.
  expertInfoWanted = name;
  const data = await apiFetch(`/api/experts/${encodeURIComponent(name)}/info`);
  if (expertInfoWanted !== name) return;
  expertInfoState = {
    name,
    items: (data.items.length ? data.items : [{ text: "", files: [] }]).map((item) => ({
      ...item,
      files: Array.isArray(item.files) ? item.files : [],
      image_options: item.image_options || {},
    })),
  };

  document.getElementById("expertInfoName").value = name;
  loadExpertScans(name).catch(() => { /* список сканов не главное */ });

  const note = document.getElementById("expertInfoImported");
  if (data.imported) {
    // Текст подтянулся из старого файла — человек должен об этом знать,
    // а не гадать, откуда взялись пункты, которых он не набирал.
    note.style.display = "";
    note.textContent = `Пункты подтянуты из файла «${data.imported}» — он был заполнен раньше. ` +
      "Проверьте, прикрепите сканы и сохраните.";
  } else {
    note.style.display = "none";
  }
  if (data.broken) {
    document.getElementById("expertInfoError").textContent =
      "Файл со связями сканов испорчен — пункты придётся завести заново.";
  }
  renderExpertInfoItems();
}

function renderExpertInfoItems() {
  const box = document.getElementById("expertInfoItems");
  box.innerHTML = expertInfoState.items.map((item, i) => `
    <section class="ei-item" data-ei="${i}">
      <div class="ei-item-head">
        <span class="ei-num">${i + 1}</span>
        <button type="button" class="link-btn" data-ei-drop="${i}">Убрать пункт</button>
      </div>
      <textarea rows="2" data-ei-text="${i}"
        placeholder="образование высшее: …">${escapeHtml(item.text)}</textarea>
      <div class="ei-files">
        ${item.files.map((f, j) => `
          <article class="ei-scan-card">
            <div class="ei-scan-preview"><img loading="lazy" src="/api/view?path=${encodeURIComponent(
              `${EXPERTS_PATH}/${expertInfoState.name}/Приложения/${f}`)}" alt="${escapeHtml(f)}"
              style="transform:rotate(${Number(item.image_options?.[f]?.rotation || 0)}deg)"></div>
            <div class="ei-scan-info">
              <b title="${escapeHtml(f)}">${escapeHtml(f)}</b>
              <div class="ei-scan-controls">
                <button type="button" data-ei-rotate="${i}:${j}:-90" title="Повернуть влево">↶</button>
                <button type="button" data-ei-rotate="${i}:${j}:90" title="Повернуть вправо">↷</button>
                <label>Размер
                  <select data-ei-size="${i}:${j}">
                    ${[50, 75, 100].map((size) => `<option value="${size}"${
                      Number(item.image_options?.[f]?.width_percent || 100) === size ? " selected" : ""
                    }>${size}%</option>`).join("")}
                  </select>
                </label>
                <span class="ei-rotation">Поворот ${Number(item.image_options?.[f]?.rotation || 0)}°</span>
                <button type="button" class="ei-unfile" data-ei-unfile="${i}:${j}" aria-label="Открепить">Открепить</button>
              </div>
            </div>
          </article>`).join("")}
        <label class="ei-add-scan">
          <input type="file" accept="image/*" multiple data-ei-file="${i}" class="ei-file-input">
          <span>+ Прикрепить скан</span>
        </label>
      </div>
    </section>`).join("");
}

/* Слушаем контейнер, а не каждую кнопку по отдельности.
   Список пунктов перерисовывается на каждое действие, и обработчики,
   навешенные на сами элементы, живут до первой перерисовки. Делегирование
   вешается один раз и переживает любое число перерисовок. */
(function wireExpertInfoBox() {
  const box = document.getElementById("expertInfoItems");
  if (!box) return;

  box.addEventListener("input", (e) => {
    const field = e.target.closest("[data-ei-text]");
    if (!field) return;
    expertInfoState.items[Number(field.dataset.eiText)].text = field.value;
  });

  box.addEventListener("click", (e) => {
    const drop = e.target.closest("[data-ei-drop]");
    if (drop) {
      const i = Number(drop.dataset.eiDrop);
      const item = expertInfoState.items[i];
      if ((item.text.trim() || item.files.length) &&
          !confirm("Убрать этот пункт? Сканы останутся в папке «Приложения».")) return;
      expertInfoState.items.splice(i, 1);
      if (!expertInfoState.items.length) expertInfoState.items.push({ text: "", files: [] });
      return renderExpertInfoItems();
    }

    const unfile = e.target.closest("[data-ei-unfile]");
    if (unfile) {
      const [i, j] = unfile.dataset.eiUnfile.split(":").map(Number);
      // Только открепляем от пункта. Сам файл остаётся в папке: удалять
      // с диска из формы, где человек просто передумал, — слишком.
      const [removed] = expertInfoState.items[i].files.splice(j, 1);
      if (removed) delete expertInfoState.items[i].image_options?.[removed];
      renderExpertInfoItems();
      return;
    }

    const rotate = e.target.closest("[data-ei-rotate]");
    if (rotate) {
      const [i, j, delta] = rotate.dataset.eiRotate.split(":").map(Number);
      const item = expertInfoState.items[i];
      const file = item.files[j];
      item.image_options ||= {};
      const current = Number(item.image_options[file]?.rotation || 0);
      item.image_options[file] = {
        ...item.image_options[file],
        rotation: (current + delta + 360) % 360,
        width_percent: Number(item.image_options[file]?.width_percent || 100),
      };
      renderExpertInfoItems();
    }
  });

  box.addEventListener("change", (e) => {
    const size = e.target.closest("[data-ei-size]");
    if (!size) return;
    const [i, j] = size.dataset.eiSize.split(":").map(Number);
    const item = expertInfoState.items[i];
    const file = item.files[j];
    item.image_options ||= {};
    item.image_options[file] = {
      ...item.image_options[file],
      rotation: Number(item.image_options[file]?.rotation || 0),
      width_percent: Number(size.value),
    };
  });

  box.addEventListener("change", async (e) => {
    const input = e.target.closest("[data-ei-file]");
    if (!input) return;
    const i = Number(input.dataset.eiFile);
    const files = Array.from(input.files || []);
    input.value = "";
    for (const file of files) {
      try {
        const normalized = await normalizeExpertScan(file);
        const saved = await uploadExpertScan(expertInfoState.name, normalized);
        expertInfoState.items[i].files.push(saved.name);
        expertInfoState.items[i].image_options ||= {};
        expertInfoState.items[i].image_options[saved.name] = { rotation: 0, width_percent: 100 };
      } catch (err) {
        showToast(err.message);
      }
    }
    renderExpertInfoItems();
    if (expertInfoState.name) loadExpertScans(expertInfoState.name).catch(() => {});
  });
})();

/**
 * Все сканы папки эксперта — и те, что ни к одному пункту не прикреплены.
 *
 * Забытый файл иначе лежал бы вечно: в пунктах его нет, в папку никто не
 * заглядывает, а в письмо он не попадает. Здесь он виден и помечен.
 */
async function loadExpertScans(name) {
  const box = document.getElementById("expertInfoScans");
  box.innerHTML = '<p class="empty-hint">Загрузка…</p>';
  const { scans } = await apiFetch(`/api/experts/${encodeURIComponent(name)}/scans`);
  if (!scans.length) {
    box.innerHTML = '<p class="empty-hint">Сканов пока нет — прикрепите их к пунктам выше.</p>';
    return;
  }
  box.innerHTML = `
    <table class="access-rules">
      <tbody>${scans.map((s) => `
        <tr>
          <td class="access-path">${escapeHtml(s.name)}</td>
          <td>${s.items.length
            ? `в пункт${s.items.length > 1 ? "ах" : "е"} ${s.items.join(", ")}`
            : '<span class="ei-orphan">ни к чему не прикреплён</span>'}</td>
          <td><button type="button" class="link-btn" data-ei-drop-scan="${escapeHtml(s.name)}">Удалить</button></td>
        </tr>`).join("")}
      </tbody>
    </table>
    <p class="access-note">Удаление уносит файл в корзину и убирает его из пунктов.
    Оттуда его можно вернуть, как любой файл.</p>`;

  box.querySelectorAll("[data-ei-drop-scan]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const file = btn.dataset.eiDropScan;
      if (!confirm(`Убрать «${file}» в корзину? Из пунктов он тоже пропадёт.`)) return;
      try {
        const res = await apiFetch(
          `/api/experts/${encodeURIComponent(expertInfoState.name)}/scans/${encodeURIComponent(file)}`,
          { method: "DELETE" });
        if (Array.isArray(res.items)) expertInfoState.items = res.items;
        renderExpertInfoItems();
        showToast("Скан убран в корзину");
        await loadExpertScans(expertInfoState.name);
      } catch (err) {
        settingsError(err);
      }
    });
  });
}

/**
 * Переименование эксперта.
 *
 * Отдельной кнопкой, а не вместе с сохранением сведений: это правка,
 * которая задевает проекты, и делать её заодно, между делом, нельзя.
 */
bind(document.getElementById("expertInfoRename"), "click", async () => {
  const field = document.getElementById("expertInfoName");
  const next = field.value.trim();
  const was = expertInfoState.name;
  if (!next) return showToast("Укажите ФИО");
  if (next === was) return showToast("Имя то же самое — менять нечего");
  if (!confirm(`Переименовать «${was}» в «${next}»?\n\n` +
    "Поменяется имя папки и оба файла сведений. Уже созданные письма не изменятся — " +
    "они лежат готовыми файлами.")) return;

  try {
    const res = await apiFetch(`/api/experts/${encodeURIComponent(was)}`, {
      method: "PATCH", body: JSON.stringify({ name: next }),
    });
    showToast(`Эксперт переименован в «${res.to || next}»`);
    forgetLookups();
    await openExpertInfo(res.to || next, { only: Boolean(expertInfoOnly) });
    if (currentPath.startsWith(EXPERTS_PATH)) {
      // Стояли в папке эксперта — её больше нет под прежним именем.
      renderFolder(expertInfoOnly ? `${EXPERTS_PATH}/${res.to || next}` : currentPath);
    }
  } catch (err) {
    field.value = was;
    settingsError(err);
  }
});

bind(document.getElementById("expertInfoDelete"), "click", async () => {
  if (!currentUser || currentUser.role !== "admin") {
    return showToast("Удалять экспертов может только администратор");
  }
  const name = expertInfoState.name;
  if (!name) return;
  if (!confirm(`Удалить эксперта «${name}»?\n\n` +
    "Папка со сведениями и сканами уйдёт в корзину — оттуда её можно вернуть. " +
    "Проекты, где он записан в специалистах, не меняются.")) return;
  try {
    await apiFetch(`/api/experts/${encodeURIComponent(name)}`, { method: "DELETE" });
    showToast(`Эксперт «${name}» убран в корзину`);
    document.getElementById("expertInfoOverlay").classList.add("hidden");
    forgetLookups();
    renderFolder(EXPERTS_PATH);
  } catch (err) {
    settingsError(err);
  }
});

async function uploadExpertScan(expertName, file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`/api/experts/${encodeURIComponent(expertName)}/scans`, {
    method: "POST", credentials: "same-origin", body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Не удалось сохранить скан");
  return data;
}

/**
 * Браузер учитывает EXIF-поворот фотографии, а canvas записывает уже
 * видимое положение пикселей. Заодно ограничиваем очень большие снимки:
 * для страницы Word 3000 px достаточно, а загрузка с телефона становится
 * заметно быстрее. Если браузер не умеет декодировать формат, сервер
 * вернёт обычное понятное сообщение вместо потери файла.
 */
async function normalizeExpertScan(file) {
  if (!file?.type?.startsWith("image/") || typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 3000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d", { alpha: false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", .94));
    if (!blob) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "Скан";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

bind(document.getElementById("expertInfoAddItem"), "click", () => {
  expertInfoState.items.push({ text: "", files: [] });
  renderExpertInfoItems();
  const last = document.querySelector("#expertInfoItems .ei-item:last-child textarea");
  if (last) last.focus();
});

bind(document.getElementById("expertInfoSaveBtn"), "click", async (e) => {
  const button = e.currentTarget;
  const error = document.getElementById("expertInfoError");
  error.textContent = "";
  const items = expertInfoState.items.filter((i) => i.text.trim());
  if (!items.length) return (error.textContent = "Заполните хотя бы один пункт");

  button.disabled = true;
  const openPreview = document.getElementById("expertInfoOpenPreview").checked;
  const previewTab = openPreview ? window.open("about:blank", "_blank") : null;
  if (previewTab) previewTab.document.body.textContent = "Собираем документ…";
  const label = button.textContent;
  button.textContent = "Сохраняем…";
  try {
    const res = await apiFetch(`/api/experts/${encodeURIComponent(expertInfoState.name)}/info`, {
      method: "PUT", body: JSON.stringify({ items }),
    });
    showToast(res.missing && res.missing.length
      ? `Сохранено, но не нашлись сканы: ${res.missing.join(", ")}`
      : "Сведения сохранены — оба файла пересобраны");
    if (openPreview && res.preview_path) {
      const url = `/office.html?mode=view&path=${encodeURIComponent(res.preview_path)}`;
      if (previewTab) previewTab.location.href = url;
      else window.open(url, "_blank");
    } else if (previewTab) {
      previewTab.close();
    }
    document.getElementById("expertInfoOverlay").classList.add("hidden");
    if (currentPath && currentPath.startsWith(EXPERTS_PATH)) renderFolder(currentPath);
  } catch (err) {
    if (previewTab) previewTab.close();
    error.textContent = err.message;
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
});

/**
 * Одна загрузка через общий /api/upload.
 *
 * relativePath задаёт имя, под которым файл ляжет: так принесённый
 * «Иванов сведения (финал, правка 3).docx» становится «Сведения.docx» —
 * именем, по которому его ищет генератор ГП.
 */
async function uploadOneFile(file, targetPath, saveAs) {
  const form = new FormData();
  form.append("file", file);
  form.append("path", targetPath);
  form.append("relativePath", saveAs);
  const res = await fetch("/api/upload", { method: "POST", body: form, credentials: "include" });
  if (!res.ok) {
    let message = `Не удалось загрузить «${file.name}»`;
    try {
      const data = await res.json();
      if (data && data.message) message = data.message;
    } catch { /* тело не JSON — оставляем общий текст */ }
    throw new Error(message);
  }
}

/* ---------- Учёт оборудования ----------
   Раньше это была одна из строк во всплывающем списке «Ссылки»: чтобы
   попасть в соседний сервис, надо было открыть список и найти в нём
   нужную строку. Теперь это обычный пункт боковой панели, рядом с
   «Корзиной», — переход в одно нажатие.

   Сервис живёт на том же домене (/instruments/), поэтому открываем его
   в этой же вкладке: общий вход уже действует, повторно входить не надо. */

/* «Учёт оборудования» — обычная ссылка в разметке: она открывается в
   новой вкладке сама, и перехватывать щелчок незачем. Раньше здесь был
   переход текущей вкладкой. */

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
    els.loginError.textContent = navigator.onLine
      ? "Не удалось войти: проверьте логин и пароль"
      : "Нет связи с сервером. Войти сейчас не получится — пароль проверяет сервер.";
  }
});

els.logoutBtn.addEventListener("click", async () => {
  try { await apiFetch("/api/auth/logout", { method: "POST" }); } catch (e) {}
  currentUser = null;
  showLogin();
});

/* ---------- Профиль ----------

   Управление людьми переехало в «Настройки → Сотрудники»: там ему и
   место, а здесь оставалось по привычке. Чтобы привычка не ломалась,
   аватар администратора ведёт туда же — это не вторая кнопка для того
   же действия, а вторая дверь в одну и ту же комнату. */

els.profileBtn.addEventListener("click", () => {
  if (currentUser && currentUser.role === "admin") {
    settingsTab = "people";
    showSection("settings", true);
    return;
  }
  alert(`Пользователь: ${currentUser?.name || currentUser?.username || "—"}\nРоль: сотрудник`);
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
      .map((u) => `<option value="${u.id}">${escapeHtml(u.name)}</option>`)
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
      <span class="user-name">${escapeHtml(perm.name)}</span>
      <span class="role-badge">${escapeHtml(FOLDER_ACCESS_LABEL[perm.access] || perm.access)}</span>
      <button class="delete-btn" title="Убрать правило" aria-label="Убрать правило">${svgTrash}</button>
    `;
    row.querySelector(".delete-btn").addEventListener("click", async () => {
      if (!confirm(`Убрать это правило доступа для «${perm.name}»?`)) return;
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

/* Адрес соседнего сервиса «Учёт оборудования» остался в разметке
   (href у пункта панели): ссылка должна быть ссылкой, чтобы работали
   средняя кнопка мыши и «открыть в новой вкладке». Здесь он больше не
   нужен — и не должен лежать в двух местах сразу. */

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
      paths.map((p) => deleteResource(p))
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

/** Открыта ли сейчас папка (а не две колонки «Главной»). */
function isFolderViewOpen() {
  return Boolean(els.folderView) && !els.folderView.classList.contains("hidden");
}

function wireCreateMenu(btn, menu, getTarget) {
  if (!btn || !menu) return;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasOpen = !menu.classList.contains("hidden");
    closeCreateMenus();
    if (wasOpen) return;
    // Подпись «куда» пишется в момент открытия: путь мог поменяться
    // с прошлого раза, а человек должен видеть, куда кладёт.
    const where = menu.querySelector(".create-menu-where");
    if (where) {
      const { path } = getTarget();
      const name = String(path || "").split("/").filter(Boolean).pop();
      where.textContent = name ? `в папке «${name}»` : "в корне";
    }
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

// Кнопка в панели создаёт там, где человек сейчас находится: в открытой
// папке, а если открыты колонки — в корне «База данных». Иначе пришлось
// бы каждый раз гадать, куда именно ляжет новая папка.
wireCreateMenu(els.createSideBtn, els.createSideMenu, () => (
  isFolderViewOpen()
    ? { path: currentPath, refresh: () => renderFolder(currentPath) }
    : { path: DB_PATH, refresh: () => loadColumnList("db") }
));

/* ---------- Создание документов по шаблонам ---------- */

const documentUi = {
  menuBtn: document.getElementById("documentMenuBtn"), menu: document.getElementById("documentMenu"),
  overlay: document.getElementById("documentOverlay"), form: document.getElementById("documentForm"),
  close: document.getElementById("documentCloseBtn"), title: document.getElementById("documentFormTitle"),
  cases: document.getElementById("documentCaseSelect"), templates: document.getElementById("documentTemplateSelect"),
  fields: document.getElementById("documentFields"), error: document.getElementById("documentFormError"),
  newProject: document.getElementById("documentNewProject"), newProjectName: document.getElementById("documentNewProjectName"),
  preview: document.getElementById("documentPreviewFull"), previewTitle: document.getElementById("documentPreviewTitle"),
  previewMount: document.getElementById("documentPreviewMount"), previewBack: document.getElementById("documentPreviewBack"),
  previewSave: document.getElementById("documentPreviewSave"),
};
let documentCatalog = null;
let documentCurrentType = null;
let documentCases = [];
let documentExperts = [];
let documentDraft = null;
let documentEditor = null;

if (documentUi.menuBtn && documentUi.menu) {
  documentUi.menuBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const opening = documentUi.menu.classList.contains("hidden");
    closeCreateMenus();
    documentUi.menu.classList.toggle("hidden", !opening);
    documentUi.menuBtn.setAttribute("aria-expanded", String(opening));
  });
  documentUi.menu.addEventListener("click", (event) => event.stopPropagation());
  document.addEventListener("click", () => {
    documentUi.menu.classList.add("hidden");
    documentUi.menuBtn.setAttribute("aria-expanded", "false");
  });
  documentUi.menu.querySelectorAll("[data-document]").forEach((button) => {
    button.addEventListener("click", () => {
      documentUi.menu.classList.add("hidden");
      if (button.dataset.document === "gp") openGpForm();
      else openDocumentForm(button.dataset.document);
    });
  });
  const sub = documentUi.menu.querySelector(".document-submenu-btn");
  if (sub) sub.addEventListener("click", () => sub.closest(".document-submenu").classList.toggle("open"));
}

async function loadDocumentCatalog() {
  if (!documentCatalog) documentCatalog = await apiFetch("/api/documents/catalog");
  return documentCatalog.items;
}
async function loadDocumentSources() {
  const [cases, expertsData] = await Promise.all([apiFetch("/api/cases"), apiFetch("/api/experts")]);
  documentCases = cases.filter((c) => !c.is_cancelled);
  documentExperts = expertsData.experts || [];
}
function documentFieldId(name) { return `document-field-${name}`; }
function documentFieldHtml(field) {
  const [name, title, kind, required, initial] = field;
  const req = required ? " required" : "";
  const value = Array.isArray(initial) ? "" : (initial ?? "");
  if (kind === "textarea") return `<label>${escapeHtml(title)}<textarea id="${documentFieldId(name)}" data-document-field="${name}" rows="3"${req}>${escapeHtml(value)}</textarea></label>`;
  if (kind === "list") {
    const values = Array.isArray(initial) && initial.length ? initial : [""];
    return `<fieldset class="document-list" data-document-list="${name}"><legend>${escapeHtml(title)}${required ? " *" : ""}</legend><div class="document-list-rows">${values.map((v) => documentListRow(v)).join("")}</div><button type="button" class="secondary document-list-add">+ Добавить строку</button></fieldset>`;
  }
  if (kind === "expert-single" || kind === "expert-multi") {
    const options = documentExperts.map((x) => `<option value="${escapeHtml(x.path)}">${escapeHtml(x.name)}</option>`).join("");
    if (kind === "expert-multi") return `<fieldset class="document-expert-picker" data-document-field="${name}" data-kind="expert-multi"><legend>${escapeHtml(title)}${required ? " *" : ""}</legend>${documentExperts.map((x) => `<label><input type="checkbox" value="${escapeHtml(x.path)}"><span>${escapeHtml(x.name)}</span></label>`).join("")}</fieldset>`;
    return `<label>${escapeHtml(title)}<select id="${documentFieldId(name)}" data-document-field="${name}" data-kind="${kind}"${req}><option value="">Выберите…</option>${options}</select></label>`;
  }
  if (kind === "files") return `<label>${escapeHtml(title)}<input id="${documentFieldId(name)}" data-document-field="${name}" data-kind="files" type="file" accept="image/jpeg,image/png" multiple${req}><span class="field-hint">Фотографии JPEG или PNG будут добавлены в приложение № 2.</span></label>`;
  return `<label>${escapeHtml(title)}<input id="${documentFieldId(name)}" data-document-field="${name}" type="${kind === "number" ? "number" : kind === "date" ? "date" : "text"}" value="${escapeHtml(value)}"${kind === "number" ? ' step="any"' : ""}${req}></label>`;
}
function documentListRow(value = "") {
  return `<div class="document-list-row"><textarea rows="2">${escapeHtml(value)}</textarea><span class="document-list-move"><button type="button" data-list-up title="Выше">↑</button><button type="button" data-list-down title="Ниже">↓</button><button type="button" data-list-remove title="Удалить">×</button></span></div>`;
}
function wireDocumentLists() {
  documentUi.fields.querySelectorAll(".document-list").forEach((box) => {
    const rows = box.querySelector(".document-list-rows");
    const add = box.querySelector(".document-list-add");
    if (!add.dataset.wired) {
      add.dataset.wired = "1";
      add.addEventListener("click", () => {
        rows.insertAdjacentHTML("beforeend", documentListRow()); wireDocumentLists();
        rows.lastElementChild.querySelector("textarea").focus();
      });
    }
    rows.querySelectorAll(".document-list-row").forEach((row) => {
      const up = row.querySelector("[data-list-up]"), down = row.querySelector("[data-list-down]"), remove = row.querySelector("[data-list-remove]");
      up.onclick = () => row.previousElementSibling && rows.insertBefore(row, row.previousElementSibling);
      down.onclick = () => row.nextElementSibling && rows.insertBefore(row.nextElementSibling, row);
      remove.onclick = () => { if (rows.children.length > 1) row.remove(); else row.querySelector("textarea").value = ""; };
    });
  });
}
async function openDocumentForm(typeId) {
  try {
    const items = await loadDocumentCatalog();
    documentCurrentType = items.find((x) => x.id === typeId);
    if (!documentCurrentType) throw new Error("Неизвестный вид документа");
    await loadDocumentSources();
    documentUi.form.reset(); documentUi.error.textContent = "";
    documentUi.title.textContent = documentCurrentType.title;
    documentUi.cases.innerHTML = '<option value="">Выберите проект…</option>' + documentCases
      .map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
    documentUi.newProject.classList.toggle("hidden", !documentCurrentType.allowNewProject);
    const samples = await apiFetch(`/api/documents/templates/${encodeURIComponent(typeId)}`);
    documentUi.templates.innerHTML = samples.items.map((x) => `<option value="${escapeHtml(x.id)}"${x.id === samples.defaultId ? " selected" : ""}>${escapeHtml(x.name)}</option>`).join("");
    documentUi.fields.innerHTML = documentCurrentType.fields.map(documentFieldHtml).join("");
    wireDocumentLists();
    documentUi.overlay.classList.remove("hidden");
  } catch (err) { alert("Не удалось открыть форму: " + err.message); }
}
function fillDocumentFromCase() {
  const kase = documentCases.find((x) => String(x.id) === documentUi.cases.value);
  if (!kase) return;
  const values = {
    court: kase.court_or_customer || "", caseNumber: kase.case_number || "", judge: kase.judge_name || "",
    expertiseType: kase.expertise_type || "",
    orderReference: `определением ${kase.judge_name || "судьи"} ${kase.court_or_customer || "суда"} по делу № ${kase.case_number || ""}`,
  };
  for (const [name, value] of Object.entries(values)) {
    const input = document.getElementById(documentFieldId(name));
    if (input && !input.value) input.value = value;
  }
}
if (documentUi.cases) documentUi.cases.addEventListener("change", fillDocumentFromCase);
if (documentUi.close) documentUi.close.addEventListener("click", () => documentUi.overlay.classList.add("hidden"));

function collectDocumentData() {
  const data = { caseId: documentUi.cases.value, templateId: documentUi.templates.value };
  documentUi.fields.querySelectorAll("[data-document-field]").forEach((input) => {
    const name = input.dataset.documentField;
    if (input.dataset.kind === "files") return;
    if (input.dataset.kind === "expert-multi") data[name] = [...input.querySelectorAll('input[type="checkbox"]:checked')].map((x) => x.value);
    else data[name] = input.value.trim();
  });
  documentUi.fields.querySelectorAll("[data-document-list]").forEach((box) => {
    data[box.dataset.documentList] = [...box.querySelectorAll("textarea")].map((x) => x.value.trim()).filter(Boolean);
  });
  return data;
}
async function ensureRefusalProject(data) {
  if (data.caseId || !documentCurrentType.allowNewProject) return;
  const raw = documentUi.newProjectName.value.trim();
  if (!raw) throw new Error("Выберите проект или укажите название нового проекта");
  const name = raw.startsWith("ЭКС.") ? raw : `ЭКС.${raw}`;
  const created = await apiFetch("/api/cases", { method: "POST", body: JSON.stringify({
    type: "expertise", stage: "plan", name, direct_assignment: false,
    case_number: data.caseNumber || null, court_or_customer: data.recipientOrganization || null,
  }) });
  data.caseId = String(created.id);
}
if (documentUi.form) documentUi.form.addEventListener("submit", async (event) => {
  event.preventDefault(); documentUi.error.textContent = "";
  const button = documentUi.form.querySelector('button[type="submit"]');
  button.disabled = true; button.textContent = "Собираем…";
  try {
    const data = collectDocumentData();
    await ensureRefusalProject(data);
    if (!data.caseId) throw new Error("Выберите проект");
    const body = new FormData(); body.append("payload", JSON.stringify(data));
    documentUi.fields.querySelectorAll('input[type="file"]').forEach((input) => {
      for (const file of input.files || []) body.append("attachments", file, file.name);
    });
    const response = await fetch(`/api/documents/${encodeURIComponent(documentCurrentType.id)}/preview`, { method: "POST", body, credentials: "same-origin" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || `HTTP ${response.status}`);
    documentUi.overlay.classList.add("hidden");
    await openDocumentPreview(result);
  } catch (err) { documentUi.error.textContent = err.message; }
  finally { button.disabled = false; button.textContent = "Предпросмотр"; }
});

async function openDocumentPreview(draft) {
  documentDraft = draft;
  documentUi.previewTitle.textContent = draft.fileName;
  documentUi.previewMount.innerHTML = '<div class="empty-hint" style="padding:24px">Открываем редактор…</div>';
  documentUi.preview.classList.remove("hidden"); document.body.classList.add("no-scroll");
  try {
    const { config, scriptUrl } = await apiFetch(`/api/documents/preview/${encodeURIComponent(draft.draftId)}/editor`);
    if (!window.DocsAPI) await loadExternalScript(scriptUrl);
    documentUi.previewMount.innerHTML = '<div id="documentPreviewEditor"></div>';
    documentEditor = new window.DocsAPI.DocEditor("documentPreviewEditor", config);
  } catch (err) { documentUi.previewMount.innerHTML = `<div class="empty-hint">${escapeHtml(err.message)}</div>`; }
}
function destroyDocumentEditor() {
  if (documentEditor?.destroyEditor) try { documentEditor.destroyEditor(); } catch { /* закрыт */ }
  documentEditor = null; documentUi.previewMount.innerHTML = "";
}
if (documentUi.previewBack) documentUi.previewBack.addEventListener("click", async () => {
  destroyDocumentEditor(); documentUi.preview.classList.add("hidden"); document.body.classList.remove("no-scroll");
  if (documentDraft) {
    await new Promise((resolve) => setTimeout(resolve, 900));
    apiFetch(`/api/documents/preview/${encodeURIComponent(documentDraft.draftId)}`, { method: "DELETE" }).catch(() => {});
    documentDraft = null;
  }
  documentUi.overlay.classList.remove("hidden");
});
if (documentUi.previewSave) documentUi.previewSave.addEventListener("click", async () => {
  if (!documentDraft) return;
  documentUi.previewSave.disabled = true; documentUi.previewSave.textContent = "Сохраняем…";
  try {
    // OnlyOffice отправляет последнюю правку при закрытии редактора.
    destroyDocumentEditor();
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const saved = await apiFetch(`/api/documents/preview/${encodeURIComponent(documentDraft.draftId)}/save`, { method: "POST", body: "{}" });
    documentUi.preview.classList.add("hidden"); document.body.classList.remove("no-scroll");
    showToast(`Документ «${saved.name}» сохранён`); documentDraft = null;
  } catch (err) { alert("Не удалось сохранить документ: " + err.message); }
  finally { documentUi.previewSave.disabled = false; documentUi.previewSave.textContent = "Сохранить в дело"; }
});

// Заголовок колонки открывает её корень обычной папкой. Своих кнопок
// «Создать» у колонок больше нет — она одна, в левой панели, и кладёт
// туда, где человек стоит. Значит к корню раздела нужен способ встать:
// зашли в «Дела» — и «Создать» создаёт в «Делах».
document.querySelectorAll("[data-open-root]").forEach((title) => {
  title.addEventListener("click", () => {
    const isDb = title.dataset.openRoot === "db";
    const path = isDb ? DB_PATH : CASES_PATH;
    const label = isDb ? "База данных" : "Дела";
    goToFolder(path, [{ label, path }], true);
  });
});

// Куда класть выбранные файлы и что обновить после загрузки. Диалог выбора
// файлов открывается из разных мест, поэтому цель запоминаем явно.
let uploadTarget = null;

function pickFilesFor(path, refresh) {
  uploadTarget = { path, refresh };
  els.uploadInput.click();
}


/* ============================================================
   Настройки (только администратор).

   Две вкладки: сотрудники и связь с Planfix. Раньше сотрудники жили в
   отдельном окне, которое открывалось по нажатию на свой аватар, —
   место неочевидное, и половина того, что там правится, к своему
   профилю отношения не имела. Теперь всё управление людьми здесь.

   Список слева перерисовывается ОТДЕЛЬНО от правой части: щелчок по
   человеку меняет только подсветку и подробности. Раньше на каждый
   щелчок пересобирался весь экран, и любая заминка сервера оставляла
   его в подвешенном состоянии — со стороны это выглядело как
   «переключается только первый».
   ============================================================ */

let settingsTab = "people";
// Кого сейчас смотрим. null означает «показываем форму добавления».
let accessUserId = null;
let addingUser = false;
// Последний загруженный список — чтобы перерисовать подсветку, не
// ходя на сервер ещё раз.
let peopleCache = [];

const SECTION_RIGHTS = [
  ["can_cases", "Дела", "Проекты, задачи, журнал регистрации"],
  ["can_db", "База данных", "Файлы, эксперты, оборудование"],
  ["can_tools", "Инструменты", "Служебный раздел"],
  ["can_manage", "Руководитель центра", "Ведёт производственный календарь и утверждает решения по заседаниям"],
];

/* Кто попадает в выпадающие списки журнала регистрации.

   Это не право, а роль в проектах: человек может иметь полный доступ к
   «Делам» и при этом не значиться ни руководителем проектов, ни
   специалистом.

   Живут эти две галочки на вкладке «Справочники», в общей таблице, а не
   в карточке каждого человека. Причина простая: решение это не про
   одного, а про всех сразу — «кто у нас вообще руководители». В карточке
   пришлось бы обойти шестерых, чтобы просто увидеть список. */
const JOURNAL_ROLES = [
  ["can_be_manager", "Руководитель проекта"],
  ["can_be_expert", "Специалист / эксперт"],
];

const ACCESS_LABEL = { read: "Только смотреть", write: "Смотреть и менять", none: "Закрыто" };

const settingsPane = () => document.getElementById("settingsPane");

/** Показать человеку, что пошло не так, вместо молчаливого бездействия. */
function settingsError(err) {
  showToast(err && err.message ? err.message : "Не получилось");
}

async function loadSettings() {
  document.querySelectorAll(".settings-tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === settingsTab);
  });
  const pane = settingsPane();
  pane.innerHTML = '<div class="empty-hint">Загрузка…</div>';
  try {
    if (settingsTab === "people") await renderPeopleTab();
    else if (settingsTab === "lists") await renderListsTab();
    else if (settingsTab === "template") await renderTemplateTab();
    else await renderPlanfixTab();
  } catch (err) {
    pane.innerHTML = `<div class="empty-hint">${escapeHtml(err.message)}</div>`;
  }
}

document.querySelectorAll(".settings-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    settingsTab = btn.dataset.tab;
    loadSettings();
  });
});

/* ---------- Вкладка «Сотрудники» ---------- */

/** Рисует каркас вкладки один раз: список слева, подробности справа. */
async function renderPeopleTab() {
  settingsPane().innerHTML = `
    <div class="access-layout">
      <div class="access-side">
        <div class="access-people" id="accessPeople"></div>
        <button type="button" class="access-add" id="accessAddBtn">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Добавить сотрудника
        </button>
      </div>
      <div class="access-detail" id="accessDetail"><div class="empty-hint">Загрузка…</div></div>
    </div>`;

  // Щелчки ловим на всём списке разом, а не вешаем обработчик на каждую
  // строку: список перерисовывается, и обработчики на строках после
  // перерисовки терялись бы.
  document.getElementById("accessPeople").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-person]");
    if (!btn) return;
    addingUser = false;
    accessUserId = Number(btn.dataset.person);
    markSelectedPerson();
    showPersonDetail(accessUserId).catch(settingsError);
  });

  document.getElementById("accessAddBtn").addEventListener("click", () => {
    addingUser = true;
    accessUserId = null;
    markSelectedPerson();
    renderAddPersonForm();
  });

  await reloadPeople();
}

/** Перечитывает список людей с сервера и рисует его. */
async function reloadPeople() {
  const { users: list } = await apiFetch("/api/admin/access");
  peopleCache = list;
  if (!addingUser && !list.some((u) => u.id === accessUserId)) {
    accessUserId = (list.find((u) => u.role !== "admin") || list[0] || {}).id || null;
  }
  drawPeopleList();
  if (addingUser) renderAddPersonForm();
  else if (accessUserId) await showPersonDetail(accessUserId);
}

function drawPeopleList() {
  document.getElementById("accessPeople").innerHTML = peopleCache.map((u) => `
    <button type="button" class="access-person" data-person="${u.id}">
      <span class="access-person-name">${escapeHtml(u.name)}</span>
      <span class="access-person-sub">${u.role === "admin"
        ? "администратор — видит всё"
        : sectionSummary(u) + (u.folder_rules ? ` · папок: ${u.folder_rules}` : "")}</span>
    </button>`).join("");
  markSelectedPerson();
}

/** Подсветка выбранного — отдельно от отрисовки: щелчок отзывается сразу. */
function markSelectedPerson() {
  document.querySelectorAll("#accessPeople [data-person]").forEach((b) => {
    b.classList.toggle("on", !addingUser && Number(b.dataset.person) === accessUserId);
  });
  const add = document.getElementById("accessAddBtn");
  if (add) add.classList.toggle("on", addingUser);
}

/** Короткая строка «что открыто» для списка слева. */
function sectionSummary(u) {
  const open = SECTION_RIGHTS.filter(([key]) => u[key]).map(([, label]) => label);
  return open.length ? open.join(", ") : "ничего не открыто";
}

async function showPersonDetail(userId) {
  const box = document.getElementById("accessDetail");
  box.innerHTML = '<div class="empty-hint">Загрузка…</div>';
  const { user, rules } = await apiFetch(`/api/admin/access/${userId}`);
  // Пока грузили, могли выбрать другого — тогда рисовать поздно.
  if (accessUserId !== userId || addingUser) return;
  const isAdmin = user.role === "admin";
  const isMe = currentUser && currentUser.id === user.id;

  box.innerHTML = `
    <div class="access-head">
      <h2 class="access-title">${escapeHtml(user.name)}</h2>
      <label class="settings-inline">Роль
        <select data-role ${isMe ? "disabled" : ""}>
          <option value="employee"${!isAdmin ? " selected" : ""}>Сотрудник</option>
          <option value="admin"${isAdmin ? " selected" : ""}>Администратор</option>
        </select>
      </label>
    </div>
    ${isMe ? '<p class="access-note">Это вы. Свою роль менять нельзя — иначе можно остаться без администратора вовсе.</p>' : ""}
    ${isAdmin && !isMe ? '<p class="access-note">Администратор видит всё и правит всё: отдельные правила на него не действуют.</p>' : ""}

    <h3 class="access-sub">Разделы</h3>
    <div class="access-rights">
      ${SECTION_RIGHTS.map(([key, label, hint]) => `
        <label class="access-right">
          <input type="checkbox" data-right="${key}" ${user[key] ? "checked" : ""} ${isAdmin ? "disabled" : ""}>
          <span><b>${label}</b><br><span class="access-hint">${escapeHtml(hint)}</span></span>
        </label>`).join("")}
    </div>

    <h3 class="access-sub">Папки в «Делах»</h3>
    ${isAdmin
      ? '<p class="access-note">Администратору правила по папкам не нужны: он видит все.</p>'
      : rules.length
        ? `<table class="access-rules">
             <thead><tr><th>Папка</th><th>Доступ</th><th></th></tr></thead>
             <tbody>${rules.map((r) => `
               <tr>
                 <td class="access-path">${escapeHtml(prettyPath(r.path))}</td>
                 <td>
                   <select data-rule="${r.id}" data-rule-path="${escapeHtml(r.path)}">
                     ${["read", "write", "none"].map((a) =>
                       `<option value="${a}"${r.access === a ? " selected" : ""}>${ACCESS_LABEL[a]}</option>`).join("")}
                   </select>
                 </td>
                 <td><button type="button" class="link-btn" data-drop-rule="${r.id}">Убрать</button></td>
               </tr>`).join("")}</tbody>
           </table>
           <p class="access-note">«Закрыто» — запрет, который перебивает доступ к папке выше.
           «Убрать» снимает правило: тогда действует то, что задано у родительской папки.</p>`
        : `<p class="access-note">Своих правил нет: в «Делах» этот сотрудник видит только то,
           что открыто всем. Правила заводятся в самой папке: «Дела» → «…» у строки →
           «Доступ к папке».</p>`}

    <h3 class="access-sub">Имя</h3>
    <div class="settings-row">
      <input type="text" data-new-name value="${escapeHtml(user.name)}" autocomplete="off">
      <button type="button" class="upload-btn" data-set-name>Сменить имя</button>
    </div>
    <p class="access-note">Так человека зовут: это имя видят все и везде — в журнале
    регистрации, в задачах, в «Учёте оборудования». Имена не должны повторяться: в
    проектах специалисты записаны именами, и двух одинаковых там не различить.</p>

    <h3 class="access-sub">Логин и пароль</h3>
    <div class="settings-row">
      <input type="text" data-new-login value="${escapeHtml(user.username)}" autocomplete="off" spellcheck="false">
      <button type="button" class="upload-btn" data-set-login>Сменить логин</button>
    </div>
    <p class="access-note">Логин человек набирает при входе, один на все три системы.
    Больше он нигде не показывается — знаете его только вы и сам хозяин учётной записи.
    После смены входить надо новым: предупредите его.</p>
    <div class="settings-row">
      <input type="text" data-new-password placeholder="Новый пароль" autocomplete="off">
      <button type="button" class="upload-btn" data-set-password>Сменить пароль</button>
    </div>
    ${isMe
      ? '<p class="access-note">Удалить себя нельзя.</p>'
      : `<p class="access-note">Удаление необратимо: приборы, которые числились за
         сотрудником, освободятся, а его правила доступа исчезнут.</p>
         <button type="button" class="link-btn" data-delete-person>Удалить сотрудника</button>`}`;

  wirePersonDetail(box, user, isAdmin, isMe);
}

function wirePersonDetail(box, user, isAdmin, isMe) {
  const roleSelect = box.querySelector("[data-role]");
  if (roleSelect && !isMe) {
    roleSelect.addEventListener("change", async () => {
      try {
        await apiFetch(`/api/users/${user.id}`, {
          method: "PATCH", body: JSON.stringify({ role: roleSelect.value }),
        });
        showToast("Роль изменена");
        await reloadPeople();
      } catch (err) {
        roleSelect.value = isAdmin ? "admin" : "employee";
        settingsError(err);
      }
    });
  }

  box.querySelectorAll("[data-right]").forEach((input) => {
    input.addEventListener("change", async () => {
      try {
        await apiFetch(`/api/users/${user.id}`, {
          method: "PATCH",
          body: JSON.stringify({ [input.dataset.right]: input.checked }),
        });
        // Себе поменяли право — интерфейс должен это сразу учесть.
        if (currentUser && currentUser.id === user.id) {
          currentUser[input.dataset.right] = input.checked;
          applyPermissionsUI();
        }
        // Перерисовываем только список: подпись под именем изменилась.
        const { users: list } = await apiFetch("/api/admin/access");
        peopleCache = list;
        drawPeopleList();
      } catch (err) {
        input.checked = !input.checked;
        settingsError(err);
      }
    });
  });

  box.querySelectorAll("[data-rule]").forEach((select) => {
    select.addEventListener("change", async () => {
      try {
        await apiFetch("/api/folder-permissions", {
          method: "POST",
          body: JSON.stringify({
            path: select.dataset.rulePath, userId: user.id, access: select.value,
          }),
        });
        showToast("Доступ изменён");
      } catch (err) {
        settingsError(err);
        showPersonDetail(user.id).catch(settingsError);
      }
    });
  });

  box.querySelectorAll("[data-drop-rule]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await apiFetch(`/api/folder-permissions/${btn.dataset.dropRule}`, { method: "DELETE" });
        showToast("Правило убрано");
        await reloadPeople();
      } catch (err) {
        settingsError(err);
      }
    });
  });

  const nameBtn = box.querySelector("[data-set-name]");
  if (nameBtn) {
    nameBtn.addEventListener("click", async () => {
      const field = box.querySelector("[data-new-name]");
      const full_name = field.value.trim();
      if (!full_name) return showToast("Имя не может быть пустым");
      if (full_name === user.name) return showToast("Имя то же самое — менять нечего");
      try {
        const res = await apiFetch(`/api/users/${user.id}`, {
          method: "PATCH", body: JSON.stringify({ full_name }),
        });
        // В проектах специалисты записаны именами, и их пришлось
        // переписать. Говорим, сколько: человек должен видеть, что
        // правка задела не только эту карточку.
        const fixed = res && res.renamed ? res.renamed.cases : 0;
        showToast(fixed ? `Имя изменено, поправлено проектов: ${fixed}` : "Имя изменено");
        if (currentUser && currentUser.id === user.id) {
          currentUser.name = full_name;
          renderProfileCard();
        }
        forgetLookups();
        accessUserId = user.id;
        await reloadPeople();
      } catch (err) {
        field.value = user.name;
        settingsError(err);
      }
    });
  }

  const loginBtn = box.querySelector("[data-set-login]");
  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      const field = box.querySelector("[data-new-login]");
      const username = field.value.trim();
      if (!username) return showToast("Логин не может быть пустым");
      if (username === user.username) return showToast("Логин тот же самый — менять нечего");
      if (!confirm(`Сменить логин «${user.username}» на «${username}»?\n\n` +
        "Входить он будет уже новым. Скажите ему об этом.")) return;
      try {
        await apiFetch(`/api/users/${user.id}`, {
          method: "PATCH", body: JSON.stringify({ username }),
        });
        showToast("Логин изменён");
        if (currentUser && currentUser.id === user.id) currentUser.username = username;
        accessUserId = user.id;
        await reloadPeople();
      } catch (err) {
        field.value = user.username;
        settingsError(err);
      }
    });
  }

  const passBtn = box.querySelector("[data-set-password]");
  if (passBtn) {
    passBtn.addEventListener("click", async () => {
      const field = box.querySelector("[data-new-password]");
      const password = field.value.trim();
      if (password.length < 8) return showToast("Пароль короче восьми знаков — так нельзя");
      try {
        await apiFetch(`/api/users/${user.id}`, {
          method: "PATCH", body: JSON.stringify({ password }),
        });
        field.value = "";
        showToast("Пароль изменён");
      } catch (err) {
        settingsError(err);
      }
    });
  }

  const delBtn = box.querySelector("[data-delete-person]");
  if (delBtn) {
    delBtn.addEventListener("click", async () => {
      if (!confirm(`Удалить сотрудника «${user.name}»? Это необратимо.`)) return;
      try {
        await apiFetch(`/api/users/${user.id}`, { method: "DELETE" });
        showToast("Сотрудник удалён");
        accessUserId = null;
        await reloadPeople();
      } catch (err) {
        settingsError(err);
      }
    });
  }
}

/** Форма нового сотрудника — в той же правой части, а не отдельным окном. */
function renderAddPersonForm() {
  const box = document.getElementById("accessDetail");
  box.innerHTML = `
    <h2 class="access-title">Новый сотрудник</h2>
    <p class="access-note">Учётная запись общая для всех трёх систем: с этим логином
    человек войдёт и в ИСУ, и в «Учёт оборудования», и в «Календарь».</p>
    <form class="settings-form" id="addPersonForm">
      <label class="settings-field">
        <span class="settings-label">Имя</span>
        <input name="full_name" autocomplete="off" required>
        <span class="settings-hint">Как человека зовут. Это имя увидят все.</span>
      </label>
      <label class="settings-field">
        <span class="settings-label">Логин</span>
        <input name="username" autocomplete="off" required>
        <span class="settings-hint">Что он набирает при входе. Больше нигде не показывается.</span>
      </label>
      <label class="settings-field">
        <span class="settings-label">Пароль</span>
        <input name="password" type="text" autocomplete="off" required>
        <span class="settings-hint">Не короче восьми знаков. Показан открыто нарочно:
        его надо передать человеку, а не запомнить самому.</span>
      </label>
      <label class="settings-field">
        <span class="settings-label">Роль</span>
        <select name="role">
          <option value="employee">Сотрудник</option>
          <option value="admin">Администратор</option>
        </select>
      </label>
      <div>
        <span class="settings-label">Разделы</span>
        <div class="access-rights" style="margin-top:8px;">
          ${SECTION_RIGHTS.map(([key, label, hint]) => `
            <label class="access-right">
              <input type="checkbox" name="${key}" ${key === "can_manage" ? "" : "checked"}>
              <span><b>${escapeHtml(label)}</b><br><span class="access-hint">${escapeHtml(hint)}</span></span>
            </label>`).join("")}
        </div>
      </div>
      <div class="settings-actions">
        <button class="primary" type="submit">Создать</button>
        <button class="upload-btn" type="button" id="addPersonCancel">Отмена</button>
      </div>
    </form>`;

  document.getElementById("addPersonCancel").addEventListener("click", () => {
    addingUser = false;
    markSelectedPerson();
    if (accessUserId) showPersonDetail(accessUserId).catch(settingsError);
    else reloadPeople().catch(settingsError);
  });

  document.getElementById("addPersonForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const username = form.username.value.trim();
    const full_name = form.full_name.value.trim();
    const password = form.password.value;
    if (!full_name) return showToast("Укажите имя");
    if (!username) return showToast("Укажите логин");
    if (password.length < 8) return showToast("Пароль короче восьми знаков — так нельзя");
    try {
      const created = await apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify({
          username, full_name, password, role: form.role.value,
          can_tools: form.can_tools.checked,
          can_db: form.can_db.checked,
          can_cases: form.can_cases.checked,
          can_manage: form.can_manage.checked,
        }),
      });
      showToast("Сотрудник заведён");
      addingUser = false;
      accessUserId = created && created.user ? created.user.id : null;
      await reloadPeople();
    } catch (err) {
      settingsError(err);
    }
  });
}


/* ---------- Вкладка «Справочники» ----------

   Три списка, из которых выбирают в журнале регистрации. Раньше эти
   поля вписывали руками, и «строительно-техническая» соседствовала со
   «Строительно-технической» — для человека одно и то же, для фильтра и
   выгрузки три разных проекта.

   «Тип проекта» сюда не вынесен нарочно: его три значения — не названия,
   а поведение. От них зависит, какие папки заводятся под проект, в какую
   группу он уходит в Planfix и какие задачи ставятся по стадиям. Тип,
   заведённый в справочнике, система просто не знала бы, как обслужить.

   Руководители и специалисты — четвёртым списком, только устроенным
   иначе: людей не заводят, они уже есть, отмечают лишь, кто в каком
   списке участвует. Держим их здесь, рядом с остальными списками
   журнала, а не в карточке каждого: «кто у нас руководители» — вопрос
   про всех разом, и отвечать на него, обходя карточки по одной, значит
   не иметь ответа вовсе. */

const LOOKUP_LISTS = [
  {
    kind: "organization", title: "Структура",
    hint: "Организации, от имени которых ведутся проекты.",
    placeholder: "Например: АО «НИЦ Строительство»",
  },
  {
    kind: "expertise_type", title: "Тип экспертизы",
    hint: "Виды экспертиз и исследований.",
    placeholder: "Например: строительно-техническая",
  },
  {
    kind: "year", title: "Год",
    hint: "Годы начала проектов. Четыре цифры.",
    placeholder: "2027",
  },
];

async function renderListsTab() {
  const [lists, people] = await Promise.all([
    apiFetch("/api/lookups"),
    apiFetch("/api/admin/access"),
  ]);
  const byKind = {
    organization: lists.organizations || [],
    expertise_type: lists.expertise_types || [],
    year: lists.years || [],
  };

  settingsPane().innerHTML = `
    <p class="access-note">Из этих списков выбирают в журнале регистрации и в карточке
    проекта. Вписать значение мимо списка нельзя — ни в журнале, ни через запрос.</p>

    <div class="lists-grid">
      ${LOOKUP_LISTS.map((list) => `
        <section class="settings-card lists-card">
          <h2 class="access-title">${escapeHtml(list.title)}</h2>
          <p class="access-note">${escapeHtml(list.hint)}</p>
          <div class="lists-values" data-values="${list.kind}">
            ${byKind[list.kind].length
              ? byKind[list.kind].map((v) => `
                <div class="lists-row">
                  <span>${escapeHtml(String(v))}</span>
                  <button type="button" class="link-btn" data-drop="${list.kind}"
                          data-value="${escapeHtml(String(v))}">Убрать</button>
                </div>`).join("")
              : '<p class="empty-hint">Список пуст</p>'}
          </div>
          <form class="settings-row" data-add="${list.kind}">
            <input type="text" placeholder="${escapeHtml(list.placeholder)}" autocomplete="off">
            <button class="primary" type="submit">Добавить</button>
          </form>
        </section>`).join("")}
    </div>

    <section class="settings-card" style="margin-top:20px;">
      <h2 class="access-title">Руководители и специалисты</h2>
      <p class="access-note">Кто попадает в выпадающие списки журнала. Отметьте галочкой —
      сохраняется сразу, отдельной кнопки нет. Снятая галочка убирает человека из списка,
      но там, где он уже записан, он остаётся: проекты задним числом не переписываются.</p>
      <table class="access-rules roles-table">
        <thead><tr><th>Сотрудник</th>${JOURNAL_ROLES.map(([, label]) =>
          `<th>${escapeHtml(label)}</th>`).join("")}</tr></thead>
        <tbody>${(people.users || []).map((u) => `
          <tr>
            <td class="access-path">${escapeHtml(u.name)}</td>
            ${JOURNAL_ROLES.map(([key, label]) => `
              <td class="roles-cell">
                <label class="roles-box">
                  <input type="checkbox" data-journal-role="${key}" data-user="${u.id}"
                         ${u[key] ? "checked" : ""}
                         aria-label="${escapeHtml(u.name)} — ${escapeHtml(label)}">
                  <span></span>
                </label>
              </td>`).join("")}
          </tr>`).join("")}</tbody>
      </table>
    </section>`;

  // Галочки сохраняем поштучно: человек отмечает одного, а не заполняет
  // всю таблицу и жмёт «Сохранить». Сорвалось — галочку возвращаем на
  // место, чтобы на экране не осталось то, чего нет в базе.
  settingsPane().querySelectorAll("[data-journal-role]").forEach((input) => {
    input.addEventListener("change", async () => {
      const { journalRole: key, user: userId } = input.dataset;
      try {
        await apiFetch(`/api/users/${userId}`, {
          method: "PATCH", body: JSON.stringify({ [key]: input.checked }),
        });
        // Журнал держит списки в памяти — иначе снятый человек остался
        // бы в выпадающем списке до перезагрузки страницы.
        forgetLookups();
      } catch (err) {
        input.checked = !input.checked;
        settingsError(err);
      }
    });
  });

  settingsPane().querySelectorAll("[data-add]").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = form.querySelector("input");
      const value = input.value.trim();
      if (!value) return;
      try {
        if (form.dataset.add === "organization") {
          await apiFetch("/api/organizations", { method: "POST", body: JSON.stringify({ name: value }) });
        } else {
          await apiFetch("/api/admin/lookups", {
            method: "POST", body: JSON.stringify({ kind: form.dataset.add, value }),
          });
        }
        input.value = "";
        forgetLookups();
        showToast("Добавлено");
        renderListsTab();
      } catch (err) {
        settingsError(err);
      }
    });
  });

  settingsPane().querySelectorAll("[data-drop]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const { drop: kind, value } = btn.dataset;
      if (!confirm(`Убрать «${value}» из списка?`)) return;
      try {
        if (kind === "organization") {
          await apiFetch(`/api/organizations/${encodeURIComponent(value)}`, { method: "DELETE" });
        } else {
          await apiFetch(`/api/admin/lookups?kind=${kind}&value=${encodeURIComponent(value)}`,
            { method: "DELETE" });
        }
        forgetLookups();
        showToast("Убрано");
        renderListsTab();
      } catch (err) {
        // Значение занято проектами — сервер объясняет, сколькими.
        settingsError(err);
      }
    });
  });
}

/* ---------- Вкладка «Связь с Planfix» ---------- */

const ORIGIN_NOTE = {
  panel: "задан здесь",
  env: "задан при развёртывании",
  // Про «не задан» скажет само поле — подписывать это ещё и сверху
  // значит написать одно и то же дважды подряд.
  default: "",
};

/* ---------- Вкладка «Шаблоны документов» ----------

   Письма похожи, но не одинаковы: одному делу нужно письмо с
   приложением, другому короче и без стоимости. Поэтому образцов
   несколько, и при создании ГП выбирают, по какому собрать.

   Редактор открывается НА ВЕСЬ ЭКРАН, а не окошком внутри вкладки:
   правя страницу письма в щели высотой в треть экрана, ошибиться
   проще, чем не ошибиться.

   Метки вида {{CASE_NUMBER}} — места, куда подставляются данные. Убрал
   метку — письмо перестало собираться, поэтому состояние каждого
   образца видно сразу, а не в день отправки в суд. */

let gpTemplateEditor = null;
let gpTemplateState = { items: [], defaultId: null, max: 5 };
let settingsTemplateType = "gp";
let settingsTemplateTitle = "Гарантийное письмо";

function templateAdminBase() {
  return settingsTemplateType === "gp"
    ? "/api/admin/gp-templates"
    : `/api/admin/document-templates/${encodeURIComponent(settingsTemplateType)}`;
}

async function renderTemplateTab() {
  const catalog = await loadDocumentCatalog();
  const choices = [{ id: "gp", title: "Гарантийное письмо" }, ...catalog.map((x) => ({ id: x.id, title: x.title }))];
  const selected = choices.find((x) => x.id === settingsTemplateType) || choices[0];
  settingsTemplateType = selected.id; settingsTemplateTitle = selected.title;
  const data = await apiFetch(templateAdminBase());
  gpTemplateState = data;
  const left = data.max - data.items.length;

  settingsPane().innerHTML = `
    <label class="settings-field template-type-picker"><span class="settings-label">Вид документа</span>
      <select id="settingsTemplateType">${choices.map((x) => `<option value="${escapeHtml(x.id)}"${x.id === settingsTemplateType ? " selected" : ""}>${escapeHtml(x.title)}</option>`).join("")}</select>
    </label>
    <p class="access-note">Образец — это сам файл документа. Он правится как обычный документ Word:
    текст, отступы, колонтитулы. Сохранение в редакторе сразу становится новым образцом.
    При создании документа выбирают, по какому образцу его собрать.</p>

    <div class="row-between">
      <b>${escapeHtml(settingsTemplateTitle)}</b>
      <span class="access-hint">Занято ${data.items.length} из ${data.max}</span>
    </div>

    <div class="tpl-samples">
      ${data.items.map((item) => tplSampleHtml(item)).join("")}
    </div>

    <div class="settings-row" style="margin-top:12px;">
      <button type="button" class="upload-btn" id="tplAdd" ${left ? "" : "disabled"}>
        + Добавить образец${left ? ` (осталось ${left})` : " — больше пяти не бывает"}
      </button>
    </div>

    <p class="access-note">Заводить, править, скачивать и удалять образцы может только
    администратор. Выбирать образец при создании письма — любой, кто письмо создаёт.</p>

    ${settingsTemplateType === "gp" ? `<details class="tpl-tokens">
      <summary>Что такое метки и какие бывают</summary>
      <p class="access-note">Метка — место, куда система подставляет данные проекта. Её текст
      менять нельзя, а вот двигать, переносить в другое место письма и оформлять — можно.</p>
      <table class="access-rules">
        <thead><tr><th>Метка</th><th>Что подставляется</th></tr></thead>
        <tbody>${[...(data.required || []), ...(data.optional || [])].map((r) => `
          <tr><td class="access-path">${escapeHtml(r.token)}</td><td>${escapeHtml(r.what)}</td></tr>`).join("")}
        </tbody>
      </table>
    </details>` : ""}`;

  wireTemplateTab();
  document.getElementById("settingsTemplateType").addEventListener("change", (event) => {
    settingsTemplateType = event.target.value;
    renderTemplateTab().catch(settingsError);
  });
}

function tplSampleHtml(item) {
  const state = item.state || {};
  const problem = state.broken
    ? "файл повреждён"
    : !state.ok
      ? `нет меток: ${state.missing.map((m) => m.token).join(", ")}`
      : "";
  return `
    <section class="tpl-sample${item.isDefault ? " on" : ""}${problem ? " bad" : ""}" data-tpl="${escapeHtml(item.id)}">
      <div class="tpl-sample-head">
        <span class="tpl-name">${escapeHtml(item.name)}</span>
        ${item.isDefault ? '<span class="tpl-badge">Основной</span>' : ""}
        <span class="access-hint">${item.updatedAt
          ? "правлено " + new Date(item.updatedAt).toLocaleDateString("ru-RU")
          : ""}</span>
      </div>
      ${problem
        ? `<p class="tpl-bad-note">Письмо по этому образцу не соберётся: ${escapeHtml(problem)}.</p>`
        : '<p class="tpl-ok-note">Все обязательные метки на месте.</p>'}
      <div class="settings-row tpl-actions">
        <button type="button" class="primary" data-tpl-open="${escapeHtml(item.id)}">
          ⛶ Открыть во весь экран
        </button>
        <button type="button" class="upload-btn" data-tpl-download="${escapeHtml(item.id)}">Скачать</button>
        <button type="button" class="upload-btn" data-tpl-rename="${escapeHtml(item.id)}">Переименовать</button>
        ${item.isDefault ? "" : `<button type="button" class="upload-btn" data-tpl-default="${escapeHtml(item.id)}">Сделать основным</button>`}
        <button type="button" class="upload-btn" data-tpl-back="${escapeHtml(item.id)}" ${item.hasBackup ? "" : "disabled"}>
          Вернуть, как было до правки
        </button>
        <button type="button" class="link-btn" data-tpl-reset="${escapeHtml(item.id)}">Вернуть исходный</button>
        ${gpTemplateState.items.length > 1
          ? `<button type="button" class="link-btn" data-tpl-remove="${escapeHtml(item.id)}">Удалить образец</button>`
          : ""}
      </div>
    </section>`;
}

function wireTemplateTab() {
  const pane = settingsPane();
  const nameOf = (id) => (gpTemplateState.items.find((i) => i.id === id) || {}).name || "образец";

  pane.querySelectorAll("[data-tpl-open]").forEach((b) =>
    b.addEventListener("click", () => openTemplateFullscreen(b.dataset.tplOpen)));

  pane.querySelectorAll("[data-tpl-download]").forEach((b) =>
    b.addEventListener("click", () => {
      // Обычной ссылкой: файл отдаёт сервер, и проверку прав он делает сам.
      window.location.href = `${templateAdminBase()}/${encodeURIComponent(b.dataset.tplDownload)}/download`;
    }));

  pane.querySelectorAll("[data-tpl-rename]").forEach((b) =>
    b.addEventListener("click", async () => {
      const id = b.dataset.tplRename;
      const next = prompt("Название образца:", nameOf(id));
      if (next === null) return;
      await templateAction(`${templateAdminBase()}/${encodeURIComponent(id)}`,
        { method: "PATCH", body: JSON.stringify({ name: next }) }, "Переименовано");
    }));

  pane.querySelectorAll("[data-tpl-default]").forEach((b) =>
    b.addEventListener("click", () => templateAction(
      `${templateAdminBase()}/${encodeURIComponent(b.dataset.tplDefault)}`,
      { method: "PATCH", body: JSON.stringify({ isDefault: true }) },
      "Теперь этот образец предлагается первым")));

  pane.querySelectorAll("[data-tpl-back]").forEach((b) =>
    b.addEventListener("click", () => {
      if (!confirm(`Вернуть образец «${nameOf(b.dataset.tplBack)}» к тому, каким он был до последней правки?`)) return;
      templateAction(`${templateAdminBase()}/${encodeURIComponent(b.dataset.tplBack)}/reset`,
        { method: "POST", body: JSON.stringify({ to: "backup" }) }, "Вернули прежнюю правку");
    }));

  pane.querySelectorAll("[data-tpl-reset]").forEach((b) =>
    b.addEventListener("click", () => {
      if (!confirm(`Вернуть исходный вид образца «${nameOf(b.dataset.tplReset)}»?\n\n` +
        "Нынешний уйдёт в копию «до правки» — вернуться можно.")) return;
      templateAction(`${templateAdminBase()}/${encodeURIComponent(b.dataset.tplReset)}/reset`,
        { method: "POST", body: JSON.stringify({ to: "original" }) }, "Исходный образец возвращён");
    }));

  pane.querySelectorAll("[data-tpl-remove]").forEach((b) =>
    b.addEventListener("click", () => {
      if (!confirm(`Удалить образец «${nameOf(b.dataset.tplRemove)}»? Это необратимо.`)) return;
      templateAction(`${templateAdminBase()}/${encodeURIComponent(b.dataset.tplRemove)}`,
        { method: "DELETE" }, "Образец удалён");
    }));

  bind(document.getElementById("tplAdd"), "click", async () => {
    const name = prompt("Название нового образца:", "Новый образец");
    if (name === null) return;
    // Новый делаем копией основного: почти всегда его и хотят немного
    // переделать, а не писать письмо с нуля.
    await templateAction(templateAdminBase(),
      { method: "POST", body: JSON.stringify({ name, fromId: gpTemplateState.defaultId }) },
      "Образец заведён — откройте и поправьте");
  });
}

async function templateAction(url, options, okMessage) {
  try {
    await apiFetch(url, options);
    showToast(okMessage);
    forgetGpTemplates();
    await renderTemplateTab();
  } catch (err) {
    settingsError(err);
  }
}

/**
 * Редактор во весь экран.
 *
 * Раньше он жил окошком внутри вкладки, и это было неудобно: страница
 * письма в щели высотой в треть экрана. Теперь поверх всего, как
 * отдельное приложение, — и закрывается по Escape или кнопкой.
 */
async function openTemplateFullscreen(id) {
  const item = gpTemplateState.items.find((i) => i.id === id) || { name: "Образец" };
  const overlay = document.getElementById("tplFullscreen");
  document.getElementById("tplFullTitle").textContent =
    `${item.name} — ${settingsTemplateTitle}`;
  const mount = document.getElementById("tplFullMount");
  mount.innerHTML = '<div class="empty-hint" style="padding:24px;">Открываем редактор…</div>';
  overlay.classList.remove("hidden");
  document.body.classList.add("no-scroll");

  try {
    const { config, scriptUrl } = await apiFetch(
      `${templateAdminBase()}/${encodeURIComponent(id)}/editor`);
    if (!window.DocsAPI) await loadExternalScript(scriptUrl);
    mount.innerHTML = '<div id="tplFullEditor"></div>';
    gpTemplateEditor = new window.DocsAPI.DocEditor("tplFullEditor", config);
  } catch (err) {
    mount.innerHTML = `<div class="empty-hint" style="padding:24px;">
      Не удалось открыть редактор: ${escapeHtml(err.message)}.<br>
      Проверьте, что сервер документов (OnlyOffice) запущен.</div>`;
  }
}

function closeTemplateFullscreen() {
  const overlay = document.getElementById("tplFullscreen");
  if (!overlay || overlay.classList.contains("hidden")) return;
  // Закрываем редактор, а не просто прячем: незакрытый продолжает
  // держать документ и спорить за право сохранить со следующим.
  if (gpTemplateEditor && gpTemplateEditor.destroyEditor) {
    try { gpTemplateEditor.destroyEditor(); } catch (err) { /* уже закрыт */ }
  }
  gpTemplateEditor = null;
  overlay.classList.add("hidden");
  document.body.classList.remove("no-scroll");
  document.getElementById("tplFullMount").innerHTML = "";
  // Пока правили, метки могли пропасть — показываем состояние заново.
  forgetGpTemplates();
  if (settingsTab === "template") renderTemplateTab().catch(settingsError);
}

bind(document.getElementById("tplFullClose"), "click", closeTemplateFullscreen);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeTemplateFullscreen();
});

function loadExternalScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error("не загрузился скрипт редактора"));
    document.body.appendChild(script);
  });
}

async function renderPlanfixTab() {
  const { settings: list } = await apiFetch("/api/admin/settings?group=planfix");
  const token = list.find((s) => s.key === "planfix_token") || {};

  settingsPane().innerHTML = `
    <div class="settings-card">
      <h2 class="access-title">Токен доступа к Planfix</h2>
      <p class="access-note">Им ИСУ забирает из Planfix проекты и задачи. Токен выдаётся
      в самом Planfix: Управление аккаунтом → API. Он должен принадлежать сотруднику,
      который видит нужные проекты, — иначе Planfix отвечает «Scope denied».</p>

      <form class="settings-form" id="planfixForm">
        <label class="settings-field">
          <span class="settings-label">Токен
            <span class="settings-origin">${ORIGIN_NOTE[token.origin] || ""}</span>
          </span>
          <input type="password" id="planfixToken" autocomplete="off" spellcheck="false"
                 placeholder="${token.set ? `задан, оканчивается на ${escapeHtml(token.tail || "")}` : "не задан"}">
          <span class="settings-hint">Обратно токен не показывается никогда — видно только,
          задан ли он и чем оканчивается. Пустое поле означает «оставить как есть».</span>
        </label>
        <div class="settings-actions">
          <button class="primary" type="submit">Сохранить</button>
          <button class="upload-btn" type="button" id="planfixProbeBtn">Проверить связь</button>
          <span class="settings-probe" id="planfixProbeResult"></span>
        </div>
      </form>
    </div>`;

  document.getElementById("planfixForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const field = document.getElementById("planfixToken");
    const value = field.value.trim();
    if (!value) return showToast("Поле пустое — менять нечего");
    try {
      await apiFetch("/api/admin/settings?group=planfix", {
        method: "PATCH", body: JSON.stringify({ values: { planfix_token: value } }),
      });
      showToast("Токен сохранён");
      renderPlanfixTab();
    } catch (err) {
      settingsError(err);
    }
  });

  document.getElementById("planfixProbeBtn").addEventListener("click", async () => {
    const out = document.getElementById("planfixProbeResult");
    out.textContent = "Проверяю…";
    out.className = "settings-probe";
    try {
      const data = await apiFetch("/api/cases/planfix/probe");
      const ok = data.ok !== false;
      out.textContent = ok
        ? `Связь есть${data.projects !== undefined ? `, проектов видно: ${data.projects}` : ""}`
        : `Planfix отвечает отказом: ${data.message || "причина не названа"}`;
      out.className = "settings-probe " + (ok ? "good" : "bad");
    } catch (err) {
      out.textContent = err.message;
      out.className = "settings-probe bad";
    }
  });
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

/* Образцы письма для формы создания ГП.

   Держим в памяти: список из пяти строк, а форму открывают по многу раз
   за день. Сбрасывается, когда образцы правят в настройках. */
let gpTemplatesCache = null;
const forgetGpTemplates = () => { gpTemplatesCache = null; };

async function fillGpTemplates() {
  const select = els.gpTemplateSelect;
  if (!select) return;
  select.innerHTML = '<option value="">Загрузка…</option>';
  try {
    if (!gpTemplatesCache) gpTemplatesCache = await apiFetch("/api/gp/templates");
    const { items, defaultId } = gpTemplatesCache;
    select.innerHTML = items
      .map((i) => `<option value="${escapeHtml(i.id)}"${i.id === defaultId ? " selected" : ""}>${escapeHtml(i.name)}</option>`)
      .join("");
    const hint = document.getElementById("gpTemplateHint");
    if (hint) {
      hint.textContent = items.length > 1
        ? `Заведено образцов: ${items.length}. Правятся в «Настройки → Шаблоны документов».`
        : "Пока образец один. Ещё заводятся в «Настройки → Шаблоны документов».";
    }
  } catch (err) {
    // Без списка форма всё равно должна работать: сервер возьмёт
    // основной образец сам.
    select.innerHTML = '<option value="">Основной образец</option>';
  }
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

  await fillGpTemplates();

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
  submitBtn.textContent = "Собираем…";

  try {
    // Письмо сначала собирается в черновик и показывается целиком.
    // В папке дела до нажатия «Сохранить» не появляется ничего.
    const draft = await apiFetch("/api/gp/preview", {
      method: "POST",
      body: JSON.stringify({
        caseId,
        templateId: els.gpTemplateSelect ? els.gpTemplateSelect.value : "",
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
    // Форму не сбрасываем и не закрываем насовсем — прячем: из
    // предпросмотра можно вернуться и поправить введённое, а набирать
    // всё заново из-за одной опечатки человек не должен.
    els.gpOverlay.classList.add("hidden");
    await openGpPreview(draft);
  } catch (err) {
    alert("Не удалось собрать письмо: " + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Предпросмотр";
  }
});

/* ---------- Предпросмотр гарантийного письма ---------- */

/**
 * Письмо показывают ДО того, как оно легло в папку дела.
 *
 * Пока оно собиралось сразу в дело, ошибку было видно только там же: в
 * папке оставался файл «вроде не тот», рядом появлялся второй, и через
 * месяц никто не мог сказать, какой отправляли в суд.
 *
 * Правки вносятся прямо здесь, в редакторе, — их сохраняет сам редактор,
 * как и в образцах. Письмо с приложением открывается только на просмотр
 * и пересобирается из текстового: иначе правка в одном файле молча не
 * попала бы во второй.
 */
let gpPreviewState = null;   // { draftId, plainName, withDocsName, noScans }
let gpPreviewEditor = null;
let gpPreviewView = "plain";

async function openGpPreview(draft) {
  gpPreviewState = draft;
  gpPreviewView = "plain";
  document.getElementById("gpPreviewFull").classList.remove("hidden");
  document.body.classList.add("no-scroll");
  document.querySelector('[data-gp-view="docs"]').disabled = Boolean(draft.noScans);
  await showGpPreviewView("plain");
}

async function showGpPreviewView(view) {
  if (!gpPreviewState) return;
  gpPreviewView = view;
  for (const tab of document.querySelectorAll("[data-gp-view]")) {
    tab.classList.toggle("on", tab.dataset.gpView === view);
  }
  const withDocs = view === "docs";
  document.getElementById("gpPreviewTitle").textContent =
    withDocs ? gpPreviewState.withDocsName : gpPreviewState.plainName;
  document.getElementById("gpPreviewHint").textContent = withDocs
    ? "Только просмотр: приложение собирается из текста письма"
    : "Правки сохраняет сам редактор";

  const mount = document.getElementById("gpPreviewMount");
  mount.innerHTML = '<div class="empty-hint" style="padding:24px;">Открываем письмо…</div>';
  destroyGpPreviewEditor();

  try {
    if (withDocs) {
      // Пересобираем ПЕРЕД показом: текст могли только что поправить, и
      // показать старую редакцию — соврать ровно в том месте, ради
      // которого предпросмотр и сделан.
      await apiFetch(`/api/gp/preview/${encodeURIComponent(gpPreviewState.draftId)}/rebuild`,
        { method: "POST" });
    }
    const { config, scriptUrl } = await apiFetch(
      `/api/gp/preview/${encodeURIComponent(gpPreviewState.draftId)}/editor` +
      (withDocs ? "?file=docs" : ""));
    if (!window.DocsAPI) await loadExternalScript(scriptUrl);
    mount.innerHTML = '<div id="gpPreviewEditorBox"></div>';
    gpPreviewEditor = new window.DocsAPI.DocEditor("gpPreviewEditorBox", config);
  } catch (err) {
    mount.innerHTML = `<div class="empty-hint" style="padding:24px;">
      Не удалось открыть письмо: ${escapeHtml(err.message)}.<br>
      Проверьте, что сервер документов (OnlyOffice) запущен.<br><br>
      Письмо при этом собрано и лежит в черновике — «Сохранить в дело» работает.</div>`;
  }
}

function destroyGpPreviewEditor() {
  // Закрываем редактор, а не просто прячем: незакрытый продолжает
  // держать документ и спорить за право сохранить со следующим.
  if (gpPreviewEditor && gpPreviewEditor.destroyEditor) {
    try { gpPreviewEditor.destroyEditor(); } catch (err) { /* уже закрыт */ }
  }
  gpPreviewEditor = null;
}

function hideGpPreview() {
  destroyGpPreviewEditor();
  document.getElementById("gpPreviewFull").classList.add("hidden");
  document.getElementById("gpPreviewMount").innerHTML = "";
  document.body.classList.remove("no-scroll");
}

/** Вернуться к форме: черновик убираем, введённое остаётся на месте. */
async function backFromGpPreview() {
  const state = gpPreviewState;
  gpPreviewState = null;
  hideGpPreview();
  els.gpOverlay.classList.remove("hidden");
  if (state) {
    try {
      await apiFetch(`/api/gp/preview/${encodeURIComponent(state.draftId)}`, { method: "DELETE" });
    } catch (err) { /* не убрался — уберётся сам через сутки */ }
  }
}

for (const tab of document.querySelectorAll("[data-gp-view]")) {
  bind(tab, "click", () => {
    if (tab.disabled || tab.dataset.gpView === gpPreviewView) return;
    showGpPreviewView(tab.dataset.gpView).catch((err) => alert(err.message));
  });
}
bind(document.getElementById("gpPreviewBack"), "click", () => {
  backFromGpPreview().catch((err) => alert(err.message));
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && gpPreviewState) backFromGpPreview().catch(() => {});
});

bind(document.getElementById("gpPreviewSave"), "click", async () => {
  if (!gpPreviewState) return;
  const button = document.getElementById("gpPreviewSave");
  button.disabled = true;
  button.textContent = "Сохраняем…";
  // Редактор закрываем ДО сохранения: он отдаёт правки серверу при
  // закрытии, и сохранить раньше этого значило бы положить в дело
  // письмо без последней правки.
  destroyGpPreviewEditor();
  await new Promise((resolve) => setTimeout(resolve, 900));
  try {
    const result = await apiFetch(
      `/api/gp/preview/${encodeURIComponent(gpPreviewState.draftId)}/save`, { method: "POST" });
    gpPreviewState = null;
    hideGpPreview();
    els.gpForm.reset();
    // Файлов два: рабочий и тот, что уходит в суд. Если сканов нет ни у
    // кого, второго не будет — и об этом надо сказать сразу, а не дать
    // человеку искать его в папке.
    alert(result.noScans
      ? `Готово! Файл «${result.name}» создан в проекте.\n\n` +
        "Письма с приложениями нет: ни у одного из выбранных экспертов " +
        "не прикреплено ни одного скана. Их добавляют в «Базе данных / " +
        "Эксперты» кнопкой «Сведения об эксперте»."
      : `Готово! В проекте создано два файла:\n\n${result.files.join("\n")}`);
    if (currentPath === result.caseFolderPath) {
      renderFolder(currentPath);
    } else {
      loadColumnList("cases");
    }
  } catch (err) {
    alert("Не удалось сохранить письмо: " + err.message);
  } finally {
    button.disabled = false;
    button.textContent = "Сохранить в дело";
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

/**
 * Ссылка на карточку дела в картотеке арбитражных дел.
 *
 * Показываем её только когда номер действительно похож на судебное дело:
 * у половины проектов в этом поле номер договора, и ссылка на суд вела бы
 * в никуда. Решает это сервер (courtCase.kadUrl), здесь только рисуем.
 *
 * Один код на баннер в папке и на карточку проекта: если писать дважды,
 * через месяц они разойдутся.
 */
function kadLinkHtml(project) {
  if (!project || !project.kad_url) return "";
  return `<a class="kad-link" href="${escapeHtml(project.kad_url)}" target="_blank" rel="noopener noreferrer"
             title="Открыть карточку дела в картотеке арбитражных дел">
            <svg viewBox="0 0 24 24"><path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M18 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/></svg>
            ${escapeHtml(project.court_case_number)}
          </a>`;
}

/**
 * Как называется тип проекта.
 *
 * Пустой тип — это не ошибка: так приезжают проекты из Planfix, у которых
 * по названию тип не распознан. Их нельзя молча записывать в экспертизы,
 * поэтому у пустого типа своя подпись.
 *
 * plural = true для списка («Экспертизы»), false для одного проекта
 * («Экспертиза»).
 */
function caseTypeLabel(type, plural) {
  if (type === "research") return plural ? "Независимые исследования" : "Независимое исследование";
  if (type === "expertise") return plural ? "Экспертизы" : "Экспертиза";
  return "Без типа";
}

/**
 * Перевод дела на другую стадию.
 *
 * Один код на все три места, откуда это делают: папка проекта, карточка
 * проекта и список дел. Три копии одного действия неизбежно разъедутся —
 * где-то забудут подтверждение, где-то текст будет другой.
 *
 * Подтверждение спрашиваем всегда: перенос двигает папку на диске и
 * карточку в Planfix, и промахнуться мышкой легко.
 *
 * Возвращает true, если перенос состоялся, — вызывающий сам решает, что
 * обновить: в папке путь исчез и надо уходить наверх, а карточку и
 * список достаточно перечитать на месте.
 */
async function advanceCaseStage(kase, targetStage, btn) {
  const label = STAGE_LABEL[targetStage] || targetStage;
  if (!confirm(`Перевести «${kase.name}» на стадию «${label}»?\n\n` +
               "Папка дела переедет, и это же изменение уйдёт в Planfix.")) return false;

  if (btn) btn.disabled = true;
  try {
    await apiFetch(`/api/cases/${kase.id}/advance`, {
      method: "POST", body: JSON.stringify({ stage: targetStage }),
    });
    showToast(`«${kase.name}» переведено на «${label}»`);
    return true;
  } catch (err) {
    alert("Не удалось перевести дело: " + err.message);
    return false;
  } finally {
    if (btn) btn.disabled = false;
  }
}

/**
 * Отмена проекта — такой же переход, как остальные, только папка уезжает
 * в «Архив / Отменённые», а не в папку стадии, и нужна причина: без неё
 * через полгода никто не вспомнит, почему проект остановили.
 *
 * Раньше это была отдельная кнопка на карточке. Теперь и отмена, и
 * перевод по стадиям живут в одном месте — на бейдже стадии, — чтобы
 * не приходилось помнить, где какое действие лежит.
 */
async function cancelCaseStage(kase, btn) {
  const reason = prompt(
    `Отменить проект «${kase.name}»?\n\n` +
    "Папка уедет в «Архив / Отменённые», в Planfix проект станет отменённым.\n" +
    "Напишите причину — она останется в истории проекта:"
  );
  if (reason === null) return false;
  if (!reason.trim()) {
    alert("Без причины отменить нельзя: именно она объясняет, что случилось.");
    return false;
  }

  if (btn) btn.disabled = true;
  try {
    await apiFetch(`/api/cases/${kase.id}/cancel`, {
      method: "POST", body: JSON.stringify({ reason: reason.trim() }),
    });
    showToast(`«${kase.name}» отменён`);
    return true;
  } catch (err) {
    alert("Не удалось отменить проект: " + err.message);
    return false;
  } finally {
    if (btn) btn.disabled = false;
  }
}

const STAGE_ORDER = ["plan", "active", "control", "done"];

function stageBadgeHtml(project) {
  if (project.is_cancelled) return `<span class="stage-badge stage-cancelled">Отменён</span>`;
  const cls = { plan: "stage-plan", active: "stage-active", control: "stage-control", done: "stage-done" }[project.stage];
  return `<span class="stage-badge ${cls}">${STAGE_LABEL[project.stage]}</span>`;
}

/**
 * Стадия проекта как кнопка: бейдж показывает, где проект сейчас,
 * щелчок открывает список — куда перевести.
 *
 * Раньше рядом с бейджем стояли выпадающий список и кнопка «Переместить».
 * Получалось два разных предмета об одном и том же: бейдж говорил «План»,
 * а список рядом показывал «Активный» — просто потому, что это была первая
 * из оставшихся стадий. Человек читал это как «проект активный» и не
 * понимал, где правда. Теперь предмет один: что написано на бейдже — там
 * проект и есть, а куда его двигать, спрашивается только после щелчка.
 *
 * Один и тот же код рисует и полосу в папке, и строку в списке дел —
 * иначе два места неизбежно разъедутся.
 *
 * Если двигать нельзя (проект отменён, нет прав, стадия последняя) —
 * возвращается обычный бейдж без всякого поведения. Кнопка, которая
 * упрётся в отказ, хуже, чем её отсутствие.
 */
function stagePickerHtml(kase, { canWrite = true } = {}) {
  const targets = STAGE_ORDER.filter((st) => st !== kase.stage);
  if (kase.is_cancelled || !canWrite || !targets.length) return stageBadgeHtml(kase);

  const cls = { plan: "stage-plan", active: "stage-active", control: "stage-control", done: "stage-done" }[kase.stage];
  return `<span class="stage-pick" data-stage-pick="${escapeHtml(kase.id)}">
    <button type="button" class="stage-badge ${cls} stage-badge-btn"
            aria-haspopup="menu" aria-expanded="false"
            title="Стадия проекта — нажмите, чтобы перевести на другую">
      ${STAGE_LABEL[kase.stage]}
      <svg class="stage-chevron" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>
    </button>
    <span class="stage-menu hidden" role="menu">
      <span class="stage-menu-head">Перевести на стадию</span>
      ${targets.map((st) => `
        <button type="button" role="menuitem" data-stage-to="${st}">
          <span class="stage-dot stage-${st}"></span>${STAGE_LABEL[st]}
        </button>`).join("")}
      <span class="stage-menu-sep"></span>
      <button type="button" role="menuitem" class="stage-menu-cancel" data-stage-to="cancelled">
        <span class="stage-dot stage-cancelled"></span>Отмена
      </button>
    </span>
  </span>`;
}

/**
 * Оживляет все бейджи-кнопки внутри root.
 *
 * findCase по id находит сам проект — у полосы в папке он один, у списка
 * дел их сотня, и таскать объект через разметку было бы хуже.
 * onMoved вызывается только после успешного перевода: в папке надо уйти
 * наверх (путь только что переехал), в списке — перечитать страницу.
 */
function wireStagePickers(root, findCase, onMoved) {
  root.querySelectorAll("[data-stage-pick]").forEach((wrap) => {
    const button = wrap.querySelector(".stage-badge-btn");
    const menu = wrap.querySelector(".stage-menu");

    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = menu.classList.contains("hidden");
      // Открытым может быть только одно меню: иначе в списке из сотни
      // строк они копятся друг под другом и перекрывают соседей.
      closeStageMenus();
      menu.classList.toggle("hidden", !willOpen);
      button.setAttribute("aria-expanded", String(willOpen));
    });

    menu.addEventListener("click", (e) => e.stopPropagation());

    menu.querySelectorAll("[data-stage-to]").forEach((item) => {
      item.addEventListener("click", async () => {
        const kase = findCase(wrap.dataset.stagePick);
        if (!kase) return;
        closeStageMenus();
        const to = item.dataset.stageTo;
        const ok = to === "cancelled"
          ? await cancelCaseStage(kase, item)
          : await advanceCaseStage(kase, to, item);
        if (!ok) return;
        onMoved();
      });
    });
  });
}

function closeStageMenus() {
  document.querySelectorAll(".stage-menu").forEach((m) => m.classList.add("hidden"));
  document.querySelectorAll(".stage-badge-btn").forEach((b) => b.setAttribute("aria-expanded", "false"));
}

document.addEventListener("click", closeStageMenus);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeStageMenus();
});

/**
 * Проверяет, является ли открытая сейчас в "Дела" папка отслеживаемым
 * проектом (экспертизой/НИ) — и если да, показывает баннер прямо в шапке
 * папки с кнопками "Перевести на стадию" / "Отменить". Если это обычная
 * папка (или мы вне "Дела" вообще) — баннер скрыт, всё выглядит как
 * обычный файловый менеджер, ничего лишнего не мешает.
 */
async function updateCaseBanner(path) {
  const banner = document.getElementById("caseBanner");
  if (!path.startsWith(CASES_PATH)) {
    banner.classList.add("hidden");
    openPlanfixTasksFor(null);
    return;
  }
  try {
    const project = await apiFetch(`/api/cases/by-path?path=${encodeURIComponent(path)}`);
    renderCaseBanner(project);
    openPlanfixTasksFor(project);
  } catch {
    banner.classList.add("hidden");
    openPlanfixTasksFor(null);
  }
}

function renderCaseBanner(project) {
  const banner = document.getElementById("caseBanner");

  // Папка отвечает за файлы, карточка — за состояние проекта. Раньше здесь
  // стояли пять кнопок одного веса, список задач и ассистент, и до самих
  // файлов человек доезжал на пятой сотне пикселей. Осталась одна полоса:
  // где проект, что горит и куда идти за подробностями.
  const overdue = Number(project.overdue_tasks || 0);

  // Отдельной кнопки «Отменить проект» здесь больше нет: отмена — такой
  // же переход, как и остальные, и живёт в том же меню на бейдже стадии.
  const rare = [`<button type="button" id="caseEditBtn">Редактировать</button>`];

  // Перенос стадии — это сам бейдж: щёлкнул по «ПЛАН», выбрал куда.
  // Отдельные «список стадий + кнопка Переместить» отсюда убраны: они
  // говорили об одном и том же, но показывали разное, и полоса из-за
  // них была тесной.
  banner.innerHTML = `
    ${stagePickerHtml(project)}
    <span class="case-strip-status">${escapeHtml(STATUS_LABEL[project.status] || "")}</span>
    ${overdue
      ? `<span class="chip-overdue">${plural(overdue, "задача просрочена", "задачи просрочено", "задач просрочено")}</span>`
      : ""}
    ${kadLinkHtml(project)}
    <span class="case-strip-right">
      <button class="case-strip-card" type="button" id="caseCardBtn">
        Карточка проекта
        <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </button>
      <span class="case-strip-more">
        <button type="button" id="caseMoreBtn" title="Ещё действия" aria-label="Ещё действия" aria-haspopup="menu">
          <svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>
        </button>
        <span class="case-strip-menu hidden" id="caseMoreMenu" role="menu">${rare.join("")}</span>
      </span>
    </span>
  `;
  banner.classList.remove("hidden");
  banner.dataset.caseId = project.id;

  bind(document.getElementById("caseCardBtn"), "click", () => openCaseCard(project.id, true));

  const moreBtn = document.getElementById("caseMoreBtn");
  const moreMenu = document.getElementById("caseMoreMenu");
  bind(moreBtn, "click", (e) => {
    e.stopPropagation();
    moreMenu.classList.toggle("hidden");
  });
  // Щелчок мимо меню закрывает его — но щелчок ВНУТРИ не должен. Раньше
  // выбор в выпадающем списке всплывал до document, и меню схлопывалось
  // прямо во время выбора стадии.
  bind(moreMenu, "click", (e) => e.stopPropagation());
  document.addEventListener("click", () => moreMenu.classList.add("hidden"));

  // Полоса видна, только когда стоишь ровно в папке проекта, — значит
  // после перевода этот самый путь переехал и больше не существует.
  // Поднимаемся к колонкам и обновляем список «Дела».
  wireStagePickers(banner, () => project, () => {
    goToColumns(true);
    loadColumnList("cases");
  });

  bind(document.getElementById("caseEditBtn"), "click", () => openCaseEdit(project));

}

/* ---------- Страница «Задачи» ----------
   Все задачи проектов в одном месте: видно, что горит, и можно завершить
   задачу, не уходя в Planfix. Завершение идёт через Planfix — он остаётся
   источником правды, у себя помечаем только после его подтверждения. */

// Открываем страницу на «Мои» и «Текущие»: человек приходит сюда с
// вопросом «что мне делать», а не «какие вообще есть задачи в центре».
const tasksFilters = {
  scope: "mine", state: "open", q: "",
  due: "any", type: "any", stage: "any", assignee: "",
};
// Один раз за сеанс: если аккаунт не связан с сотрудником Planfix,
// «Мои» показать нечего — молча оставлять пустой экран нельзя, поэтому
// сами переключаемся на «Все» и оставляем объяснение в баннере.
let tasksScopeFellBack = false;

// Подписи для «фишек» под панелью. Держим здесь, а не берём текст из
// самого выпадающего списка: там «Срок: любой», а в фишке нужно короткое.
const DUE_LABEL = {
  overdue: "просрочено", today: "срок сегодня",
  week: "ближайшие 7 дней", none: "без срока",
};
const TYPE_LABEL = {
  expertise: "экспертизы", research: "независимые исследования", none: "без типа",
};
const CASE_STAGE_LABEL = { plan: "План", active: "Активный", control: "Контроль", done: "Завершённый" };

/** Все фильтры в адресе, чтобы они пережили F5 и возврат из карточки. */
function tasksFiltersToUrl() {
  const p = new URLSearchParams({ section: "tasks" });
  if (tasksFilters.scope !== "mine") p.set("scope", tasksFilters.scope);
  if (tasksFilters.state !== "open") p.set("state", tasksFilters.state);
  if (tasksFilters.q) p.set("q", tasksFilters.q);
  if (tasksFilters.due !== "any") p.set("due", tasksFilters.due);
  if (tasksFilters.type !== "any") p.set("type", tasksFilters.type);
  if (tasksFilters.stage !== "any") p.set("stage", tasksFilters.stage);
  if (tasksFilters.assignee) p.set("assignee", tasksFilters.assignee);
  return `/?${p.toString()}`;
}

function tasksFiltersFromUrl(params) {
  const take = (key, allowed, def) => {
    const v = params.get(key);
    return v && allowed.includes(v) ? v : def;
  };
  tasksFilters.scope = take("scope", ["all", "mine", "assigned"], "mine");
  tasksFilters.state = take("state", ["open", "done"], "open");
  tasksFilters.q = params.get("q") || "";
  tasksFilters.due = take("due", ["any", "overdue", "today", "week", "none"], "any");
  tasksFilters.type = take("type", ["any", "expertise", "research", "none"], "any");
  tasksFilters.stage = take("stage", ["any", "plan", "active", "control", "done"], "any");
  tasksFilters.assignee = params.get("assignee") || "";
  syncTasksFilterControls();
}

/** Раскладывает состояние фильтров обратно по элементам панели. */
function syncTasksFilterControls() {
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value;
    // Выбранный фильтр подсвечиваем: иначе не видно, почему список короткий.
    el.classList.toggle("on", value !== "any" && value !== "");
  };
  set("tasksDue", tasksFilters.due);
  set("tasksType", tasksFilters.type);
  set("tasksStage", tasksFilters.stage);
  set("tasksAssignee", tasksFilters.assignee);

  const search = document.getElementById("tasksSearch");
  if (search && search.value !== tasksFilters.q) search.value = tasksFilters.q;

  document.querySelectorAll("#tasksScope .seg-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.scope === tasksFilters.scope));
  document.querySelectorAll("#tasksState .seg-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.state === tasksFilters.state));
}

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

/** Сужен ли список хоть одним из новых фильтров. */
function hasNarrowingFilters() {
  return tasksFilters.due !== "any" || tasksFilters.type !== "any"
    || tasksFilters.stage !== "any" || !!tasksFilters.assignee;
}

/**
 * Показывает, что именно сейчас отобрано.
 *
 * Без этого короткий список читается как «задач больше нет» — а на самом
 * деле их просто отфильтровали неделю назад и забыли.
 */
function renderTasksFilterState(data) {
  // Список сотрудников приходит с сервера — только те, чьи задачи этому
  // человеку вообще видны.
  const select = document.getElementById("tasksAssignee");
  if (select && data.facets && Array.isArray(data.facets.assignees)) {
    const chosen = tasksFilters.assignee;
    select.innerHTML = '<option value="">Исполнитель: любой</option>' +
      data.facets.assignees.map((p) =>
        `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
    // Если выбранного сотрудника в новом списке нет (сменили фильтры) —
    // выбор не молча теряем, а оставляем пунктом, чтобы было видно.
    if (chosen && !data.facets.assignees.some((p) => String(p.id) === String(chosen))) {
      const opt = document.createElement("option");
      opt.value = chosen;
      opt.textContent = "Выбранный сотрудник (задач нет)";
      select.appendChild(opt);
    }
    select.value = chosen;
    select.classList.toggle("on", !!chosen);
  }

  const found = document.getElementById("tasksFound");
  if (found) {
    const shown = data.tasks.length;
    const total = data.total || 0;
    found.textContent = total > shown
      ? `Показано ${shown} из ${total}`
      : (hasNarrowingFilters() || tasksFilters.q ? `Найдено ${total}` : "");
  }

  const chips = document.getElementById("tasksChips");
  if (!chips) return;
  const items = [];
  if (tasksFilters.due !== "any") items.push(["due", "Срок", DUE_LABEL[tasksFilters.due]]);
  if (tasksFilters.type !== "any") items.push(["type", "Тип", TYPE_LABEL[tasksFilters.type]]);
  if (tasksFilters.stage !== "any") items.push(["stage", "Стадия", CASE_STAGE_LABEL[tasksFilters.stage]]);
  if (tasksFilters.assignee) {
    const person = (data.facets && data.facets.assignees || [])
      .find((p) => String(p.id) === String(tasksFilters.assignee));
    items.push(["assignee", "Исполнитель", person ? person.name : "выбранный сотрудник"]);
  }

  chips.classList.toggle("hidden", !items.length);
  if (!items.length) { chips.innerHTML = ""; return; }

  chips.innerHTML = items.map(([key, label, value]) => `
    <span class="task-chip"><b>${label}:</b> ${escapeHtml(String(value))}
      <button type="button" data-chip-off="${key}" title="Убрать фильтр" aria-label="Убрать фильтр">✕</button>
    </span>`).join("") +
    '<button type="button" class="task-chip-reset" id="tasksChipsReset">сбросить всё</button>';

  chips.querySelectorAll("[data-chip-off]").forEach((btn) => {
    btn.addEventListener("click", () => {
      tasksFilters[btn.dataset.chipOff] = btn.dataset.chipOff === "assignee" ? "" : "any";
      applyTasksFilters();
    });
  });
  bind(document.getElementById("tasksChipsReset"), "click", () => {
    tasksFilters.due = "any";
    tasksFilters.type = "any";
    tasksFilters.stage = "any";
    tasksFilters.assignee = "";
    applyTasksFilters();
  });
}

/** Одна точка на все изменения фильтров: обновить панель, адрес и список. */
function applyTasksFilters() {
  syncTasksFilterControls();
  if (!PICKER_MODE) history.replaceState({ view: "section", section: "tasks" }, "", tasksFiltersToUrl());
  loadTasksPage();
}

function renderTasksPage(data) {
  const body = document.getElementById("tasksBody");
  const summary = document.getElementById("tasksSummary");
  const counts = data.counts || { open: 0, done: 0, overdue: 0 };

  // Счётчики считаются по всем видимым проектам, а не по текущему отбору:
  // иначе цифра прыгает вслед за фильтром и перестаёт что-либо значить.
  // Но раз страница открывается на «Моих», сначала говорим про них —
  // иначе «В работе 37» над списком из пяти строк только запутывает.
  const all = counts.overdue
    ? `по всем проектам ${counts.open}, просрочено ${counts.overdue}`
    : `по всем проектам ${counts.open}`;
  if (tasksFilters.scope === "mine" && !data.needsBinding) {
    summary.textContent = counts.mine
      ? `На вас ${plural(counts.mine, "задача", "задачи", "задач")} — ${all}.`
      : `На вас сейчас ничего не назначено — ${all}.`;
  } else {
    summary.textContent = counts.overdue
      ? `В работе ${counts.open}, из них просрочено ${counts.overdue}. Завершено ${counts.done}.`
      : `В работе ${counts.open}. Завершено ${counts.done}.`;
  }

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

  renderTasksFilterState(data);

  if (!data.tasks.length) {
    body.innerHTML = `<div class="empty-hint" style="padding:24px;">${
      hasNarrowingFilters() ? "Под эти фильтры ничего не подходит" :
      tasksFilters.q ? "Ничего не нашли" :
      data.needsBinding && tasksFilters.scope !== "all" ? "Сначала нужна связь с сотрудником Planfix" :
      tasksFilters.scope === "mine" ? "На вас сейчас ничего не назначено" :
      tasksFilters.scope === "assigned" ? "Вы пока не ставили задач" :
      tasksFilters.state === "done" ? "Завершённых задач пока нет" :
      "Открытых задач нет — всё сделано"
    }</div>`;
    return;
  }

  body.innerHTML = tasksGroupsHtml(data);
  wireTasksRows(body);
}

/**
 * Группы срочности.
 *
 * Раньше это была таблица на семь колонок: она отвечала на вопрос «какие
 * вообще есть задачи», а человек открывает список с вопросом «что мне
 * делать сейчас». Срочность было видно только по цвету даты в четвёртой
 * колонке — слишком слабый сигнал, отсюда и путаница.
 *
 * Порядок групп — это и есть порядок работы: сначала то, что уже
 * просрочено, в конце то, у чего срока нет вовсе.
 */
const DUE_GROUPS = [
  { key: "overdue", label: "Просрочено", tone: "over" },
  { key: "today", label: "Сегодня", tone: "soon" },
  { key: "soon", label: "На этой неделе", tone: "ok" },
  { key: "later", label: "Позже", tone: "mute" },
  // Отдельная группа, а не «прочее»: по инструкции у части задач срока
  // действительно не бывает, и в общей куче про них забывают.
  { key: "none", label: "Без срока", tone: "mute", note: "срок ставится по ходу работы" },
];

function tasksGroupsHtml(data) {
  // Завершённые по срочности не делим: они уже сданы, и «просрочено»
  // про них ничего не сообщает. Их показываем одним списком.
  if (tasksFilters.state === "done") {
    return `<div class="task-group">${data.tasks.map(taskLineHtml).join("")}</div>`;
  }

  const byState = new Map(DUE_GROUPS.map((g) => [g.key, []]));
  for (const t of data.tasks) {
    (byState.get(t.due_state) || byState.get("none")).push(t);
  }

  return DUE_GROUPS.filter((g) => byState.get(g.key).length).map((g) => {
    const list = byState.get(g.key);
    return `
      <div class="task-group">
        <div class="task-group-head tone-${g.tone}">
          <span class="task-group-dot"></span>
          <span class="task-group-name">${g.label}</span>
          <span class="task-group-count">${list.length}</span>
          ${g.note ? `<span class="task-group-note">— ${g.note}</span>` : ""}
        </div>
        ${list.map(taskLineHtml).join("")}
      </div>`;
  }).join("");
}

/**
 * Одна строка задачи.
 *
 * Всё существенное собрано слева направо в одном порядке: что сделать,
 * по какому проекту и на какой он стадии, когда срок и на ком задача.
 * Раньше глаз ехал через семь колонок на полтора экрана.
 */
function taskLineHtml(t) {
  const when = t.is_done
    ? `завершена${t.completed_at ? " " + fmtDate(t.completed_at) : ""}`
    : (t.due_iso ? fmtDate(t.due_iso) : "без срока");
  const who = t.assignees ? escapeHtml(t.assignees) : "исполнитель не назначен";

  return `
    <div class="task-line${t.is_done ? " is-done" : ""}" data-task-id="${t.id}">
      ${t.is_done
        ? `<span class="tick on" title="Завершена">${svgCheck}</span>`
        : `<button class="tick" type="button" data-complete="${t.id}"
                   title="Завершить задачу" aria-label="Завершить задачу"></button>`}
      <span class="task-line-main">
        <span class="task-line-name" data-open-task="${t.id}">${escapeHtml(t.name)}</span>
        <span class="task-line-sub">
          ${stageChipHtml(t.case_stage)}
          <span class="task-line-project" data-open-case-id="${t.case_id}">${escapeHtml(t.case_name)}</span>
          ${copyCaseBtnHtml(t.case_name, t.case_number)}
        </span>
      </span>
      <span class="task-line-when">
        ${dueBadgeHtml(t)}
        <span class="task-line-date">${escapeHtml(when)} · ${who}</span>
      </span>
      ${t.can_remove && !t.is_done
        ? `<button class="task-del-btn" type="button" data-delete-task="${t.id}"
                   title="Убрать задачу" aria-label="Убрать задачу">✕</button>`
        : ""}
    </div>`;
}

/**
 * Что именно кладём в буфер: «ЭКС.Гараж (Талдом) А41-58392/2026».
 *
 * Одной строкой и через пробел — так строка одинаково годится и в поиск
 * (в Planfix, в картотеку), и в письмо. Если номера дела нет, копируем
 * одно название: пустой хвост вроде «— » пришлось бы стирать руками.
 */
function copyCaseText(name, number) {
  return [String(name || "").trim(), String(number || "").trim()].filter(Boolean).join(" ");
}

const svgCopy = `<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:1.9"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/></svg>`;

/**
 * Значок «скопировать» рядом с названием проекта.
 *
 * Копирует название и номер дела разом: руками их каждый раз собирают из
 * двух разных мест, а нужны они почти всегда вместе.
 */
function copyCaseBtnHtml(name, number) {
  const text = copyCaseText(name, number);
  if (!text) return "";
  const hint = number
    ? "Скопировать название и номер дела"
    : "Скопировать название (номер дела не заполнен)";
  return `<button class="copy-case-btn" type="button" data-copy-case="${escapeHtml(text)}"
                  title="${hint}" aria-label="${hint}">${svgCopy}</button>`;
}

/** Общая привязка значка копирования — одинаково во всех списках. */
function wireCopyCaseButtons(root) {
  root.querySelectorAll("[data-copy-case]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await copyTextToClipboard(btn.dataset.copyCase);
        btn.classList.add("copied");
        setTimeout(() => btn.classList.remove("copied"), 1200);
        showToast("Скопировано: " + btn.dataset.copyCase);
      } catch (err) {
        showToast("Не удалось скопировать: " + err.message);
      }
    });
  });
}

/** Маленький значок стадии проекта — тот же цвет, что и везде в «Делах». */
function stageChipHtml(stage) {
  const label = { plan: "План", active: "Активный", control: "Контроль", done: "Завершённый" }[stage];
  if (!label) return "";
  return `<span class="badge stage-badge stage-${stage} stage-mini">${label}</span>`;
}

function wireTasksRows(body) {
  body.querySelectorAll("[data-complete]").forEach((btn) => {
    btn.addEventListener("click", () => completeTask(btn.dataset.complete, btn));
  });
  body.querySelectorAll("[data-open-task]").forEach((cell) => {
    cell.addEventListener("click", () => openTaskCard(cell.dataset.openTask));
  });
  body.querySelectorAll("[data-delete-task]").forEach((btn) => {
    btn.addEventListener("click", () => deleteTask(btn.dataset.deleteTask, btn));
  });
  // Щелчок по названию проекта открывает его карточку, а не папку:
  // чаще нужно посмотреть, что с проектом, чем лезть в файлы. В саму
  // папку из карточки уводит отдельная кнопка.
  body.querySelectorAll("[data-open-case-id]").forEach((cell) => {
    cell.addEventListener("click", () => openCaseCard(cell.dataset.openCaseId, true));
  });
  wireCopyCaseButtons(body);
}

/** Метка срока рядом с названием: «просрочено 3 дня», «завтра», «сегодня». */
function dueBadgeHtml(task) {
  const d = task.days_left;
  switch (task.due_state) {
    case "overdue":
      return ` <span class="due-badge due-over">просрочено ${plural(Math.abs(d), "день", "дня", "дней")}</span>`;
    case "today":
      return ' <span class="due-badge due-soon">сегодня</span>';
    case "soon":
      return ` <span class="due-badge due-soon">${d === 1 ? "завтра" : `через ${plural(d, "день", "дня", "дней")}`}</span>`;
    default:
      return "";
  }
}

/** Дата для чтения человеком: 30.11.2026. Пустое остаётся пустым. */
function fmtDate(iso) {
  const s = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
}

/** 1 день / 2 дня / 5 дней — иначе «просрочено 3 день». */
function plural(n, one, few, many) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return `${n} ${many}`;
  if (last > 1 && last < 5) return `${n} ${few}`;
  if (last === 1) return `${n} ${one}`;
  return `${n} ${many}`;
}

async function loadTasksPage() {
  const body = document.getElementById("tasksBody");
  body.innerHTML = '<div class="empty-hint" style="padding:24px;">Загрузка…</div>';
  const params = new URLSearchParams();
  params.set("scope", tasksFilters.scope);
  params.set("done", tasksFilters.state === "done" ? "1" : "0");
  if (tasksFilters.q) params.set("q", tasksFilters.q);
  if (tasksFilters.due !== "any") params.set("due", tasksFilters.due);
  if (tasksFilters.type !== "any") params.set("type", tasksFilters.type);
  if (tasksFilters.stage !== "any") params.set("stage", tasksFilters.stage);
  if (tasksFilters.assignee) params.set("assignee", tasksFilters.assignee);
  try {
    const data = await apiFetch(`/api/cases/tasks/all?${params.toString()}`);

    // Страница открывается на «Моих», но без связи с сотрудником Planfix
    // моих задач не существует. Оставлять человека перед пустым экраном
    // нельзя — переключаемся на «Все» один раз и показываем объяснение.
    if (data.needsBinding && tasksFilters.scope === "mine" && !tasksScopeFellBack) {
      tasksScopeFellBack = true;
      tasksFilters.scope = "all";
      syncTasksFilterControls();
      return loadTasksPage();
    }

    tasksCache = data.tasks;
    renderTasksPage(data);
  } catch (err) {
    body.innerHTML = `<div class="empty-hint" style="padding:24px;">Не удалось загрузить задачи: ${escapeHtml(err.message)}</div>`;
  }
}

/**
 * Завершение задачи. onDone — что перерисовать после: список задач или
 * карточку проекта, смотря откуда завершали. Имя ищем и в списке задач,
 * и в открытой карточке: из карточки страница задач не загружена.
 */
async function completeTask(id, btn, onDone) {
  const task = tasksCache.find((t) => String(t.id) === String(id))
    || (caseCardData && caseCardData.tasks.find((t) => String(t.id) === String(id)));
  if (task && !confirm(`Завершить задачу «${task.name}»?\nОна будет закрыта и в Planfix.`)) return;
  btn.disabled = true;
  try {
    await apiFetch(`/api/cases/tasks/${id}/complete`, { method: "POST" });
    showToast("Задача завершена");
    if (onDone) onDone(); else loadTasksPage();
  } catch (err) {
    btn.disabled = false;
    alert("Не удалось завершить задачу: " + err.message);
  }
}

/**
 * Удаление задачи. Спрашиваем подтверждение и прямо говорим, что она
 * пропадёт и в Planfix: вернуть её оттуда будет нельзя.
 *
 * onDone — что перерисовать после удаления: список задач или карточку
 * проекта, смотря откуда удаляли.
 */
async function deleteTask(id, btn, onDone, knownName) {
  const task = tasksCache.find((t) => String(t.id) === String(id));
  const name = knownName || (task ? task.name : "эту задачу");
  // Planfix удалять задачи не умеет — в нём задача станет «Отмененной».
  // Пишем это прямо, чтобы человек не искал её потом в корзине Planfix.
  if (!confirm(`Убрать задачу «${name}»?\n\nВ Planfix она получит статус «Отмененная», а из ИСУ пропадёт.`)) return;
  if (btn) btn.disabled = true;
  try {
    await apiFetch(`/api/cases/tasks/${id}`, { method: "DELETE" });
    showToast("Задача убрана");
    if (onDone) onDone();
    else loadTasksPage();
  } catch (err) {
    if (btn) btn.disabled = false;
    alert("Не удалось убрать задачу: " + err.message);
  }
}

bind(document.getElementById("casesTasksBtn"), "click", () => showSection("tasks", true));

document.querySelectorAll("#tasksScope .seg-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    tasksFilters.scope = btn.dataset.scope;
    applyTasksFilters();
  });
});

document.querySelectorAll("#tasksState .seg-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    tasksFilters.state = btn.dataset.state;
    applyTasksFilters();
  });
});

bind(document.getElementById("tasksSearch"), "input", debounce((e) => {
  tasksFilters.q = e.target.value.trim();
  applyTasksFilters();
}, 300));

for (const [id, key] of [["tasksDue", "due"], ["tasksType", "type"],
                         ["tasksStage", "stage"], ["tasksAssignee", "assignee"]]) {
  bind(document.getElementById(id), "change", (e) => {
    tasksFilters[key] = e.target.value;
    applyTasksFilters();
  });
}

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
      <span>${escapeHtml(caseTypeLabel(t.case_type, true))}</span>
      <span class="task-card-project" data-open-case-id="${t.case_id}">${escapeHtml(t.case_name)}</span>
      ${copyCaseBtnHtml(t.case_name, t.case_number)}
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
        <div class="modal-actions" style="margin-top:10px; justify-content:space-between;">
          <button class="back-btn danger-outline" type="button" id="taskCardDelete">Удалить задачу</button>
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

  wireCopyCaseButtons(body);

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

  bind(document.getElementById("taskCardDelete"), "click", (e) =>
    deleteTask(id, e.currentTarget, () => {
      closeTaskCard();
      // Со страницы задач обновляем список, из папки проекта — её блок.
      if (document.getElementById("tasksSection") &&
          !document.getElementById("tasksSection").classList.contains("hidden")) {
        loadTasksPage();
      } else if (caseCardId) {
        loadCaseCard();
      }
    }));

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

  // Как и в списке: щелчок по проекту ведёт в его карточку. Поведение
  // должно быть одинаковым, куда бы человек ни ткнул.
  const projectLink = body.querySelector("[data-open-case-id]");
  if (projectLink) {
    projectLink.style.cursor = "pointer";
    projectLink.addEventListener("click", () => {
      const id = projectLink.dataset.openCaseId;
      closeTaskCard();
      openCaseCard(id, true);
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
    // Убирать пункты из общего справочника может только администратор:
    // список общий для всех, и случайное удаление задело бы всех разом.
    const canRemove = currentUser && currentUser.role === "admin";

    list.innerHTML = items.map((t) => {
      const picked = taskNewChosen.some((n) => n.toLowerCase() === t.name.toLowerCase());
      return `<div class="combo-row-item">
        <button type="button" class="combo-item${picked ? " picked" : ""}" data-name="${escapeHtml(t.name)}">
          ${escapeHtml(t.name)}${picked ? '<span class="combo-picked">выбрана</span>' : ""}
        </button>${
          canRemove && t.id
            ? `<button type="button" class="combo-del" data-remove-template="${t.id}"
                       data-template-name="${escapeHtml(t.name)}"
                       title="Убрать из списка стадии" aria-label="Убрать из списка">✕</button>`
            : ""
        }</div>`;
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

    list.querySelectorAll("[data-remove-template]").forEach((btn) =>
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeTaskTemplate(btn.dataset.removeTemplate, btn.dataset.templateName);
      }));
  }
  list.classList.remove("hidden");
}

/**
 * Убирает задачу из справочника стадии.
 *
 * Это правка общего списка, а не удаление поставленной задачи: уже
 * созданные в Planfix задачи с таким названием не трогаются. Говорим
 * это прямо в подтверждении, иначе легко перепутать одно с другим.
 */
async function removeTaskTemplate(id, name) {
  if (!confirm(`Убрать «${name}» из списка задач этой стадии?\n\n` +
               "Уже поставленные задачи с таким названием останутся — удаляется только пункт списка.")) {
    return;
  }
  try {
    await apiFetch(`/api/cases/planfix/stage-tasks/${id}`, { method: "DELETE" });
    taskNewTemplates = taskNewTemplates.filter((t) => String(t.id) !== String(id));
    showToast("Убрано из списка стадии");
    renderTaskNameList(document.getElementById("taskNewName").value);
    const hint = document.getElementById("taskNewStageHint");
    if (hint && taskNewStage) {
      hint.textContent = `Список задач стадии «${STAGE_LABEL[taskNewStage] || taskNewStage}» — ${taskNewTemplates.length}`;
    }
  } catch (err) {
    alert("Не удалось убрать из списка: " + err.message);
  }
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
    // Список задач проекта в его папке пересобираем, чтобы новая
    // задача появилась там сразу, а не после перезагрузки.
    if (taskNewLockedCase && caseCardId) loadCaseCard();
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
            <span class="task-title">${escapeHtml(b.name)}</span>
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
      <button class="task-del-btn" type="button" data-delete-task="${task.id}"
              data-task-name="${escapeHtml(task.name)}"
              title="Удалить задачу" aria-label="Удалить задачу">✕</button>
    </div>`;
}

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

/* ---- Новая задача из папки проекта ----
   Отдельной панели со списком типовых задач здесь больше нет: список
   всё равно живёт в самом окне постановки, и показывать его дважды
   значило показывать одно и то же в двух местах. Осталась кнопка —
   она открывает то же окно, что и на странице «Задачи», с уже
   подставленным проектом. */

let planfixTasksCurrentProject = null;

function openPlanfixTasksFor(project) {
  planfixTasksCurrentProject = project;
}


/* ---------- Справочники журнала на формах ----------

   Один запрос на все списки и на то, кто может быть руководителем и
   специалистом. Держим последний ответ: формы открываются часто, а
   списки меняются редко, и ходить за ними на каждое открытие — значит
   заставлять человека ждать пустое окно. */

let lookupsCache = null;

/**
 * Справочник поменялся — забываем всё, что на нём построено.
 *
 * Журнал держит ответ сервера в памяти и не перечитывает его при каждом
 * открытии. Без этого администратор заводил бы тип экспертизы и тут же
 * не находил его в журнале — и решил бы, что не сохранилось.
 */
function forgetLookups() {
  lookupsCache = null;
  journalData = null;
}

async function loadLookups({ fresh = false } = {}) {
  if (lookupsCache && !fresh) return lookupsCache;
  try {
    lookupsCache = await apiFetch("/api/lookups");
  } catch {
    // Без справочников форма всё равно должна открыться: человек
    // увидит пустые списки и поймёт, что настраивать.
    lookupsCache = { organizations: [], expertise_types: [], years: [], managers: [], experts: [] };
  }
  return lookupsCache;
}

/**
 * Заполняет выпадающий список значениями справочника.
 *
 * Если у проекта стоит значение, которого в списке нет (осталось с тех
 * пор, когда вписывали руками, или приехало из Planfix), добавляем его
 * отдельным пунктом с пометкой. Молча подменить его первым попавшимся —
 * значит потерять данные так, что никто не заметит.
 */
function fillFromLookup(select, values, current, emptyLabel) {
  const value = current == null ? "" : String(current);
  fillSelect(select, (values || []).map((v) => ({ value: String(v), label: String(v) })), value, emptyLabel);
  if (value && select.value !== value) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = value + " — не из списка";
    select.appendChild(opt);
    select.value = value;
  }
}

/**
 * Галочки специалистов. Пишем в скрытое поле строкой через запятую —
 * тем же видом, каким это поле жило всегда.
 */
function fillExpertsBox(boxId, hiddenId, current, people) {
  const box = document.getElementById(boxId);
  const hidden = document.getElementById(hiddenId);
  const chosen = new Set(String(current || "").split(",").map((x) => x.trim()).filter(Boolean));
  const known = (people || []).map((p) => p.name);
  const strangers = [...chosen].filter((n) => !known.includes(n));

  box.innerHTML = (known.length || strangers.length)
    ? [...known.map((n) => [n, chosen.has(n), ""]),
       ...strangers.map((n) => [n, true, " — не значится специалистом"])]
        .map(([name, on, note]) => `
          <label class="picker-item">
            <input type="checkbox" value="${escapeHtml(name)}" ${on ? "checked" : ""}>
            <span>${escapeHtml(name)}<span class="access-hint">${escapeHtml(note)}</span></span>
          </label>`).join("")
    : '<p class="empty-hint">Специалистами никто не отмечен. Отметьте в «Настройки → Сотрудники».</p>';

  const sync = () => {
    hidden.value = [...box.querySelectorAll("input:checked")].map((i) => i.value).join(", ");
  };
  box.querySelectorAll("input").forEach((i) => i.addEventListener("change", sync));
  sync();
}

/* ---- Форма создания проекта ---- */

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
  resetPendingProjectFiles();

  // Справочники читаем заново: администратор мог только что завести
  // новую структуру или год, и увидеть их надо сразу, а не после
  // перезагрузки страницы.
  const lists = await loadLookups({ fresh: true });
  fillFromLookup(document.getElementById("pfOrganization"), lists.organizations, "", "Не выбрана");
  fillFromLookup(document.getElementById("pfExpertiseType"), lists.expertise_types, "", "Не выбран");
  fillFromLookup(document.getElementById("pfYear"), lists.years, "", "Не выбран");
  // Руководителем может стать не всякий, а кто отмечен в настройках.
  fillSelect(document.getElementById("pfManager"),
    (lists.managers || []).map((u) => ({ value: u.id, label: u.name })), "", "Не выбран");

  els.projectFormOverlay.classList.remove("hidden");
}

els.projectFormCloseBtn.addEventListener("click", () => els.projectFormOverlay.classList.add("hidden"));

/* ---- Правка карточки уже заведённого проекта ----
   Отдельное окно от «Нового проекта»: при создании заводится папка и
   структура, здесь же меняются только данные карточки. Стадия тут не
   трогается — её меняет «Переместить», потому что это переезд папки. */

const caseEditOverlay = document.getElementById("caseEditOverlay");
let caseEditProject = null;

function closeCaseEdit() {
  if (caseEditOverlay) caseEditOverlay.classList.add("hidden");
  caseEditProject = null;
}
bind(document.getElementById("caseEditCloseBtn"), "click", closeCaseEdit);
bind(caseEditOverlay, "click", (e) => { if (e.target === caseEditOverlay) closeCaseEdit(); });

/** Заполняет выпадающий список значениями и выбирает нужное. */
function fillSelect(select, items, selected, emptyLabel) {
  select.innerHTML = emptyLabel !== undefined ? `<option value="">${escapeHtml(emptyLabel)}</option>` : "";
  for (const it of items) {
    const opt = document.createElement("option");
    opt.value = it.value;
    opt.textContent = it.label;
    select.appendChild(opt);
  }
  select.value = selected == null ? "" : String(selected);
}

/**
 * Подсказка под номером дела: ссылка в картотеку, если номер похож на
 * судебное дело, и прямая фраза, если не похож. Молчать нельзя: иначе
 * непонятно, ссылки нет потому, что номер не тот, или потому что
 * что-то сломалось.
 */
function renderKadHint(kadUrl, caseNumber) {
  const hint = document.getElementById("ceKadHint");
  if (!hint) return;
  if (kadUrl) {
    hint.innerHTML = `Похоже на арбитражное дело ${escapeHtml(caseNumber)} — ` +
      `<a class="kad-link inline" href="${escapeHtml(kadUrl)}" target="_blank" rel="noopener noreferrer">` +
      "открыть в картотеке</a>";
  } else {
    hint.textContent = "Если сюда вписать номер арбитражного дела (например А40-183194/2015), " +
      "рядом появится ссылка на его карточку в картотеке.";
  }
}

async function openCaseEdit(project) {
  if (!caseEditOverlay) return;
  caseEditProject = project;
  document.getElementById("caseEditError").textContent = "";
  document.getElementById("caseEditHead").textContent = `Карточка проекта: ${project.name}`;

  const set = (id, value) => { document.getElementById(id).value = value == null ? "" : String(value); };
  document.getElementById("ceType").value = project.type || "";
  set("ceStatus", project.status || "waiting");
  set("ceCourt", project.court_or_customer);
  set("ceCaseNumber", project.case_number);
  set("ceParty1", project.party1);
  set("ceParty2", project.party2);
  set("ceJudgeName", project.judge_name);
  set("ceDescription", project.description);

  // Название папки не переименовываем — говорим об этом сразу, чтобы
  // никто не ждал, что «ЭКСПЕРТИЗА НИЦ» станет «ЭКС.ЭКСПЕРТИЗА НИЦ».
  document.getElementById("ceTypeHint").textContent =
    "Тип определяет, в какой группе проект показывается в списке. " +
    "Название папки при его смене не меняется.";

  renderKadHint(project.kad_url, project.court_case_number);

  caseEditOverlay.classList.remove("hidden");

  // Справочники грузим после показа окна: без них форма всё равно
  // рабочая, а ждать их незачем.
  const lists = await loadLookups({ fresh: true });
  fillFromLookup(document.getElementById("ceOrganization"), lists.organizations,
    project.organization, "Не выбрана");
  fillFromLookup(document.getElementById("ceExpertiseType"), lists.expertise_types,
    project.expertise_type, "Не выбран");
  fillFromLookup(document.getElementById("ceYear"), lists.years, project.year, "Не выбран");
  fillSelect(document.getElementById("ceManager"),
    (lists.managers || []).map((u) => ({ value: u.id, label: u.name })),
    project.manager_id, "Не выбран");
  fillExpertsBox("ceExpertsBox", "ceExperts", project.experts, lists.experts);
}

// Подсказку обновляем прямо при наборе номера: разбирает его сервер,
// чтобы правило было одно на всё приложение.
bind(document.getElementById("ceCaseNumber"), "input", debounce(async (e) => {
  const value = e.target.value.trim();
  if (!value) return renderKadHint(null, null);
  try {
    const res = await apiFetch(`/api/cases/court-number?value=${encodeURIComponent(value)}`);
    renderKadHint(res.url, res.number);
  } catch {
    // Не смогли спросить — просто оставляем подсказку как есть.
  }
}, 400));

bind(document.getElementById("caseEditForm"), "submit", async (e) => {
  e.preventDefault();
  if (!caseEditProject) return;
  const submit = document.getElementById("caseEditSubmit");
  const errorEl = document.getElementById("caseEditError");
  const val = (id) => document.getElementById(id).value.trim();

  submit.disabled = true;
  errorEl.textContent = "";
  try {
    const updated = await apiFetch(`/api/cases/${caseEditProject.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        type: document.getElementById("ceType").value || null,
        status: document.getElementById("ceStatus").value,
        expertise_type: val("ceExpertiseType") || null,
        court_or_customer: val("ceCourt") || null,
        case_number: val("ceCaseNumber") || null,
        manager_id: document.getElementById("ceManager").value || null,
        year: val("ceYear") || null,
        organization: document.getElementById("ceOrganization").value || null,
        party1: val("ceParty1") || null,
        party2: val("ceParty2") || null,
        judge_name: val("ceJudgeName") || null,
        experts: val("ceExperts") || null,
        description: val("ceDescription") || null,
      }),
    });
    closeCaseEdit();
    showToast("Карточка проекта сохранена");
    // Баннер и список групп зависят от того, что мы только что изменили.
    caseTypeByFolder = null;
    renderCaseBanner(updated);
    if (!els.folderView.classList.contains("hidden")) renderFolderRows();
  } catch (err) {
    submit.disabled = false;
    errorEl.textContent = "Не удалось сохранить: " + err.message;
  } finally {
    submit.disabled = false;
  }
});


/* ---------- Список дел ----------
   Все дела центра, разложенные по стадиям: посмотреть, что с делом,
   поставить задачу или перевести на другую стадию, не разыскивая папку.

   Отдельной базы здесь нет: это та же таблица дел, из которой живут и
   колонка «Дела», и страница задач, и карточка. Поэтому перенос стадии
   отсюда виден везде сразу — запись одна.

   Плитки стадий и списки под ними считаются из ОДНОГО ответа сервера,
   поэтому цифра на плитке не может разойтись со списком, который она
   открывает. */

const REGISTRY_STAGES = [
  { key: "plan", label: "План", cls: "stage-plan" },
  { key: "active", label: "Активные", cls: "stage-active" },
  { key: "control", label: "Контроль", cls: "stage-control" },
  // Архив — одна полка: и завершённые, и отменённые. Чем кончилось
  // конкретное дело, видно в его строке.
  { key: "archive", label: "Архив", cls: "stage-done" },
];

let registryCases = null;
let registryStage = null;
let registryQuery = "";
let registryType = "any";

/** К какой плитке относится дело. */
function registryBucket(c) {
  return c.is_cancelled || c.stage === "done" ? "archive" : c.stage;
}

async function loadRegistry(force = false) {
  const body = document.getElementById("registryBody");
  if (!registryCases || force) {
    body.innerHTML = '<div class="empty-hint" style="padding:24px;">Загрузка…</div>';
    try {
      const data = await apiFetch("/api/cases/registry");
      registryCases = data.cases;
    } catch (err) {
      body.innerHTML = `<div class="empty-hint" style="padding:24px;">Не удалось загрузить список дел: ${escapeHtml(err.message)}</div>`;
      return;
    }
  }
  renderRegistry();
}

function renderRegistry() {
  const back = document.getElementById("registryBackBtn");
  const typeSel = document.getElementById("registryType");
  back.classList.toggle("hidden", !registryStage);
  typeSel.classList.toggle("hidden", !registryStage);
  if (registryStage) renderRegistryList(); else renderRegistryStages();
}

/** Первый экран: четыре стадии. */
function renderRegistryStages() {
  const list = registryCases || [];
  document.getElementById("registryTitle").textContent = "Список дел";

  const inWork = list.filter((c) => registryBucket(c) !== "archive").length;
  const archived = list.length - inWork;
  document.getElementById("registrySub").textContent =
    `${plural(inWork, "дело", "дела", "дел")} в работе, ${archived} в архиве`;

  const tiles = REGISTRY_STAGES.map((st) => {
    const mine = list.filter((c) => registryBucket(c) === st.key);
    const overdue = mine.reduce((n, c) => n + (c.overdue_tasks > 0 ? 1 : 0), 0);
    const note = st.key === "archive"
      ? `${mine.filter((c) => !c.is_cancelled).length} завершено · ${mine.filter((c) => c.is_cancelled).length} отменено`
      : overdue
        ? `<span class="reg-hot">${plural(overdue, "дело горит", "дела горят", "дел горят")}</span>`
        : "всё в срок";
    return `
      <button class="reg-tile" type="button" data-stage="${st.key}">
        <span class="stage-badge ${st.cls}">${st.label}</span>
        <span class="reg-tile-num">${mine.length}</span>
        <span class="reg-tile-sub">${st.key === "archive" ? "завершённых и отменённых" : plural(mine.length, "дело", "дела", "дел")}</span>
        <span class="reg-tile-note">${note}</span>
      </button>`;
  }).join("");

  document.getElementById("registryBody").innerHTML = `<div class="reg-tiles">${tiles}</div>`;
  document.getElementById("registryBody").querySelectorAll("[data-stage]").forEach((btn) => {
    btn.addEventListener("click", () => openRegistryStage(btn.dataset.stage));
  });
}

function openRegistryStage(stage) {
  registryStage = stage;
  registryQuery = "";
  registryType = "any";
  document.getElementById("registrySearch").value = "";
  document.getElementById("registryType").value = "any";
  if (!PICKER_MODE) {
    history.pushState({ view: "section", section: "registry", stage },
      "", `/?section=registry&stage=${encodeURIComponent(stage)}`);
  }
  renderRegistry();
}

/** Второй экран: дела выбранной стадии, группами по типу. */
function renderRegistryList() {
  const st = REGISTRY_STAGES.find((x) => x.key === registryStage) || REGISTRY_STAGES[0];
  document.getElementById("registryTitle").textContent = st.label;

  let list = (registryCases || []).filter((c) => registryBucket(c) === registryStage);
  const total = list.length;
  const hot = list.filter((c) => c.overdue_tasks > 0).length;

  if (registryType === "none") list = list.filter((c) => !c.type);
  else if (registryType !== "any") list = list.filter((c) => c.type === registryType);

  const q = registryQuery.trim().toLowerCase();
  if (q) {
    list = list.filter((c) =>
      c.name.toLowerCase().includes(q) || String(c.case_number || "").toLowerCase().includes(q));
  }

  document.getElementById("registrySub").textContent = hot
    ? `${plural(total, "дело", "дела", "дел")}, из них ${hot} с просроченными задачами`
    : `${plural(total, "дело", "дела", "дел")}`;

  const body = document.getElementById("registryBody");
  if (!list.length) {
    body.innerHTML = `<div class="empty-hint" style="padding:24px;">${
      q || registryType !== "any" ? "Под эти условия ничего не подходит" : "На этой стадии дел нет"
    }</div>`;
    return;
  }

  // Группы по типу — в том же порядке, что и в папках стадий.
  const groups = [
    ["Экспертизы", list.filter((c) => c.type === "expertise")],
    ["Независимые исследования", list.filter((c) => c.type === "research")],
    ["Без типа", list.filter((c) => !c.type)],
  ].filter(([, items]) => items.length);

  body.innerHTML = groups.map(([label, items]) => `
    <div class="reg-group">
      <div class="reg-group-head">
        <span class="reg-group-name">${label}</span>
        <span class="reg-group-count">${items.length}</span>
      </div>
      ${items.map(registryRowHtml).join("")}
    </div>`).join("");

  wireRegistryRows(body);
}

function registryRowHtml(c) {
  const tasks = c.overdue_tasks
    ? `<span class="reg-chip hot">${plural(c.overdue_tasks, "просрочена", "просрочено", "просрочено")}</span>`
    : c.open_tasks
      ? `<span class="reg-chip">${plural(c.open_tasks, "задача", "задачи", "задач")}</span>`
      : `<span class="reg-chip none">задач нет</span>`;

  // В архиве вместо переноса стадии — чем кончилось дело.
  const archived = registryBucket(c) === "archive";

  // Стадия — тот же бейдж-кнопка, что и в папке проекта.
  //
  // Раньше здесь стоял выпадающий список, и он показывал не текущую
  // стадию, а первую из оставшихся: заходишь в «Планы», а во всех
  // строчках написано «Активный». Читалось это как состояние дела и
  // сбивало с толку. Теперь на бейдже написано, где дело есть на самом
  // деле, — в разделе «Планы» во всех строках будет «План», — а куда
  // его двигать, спрашивается по щелчку.
  const stage = archived ? "" : stagePickerHtml(c, { canWrite: !!c.can_write });

  return `
    <div class="reg-row" data-case-id="${c.id}">
      <span class="reg-name" data-reg-card="${c.id}">${escapeHtml(c.name)}</span>
      ${copyCaseBtnHtml(c.name, c.case_number)}
      ${kadLinkHtml(c)}
      ${archived
        ? `<span class="reg-chip ${c.is_cancelled ? "cancelled" : "done"}">${c.is_cancelled ? "отменено" : "завершено"}</span>`
        : tasks}
      <span class="reg-actions">
        ${stage}
        <button type="button" class="reg-btn accent" data-reg-card="${c.id}">Карточка →</button>
      </span>
    </div>`;
}

function wireRegistryRows(body) {
  body.querySelectorAll("[data-reg-card]").forEach((el) => {
    el.addEventListener("click", () => openCaseCard(el.dataset.regCard, true));
  });
  // Перечитываем страницу целиком: после перевода изменились и плитки
  // стадий сверху, и состав обоих списков.
  wireStagePickers(
    body,
    (id) => (registryCases || []).find((c) => String(c.id) === String(id)),
    async () => {
      await loadRegistry(true);
      loadColumnList("cases");
    }
  );
  wireCopyCaseButtons(body);
}

bind(document.getElementById("registryBackBtn"), "click", () => {
  registryStage = null;
  if (!PICKER_MODE) {
    history.pushState({ view: "section", section: "registry" }, "", "/?section=registry");
  }
  renderRegistry();
});

bind(document.getElementById("registrySearch"), "input", debounce((e) => {
  registryQuery = e.target.value;
  if (registryStage) renderRegistryList();
}, 250));

bind(document.getElementById("registryType"), "change", (e) => {
  registryType = e.target.value;
  renderRegistryList();
});

/* ---------- Журнал регистрации ----------
   Отдельный экран: две вкладки, фильтры, все 14 колонок с прокруткой
   вбок и правка прямо в ячейке. Excel при необходимости скачивается
   отсюда и не занимает отдельную папку в «Делах».

   Экран читает таблицу проектов напрямую, а правка идёт через тот же
   PATCH /api/cases/:id, которым правят карточку.

   Данные тянем один раз на весь экран и фильтруем в браузере: проектов
   десятки, и ходить на сервер за каждым отбором значило бы делать
   медленнее то, ради чего экран и затевался — не открывать Excel. */

let journalData = null;      // ответ сервера целиком
let journalTab = "current";  // «Текущие» / «Архив» — это листы файла
let journalRowsShown = [];   // что сейчас на экране: из этого идёт выгрузка выборки

const journalFilters = {
  q: "", stage: "any", outcome: "any", type: "any",
  org: "any", expType: "any", year: "any", manager: "any",
};

/**
 * Колонки — ровно те же и в том же порядке, что в Excel.
 *
 * edit говорит, как поле правится:
 *   text            — свободный текст;
 *   list:<название>  — выбор из справочника, который ведёт администратор;
 *   type            — три вида проекта, они зашиты в поведение системы;
 *   manager         — один человек из тех, кто отмечен руководителем;
 *   experts         — несколько человек галочками;
 *   null            — не правится вовсе.
 *
 * Учётные поля вписывать руками нельзя нарочно: «строительно-техническая»,
 * «Строительно-техническая» и «стр.-техническая» для человека одно и то
 * же, а для фильтра и выгрузки — три разных проекта.
 *
 * Стадии здесь нет намеренно: её смена двигает папку на диске и карточку
 * в Planfix, для этого есть отдельное действие с подтверждением. Правка
 * в ячейке — для учётных полей, а не для переездов.
 */
const JOURNAL_COLUMNS = [
  { key: "stage",             title: "Стадия",                 edit: null,   sticky: 1, width: 116, filter: "stage" },
  { key: "name",              title: "Условное наименование",  edit: null,   sticky: 2, width: 230 },
  { key: "organization",      title: "Структура",              edit: "list:organizations", width: 200, filter: "org" },
  { key: "type",              title: "Тип проекта",            edit: "type", width: 190, filter: "type" },
  { key: "expertise_type",    title: "Тип экспертизы",         edit: "list:expertise_types", width: 180, filter: "expType" },
  { key: "year",              title: "Год",                    edit: "list:years", width: 76, filter: "year" },
  { key: "description",       title: "Описание",               edit: "text", width: 240 },
  { key: "manager_id",        title: "Руководитель",           edit: "manager", width: 150, filter: "manager" },
  { key: "experts",           title: "Специалисты / Эксперты", edit: "experts", width: 200 },
  { key: "court_or_customer", title: "Заказчик",               edit: "text", width: 230 },
  { key: "case_number",       title: "№ дела или договора",    edit: "text", width: 160 },
  { key: "party1",            title: "Сторона 1",              edit: "text", width: 170, court: true },
  { key: "party2",            title: "Сторона 2",              edit: "text", width: 170, court: true },
  { key: "judge_name",        title: "Судья",                  edit: "text", width: 150, court: true },
];

/** Подпись пустого поля — своя у каждой колонки, чтобы читалось как речь. */
const JOURNAL_EMPTY = {
  organization: "не указана", expertise_type: "не указан", year: "—",
  description: "не заполнено", manager_id: "не назначен", experts: "не заполнено",
  court_or_customer: "не заполнен", case_number: "—",
  party1: "—", party2: "—", judge_name: "—", type: "без типа",
};

const journalIsArchive = (row) => row.is_cancelled || row.stage === "done";

async function loadJournal(force = false) {
  const box = document.getElementById("journalTableBox");
  if (journalData && !force) return renderJournal();
  box.innerHTML = '<div class="empty-hint" style="padding:24px;">Загрузка…</div>';
  try {
    journalData = await apiFetch("/api/cases/journal");
  } catch (err) {
    box.innerHTML = `<div class="empty-hint" style="padding:24px;">Не удалось загрузить журнал: ${escapeHtml(err.message)}</div>`;
    return;
  }
  renderJournal();
}

/**
 * Что предлагает фильтр столбца.
 *
 * Списки берём из ответа сервера, а не из видимых строк: иначе стоит
 * один раз отобрать по году — и в списке «Руководитель» останутся только
 * те, у кого есть проект за этот год, а человек решит, что остальных
 * удалили. Фильтры должны показывать, из чего вообще можно выбирать.
 *
 * Возвращает [{ value, label }], где value === "any" — это «Все».
 */
function journalFilterOptions(key) {
  const all = [{ value: "any", label: "Все" }];
  const plain = (values) => all.concat(values.map((v) => ({ value: String(v), label: String(v) })));
  if (key === "stage") {
    return all.concat([["plan", "План"], ["active", "Активный"], ["control", "Контроль"]]
      .map(([value, label]) => ({ value, label })));
  }
  if (key === "outcome") {
    return all.concat([["done", "Завершён"], ["cancelled", "Отменён"]]
      .map(([value, label]) => ({ value, label })));
  }
  if (key === "type") {
    return all.concat([["expertise", "Экспертизы"], ["research", "Независимые исследования"],
      ["none", "Без типа"]].map(([value, label]) => ({ value, label })));
  }
  if (key === "org") return plain(journalData?.organizations || []);
  if (key === "expType") return plain(journalData?.expertise_types || []);
  if (key === "year") return plain(journalData?.years || []);
  if (key === "manager") {
    return all.concat((journalData?.managers || []).map((m) => ({ value: String(m.id), label: m.name })));
  }
  return all;
}

/** Подпись выбранного значения — для плашек «что отобрано». */
function journalFilterLabel(key, value) {
  const found = journalFilterOptions(key).find((o) => o.value === String(value));
  return found ? found.label : String(value);
}

/**
 * Какой фильтр живёт в столбце «Стадия».
 *
 * В архиве стадия у всех одна из двух, и отбирать по ней бессмысленно —
 * там в этом же столбце спрашивается «чем кончилось». Столбец один,
 * вопрос по смыслу тот же, поэтому и место одно.
 */
const journalStageFilterKey = () => (journalTab === "archive" ? "outcome" : "stage");

function journalFiltered() {
  const rows = (journalData?.rows || []).filter((r) =>
    journalTab === "archive" ? journalIsArchive(r) : !journalIsArchive(r));

  const q = journalFilters.q.trim().toLowerCase();
  return rows.filter((r) => {
    if (journalTab === "current" && journalFilters.stage !== "any" && r.stage !== journalFilters.stage) return false;
    if (journalTab === "archive" && journalFilters.outcome !== "any") {
      const kind = r.is_cancelled ? "cancelled" : "done";
      if (kind !== journalFilters.outcome) return false;
    }
    if (journalFilters.type !== "any") {
      const type = r.type || "none";
      if (type !== journalFilters.type) return false;
    }
    if (journalFilters.org !== "any" && String(r.organization || "") !== journalFilters.org) return false;
    if (journalFilters.expType !== "any" && String(r.expertise_type || "") !== journalFilters.expType) return false;
    if (journalFilters.year !== "any" && String(r.year || "") !== journalFilters.year) return false;
    if (journalFilters.manager !== "any" && String(r.manager_id || "") !== journalFilters.manager) return false;

    if (!q) return true;
    // Поиск идёт по тем же полям, по которым человек ищет глазами.
    return [r.name, r.court_or_customer, r.case_number, r.experts,
            r.organization, r.description, r.party1, r.party2, r.judge_name]
      .some((v) => String(v || "").toLowerCase().includes(q));
  });
}

function journalStageCell(row) {
  if (row.is_cancelled) return '<span class="stage-badge stage-cancelled">Отменён</span>';
  const cls = { plan: "stage-plan", active: "stage-active", control: "stage-control", done: "stage-done" }[row.stage];
  return `<span class="stage-badge ${cls}">${STAGE_LABEL[row.stage] || row.stage}</span>`;
}

/** Значение поля так, как его читает человек. */
function journalValue(row, key) {
  if (key === "type") {
    return row.type === "expertise" ? "Экспертизы"
      : row.type === "research" ? "Независимые исследования" : "";
  }
  if (key === "manager_id") return row.manager_name || "";
  return row[key] == null ? "" : String(row[key]);
}

function renderJournal() {
  if (!journalData) return;
  const all = journalData.rows || [];
  document.getElementById("jrCountCurrent").textContent = all.filter((r) => !journalIsArchive(r)).length;
  document.getElementById("jrCountArchive").textContent = all.filter(journalIsArchive).length;

  journalRowsShown = journalFiltered();
  renderJournalColFilters();
  renderJournalApplied();

  const box = document.getElementById("journalTableBox");
  if (!journalRowsShown.length) {
    box.innerHTML = `<div class="empty-hint" style="padding:28px;">${
      journalHasFilters() ? "Под эти условия ничего не подходит" : "В журнале пока пусто"
    }</div>`;
    renderJournalFoot();
    return;
  }

  const head = JOURNAL_COLUMNS.map((c) => {
    if (c.court) return "";
    const st = c.sticky ? ` jr-sticky jr-sticky${c.sticky}` : "";
    // jr-th-pick снимает у ячейки отступы и отдаёт их кнопке: нажимать
    // надо на всю ячейку, а не выцеливать надпись.
    const pick = c.filter ? " jr-th-pick" : "";
    return `<th class="${(st + pick).trim()}" rowspan="2" style="min-width:${c.width}px">${journalHeadHtml(c)}</th>`;
  }).join("");
  const courtCols = JOURNAL_COLUMNS.filter((c) => c.court);

  const body = journalRowsShown.map((row) => `
    <tr data-jr-row="${escapeHtml(row.id)}">
      ${JOURNAL_COLUMNS.map((c) => journalCellHtml(row, c)).join("")}
    </tr>`).join("");

  box.innerHTML = `
    <table class="jr-table">
      <thead>
        <tr>
          ${head}
          <th colspan="${courtCols.length}" class="jr-group">Поля судебных экспертиз</th>
        </tr>
        <tr>
          ${courtCols.map((c) => `<th class="jr-group" style="min-width:${c.width}px">${escapeHtml(c.title)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>`;

  wireJournalFilterButtons(box);
  wireJournalCells(box);
  renderJournalFoot();
}

/**
 * Шапка столбца. Там, где по столбцу можно отбирать, она же и кнопка
 * фильтра: отбор живёт в том самом столбце, к которому относится, а не
 * в отдельном ряду полей над таблицей, где ещё надо угадать, какое поле
 * какому столбцу соответствует.
 */
function journalHeadHtml(col) {
  const key = col.filter === "stage" ? journalStageFilterKey() : col.filter;
  if (!key) return escapeHtml(col.title);
  const active = journalFilters[key] !== "any";
  return `<button type="button" class="jr-th-btn${active ? " on" : ""}" data-jr-filter="${key}"
            aria-haspopup="listbox" title="${escapeHtml(active
              ? `Отобрано: ${journalFilterLabel(key, journalFilters[key])}`
              : "Отобрать по этому столбцу")}">
      <span class="jr-th-title">${escapeHtml(col.title)}</span>
      <span class="jr-th-caret" aria-hidden="true"></span>
    </button>`;
}

/**
 * Список значений столбца.
 *
 * Открывается с первого нажатия и закрывается сразу после выбора: это
 * отбор, а не форма, — отдельной кнопки «применить» тут быть не должно.
 */
let journalMenuAnchor = null;

function openJournalFilterMenu(button) {
  const key = button.dataset.jrFilter;
  closeJournalFilterMenu();

  const menu = document.createElement("div");
  menu.className = "jr-menu";
  menu.id = "jrFilterMenu";
  menu.setAttribute("role", "listbox");
  menu.innerHTML = journalFilterOptions(key).map((o) => `
    <button type="button" role="option" class="jr-menu-item${
      journalFilters[key] === o.value ? " on" : ""}" data-jr-pick="${escapeHtml(o.value)}"
      aria-selected="${journalFilters[key] === o.value}">${escapeHtml(o.label)}</button>`).join("");
  document.body.appendChild(menu);

  journalMenuAnchor = button;
  placeJournalFilterMenu();

  button.classList.add("open");
  menu.querySelectorAll("[data-jr-pick]").forEach((item) => {
    item.addEventListener("click", () => {
      const value = item.dataset.jrPick;
      closeJournalFilterMenu();
      setJournalFilter(key, value);
    });
  });
  (menu.querySelector(".jr-menu-item.on") || menu.querySelector(".jr-menu-item"))?.focus();
}

/**
 * Держим список под своей кнопкой.
 *
 * Лежит он на body, а не в таблице (у таблицы своя прокрутка и overflow —
 * внутри список обрезался бы по краю шапки), поэтому за кнопкой он сам
 * не ездит: при прокрутке пересчитываем. Закрывать на любую прокрутку
 * нельзя — браузер подкручивает страницу сам, и список успевал бы
 * закрыться раньше, чем человек до него дотянется.
 */
function placeJournalFilterMenu() {
  const menu = document.getElementById("jrFilterMenu");
  if (!menu || !journalMenuAnchor || !journalMenuAnchor.isConnected) return closeJournalFilterMenu();
  const box = journalMenuAnchor.getBoundingClientRect();
  // Кнопку увезли прокруткой за пределы экрана — списку висеть не над чем.
  if (box.bottom < 0 || box.top > window.innerHeight || box.right < 0 || box.left > window.innerWidth) {
    return closeJournalFilterMenu();
  }
  menu.style.minWidth = `${Math.max(box.width, 190)}px`;
  const left = Math.min(box.left, window.innerWidth - menu.offsetWidth - 12);
  menu.style.left = `${Math.max(8, left)}px`;
  // Снизу не помещается — открываем вверх.
  menu.style.top = (box.bottom + menu.offsetHeight + 12 > window.innerHeight && box.top > menu.offsetHeight)
    ? `${box.top - menu.offsetHeight - 4}px`
    : `${box.bottom + 4}px`;
}

function closeJournalFilterMenu() {
  document.getElementById("jrFilterMenu")?.remove();
  document.querySelectorAll(".jr-th-btn.open, .jr-colf.open").forEach((b) => b.classList.remove("open"));
  journalMenuAnchor = null;
}

// Щелчок мимо списка и Escape закрывают его. Вешаем один раз на
// документ: списки создаются и исчезают, а обработчик остаётся.
document.addEventListener("mousedown", (e) => {
  if (!document.getElementById("jrFilterMenu")) return;
  if (e.target.closest("#jrFilterMenu") || e.target.closest(".jr-th-btn")) return;
  closeJournalFilterMenu();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.getElementById("jrFilterMenu")) closeJournalFilterMenu();
});
// Таблица прокручивается вбок — список едет за своей кнопкой.
window.addEventListener("scroll", placeJournalFilterMenu, true);
window.addEventListener("resize", placeJournalFilterMenu);

function wireJournalFilterButtons(root) {
  root.querySelectorAll("[data-jr-filter]").forEach((button) => {
    // Слушаем ЯЧЕЙКУ целиком, а не кнопку внутри неё. Растянуть кнопку
    // на всю ячейку одной вёрсткой не выходит: высоту ячейке задаёт
    // соседний ряд шапки, и height:100% внутри неё ни на что не
    // опирается. А целиться в надпись, когда вокруг неё поля, которые
    // «не нажимаются», — худшее, что можно сделать с кнопкой.
    const target = button.closest("th") || button;
    target.addEventListener("click", () => {
      // Повторное нажатие по той же ячейке закрывает список — иначе
      // открытый список нечем убрать, кроме как выбрать что-нибудь.
      if (button.classList.contains("open")) return closeJournalFilterMenu();
      openJournalFilterMenu(button);
    });
  });
}

/** Те же отборы для узкого экрана, где шапки таблицы не видно. */
function renderJournalColFilters() {
  const node = document.getElementById("journalColFilters");
  node.innerHTML = JOURNAL_COLUMNS.filter((c) => c.filter).map((c) => {
    const key = c.filter === "stage" ? journalStageFilterKey() : c.filter;
    const active = journalFilters[key] !== "any";
    const title = key === "outcome" ? "Чем кончилось" : c.title;
    return `<button type="button" class="jr-colf${active ? " on" : ""}" data-jr-filter="${key}">
      ${escapeHtml(title)}${active ? `: <b>${escapeHtml(journalFilterLabel(key, journalFilters[key]))}</b>` : ""}
      <span class="jr-th-caret" aria-hidden="true"></span>
    </button>`;
  }).join("");
  wireJournalFilterButtons(node);
}

function journalCellHtml(row, col) {
  const sticky = col.sticky ? ` jr-sticky jr-sticky${col.sticky}` : "";
  if (col.key === "stage") {
    return `<td class="jr-cell${sticky}">${journalStageCell(row)}</td>`;
  }
  if (col.key === "name") {
    return `<td class="jr-cell${sticky}"><a href="/?section=case&id=${escapeHtml(row.id)}"
              class="jr-name" data-jr-open="${escapeHtml(row.id)}">${escapeHtml(row.name)}</a></td>`;
  }

  const value = journalValue(row, col.key);
  // Правку показываем только там, где она действительно возможна:
  // архив не трогаем, и без права записи на папку дела тоже.
  const editable = col.edit && row.can_write && !journalIsArchive(row);
  const cls = ["jr-cell", editable ? "jr-editable" : "", value ? "" : "jr-empty"].filter(Boolean).join(" ");
  const text = value || JOURNAL_EMPTY[col.key] || "—";
  // data-jr-key-label читает CSS: на телефоне строка разворачивается
  // карточкой, и подпись поля берётся отсюда, а не из шапки таблицы —
  // шапки там нет.
  return `<td class="${cls}" data-jr-key="${col.key}" data-jr-key-label="${escapeHtml(col.title)}"${editable ? ' tabindex="0"' : ""}
             title="${escapeHtml(value || "")}">${escapeHtml(text)}</td>`;
}

function renderJournalFoot() {
  const total = (journalData?.rows || []).filter((r) =>
    journalTab === "archive" ? journalIsArchive(r) : !journalIsArchive(r)).length;
  const shown = journalRowsShown.length;
  document.getElementById("journalFoot").innerHTML = `
    <span>${shown === total ? `Строк: ${total}` : `Показано ${shown} из ${total}`}</span>
    <span class="jr-foot-hint">Таблица прокручивается вбок — там поля судебных экспертиз${
      journalTab === "archive" ? "" : ". Щелчок по ячейке — правка, Esc — отмена"}</span>`;
}

function journalHasFilters() {
  return journalFilters.q.trim() !== "" ||
    ["stage", "outcome", "type", "org", "expType", "year", "manager"]
      .some((k) => journalFilters[k] !== "any");
}

/** Что именно сейчас отобрано — списком, чтобы это было видно, а не помнилось. */
function renderJournalApplied() {
  const node = document.getElementById("journalApplied");
  const items = [];
  const add = (key, title) => {
    if (journalFilters[key] === "any") return;
    items.push([key, title, journalFilterLabel(key, journalFilters[key])]);
  };
  if (journalFilters.q.trim()) items.push(["q", "Поиск", journalFilters.q.trim()]);
  if (journalTab === "current") add("stage", "Стадия");
  else add("outcome", "Чем кончилось");
  add("type", "Тип");
  add("org", "Структура");
  add("expType", "Тип экспертизы");
  add("year", "Год");
  add("manager", "Руководитель");

  if (!items.length) return (node.innerHTML = "");
  node.innerHTML = items.map(([key, title, value]) =>
    `<span class="jr-pill"><b>${escapeHtml(title)}:</b> ${escapeHtml(value)}
      <button type="button" data-jr-drop="${key}" aria-label="Убрать условие">✕</button></span>`).join("") +
    '<button type="button" class="jr-reset" id="jrResetBtn">Сбросить всё</button>';

  node.querySelectorAll("[data-jr-drop]").forEach((btn) => {
    btn.addEventListener("click", () => setJournalFilter(btn.dataset.jrDrop, btn.dataset.jrDrop === "q" ? "" : "any"));
  });
  bind(document.getElementById("jrResetBtn"), "click", resetJournalFilters);
}

/* Своё поле осталось только у поиска: он идёт сразу по девяти столбцам,
   и столбца, в шапку которого его можно было бы убрать, у него нет.
   Остальные отборы живут в шапках своих столбцов. */

function setJournalFilter(key, value) {
  journalFilters[key] = value;
  if (key === "q") document.getElementById("jrSearch").value = value;
  renderJournal();
}

function resetJournalFilters() {
  for (const key of Object.keys(journalFilters)) {
    journalFilters[key] = key === "q" ? "" : "any";
  }
  document.getElementById("jrSearch").value = "";
  renderJournal();
}

/* ---------- Правка прямо в ячейке ---------- */

let journalEditing = null; // чтобы не открыть две ячейки сразу

function wireJournalCells(box) {
  box.querySelectorAll("[data-jr-open]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      openCaseCard(link.dataset.jrOpen, true);
    });
  });
  box.querySelectorAll("td.jr-editable").forEach((cell) => {
    // Одного щелчка достаточно. Раньше правка открывалась двойным, и
    // чтобы добраться до списка, приходилось щёлкать трижды: два раза
    // по ячейке и ещё раз по появившемуся полю. Список — это выбор из
    // готового, а не набор текста; прятать его за тремя нажатиями не за
    // чем. Случайно испортить ничего нельзя: значение, которое не
    // поменяли, никуда не отправляется, а Esc закрывает правку.
    cell.addEventListener("click", () => startJournalEdit(cell));
    // С клавиатуры — Enter: иначе до правки не добраться без мыши.
    cell.addEventListener("keydown", (e) => {
      // Только с самой ячейки: Enter внутри уже открытого поля ввода
      // всплывает сюда же, и без этой проверки сохранение тут же
      // открывало бы правку заново — со старым значением, которое потом
      // затирало бы только что сохранённое.
      if (e.target !== cell) return;
      if (e.key === "Enter" && !journalEditing) { e.preventDefault(); startJournalEdit(cell); }
    });
  });
}

/** Узкий экран — это телефон: там правка выключена (см. стили). */
const journalNarrow = () => window.matchMedia("(max-width: 900px)").matches;

function startJournalEdit(cell) {
  if (journalEditing || journalNarrow()) return;
  const id = Number(cell.closest("tr").dataset.jrRow);
  const key = cell.dataset.jrKey;
  const row = (journalData.rows || []).find((r) => r.id === id);
  const column = JOURNAL_COLUMNS.find((c) => c.key === key);
  if (!row || !column) return;

  // Несколько специалистов в один <select> не влезают — для них своё
  // окно с галочками. Ячейку при этом не трогаем вовсе: правка идёт в
  // окне, и подменять её содержимое на время было бы мельтешением.
  if (column.edit === "experts") {
    openExpertsPicker(row, cell);
    return;
  }

  journalEditing = { cell, id, key, before: cell.innerHTML, className: cell.className };
  cell.classList.add("jr-editing");

  cell.innerHTML = column.edit === "text"
    ? `<input class="jr-input" value="${escapeHtml(row[key] == null ? "" : String(row[key]))}">`
    : `<select class="jr-input">${journalEditOptions(column.edit, row)}</select>`;

  const input = cell.querySelector(".jr-input");
  input.focus();
  if (input.select) input.select();
  // Список раскрываем сразу, тем же нажатием, которым открыли ячейку.
  // showPicker умеет не всякий браузер — если не умеет, останется
  // раскрытое поле с наведённым курсором, то есть на одно нажатие
  // меньше, чем было.
  if (input.tagName === "SELECT" && typeof input.showPicker === "function") {
    try { input.showPicker(); } catch (err) { /* браузер не разрешил — не беда */ }
  }

  // Выбор в списке — это уже решение: требовать после него ещё и Enter
  // значило бы добавить нажатие ради нажатия. У поля ввода иначе: там
  // человек ещё набирает, и решение — это Enter или уход из поля.
  if (input.tagName === "SELECT") {
    input.addEventListener("change", () => commitJournalEdit(input.value));
  }

  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === "Enter") commitJournalEdit(input.value);
    else cancelJournalEdit();
  });
  // Уход мышью в другое место — то же, что Enter: человек считает,
  // что уже сохранил. Молча терять правку нельзя.
  input.addEventListener("blur", () => {
    if (journalEditing && journalEditing.cell === cell) commitJournalEdit(input.value);
  });
}

function journalEditOptions(kind, row) {
  if (kind === "type") {
    return [["", "Без типа"], ["expertise", "Экспертизы"], ["research", "Независимые исследования"]]
      .map(([v, t]) => `<option value="${v}"${String(row.type || "") === v ? " selected" : ""}>${t}</option>`).join("");
  }
  if (kind === "manager") {
    return `<option value="">не назначен</option>` + (journalData.managers || [])
      .map((m) => `<option value="${m.id}"${String(row.manager_id || "") === String(m.id) ? " selected" : ""}>${escapeHtml(m.name)}</option>`)
      .join("");
  }
  if (kind.startsWith("list:")) {
    const name = kind.slice(5);
    const key = { organizations: "organization", expertise_types: "expertise_type", years: "year" }[name];
    const current = row[key] == null ? "" : String(row[key]);
    const values = ((journalData.lists || {})[name] || []).map(String);
    // Старое значение, заведённое до справочников, показываем отдельным
    // пунктом: иначе список молча подменил бы его первым попавшимся, а
    // человек бы об этом не узнал.
    const extra = current && !values.includes(current) ? [current] : [];
    return `<option value="">не указано</option>` +
      extra.map((v) => `<option value="${escapeHtml(v)}" selected>${escapeHtml(v)} — не из списка</option>`).join("") +
      values.map((v) => `<option value="${escapeHtml(v)}"${v === current ? " selected" : ""}>${escapeHtml(v)}</option>`).join("");
  }
  return "";
}

/**
 * Окно выбора специалистов.
 *
 * Их бывает несколько, поэтому не выпадающий список, а галочки. Пишем в
 * то же поле через запятую, каким оно было и раньше: так не ломаются ни
 * выгрузка, ни файл журнала в папке, ни старые записи.
 */
function openExpertsPicker(row, cell) {
  const overlay = document.getElementById("expertsOverlay");
  const box = document.getElementById("expertsPicker");
  const chosen = new Set(String(row.experts || "").split(",").map((x) => x.trim()).filter(Boolean));
  const people = journalData.experts || [];
  // Кто записан, но специалистом больше не значится, — показываем, а не
  // выбрасываем: сначала человек должен увидеть, что снимает.
  const strangers = [...chosen].filter((name) => !people.some((p) => p.name === name));

  box.innerHTML = (people.length || strangers.length)
    ? [...people.map((p) => [p.name, chosen.has(p.name), ""]),
       ...strangers.map((n) => [n, true, " — не значится специалистом"])]
        .map(([name, on, note]) => `
          <label class="picker-item">
            <input type="checkbox" value="${escapeHtml(name)}" ${on ? "checked" : ""}>
            <span>${escapeHtml(name)}<span class="access-hint">${escapeHtml(note)}</span></span>
          </label>`).join("")
    : '<p class="empty-hint">Специалистами никто не отмечен. Отметьте в «Настройки → Сотрудники».</p>';

  overlay.classList.remove("hidden");

  document.getElementById("expertsSave").onclick = async () => {
    const picked = [...box.querySelectorAll("input:checked")].map((i) => i.value);
    const value = picked.join(", ");
    try {
      const saved = await apiFetch(`/api/cases/${row.id}`, {
        method: "PATCH", body: JSON.stringify({ experts: value || null }),
      });
      Object.assign(row, saved);
      overlay.classList.add("hidden");
      const shown = journalValue(row, "experts");
      cell.textContent = shown || JOURNAL_EMPTY.experts || "—";
      cell.title = shown;
      cell.classList.toggle("jr-empty", !shown);
      cell.classList.add("jr-saved");
      setTimeout(() => cell.classList.remove("jr-saved"), 1400);
    } catch (err) {
      showToast("Не удалось сохранить: " + err.message);
    }
  };
}

const closeExpertsPicker = () =>
  document.getElementById("expertsOverlay").classList.add("hidden");

bind(document.getElementById("expertsCloseBtn"), "click", closeExpertsPicker);
// Esc и щелчок по затемнению — привычные способы уйти из окна. Без них
// окно закрывается только крестиком, и это замечают не сразу.
bind(document.getElementById("expertsOverlay"), "click", (e) => {
  if (e.target.id === "expertsOverlay") closeExpertsPicker();
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const overlay = document.getElementById("expertsOverlay");
  if (overlay && !overlay.classList.contains("hidden")) closeExpertsPicker();
});

function cancelJournalEdit() {
  if (!journalEditing) return;
  const { cell, before, className } = journalEditing;
  journalEditing = null;
  cell.className = className;
  cell.innerHTML = before;
}

/**
 * Сохранение идёт сразу, отдельной кнопки нет.
 *
 * Ячейка подсвечивается зелёным, только когда сервер ответил, — иначе
 * человек поверил бы браузеру, а изменение осталось бы в нём. При отказе
 * возвращаем как было и показываем причину: молча откатывать хуже, чем
 * не сохранить.
 */
async function commitJournalEdit(rawValue) {
  if (!journalEditing) return;
  const { cell, id, key, before, className } = journalEditing;
  const row = (journalData.rows || []).find((r) => r.id === id);
  journalEditing = null;

  const value = String(rawValue ?? "").trim();
  const wasValue = row[key] == null ? "" : String(row[key]);
  if (value === wasValue) {
    cell.className = className;
    cell.innerHTML = before;
    return;
  }

  cell.className = className + " jr-saving";
  cell.textContent = value || "…";

  try {
    const saved = await apiFetch(`/api/cases/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ [key]: value === "" ? null : value }),
    });
    // Перечитываем строку из ответа сервера, а не из того, что набрали:
    // сервер мог значение привести (например, номер дела) — и на экране
    // должно быть то, что действительно записалось.
    Object.assign(row, saved);
    if (key === "manager_id") {
      const manager = (journalData.managers || []).find((m) => String(m.id) === value);
      row.manager_name = manager ? manager.name : null;
    }
    const column = JOURNAL_COLUMNS.find((c) => c.key === key);
    const shown = journalValue(row, key);
    cell.className = ["jr-cell", "jr-editable", shown ? "" : "jr-empty", "jr-saved"].filter(Boolean).join(" ") +
      (column.sticky ? ` jr-sticky jr-sticky${column.sticky}` : "");
    cell.textContent = shown || JOURNAL_EMPTY[key] || "—";
    cell.title = shown;
    setTimeout(() => cell.classList.remove("jr-saved"), 1400);
    // Значения теперь только из справочников, новых появиться неоткуда —
    // пересобирать списки фильтров после правки больше не нужно.
  } catch (err) {
    cell.className = className;
    cell.innerHTML = before;
    showToast("Не удалось сохранить: " + err.message);
  }
}

/* ---------- Выгрузка ---------- */

/**
 * Скачивание идёт через blob, а не обычной ссылкой: запрос нужен POST
 * (в него уходит список строк) и с проверкой входа, а простая ссылка
 * ни того, ни другого не умеет.
 */
async function downloadJournal(ids, button) {
  const label = button.textContent;
  button.disabled = true;
  button.textContent = "Готовим файл…";
  try {
    const res = await fetch("/api/cases/journal/export", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids ? { ids } : {}),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `Ошибка ${res.status}`);
    }
    const name = ids ? "Журнал регистрации (выборка).xlsx" : "Журнал регистрации.xlsx";
    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Отпускаем память не сразу: часть браузеров не успевает начать
    // скачивание, если ссылку отозвать в тот же миг.
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    showToast(ids ? `Выгружено строк: ${ids.length}` : "Журнал выгружен");
  } catch (err) {
    showToast("Не удалось выгрузить: " + err.message);
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

/* ---------- Привязка элементов ---------- */

document.querySelectorAll("[data-jr-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    journalTab = tab.dataset.jrTab;
    document.querySelectorAll("[data-jr-tab]").forEach((t) => t.classList.toggle("active", t === tab));
    // Стадия и «чем кончилось» относятся к разным вкладкам — при
    // переключении сбрасываем обе, иначе список молча оказался бы пуст.
    journalFilters.stage = "any";
    journalFilters.outcome = "any";
    closeJournalFilterMenu();
    renderJournal();
  });
});

bind(document.getElementById("jrSearch"), "input", debounce((e) => {
  journalFilters.q = e.target.value;
  renderJournal();
}, 250));

bind(document.getElementById("journalExportSelBtn"), "click", (e) => {
  if (!journalRowsShown.length) return showToast("Нечего выгружать — под эти условия ничего не подходит");
  downloadJournal(journalRowsShown.map((r) => r.id), e.currentTarget);
});
bind(document.getElementById("journalExportAllBtn"), "click", (e) => downloadJournal(null, e.currentTarget));

/* ---------- Карточка проекта ----------
   Всё о проекте на одном экране и без папок: стадия, реквизиты, задачи и
   история. Открывается щелчком по названию проекта в списке задач, живёт
   по своему адресу (?section=case&id=11) — ссылку можно отправить
   коллеге, и F5 не выкидывает на файлы.

   Стадию отсюда не двигаем: перевод переносит папку на диске и меняет
   Planfix, и делается это в самой папке. Статус же меняется сразу — он
   ничего не двигает. */

let caseCardId = null;
let caseCardData = null;

// Подписи статусов проекта. Раньше они были только в разметке карточки
// правки, и показать статус текстом было нечем.
const STATUS_LABEL = { waiting: "Ожидание", in_progress: "В работе", problem: "Проблема" };

async function openCaseCard(id, pushHistory) {
  caseCardId = String(id);
  showSection("case", false);
  if (pushHistory && !PICKER_MODE) {
    history.pushState({ view: "section", section: "case", caseId: caseCardId },
      "", `/?section=case&id=${encodeURIComponent(caseCardId)}`);
  }
  await loadCaseCard();
}

async function loadCaseCard() {
  const body = document.getElementById("caseCardBody");
  const badges = document.getElementById("caseCardBadges");
  const actions = document.getElementById("caseCardActions");
  if (!body || !caseCardId) return;

  body.innerHTML = '<div class="empty-hint" style="padding:24px;">Загрузка…</div>';
  badges.innerHTML = "";
  actions.innerHTML = "";

  try {
    caseCardData = await apiFetch(`/api/cases/${encodeURIComponent(caseCardId)}/card`);
  } catch (err) {
    document.getElementById("caseCardName").textContent = "Проект";
    body.innerHTML = `<div class="empty-hint" style="padding:24px;">Не удалось открыть карточку: ${escapeHtml(err.message)}</div>`;
    return;
  }
  renderCaseCard(caseCardData);
}

function renderCaseCard(data) {
  const p = data.project;
  const canWrite = !!data.canWrite;
  document.getElementById("caseCardName").textContent = p.name;

  /* --- шапка: стадия, статус, тип, ссылка в картотеку --- */
  const typeLabel = caseTypeLabel(p.type, false);
  // Бейдж стадии здесь — не просто подпись, а тот же орган управления,
  // что в папке и в списке дел: щелчок открывает список, куда перевести.
  document.getElementById("caseCardBadges").innerHTML = `
    ${stagePickerHtml(p, { canWrite })}
    <span class="case-chip">${escapeHtml(STATUS_LABEL[p.status] || p.status || "")}</span>
    <span class="case-chip muted">${escapeHtml(typeLabel)}</span>
    ${kadLinkHtml(p)}
    ${copyCaseBtnHtml(p.name, p.case_number)}`;
  wireCopyCaseButtons(document.getElementById("caseCardBadges"));
  wireStagePickers(document.getElementById("caseCardBadges"), () => p, () => {
    loadCaseCard();
    loadColumnList("cases");
    registryCases = null;
  });

  /* --- кнопки --- */
  const actions = [`<button class="upload-btn" id="ccFolderBtn" type="button">Открыть папку</button>`];
  // Ссылка, а не кнопка: тогда работает «открыть в новой вкладке» средним
  // щелчком, и видно, куда ведёт. Адрес приходит с сервера — у дела, ещё
  // не заведённого в Planfix, ссылки просто нет.
  if (p.planfix_url) {
    actions.push(`<a class="upload-btn" id="ccPlanfixBtn" href="${escapeHtml(p.planfix_url)}"
                     target="_blank" rel="noopener noreferrer"
                     title="Открыть карточку этого проекта в Planfix">
        <svg viewBox="0 0 24 24"><path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M18 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/></svg>
        Открыть в Planfix
      </a>`);
  }
  if (canWrite && !p.is_cancelled) {
    actions.push(`<button class="upload-btn" id="ccEditBtn" type="button">Редактировать</button>`);
    actions.push(`<button class="create-btn" id="ccTaskBtn" type="button" style="height:34px;">Новая задача</button>`);
  }
  document.getElementById("caseCardActions").innerHTML = actions.join("");

  /* --- тело --- */
  // Стадия (и отмена) живут на бейдже в шапке карточки — здесь остаётся
  // только статус. Двух мест для одного действия быть не должно.
  const statusBlock = canWrite && !p.is_cancelled ? `
    <div class="case-status-row">
      <span class="case-status-label">Статус</span>
      <select id="ccStatus">
        <option value="waiting"${p.status === "waiting" ? " selected" : ""}>Ожидание</option>
        <option value="in_progress"${p.status === "in_progress" ? " selected" : ""}>В работе</option>
        <option value="problem"${p.status === "problem" ? " selected" : ""}>Проблема</option>
      </select>
      <span class="case-status-hint">меняется сразу</span>

    </div>` : "";

  const cancelled = p.is_cancelled ? `
    <p class="case-cancelled">Проект отменён${p.cancel_reason ? `: ${escapeHtml(p.cancel_reason)}` : "."}</p>` : "";

  const readonly = !canWrite ? `
    <p class="case-readonly">Только просмотр: права на изменение этого проекта не выданы.</p>` : "";

  document.getElementById("caseCardBody").innerHTML = `
    ${cancelled}${readonly}${statusBlock}
    <div class="case-grid">
      <div>
        ${caseCardTasksHtml(data)}
      </div>
      <div>
        ${caseCardFactsHtml(p, canWrite)}
        ${caseCardHistoryHtml(data)}
      </div>
    </div>`;

  wireCaseCard(data);
  // Ассистент — это разговор о проекте, а не о файлах, поэтому он живёт
  // здесь же, под карточкой.
  openCaseChatFor(p.id);
}

function caseCardTasksHtml(data) {
  const c = data.taskCounts;
  const parts = [`${plural(c.open, "открытая", "открытых", "открытых")}`];
  if (c.overdue) parts.push(`${plural(c.overdue, "просрочена", "просрочено", "просрочено")}`);
  if (c.done) parts.push(`${plural(c.done, "завершена", "завершены", "завершено")}`);

  if (!data.hasPlanfix) {
    return `<h3 class="case-sec">Задачи</h3>
      <p class="empty-hint">Задач нет: проект ещё не заведён в Planfix, а задачи живут там.</p>`;
  }
  if (!data.tasks.length) {
    return `<h3 class="case-sec">Задачи</h3>
      <p class="empty-hint">По этому проекту задач пока не ставили.</p>`;
  }

  const rows = data.tasks.map((t) => `
    <div class="case-task${t.is_done ? " is-done" : ""}" data-cc-task="${t.id}">
      ${t.is_done
        ? `<span class="tick on" title="Завершена">${svgCheck}</span>`
        : t.can_write
          ? `<button class="tick" type="button" data-cc-complete="${t.id}" title="Завершить задачу" aria-label="Завершить задачу"></button>`
          : ""}
      <span class="case-task-name" data-cc-open="${t.id}">${escapeHtml(t.name)}</span>
      ${dueBadgeHtml(t)}
      <span class="case-task-meta">${
        t.is_done
          ? `завершена${t.completed_at ? " " + fmtDate(t.completed_at) : ""}`
          : `${t.due_iso ? fmtDate(t.due_iso) : "без срока"}${t.assignees ? " · " + escapeHtml(t.assignees) : ""}`
      }</span>
      ${t.can_remove
        ? `<button class="task-del-btn" type="button" data-delete-task="${t.id}"
                   data-task-name="${escapeHtml(t.name)}"
                   title="Убрать задачу" aria-label="Убрать задачу">✕</button>`
        : ""}
    </div>`).join("");

  return `<h3 class="case-sec">Задачи · ${parts.join(", ")}</h3><div class="case-tasks">${rows}</div>`;
}

function caseCardFactsHtml(p, canWrite) {
  const rows = [
    ["Вид экспертизы", p.expertise_type],
    ["Суд / заказчик", p.court_or_customer],
    ["Номер дела / договора", p.case_number],
    ["Судья", p.judge_name],
    ["Сторона 1", p.party1],
    ["Сторона 2", p.party2],
    ["Эксперты", p.experts],
    ["Руководитель", p.manager_name],
    ["Организация", p.organization],
    ["Год", p.year],
    ["Описание", p.description],
  ];
  // Заполненные показываем строками, а незаполненные — одной строкой
  // списком. Одиннадцать подряд «не заполнено» ничего не сообщают, кроме
  // того, что карточку не вели: перечисление короче и читается сразу.
  const filled = rows.filter(([, v]) => v !== null && v !== undefined && v !== "");
  const missing = rows.filter(([, v]) => v === null || v === undefined || v === "").map(([l]) => l);

  const html = filled.map(([label, value]) => `
    <dt>${label}</dt><dd>${escapeHtml(String(value))}</dd>`).join("");

  return `<h3 class="case-sec">Реквизиты</h3>
    <dl class="case-facts">${html}
      <dt>Папка</dt><dd class="case-path">${escapeHtml(p.folder_path)}</dd>
    </dl>
    ${missing.length ? `<p class="case-missing">Не заполнено: ${escapeHtml(missing.join(", ").toLowerCase())}.${
      // Про «Редактировать» говорим только тому, у кого эта кнопка есть.
      canWrite ? " Поправить можно в «Редактировать»." : ""}</p>` : ""}`;
}

function caseCardHistoryHtml(data) {
  if (!data.history.length) return "";
  const rows = data.history.map((h) => {
    const label = (CASE_ACTIONS[h.action] || h.action);
    return `<div class="case-ev">
      <div class="case-ev-name">${escapeHtml(label)}</div>
      <div class="case-ev-meta">${fmtDate(h.created_at)}${
        h.actor_name ? " · " + escapeHtml(h.actor_name) : ""}${
        h.note ? " · " + escapeHtml(h.note) : ""}</div>
    </div>`;
  }).join("");
  return `<h3 class="case-sec" style="margin-top:22px;">История проекта</h3>${rows}`;
}

/** Понятные названия для записей case_history. */
const CASE_ACTIONS = {
  created: "Проект создан",
  updated: "Карточка проекта изменена",
  stage: "Смена стадии",
  cancel: "Проект отменён",
  court_event: "Применено решение суда",
  restore: "Проект восстановлен",
};

function wireCaseCard(data) {
  const p = data.project;

  bind(document.getElementById("ccFolderBtn"), "click", () => {
    // Раздел переключаем без записи в историю: запись делает goToFolder.
    // Иначе на переход в папку уходило две записи, и «назад» возвращало
    // не в карточку, а в промежуточное состояние.
    showSection("files", false);
    goToFolder(p.folder_path,
      buildTrailExtending([{ label: "Дела", path: CASES_PATH }], CASES_PATH, p.folder_path), true);
  });

  const editBtn = document.getElementById("ccEditBtn");
  if (editBtn) editBtn.addEventListener("click", () => openCaseEdit(p));

  const taskBtn = document.getElementById("ccTaskBtn");
  // Проект уже известен — окно открываем с закреплённым проектом, как из
  // его папки: менять его в этом окне незачем.
  if (taskBtn) taskBtn.addEventListener("click", () => openTaskNew(p));

  // Статус меняем сразу, без кнопки «Сохранить»: это одно поле, и лишний
  // шаг тут только мешает. При отказе возвращаем прежнее значение.

  const status = document.getElementById("ccStatus");
  if (status) {
    status.addEventListener("change", async () => {
      const chosen = status.value;
      const before = p.status;
      status.disabled = true;
      try {
        await apiFetch(`/api/cases/${p.id}`, {
          method: "PATCH", body: JSON.stringify({ status: chosen }),
        });
        p.status = chosen;
        showToast("Статус проекта изменён");
        loadCaseCard();
      } catch (err) {
        status.value = before;
        alert("Не удалось изменить статус: " + err.message);
      } finally {
        status.disabled = false;
      }
    });
  }

  const body = document.getElementById("caseCardBody");
  body.querySelectorAll("[data-cc-open]").forEach((el) => {
    el.addEventListener("click", () => openTaskCard(el.dataset.ccOpen));
  });
  body.querySelectorAll("[data-cc-complete]").forEach((btn) => {
    btn.addEventListener("click", () => completeTask(btn.dataset.ccComplete, btn, () => loadCaseCard()));
  });
  body.querySelectorAll("[data-delete-task]").forEach((btn) => {
    btn.addEventListener("click", () =>
      deleteTask(btn.dataset.deleteTask, btn, () => loadCaseCard(), btn.dataset.taskName));
  });
}

bind(document.getElementById("caseCardBackBtn"), "click", () => history.back());

/* ---- Управление списком организаций ("Структура") ---- */

/* Окно «Организации (Структура)» убрано отсюда: список переехал в
   «Настройки → Справочники». Править его может только администратор, а
   здесь кнопка стояла у всех и упиралась в отказ сервера. */

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
    expertise_type: document.getElementById("pfExpertiseType").value.trim() || null,
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
    // Карточке нужен ещё и номер проекта — иначе «назад» из папки
    // возвращало бы на пустой экран карточки.
    if (state.section === "registry") {
      registryStage = state.stage || null;
      showSection("registry", false);
      renderRegistry();
      return;
    }
    if (state.section === "case" && state.caseId) {
      caseCardId = String(state.caseId);
      showSection("case", false);
      loadCaseCard();
      return;
    }
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
  updateExpertButton(path);
  updateEquipment(path);
  try {
    // В корне стадии список делится по типу проекта — значит типы нужны
    // до отрисовки, иначе группы «прыгнут» уже после показа.
    if (STAGE_ROOT_PATHS.includes(path)) await loadCaseTypes();
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
  { type: "expertise", label: "Экспертизы", test: (name) => name.startsWith("ЭКС.") },
  { type: "research", label: "Независимые исследования", test: (name) => name.startsWith("НИ.") },
  { type: null, label: "Прочее", test: () => true },
];

/**
 * Тип проекта по пути его папки — из карточек, а не из названия папки.
 *
 * Раньше группа определялась только префиксом («ЭКС.», «НИ.»), и проект
 * с названием вроде «ЭКСПЕРТИЗА НИЦ» падал в «Прочее», хотя это
 * экспертиза. Теперь решает тип в карточке, а префикс остаётся запасным
 * вариантом для папок, за которыми проекта нет вообще.
 */
let caseTypeByFolder = null;

async function loadCaseTypes(force = false) {
  if (caseTypeByFolder && !force) return caseTypeByFolder;
  try {
    const list = await apiFetch("/api/cases");
    caseTypeByFolder = new Map(list.map((c) => [c.folder_path, c.type || null]));
  } catch {
    // Без карточек просто откатываемся на префиксы — список всё равно
    // покажется, просто разложится как раньше.
    caseTypeByFolder = new Map();
  }
  return caseTypeByFolder;
}

function groupIndexFor(entry) {
  const known = caseTypeByFolder && caseTypeByFolder.has(entry.fullPath)
    ? caseTypeByFolder.get(entry.fullPath)
    : undefined;
  if (known !== undefined) {
    const byType = PROJECT_GROUPS.findIndex((g) => g.type === known);
    if (byType >= 0) return byType;
  }
  return PROJECT_GROUPS.findIndex((g) => g.test(entry.name));
}

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
    groups[groupIndexFor(entry)].items.push(entry);
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
      paths.map((p) => deleteResource(p))
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
  const inExperts = path === EXPERTS_PATH || path.startsWith(EXPERTS_PATH + "/");
  ctxMenuEl.querySelector('[data-ctx-action="move"]').classList.toggle("hidden", inCases);

  // Справочник экспертов управляется формой: иначе переименование или
  // удаление папки обойдёт связи пунктов, сканов и сгенерированных файлов.
  for (const action of ["rename", "move", "copy", "delete"]) {
    ctxMenuEl.querySelector(`[data-ctx-action="${action}"]`)?.classList.toggle(
      "hidden", inExperts || (action === "move" && inCases));
  }

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
        const res = await deleteResource(target.path);
        if (res === null) return;
        refreshContext(target.context);
        refreshTrashBadge();
        reportClosedCases(res);
      } catch (err) {
        alert("Не удалось удалить: " + err.message);
      }
    }
  });
});


/**
 * Удаление с оглядкой на защищённые папки.
 *
 * Сервер сам решает, что защищено, и отвечает 409 с объяснением —
 * тогда спрашиваем ещё раз и повторяем с подтверждением. Сотруднику
 * сервер отвечает 403, и мы просто показываем, почему нельзя.
 */
async function deleteResource(path) {
  try {
    return await apiFetch(`/api/resources?path=${encodeURIComponent(path)}`, { method: "DELETE" });
  } catch (err) {
    if (err.status === 409 && err.data && err.data.needsForce) {
      const ok = confirm(
        err.data.message + "\n\n" +
        "Вы администратор, поэтому удалить всё-таки можно. Папка вернётся при следующей сверке, " +
        "а её содержимое окажется в корзине.\n\nУдалить?"
      );
      if (!ok) return null;
      return apiFetch(`/api/resources?path=${encodeURIComponent(path)}&force=1`, { method: "DELETE" });
    }
    throw err;
  }
}

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
  } catch (err) {
    showLogin();
  }
})();
