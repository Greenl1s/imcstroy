const fs = require("fs");
const path = require("path");

function withNumber(fileName, number) {
  if (number === 1) return fileName;
  const ext = path.extname(fileName);
  const stem = ext ? fileName.slice(0, -ext.length) : fileName;
  return `${stem} (${number})${ext}`;
}

/** Первое свободное имя: документ.docx, документ (2).docx и далее. */
function one(destDir, wantedName, exists = fs.existsSync) {
  for (let number = 1; number < 10000; number++) {
    const candidate = withNumber(wantedName, number);
    if (!exists(path.join(destDir, candidate))) return candidate;
  }
  throw new Error(`Не удалось подобрать свободное имя для файла «${wantedName}»`);
}

/** Один номер версии для нескольких связанных файлов. */
function group(destDir, wantedNames, exists = fs.existsSync) {
  for (let number = 1; number < 10000; number++) {
    const candidates = wantedNames.map((name) => withNumber(name, number));
    if (candidates.every((name) => !exists(path.join(destDir, name)))) return candidates;
  }
  throw new Error("Не удалось подобрать свободные имена для документов");
}

module.exports = { one, group, withNumber };
