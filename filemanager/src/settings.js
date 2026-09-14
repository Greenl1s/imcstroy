/* ============================================================
 *  Настройки системы, которые меняет администратор.
 *
 *  Раньше всё это жило в .env: чтобы поменять номер поля Planfix или
 *  срок хранения корзины, нужно было зайти на сервер, поправить файл
 *  и пересобрать образ. На практике это кончилось тем, что при
 *  откате docker-compose.yml потерялся токен Planfix, и никто не знал,
 *  где он лежал.
 *
 *  Теперь значение ищется в трёх местах по порядку:
 *    1. таблица fm_settings — то, что задал администратор в панели;
 *    2. переменная окружения — то, что задано при развёртывании;
 *    3. значение по умолчанию в этом файле.
 *
 *  Из этого следует важное: .env продолжает работать как работал, и
 *  система, у которой в базе нет ни одной строки настроек, ведёт себя
 *  ровно так же, как до появления этого модуля.
 *
 *  Секреты (токены) читаются кодом, но наружу не отдаются никогда —
 *  describe() возвращает только «задан» и последние четыре знака,
 *  чтобы человек мог убедиться, что там лежит именно то, что он
 *  вставлял, и не более того.
 * ============================================================ */

const db = require("./db");

/**
 * Что вообще можно настроить. Список описательный: по нему строится
 * и экран, и проверка значений, и подсказки. Ключ — имя строки в
 * базе; env — та самая переменная окружения, которая работала раньше.
 *
 * kind:
 *   text   — строка
 *   number — целое неотрицательное; пустое значит «не задано»
 *   secret — наружу не показывается никогда
 */
const REGISTRY = [
  {
    key: "planfix_base_url", env: "PLANFIX_BASE_URL", kind: "text",
    def: "https://cse.planfix.ru/rest", group: "planfix",
    label: "Адрес Planfix",
    hint: "Должен оканчиваться на /rest. Адрес страницы проекта получается отсюда сам — отдельной настройки нет нарочно, иначе два адреса однажды разъедутся.",
  },
  {
    key: "planfix_token", env: "PLANFIX_TOKEN", kind: "secret",
    def: "", group: "planfix",
    label: "Токен доступа",
    hint: "Выдаётся в Planfix: Управление аккаунтом → API. Токен должен принадлежать сотруднику, который видит нужные проекты, иначе Planfix отвечает «Scope denied».",
  },
  {
    key: "planfix_sync_minutes", env: "PLANFIX_SYNC_MINUTES", kind: "number",
    def: "15", group: "planfix",
    label: "Сверяться каждые, минут",
    hint: "0 — не сверяться совсем. Изменение подхватывается после перезапуска сервиса.",
  },
  {
    key: "planfix_field_stage", env: "PLANFIX_FIELD_STAGE", kind: "number",
    def: "76010", group: "planfix",
    label: "Поле «Этап проекта»",
    hint: "Номера полей свои у каждого аккаунта Planfix. Смотреть здесь: Управление аккаунтом → Типы объектов → Проект → Настраиваемые поля.",
  },
  {
    key: "planfix_field_status", env: "PLANFIX_FIELD_STATUS", kind: "number",
    def: "76040", group: "planfix", label: "Поле «Статус проекта»",
  },
  {
    key: "planfix_field_organization", env: "PLANFIX_FIELD_ORGANIZATION", kind: "number",
    def: "76014", group: "planfix", label: "Поле «Структура»",
  },
  {
    key: "planfix_field_case_number", env: "PLANFIX_FIELD_CASE_NUMBER", kind: "number",
    def: "76006", group: "planfix", label: "Поле «Номер договора / дела»",
  },
  {
    key: "planfix_field_expertise_type", env: "PLANFIX_FIELD_EXPERTISE_TYPE", kind: "number",
    def: "", group: "planfix", label: "Поле «Тип экспертизы»",
    hint: "Пусто — тип экспертизы из Planfix не читается.",
  },
  {
    key: "planfix_done_status_id", env: "PLANFIX_DONE_STATUS_ID", kind: "number",
    def: "", group: "planfix", label: "Номер статуса «Завершена» у задач",
    hint: "Пусто — система определит его сама по уже закрытым задачам.",
  },
  {
    key: "planfix_cancelled_status_id", env: "PLANFIX_CANCELLED_STATUS_ID", kind: "number",
    def: "", group: "planfix", label: "Номер статуса «Отменена» у задач",
    hint: "Нужен, чтобы кнопка «Убрать задачу» отменяла её в Planfix, а не удаляла.",
  },
  {
    key: "planfix_done_statuses", env: "PLANFIX_DONE_STATUSES", kind: "text",
    def: "", group: "planfix", label: "Свои названия «завершённых» статусов",
    hint: "Через запятую. Обычные («Завершена», «Выполнена», «Закрыта», «Отменена») система знает и без этого списка.",
  },
];

