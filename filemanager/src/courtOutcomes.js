/**
 * Что установил суд — и что из этого следует по рабочей инструкции.
 *
 * Здесь две отдельные вещи, и их важно не смешивать:
 *
 *   1) построить ПРЕДЛОЖЕНИЕ — посчитать, что по инструкции должно
 *      произойти с проектом. Ничего не меняет;
 *   2) ПРИМЕНИТЬ предложение — уже с переносом папки, сменой этапа и
 *      постановкой задач.
 *
 * Разделены они потому, что применение делает человек: перевод стадии
 * двигает папку и меняет Planfix, и делать это молча по вписанному
 * вручную тексту нельзя.
 *
 * Сами правила лежат в таблице court_outcomes и правятся из интерфейса:
 * инструкция пересматривается, и её изменение не должно требовать
 * пересборки образа.
 */
const db = require("./db");
const workCalendar = require("./workCalendar");

const STAGE_LABEL = { plan: "План", active: "Активный", control: "Контроль", done: "Завершённый" };
const STATUS_LABEL = { waiting: "Ожидание", in_progress: "В работе", problem: "Проблема" };

/**
 * Дата для чтения человеком: 30.11.2026.
 * Машинные значения (tasks[].due) остаются в ISO — их читает не человек,
 * а Planfix; в тексте шагов ISO смотрелся бы чужеродно рядом с историей.
 */
function ru(iso) {
  const s = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
}

/** Исходы, возможные на этой стадии проекта. */
async function listOutcomes(stage) {
  const { rows } = await db.query(
    `SELECT * FROM court_outcomes
      WHERE is_active AND ($1::text IS NULL OR applies_to = 'any' OR applies_to = $1)
      ORDER BY position, id`,
    [stage || null]
  );
  return rows;
}

async function getOutcome(id) {
  const { rows } = await db.query("SELECT * FROM court_outcomes WHERE id = $1", [id]);
  return rows[0] || null;
}

/**
 * Считает срок одной задачи по её правилу.
 *
 * Правила взяты из инструкции буквально:
 *   work_days      — «+N рабочих дней» (раздел 25);
 *   days           — «через N дней» и «через две недели» (п. 20.2, 24.3);
 *   before_hearing — «за N дней до заседания» (раздел 25);
 *   hearing        — сама дата заседания;
 *   expertise_due  — срок, установленный судом в определении (п. 20.1).
 *
 * Если данных не хватает (не знаем дату заседания или срок экспертизы),
 * возвращаем срок пустым и говорим почему — пусть человек поставит сам,
 * а не получит выдуманную дату.
 */
async function resolveDue(due, ctx) {
  if (!due || !due.kind) return { date: null, why: null, calendarKnown: true };

  switch (due.kind) {
    case "work_days": {
      const res = await workCalendar.addWorkingDays(ctx.eventDate, due.n);
      return { date: res.date, why: null, calendarKnown: res.calendarKnown };
    }
    case "days":
      return { date: workCalendar.addCalendarDays(ctx.eventDate, due.n), why: null, calendarKnown: true };
    case "before_hearing":
      if (!ctx.hearingDate) return { date: null, why: "не указана дата заседания", calendarKnown: true };
      return { date: workCalendar.subCalendarDays(ctx.hearingDate, due.n), why: null, calendarKnown: true };
    case "hearing":
      if (!ctx.hearingDate) return { date: null, why: "не указана дата заседания", calendarKnown: true };
      return { date: ctx.hearingDate, why: null, calendarKnown: true };
    case "expertise_due":
      if (!ctx.expertiseDue) return { date: null, why: "не указан срок экспертизы из определения", calendarKnown: true };
      return { date: ctx.expertiseDue, why: null, calendarKnown: true };
    default:
      return { date: null, why: null, calendarKnown: true };
  }
}

/**
 * Новый срок задачи контроля по правилу исхода (п. 16.2, 24.3).
 * Возвращает { date, text, calendarKnown } — text объясняет, откуда дата.
 */
