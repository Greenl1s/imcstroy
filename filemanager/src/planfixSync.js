const PLANFIX_BASE_URL = process.env.PLANFIX_BASE_URL || "https://cse.planfix.ru/rest";
const PLANFIX_TOKEN = process.env.PLANFIX_TOKEN;

// ID пользовательских полей проекта в Planfix (Управление аккаунтом →
// Типы объектов → Проект → Настраиваемые поля) — свои для этого
// конкретного аккаунта, узнаны один раз через интерфейс 25.08.2026.
const FIELD_STAGE = 76010;        // "Этап проекта"
const FIELD_STATUS = 76040;       // "Статус проекта"
const FIELD_ORGANIZATION = 76014; // "Структура"
const FIELD_CASE_NUMBER = 76006;  // "Номер договора / Номер дела"
// "Тип экспертизы" — id этого поля отличается в разных аккаунтах, поэтому
// он берётся из окружения (PLANFIX_FIELD_EXPERTISE_TYPE) и правится без
// пересборки образа.
const FIELD_EXPERTISE_TYPE = Number(process.env.PLANFIX_FIELD_EXPERTISE_TYPE || 0) || null;

const STAGE_TO_PLANFIX = { plan: "План", active: "Активный", control: "Контроль", done: "Завершён" };
const STATUS_TO_PLANFIX = { waiting: "Ожидание", in_progress: "В работе", problem: "Проблема" };

