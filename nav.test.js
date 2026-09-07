// Новая боковая панель: разделы, всплывающие ссылки, сохранение состояния.
const { chromium } = require("playwright");

const results = [];
function check(name, cond, extra = "") {
  results.push({ name, ok: !!cond });
  console.log((cond ? "PASS " : "FAIL ") + name + (extra ? "  -> " + extra : ""));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const visible = (page, sel) => page.isVisible(sel);

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 800 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  // Набор проверяет имя в панели, поэтому пользователя задаёт сам, а не
  // полагается на то, каким его оставил предыдущий набор.
  await page.goto("http://localhost:3999/__auth?state=in");
  await page.goto("http://localhost:3999/__user?id=1&username=test&role=admin&tools=1&db=1&cases=1");
  await page.goto("http://localhost:3999/", { waitUntil: "networkidle" });
  await page.waitForSelector(".sidebar");
  await sleep(400);

  // --- 1. порядок пунктов панели
  const order = await page.$$eval(".sidebar .side-item span:first-of-type, .sidebar .side-profile-name",
    (els) => els.map((e) => e.textContent.trim()).filter(Boolean));
  check("порядок: профиль, главная, последние, корзина, учёт, список дел, история",
    JSON.stringify(order.slice(0, 7)) ===
      JSON.stringify(["test", "Главная", "Последние", "Корзина", "Учёт оборудования", "Список дел", "История"]),
    JSON.stringify(order));

  // --- 2. колонки "Инструменты" больше нет
  check("колонка «Инструменты» убрана с главного экрана",
    (await page.$$('.col[data-col="tools"]')).length === 0);
  check("на главном экране ровно две колонки",
    (await page.$$("#columnsView .col")).length === 2);

  // --- 3. профиль показывает пользователя
  check("в панели видно имя и роль",
    (await page.textContent("#profileName")).trim() === "test" &&
    (await page.textContent("#profileRole")).trim() === "Администратор");

  // --- 4. «Учёт оборудования» стал обычным пунктом панели
  // Раньше это была строка во всплывающем списке «Ссылки»: чтобы попасть
  // в соседний сервис, надо было открыть список и найти нужную строку.
  check("всплывающего списка ссылок больше нет",
    (await page.$$("#linksPopover")).length === 0 && (await page.$$("#linksBtn")).length === 0);
  check("«Учёт оборудования» — отдельная кнопка в панели",
    (await page.$$("#instrumentsBtn")).length === 1);
  // Переход не нажимаем: он уводит со страницы, а сервиса на этом стенде
  // нет. Проверяем сам адрес — он и есть смысл кнопки.
  // Куда именно ведёт кнопка, проверяем настоящим переходом в отдельной
  // вкладке: подсмотреть адрес в переменной модуля снаружи нельзя, а
  // уходить со страницы посреди набора нельзя тем более.
  const probeCtx = await browser.newContext();
  const probe = await probeCtx.newPage();
  await probe.goto("http://localhost:3999/__auth?state=in");
  await probe.goto("http://localhost:3999/", { waitUntil: "networkidle" });
  await sleep(500);
  await probe.click("#instrumentsBtn");
  await sleep(600);
  check("кнопка ведёт на /instruments/",
    new URL(probe.url()).pathname === "/instruments/", probe.url());
  await probeCtx.close();

  // --- 4b. «Главная» всегда возвращает к колонкам
  // Раньше раздел помнил открытую папку: нажимаешь «Файлы», уже будучи
  // «в файлах», — и ничего не происходит.
  await page.click('.col[data-col="cases"] .row-item:has-text("ЭКС.А40")');
  await sleep(800);
  check("зашли в папку — колонок не видно", !(await visible(page, "#columnsView")));
  await page.click('.side-item[data-section="files"]');
  await sleep(600);
  check("«Главная» вернула к двум колонкам", await visible(page, "#columnsView"));
  check("и адрес стал корневым",
    new URL(page.url()).pathname === "/", page.url());

  // --- 5. переключение разделов
  for (const [section, title] of [["recent", "Последние"], ["trash", "Корзина"], ["history", "История"]]) {
    await page.click(`.side-item[data-section="${section}"]`);
    await sleep(250);
    const shown = await page.textContent(`#${section}Section .folder-title`);
    check(`раздел «${title}» открывается`,
      (await visible(page, `#${section}Section`)) &&
      !(await visible(page, "#filesSection")) &&
      shown.trim() === title);
  }

  // --- 6. адрес в браузере отражает раздел, F5 возвращает туда же
  check("адрес показывает текущий раздел", page.url().includes("section=history"), page.url());
  await page.reload({ waitUntil: "networkidle" });
  await sleep(500);
  check("после перезагрузки остаёмся в «Истории»", await visible(page, "#historySection"));

  // --- 7. «Главная» всегда возвращает в начало
  // Раньше раздел помнил открытую папку, и возврат из «Корзины» приводил
  // обратно в неё. Теперь «Главная» — надёжный способ вернуться к двум
  // колонкам из любого места, и это её единственное поведение.
  await page.click('.side-item[data-section="files"]');
  await sleep(300);
  await page.click('.col[data-col="db"] .row-item:has-text("Оборудование")');
  await page.waitForSelector("#folderView:not(.hidden)");
  await sleep(400);
  await page.click('.side-item[data-section="trash"]');
  await sleep(300);
  await page.click('.side-item[data-section="files"]');
  await sleep(400);
  check("возврат по «Главной» открывает колонки, а не прежнюю папку",
    (await visible(page, "#columnsView")) && !(await visible(page, "#folderView")));

  // --- 8. кнопка "назад" браузера уводит из раздела обратно
  await page.click('.side-item[data-section="history"]');
  await sleep(300);
  await page.goBack();
  await sleep(400);
  check("кнопка «назад» возвращает из раздела в файлы", await visible(page, "#filesSection"));

  // --- 9. виджет диска на месте и заполнен
  // Полоса заполняется масштабом, а не шириной: анимация ширины заставляла
  // браузер пересчитывать раскладку на каждом кадре.
  const fillScale = await page.evaluate(() => document.getElementById("diskUsageFill").style.transform);
  check("полоса места на диске заполнена",
    /^scaleX\(0?\.\d+\)$|^scaleX\(1\)$/.test(fillScale), fillScale);

  check("нет JS-ошибок на странице", errors.length === 0, errors.join(" | "));

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