async function resolveControl(rule, ctx) {
  switch (rule) {
    case "hearing_plus_3": {
      if (!ctx.hearingDate) {
        return { date: null, text: "дата заседания не указана — срок контроля не пересчитан", calendarKnown: true };
      }
      const res = await workCalendar.addWorkingDays(ctx.hearingDate, 3);
      return { date: res.date, text: "дата заседания плюс 3 рабочих дня", calendarKnown: res.calendarKnown };
    }
    case "every_2_weeks":
      return { date: workCalendar.addCalendarDays(ctx.eventDate, 14), text: "контроль раз в две недели", calendarKnown: true };
    case "recheck_2_days":
      return { date: workCalendar.addCalendarDays(ctx.eventDate, 2), text: "повторный контроль через 2 дня", calendarKnown: true };
    case "next_hearing":
      if (!ctx.hearingDate) {
        return { date: null, text: "следующее заседание неизвестно — срок контроля не пересчитан", calendarKnown: true };
      }
      return { date: ctx.hearingDate, text: "перенос на следующее заседание", calendarKnown: true };
    default:
      return { date: null, text: null, calendarKnown: true };
  }
}

/**
 * Строит предложение: что по инструкции должно произойти с проектом.
 * Ничего не меняет — только считает и объясняет.
 */
async function buildPlan(kase, outcome, input) {
  const ctx = {
    eventDate: input.eventDate,
    hearingDate: input.hearingDate || null,
    expertiseDue: input.expertiseDue || null,
  };

  const steps = [];
  const warnings = [];
  let calendarKnown = true;

  // 1. Этап и папка.
  let targetStage = null;
  let cancel = false;

  if (outcome.cancels) {
    cancel = true;
    steps.push("Проект отменяется: папка переезжает в «04. Архив / Отмененные», задачи закрываются, причина фиксируется.");
    if (kase.stage !== "plan") {
      warnings.push(
        "Это отмена уже начатой экспертизы. По п. 29.3 её проводит руководитель, " +
        "и до архивирования нужно убедиться, что физические материалы возвращены суду " +
        "и подтверждение возврата сохранено."
      );
    }
  } else if (outcome.sets_stage && outcome.sets_stage !== kase.stage) {
    targetStage = outcome.sets_stage;
    steps.push(`Этап: «${STAGE_LABEL[kase.stage] || kase.stage}» → «${STAGE_LABEL[targetStage] || targetStage}», папка переезжает.`);
  }

  // 2. Статус.
  let targetStatus = null;
  if (outcome.sets_status && outcome.sets_status !== kase.status) {
    targetStatus = outcome.sets_status;
    steps.push(`Статус: «${STATUS_LABEL[kase.status] || kase.status}» → «${STATUS_LABEL[targetStatus] || targetStatus}».`);
  }

  // 3. Срок задачи контроля.
  const control = await resolveControl(outcome.control_rule, ctx);
  if (control.calendarKnown === false) calendarKnown = false;
  if (control.text) {
    steps.push(control.date
      ? `Срок контроля: ${ru(control.date)} (${control.text}).`
      : `Срок контроля: ${control.text}.`);
  }

  // 4. Задачи.
  const tasks = [];
  for (const t of outcome.tasks || []) {
    const due = await resolveDue(t.due, ctx);
    if (due.calendarKnown === false) calendarKnown = false;
    tasks.push({ name: t.name, due: due.date, why: due.why, hint: t.hint || null });
    steps.push(due.date
      ? `Задача «${t.name}» со сроком ${ru(due.date)}.`
      : `Задача «${t.name}» без срока${due.why ? ` — ${due.why}` : ""}.`);
  }

  // 5. Предупреждения, которые важнее всего остального.
  if (outcome.requires_manager) {
    warnings.push("Требуется решение руководителя — применить может только он.");
  }
  if (outcome.needs_decision) {
    warnings.push(
      "Инструкция такой случай не описывает, поэтому программа не решает за вас: " +
      "выберите сами, что делать с проектом."
    );
  }
  if (outcome.needs_deadline && !ctx.expertiseDue) {
    warnings.push("Не указан срок экспертизы из определения — задача «Крайний срок сдачи экспертизы» останется без срока.");
  }
  if (!calendarKnown) {
    warnings.push(
      "Праздники на нужный год не заведены в производственном календаре, " +
      "поэтому сроки в рабочих днях посчитаны только по выходным. Проверьте даты."
    );
  }
  if (!steps.length) {
    steps.push("Состояние проекта не меняется — так и должно быть по инструкции для этого исхода.");
  }

  return {
    outcomeId: outcome.id,
    outcomeName: outcome.name,
    clause: outcome.clause || null,
    note: outcome.note || null,
    cancel,
    targetStage,
    targetStatus,
    controlDue: control.date,
    controlText: control.text,
    tasks,
    steps,
    warnings,
    requiresManager: !!outcome.requires_manager,
    needsDecision: !!outcome.needs_decision,
    calendarKnown,
  };
}

