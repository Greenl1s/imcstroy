/**
 * Перенос проектов и задач из Planfix в ИСУ.
 *
 * Направление одно: Planfix читаем, ничего в нём не меняем. Сверка
 * идемпотентна — её можно запускать сколько угодно раз, повторный запуск
 * ничего не задваивает: проект узнаётся по planfix_id, а если его ещё нет —
 * по наименованию.
 *
 * Файлы пользователя неприкосновенны. Импорт умеет только создавать
 * недостающие папки; ничего не удаляет и не перемещает.
 */
const db = require("./db");
const files = require("./files");
const caseFolders = require("./caseFolders");
const planfix = require("./planfixSync");
const journalExcel = require("./journalExcel");

const GROUP_TO_TYPE = {
  [planfix.GROUP_ID_EXPERTISE]: "expertise",
  [planfix.GROUP_ID_RESEARCH]: "research",
};

// Планфиксовые значения полей -> наши. Сравниваем по нижнему регистру и
// без лишних пробелов: в карточках встречается и "Завершен", и "Завершён".
const STAGE_FROM_PLANFIX = {
  "план": "plan",
  "активный": "active",
  "контроль": "control",
  "завершен": "done",
  "завершён": "done",
};
const STATUS_FROM_PLANFIX = {
  "ожидание": "waiting",
  "в работе": "in_progress",
  "проблема": "problem",
};
const CANCELLED_VALUES = new Set(["отменен", "отменён"]);

function norm(value) {
  return String(value == null ? "" : value).trim().toLowerCase().replace(/\s+/g, " ");
}

/** Значение пользовательского поля Planfix по его id. */
function customField(project, fieldId) {
  const list = project?.customFieldData || [];
  for (const item of list) {
    if (Number(item?.field?.id) !== Number(fieldId)) continue;
    const v = item.value;
    if (v == null) return null;
    // Справочные поля приходят объектом {id, value}, текстовые — строкой.
    if (typeof v === "object") return v.value != null ? String(v.value) : null;
    return String(v);
  }
  return null;
}

/** Тип проекта: сначала по группе Planfix, иначе по префиксу наименования. */
function typeOf(project) {
  const byGroup = GROUP_TO_TYPE[Number(project?.group?.id)];
  if (byGroup) return byGroup;
  const name = String(project?.name || "").trim();
  if (name.startsWith("ЭКС.")) return "expertise";
  if (name.startsWith("НИ.")) return "research";
  return null;
}

/** Стадия и признак отмены — в Planfix это одно поле "Этап проекта". */
function stageOf(project) {
  const raw = norm(customField(project, planfix.FIELD_STAGE));
  if (CANCELLED_VALUES.has(raw)) return { stage: "done", isCancelled: true };
  const stage = STAGE_FROM_PLANFIX[raw];
  if (!stage) return { stage: null, isCancelled: false };
  return { stage, isCancelled: false };
}

/** Разбирает карточку Planfix в поля нашего проекта. */
function readProject(project) {
  const { stage, isCancelled } = stageOf(project);
  return {
    planfixId: Number(project.id),
    name: String(project.name || "").trim(),
    type: typeOf(project),
    stage,
    isCancelled,
    status: STATUS_FROM_PLANFIX[norm(customField(project, planfix.FIELD_STATUS))] || "waiting",
    caseNumber: customField(project, planfix.FIELD_CASE_NUMBER),
    organization: customField(project, planfix.FIELD_ORGANIZATION),
    expertiseType: customField(project, planfix.FIELD_EXPERTISE_TYPE),
  };
}

/**
 * Ищет уже существующую папку проекта во всех корнях стадий — проект мог
 * быть заведён руками раньше и лежать не там, где говорит Planfix.
 * Возвращает путь или null.
 */
async function findExistingFolder(name) {
  const roots = [
    ...Object.keys(caseFolders.STAGE_ROOT_NAME).map((s) => caseFolders.stageRootPath(s)),
    caseFolders.cancelledRootPath(),
  ];
  for (const root of roots) {
    try {
      const { folders } = await files.listDir(root);
      const hit = (folders || []).find((f) => f.name === name);
      if (hit) return `${root}/${name}`;
    } catch (err) {
      // Корня стадии может ещё не быть — это не ошибка импорта.
    }
  }
  return null;
}

/**
 * Достраивает структуру папок проекта до полной, ничего не удаляя.
 * Возвращает список созданных папок — чтобы в отчёте было видно, что
 * именно добавилось.
 */
