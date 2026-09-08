// ============================================================
//  Папка «База данных / Оборудование» — отражение приборов «Учёта».
//
//  Проверяем то, ради чего это сделано:
//    * классификация — папка, прибор — папка внутри неё,
//      «Изображения» и «Поверка» заводятся сразу;
//    * сменили классификацию — папка переехала СО ВСЕМ содержимым;
//    * списали — уехала в «Списанные», восстановили — вернулась;
//    * прибор, заведённый из папки, есть в базе «Учёта» — это одна
//      и та же таблица, а не копия;
//    * файл с компьютера ложится в нужную подпапку и становится фото
//      карточки, но не перебивает уже выбранное;
//    * чужое, что лежало в «Оборудовании» раньше, не тронуто.
//
//  Запуск (стенд должен быть поднят):
//    node test/equipment.test.js
// ============================================================
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

process.env.PGHOST = process.env.PGHOST || "/tmp";
process.env.PGPORT = process.env.PGPORT || "5433";
process.env.PGUSER = process.env.PGUSER || "pribory";
process.env.PGDATABASE = process.env.PGDATABASE || "uchet";
process.env.DATA_ROOT = process.env.DATA_ROOT || "/home/claude/test/storage";
const db = require("/home/claude/fm/src/db.js");
const equipment = require("/home/claude/fm/src/equipment.js");

const U = "http://localhost:3999";
const EQ = "/home/claude/test/storage/База данных/Оборудование";

