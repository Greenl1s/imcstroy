const AdmZip = require("adm-zip");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);

/**
 * Достаёт весь текст из .docx-файла (все параграфы, склеенные переносами
 * строк). Та же техника, что уже используется для чтения биографий
 * экспертов в gpGenerate.js, только без фильтрации по пустым строкам —
 * здесь нужен связный текст документа целиком.
 */
function extractDocxText(buffer) {
  const zip = new AdmZip(buffer);
  const entry = zip.getEntry("word/document.xml");
  if (!entry) {
    throw new Error("Файл не похож на .docx (нет word/document.xml внутри)");
  }
  const xml = entry.getData().toString("utf8");
  const paraMatches = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
  const lines = paraMatches.map((p) => {
    const runs = p.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
    return runs
      .map((r) => r.replace(/<w:t[^>]*>/, "").replace("</w:t>", ""))
      .join("")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  });
  return lines.join("\n").trim();
}

/**
 * Достаёт текст из .pdf, если у файла есть настоящий текстовый слой
 * (не скан). Возвращает пустую строку, если текста почти нет —
 * это сигнал, что перед нами скан/фото и нужно распознавание через
 * зрение ИИ, а не обычное извлечение текста.
 */
async function extractPdfText(buffer) {
  const { PDFParse } = require("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return (result.text || "").trim();
}

/**
 * Превращает страницы PDF в PNG-картинки (через pdftoppm) — нужно для
 * сканов/фото, упакованных в PDF: у OmniRoute "общий" OpenAI-совместимый
 * формат, который понимает картинки, но не умеет читать PDF напрямую
 * (это была особенность именно прямого API Anthropic). Ограничиваем
 * maxPages, чтобы не заваливать ИИ полусотней страниц за раз.
 */
async function rasterizePdfToImages(buffer, maxPages = 5) {
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "pdf-shot-"));
  const pdfPath = path.join(tmpDir, "in.pdf");
  await fs.promises.writeFile(pdfPath, buffer);

  try {
    await execFileAsync("pdftoppm", [
      "-png", "-r", "150", "-l", String(maxPages), pdfPath, path.join(tmpDir, "page"),
    ]);
    const files = (await fs.promises.readdir(tmpDir))
      .filter((f) => f.startsWith("page") && f.endsWith(".png"))
      .sort();
    const images = [];
    for (const f of files) {
      const data = await fs.promises.readFile(path.join(tmpDir, f));
      images.push(data.toString("base64"));
    }
    return images;
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  }
}

/** true, если извлечённого текста настолько мало, что документ похож на скан. */
function looksLikeScan(text) {
  return text.replace(/\s/g, "").length < 40;
}

/**
 * Главная функция: получает файл (буфер + имя), сама решает, как его
 * читать, и возвращает либо { kind: 'text', text }, либо
 * { kind: 'image', mediaType, images: [base64, ...] } — второе значит,
 * что текста извлечь не удалось, нужно смотреть на файл как на картинку(и).
 */
async function prepareFileForAnalysis(buffer, filename) {
  const ext = (filename.split(".").pop() || "").toLowerCase();

  if (ext === "docx") {
    const text = extractDocxText(buffer);
    return { kind: "text", text: text || "(файл почти пуст)" };
  }

  if (ext === "pdf") {
    const text = await extractPdfText(buffer);
    if (!looksLikeScan(text)) return { kind: "text", text };
    // Мало текста — это скан. Растеризуем страницы в картинки.
    const images = await rasterizePdfToImages(buffer);
    return { kind: "image", mediaType: "image/png", images };
  }

  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
    const mediaType = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" }[ext];
    return { kind: "image", mediaType, images: [buffer.toString("base64")] };
  }

  throw new Error(`Формат файла "${ext}" не поддерживается для распознавания`);
}

module.exports = { extractDocxText, extractPdfText, looksLikeScan, prepareFileForAnalysis, rasterizePdfToImages };
