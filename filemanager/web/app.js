/* ============================================================
   НАСТРОЙКИ — правьте здесь
   ============================================================ */

// Какую папку показывать в колонке "База данных" ("/" = корень)
const DB_PATH = "/";

// Какую папку показывать в колонке "Дела"
const CASES_PATH = "/";

// Ссылки в колонке "Инструменты"
const TOOLS_LINKS = [
  { label: "Учёт приборов", url: "https://imcstroy.ru" },
];

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
  officeOverlay: document.getElementById("officeOverlay"),
  officeTitle: document.getElementById("officeTitle"),
  officeEditorHolder: document.getElementById("officeEditorHolder"),
  officeCloseBtn: document.getElementById("officeCloseBtn"),
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

/* ---------- Login ---------- */

els.loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  els.loginError.textContent = "";
  const username = document.getElementById("loginUsername").value;
  const password = document.getElementById("loginPassword").value;
  try {
    await apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
    showApp();
    loadColumns();
  } catch (err) {
    els.loginError.textContent = "Не удалось войти: проверьте логин и пароль";
  }
});

els.logoutBtn.addEventListener("click", async () => {
  try { await apiFetch("/api/auth/logout", { method: "POST" }); } catch (e) {}
  showLogin();
});

/* ---------- Columns ---------- */

function renderToolsColumn() {
  els.toolsList.innerHTML = "";
  if (TOOLS_LINKS.length === 0) {
    els.toolsList.innerHTML = '<div class="empty-hint">Ссылок пока нет</div>';
    return;
  }
  for (const link of TOOLS_LINKS) {
    const a = document.createElement("a");
    a.className = "row-item";
    a.href = link.url;
    a.target = "_blank";
    a.rel = "noopener";
    a.innerHTML = svgLink + `<span>${link.label}</span>`;
    els.toolsList.appendChild(a);
  }
}

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
  renderToolsColumn();
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

async function openFolder(path, rootLabel) {
  currentTrail = [{ label: rootLabel, path: "/" }, { label: path.split("/").filter(Boolean).pop(), path }];
  await renderFolder(path);
  els.columnsView.classList.add("hidden");
  els.folderView.classList.remove("hidden");
}

async function renderFolder(path) {
  currentPath = path;
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
      row.querySelector(".left").addEventListener("click", () => {
        if (entry.isDir) {
          currentTrail.push({ label: entry.name, path: nextPath });
          renderFolder(nextPath);
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
        currentTrail = currentTrail.slice(0, i + 1);
        renderFolder(crumb.path);
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
  els.folderView.classList.add("hidden");
  els.columnsView.classList.remove("hidden");
  currentTrail = [];
  loadColumns();
});

/* ---------- Upload ---------- */

els.uploadInput.addEventListener("change", async () => {
  const files = Array.from(els.uploadInput.files || []);
  for (const file of files) {
    const form = new FormData();
    form.append("file", file);
    form.append("path", currentPath);
    try {
      await fetch("/api/upload", { method: "POST", credentials: "same-origin", body: form });
    } catch (err) {
      alert("Не удалось загрузить файл " + file.name);
    }
  }
  els.uploadInput.value = "";
  renderFolder(currentPath);
});

/* ---------- Open file (OnlyOffice or download) ---------- */

let officeScriptLoaded = false;
let currentEditor = null;

function loadOfficeScript(src) {
  return new Promise((resolve, reject) => {
    if (officeScriptLoaded) return resolve();
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => { officeScriptLoaded = true; resolve(); };
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

async function openFile(relPath, fileName) {
  const ext = extOf(fileName);
  if (ext === "pdf") {
    window.open(`/api/download?path=${encodeURIComponent(relPath)}`, "_blank");
    return;
  }
  if (!OFFICE_EXTS.has(ext)) {
    window.location.href = `/api/download?path=${encodeURIComponent(relPath)}`;
    return;
  }
  try {
    const { config, scriptUrl } = await apiFetch(`/api/onlyoffice/config?path=${encodeURIComponent(relPath)}`);
    await loadOfficeScript(scriptUrl);
    els.officeTitle.textContent = fileName;
    els.officeEditorHolder.innerHTML = "";
    els.officeOverlay.classList.remove("hidden");
    currentEditor = new DocsAPI.DocEditor("officeEditorHolder", config);
  } catch (err) {
    alert("Не удалось открыть документ: " + err.message);
  }
}

els.officeCloseBtn.addEventListener("click", () => {
  els.officeOverlay.classList.add("hidden");
  els.officeEditorHolder.innerHTML = "";
  currentEditor = null;
});

/* ---------- Init ---------- */

(async function init() {
  try {
    await apiFetch("/api/auth/me");
    showApp();
    loadColumns();
  } catch (err) {
    showLogin();
  }
})();