const results = [];
function check(name, cond, extra = "") {
  results.push({ name, ok: !!cond });
  console.log((cond ? "PASS " : "FAIL ") + name + (extra ? "  -> " + extra : ""));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = (p) => fs.existsSync(path.join(EQ, p));

/** Кладёт файлы в <input type="file"> — см. пояснение в experts.test.js. */
async function putFiles(page, selector, list) {
  await page.evaluate(({ sel, files }) => {
    const dt = new DataTransfer();
    for (const f of files) dt.items.add(new File([Uint8Array.from(f.bytes)], f.name, { type: f.type }));
    const input = document.querySelector(sel);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, { sel: selector, files: list.map((f) => ({ ...f, bytes: Array.from(f.bytes) })) });
}
const jpegBytes = Buffer.from("\xff\xd8\xff\xe0JPEG-заглушка", "binary");

const TEST_NO = "ТЕСТ-9001";

(async () => {
  // Свои приборы убираем перед началом — набор должен переживать повтор.
  await db.query("DELETE FROM instruments WHERE inventory_no LIKE 'ТЕСТ-%'");
  await equipment.sync();

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await browser.newPage({ viewport: { width: 1560, height: 950 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(U + "/__auth?state=in");
  await page.goto(U + "/__user?id=1&username=kirill&role=admin&tools=1&db=1&cases=1&resetPerms=1");
  await page.goto(U + "/", { waitUntil: "networkidle" });
  await sleep(700);

  /* --- 1. Раскладка --- */
  await page.click('.col[data-col="db"] .row-item:has-text("Оборудование")');
  await page.waitForSelector("#folderView:not(.hidden)");
  await sleep(2000);

  check("папки классификаций завелись сами",
    exists("Ультразвуковой контроль") && exists("Геодезическое оборудование"));
  check("кнопка «Добавить прибор» есть только здесь", await page.isVisible("#addInstrumentBtn"));

  // То, что лежало в «Оборудовании» до автоматизации, трогать нельзя.
  check("постороннее в папке не тронуто", exists("Поверки и Калибровки"));
  check("и про него честно сказано",
    /не относящ/.test(await page.textContent("#equipmentBanner")),
    (await page.textContent("#equipmentBanner")).replace(/\s+/g, " ").trim().slice(0, 90));

  /* --- 2. Заводим прибор из папки --- */
  await page.click('#folderList .file-row:has-text("Ультразвуковой контроль")');
  await sleep(1000);
  await page.click("#addInstrumentBtn");
  await sleep(600);

  // Классификация должна подставиться по папке: человек уже сказал,
  // куда кладёт прибор, спрашивать второй раз незачем.
  check("классификация подставлена по папке",
    (await page.inputValue("#instrumentControlType")) === "uzk",
    await page.inputValue("#instrumentControlType"));

  await page.fill('#instrumentForm [name="inventory_no"]', TEST_NO);
  await page.fill('#instrumentForm [name="name"]', "Толщиномер ТЕСТ");
  await page.fill('#instrumentForm [name="serial_number"]', "SN-777");
  await putFiles(page, "#instrumentPhotos", [
    { name: "Общий вид.jpg", bytes: jpegBytes, type: "image/jpeg" },
    { name: "Шильдик.jpg", bytes: jpegBytes, type: "image/jpeg" },
  ]);
  await putFiles(page, "#instrumentDocs", [
    { name: "Свидетельство.pdf", bytes: Buffer.from("%PDF-1.4"), type: "application/pdf" },
  ]);
  await page.click("#instrumentSubmitBtn");
  await sleep(2500);

  const { rows } = await db.query("SELECT * FROM instruments WHERE inventory_no = $1", [TEST_NO]);
  check("прибор появился в базе «Учёта» — это одна таблица, а не копия",
    rows.length === 1 && rows[0].name === "Толщиномер ТЕСТ", JSON.stringify(rows.length));
  const made = rows[0];

  const folder = "Ультразвуковой контроль/ТЕСТ-9001 — Толщиномер ТЕСТ";
  check("папка прибора на месте и названа по номеру", exists(folder), made.folder_path);
  check("служебные подпапки заведены сразу",
    exists(`${folder}/Изображения`) && exists(`${folder}/Поверка`));
  check("снимки легли в «Изображения»",
    exists(`${folder}/Изображения/Общий вид.jpg`) && exists(`${folder}/Изображения/Шильдик.jpg`));
  check("свидетельство легло в «Поверку»", exists(`${folder}/Поверка/Свидетельство.pdf`));
  // QR лежит у своего прибора и появляется сам, а не после того, как
  // кто-то вспомнил нажать «выгрузить».
  check("QR-код появился в папке прибора сам", exists(`${folder}/QR-код.png`));
  check("первый снимок стал фотографией карточки",
    String(made.photo_link_path || "").endsWith("Изображения/Общий вид.jpg"), made.photo_link_path);
  check("а второй — нет: перебивать выбранное нельзя",
    !String(made.photo_link_path || "").includes("Шильдик"));
  check("документ поверки тоже привязан",
    String(made.document_link_path || "").endsWith("Поверка/Свидетельство.pdf"), made.document_link_path);

  check("прибор виден в папке классификации",
    await page.isVisible(`#folderList .file-row:has-text("${TEST_NO}")`));

  /* --- 3. Полоса прибора --- */
  await page.click(`#folderList .file-row:has-text("${TEST_NO}")`);
  await sleep(1200);
  const strip = (await page.textContent("#equipmentBanner")).replace(/\s+/g, " ").trim();
  check("в папке прибора видно, что о нём знает «Учёт»",
    /Свободен/.test(strip) && /УЗК/.test(strip) && /SN-777/.test(strip), strip);
  check("и есть переход в карточку", await page.isVisible("#eqOpenCard"));

  /* --- 4. Смена классификации — папка переезжает со всем содержимым --- */
  await db.query("UPDATE instruments SET control_type = 'gdz' WHERE id = $1", [made.id]);
  const report = await equipment.sync();
  const moved = report.moved.find((m) => String(m.id) === String(made.id));
  check("папка переехала в новую классификацию",
    moved && moved.to.includes("Геодезическое оборудование"), JSON.stringify(moved || null));

  const newFolder = "Геодезическое оборудование/ТЕСТ-9001 — Толщиномер ТЕСТ";
  check("вместе с ней переехали изображения",
    exists(`${newFolder}/Изображения/Общий вид.jpg`));
  check("и QR-код переехал вместе с прибором", exists(`${newFolder}/QR-код.png`));
  check("и документ поверки", exists(`${newFolder}/Поверка/Свидетельство.pdf`));
  check("на старом месте папки не осталось", !exists(folder));

  const { rows: after } = await db.query("SELECT folder_path FROM instruments WHERE id = $1", [made.id]);
  check("база знает новый адрес папки",
    after[0].folder_path.includes("Геодезическое"), after[0].folder_path);

  /* --- 5. Списание и восстановление --- */
  await db.query("UPDATE instruments SET status='retired', retired_at=CURRENT_DATE WHERE id = $1", [made.id]);
  await equipment.sync();
  check("списанный прибор уехал в «Списанные»",
    exists(`Списанные/ТЕСТ-9001 — Толщиномер ТЕСТ`) && !exists(newFolder));
  check("фотографии при этом целы",
    exists(`Списанные/ТЕСТ-9001 — Толщиномер ТЕСТ/Изображения/Общий вид.jpg`));

  await db.query("UPDATE instruments SET status='free', retired_at=NULL WHERE id = $1", [made.id]);
  await equipment.sync();
  check("восстановленный вернулся в свою классификацию", exists(newFolder));

  /* --- 6. Переименование прибора --- */
  // Источник правды — карточка. Переименовали прибор — папка идёт следом.
  await db.query("UPDATE instruments SET name = 'Толщиномер ТЕСТ-2' WHERE id = $1", [made.id]);
  await equipment.sync();
  check("переименование прибора переименовывает папку",
    exists("Геодезическое оборудование/ТЕСТ-9001 — Толщиномер ТЕСТ-2") && !exists(newFolder));

  /* --- 6b. Наклейки с QR одним архивом --- */
  await page.goto(U + "/", { waitUntil: "networkidle" });
  await sleep(600);
  await page.click('.col[data-col="db"] .row-item:has-text("Оборудование")');
  await sleep(2000);
  check("кнопка «Наклейки с QR» есть в корне", await page.isVisible("#qrArchiveBtn"));

  const zip = await page.evaluate(async (u) => {
    const res = await fetch(u + "/api/equipment/qr-archive", { credentials: "same-origin" });
    return { ok: res.ok, bytes: [...new Uint8Array(await res.arrayBuffer())] };
  }, U);
  check("архив собрался", zip.ok && zip.bytes.length > 500, String(zip.bytes.length));

  const AdmZip = require("/home/claude/fm/node_modules/adm-zip");
  const names = new AdmZip(Buffer.from(zip.bytes)).getEntries().map((e) => e.entryName);
  check("в архиве по файлу на прибор, названы понятно",
    names.length > 1 && names.every((n) => n.endsWith(".png")) && names.some((n) => /^ТЕСТ-9001 — /.test(n)),
    JSON.stringify(names.slice(0, 3)));
  // Наклейка нужна на рабочий прибор: списанный на неё не клеят.
  const retiredInArchive = names.some((n) => /Списан/.test(n));
  check("списанные в архив не попадают", !retiredInArchive);

  /* --- 7. Дубликат номера --- */
  await page.click("#addInstrumentBtn");
  await sleep(600);
  await page.fill('#instrumentForm [name="inventory_no"]', TEST_NO);
  await page.fill('#instrumentForm [name="name"]', "Дубль");
  await page.click("#instrumentSubmitBtn");
  await sleep(1500);
  check("повтор инвентарного номера отклонён с понятной причиной",
    /уже есть/.test(await page.textContent("#instrumentError")),
    await page.textContent("#instrumentError"));

  await page.click("#instrumentCloseBtn");
  await sleep(300);

  check("нет JS-ошибок за всё время", errors.length === 0, errors.slice(0, 3).join(" | "));

  /* --- уборка --- */
  const { rows: mine } = await db.query("SELECT folder_path FROM instruments WHERE inventory_no LIKE 'ТЕСТ-%'");
  for (const r of mine) {
    if (r.folder_path) fs.rmSync(path.join("/home/claude/test/storage", r.folder_path), { recursive: true, force: true });
  }
  await db.query("DELETE FROM instruments WHERE inventory_no LIKE 'ТЕСТ-%'");

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
