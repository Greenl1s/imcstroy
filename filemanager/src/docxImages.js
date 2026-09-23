/* ============================================================
 *  Картинки внутри .docx.
 *
 *  .docx — это zip с несколькими xml. Чтобы в нём появилась картинка,
 *  мало вставить абзац: файл должен лежать в word/media, быть записан в
 *  word/_rels/document.xml.rels и его расширение должно быть объявлено
 *  в [Content_Types].xml. Пропустишь любое из трёх — Word откроет
 *  документ и скажет, что он повреждён.
 *
 *  Библиотеку для этого не берём по той же причине, по которой её нет
 *  в experts.js: нужного здесь — ровно три операции, и они умещаются в
 *  один файл, зато нет ещё одной зависимости, которая живёт своей
 *  жизнью.
 * ============================================================ */

/** Сколько EMU в одном twip: 914400 EMU в дюйме, 1440 twips в дюйме. */
const EMU_PER_TWIP = 635;

/**
 * Размеры картинки — из её собственного заголовка.
 *
 * Без размеров Word растянет вставленное как попало, поэтому читаем их
 * сами. PNG: ширина и высота лежат в блоке IHDR сразу за подписью.
 * JPEG: приходится идти по маркерам до первого SOF — у JPEG нет одного
 * места, где написан размер.
 *
 * Возвращает { width, height } в пикселях или null, если это не
 * картинка и не наше дело гадать.
 */
function imageSize(buffer) {
  if (!buffer || buffer.length < 24) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A, дальше длина + "IHDR" + ширина + высота.
  if (buffer.readUInt32BE(0) === 0x89504e47 && buffer.readUInt32BE(4) === 0x0d0a1a0a) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), kind: "png" };
  }

  // JPEG: FF D8, дальше цепочка маркеров FF xx с длиной.
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buffer.length) {
      if (buffer[i] !== 0xff) { i++; continue; }
      const marker = buffer[i + 1];
      // SOF0..SOF15, кроме DHT (C4), JPGA (C8) и DAC (CC) — они не про размер.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buffer.readUInt16BE(i + 5), width: buffer.readUInt16BE(i + 7), kind: "jpeg" };
      }
      const length = buffer.readUInt16BE(i + 2);
      if (length < 2) return null;
      i += 2 + length;
    }
  }
  return null;
}

/** Расширение по содержимому, а не по имени: имя мог набрать человек. */
function imageExtension(buffer) {
  const size = imageSize(buffer);
  if (!size) return null;
  return size.kind === "png" ? "png" : "jpeg";
}

/**
 * Во сколько EMU вписать картинку.
 *
 * Держим пропорции и не даём вылезти ни за ширину набора, ни за высоту
 * страницы: скан паспорта, снятый телефоном вертикально, иначе занял бы
 * три листа и уехал за поля.
 */
function fitEmu(size, maxWidthEmu, maxHeightEmu) {
  const widthEmu = size.width * 9525;   // 1 пиксель при 96 dpi = 9525 EMU
  const heightEmu = size.height * 9525;
  const scale = Math.min(1, maxWidthEmu / widthEmu, maxHeightEmu / heightEmu);
  return {
    cx: Math.max(1, Math.round(widthEmu * scale)),
    cy: Math.max(1, Math.round(heightEmu * scale)),
  };
}

/**
 * Ширина и высота набора страницы из sectPr документа.
 *
 * Берём из самого документа, а не из общей константы: шаблон ГП и
 * самодельные «Сведения» свёрстаны по-разному, и картинка должна
 * вписываться в ту страницу, на которой окажется.
 */
function pageBoxEmu(documentXml) {
  const sz = /<w:pgSz[^>]*w:w="(\d+)"[^>]*w:h="(\d+)"/.exec(documentXml);
  const mar = /<w:pgMar[^>]*\/>/.exec(documentXml);
  const num = (attr) => {
    if (!mar) return 0;
    const m = new RegExp(`w:${attr}="(-?\\d+)"`).exec(mar[0]);
    return m ? Math.abs(Number(m[1])) : 0;
  };
  const pageW = sz ? Number(sz[1]) : 11906;
  const pageH = sz ? Number(sz[2]) : 16838;
  const widthTwips = pageW - num("left") - num("right");
  const heightTwips = pageH - num("top") - num("bottom");
  return {
    maxWidthEmu: Math.max(1, widthTwips) * EMU_PER_TWIP,
    maxHeightEmu: Math.max(1, heightTwips) * EMU_PER_TWIP,
  };
}

/**
 * Абзац с картинкой.
 *
 * docPr id должен быть уникальным в пределах документа — Word на
 * совпадающих ругается, — поэтому номер приходит снаружи.
 */
