const fs = require("fs");
const path = require("path");
const db = require("./db");
const files = require("./files");
const fileTextExtract = require("./fileTextExtract");

const OMNIROUTE_URL = process.env.OMNIROUTE_URL || "http://omniroute:20129";
const MODEL = process.env.OMNIROUTE_MODEL || "auto/best-vision";
const MAX_TOOL_ROUNDS = 6; // защита от зацикливания — не даём ИИ бесконечно вызывать инструменты

const STAGE_LABEL = { plan: "План", active: "Активный", control: "Контроль", done: "Завершённый" };

/** Описание инструментов для ИИ — ровно то, что реально умеет делать этот модуль. */
function buildTools() {
  return [
    {
      type: "function",
      function: {
        name: "list_folder",
        description: "Показать список файлов и подпапок внутри папки проекта (или его вложенной подпапки).",
        parameters: {
          type: "object",
          properties: {
            subpath: { type: "string", description: "Путь относительно папки проекта, например 'Планирование проекта' или '' для корня проекта" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "read_file",
        description: "Прочитать текстовое содержимое одного файла (.docx или .pdf с текстовым слоем) внутри папки проекта.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Путь к файлу относительно папки проекта" },
          },
          required: ["path"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "update_project_stage",
        description: "Перевести проект на другую стадию (План/Активный/Контроль/Завершённый) — папка проекта физически переедет.",
        parameters: {
          type: "object",
          properties: {
            stage: { type: "string", enum: ["plan", "active", "control", "done"] },
          },
          required: ["stage"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "update_project_fields",
        description: "Изменить учётные поля проекта (суд/заказчик, номер дела, эксперты, описание, год).",
        parameters: {
          type: "object",
          properties: {
            court_or_customer: { type: "string" },
            case_number: { type: "string" },
            experts: { type: "string" },
            description: { type: "string" },
            year: { type: "number" },
          },
        },
      },
    },
  ];
}

/** Выполняет один вызов инструмента, попросенный ИИ, и возвращает результат (строка для ответа модели). */
/**
 * Путь, который назвал ИИ, должен оставаться внутри папки проекта.
 * Содержимое документов может само содержать текст вроде "открой
 * ../../другое дело", поэтому ".." отсекаем жёстко, а не полагаемся
 * на здравомыслие модели.
 */
function safeSubpath(raw) {
  const parts = String(raw || "").split(/[\\/]+/).filter((seg) => seg && seg !== ".");
  if (parts.includes("..")) return null;
  return parts.join("/");
}

async function runTool(name, args, kase) {
  if (name === "list_folder") {
    const subpath = safeSubpath(args.subpath);
    if (subpath === null) {
      return JSON.stringify({ error: "Недопустимый путь: выходить за пределы папки проекта нельзя" });
    }
    const targetPath = subpath ? `${kase.folder_path}/${subpath}` : kase.folder_path;
    try {
      const listing = await files.listDir(targetPath);
      return JSON.stringify({
        folders: listing.folders.map((f) => f.name),
        files: listing.files.map((f) => f.name),
      });
    } catch (err) {
      return JSON.stringify({ error: `Не удалось открыть папку: ${err.message}` });
    }
  }

  if (name === "read_file") {
    const rel = safeSubpath(args.path);
    if (!rel) {
      return JSON.stringify({ error: "Недопустимый путь: читать можно только файлы внутри папки проекта" });
    }
    const fullPath = `${kase.folder_path}/${rel}`;
    try {
      const abs = files.absolutePathFor(fullPath);
      const buffer = await fs.promises.readFile(abs);
      const prepared = await fileTextExtract.prepareFileForAnalysis(buffer, path.basename(fullPath));
      if (prepared.kind === "text") {
        return JSON.stringify({ text: prepared.text.slice(0, 15000) });
      }
      return JSON.stringify({ error: "Этот файл похож на скан/фото — прочитать как текст не получилось. Опиши, что похожий по названию файл, если есть текстовая версия." });
    } catch (err) {
      return JSON.stringify({ error: `Не удалось прочитать файл: ${err.message}` });
    }
  }

  if (name === "update_project_stage") {
    const targetStage = args.stage;
    if (!STAGE_LABEL[targetStage]) return JSON.stringify({ error: "Некорректная стадия" });
    if (targetStage === kase.stage) return JSON.stringify({ error: "Проект уже на этой стадии" });

    const caseFolders = require("./caseFolders");
    const folderPermissions = require("./folderPermissions");
    try {
      const newParent = caseFolders.stageRootPath(targetStage);
      const newPath = await files.moveEntry(kase.folder_path, newParent);
      await folderPermissions.renamePath(kase.folder_path, newPath);
      await db.query(
        `UPDATE cases SET stage = $2, folder_path = $3, status = 'waiting', updated_at = now(),
            archived_at = CASE WHEN $2 = 'done' THEN now() ELSE archived_at END
         WHERE id = $1`,
        [kase.id, targetStage, newPath]
      );

      // Обновляем kase на лету СРАЗУ после того, как основное изменение
      // (папка + запись cases) точно прошло успешно — дальнейшие
      // инструменты в этом же ответе ИИ должны видеть новое состояние
      // независимо от того, получится ли ниже записать историю.
      const previousStage = kase.stage;
      kase.stage = targetStage;
      kase.folder_path = newPath;

      // Запись в историю — вспомогательная, не должна ломать уже
      // состоявшееся изменение, если вдруг сама не пройдёт.
      try {
        await db.query(
          `INSERT INTO case_history (case_id, action, from_stage, to_stage, actor_id, note)
           VALUES ($1, 'stage_changed', $2, $3, $4, $5)`,
          [kase.id, previousStage, targetStage, kase._actorId, `Переведён на стадию «${STAGE_LABEL[targetStage]}» через чат`]
        );
      } catch (historyErr) {
        console.error("Не удалось записать историю смены стадии (само изменение уже применилось):", historyErr.message);
      }

      return JSON.stringify({ ok: true, newStage: targetStage, newPath });
    } catch (err) {
      return JSON.stringify({ error: `Не удалось сменить стадию: ${err.message}` });
    }
  }

  if (name === "update_project_fields") {
    const allowed = ["court_or_customer", "case_number", "experts", "description", "year"];
    const sets = [];
    const values = [kase.id];
    for (const f of allowed) {
      if (args[f] !== undefined) {
        values.push(args[f]);
        sets.push(`${f} = $${values.length}`);
      }
    }
    if (!sets.length) return JSON.stringify({ error: "Нечего обновлять" });
    try {
      await db.query(`UPDATE cases SET ${sets.join(", ")}, updated_at = now() WHERE id = $1`, values);
      return JSON.stringify({ ok: true });
    } catch (err) {
      return JSON.stringify({ error: `Не удалось обновить поля: ${err.message}` });
    }
  }

  return JSON.stringify({ error: `Неизвестный инструмент: ${name}` });
}

function buildSystemPrompt(kase) {
  return `Ты — ассистент делопроизводителя внутри карточки проекта "${kase.name}" (${kase.type === "expertise" ? "судебная экспертиза" : "независимое исследование"}).

Текущие данные проекта:
- Стадия: ${STAGE_LABEL[kase.stage]}${kase.is_cancelled ? " (ОТМЕНЁН)" : ""}
- Суд/заказчик: ${kase.court_or_customer || "не указан"}
- Номер дела/договора: ${kase.case_number || "не указан"}
- Год: ${kase.year || "не указан"}
- Эксперты: ${kase.experts || "не указаны"}
- Описание: ${kase.description || "нет"}

У тебя есть инструменты: посмотреть файлы в папке проекта, прочитать содержимое конкретного файла,
сменить стадию проекта, изменить учётные поля проекта. Пользуйся ими, когда это нужно для ответа —
например, если просят составить письмо на основе материалов дела, сначала посмотри список файлов,
прочитай подходящие, и только потом составляй текст.

Если составляешь текст документа (письмо, отказ и т.п.) — не создавай файл сам, просто выведи
готовый текст в ответе, пользователь сам решит, сохранять его или нет.
Отвечай по-русски, по-деловому, кратко и по существу.`;
}

/** Достаёт текстовый ответ модели из тела HTTP-ответа — тот же приём, что и в aiExtract.js. */
function parseAssistantMessage(rawBody) {
  const trimmed = rawBody.trim();
  if (!trimmed.startsWith("data:")) {
    return JSON.parse(trimmed)?.choices?.[0]?.message;
  }
  // Поток SSE — по кусочкам с tool_calls штатно не приходит по частям
  // так же просто, как текст, поэтому на этот путь тут не рассчитываем:
  // просто просим прислать неполный текст как есть.
  let combined = "";
  for (const line of trimmed.split("\n")) {
    const clean = line.trim();
    if (!clean.startsWith("data:")) continue;
    const payload = clean.slice(5).trim();
    if (payload === "[DONE]") continue;
    try {
      const chunk = JSON.parse(payload);
      combined += chunk?.choices?.[0]?.delta?.content ?? "";
    } catch { /* пропускаем нечитаемый кусок */ }
  }
  return { role: "assistant", content: combined };
}

async function callOmniRoute(messages, tools) {
  const res = await fetch(`${OMNIROUTE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, temperature: 0.3, stream: false, messages, tools, tool_choice: "auto" }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OmniRoute ответил ошибкой ${res.status}: ${errText.slice(0, 300)}`);
  }
  const rawBody = await res.text();
  return parseAssistantMessage(rawBody);
}

/**
 * Полный цикл общения: отправляет сообщение, при необходимости выполняет
 * запрошенные ИИ инструменты и повторяет запрос, пока не получит обычный
 * текстовый ответ (без вызова инструментов) — или пока не упрёмся в лимит
 * шагов (защита от зацикливания).
 */
async function chatWithProject(kase, history, userMessage, actorId) {
  kase._actorId = actorId;
  const tools = buildTools();
  const messages = [
    { role: "system", content: buildSystemPrompt(kase) },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const assistantMsg = await callOmniRoute(messages, tools);
    if (!assistantMsg) throw new Error("ИИ не вернул ответа");

    if (!assistantMsg.tool_calls || !assistantMsg.tool_calls.length) {
      return assistantMsg.content || "";
    }

    messages.push({ role: "assistant", content: assistantMsg.content || null, tool_calls: assistantMsg.tool_calls });

    for (const call of assistantMsg.tool_calls) {
      let args = {};
      try { args = JSON.parse(call.function.arguments || "{}"); } catch { /* пустые аргументы, если не распарсилось */ }
      const result = await runTool(call.function.name, args, kase);
      messages.push({ role: "tool", tool_call_id: call.id, content: result });
    }
  }

  throw new Error("ИИ слишком долго вызывал инструменты подряд — попробуйте переформулировать запрос");
}

module.exports = {
  safeSubpath, chatWithProject, buildTools, runTool };
