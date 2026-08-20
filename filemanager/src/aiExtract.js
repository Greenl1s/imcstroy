const OMNIROUTE_URL = process.env.OMNIROUTE_URL || "http://omniroute:20129";
// Комбинация с поддержкой изображений — подходит и для обычного текста тоже,
// поэтому используем её везде, не держим два разных выбора модели.
const MODEL = process.env.OMNIROUTE_MODEL || "auto/best-vision";

const SYSTEM_PROMPT = `Ты — ассистент делопроизводителя в организации, которая проводит судебные экспертизы и научные исследования (НИ).
Тебе присылают текст или изображение одного документа (определение суда, запрос, договор, письмо и т.п.),
относящегося к новому или существующему проекту (экспертизе/НИ).

Разбери документ и верни СТРОГО валидный JSON (без markdown-разметки, без пояснений до или после) со следующими полями:

{
  "document_category": одно из "запрос" | "первичные_материалы" | "определение_суда" | "организационные_документы" | "иное",
  "case_number": номер дела или договора, если есть, иначе null,
  "court_or_customer": название суда ИЛИ название организации-заказчика (кто direct-контакт по этому документу), иначе null,
  "judge_name": ФИО судьи, если указано, иначе null,
  "expertise_type_guess": один из "строительно-техническая" | "пожарно-техническая" | "землеустроительная" | "почерковедческая" | null (если не удаётся определить или не подходит ни один вариант),
  "project_type_guess": "expertise" (если это судебная экспертиза) или "research" (если это независимое исследование, НИ), или null если не ясно,
  "year": год документа (число), если определим, иначе null,
  "summary": краткое (1 предложение) описание документа по-русски,
  "confidence": число от 0 до 1 — насколько ты уверен в извлечённых данных
}

Если какое-то поле невозможно определить — используй null, не выдумывай. Отвечай ТОЛЬКО JSON-объектом.`;

/** Достаёт JSON из ответа модели, даже если он завёрнут в markdown code fence. */
function extractJson(raw) {
  const trimmed = String(raw || "").trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch (err) {
    // Модель могла добавить текст до/после — попробуем вырезать { ... }
    const braceMatch = candidate.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        return JSON.parse(braceMatch[0]);
      } catch (err2) { /* падаем ниже с исходной ошибкой */ }
    }
    throw new Error("ИИ вернул невалидный JSON: " + err.message);
  }
}

function buildUserContent(prepared) {
  if (prepared.kind === "text") {
    return prepared.text.slice(0, 20000); // разумный предел на длину текста
  }
  // kind === 'image' — одна или несколько страниц/фото
  return [
    { type: "text", text: "Изображение(я) документа приложены ниже." },
    ...prepared.images.map((base64) => ({
      type: "image_url",
      image_url: { url: `data:${prepared.mediaType};base64,${base64}` },
    })),
  ];
}

/**
 * Отправляет один подготовленный файл (см. fileTextExtract.prepareFileForAnalysis)
 * на анализ через OmniRoute. Возвращает разобранный объект с полями —
 * см. SYSTEM_PROMPT выше. Бросает исключение при сетевой ошибке или
 * если ИИ вернул что-то, что не парсится как JSON.
 */
async function analyzeDocument(prepared, filename) {
  const body = {
    model: MODEL,
    temperature: 0,
    max_tokens: 800,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserContent(prepared) },
    ],
  };

  const res = await fetch(`${OMNIROUTE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OmniRoute ответил ошибкой ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const rawContent = data?.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error("ИИ не вернул содержимого ответа");
  }

  const parsed = extractJson(rawContent);
  return { ...parsed, source_file: filename };
}

module.exports = { analyzeDocument, extractJson, buildUserContent, SYSTEM_PROMPT };
