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
  uploadPanelCloseBtn: document.getElementById("uploadPanelCloseBtn"),
  uploadTriggerBtn: document.getElementById("uploadTriggerBtn"),
  uploadFolderInput: document.getElementById("uploadFolderInput"),
  uploadChoice: document.getElementById("uploadChoice"),
  chooseFilesBtn: document.getElementById("chooseFilesBtn"),
  chooseFolderBtn: document.getElementById("chooseFolderBtn"),
  folderActions: document.getElementById("folderActions"),
  selectModeBtn: document.getElementById("selectModeBtn"),
  selectionBar: document.getElementById("selectionBar"),
  selectionCount: document.getElementById("selectionCount"),
  downloadSelectedBtn: document.getElementById("downloadSelectedBtn"),
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
  selectDbBtn: document.getElementById("selectDbBtn"),
  dbToolbar: document.getElementById("dbToolbar"),
  dbSelectionBar: document.getElementById("dbSelectionBar"),
  dbSelectionCount: document.getElementById("dbSelectionCount"),
  dbDownloadSelectedBtn: document.getElementById("dbDownloadSelectedBtn"),
  dbDeleteSelectedBtn: document.getElementById("dbDeleteSelectedBtn"),
  dbCancelSelectBtn: document.getElementById("dbCancelSelectBtn"),
  selectCasesBtn: document.getElementById("selectCasesBtn"),
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
};

