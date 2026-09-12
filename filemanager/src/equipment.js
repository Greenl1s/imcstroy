const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const QRCode = require("qrcode");
const db = require("./db");
const files = require("./files");

/**
 * Оборудование: папка «База данных / Оборудование» как отражение приборов.
 *
 *   Оборудование/<Классификация>/<ИНВ — Название>/Изображения/
 *                                                /Поверка/
 *   Оборудование/Списанные/<ИНВ — Название>/...
 *
 * Синхронизировать по сети нечего: ИСУ и «Учёт оборудования» ходят в одну
 * базу (общий контейнер db), и здесь читается та же таблица instruments,
 * из которой живёт «Учёт». Прибор, заведённый из папки, появляется там
 * мгновенно, и наоборот.
 *
 * Источник правды — карточка прибора, а не папка. Классификация, название
 * и инвентарный номер живут в базе; папка идёт за ними следом. Поэтому
 * переименованная руками папка при следующей сверке вернёт своё имя, а
 * перетащенная в чужую классификацию — уедет обратно. Иначе у одного и
 * того же прибора появилось бы два имени и две классификации, и было бы
 * непонятно, какая настоящая.
 *
 * Ничего чужого модуль не трогает: он создаёт и двигает только те папки,
 * которые сам же и завёл (их пути записаны в instruments.folder_path), и
 * папки классификаций. Всё, что лежало в «Оборудовании» раньше, остаётся
 * на месте — про него интерфейс отдельно скажет, что оно там есть.
 */

const EQUIPMENT_DIR = "/База данных/Оборудование";
const RETIRED_DIRNAME = "Списанные";
// Сюда уезжают папки приборов, которых больше нет в «Учёте»:
// файлы целы, но видно, что прибор из системы удалён.
const ARCHIVE_DIRNAME = "Архив";
const NO_TYPE_DIRNAME = "Не указано";
const IMAGES_DIRNAME = "Изображения";
const DOCS_DIRNAME = "Поверка";

/** Служебные подпапки прибора — заводятся сразу, чтобы не гадать, куда класть. */
const INSTRUMENT_SUBDIRS = [IMAGES_DIRNAME, DOCS_DIRNAME];

/**
 * QR-код прибора лежит файлом в его же папке.
 *
 * Отдельной подпапки не заводим: это один файл, а папка ради одного
 * файла только добавляет щелчок. Раньше все QR сваливались в общую
 * «Оборудование/QR-код» плоским списком — найти там нужный можно было
 * только по имени, а имена повторяются.
 *
 * Рисуем на сервере, а не в браузере: тогда QR просто ЕСТЬ у каждого
 * прибора, а не появляется после того, как кто-то вспомнил нажать
 * «выгрузить». Заодно ИСУ не приходится тянуть внешнюю библиотеку —
 * он специально обходится без внешних загрузок.
 */
const QR_FILENAME = "QR-код.png";

/**
 * Имя папки прибора: «ИМС-0303 — Толщиномер УТ-911».
 *
 * Инвентарный номер впереди по двум причинам. Во-первых, названия
 * повторяются — двух «Толщиномеров УТ-911» в одной папке быть не может,
 * а номер уникален. Во-вторых, папки выстраиваются по номеру, как строки
 * в журнале, и прибор находится глазами.
 *
 * Номера может не быть (поле необязательное) — тогда берём внутренний
 * номер прибора, как это делает сам «Учёт» в списке (#12).
 */
function instrumentFolderName(instrument) {
  const number = String(instrument.inventory_no || "").trim() || `#${instrument.id}`;
  const name = String(instrument.name || "").trim() || "без названия";
  return sanitizeSegment(`${number} — ${name}`);
}

/**
 * Чистит отрезок пути: в именах файлов нельзя слэшей и служебных знаков,
 * а точка в конце молча срезается Windows при распаковке архива.
 * Резать приходится здесь: название прибора человек пишет свободно.
 */
