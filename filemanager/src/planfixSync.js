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
    const err = new Error(message);
    // Planfix ответил и внятно отказал — значит, он ничего не создал и не
    // изменил. Это важно отличать от обрыва связи: после отказа запрос
    // можно безопасно повторить, после обрыва — нельзя, задача могла
    // создаться, и повтор сделает дубль.
    err.planfixRefused = (data && data.result === "fail") || (res.status >= 400 && res.status < 500);
    err.planfixCode = data?.code != null ? Number(data.code) : null;
    throw err;
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
 * Диагностика: что лежит в Planfix и что из этого мы читаем. Отвечает на
 * вопросы, из-за которых иначе пришлось бы лезть в консоль: какие есть
 * группы проектов, какие поля (с их id и примером значения) и как
 * называются статусы задач.
 */
async function probe() {
  const ids = await resolveFieldIds();
  const wanted = [ids.stage, ids.status, ids.organization, ids.caseNumber, ids.expertiseType].filter(Boolean);
  const projects = await listAll(
    "/project/list",
    ["id", "name", "group", "customFieldData", ...wanted].join(","),
    {}, 3
  );
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

  // Поля берём из справочника аккаунта, а рядом кладём реально пришедшее
  // значение: так видно и что поле есть, и что оно читается.
  const sampleByField = new Map();
  let projectsWithValues = 0;
  for (const p of projects) {
    const data = p.customFieldData || [];
    if (data.length) projectsWithValues++;
    for (const item of data) {
      const id = Number(item?.field?.id);
      if (!id || sampleByField.has(id)) continue;
      const v = item.value;
      sampleByField.set(id, {
        name: item.field.name || "",
        sample: v == null ? null : (typeof v === "object" ? v.value : v),
      });
    }
  }

  const known = new Map();
  for (const f of ids.catalogue.fields) known.set(f.id, { id: f.id, name: f.name, sample: null });
  for (const [id, info] of sampleByField) {
    const item = known.get(id) || { id, name: info.name, sample: null };
    item.name = item.name || info.name;
    item.sample = info.sample;
    known.set(id, item);
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
    projectsWithValues,
    groups: [...groups.values()].sort((a, b) => b.count - a.count),
    fields: [...known.values()].sort((a, b) => a.id - b.id),
    taskStatuses: [...statuses.values()].sort((a, b) => b.count - a.count),
    expertiseFieldConfigured: ids.expertiseType,
    fieldMapping: [
      { need: "Этап проекта", id: ids.stage },
      { need: "Статус проекта", id: ids.status },
      { need: "Структура", id: ids.organization },
      { need: "Номер договора / дела", id: ids.caseNumber },
      { need: "Тип экспертизы", id: ids.expertiseType },
    ],
    catalogueSource: ids.catalogue.source,
    catalogueTried: ids.catalogue.tried,
  };
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

/**
 * Список сотрудников Planfix — для выбора исполнителя и для привязки
 * аккаунтов. Идём постранично: в аккаунте больше сотни человек бывает,
 * а раньше мы молча брали только первую сотню.
 */
async function listPlanfixEmployees() {
  const users = [];
  for (let page = 0; page < 50; page++) {
    const data = await planfixRequest("POST", "/user/list", {
      offset: page * PAGE_SIZE,
      pageSize: PAGE_SIZE,
      fields: "id,name,email",
    });
    const chunk = data?.users || [];
    users.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
  }
  return users;
}

/** "2026-09-01" (как приходит из <input type="date">) -> "01-09-2026" (формат Planfix). */
function formatDateForPlanfix(isoDate) {
  const [year, month, day] = String(isoDate).split("-");
  if (!year || !month || !day) return null;
  return `${day}-${month}-${year}`;
}

/** Ссылка на сотрудника в теле запроса Planfix. */
function userRef(id) {
  return { id: `user:${Number(id)}` };
}

function usersRef(ids) {
  const list = (Array.isArray(ids) ? ids : [ids]).map(Number).filter(Boolean);
  return list.length ? { users: list.map(userRef) } : null;
}

/**
 * Отправляет запрос, в котором указан автор действия, и умеет обойтись
 * без него.
 *
 * Токен у нас один, служебный, а автора мы передаём полем (assigner для
 * задачи, owner для комментария). Заранее знать, разрешает ли конкретный
 * аккаунт Planfix назначать автора по API, нельзя. Поэтому: сначала
 * пробуем с автором; если Planfix ВНЯТНО отказал (то есть точно ничего
 * не создал), повторяем без поля автора и дописываем подпись в текст —
 * чтобы имя человека не потерялось совсем.
 *
 * Повторяем только после внятного отказа. После обрыва связи повтор
 * запрещён: задача могла создаться, и второй запрос сделает дубль.
 */
async function requestAsAuthor({ send, withAuthor, withoutAuthor }) {
  if (!withAuthor) return { data: await send(withoutAuthor()), authorApplied: false };
  try {
    return { data: await send(withAuthor()), authorApplied: true };
  } catch (err) {
    if (!err.planfixRefused) throw err;
    const data = await send(withoutAuthor());
    return { data, authorApplied: false, authorError: err.message };
  }
}

/** Подпись, которой помечаем текст, если автора назначить не удалось. */
function authorSignature(actor) {
  return actor ? `\n\n— ${actor.name} (через ИСУ)` : "";
}

/**
 * Создаёт задачу в Planfix, привязанную к проекту.
 *
 * actor — сотрудник Planfix, от чьего имени ставится задача (тот, кто
 * нажал кнопку в ИСУ). Исполнители, срок и описание необязательны.
 */
async function createPlanfixTask({ name, projectId, assigneeIds, assigneeId, deadlineIso, description, actor }) {
  const assignees = usersRef(assigneeIds != null ? assigneeIds : assigneeId);
  const deadline = deadlineIso ? formatDateForPlanfix(deadlineIso) : null;

  const base = () => {
    const body = { name, description: description || "", project: { id: projectId } };
    if (assignees) body.assignees = assignees;
    if (deadline) body.endDateTime = { date: deadline, dateType: "otherDate" };
    return body;
  };

  const result = await requestAsAuthor({
    send: (body) => planfixRequest("POST", "/task/", body),
    withAuthor: actor ? () => ({ ...base(), assigner: userRef(actor.id) }) : null,
    withoutAuthor: () => {
      const body = base();
      body.description = (body.description || "") + authorSignature(actor);
      return body;
    },
  });

  return {
    id: result.data?.id,
    authorApplied: result.authorApplied,
    authorError: result.authorError || null,
  };
}

/**
 * Меняет у задачи исполнителей и/или срок. Передаём только то, что
 * действительно правим: пустое поле у Planfix означает "стереть", а нам
 * нужно "не трогать".
 */
async function updatePlanfixTask(taskId, { assigneeIds, deadlineIso, name, description }) {
  const body = {};
  if (name !== undefined) body.name = name;
  if (description !== undefined) body.description = description;
  if (assigneeIds !== undefined) {
    body.assignees = usersRef(assigneeIds) || { users: [] };
  }
  if (deadlineIso !== undefined) {
    const deadline = deadlineIso ? formatDateForPlanfix(deadlineIso) : null;
    body.endDateTime = deadline ? { date: deadline, dateType: "otherDate" } : null;
  }
  if (!Object.keys(body).length) return false;
  await planfixRequest("POST", `/task/${Number(taskId)}`, body);
  return true;
}

/**
 * Комментарий к задаче от имени сотрудника. Если назначить автора не
 * вышло, имя уходит подписью в самом тексте — комментарий без автора
 * бесполезен, а терять его нельзя.
 */
async function addTaskComment(taskId, text, actor) {
  const body = () => ({ description: String(text) });

  const result = await requestAsAuthor({
    send: (b) => planfixRequest("POST", `/task/${Number(taskId)}/comments/`, b),
    withAuthor: actor ? () => ({ ...body(), owner: userRef(actor.id) }) : null,
    withoutAuthor: () => ({ description: String(text) + authorSignature(actor) }),
  });

  return {
    id: result.data?.id || null,
    authorApplied: result.authorApplied,
    authorError: result.authorError || null,
  };
}

/**
 * Комментарии задачи. Адрес списка в разных версиях Planfix отличается,
 * поэтому пробуем известные варианты по очереди — так же, как со
 * справочником полей.
 */
const COMMENT_LIST_ENDPOINTS = [
  ["POST", (id) => `/task/${id}/comments/list`],
  ["POST", (id) => `/task/${id}/comment/list`],
  ["GET", (id) => `/task/${id}/comments`],
];

async function listTaskComments(taskId) {
  const id = Number(taskId);
  let lastError = null;
  for (const [method, makePath] of COMMENT_LIST_ENDPOINTS) {
    try {
      const body = method === "POST"
        ? { offset: 0, pageSize: 50, fields: "id,description,owner,dateTime" }
        : undefined;
      const data = await planfixRequest(method, makePath(id), body);
      const items = data?.comments || data?.list || [];
      return items.map((c) => ({
        id: c.id,
        text: String(c.description || "").trim(),
        author: c.owner?.name || null,
        at: c.dateTime?.datetime || c.dateTime?.date || null,
      }));
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error("Не удалось получить комментарии задачи: " + (lastError?.message || "неизвестная ошибка"));
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

/**
 * Справочник пользовательских полей проекта: id и название.
 *
 * Нужен потому, что Planfix не отдаёт значения полей "оптом": их надо
 * запрашивать по конкретным id в параметре fields. Поэтому сначала
 * спрашиваем, какие поля вообще есть. Адрес справочника отличается по
 * версиям API — пробуем известные по очереди и запоминаем сработавший.
 */
const FIELD_LIST_ENDPOINTS = [
  ["GET", "/project/fields"],
  ["GET", "/project/field/list"],
  ["GET", "/projectField/list"],
  ["POST", "/project/fields", {}],
];

let fieldCatalogueCache = null;

async function fetchFieldCatalogue({ force = false } = {}) {
  if (fieldCatalogueCache && !force) return fieldCatalogueCache;
  const tried = [];
  for (const [method, path, body] of FIELD_LIST_ENDPOINTS) {
    try {
      const data = await planfixRequest(method, path, body);
      const list = data?.fields || data?.projectFields || data?.customFields || [];
      if (Array.isArray(list) && list.length) {
        fieldCatalogueCache = {
          source: path,
          tried,
          fields: list
            .map((f) => ({ id: Number(f?.id), name: String(f?.name || ""), type: f?.type ?? null }))
            .filter((f) => f.id),
        };
        return fieldCatalogueCache;
      }
      tried.push(`${path}: пустой список`);
    } catch (err) {
      tried.push(`${path}: ${err.message}`);
    }
  }
  fieldCatalogueCache = { source: null, tried, fields: [] };
  return fieldCatalogueCache;
}

// Поля узнаём по названию: не надо ничего прописывать руками, а
// переименование поля в Planfix ломает только его одно, а не весь импорт.
const FIELD_NAME_PATTERNS = {
  stage: /этап/i,
  status: /статус/i,
  organization: /структур/i,
  caseNumber: /номер\s*(договора|дела)/i,
  expertiseType: /тип\s*эксперт/i,
};

/**
 * "Что нам нужно" -> id поля в Planfix. Приоритет: название из
 * справочника, затем значение из окружения, затем зашитые id.
 */
async function resolveFieldIds() {
  const catalogue = await fetchFieldCatalogue();
  const byName = (re) => {
    const hit = catalogue.fields.find((f) => re.test(f.name));
    return hit ? hit.id : null;
  };
  return {
    stage: byName(FIELD_NAME_PATTERNS.stage) || FIELD_STAGE,
    status: byName(FIELD_NAME_PATTERNS.status) || FIELD_STATUS,
    organization: byName(FIELD_NAME_PATTERNS.organization) || FIELD_ORGANIZATION,
    caseNumber: byName(FIELD_NAME_PATTERNS.caseNumber) || FIELD_CASE_NUMBER,
    expertiseType: byName(FIELD_NAME_PATTERNS.expertiseType) || FIELD_EXPERTISE_TYPE,
    catalogue,
  };
}

/**
 * Все проекты аккаунта вместе со значениями нужных полей. Поля
 * перечисляем по id прямо в fields — иначе Planfix возвращает карточки
 * без customFieldData, и импорт видит проекты без этапа и без номера.
 */
async function listAllProjects() {
  const ids = await resolveFieldIds();
  const wanted = [ids.stage, ids.status, ids.organization, ids.caseNumber, ids.expertiseType].filter(Boolean);
  const fields = ["id", "name", "group", "description", "customFieldData", ...wanted].join(",");
  const projects = await listAll("/project/list", fields);
  return { projects, fieldIds: ids };
}

/** Все задачи аккаунта — с привязкой к проекту, статусом и сроками. */
/** Одна задача по её номеру — нужна сразу после создания задачи из ИСУ. */
async function fetchTask(taskId) {
  const fields = "id,name,description,status,project,assigner,assignees,startDateTime,endDateTime";
  const data = await planfixRequest("GET", `/task/${Number(taskId)}?fields=${encodeURIComponent(fields)}`);
  return data?.task || data || null;
}

function listAllTasks() {
  return listAll("/task/list", "id,name,description,status,project,assigner,assignees,startDateTime,endDateTime");
}

// Статусы задач в Planfix настраиваются в аккаунте, поэтому "завершённость"
// определяем по названию статуса, а не по числовому id: список названий
// известен и меняется редко.
const DONE_STATUS_NAMES = new Set([
  "завершенная", "завершённая", "завершена", "завершено",
  "выполненная", "выполнена", "выполнено",
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

/**
 * Те же люди, но числовыми id. Planfix пишет их и как 9, и как "user:9".
 * Именно по id работает фильтр "Мои задачи": имена совпадают ненадёжно
 * (однофамильцы, переименование сотрудника, лишний пробел).
 */
function peopleToIds(value) {
  const users = value?.users || (Array.isArray(value) ? value : (value ? [value] : []));
  const ids = users
    .map((u) => {
      const m = String(u?.id ?? "").match(/(\d+)/);
      return m ? Number(m[1]) : null;
    })
    .filter(Boolean);
  return [...new Set(ids)];
}

/** Приводит задачу Planfix к тому виду, в котором она хранится у нас. */
function readTask(task) {
  const statusName = task?.status?.name || null;
  return {
    planfixId: Number(task.id),
    name: String(task.name || "").trim() || `Задача #${task.id}`,
    statusName,
    statusId: task?.status?.id != null ? Number(task.status.id) : null,
    isDone: isDoneStatus(statusName),
    description: String(task?.description || "").trim() || null,
    assignees: peopleToText(task?.assignees),
    assigner: peopleToText(task?.assigner),
    assigneeIds: peopleToIds(task?.assignees),
    assignerId: peopleToIds(task?.assigner)[0] || null,
    startDate: planfixDateToIso(task?.startDateTime),
    endDate: planfixDateToIso(task?.endDateTime),
  };
}


/**
 * Переводит задачу в завершённый статус. Planfix — источник правды по
 * задачам, поэтому сначала меняем там, и только если он согласился,
 * помечаем у себя: иначе в ИСУ будет "сделано", а в Planfix нет.
 */
async function completeTask(taskId, statusId) {
  if (!statusId) {
    throw new Error(
      "Не известен статус завершения в Planfix. Откройте окно Planfix → «Проверить связь» " +
      "и укажите его в .env как PLANFIX_DONE_STATUS_ID."
    );
  }
  await planfixRequest("POST", `/task/${taskId}`, { status: { id: Number(statusId) } });
  return true;
}

/**
 * Удаляет задачу в Planfix — для случая «поставил не то».
 *
 * Адрес удаления в разных версиях Planfix отличается, поэтому пробуем
 * известные варианты по очереди, как со списком комментариев. Порядок
 * важен: сначала то, что удаляет одну конкретную задачу.
 *
 * Отдельно про безопасность повторов: пробовать следующий вариант можно
 * только после ВНЯТНОГО отказа. Если связь оборвалась, задача могла
 * удалиться, и повтор ничего не испортит, но и ошибку глотать нельзя —
 * поэтому такая ошибка пробрасывается наружу как есть.
 */
const TASK_DELETE_ENDPOINTS = [
  ["POST", (id) => `/task/${id}/delete`],
  ["DELETE", (id) => `/task/${id}`],
];

async function deletePlanfixTask(taskId) {
  const id = Number(taskId);
  let lastError = null;
  for (const [method, makePath] of TASK_DELETE_ENDPOINTS) {
    try {
      await planfixRequest(method, makePath(id), method === "POST" ? {} : undefined);
      return true;
    } catch (err) {
      if (!err.planfixRefused) throw err;
      lastError = err;
    }
  }
  throw new Error(
    "Planfix не дал удалить задачу: " + (lastError?.message || "неизвестная причина")
  );
}

module.exports = {
  syncProjectToPlanfix, buildCustomFieldData, stageValueForPlanfix, groupIdForType, planfixRequest,
  listPlanfixEmployees, createPlanfixTask, formatDateForPlanfix,
  updatePlanfixTask, addTaskComment, listTaskComments, userRef, usersRef,
  listAllProjects, listAllTasks, readTask, planfixDateToIso, probe, typeForGroup, isDoneStatus,
  peopleToIds, completeTask, deletePlanfixTask, fetchTask,
  fetchFieldCatalogue, resolveFieldIds,
  FIELD_STAGE, FIELD_STATUS, FIELD_ORGANIZATION, FIELD_CASE_NUMBER, FIELD_EXPERTISE_TYPE,
  GROUP_ID_EXPERTISE, GROUP_ID_RESEARCH,
};
