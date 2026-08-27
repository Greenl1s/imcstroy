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
  equipmentBtn: document.getElementById("equipmentBtn"),
  addProjectBtn: document.getElementById("addProjectBtn"),
  projectFormOverlay: document.getElementById("projectFormOverlay"),
  projectFormCloseBtn: document.getElementById("projectFormCloseBtn"),
  projectForm: document.getElementById("projectForm"),
  projectFormError: document.getElementById("projectFormError"),
  uploadInput: document.getElementById("uploadInput"),
  mkdirDbBtn: document.getElementById("mkdirDbBtn"),
  mkdirCasesBtn: document.getElementById("mkdirCasesBtn"),
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
  addMenuBtn: document.getElementById("addMenuBtn"),
  addMenu: document.getElementById("addMenu"),
  addFolderOption: document.getElementById("addFolderOption"),
  addDocxOption: document.getElementById("addDocxOption"),
  addXlsxOption: document.getElementById("addXlsxOption"),
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
  addGpBtn: document.getElementById("addGpBtn"),
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
  gpExpertsOrderBox: document.getElementById("gpExpertsOrderBox"),
  gpExpertsOrderList: document.getElementById("gpExpertsOrderList"),
};

const svgFolder = `<svg class="icon" viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>`;
const svgFile = `<svg class="icon" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>`;
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
function sortEntries(entries, sortMode) {
  const [field, dir] = (sortMode || "name-asc").split("-");
  const mul = dir === "desc" ? -1 : 1;
  const folders = entries.filter((e) => e.isDir)
    .sort((a, b) => a.name.localeCompare(b.name, "ru", { numeric: true }) * mul);
  const files = entries.filter((e) => !e.isDir)
    .sort((a, b) => {
      if (field === "size") return ((a.size || 0) - (b.size || 0)) * mul;
      return a.name.localeCompare(b.name, "ru", { numeric: true }) * mul;
    });
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

/* ---------- Права доступа и адаптация интерфейса под пользователя ---------- */

let currentUser = null;
// Если у пользователя открыт доступ ровно к одному разделу с файлами
// ("db" или "cases") — работаем сразу в нём, без экрана с колонками.
let singleColumnMode = null;

function applyPermissionsUI() {
  const p = currentUser || {};
  document.querySelector('[data-col="tools"]').classList.toggle("hidden", !p.can_tools);
  document.querySelector('[data-col="db"]').classList.toggle("hidden", !p.can_db);
  document.querySelector('[data-col="cases"]').classList.toggle("hidden", !p.can_cases);

  const allowed = [];
  if (p.can_tools) allowed.push("tools");
  if (p.can_db) allowed.push("db");
  if (p.can_cases) allowed.push("cases");

  // Если раздел всего один, экрана с колонками нет — значит и подниматься
  // из корня этого раздела некуда.
  singleColumnMode = allowed.length === 1 && (allowed[0] === "db" || allowed[0] === "cases")
    ? allowed[0]
    : null;

  return allowed;
}

// Запускает подходящий начальный экран после входа/загрузки страницы.
function enterAppForUser() {
  const allowed = applyPermissionsUI();

  if (allowed.length === 0) {
    showColumnsUI();
    els.columnsView.innerHTML =
      '<div class="empty-hint" style="padding:2rem;">Нет доступа ни к одному разделу. Обратитесь к администратору.</div>';
    return;
  }

  if (singleColumnMode === "db") {
    goToFolder(DB_PATH, [{ label: "База данных", path: DB_PATH }], false);
  } else if (singleColumnMode === "cases") {
    goToFolder(CASES_PATH, [{ label: "Дела", path: CASES_PATH }], false);
  } else {
    showColumnsUI();
    loadColumns();
  }
}

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
  singleColumnMode = null;
  showLogin();
});