const svgFolder = `<svg class="icon" viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>`;
const svgFile = `<svg class="icon" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>`;
const svgLink = `<svg class="icon" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>`;
const svgTrash = `<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>`;
const svgDownload = `<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8"><path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>`;
const svgDots = `<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:currentColor;stroke:none"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>`;
const svgRename = `<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;

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

  if (allowed.length === 1 && (allowed[0] === "db" || allowed[0] === "cases")) {
    singleColumnMode = allowed[0];
    els.backBtn.classList.add("hidden");
  } else {
    singleColumnMode = null;
    els.backBtn.classList.remove("hidden");
  }

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

els.selectDbBtn.addEventListener("click", () => enterColumnSelectMode("db"));
els.selectCasesBtn.addEventListener("click", () => enterColumnSelectMode("cases"));
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
  container.innerHTML = "";
  if (sorted.length === 0) {
    container.innerHTML = `<div class="empty-hint">${state.searching ? "Ничего не найдено" : "Здесь пока пусто"}</div>`;
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
    row.innerHTML = `
      ${selState.active ? `<input type="checkbox" class="select-checkbox" ${selState.selected.has(entry.fullPath) ? "checked" : ""}>` : ""}
      <span style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
        ${entry.isDir ? svgFolder : svgFile}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${entry.name}</span>${pathHint}
      </span>
      ${selState.active ? "" : `<button class="download-btn" title="Скачать" aria-label="Скачать">${svgDownload}</button>`}
      ${selState.active ? "" : `<button class="rename-btn" title="Переименовать" aria-label="Переименовать">${svgRename}</button>`}
      ${selState.active || !canManagePerms ? "" : `<button class="perm-btn" title="Доступ" aria-label="Доступ">${svgDots}</button>`}
      ${selState.active ? "" : `<button class="delete-btn" title="Удалить" aria-label="Удалить">${svgTrash}</button>`}
    `;
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
    if (!selState.active) {
      row.querySelector(".download-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        requestDownload([{ path: entry.fullPath, isDir: entry.isDir }]);
      });
      row.querySelector('[title="Переименовать"]').addEventListener("click", (e) => {
        e.stopPropagation();
        promptRename(entry.fullPath, entry.name, () => {
          if (state.searching) {
            searchColumn(key, colRefs(key).searchInput.value.trim());
          } else {
            loadColumnList(key);
          }
        }, entry.isDir);
      });
      if (canManagePerms) {
        row.querySelector('[title="Доступ"]').addEventListener("click", (e) => {
          e.stopPropagation();
          openFolderPermissions(entry.fullPath, entry.name);
        });
      }
      row.querySelector('[title="Удалить"]').addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!confirm(`Удалить «${entry.name}»?`)) return;
        try {
          await apiFetch(`/api/resources?path=${encodeURIComponent(entry.fullPath)}`, { method: "DELETE" });
          if (state.searching) {
            searchColumn(key, colRefs(key).searchInput.value.trim());
          } else {
            loadColumnList(key);
          }
        } catch (err) {
          alert("Не удалось удалить: " + err.message);
        }
      });
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
  const expertPaths = [...els.gpExpertsList.querySelectorAll('input[type="checkbox"]:checked')]
    .map((cb) => cb.value);

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
const NEXT_STAGE = { plan: "active", active: "control", control: "done" };

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
  if (!path.startsWith(CASES_PATH)) {
    banner.classList.add("hidden");
    return;
  }
  try {
    const project = await apiFetch(`/api/cases/by-path?path=${encodeURIComponent(path)}`);
    renderCaseBanner(project);
  } catch {
    banner.classList.add("hidden");
  }
}

function renderCaseBanner(project) {
  const banner = document.getElementById("caseBanner");
  const next = NEXT_STAGE[project.stage];

  const actions = [];
  if (!project.is_cancelled && next) {
    actions.push(`<button class="upload-btn" id="caseAdvanceBtn" type="button">Перевести на стадию «${STAGE_LABEL[next]}» →</button>`);
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
      advanceBtn.disabled = true;
      try {
        await apiFetch(`/api/cases/${project.id}/advance`, { method: "POST" });
        // Баннер виден только когда стоишь ровно в папке проекта — значит
        // этот самый путь только что переехал и больше не существует.
        // Поднимаемся к колонкам и обновляем список "Дела".
        goToColumns(true);
        loadColumnList("cases");
      } catch (err) {
        alert("Не удалось перевести на следующую стадию: " + err.message);
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

async function openProjectForm() {
  els.projectFormError.textContent = "";
  els.projectForm.reset();
  await loadOrganizationsSelect();

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
  };

  try {
    await apiFetch("/api/cases", { method: "POST", body: JSON.stringify(body) });
    els.projectFormOverlay.classList.add("hidden");
    // Обновляем список: если мы сейчас внутри "Дела" — перерисовываем
    // открытую папку, иначе (на экране колонок) — саму колонку "Дела".
    if (currentPath && currentPath.startsWith(CASES_PATH)) {
      renderFolder(currentPath);
    } else {
      loadColumnList("cases");
    }
  } catch (err) {
    els.projectFormError.textContent = err.message;
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
    els.folderList.innerHTML = `<div class="empty-hint">${folderSearching ? "Ничего не найдено" : "Папка пуста"}</div>`;
    return;
  }
  for (const entry of list) {
    const row = document.createElement("div");
    row.className = "file-row" + (selectMode ? " selectable" : "") + (selectedPaths.has(entry.fullPath) ? " selected" : "");
    const pathHint = folderSearching
      ? `<span class="search-path-hint">${entry.fullPath}</span>`
      : "";
    row.innerHTML = `
      ${selectMode ? `<input type="checkbox" class="select-checkbox" ${selectedPaths.has(entry.fullPath) ? "checked" : ""}>` : ""}
      <div class="left">${entry.isDir ? svgFolder : svgFile}<span>${entry.name}</span>${pathHint}</div>
      <div class="right">
        <span class="size">${entry.isDir ? "" : formatSize(entry.size)}</span>
        ${selectMode ? "" : `<button class="download-btn" title="Скачать" aria-label="Скачать">${svgDownload}</button>`}
        ${selectMode ? "" : `<button class="rename-btn" title="Переименовать" aria-label="Переименовать">${svgRename}</button>`}
        ${selectMode || !canManagePerms ? "" : `<button class="perm-btn" title="Доступ" aria-label="Доступ">${svgDots}</button>`}
        ${selectMode ? "" : `<button class="delete-btn" title="Удалить" aria-label="Удалить">${svgTrash}</button>`}
      </div>
    `;
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
    if (!selectMode) {
      row.querySelector(".download-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        requestDownload([{ path: entry.fullPath, isDir: entry.isDir }]);
      });
      row.querySelector('[title="Переименовать"]').addEventListener("click", (e) => {
        e.stopPropagation();
        promptRename(entry.fullPath, entry.name, () => {
          if (folderSearching) {
            searchFolder(els.folderSearchInput.value.trim());
          } else {
            renderFolder(currentPath);
          }
        }, entry.isDir);
      });
    }
    if (!selectMode && canManagePerms) {
      row.querySelector('[title="Доступ"]').addEventListener("click", (e) => {
        e.stopPropagation();
        openFolderPermissions(entry.fullPath, entry.name);
      });
    }
    if (!selectMode) {
      row.querySelector('[title="Удалить"]').addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!confirm(`Удалить «${entry.name}»?`)) return;
        try {
          await apiFetch(`/api/resources?path=${encodeURIComponent(entry.fullPath)}`, { method: "DELETE" });
          if (folderSearching) {
            searchFolder(els.folderSearchInput.value.trim());
          } else {
            renderFolder(currentPath);
          }
        } catch (err) {
          alert("Не удалось удалить: " + err.message);
        }
      });
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

function renderBreadcrumbs() {
  els.breadcrumbs.innerHTML = "";
  currentTrail.forEach((crumb, i) => {
    const span = document.createElement("span");
    span.className = "crumb" + (i === currentTrail.length - 1 ? " current" : "");
    span.textContent = crumb.label;
    if (i !== currentTrail.length - 1) {
      span.addEventListener("click", () => {
        const trail = currentTrail.slice(0, i + 1);
        goToFolder(crumb.path, trail, true);
      });
    }
    els.breadcrumbs.appendChild(span);
    if (i < currentTrail.length - 1) {
      const sep = document.createElement("span");
      sep.textContent = "›";
      sep.style.color = "var(--text-muted)";
      els.breadcrumbs.appendChild(sep);
    }
  });
}

els.backBtn.addEventListener("click", () => {
  goToColumns(true);
});

/* ---------- Режим выбора (массовое удаление / скачивание) ---------- */

els.selectModeBtn.addEventListener("click", () => {
  selectMode = true;
  selectedPaths = new Set();
  els.folderActions.classList.add("hidden");
  els.selectionBar.classList.remove("hidden");
  updateSelectionBar();
  renderFolderRows();
});

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

/* ---------- Upload (с наглядным прогрессом) ---------- */

const svgCheck = `<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2.5"><path d="M20 6 9 17l-5-5"/></svg>`;
const svgError = `<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2.5"><path d="M12 8v5M12 16h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>`;

