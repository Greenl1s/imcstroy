// Корзина глазами пользователя: удалил в файловом менеджере — увидел в
// корзине — вернул на место. Фронтенд + настоящий сервер + настоящая база.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = "/home/claude/test/storage";
const results = [];
function check(name, cond, extra = "") {
  results.push({ name, ok: !!cond });
  console.log((cond ? "PASS " : "FAIL ") + name + (extra ? "  -> " + extra : ""));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = (p) => fs.existsSync(path.join(ROOT, p));

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 800 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("dialog", (d) => d.accept());

  await page.goto("http://localhost:3999/", { waitUntil: "networkidle" });
  await page.waitForSelector('.col[data-col="db"] .row-item');
  await sleep(400);

  // --- 1. удаляем файл через контекстное меню
  await page.click('.col[data-col="db"] .row-item:has-text("Отчёты")');
  await page.waitForSelector("#folderView:not(.hidden)");
  await sleep(400);
  await page.locator('#folderList .file-row:has-text("акт.docx")').first().click({ button: "right" });
  await sleep(200);
  await page.click('[data-ctx-action="delete"]');
  await sleep(900);

  check("файл пропал из папки", !exists("База данных/Отчёты/акт.docx"));
  check("файл не стёрт с диска — лежит в корзине",
    fs.existsSync(path.join(ROOT, ".trash")) && fs.readdirSync(path.join(ROOT, ".trash")).length > 0);

  const badge = await page.textContent("#trashCount");
  check("на пункте «Корзина» появился счётчик", badge.trim() === "1", badge);

  // --- 2. смотрим корзину
  await page.click('.side-item[data-section="trash"]');
  await sleep(700);
  const rowText = await page.textContent("#trashList .trash-row");
  check("в корзине видна удалённая запись", rowText.includes("акт.docx"), rowText.trim());
  check("видно, откуда удалили", rowText.includes("База данных › Отчёты"), rowText.trim());
  check("видно, кто удалил", rowText.includes("kirill"), rowText.trim());
  check("видно, сколько осталось", /\d+\s+дн/.test(rowText), rowText.trim());

  // --- 3. восстанавливаем
  await page.hover("#trashList .trash-row");
  await page.click('#trashList .trash-row [data-act="restore"]');
  await sleep(900);
  check("файл вернулся на прежнее место", exists("База данных/Отчёты/акт.docx"));
  check("содержимое файла целое",
    fs.readFileSync(path.join(ROOT, "База данных/Отчёты/акт.docx"), "utf8") === "содержимое акта");

  const emptyText = await page.textContent("#trashList");
  check("корзина показывает, что она пуста", emptyText.includes("Корзина пуста"), emptyText.trim().slice(0, 60));
  check("счётчик у пункта панели пропал",
    await page.evaluate(() => document.getElementById("trashCount").classList.contains("hidden")));

  // --- 4. окончательное удаление
  // «Главная» возвращает к колонкам, а не в прежнюю папку — открываем её заново.
  await page.click('.side-item[data-section="files"]');
  await sleep(400);
  await page.click('.col[data-col="db"] .row-item:has-text("Отчёты")');
  await page.waitForSelector("#folderView:not(.hidden)");
  await sleep(500);
  await sleep(400);
  await page.locator('#folderList .file-row:has-text("акт.docx")').first().click({ button: "right" });
  await sleep(200);
  await page.click('[data-ctx-action="delete"]');
  await sleep(900);
  await page.click('.side-item[data-section="trash"]');
  await sleep(700);
  await page.hover("#trashList .trash-row");
  await page.click('#trashList .trash-row [data-act="purge"]');
  await sleep(900);
  check("после «Удалить навсегда» запись исчезла из корзины",
    (await page.textContent("#trashList")).includes("Корзина пуста"));
  check("и с диска тоже", fs.readdirSync(path.join(ROOT, ".trash")).length === 0);

  // --- 5. очистка целиком
  // «Главная» возвращает к колонкам, а не в прежнюю папку — открываем её заново.
  await page.click('.side-item[data-section="files"]');
  await sleep(400);
  await page.click('.col[data-col="db"] .row-item:has-text("Отчёты")');
  await page.waitForSelector("#folderView:not(.hidden)");
  await sleep(500);
  await sleep(400);
  await page.locator('#folderList .file-row:has-text("отчёт2.docx")').first().click({ button: "right" });
  await sleep(200);
  await page.click('[data-ctx-action="delete"]');
  await sleep(900);
  await page.click('.side-item[data-section="trash"]');
  await sleep(700);
  check("кнопка очистки видна, когда есть что чистить",
    await page.isVisible("#trashEmptyBtn"));
  await page.click("#trashEmptyBtn");
  await sleep(900);
  check("«Очистить корзину» убирает всё",
    (await page.textContent("#trashList")).includes("Корзина пуста") &&
    fs.readdirSync(path.join(ROOT, ".trash")).length === 0);
  check("кнопка очистки прячется на пустой корзине",
    !(await page.isVisible("#trashEmptyBtn")));

  check("нет JS-ошибок на странице", errors.length === 0, errors.join(" | "));

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