async function ensureCaseStructure(folderPath, name) {
  const wanted = [
    `${folderPath}/Планирование проекта`,
    `${folderPath}/Планирование проекта/Запрос`,
    `${folderPath}/Планирование проекта/Первичные материалы для ознакомления`,
    `${folderPath}/Планирование проекта/ГП`,
    `${folderPath}/${name}`,
    `${folderPath}/${name}/Материалы`,
    `${folderPath}/${name}/Организационные документы`,
    `${folderPath}/${name}/Заключение`,
  ];
  const created = [];
  for (const dir of wanted) {
    if (await files.pathExists(dir)) continue;
    await files.ensureDir(dir);
    created.push(dir);
  }
  return created;
}

/** Заводит проект в ИСУ по карточке Planfix. */
async function createFromPlanfix(parsed, report) {
  const stage = parsed.stage || "plan";
  const stageRoot = parsed.isCancelled ? caseFolders.cancelledRootPath() : caseFolders.stageRootPath(stage);
  const folderPath = `${stageRoot}/${parsed.name}`;

  const createdDirs = await ensureCaseStructure(folderPath, parsed.name);
  report.foldersCreated += createdDirs.length;

  const { rows } = await db.query(
    `INSERT INTO cases
       (type, name, stage, status, is_cancelled, case_number, organization, expertise_type,
        folder_path, planfix_id, planfix_synced_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
     RETURNING *`,
    [parsed.type, parsed.name, stage, parsed.status, parsed.isCancelled,
     parsed.caseNumber, parsed.organization, parsed.expertiseType, folderPath, parsed.planfixId]
  );
  const created = rows[0];

  await db.query(
    `INSERT INTO case_history (case_id, action, to_stage, note)
     VALUES ($1, 'imported', $2, 'Перенесён из Planfix')`,
    [created.id, stage]
  );

  report.created.push({ name: parsed.name, folder: folderPath, foldersCreated: createdDirs.length });
  return created;
}

/**
 * Обновляет уже известный проект: поля из Planfix дописываем, но не
 * затираем то, чего в Planfix нет (пустое значение там не означает
 * "очистить у нас"). Папку не двигаем — переезд между стадиями остаётся
 * ручным действием в ИСУ, чтобы импорт не таскал папки сам по себе.
 */
async function updateFromPlanfix(existing, parsed, report) {
  const changes = [];
  const sets = [];
  const values = [existing.id];
  const setIf = (column, value, label) => {
    if (value == null || value === "") return;
    if (String(existing[column] || "") === String(value)) return;
    values.push(value);
    sets.push(`${column} = $${values.length}`);
    changes.push(label);
  };

  setIf("case_number", parsed.caseNumber, "номер договора");
  setIf("organization", parsed.organization, "структура");
  setIf("expertise_type", parsed.expertiseType, "тип экспертизы");
  setIf("status", parsed.status, "статус");
  if (!existing.planfix_id) {
    values.push(parsed.planfixId);
    sets.push(`planfix_id = $${values.length}`);
    changes.push("связь с Planfix");
  }

  const createdDirs = await ensureCaseStructure(existing.folder_path, existing.name);
  report.foldersCreated += createdDirs.length;
  if (createdDirs.length) changes.push(`папки: ${createdDirs.length}`);

  sets.push("planfix_synced_at = now()");
  await db.query(
    `UPDATE cases SET ${sets.join(", ")}, updated_at = now() WHERE id = $1`,
    values
  );

  if (changes.length) {
    report.updated.push({ name: existing.name, changes });
  } else {
    report.unchanged++;
  }
  return { ...existing, planfix_id: existing.planfix_id || parsed.planfixId };
}

/** Находит проект в ИСУ: сначала по planfix_id, затем по наименованию. */
async function findCase(parsed) {
  const byId = await db.query("SELECT * FROM cases WHERE planfix_id = $1", [parsed.planfixId]);
  if (byId.rows.length) return byId.rows[0];
  const byName = await db.query("SELECT * FROM cases WHERE name = $1", [parsed.name]);
  if (byName.rows.length) return byName.rows[0];
  return null;
}