let activeUploadItems = [];

els.uploadTriggerBtn.addEventListener("click", () => {
  els.uploadPanel.classList.remove("hidden");
  els.uploadPanelTitle.textContent = "Что загрузить?";
  els.uploadChoice.classList.remove("hidden");
  els.uploadPanelList.innerHTML = "";
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
  if (files.length > 0) uploadFiles(files);
});

els.uploadFolderInput.addEventListener("change", () => {
  const files = Array.from(els.uploadFolderInput.files || []);
  els.uploadFolderInput.value = "";
  if (files.length > 0) uploadFiles(files);
});

els.uploadPanelCloseBtn.addEventListener("click", () => {
  els.uploadPanel.classList.add("hidden");
});

function uploadFiles(files) {
  const targetPath = currentPath;
  els.uploadChoice.classList.add("hidden");

  activeUploadItems = files.map((file, i) => ({
    id: `${Date.now()}_${i}`,
    file,
    name: file.webkitRelativePath || file.name,
    progress: 0,
    status: "uploading", // uploading | done | error
    error: "",
  }));

  els.uploadPanel.classList.remove("hidden");
  renderUploadPanel();

  let remaining = activeUploadItems.length;

  for (const item of activeUploadItems) {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", item.file);
    form.append("path", targetPath);
    // Если файл выбран как часть папки — сохраняем структуру подпапок на сервере.
    if (item.file.webkitRelativePath) {
      form.append("relativePath", item.file.webkitRelativePath);
    }

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        item.progress = Math.round((e.loaded / e.total) * 100);
        renderUploadPanel();
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        item.status = "done";
        item.progress = 100;
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
      remaining--;
      renderUploadPanel();
      if (remaining === 0) {
        renderFolder(targetPath);
        if (!activeUploadItems.some((i) => i.status === "error")) {
          setTimeout(() => {
            els.uploadPanel.classList.add("hidden");
          }, 1800);
        }
      }
    }
  }
}

function renderUploadPanel() {
  const doneCount = activeUploadItems.filter((i) => i.status === "done").length;
  els.uploadPanelTitle.textContent = `Загрузка файлов (${doneCount}/${activeUploadItems.length})`;

  els.uploadPanelList.innerHTML = "";
  for (const item of activeUploadItems) {
    const row = document.createElement("div");
    row.className = "upload-item";
    const statusHtml =
      item.status === "done" ? `<span class="upload-item-status status-done">${svgCheck}</span>`
      : item.status === "error" ? `<span class="upload-item-status status-error">${svgError}</span>`
      : `<span class="upload-item-status">${item.progress}%</span>`;
    row.innerHTML = `
      <div class="upload-item-top">
        <span class="upload-item-name">${item.name}</span>
        ${statusHtml}
      </div>
      <div class="upload-progress-track">
        <div class="upload-progress-fill ${item.status}" style="width:${item.status === "error" ? 100 : item.progress}%;"></div>
      </div>
      ${item.status === "error" ? `<div class="upload-item-error">${item.error}</div>` : ""}
    `;
    els.uploadPanelList.appendChild(row);
  }
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
