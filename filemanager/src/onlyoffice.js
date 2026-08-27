const jwt = require("jsonwebtoken");
const path = require("path");

const ONLYOFFICE_JWT_SECRET = process.env.ONLYOFFICE_JWT_SECRET;
const INTERNAL_TOKEN_SECRET = process.env.INTERNAL_TOKEN_SECRET || process.env.JWT_SECRET;
const ONLYOFFICE_PUBLIC_URL = process.env.ONLYOFFICE_PUBLIC_URL; // например https://office.imcstroy.ru
// Адрес, по которому наш backend сам обращается к OnlyOffice ВНУТРИ docker-сети,
// не через публичный домен (иначе будет уходить в интернет и возвращаться
// обратно на тот же сервер — часто виснет по таймауту).
const ONLYOFFICE_INTERNAL_URL = process.env.ONLYOFFICE_INTERNAL_URL || "http://onlyoffice:80";
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
// Срок жизни специально большой (24 часа): OnlyOffice вызывает сохранение
// только при закрытии документа — если бы токен истекал раньше, чем
// длится реальное редактирование, финальное сохранение отклонялось бы
// как "недействительный токен".
function signInternalToken(relPath, canEdit) {
  return jwt.sign({ path: relPath, canEdit: Boolean(canEdit) }, INTERNAL_TOKEN_SECRET, { expiresIn: "24h" });
}

/**
 * options.requireEdit — токен должен быть выдан для РЕДАКТИРОВАНИЯ.
 * Без этой проверки любой, кто просто открыл файл на просмотр, получал
 * вместе с конфигом редактора токен, которым можно было вызвать колбэк
 * сохранения и перезаписать файл, доступный ему только для чтения.
 * Старые токены (без поля canEdit) на запись не годятся.
 */
function verifyInternalToken(token, relPath, options = {}) {
  const payload = jwt.verify(token, INTERNAL_TOKEN_SECRET);
  if (payload.path !== relPath) {
    throw new Error("Токен не соответствует пути файла");
  }
  if (options.requireEdit && payload.canEdit !== true) {
    throw new Error("Этот токен не даёт права сохранять файл");
  }
  return payload;
}

/**
 * Проверяет, что ссылка на сохранённый документ ведёт к нашему же
 * OnlyOffice, а не куда-то ещё. Иначе колбэком можно было заставить
 * сервер сходить по произвольному адресу (в том числе во внутреннюю
 * docker-сеть) и записать полученный ответ в файл.
 */
function isAllowedOnlyOfficeUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (err) {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  const allowed = new Set();
  for (const base of [ONLYOFFICE_PUBLIC_URL, ONLYOFFICE_INTERNAL_URL]) {
    try { allowed.add(new URL(base).origin); } catch (err) { /* пропускаем кривой адрес */ }
  }
  return allowed.has(parsed.origin);
}

// OnlyOffice в колбэке присылает ссылку на сохранённый файл через свой
// ПУБЛИЧНЫЙ адрес (ONLYOFFICE_PUBLIC_URL). Если наш backend попробует
// обратиться по этому адресу напрямую, запрос уйдёт в интернет и будет
// пытаться вернуться на этот же сервер — это часто зависает по таймауту.
// Подменяем начало адреса на внутренний docker-адрес перед тем, как идти за файлом.
function toInternalOnlyOfficeUrl(url) {
  try {
    const parsed = new URL(url);
    const publicOrigin = new URL(ONLYOFFICE_PUBLIC_URL).origin;
    if (parsed.origin === publicOrigin) {
      return ONLYOFFICE_INTERNAL_URL + parsed.pathname + parsed.search;
    }
    return url;
  } catch (err) {
    return url;
  }
}

function buildEditorConfig({ relPath, fileName, userId, userName, canEdit }) {
  const ext = extOf(fileName);
  const documentType = DOC_TYPE_BY_EXT[ext];
  if (!documentType) {
    throw new Error("Формат файла не поддерживается для просмотра");
  }
  const encodedPath = encodeURIComponent(relPath);

  // По умолчанию — как раньше (редактируемые форматы можно редактировать).
  // Если явно передан canEdit=false (например, у пользователя только "читать"
  // на эту папку в "Дела") — открываем строго в режиме просмотра.
  const allowEdit = canEdit === undefined ? EDITABLE_EXT.has(ext) : (canEdit && EDITABLE_EXT.has(ext));

  // Токен на чтение файла и токен на сохранение — разные: сохранять
  // разрешаем только когда файл и правда открыт на редактирование.
  const readToken = signInternalToken(relPath, false);
  const saveToken = signInternalToken(relPath, allowEdit);

  const config = {
    document: {
      fileType: ext,
      key: buildDocKey(relPath),
      title: fileName,
      url: `${FILEMANAGER_INTERNAL_URL}/internal/raw?path=${encodedPath}&token=${readToken}`,
      permissions: {
        edit: allowEdit,
        download: true,
      },
    },
    documentType,
    editorConfig: {
      mode: allowEdit ? "edit" : "view",
      callbackUrl: `${FILEMANAGER_INTERNAL_URL}/api/onlyoffice/callback?path=${encodedPath}&token=${saveToken}`,
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
  isAllowedOnlyOfficeUrl,
  buildEditorConfig,
  signInternalToken,
  verifyInternalToken,
  toInternalOnlyOfficeUrl,
};