/** Переносит проекты. Возвращает отчёт, который потом видно в интерфейсе. */
async function importProjects(report) {
  const projects = await planfix.listAllProjects();
  report.projectsSeen = projects.length;

  const known = [];
  for (const project of projects) {
    const parsed = readProject(project);
    try {
      if (!parsed.name) {
        report.skipped.push({ name: `#${parsed.planfixId}`, why: "в Planfix у проекта пустое наименование" });
        continue;
      }
      if (!parsed.type) {
        report.skipped.push({ name: parsed.name, why: "не понятен тип: ни группа, ни префикс «ЭКС.»/«НИ.»" });
        continue;
      }
      if (!parsed.stage && !parsed.isCancelled) {
        report.skipped.push({ name: parsed.name, why: "не заполнен «Этап проекта» в Planfix" });
        continue;
      }

      const existing = await findCase(parsed);
      // Папка могла быть заведена руками до появления записи в журнале.
      if (!existing) {
        const found = await findExistingFolder(parsed.name);
        if (found) {
          const adopted = await db.query(
            `INSERT INTO cases (type, name, stage, status, is_cancelled, case_number, organization,
                                expertise_type, folder_path, planfix_id, planfix_synced_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now()) RETURNING *`,
            [parsed.type, parsed.name, parsed.stage || "plan", parsed.status, parsed.isCancelled,
             parsed.caseNumber, parsed.organization, parsed.expertiseType, found, parsed.planfixId]
          );
          const createdDirs = await ensureCaseStructure(found, parsed.name);
          report.foldersCreated += createdDirs.length;
          report.adopted.push({ name: parsed.name, folder: found, foldersCreated: createdDirs.length });
          known.push(adopted.rows[0]);
          continue;
        }
        known.push(await createFromPlanfix(parsed, report));
        continue;
      }
      known.push(await updateFromPlanfix(existing, parsed, report));
    } catch (err) {
      report.errors.push({ name: parsed.name || `#${parsed.planfixId}`, error: err.message });
    }
  }
  return known;
}

/** Зеркалит задачи Planfix по проектам, которые уже есть в ИСУ. */
async function importTasks(report) {
  const { rows: linked } = await db.query(
    "SELECT id, planfix_id, name FROM cases WHERE planfix_id IS NOT NULL"
  );
  if (!linked.length) return;

  const byPlanfixId = new Map(linked.map((c) => [Number(c.planfix_id), c]));
  const tasks = await planfix.listAllTasks();
  report.tasksSeen = tasks.length;

  for (const task of tasks) {
    const projectId = Number(task?.project?.id);
    const kase = byPlanfixId.get(projectId);
    if (!kase) continue;
    try {
      const parsed = planfix.readTask(task);
      const { rowCount } = await db.query(
        `INSERT INTO case_tasks
           (case_id, planfix_id, name, status_name, is_done, assignees, assigner, start_date, end_date, seen_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now(), now())
         ON CONFLICT (planfix_id) DO UPDATE SET
           case_id = EXCLUDED.case_id,
           name = EXCLUDED.name,
           status_name = EXCLUDED.status_name,
           is_done = EXCLUDED.is_done,
           assignees = EXCLUDED.assignees,
           assigner = EXCLUDED.assigner,
           start_date = EXCLUDED.start_date,
           end_date = EXCLUDED.end_date,
           seen_at = now(),
           updated_at = now()`,
        [kase.id, parsed.planfixId, parsed.name, parsed.statusName, parsed.isDone,
         parsed.assignees, parsed.assigner, parsed.startDate, parsed.endDate]
      );
      report.tasksSynced += rowCount;
    } catch (err) {
      report.errors.push({ name: `задача #${task?.id}`, error: err.message });
    }
  }

  await db.query(
    "UPDATE cases SET planfix_tasks_synced_at = now() WHERE planfix_id IS NOT NULL"
  );
}

function emptyReport() {
  return {
    projectsSeen: 0,
    tasksSeen: 0,
    tasksSynced: 0,
    foldersCreated: 0,
    unchanged: 0,
    created: [],
    adopted: [],
    updated: [],
    skipped: [],
    errors: [],
  };
}

/**
 * Полная сверка: проекты, затем задачи. Ошибка на одном проекте не рушит
 * весь прогон — она попадает в отчёт, остальные продолжают переноситься.
 */
async function runSync({ trigger = "manual", withTasks = true } = {}) {
  const report = emptyReport();
  const { rows: runRows } = await db.query(
    "INSERT INTO planfix_sync_runs (trigger) VALUES ($1) RETURNING id",
    [trigger]
  );
  const runId = runRows[0].id;

  try {
    await importProjects(report);
    if (withTasks) await importTasks(report);

    await db.query(
      "UPDATE planfix_sync_runs SET finished_at = now(), ok = true, report = $2 WHERE id = $1",
      [runId, JSON.stringify(report)]
    );
    try {
      await journalExcel.regenerateJournal();
    } catch (err) {
      console.error("Импорт прошёл, но журнал не пересобрался:", err.message);
    }
    return report;
  } catch (err) {
    await db.query(
      "UPDATE planfix_sync_runs SET finished_at = now(), ok = false, error = $2, report = $3 WHERE id = $1",
      [runId, err.message, JSON.stringify(report)]
    );
    err.report = report;
    throw err;
  }
}

module.exports = {
  runSync,
  importProjects,
  importTasks,
  readProject,
  ensureCaseStructure,
  findExistingFolder,
  emptyReport,
  STAGE_FROM_PLANFIX,
  STATUS_FROM_PLANFIX,
};
