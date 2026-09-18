/* ============================================================
 *  Черновик гарантийного письма — то, что показывают ПЕРЕД сохранением.
 *
 *  Письмо уходит в суд. Увидеть его нужно до того, как оно легло в папку
 *  проекта, а не после: иначе в папке остаётся файл, который «вроде не
 *  тот», и рядом с ним второй, и через месяц никто не скажет, какой из
 *  них отправляли.
 *
 *  Поэтому письмо сначала собирается в черновик, показывается человеку
 *  целиком — и обоими файлами, с приложением и без, — и только по кнопке
 *  «Сохранить» переезжает в дело.
 *
 *  ГДЕ ЛЕЖИТ. /.Черновики ГП/<id>/ — папка с точкой, то есть невидимая
 *  в списке файлов. Это важно: черновик не должен попадаться на глаза в
 *  «Делах» и уж тем более уходить в суд по ошибке. Имена файлов внутри —
 *  НАСТОЯЩИЕ: их видно в заголовке редактора, и человек должен смотреть
 *  на то же имя, под которым письмо потом сохранится.
 *
 *  ПРАВИТЬ МОЖНО ТОЛЬКО ТЕКСТОВОЕ ПИСЬМО. Письмо с приложением — то же
 *  самое плюс сканы, и оно ПЕРЕСОБИРАЕТСЯ из текстового: и когда его
 *  открывают посмотреть, и при сохранении. Иначе правка в одном файле
 *  молча не попадала бы во второй, и в суд ушла бы старая редакция —
 *  ровно та ошибка, ради которой предпросмотр и делается.
 *
 *  ЖИВЁТ СУТКИ. Человек мог закрыть вкладку, уйти домой, передумать.
 *  Черновики старше суток убираются при создании следующего: складывать
 *  их вечно — значит однажды удивиться размеру хранилища.
 * ============================================================ */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DIR = "/.Черновики ГП";
const META = "черновик.json";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const dirOf = (id) => `${DIR}/${id}`;
const metaPathOf = (id) => `${dirOf(id)}/${META}`;
const fileIn = (id, name) => `${dirOf(id)}/${name}`;

function badRequest(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/** id черновика — только из букв и цифр: он попадает в путь. */
function cleanId(raw) {
  const id = String(raw ?? "");
  if (!/^[a-z0-9]{6,40}$/.test(id)) throw badRequest("Черновик не найден", 404);
  return id;
}

/**
 * Создаёт черновик: кладёт оба файла и запоминает, куда их потом
 * сохранять и из чего пересобирать приложение.
 *
 * @param safeResolve      превращает путь хранилища в путь на диске
 * @param payload.userId   кто создал — чужой черновик открывать нельзя
 * @param payload.meta     всё, что нужно для сохранения и пересборки
 * @param payload.plain    буфер письма без приложения
 * @param payload.withAttachments буфер письма с приложением (или null)
 */
async function create(safeResolve, { userId, meta, plain, withAttachments }) {
  await sweepOld(safeResolve);

  const id = crypto.randomBytes(8).toString("hex");
  const dir = safeResolve(dirOf(id));
  await fs.promises.mkdir(dir, { recursive: true });

  await fs.promises.writeFile(path.join(dir, meta.plainName), plain);
  if (withAttachments) {
    await fs.promises.writeFile(path.join(dir, meta.withDocsName), withAttachments);
  }

  const stored = {
    id,
    userId,
    createdAt: new Date().toISOString(),
    noScans: !withAttachments,
    ...meta,
  };
  await fs.promises.writeFile(
    safeResolve(metaPathOf(id)), JSON.stringify(stored, null, 2), "utf8");
  return stored;
}

/**
 * Читает черновик и заодно проверяет, что он этого человека.
 * Администратор здесь не исключение: чужое неотправленное письмо —
 * не тот случай, когда «админу можно всё», а случай, когда двое
 * незаметно правят один документ.
 */
async function read(safeResolve, rawId, userId) {
  const id = cleanId(rawId);
  let raw;
  try {
    raw = await fs.promises.readFile(safeResolve(metaPathOf(id)), "utf8");
  } catch (err) {
    throw badRequest("Черновик не найден — возможно, он уже сохранён или устарел", 404);
  }
  const meta = JSON.parse(raw);
  if (userId !== undefined && String(meta.userId) !== String(userId)) {
    throw badRequest("Это черновик другого сотрудника", 403);
  }
  return meta;
}

/** Текущее содержимое письма — с правками, если его открывали в редакторе. */
function readPlain(safeResolve, meta) {
  return fs.promises.readFile(safeResolve(fileIn(meta.id, meta.plainName)));
}

/** Кладёт пересобранное письмо с приложением на место. */
function writeWithDocs(safeResolve, meta, buffer) {
  return fs.promises.writeFile(safeResolve(fileIn(meta.id, meta.withDocsName)), buffer);
}

const plainPath = (meta) => fileIn(meta.id, meta.plainName);
const withDocsPath = (meta) => fileIn(meta.id, meta.withDocsName);

/** Убрать черновик целиком — после сохранения или по отказу. */
async function remove(safeResolve, id) {
  await fs.promises.rm(safeResolve(dirOf(cleanId(id))), { recursive: true, force: true });
}

/**
 * Забытые черновики. Считаем по времени создания из самой папки, а не по
 * метке внутри: если файл метки повреждён, папку всё равно надо убрать.
 */
async function sweepOld(safeResolve) {
  const root = safeResolve(DIR);
  let names;
  try {
    names = await fs.promises.readdir(root);
  } catch (err) {
    return;   // папки ещё нет — и хорошо
  }
  const now = Date.now();
  for (const name of names) {
    try {
      const full = path.join(root, name);
      const stat = await fs.promises.stat(full);
      if (now - stat.mtimeMs > MAX_AGE_MS) {
        await fs.promises.rm(full, { recursive: true, force: true });
      }
    } catch (err) { /* не смогли — переживём, это уборка */ }
  }
}

module.exports = {
  DIR, create, read, readPlain, writeWithDocs, remove, sweepOld,
  plainPath, withDocsPath, dirOf, cleanId,
};