els.equipmentBtn.addEventListener("click", () => {
  location.href = "/instruments/";
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
      <span class="user-name">${u.username}</span>
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
      .map((u) => `<option value="${u.id}">${u.username}</option>`)
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
    els.folderPermList.innerHTML = '<div class="empty-hint">Не удалось загрузить</div>';
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
      <span class="user-name">${perm.username}</span>
      <span class="role-badge">${FOLDER_ACCESS_LABEL[perm.access] || perm.access}</span>
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

async function loadToolsColumn() {
  els.toolsList.innerHTML = '<div class="empty-hint">Загрузка…</div>';
  try {
    const { links } = await apiFetch("/api/tools");
    renderToolsColumn(links);
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
  if (!links || links.length === 0) {
    els.toolsList.innerHTML = '<div class="empty-hint">Ссылок пока нет</div>';
    return;
  }
  for (const link of links) {
    const row = document.createElement("div");
    row.className = "row-item";
    row.style.justifyContent = "space-between";
    // Внутренняя ссылка — если после разбора у неё тот же домен, что и у
    // текущей страницы (неважно, записана она относительным путём вроде
    // "/instruments/" или полным адресом "https://files.imcstroy.ru/instruments/").
    // Такие открываем в этой же вкладке. Настоящие внешние — как раньше, в новой.
    const isInternal = isSameOriginUrl(link.url);
    const linkAttrs = isInternal ? "" : 'target="_blank" rel="noopener"';
    row.innerHTML = `
      <a href="${link.url}" ${linkAttrs} style="display:flex;align-items:center;gap:10px;color:inherit;text-decoration:none;flex:1;min-width:0;">
        ${svgLink}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${link.label}</span>
      </a>
      <button class="delete-btn" title="Удалить ссылку" aria-label="Удалить ссылку">${svgTrash}</button>
    `;
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
  if (!confirm(`Удалить выбранное (${st.selected.size})? Это действие необратимо.`)) return;
  const paths = [...st.selected];
  try {
    const results = await Promise.allSettled(
      paths.map((p) => apiFetch(`/api/resources?path=${encodeURIComponent(p)}`, { method: "DELETE" }))
    );
    const failed = results.filter((r) => r.status === "rejected");
    exitColumnSelectMode(key);
    await loadColumnList(key);
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
    container.innerHTML = `<div class="empty-hint">${
      state.searching
        ? "Ничего не найдено"
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
      ? `<span class="search-path-hint" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${entry.fullPath}</span>`
      : "";
    const canManagePerms = key === "cases" && currentUser && currentUser.role === "admin";
    if (entry.isDir) row.classList.add("is-dir");
    row.innerHTML = `
      ${selState.active ? `<input type="checkbox" class="select-checkbox" ${selState.selected.has(entry.fullPath) ? "checked" : ""}>` : ""}
      <span style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
        ${iconHtml(entry)}<span class="row-name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${entry.name}</span>${pathHint}
      </span>
      ${selState.active || !canManagePerms ? "" : `<button class="perm-btn" title="Доступ" aria-label="Доступ">${svgDots}</button>`}
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
  loadToolsColumn();
  els.dbSearchInput.value = "";
  els.casesSearchInput.value = "";
  loadColumnList("db");
  loadColumnList("cases");
}

els.mkdirDbBtn.addEventListener("click", () => createFolderIn(DB_PATH, () => loadColumnList("db")));
els.mkdirCasesBtn.addEventListener("click", () => createFolderIn(CASES_PATH, () => loadColumnList("cases")));

async function createFolderIn(basePath, onDone) {
  const name = prompt("Название новой папки:");
  if (!name) return;
  const target = (basePath.endsWith("/") ? basePath : basePath + "/") + name;
  try {
    await apiFetch("/api/folder", { method: "POST", body: JSON.stringify({ path: target }) });
    onDone();
  } catch (err) {
    alert("Не удалось создать папку: " + err.message);
  }
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
  els.gpOverlay.classList.remove("hidden");

  gpExpertOrder = [];
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
      label.style.cssText = "display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer;";
      label.innerHTML = `<input type="checkbox" value="${expert.path}"> <span>${expert.name}</span>`;
      const checkbox = label.querySelector("input");
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          gpExpertOrder.push({ path: expert.path, name: expert.name });
        } else {
          gpExpertOrder = gpExpertOrder.filter((e) => e.path !== expert.path);
        }
        renderGpExpertsOrder();
      });
      els.gpExpertsList.appendChild(label);
    }
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

els.addGpBtn.addEventListener("click", openGpForm);
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

/* ---------- Добавить (новая папка / docx / xlsx) в текущей папке ---------- */

els.addMenuBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  els.addMenu.classList.toggle("hidden");
});

