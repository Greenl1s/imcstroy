/* ============================================================
   НАСТРОЙКИ
   ============================================================ */

// У каждой колонки — своя папка, чтобы содержимое не пересекалось.
// Можно поменять на любые другие подпапки, если понадобится.
const DB_PATH = "/База данных";
const CASES_PATH = "/Дела";

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
};

const svgFolder = `<svg class="icon" viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>`;
const svgFile = `<svg class="icon" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>`;
const svgLink = `<svg class="icon" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>`;
const svgTrash = `<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>`;

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
    row.innerHTML = `
      <a href="${link.url}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:10px;color:inherit;text-decoration:none;flex:1;min-width:0;">
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

function renderFileColumn(container, items, sourcePath, rootLabel) {
  container.innerHTML = "";
  const entries = [
    ...(items.folders || []).map((f) => ({ ...f, isDir: true })),
    ...(items.files || []).map((f) => ({ ...f, isDir: false })),
  ];
  if (entries.length === 0) {
    container.innerHTML = '<div class="empty-hint">Здесь пока пусто</div>';
    return;
  }
  for (const entry of entries) {
    const row = document.createElement("div");
    row.className = "row-item";
    row.innerHTML = (entry.isDir ? svgFolder : svgFile) + `<span>${entry.name}</span>`;
    row.addEventListener("click", () => {
      const nextPath = (sourcePath.endsWith("/") ? sourcePath : sourcePath + "/") + entry.name;
      if (entry.isDir) {
        openFolder(nextPath, rootLabel);
      } else {
        openFile(nextPath, entry.name);
      }
    });
    container.appendChild(row);
  }
}

async function loadColumns() {
  loadToolsColumn();
  try {
    const db = await apiFetch(`/api/resources?path=${encodeURIComponent(DB_PATH)}`);
    renderFileColumn(els.dbList, db, DB_PATH, "База данных");
  } catch (err) {
    els.dbList.innerHTML = '<div class="empty-hint">Не удалось загрузить</div>';
  }
  try {
    const cases = await apiFetch(`/api/resources?path=${encodeURIComponent(CASES_PATH)}`);
    renderFileColumn(els.casesList, cases, CASES_PATH, "Дела");
  } catch (err) {
    els.casesList.innerHTML = '<div class="empty-hint">Не удалось загрузить</div>';
  }
}

els.mkdirDbBtn.addEventListener("click", () => createFolderIn(DB_PATH, loadColumns));
els.mkdirCasesBtn.addEventListener("click", () => createFolderIn(CASES_PATH, loadColumns));

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

/* ---------- Folder (single big panel) view ---------- */

let currentPath = "/";
let currentTrail = [];

function showColumnsUI() {
  els.folderView.classList.add("hidden");
  els.columnsView.classList.remove("hidden");
}

function showFolderUI() {
  els.columnsView.classList.add("hidden");
  els.folderView.classList.remove("hidden");
}

// Переход в колонки. pushHistory=false используется при обработке
// кнопки "назад" браузера, чтобы не создавать новую запись в истории.
function goToColumns(pushHistory) {
  currentTrail = [];
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
  showFolderUI();
  renderFolder(path);
  if (pushHistory) {
    history.pushState({ view: "folder", path, trail }, "");
  }
}

function openFolder(path, rootLabel) {
  const trail = [{ label: rootLabel, path: "/" }, { label: path.split("/").filter(Boolean).pop(), path }];
  goToFolder(path, trail, true);
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
  renderBreadcrumbs();
  els.folderList.innerHTML = '<div class="empty-hint">Загрузка…</div>';
  try {
    const data = await apiFetch(`/api/resources?path=${encodeURIComponent(path)}`);
    const entries = [
      ...(data.folders || []).map((f) => ({ ...f, isDir: true })),
      ...(data.files || []).map((f) => ({ ...f, isDir: false })),
    ];
    els.folderList.innerHTML = "";
    if (entries.length === 0) {
      els.folderList.innerHTML = '<div class="empty-hint">Папка пуста</div>';
      return;
    }
    for (const entry of entries) {
      const row = document.createElement("div");
      row.className = "file-row";
      const nextPath = (path.endsWith("/") ? path : path + "/") + entry.name;
      row.innerHTML = `
        <div class="left">${entry.isDir ? svgFolder : svgFile}<span>${entry.name}</span></div>
        <div class="right">
          <span class="size">${entry.isDir ? "" : formatSize(entry.size)}</span>
          <button class="delete-btn" title="Удалить" aria-label="Удалить">${svgTrash}</button>
        </div>
      `;
      row.addEventListener("click", () => {
        if (entry.isDir) {
          const trail = [...currentTrail, { label: entry.name, path: nextPath }];
          goToFolder(nextPath, trail, true);
        } else {
          openFile(nextPath, entry.name);
        }
      });
      row.querySelector(".delete-btn").addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!confirm(`Удалить «${entry.name}»?`)) return;
        try {
          await apiFetch(`/api/resources?path=${encodeURIComponent(nextPath)}`, { method: "DELETE" });
          renderFolder(path);
        } catch (err) {
          alert("Не удалось удалить: " + err.message);
        }
      });
      els.folderList.appendChild(row);
    }
  } catch (err) {
    els.folderList.innerHTML = '<div class="empty-hint">Не удалось загрузить содержимое</div>';
  }
}

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

/* ---------- Upload (с наглядным прогрессом) ---------- */

const svgCheck = `<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2.5"><path d="M20 6 9 17l-5-5"/></svg>`;
const svgError = `<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2.5"><path d="M12 8v5M12 16h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>`;

let activeUploadItems = [];

els.uploadInput.addEventListener("change", () => {
  const files = Array.from(els.uploadInput.files || []);
  els.uploadInput.value = "";
  if (files.length > 0) uploadFiles(files);
});

els.uploadPanelCloseBtn.addEventListener("click", () => {
  els.uploadPanel.classList.add("hidden");
});

function uploadFiles(files) {
  const targetPath = currentPath;
  activeUploadItems = files.map((file, i) => ({
    id: `${Date.now()}_${i}`,
    file,
    name: file.name,
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
  const ext = extOf(fileName);
  if (ext === "pdf") {
    window.open(`/api/view?path=${encodeURIComponent(relPath)}`, "_blank");
    return;
  }
  if (OFFICE_EXTS.has(ext)) {
    window.open(`/office.html?path=${encodeURIComponent(relPath)}`, "_blank");
    return;
  }
  window.location.href = `/api/download?path=${encodeURIComponent(relPath)}`;
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
