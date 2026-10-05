const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const docxImages = require("./docxImages");

const execFileAsync = promisify(execFile);
const MAX_IMAGES = 40;

async function imageFiles(dir, prefix) {
  return (await fs.promises.readdir(dir))
    .filter((name) => name.startsWith(prefix) && /\.(png|jpe?g)$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

async function readLargeImages(dir, names) {
  const result = [];
  for (const name of names.slice(0, MAX_IMAGES)) {
    const buffer = await fs.promises.readFile(path.join(dir, name));
    const size = docxImages.imageSize(buffer);
    // Логотипы, маски шрифтов и декоративные элементы PDF не являются
    // отдельными сканами. Оставляем только достаточно крупные изображения.
    if (!size || size.width * size.height < 300000 || Math.min(size.width, size.height) < 300) continue;
    result.push({ buffer, extension: size.kind === "png" ? "png" : "jpg" });
  }
  return result;
}

/**
 * Превращает PDF-вложение в изображения для Word.
 *
 * Сначала pdfimages достаёт исходные крупные сканы. Поэтому страница,
 * внутри которой лежат два или три отдельных снимка, превращается в два
 * или три приложения. Если PDF не содержит извлекаемых картинок (например,
 * это обычная отсканированная/смешанная страница), каждая страница
 * растеризуется целиком через pdftoppm.
 */
async function pdfToImages(buffer, sourceName = "Документ.pdf") {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "document-pdf-"));
  const input = path.join(dir, "input.pdf");
  await fs.promises.writeFile(input, buffer);
  try {
    try {
      const { stdout } = await execFileAsync("pdfinfo", [input]);
      const pages = Number(/^Pages:\s+(\d+)/mi.exec(stdout)?.[1] || 0);
      if (pages > MAX_IMAGES) {
        throw Object.assign(new Error(`В PDF «${sourceName}» больше ${MAX_IMAGES} страниц`), { status: 400 });
      }
    } catch (err) {
      if (err.status) throw err;
      // Повреждённый PDF всё равно даст понятную ошибку на конвертации.
    }
    try {
      await execFileAsync("pdfimages", ["-f", "1", "-l", String(MAX_IMAGES), "-png", input, path.join(dir, "scan")]);
      const extractedNames = await imageFiles(dir, "scan");
      if (extractedNames.length > MAX_IMAGES) {
        throw Object.assign(new Error(`В PDF «${sourceName}» слишком много отдельных изображений`), { status: 400 });
      }
      const extracted = await readLargeImages(dir, extractedNames);
      if (extracted.length) {
        return extracted.map((item, index) => ({
          name: `${path.parse(sourceName).name} — изображение ${index + 1}.${item.extension}`,
          buffer: item.buffer,
        }));
      }
    } catch (err) {
      if (err.status) throw err;
      // Не все PDF позволяют извлечь исходные объекты. Ниже есть надёжный
      // запасной путь: отрисовка страниц целиком.
    }

    await execFileAsync("pdftoppm", [
      "-png", "-r", "150", "-f", "1", "-l", String(MAX_IMAGES), input, path.join(dir, "page"),
    ]);
    const pages = await imageFiles(dir, "page");
    if (!pages.length) throw Object.assign(new Error(`PDF «${sourceName}» не содержит страниц`), { status: 400 });
    return Promise.all(pages.slice(0, MAX_IMAGES).map(async (name, index) => ({
      name: `${path.parse(sourceName).name} — страница ${index + 1}.png`,
      buffer: await fs.promises.readFile(path.join(dir, name)),
    })));
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
}

module.exports = { pdfToImages, MAX_IMAGES };