/* ---------------- Ведение справочника ---------------- */

const RULE_KINDS = ["none", "hearing_plus_3", "every_2_weeks", "recheck_2_days", "next_hearing"];
const APPLIES = ["any", "plan", "active", "control"];

function validateOutcome(body) {
  const name = String(body?.name || "").trim();
  if (!name) throw new Error("Укажите название исхода");
  if (body.applies_to && !APPLIES.includes(body.applies_to)) throw new Error("Некорректная стадия применения");
  if (body.control_rule && !RULE_KINDS.includes(body.control_rule)) throw new Error("Некорректное правило контроля");
  if (body.sets_stage && !STAGE_LABEL[body.sets_stage]) throw new Error("Некорректный этап");
  if (body.sets_status && !STATUS_LABEL[body.sets_status]) throw new Error("Некорректный статус");
  if (body.cancels && body.sets_stage) {
    throw new Error("Отмена и перевод на этап одновременно не имеют смысла — оставьте что-то одно");
  }
  return name;
}

async function saveOutcome(id, body, actorId) {
  const name = validateOutcome(body);
  const values = [
    name,
    body.applies_to || "any",
    body.sets_stage || null,
    body.sets_status || null,
    !!body.cancels,
    !!body.requires_manager,
    !!body.needs_decision,
    !!body.needs_deadline,
    body.control_rule || "none",
    JSON.stringify(Array.isArray(body.tasks) ? body.tasks : []),
    body.clause || null,
    body.note || null,
    Number(body.position) || 0,
    body.is_active === undefined ? true : !!body.is_active,
    actorId || null,
  ];

  try {
    if (id) {
      const { rows } = await db.query(
        `UPDATE court_outcomes SET name=$1, applies_to=$2, sets_stage=$3, sets_status=$4,
                cancels=$5, requires_manager=$6, needs_decision=$7, needs_deadline=$8,
                control_rule=$9, tasks=$10::jsonb, clause=$11, note=$12, position=$13,
                is_active=$14, updated_by=$15, updated_at=now()
          WHERE id=$16 RETURNING *`,
        [...values, id]
      );
      if (!rows.length) throw new Error("Исход не найден");
      return rows[0];
    }
    const { rows } = await db.query(
      `INSERT INTO court_outcomes
         (name, applies_to, sets_stage, sets_status, cancels, requires_manager,
          needs_decision, needs_deadline, control_rule, tasks, clause, note, position,
          is_active, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15) RETURNING *`,
      values
    );
    return rows[0];
  } catch (err) {
    if (err.code === "23505") throw new Error("Исход с таким названием уже есть в справочнике");
    throw err;
  }
}

async function removeOutcome(id) {
  const { rowCount } = await db.query("DELETE FROM court_outcomes WHERE id = $1", [id]);
  return rowCount > 0;
}

/** Шаги порядка работы по стадиям — из инструкции. */
async function listSteps() {
  const { rows } = await db.query(
    "SELECT id, stage, position, title, detail, clause FROM instruction_steps ORDER BY stage, position, id");
  return rows;
}

module.exports = {
  listOutcomes, getOutcome, buildPlan, saveOutcome, removeOutcome, listSteps,
  resolveControl, resolveDue, STAGE_LABEL, STATUS_LABEL, RULE_KINDS, APPLIES,
};