document.addEventListener("click", () => {
  els.addMenu.classList.add("hidden");
});

els.addMenu.addEventListener("click", (e) => e.stopPropagation());

els.addFolderOption.addEventListener("click", async () => {
  els.addMenu.classList.add("hidden");
  const name = prompt("Название новой папки:");
  if (!name) return;
  try {
    await apiFetch("/api/folder", { method: "POST", body: JSON.stringify({ path: joinPath(currentPath, name) }) });
    renderFolder(currentPath);
  } catch (err) {
    alert("Не удалось создать папку: " + err.message);
  }
});

els.addDocxOption.addEventListener("click", () => createNewDocument("docx", "текстового документа"));
els.addXlsxOption.addEventListener("click", () => createNewDocument("xlsx", "таблицы"));

async function createNewDocument(type, label) {
  els.addMenu.classList.add("hidden");
  const name = prompt(`Название ${label} (можно без расширения):`);
  if (name === null) return;
  try {
    const { name: savedName } = await apiFetch("/api/create-file", {
      method: "POST",
      body: JSON.stringify({ path: currentPath, type, name }),
    });
    await renderFolder(currentPath);
    openFile(joinPath(currentPath, savedName), savedName);
  } catch (err) {
    alert("Не удалось создать документ: " + err.message);
  }
}

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
    openCaseChatFor(project.id);
    openPlanfixTasksFor(project);
  } catch {
    banner.classList.add("hidden");
    chatBox.classList.add("hidden");
    tasksBox.classList.add("hidden");
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

/* ---- Задачи Planfix для текущей стадии ---- */

let planfixTasksCurrentProject = null;
let planfixEmployeesCache = null;

function openPlanfixTasksFor(project) {
  const box = document.getElementById("planfixTasksBox");
  box.classList.remove("hidden");
  if (planfixTasksCurrentProject && planfixTasksCurrentProject.id === project.id) return;
  planfixTasksCurrentProject = project;
  document.getElementById("planfixTasksList").innerHTML = "";
  document.getElementById("planfixTasksError").textContent = "";
  document.getElementById("planfixTasksBody").classList.add("hidden");
  document.getElementById("planfixTasksArrow").textContent = "▾";
}

document.getElementById("planfixTasksToggle").addEventListener("click", async () => {
  const body = document.getElementById("planfixTasksBody");
  const arrow = document.getElementById("planfixTasksArrow");
  const opening = body.classList.contains("hidden");
  body.classList.toggle("hidden");
  arrow.textContent = opening ? "▴" : "▾";
  if (opening && planfixTasksCurrentProject) {
    await loadPlanfixTasksList();
  }
});

let planfixTaskRowCounter = 0;

/** Собирает HTML одной строки задачи. custom=true — добавляет кнопку удаления (для задач, вписанных вручную). */
function buildPlanfixTaskRowHtml(name, custom) {
  const i = planfixTaskRowCounter++;
  const employeeOptions = ['<option value="">Не назначен</option>']
    .concat((planfixEmployeesCache || []).map((e) => `<option value="${e.id}">${escapeHtml(e.name)}</option>`))
    .join("");
  return `
    <div class="pf-task-row" data-custom="${custom ? "1" : "0"}">
      <label class="pf-task-title">
        <input type="checkbox" class="pf-task-check" data-task-index="${i}" ${custom ? "checked" : ""}>
        <span>${escapeHtml(name)}</span>
        ${custom ? `<button type="button" class="pf-task-remove" data-remove-index="${i}" style="margin-left:auto; border:none; background:none; color:var(--danger); cursor:pointer; font-size:14px;">✕</button>` : ""}
      </label>
      <div class="pf-task-details ${custom ? "" : "hidden"}" data-task-details="${i}">
        <select class="pf-task-assignee">${employeeOptions}</select>
        <input type="date" class="pf-task-deadline">
      </div>
    </div>`;
}

function wirePlanfixTaskRow(row) {
  const list = document.getElementById("planfixTasksList");
  const check = row.querySelector(".pf-task-check");
  check.addEventListener("change", () => {
    const details = list.querySelector(`[data-task-details="${check.dataset.taskIndex}"]`);
    details.classList.toggle("hidden", !check.checked);
  });
  const removeBtn = row.querySelector(".pf-task-remove");
  if (removeBtn) {
    removeBtn.addEventListener("click", () => row.remove());
  }
}

async function loadPlanfixTasksList() {
  const list = document.getElementById("planfixTasksList");
  const errorEl = document.getElementById("planfixTasksError");
  errorEl.textContent = "";
  list.innerHTML = '<div class="row-subtitle">Загрузка…</div>';
  planfixTaskRowCounter = 0;

  try {
    if (!planfixEmployeesCache) {
      const { employees } = await apiFetch("/api/cases/planfix/employees");
      planfixEmployeesCache = employees || [];
    }
    const { tasks } = await apiFetch(`/api/cases/planfix/stage-tasks/${planfixTasksCurrentProject.stage}`);

    list.innerHTML = tasks.length
      ? tasks.map((t) => buildPlanfixTaskRowHtml(t.name, false)).join("")
      : '<div class="row-subtitle">Для этой стадии типовых задач не предусмотрено</div>';

    list.querySelectorAll(".pf-task-row").forEach(wirePlanfixTaskRow);
  } catch (err) {
    list.innerHTML = "";
    errorEl.textContent = "Не удалось загрузить: " + err.message;
  }
}

document.getElementById("planfixCustomTaskAddBtn").addEventListener("click", async () => {
  const input = document.getElementById("planfixCustomTaskInput");
  const name = input.value.trim();
  if (!name || !planfixTasksCurrentProject) return;

  const errorEl = document.getElementById("planfixTasksError");
  errorEl.textContent = "";

  // Сохраняем в общий справочник — чтобы задача появилась у всех
  // проектов на этой же стадии, а не только в этом одном месте.
  try {
    await apiFetch("/api/cases/planfix/stage-tasks", {
      method: "POST",
      body: JSON.stringify({ stage: planfixTasksCurrentProject.stage, name }),
    });
  } catch (err) {
    // "уже есть в списке" — не страшно, просто добавляем в форму как обычно.
    if (!/уже есть/.test(err.message)) {
      errorEl.textContent = "Не удалось сохранить в общий список: " + err.message;
      return;
    }
  }

  const list = document.getElementById("planfixTasksList");
  // Если список сейчас пуст/показывает подсказку "нет задач" — очищаем перед вставкой первой своей.
  if (!list.querySelector(".pf-task-row")) list.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.innerHTML = buildPlanfixTaskRowHtml(name, true).trim();
  const row = wrapper.firstElementChild;
  list.appendChild(row);
  wirePlanfixTaskRow(row);

  input.value = "";
  input.focus();
});

document.getElementById("planfixCustomTaskInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    document.getElementById("planfixCustomTaskAddBtn").click();
  }
});

