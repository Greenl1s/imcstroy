/* ============================================================
   НАСТРОЙКИ — правьте здесь, когда разложите папки по местам
   ============================================================ */

// Название источника в FileBrowser Quantum (сайдбар -> "Files")
const SOURCE_NAME = "Files";

// Какую папку показывать в колонке "База данных"
// "/" = корень источника. Позже замените на нужную подпапку, например "/02.База данных"
const DB_PATH = "/";

// Какую папку показывать в колонке "Дела"
const CASES_PATH = "/";

// Ссылки в колонке "Инструменты" — добавляйте/меняйте свободно
const TOOLS_LINKS = [
  { label: "Учёт приборов", url: "https://imcstroy.ru" },
  { label: "OnlyOffice",    url: "https://office.imcstroy.ru" },
];

/* ============================================================
   Ниже — логика, обычно трогать не нужно
   ============================================================ */

const API_BASE = ""; // пусто = запросы идут на тот же домен (panel.imcstroy.ru), Caddy проксирует /api на files

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
};

const svgFolder = `<svg class="icon" viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>`;
const svgFile = `<svg class="icon" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>`;
const svgLink = `<svg class="icon" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>`;

function formatSize(bytes) {
  if (bytes === undefined || bytes === null) return "";
  if (bytes < 1024) return bytes + " Б";
  const units = ["КБ", "МБ", "ГБ", "ТБ"];
  let val = bytes / 1024;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return val.toFixed(1) + " " + units[i];
}

async function apiFetch(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    credentials: "same-origin",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    showLogin("Сессия истекла, войдите заново");
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || ("HTTP " + res.status));
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
    await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    showApp();
    loadColumns();
  } catch (err) {
    els.loginError.textContent = "Не удалось войти: проверьте логин и пароль";
  }
});

els.logoutBtn.addEventListener("click", async () => {
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } catch (e) {
    /* игнорируем ошибку выхода */
  }
  showLogin();
});

/* ---------- Columns (Инструменты / База данных / Дела) ---------- */

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

function renderFileColumn(container, items, sourcePath) {
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
        openFolder(nextPath, container === els.dbList ? "База данных" : "Дела");
      }
    });
    container.appendChild(row);
  }
}

async function loadColumns() {
  renderToolsColumn();
  try {
    const db = await apiFetch(`/api/resources?path=${encodeURIComponent(DB_PATH)}&source=${encodeURIComponent(SOURCE_NAME)}`);
    renderFileColumn(els.dbList, db, DB_PATH);
  } catch (err) {
    els.dbList.innerHTML = '<div class="empty-hint">Не удалось загрузить</div>';
  }
  try {
    const cases = await apiFetch(`/api/resources?path=${encodeURIComponent(CASES_PATH)}&source=${encodeURIComponent(SOURCE_NAME)}`);
    renderFileColumn(els.casesList, cases, CASES_PATH);
  } catch (err) {
    els.casesList.innerHTML = '<div class="empty-hint">Не удалось загрузить</div>';
  }
}

/* ---------- Folder (single big panel) view ---------- */

let currentTrail = []; // массив {label, path}

async function openFolder(path, rootLabel) {
  currentTrail = [{ label: rootLabel, path: "/" }, { label: path.split("/").filter(Boolean).pop(), path }];
  await renderFolder(path);
  els.columnsView.classList.add("hidden");
  els.folderView.classList.remove("hidden");
}

async function renderFolder(path) {
  renderBreadcrumbs();
  els.folderList.innerHTML = '<div class="empty-hint">Загрузка…</div>';
  try {
    const data = await apiFetch(`/api/resources?path=${encodeURIComponent(path)}&source=${encodeURIComponent(SOURCE_NAME)}`);
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
      row.innerHTML = `
        <div class="left">${entry.isDir ? svgFolder : svgFile}<span>${entry.name}</span></div>
        <span class="size">${entry.isDir ? "" : formatSize(entry.size)}</span>
      `;
      if (entry.isDir) {
        row.addEventListener("click", () => {
          const nextPath = (path.endsWith("/") ? path : path + "/") + entry.name;
          currentTrail.push({ label: entry.name, path: nextPath });
          renderFolder(nextPath);
        });
      }
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
});

/* ---------- Init ---------- */

(async function init() {
  try {
    // проверяем, есть ли уже активная сессия (cookie)
    await apiFetch(`/api/resources?path=%2F&source=${encodeURIComponent(SOURCE_NAME)}`);
    showApp();
    loadColumns();
  } catch (err) {
    showLogin();
  }
})();