function sanitizeSegment(raw) {
  const clean = String(raw ?? "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/, "")
    .slice(0, 150)
    .trim();
  return clean || "без названия";
}

/** Название папки классификации — полное, как человек его читает. */
function classificationDirName(controlType, typesByCode) {
  if (!controlType) return NO_TYPE_DIRNAME;
  const found = typesByCode.get(controlType);
  return sanitizeSegment(found ? found.full_name : controlType);
}

/** Где приборy положено лежать по его карточке. */
function expectedFolder(instrument, typesByCode) {
  const parent = instrument.status === "retired"
    ? `${EQUIPMENT_DIR}/${RETIRED_DIRNAME}`
    : `${EQUIPMENT_DIR}/${classificationDirName(instrument.control_type, typesByCode)}`;
  return `${parent}/${instrumentFolderName(instrument)}`;
}

async function loadControlTypes() {
  try {
    const { rows } = await db.query(
      "SELECT code, full_name, short_name FROM control_types ORDER BY position, code"
    );
    return new Map(rows.map((r) => [r.code, r]));
  } catch (err) {
    // Таблицы может не быть, если «Учёт» ещё не разворачивали. Это не
    // повод ронять файловый менеджер — просто все приборы окажутся
    // в «Не указано».
    if (err.code === "42P01") return new Map();
    throw err;
  }
}

async function loadInstruments() {
  const { rows } = await db.query(
    `SELECT id, inventory_no, name, model, serial_number, control_type, company_code,
            check_type, verification_date, valid_until, comment, status,
            taken_where, taken_at, folder_path,
            photo_link_path, document_link_path
       FROM instruments
      ORDER BY id`
  );
  return rows;
}

/**
 * Приводит папки в соответствие с базой.
 *
 * Возвращает отчёт: что завели, что перенесли, что убрали в архив.
 * Папки с файлами не удаляются никогда — осиротевшая уезжает
 * в «Архив». Удаление папки со свидетельствами из-за расхождения
 * в данных было бы несоразмерной ценой за аккуратность.
 *
 * Вызывается после любого изменения прибора и при открытии папки
 * «Оборудование». Дешёвая: сравнивает строки, а трогает диск только
 * там, где действительно разошлось.
 */
async function sync(options = {}) {
  const report = { created: [], moved: [], archived: [], skipped: [], qr: 0 };

  let instruments;
  let typesByCode;
  try {
    typesByCode = await loadControlTypes();
    instruments = await loadInstruments();
  } catch (err) {
    if (err.code === "42P01") return report; // «Учёта» в этой базе нет
    throw err;
  }

  await files.ensureDir(EQUIPMENT_DIR);

  // Папки классификаций заводим все сразу, даже пустые: человек должен
  // видеть, куда класть прибор, ещё до того как заведёт первый.
  for (const type of typesByCode.values()) {
    const dir = `${EQUIPMENT_DIR}/${sanitizeSegment(type.full_name)}`;
    if (!(await files.pathExists(dir))) {
      await files.ensureDir(dir);
      report.created.push(dir);
    }
  }

  for (const instrument of instruments) {
    const target = expectedFolder(instrument, typesByCode);
    const current = instrument.folder_path;

    if (current === target && (await files.pathExists(target))) {
      // Папка на месте — но QR мог не появиться (прибор завели до этой
      // возможности) или устареть после переезда. Дешёвая проверка.
      if (await ensureQr(instrument, target, options.baseUrl)) report.qr += 1;
      continue;
    }

    try {
      if (current && current !== target && (await files.pathExists(current))) {
        await moveFolder(current, target);
        report.moved.push({ id: instrument.id, from: current, to: target });
      } else if (!(await files.pathExists(target))) {
        await files.ensureDir(target);
        report.created.push(target);
      }
      for (const sub of INSTRUMENT_SUBDIRS) await files.ensureDir(`${target}/${sub}`);
      await ensureQr(instrument, target, options.baseUrl);
      if (current !== target) {
        await db.query("UPDATE instruments SET folder_path = $1 WHERE id = $2", [target, instrument.id]);
      }
    } catch (err) {
      // Одна неудачная папка не должна останавливать сверку остальных:
      // иначе один прибор с испорченным именем заморозил бы весь раздел.
      console.error("Оборудование: не удалось разложить прибор", instrument.id, err.message);
      report.skipped.push({ id: instrument.id, reason: err.message });
    }
  }

  await archiveOrphans(instruments, typesByCode, report);

  return report;
}

/**
 * Папки, которым больше нечего соответствовать, уезжают в «Архив».
 *
 * Прибор удалили в «Учёте» — его папка со снимками и свидетельствами
 * остаётся сиротой. Удалять её молча нельзя: там документы, которые
 * никто больше не восстановит. Поэтому она переезжает в
 * «Оборудование/Архив» — видно, что прибора нет, но файлы целы.
 *
 * Пустая папка классификации, которой больше нет в списке, туда же:
 * это просто мусор. Непустую не трогаем — в ней что-то лежит, и это
 * «что-то» положил человек.
 */
async function archiveOrphans(instruments, typesByCode, report) {
  const expected = new Set(instruments.map((i) => expectedFolder(i, typesByCode)));
  const liveTypes = new Set([
    ...[...typesByCode.values()].map((t) => sanitizeSegment(t.full_name)),
    RETIRED_DIRNAME, NO_TYPE_DIRNAME, ARCHIVE_DIRNAME,
  ]);

  let level1;
  try { level1 = await files.listDir(EQUIPMENT_DIR); } catch { return; }

  for (const type of level1.folders) {
    if (type.name === ARCHIVE_DIRNAME) continue;
    const typeDir = `${EQUIPMENT_DIR}/${type.name}`;

    let inside;
    try { inside = await files.listDir(typeDir); } catch { continue; }

    for (const entry of inside.folders) {
      const rel = `${typeDir}/${entry.name}`;
      if (expected.has(rel)) continue;
      // Трогаем только свои папки. Признак — QR-код внутри: его кладёт
      // сверка и больше никто. Папку, которую человек завёл руками,
      // модуль не двигает: это его правило с самого начала.
      if (!(await files.pathExists(`${rel}/${QR_FILENAME}`))) continue;
      try {
        const to = await moveFolder(rel, `${EQUIPMENT_DIR}/${ARCHIVE_DIRNAME}/${entry.name}`);
        report.archived.push({ from: rel, to });
      } catch (err) {
        console.error("Оборудование: не удалось убрать в архив", rel, err.message);
      }
    }

    // Классификации больше нет, и внутри пусто — папке тут делать нечего.
    // Непустую не трогаем: в ней что-то лежит, и это «что-то» положил
    // человек, а не сверка.
    if (!liveTypes.has(type.name)) {
      let rest = { folders: [], files: [] };
      try { rest = await files.listDir(typeDir); } catch { continue; }
      if (!rest.folders.length && !rest.files.length) {
        try {
          await files.removeEntry(typeDir);
          report.archived.push({ from: typeDir, to: null });
        } catch (err) {
          console.error("Оборудование: не удалось убрать пустую папку", typeDir, err.message);
        }
      }
    }
  }
}

/**
 * Можно ли удалять эту папку из файлового менеджера.
 *
 * Папки оборудования — не обычные папки, а отражение базы: их заводит
 * сверка, и удалённая вернётся на место при следующем открытии раздела.
 * Поэтому удалять их отсюда бессмысленно, а последствия настоящие —
 * вместе с папкой уезжают в корзину снимки и свидетельства.
 *
 * Возвращает причину отказа или null, если удалять можно.
 * Файлы внутри не защищены: лишний снимок убрать — обычное дело.
 */
function deleteGuard(relPath) {
  const clean = String(relPath || "").replace(/\/+$/, "");
  if (clean !== EQUIPMENT_DIR && !clean.startsWith(EQUIPMENT_DIR + "/")) return null;

  if (clean === EQUIPMENT_DIR) {
    return "«Оборудование» — корень раздела приборов, его нельзя удалить.";
  }

  const rest = clean.slice(EQUIPMENT_DIR.length + 1).split("/");

  // Архив держит папки уже удалённых приборов — их разбирают руками,
  // и защищать там нечего.
  if (rest[0] === ARCHIVE_DIRNAME) return null;

  if (rest.length === 1) {
    return `Папка «${rest[0]}» — это классификация из «Учёта оборудования». ` +
      "Удалите классификацию там, и папка уйдёт сама.";
  }
  if (rest.length === 2) {
    return `Папка «${rest[1]}» принадлежит прибору. ` +
      "Удалите или спишите прибор в «Учёте оборудования» — папка уедет в архив вместе с файлами.";
  }
  if (rest.length === 3 && INSTRUMENT_SUBDIRS.includes(rest[2])) {
    return `«${rest[2]}» — служебная папка прибора, в неё складываются файлы из формы. ` +
      "Её можно очистить, но не удалить.";
  }
  return null;
}

/**
 * Рисует QR-код прибора, если его ещё нет.
 *
 * Возвращает true, если файл был создан. Существующий не перерисовываем:
 * содержимое кода зависит только от номера прибора, а он не меняется, —
 * значит и перерисовывать нечего. Обновить принудительно можно через
 * rebuildQr (кнопка выгрузки).
 *
 * Адрес в коде тот же, что открывает карточку в «Учёте»: отсканировал
 * наклейку на корпусе — попал в карточку этого прибора.
 */
async function ensureQr(instrument, folder, baseUrl) {
  const rel = `${folder}/${QR_FILENAME}`;
  if (await files.pathExists(rel)) return false;
  await writeQr(instrument, rel, baseUrl);
  return true;
}

async function writeQr(instrument, relPath, baseUrl) {
  const base = (baseUrl || process.env.INSTRUMENTS_PUBLIC_URL || "/instruments/").replace(/\/+$/, "");
  const url = `${base}/?id=${instrument.id}`;
  const png = await QRCode.toBuffer(url, {
    type: "png", width: 320, margin: 2, errorCorrectionLevel: "M",
  });
  await fsp.writeFile(files.safeResolve(relPath), png);
}

/**
 * Перерисовывает QR у всех приборов — на случай, если поменялся адрес
 * сайта. Отдельно от sync: обычная сверка не должна каждый раз
 * переписывать сотни файлов ради ничего не изменившегося кода.
 */
async function rebuildQr(baseUrl) {
  const typesByCode = await loadControlTypes();
  const instruments = await loadInstruments();
  let done = 0;
  for (const instrument of instruments) {
    const folder = instrument.folder_path || expectedFolder(instrument, typesByCode);
    try {
      await files.ensureDir(folder);
      await writeQr(instrument, `${folder}/${QR_FILENAME}`, baseUrl);
      done += 1;
    } catch (err) {
      console.error("Оборудование: не удалось нарисовать QR для", instrument.id, err.message);
    }
  }
  return done;
}

/**
 * Пути всех QR-файлов — для выгрузки одним архивом.
 *
 * Отдаём вместе с именем прибора: в архиве файл должен называться так,
 * чтобы его можно было найти, а не «QR-код (17).png».
 */
async function qrFiles() {
  const typesByCode = await loadControlTypes();
  const instruments = await loadInstruments();
  const out = [];
  for (const instrument of instruments) {
    if (instrument.status === "retired") continue; // наклейки нужны на рабочие приборы
    const folder = instrument.folder_path || expectedFolder(instrument, typesByCode);
    const rel = `${folder}/${QR_FILENAME}`;
    if (await files.pathExists(rel)) {
      out.push({ path: rel, name: `${instrumentFolderName(instrument)}.png` });
    }
  }
  return out;
}

/**
 * Переносит папку прибора, разбираясь с уже занятым именем.
 *
 * Занятым оно оказывается редко, но реально: кто-то мог завести такую
 * папку руками. Затирать её нельзя — там могут быть чужие файлы, —
 * поэтому к имени добавляется номер, а не происходит слияние.
 */
async function moveFolder(from, to) {
  const parent = path.posix.dirname(to);
  await files.ensureDir(parent);

  const fromAbs = files.safeResolve(from);
  let toAbs = files.safeResolve(to);
  if (fs.existsSync(toAbs)) {
    let n = 2;
    while (fs.existsSync(files.safeResolve(`${to} (${n})`))) n += 1;
    toAbs = files.safeResolve(`${to} (${n})`);
  }
  await fsp.rename(fromAbs, toAbs);
}

/**
 * Что за папка сейчас открыта: корень оборудования, классификация,
 * папка прибора — или к оборудованию отношения не имеет.
 *
 * Нужно интерфейсу, чтобы показать правильную полосу и правильную
 * кнопку. Решение принимает сервер: он один знает и базу, и диск.
 */
async function describe(relPath) {
  const clean = String(relPath || "").replace(/\/+$/, "");
  if (clean !== EQUIPMENT_DIR && !clean.startsWith(EQUIPMENT_DIR + "/")) return null;

  const typesByCode = await loadControlTypes();

  if (clean === EQUIPMENT_DIR) {
    const { rows } = await db.query(
      `SELECT control_type, status, COUNT(*)::int AS n FROM instruments GROUP BY control_type, status`
    ).catch(() => ({ rows: [] }));
    return {
      kind: "root",
      path: clean,
      classifications: [...typesByCode.values()].map((t) => ({
        code: t.code, name: t.full_name, short: t.short_name,
        count: rows.filter((r) => r.control_type === t.code && r.status !== "retired")
          .reduce((sum, r) => sum + r.n, 0),
      })),
      strangers: await strangersIn(clean, typesByCode),
    };
  }

  // Папка прибора? Спрашиваем базу по точному пути — так же, как «Дела»
  // узнают проект по пути папки.
  const { rows } = await db.query(
    `SELECT i.*, tu.username AS taken_by_name
       FROM instruments i
       LEFT JOIN users tu ON tu.id = i.taken_by
      WHERE i.folder_path = $1`, [clean]
  ).catch(() => ({ rows: [] }));
  if (rows.length) {
    return { kind: "instrument", path: clean, instrument: decorate(rows[0], typesByCode) };
  }

  const rest = clean.slice(EQUIPMENT_DIR.length + 1);
  if (!rest.includes("/")) {
    return { kind: "classification", path: clean, name: rest };
  }
  return { kind: "inside", path: clean };
}

/** Прибор для полосы в папке: только то, что там показывается. */
function decorate(row, typesByCode) {
  const type = row.control_type ? typesByCode.get(row.control_type) : null;
  return {
    id: row.id,
    inventory_no: row.inventory_no,
    name: row.name,
    model: row.model,
    serial_number: row.serial_number,
    status: row.status,
    taken_by_name: row.taken_by_name,
    taken_where: row.taken_where,
    taken_at: row.taken_at,
    check_type: row.check_type,
    valid_until: row.valid_until,
    control_type: row.control_type,
    control_type_name: type ? type.full_name : null,
    control_type_short: type ? type.short_name : null,
    has_photo_link: Boolean(row.photo_link_path),
  };
}

/**
 * Что лежит в «Оборудовании» помимо папок классификаций.
 *
 * Это разовая история: до автоматизации там уже что-то было, и трогать
 * это нельзя. Показываем список, а разбирать человек будет сам —
 * молча двигать чужие файлы значит ломать ссылки и права на папки.
 */
async function strangersIn(relPath, typesByCode) {
  const known = new Set([
    ...[...typesByCode.values()].map((t) => sanitizeSegment(t.full_name)),
    NO_TYPE_DIRNAME, RETIRED_DIRNAME,
  ]);
  try {
    const { folders, files: fileList } = await files.listDir(relPath);
    return [
      ...folders.filter((f) => !known.has(f.name)).map((f) => ({ name: f.name, isDir: true })),
      ...fileList.map((f) => ({ name: f.name, isDir: false })),
    ];
  } catch {
    return [];
  }
}

/**
 * Куда положить файл, загруженный с компьютера.
 *
 * kind: "photo" — фотография прибора, "document" — свидетельство
 * о поверке/калибровке. Возвращает путь папки; если папки прибора ещё
 * нет, заводит её.
 */
async function uploadDirFor(instrumentId, kind) {
  const { rows } = await db.query("SELECT * FROM instruments WHERE id = $1", [instrumentId]);
  if (!rows.length) {
    const err = new Error("Прибор не найден");
    err.status = 404;
    throw err;
  }
  const instrument = rows[0];
  const typesByCode = await loadControlTypes();
  const folder = instrument.folder_path || expectedFolder(instrument, typesByCode);

  const sub = kind === "document" ? DOCS_DIRNAME : IMAGES_DIRNAME;
  await files.ensureDir(`${folder}/${sub}`);
  if (instrument.folder_path !== folder) {
    await db.query("UPDATE instruments SET folder_path = $1 WHERE id = $2", [folder, instrument.id]);
  }
  return `${folder}/${sub}`;
}

/**
 * Первое изображение в папке становится фотографией прибора — если
 * фотографии ещё нет.
 *
 * Именно «если ещё нет»: выбранное вручную фото не должно перебиваться
 * тем, что кто-то докинул в папку ещё один снимок. Ссылкой, а не копией
 * в базе: один файл в одном месте, иначе две копии однажды разойдутся.
 */
async function adoptFirstImage(instrumentId, relFilePath, kind) {
  const column = kind === "document" ? "document_link_path" : "photo_link_path";
  const { rowCount } = await db.query(
    `UPDATE instruments SET ${column} = $1 WHERE id = $2 AND ${column} IS NULL`,
    [relFilePath, instrumentId]
  );
  return rowCount > 0;
}

module.exports = {
  EQUIPMENT_DIR, RETIRED_DIRNAME, NO_TYPE_DIRNAME, IMAGES_DIRNAME, DOCS_DIRNAME, QR_FILENAME,
  instrumentFolderName, sanitizeSegment, classificationDirName, expectedFolder,
  sync, describe, uploadDirFor, adoptFirstImage, loadControlTypes,
  ensureQr, rebuildQr, qrFiles, deleteGuard,
};
