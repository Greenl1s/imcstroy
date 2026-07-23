const jwt = require("jsonwebtoken");
const path = require("path");

const ONLYOFFICE_JWT_SECRET = process.env.ONLYOFFICE_JWT_SECRET;
const INTERNAL_TOKEN_SECRET = process.env.INTERNAL_TOKEN_SECRET || process.env.JWT_SECRET;
const ONLYOFFICE_PUBLIC_URL = process.env.ONLYOFFICE_PUBLIC_URL; // например https://office.imcstroy.ru
const FILEMANAGER_INTERNAL_URL = process.env.FILEMANAGER_INTERNAL_URL || "http://filemanager:3000";

if (!ONLYOFFICE_JWT_SECRET) {
  throw new Error("Переменная окружения ONLYOFFICE_JWT_SECRET не задана");
}
if (!ONLYOFFICE_PUBLIC_URL) {
  throw new Error("Переменная окружения ONLYOFFICE_PUBLIC_URL не задана");
}

const DOC_TYPE_BY_EXT = {
  doc: "word", docx: "word", odt: "word", rtf: "word", txt: "word", pdf: "word",
  xls: "cell", xlsx: "cell", ods: "cell", csv: "cell",
  ppt: "slide", pptx: "slide", odp: "slide",
};

const EDITABLE_EXT = new Set(["docx", "xlsx", "pptx", "odt", "ods", "odp"]);

function extOf(fileName) {
  return path.extname(fileName).slice(1).toLowerCase();
}

function isOfficeFile(fileName) {
  return Object.prototype.hasOwnProperty.call(DOC_TYPE_BY_EXT, extOf(fileName));
}

// Короткоживущий токен для внутренних запросов (OnlyOffice -> наш backend).
// НЕ то же самое, что токен пользовательской сессии.
function signInternalToken(relPath) {
  return jwt.sign({ path: relPath }, INTERNAL_TOKEN_SECRET, { expiresIn: "20m" });
}

function verifyInternalToken(token, relPath) {
  const payload = jwt.verify(token, INTERNAL_TOKEN_SECRET);
  if (payload.path !== relPath) {
    throw new Error("Токен не соответствует пути файла");
  }
  return true;
}

function buildEditorConfig({ relPath, fileName, userId, userName }) {
  const ext = extOf(fileName);
  const documentType = DOC_TYPE_BY_EXT[ext];
  if (!documentType) {
    throw new Error("Формат файла не поддерживается для просмотра");
  }
  const token = signInternalToken(relPath);
  const encodedPath = encodeURIComponent(relPath);

  const config = {
    document: {
      fileType: ext,
      key: buildDocKey(relPath),
      title: fileName,
      url: `${FILEMANAGER_INTERNAL_URL}/internal/raw?path=${encodedPath}&token=${token}`,
      permissions: {
        edit: EDITABLE_EXT.has(ext),
        download: true,
      },
    },
    documentType,
    editorConfig: {
      callbackUrl: `${FILEMANAGER_INTERNAL_URL}/api/onlyoffice/callback?path=${encodedPath}&token=${token}`,
      user: { id: String(userId), name: userName },
      lang: "ru",
    },
  };

  config.token = jwt.sign(config, ONLYOFFICE_JWT_SECRET);
  return { config, scriptUrl: `${ONLYOFFICE_PUBLIC_URL}/web-apps/apps/api/documents/api.js` };
}

// Ключ версии документа для OnlyOffice — должен меняться при каждом изменении файла,
// иначе редактор будет показывать старую закэшированную версию.
function buildDocKey(relPath) {
  const crypto = require("crypto");
  return crypto.createHash("md5").update(relPath + Date.now()).digest("hex").slice(0, 20);
}

module.exports = {
  isOfficeFile,
  buildEditorConfig,
  signInternalToken,
  verifyInternalToken,
};