document.getElementById("planfixTasksCreateBtn").addEventListener("click", async () => {
  const errorEl = document.getElementById("planfixTasksError");
  errorEl.textContent = "";

  const rows = document.querySelectorAll("#planfixTasksList .pf-task-row");
  const tasks = [];
  rows.forEach((row) => {
    const check = row.querySelector(".pf-task-check");
    if (!check.checked) return;
    const name = row.querySelector(".pf-task-title span").textContent;
    const assigneeId = row.querySelector(".pf-task-assignee").value || null;
    const deadline = row.querySelector(".pf-task-deadline").value || null;
    tasks.push({ name, assigneeId, deadline });
  });

  if (!tasks.length) {
    errorEl.textContent = "Отметьте хотя бы одну задачу";
    return;
  }

  const btn = document.getElementById("planfixTasksCreateBtn");
  btn.disabled = true;
  btn.textContent = "Создаём…";

  try {
    const { results } = await apiFetch(`/api/cases/${planfixTasksCurrentProject.id}/planfix-tasks`, {
      method: "POST",
      body: JSON.stringify({ tasks }),
    });
    const failed = results.filter((r) => !r.ok);
    if (failed.length) {
      errorEl.textContent = `Не удалось создать: ${failed.map((f) => `«${f.name}» (${f.error})`).join(", ")}`;
    } else {
      errorEl.textContent = "";
      alert(`Создано задач в Planfix: ${results.length}`);
      // Снимаем галочки с успешно созданных, чтобы не создать их повторно случайно.
      document.querySelectorAll("#planfixTasksList .pf-task-check:checked").forEach((cb) => {
        cb.checked = false;
        document.querySelector(`[data-task-details="${cb.dataset.taskIndex}"]`).classList.add("hidden");
      });
    }
  } catch (err) {
    errorEl.textContent = "Не удалось создать задачи: " + err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Создать в Planfix";
  }
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
  const container = document.getElementById(zone === "zapros" ? "pfAttachZaprosList" : "pfAttachMaterialsList");
  container.innerHTML = pfPendingFiles[zone]
    .map((f, i) => `
      <div class="pf-attach-file-row">
        <span>${escapeHtml(f.name)}</span>
        <button type="button" data-remove-zone="${zone}" data-remove-index="${i}">✕</button>
      </div>`)
    .join("");
  container.querySelectorAll("[data-remove-index]").forEach((btn) => {
    btn.addEventListener("click", () => {
      pfPendingFiles[btn.dataset.removeZone].splice(Number(btn.dataset.removeIndex), 1);
      renderPendingFileList(btn.dataset.removeZone);
    });
  });
}

function wireAttachZone(zone, buttonId, inputId) {
  const button = document.getElementById(buttonId);
  const input = document.getElementById(inputId);
  button.addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    for (const file of input.files) pfPendingFiles[zone].push(file);
    input.value = ""; // чтобы можно было выбрать тот же файл повторно, если удалили и передумали
    renderPendingFileList(zone);
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

  async function uploadZone(files, category) {
    if (!files.length) return;
    const formData = new FormData();
    for (const f of files) formData.append("files", f);
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

els.addProjectBtn.addEventListener("click", openProjectForm);
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
    history.pushState({ view: "columns" }, "");
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
    history.pushState({ view: "folder", path, trail }, "");
  }
}

window.addEventListener("popstate", (e) => {
  const state = e.state;
  if (!state || state.view === "columns") {
    if (singleColumnMode) {
      const rootPath = singleColumnMode === "db" ? DB_PATH : CASES_PATH;
      const rootLabel = singleColumnMode === "db" ? "База данных" : "Дела";
      goToFolder(rootPath, [{ label: rootLabel, path: rootPath }], false);
    } else {
      goToColumns(false);
    }
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
    els.folderList.innerHTML = '<div class="empty-hint">Не удалось загрузить содержимое</div>';
  }
}

// Перерисовывает список из уже загруженных данных (currentFolderEntries
// либо, в режиме поиска, folderSearchResults) — без повторного запроса
// к серверу. Используется при переключении режима выбора, отметке
// чекбоксов и смене сортировки.
function renderFolderRows() {
  const source = folderSearching ? folderSearchResults : currentFolderEntries;
  const list = sortEntries(source, els.folderSortSelect.value);
  const inCasesTree = currentTrail[0] && currentTrail[0].path === CASES_PATH;
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
  for (const entry of list) {
    const row = document.createElement("div");
    row.className = "file-row" + (entry.isDir ? " is-dir" : "") + (selectMode ? " selectable" : "") + (selectedPaths.has(entry.fullPath) ? " selected" : "");
    const pathHint = folderSearching
      ? `<span class="search-path-hint">${entry.fullPath}</span>`
      : "";
    row.innerHTML = `
      ${selectMode ? `<input type="checkbox" class="select-checkbox" ${selectedPaths.has(entry.fullPath) ? "checked" : ""}>` : ""}
      <div class="left">${iconHtml(entry)}<span class="row-name">${entry.name}</span>${pathHint}</div>
      <div class="right">
        <span class="size">${entry.isDir ? "" : formatSize(entry.size)}</span>
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
  // Из корня единственного доступного раздела подниматься некуда.
  const canGoUp = currentTrail.length > 1 || !singleColumnMode;
  els.backBtn.classList.toggle("hidden", !canGoUp);
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
  if (!confirm(`Удалить выбранное (${selectedPaths.size})? Это действие необратимо.`)) return;
  const paths = [...selectedPaths];
  try {
    const results = await Promise.allSettled(
      paths.map((p) => apiFetch(`/api/resources?path=${encodeURIComponent(p)}`, { method: "DELETE" }))
    );
    const failed = results.filter((r) => r.status === "rejected");
    exitSelectMode(false);
    await renderFolder(currentPath);
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

/* ---------- Контекстное меню (правый клик по файлу/папке) ---------- */

let ctxMenuTarget = null; // { path, name, isDir, context }
const ctxMenuEl = document.getElementById("itemContextMenu");

function showContextMenu(event, path, name, isDir, context) {
  ctxMenuTarget = { path, name, isDir, context };

  // В "Дела" перемещение вручную отключено — папки переезжают сами при
  // смене стадии проекта. Пункт меню показываем только вне "Дела".
  const inCases = context === "cases" || path.startsWith(CASES_PATH);
  ctxMenuEl.querySelector('[data-ctx-action="move"]').classList.toggle("hidden", inCases);

  const menuWidth = 190, menuHeight = 230; // с запасом, чтобы не вылезало за край экрана
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
    } else if (action === "delete") {
      if (!confirm(`Удалить «${target.name}»?`)) return;
      try {
        await apiFetch(`/api/resources?path=${encodeURIComponent(target.path)}`, { method: "DELETE" });
        refreshContext(target.context);
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

els.uploadTriggerBtn.addEventListener("click", () => {
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
  if (files.length > 0) uploadFiles(files, currentPath, () => renderFolder(currentPath));
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
    if (els.uploadPanelTotalFill.style.width !== width) {
      els.uploadPanelTotalFill.style.width = width;
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
      nodes.fill.style.width = width;
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

async function performZipDownload(paths) {
  try {
    const res = await fetch("/api/download-zip", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || "HTTP " + res.status);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "files.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert("Не удалось скачать: " + err.message);
  }
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

    fill.style.height = `${data.percentUsed}%`;
    fill.classList.remove("rail-disk-warn", "rail-disk-danger");
    if (data.percentUsed >= 90) fill.classList.add("rail-disk-danger");
    else if (data.percentUsed >= 75) fill.classList.add("rail-disk-warn");

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
  } catch (err) {
    showLogin();
  }
})();