function imageParagraphXml({ relId, id, cx, cy, title, rotation = 0 }) {
  const safeTitle = String(title || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="120"/></w:pPr><w:r><w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0" ` +
      `xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">` +
      `<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>` +
      `<wp:docPr id="${id}" name="Рисунок ${id}" descr="${safeTitle}"/>` +
      `<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1" ` +
        `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/></wp:cNvGraphicFramePr>` +
      `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
      `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
      `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
      `<pic:nvPicPr><pic:cNvPr id="${id}" name="Рисунок ${id}" descr="${safeTitle}"/><pic:cNvPicPr/></pic:nvPicPr>` +
      `<pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ` +
        `r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
      `<pic:spPr><a:xfrm${rotation ? ` rot="${rotation * 60000}"` : ""}><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
      `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
      `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

/**
 * Готовит zip к тому, чтобы в него можно было вставлять картинки.
 *
 * Возвращает функцию add(buffer, title) → xml одного абзаца с картинкой
 * (или null, если это не картинка). Файлы и связи она дописывает в zip
 * сама; вызывающему остаётся только положить готовый xml в нужное место
 * документа.
 */
function imageAdder(zip, documentXml) {
  const relsPath = "word/_rels/document.xml.rels";
  const typesPath = "[Content_Types].xml";

  const relsEntry = zip.getEntry(relsPath);
  let relsXml = relsEntry
    ? relsEntry.getData().toString("utf8")
    : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';

  const typesEntry = zip.getEntry(typesPath);
  let typesXml = typesEntry ? typesEntry.getData().toString("utf8") : null;

  // Новые номера связей и рисунков начинаем заведомо выше занятых:
  // в шаблоне уже есть и картинки шапки, и колонтитулы.
  let nextNumber = 1;
  for (const m of relsXml.matchAll(/Id="rId(\d+)"/g)) {
    nextNumber = Math.max(nextNumber, Number(m[1]) + 1);
  }
  let nextDocPr = 1000;
  const { maxWidthEmu, maxHeightEmu } = pageBoxEmu(documentXml);
  let fileCounter = 0;

  function ensureContentType(ext) {
    if (!typesXml || typesXml.includes(`Extension="${ext}"`)) return;
    typesXml = typesXml.replace(
      "</Types>",
      `<Default Extension="${ext}" ContentType="image/${ext}"/></Types>`
    );
  }

  return {
    add(buffer, title, options = {}) {
      const size = imageSize(buffer);
      if (!size) return null;
      const rotation = [0, 90, 180, 270].includes(Number(options.rotation))
        ? Number(options.rotation) : 0;
      const widthPercent = [50, 75, 100].includes(Number(options.width_percent))
        ? Number(options.width_percent) : 100;
      const ext = size.kind === "png" ? "png" : "jpeg";
      const relId = `rId${nextNumber++}`;
      const fileName = `fmimg${++fileCounter}.${ext}`;

      zip.addFile(`word/media/${fileName}`, buffer);
      ensureContentType(ext);
      relsXml = relsXml.replace(
        "</Relationships>",
        `<Relationship Id="${relId}" ` +
        `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" ` +
        `Target="media/${fileName}"/></Relationships>`
      );

      // При повороте на четверть оборота видимая ширина становится высотой.
      // Сначала вписываем видимый прямоугольник, затем возвращаем размеры
      // исходной рамки, которую Word уже повернёт через a:xfrm.
      const quarterTurn = rotation === 90 || rotation === 270;
      const visibleSize = quarterTurn
        ? { width: size.height, height: size.width }
        : size;
      const fitted = fitEmu(visibleSize, maxWidthEmu, maxHeightEmu);
      const scale = widthPercent / 100;
      const visibleCx = Math.max(1, Math.round(fitted.cx * scale));
      const visibleCy = Math.max(1, Math.round(fitted.cy * scale));
      const cx = quarterTurn ? visibleCy : visibleCx;
      const cy = quarterTurn ? visibleCx : visibleCy;
      return imageParagraphXml({ relId, id: nextDocPr++, cx, cy, title, rotation });
    },
    /** Записать накопленные связи и типы обратно в zip. */
    flush() {
      zip.getEntry(relsPath)
        ? zip.updateFile(relsPath, Buffer.from(relsXml, "utf8"))
        : zip.addFile(relsPath, Buffer.from(relsXml, "utf8"));
      if (typesXml) zip.updateFile(typesPath, Buffer.from(typesXml, "utf8"));
    },
  };
}

module.exports = { imageSize, imageExtension, imageAdder, pageBoxEmu, EMU_PER_TWIP };
