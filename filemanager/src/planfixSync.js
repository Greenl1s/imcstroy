const PLANFIX_BASE_URL = process.env.PLANFIX_BASE_URL || "https://cse.planfix.ru/rest";
const PLANFIX_TOKEN = process.env.PLANFIX_TOKEN;

// ID пользовательских полей проекта в Planfix (Управление аккаунтом →
// Типы объектов → Проект → Настраиваемые поля) — свои для этого
// конкретного аккаунта, узнаны один раз через интерфейс 25.08.2026.
const FIELD_STAGE = 76010;        // "Этап проекта"
const FIELD_STATUS = 76040;       // "Статус проекта"
const FIELD_ORGANIZATION = 76014; // "Структура"
const FIELD_CASE_NUMBER = 76006;  // "Номер договора / Номер дела"

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

module.exports = { syncProjectToPlanfix, buildCustomFieldData, stageValueForPlanfix, groupIdForType, planfixRequest };
