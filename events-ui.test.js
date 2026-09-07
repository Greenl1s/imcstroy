// Разделы "Последние" и "История" глазами пользователя.
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

async function dropFile(page, selector, name, content) {
  await page.locator(selector).first().evaluate((el, f) => {
    const dt = new DataTransfer();
    dt.items.add(new File([f.content], f.name, { type: "text/plain" }));
    for (const type of ["dragenter", "dragover", "drop"]) {
      el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
    }
  }, { name, content });
  await sleep(900);
}

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 800 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("dialog", (d) => d.accept());

  await page.goto("http://localhost:3999/", { waitUntil: "networkidle" });
  await page.waitForSelector('.col[data-col="db"] .row-item');
  await sleep(400);

  // --- готовим события: загрузка в "Дела" и в "Базу данных", потом удаление
  await page.click('.col[data-col="cases"] .row-item:has-text("ЭКС.А40")');
  await page.waitForSelector("#folderView:not(.hidden)");
  await sleep(400);
  await dropFile(page, "#folderView", "Заключение эксперта.docx", "текст заключения");

  await page.click('.side-item[data-section="files"]');
  await sleep(200);
  for (let i = 0; i < 4; i++) {
    if (await page.isVisible("#columnsView:not(.hidden)")) break;
    await page.click("#backBtn");
    await sleep(350);
  }
  await page.click('.col[data-col="db"] .row-item:has-text("Отчёты")');
  await page.waitForSelector("#folderView:not(.hidden)");
  await sleep(400);
  await dropFile(page, "#folderView", "Смета.xlsx", "цифры");

  // --- 1. Последние
  await page.click('.side-item[data-section="recent"]');
  await sleep(900);
  const recentRows = await page.$$eval("#recentList .file-row", (rows) => rows.map((r) => r.textContent.trim()));
  check("оба загруженных файла попали в «Последние»",
    recentRows.some((t) => t.includes("Заключение эксперта.docx")) &&
    recentRows.some((t) => t.includes("Смета.xlsx")), JSON.stringify(recentRows));
  check("видно папку, куда файл лёг",
    recentRows.some((t) => t.includes("Дела › ЭКС.А40")), JSON.stringify(recentRows));
  check("видно, кто добавил", recentRows.every((t) => t.includes("kirill")), JSON.stringify(recentRows));
  check("есть подпись дня", (await page.textContent("#recentList .day-label")).trim() === "Сегодня");

  // --- 2. фильтр по разделу
  await page.click('#recentFilter .seg-btn[data-column="cases"]');
  await sleep(700);
  const casesOnly = await page.$$eval("#recentList .file-row", (rows) => rows.map((r) => r.textContent.trim()));
  check("фильтр «Дела» оставляет только дела",
    casesOnly.length === 1 && casesOnly[0].includes("Заключение эксперта.docx"), JSON.stringify(casesOnly));
  await page.click('#recentFilter .seg-btn[data-column=""]');
  await sleep(600);

  // --- 3. История
  await page.click('.side-item[data-section="history"]');
  await sleep(900);
  const evText = await page.textContent("#historyList");
  check("в истории видны обе загрузки",
    (evText.match(/загрузил/g) || []).length >= 2, evText.trim().slice(0, 160));
  check("в событии указан автор", evText.includes("kirill"));
  check("в событии указана папка", evText.includes("Дела › ЭКС.А40"));

  // --- 4. удаление и восстановление тоже попадают в ленту
  // «Главная» возвращает к колонкам, а не в прежнюю папку — открываем её заново.
  await page.click('.side-item[data-section="files"]');
  await sleep(400);
  await page.click('.col[data-col="db"] .row-item:has-text("Отчёты")');
  await page.waitForSelector("#folderView:not(.hidden)");
  await sleep(500);
  await page.locator('#folderList .file-row:has-text("Смета.xlsx")').first().click({ button: "right" });
  await sleep(200);
  await page.click('[data-ctx-action="delete"]');
  await sleep(900);
  await page.click('.side-item[data-section="history"]');
  await sleep(900);
  const afterDelete = await page.textContent("#historyList");
  check("удаление записалось в историю", afterDelete.includes("удалил"), afterDelete.trim().slice(0, 120));

  await page.click('.side-item[data-section="trash"]');
  await sleep(800);
  await page.hover("#trashList .trash-row");
  await page.click('#trashList .trash-row [data-act="restore"]');
  await sleep(900);
  await page.click('.side-item[data-section="history"]');
  await sleep(900);
  check("восстановление записалось в историю",
    (await page.textContent("#historyList")).includes("восстановил"));

  // --- 5. фильтр по действию
  await page.selectOption("#historyAction", "delete");
  await sleep(800);
  const onlyDelete = await page.$$eval("#historyList .ev", (rows) => rows.map((r) => r.textContent.trim()));
  check("фильтр по действию оставляет только его",
    onlyDelete.length > 0 && onlyDelete.every((t) => t.includes("удалил")), JSON.stringify(onlyDelete));

  const actorOptions = await page.$$eval("#historyActor option", (o) => o.map((x) => x.textContent.trim()));
  check("в фильтре сотрудников появился автор событий",
    actorOptions.includes("kirill"), JSON.stringify(actorOptions));

  await page.selectOption("#historyAction", "");
  await sleep(700);

  // --- 6. восстановленный файл снова в "Последних"
  await page.click('.side-item[data-section="recent"]');
  await sleep(800);
  check("восстановленный файл вернулся в «Последние»",
    (await page.textContent("#recentList")).includes("Смета.xlsx"));

  check("нет JS-ошибок на странице", errors.length === 0, errors.join(" | "));

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