const BY_KEY = new Map(REGISTRY.map((item) => [item.key, item]));

/** Значения из базы. Пустая карта = «в базе ничего не задано». */
let cache = new Map();
let loaded = false;

/**
 * Читает настройки из базы в память.
 *
 * Вызывается при запуске и после каждой записи. Если таблицы ещё нет
 * (миграцию не накатили) — молчим и продолжаем жить на .env: система
 * должна подниматься и без свежей схемы.
 */
async function load() {
  try {
    const { rows } = await db.query("SELECT key, value FROM fm_settings");
    cache = new Map(rows.map((r) => [r.key, r.value]));
    loaded = true;
  } catch (err) {
    cache = new Map();
    loaded = false;
  }
  return loaded;
}

/** Значение настройки строкой: база → окружение → умолчание. */
function get(key) {
  const item = BY_KEY.get(key);
  if (!item) throw new Error(`Неизвестная настройка: ${key}`);
  const fromDb = cache.get(key);
  if (fromDb !== undefined && fromDb !== null && fromDb !== "") return fromDb;
  const fromEnv = item.env ? process.env[item.env] : undefined;
  if (fromEnv !== undefined && fromEnv !== "") return fromEnv;
  return item.def;
}

/** То же, но числом. Пустое и мусор дают 0 — вызывающий решает, что это значит. */
function num(key) {
  return Number(get(key)) || 0;
}

/**
 * Откуда сейчас берётся значение. Нужно на экране: администратор
 * должен видеть, правил ли это он сам, или так задано при
 * развёртывании, или это просто умолчание.
 */
function origin(key) {
  const item = BY_KEY.get(key);
  const fromDb = cache.get(key);
  if (fromDb !== undefined && fromDb !== null && fromDb !== "") return "panel";
  if (item.env && process.env[item.env]) return "env";
  return "default";
}

/** Хвост секрета — чтобы убедиться, что лежит именно то, что вставляли. */
function tail(value) {
  const s = String(value || "");
  return s.length > 4 ? s.slice(-4) : "";
}

/**
 * Описание настроек для экрана. Секреты не отдаются: вместо значения
 * идёт «задан» и последние четыре знака.
 */
function describe(group) {
  return REGISTRY
    .filter((item) => !group || item.group === group)
    .map((item) => {
      const value = get(item.key);
      const common = {
        key: item.key, kind: item.kind, group: item.group,
        label: item.label, hint: item.hint || "",
        env: item.env || null, origin: origin(item.key),
      };
      if (item.kind === "secret") {
        return { ...common, set: Boolean(value), tail: tail(value) };
      }
      return { ...common, value };
    });
}

/**
 * Записывает настройку.
 *
 * Пустая строка означает «вернуть как было до меня»: строка из базы
 * удаляется, и значение снова берётся из окружения или умолчания. Это
 * важнее, чем кажется: иначе очищенное поле означало бы «пусто», и
 * вернуть заводское поведение можно было бы только через базу руками.
 */
async function set(key, rawValue, userId) {
  const item = BY_KEY.get(key);
  if (!item) {
    const err = new Error(`Неизвестная настройка: ${key}`);
    err.status = 400;
    throw err;
  }
  const value = String(rawValue ?? "").trim();

  if (value === "") {
    await db.query("DELETE FROM fm_settings WHERE key = $1", [key]);
    await load();
    return { key, cleared: true };
  }

  if (item.kind === "number" && !/^\d+$/.test(value)) {
    const err = new Error(`«${item.label}» — это число, а не «${value}»`);
    err.status = 400;
    throw err;
  }
  if (item.key === "planfix_base_url" && !/^https?:\/\//i.test(value)) {
    const err = new Error("Адрес Planfix должен начинаться с https://");
    err.status = 400;
    throw err;
  }

  await db.query(
    `INSERT INTO fm_settings (key, value, updated_by, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_by = $3, updated_at = now()`,
    [key, value, userId || null]
  );
  await load();
  return { key, cleared: false };
}

module.exports = { load, get, num, set, describe, REGISTRY };