async function planfixRequest(method, path, body) {
  if (!PLANFIX_TOKEN) {
    throw new Error("Не настроен PLANFIX_TOKEN — синхронизация с Planfix отключена");
  }
  const res = await fetch(`${PLANFIX_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${PLANFIX_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = null; }

  if (!res.ok || (data && data.result === "fail")) {
    const message = data?.error || text.slice(0, 300) || `HTTP ${res.status}`;
    throw new Error(message);
  }
  return data;
}

/**
 * В Planfix "Отменён" — это одно из значений поля "Этап проекта", а не
 * отдельный флаг, как у нас (is_cancelled отдельно от stage). Приводим
 * к их модели при синхронизации.
 */
function stageValueForPlanfix(kase) {
  if (kase.is_cancelled) return "Отменён";
  return STAGE_TO_PLANFIX[kase.stage] || null;
}

function buildCustomFieldData(kase) {
  const data = [];

  const stageValue = stageValueForPlanfix(kase);
  if (stageValue) data.push({ field: { id: FIELD_STAGE }, value: stageValue });

  const statusValue = STATUS_TO_PLANFIX[kase.status];
  if (statusValue) data.push({ field: { id: FIELD_STATUS }, value: statusValue });

  if (kase.organization) data.push({ field: { id: FIELD_ORGANIZATION }, value: kase.organization });
  if (kase.case_number) data.push({ field: { id: FIELD_CASE_NUMBER }, value: kase.case_number });

  return data;
}

/**
 * Создаёт или обновляет карточку проекта в Planfix. Если у проекта уже
 * есть planfix_id — обновляет существующую карточку и возвращает тот же
 * id; иначе создаёт новую и возвращает её id (вызывающий код должен
 * сохранить его в cases.planfix_id).
 */
// "Группа проектов" в Planfix (Экспертизы/Независимые исследования) —
// отдельная системная сущность, не пользовательское поле. ID узнаны
// через реальные карточки существующих проектов 25.08.2026.
const GROUP_ID_EXPERTISE = 2642; // "Экспертизы"
const GROUP_ID_RESEARCH = 2644;  // "Независимые исследования"

function groupIdForType(type) {
  if (type === "expertise") return GROUP_ID_EXPERTISE;
  if (type === "research") return GROUP_ID_RESEARCH;
  return null;
}

/**
 * Группы проектов Planfix -> наши типы. Раньше это были два зашитых в код
 * числа; теперь узнаём группу по названию, поэтому переименование или
 * пересоздание группы в Planfix ничего не ломает, а лишние группы
 * (например "Управление и развитие") видно в диагностике.
 */
const GROUP_NAME_TO_TYPE = [
  { test: /эксперт/i, type: "expertise" },
  { test: /независим|^ни\b|исследован/i, type: "research" },
];

function typeForGroup(group) {
  if (!group) return null;
  const id = Number(group.id);
  if (id === GROUP_ID_EXPERTISE) return "expertise";
  if (id === GROUP_ID_RESEARCH) return "research";
  const name = String(group.name || "");
  const hit = GROUP_NAME_TO_TYPE.find((g) => g.test.test(name));
  return hit ? hit.type : null;
}

/**
 * Диагностика: что вообще лежит в Planfix. Отвечает на три вопроса, из-за
 * которых иначе пришлось бы лезть в консоль: какие есть группы проектов,
 * какие пользовательские поля (с их id) и как называются статусы задач.
 */
async function probe() {
  const projects = await listAll("/project/list", "id,name,group,customFieldData", {}, 3);
  const tasks = await listAll("/task/list", "id,name,status,project", {}, 2);

  const groups = new Map();
  for (const p of projects) {
    const g = p.group;
    const key = g ? `${g.id}|${g.name || ""}` : "—|без группы";
    const item = groups.get(key) || {
      id: g ? Number(g.id) : null,
      name: g ? g.name || "" : "(без группы)",
      count: 0,
      mappedTo: typeForGroup(g),
      example: p.name,
    };
    item.count++;
    groups.set(key, item);
  }

  const fields = new Map();
  for (const p of projects) {
    for (const item of p.customFieldData || []) {
      const id = Number(item?.field?.id);
      if (!id) continue;
      const known = fields.get(id) || {
        id,
        name: item.field.name || "",
        sample: null,
        usedBy: 0,
      };
      known.usedBy++;
      if (known.sample == null && item.value != null) {
        known.sample = typeof item.value === "object" ? item.value.value : item.value;
      }
      fields.set(id, known);
    }
  }

  const statuses = new Map();
  for (const t of tasks) {
    const name = t?.status?.name || "(без статуса)";
    const item = statuses.get(name) || { name, id: t?.status?.id ?? null, count: 0, treatedAsDone: isDoneStatus(name) };
    item.count++;
    statuses.set(name, item);
  }

  return {
    projectsSampled: projects.length,
    tasksSampled: tasks.length,
    groups: [...groups.values()].sort((a, b) => b.count - a.count),
    fields: [...fields.values()].sort((a, b) => a.id - b.id),
    taskStatuses: [...statuses.values()].sort((a, b) => b.count - a.count),
    expertiseFieldConfigured: FIELD_EXPERTISE_TYPE,
  };
}

async function syncProjectToPlanfix(kase) {
  const body = {
    name: kase.name,
    customFieldData: buildCustomFieldData(kase),
  };

  if (kase.planfix_id) {
    await planfixRequest("POST", `/project/${kase.planfix_id}`, body);
    return kase.planfix_id;
  }

  // Группу проектов выставляем только при создании — дальше тип
  // проекта (ЭКС/НИ) в ИСУ не меняется, значит и группу трогать не надо.
  const groupId = groupIdForType(kase.type);
  if (groupId) body.group = { id: groupId };

  const created = await planfixRequest("POST", "/project/", body);
  return created.id;
}

/** Список сотрудников Planfix — для выбора исполнителя задачи. */
async function listPlanfixEmployees() {
  const data = await planfixRequest("POST", "/user/list", { offset: 0, pageSize: 100, fields: "id,name" });
  return data.users || [];
}

/** "2026-09-01" (как приходит из <input type="date">) -> "01-09-2026" (формат Planfix). */
function formatDateForPlanfix(isoDate) {
  const [year, month, day] = String(isoDate).split("-");
  if (!year || !month || !day) return null;
  return `${day}-${month}-${year}`;
}

/**
 * Создаёт одну задачу в Planfix, привязанную к проекту. Исполнитель и
 * срок — необязательны (можно поставить задачу без них, если по смыслу
 * не нужны прямо сейчас).
 */
async function createPlanfixTask({ name, projectId, assigneeId, deadlineIso }) {
  const body = {
    name,
    description: "",
    project: { id: projectId },
  };
  if (assigneeId) {
    body.assignees = { users: [{ id: `user:${assigneeId}` }] };
  }
  const deadline = deadlineIso ? formatDateForPlanfix(deadlineIso) : null;
  if (deadline) {
    body.endDateTime = { date: deadline, dateType: "otherDate" };
  }

  const created = await planfixRequest("POST", "/task/", body);
  return created.id;
}


/* ---------------- Чтение из Planfix (импорт) ---------------- */

const PAGE_SIZE = 100;
// Дальше этого не идём даже если Planfix отдаёт бесконечность: страховка
// от зацикливания на чужом API.
const MAX_PAGES = 200;

/** Постранично забирает список объектов Planfix (/project/list, /task/list). */
async function listAll(path, fields, extraBody = {}, maxPages = MAX_PAGES) {
  const items = [];
  for (let page = 0; page < maxPages; page++) {
    const data = await planfixRequest("POST", path, {
      offset: page * PAGE_SIZE,
      pageSize: PAGE_SIZE,
      fields,
      ...extraBody,
    });
    const chunk = data?.projects || data?.tasks || [];
    items.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
  }
  return items;
}

/** Все проекты аккаунта — с группой и пользовательскими полями. */
function listAllProjects() {
  return listAll("/project/list", "id,name,group,description,customFieldData");
}

/** Все задачи аккаунта — с привязкой к проекту, статусом и сроками. */
function listAllTasks() {
  return listAll("/task/list", "id,name,status,project,assigner,assignees,startDateTime,endDateTime");
}

// Статусы задач в Planfix настраиваются в аккаунте, поэтому "завершённость"
// определяем по названию статуса, а не по числовому id: список названий
// известен и меняется редко.
const DONE_STATUS_NAMES = new Set([
  "завершенная", "завершённая", "завершена", "завершено", "выполнена",
  "закрыта", "закрытая", "отменена", "отменённая", "отмененная",
  // Свои названия статусов можно дописать в .env через запятую,
  // не трогая код: PLANFIX_DONE_STATUSES="Сдана,Принята"
  ...String(process.env.PLANFIX_DONE_STATUSES || "")
    .split(",").map((x) => x.trim().toLowerCase()).filter(Boolean),
]);

function isDoneStatus(name) {
  return DONE_STATUS_NAMES.has(String(name || "").trim().toLowerCase());
}

/** "01-09-2026" или {date:"01-09-2026"} -> "2026-09-01" для базы. */
function planfixDateToIso(value) {
  const raw = typeof value === "object" && value ? value.date || value.datetime : value;
  if (!raw) return null;
  const m = String(raw).match(/^(\d{2})-(\d{2})-(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const m2 = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m2 ? m2[0] : null;
}

function peopleToText(value) {
  const users = value?.users || (Array.isArray(value) ? value : []);
  const names = users.map((u) => u?.name).filter(Boolean);
  if (names.length) return names.join(", ");
  return value?.name || null;
}

/** Приводит задачу Planfix к тому виду, в котором она хранится у нас. */
function readTask(task) {
  const statusName = task?.status?.name || null;
  return {
    planfixId: Number(task.id),
    name: String(task.name || "").trim() || `Задача #${task.id}`,
    statusName,
    isDone: isDoneStatus(statusName),
    assignees: peopleToText(task?.assignees),
    assigner: peopleToText(task?.assigner),
    startDate: planfixDateToIso(task?.startDateTime),
    endDate: planfixDateToIso(task?.endDateTime),
  };
}

module.exports = {
  syncProjectToPlanfix, buildCustomFieldData, stageValueForPlanfix, groupIdForType, planfixRequest,
  listPlanfixEmployees, createPlanfixTask, formatDateForPlanfix,
  listAllProjects, listAllTasks, readTask, planfixDateToIso, probe, typeForGroup, isDoneStatus,
  FIELD_STAGE, FIELD_STATUS, FIELD_ORGANIZATION, FIELD_CASE_NUMBER, FIELD_EXPERTISE_TYPE,
  GROUP_ID_EXPERTISE, GROUP_ID_RESEARCH,
};
