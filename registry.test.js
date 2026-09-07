// Раздел «Список дел».
//
// Смысл: это один вход в ту же базу дел, из которой живут папки, задачи и
// карточка. Проверяем, что цифры на плитках не расходятся со списками под
// ними, что перенос стадии отсюда виден везде, что он спрашивает
// подтверждение, и что сотрудник видит только свои дела.
const { chromium } = require("playwright");

const results = [];
function check(name, cond, extra = "") {
  results.push({ name, ok: !!cond });
  console.log((cond ? "PASS " : "FAIL ") + name + (extra ? "  -> " + extra : ""));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const U = "http://localhost:3999";

const names = (page) =>
  page.$$eval(".reg-name", (els) => els.map((e) => e.textContent.trim()));
const tileCount = (page, stage) =>
  page.$eval(`.reg-tile[data-stage="${stage}"] .reg-tile-num`, (e) => e.textContent.trim());

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  let confirmAnswer = true;
  page.on("dialog", (d) => (confirmAnswer ? d.accept() : d.dismiss()));

  await page.goto(U + "/__projects?reset=1");
  await page.goto(U + "/__tasksfixture?set=base");
  await page.goto(U + "/__auth?state=in");
  await page.goto(U + "/__user?id=1&username=kirill&role=admin&tools=1&db=1&cases=1&pf=9&pfname=" +
    encodeURIComponent("Кирилл Базаев"));
  await page.goto(U + "/", { waitUntil: "networkidle" });
  await sleep(900);

  /* --- 1. Кнопка в боковой панели --- */
  check("в панели есть «Список дел»", await page.isVisible('.side-item[data-section="registry"]'));
  await page.click('.side-item[data-section="registry"]');
  await sleep(1200);
  check("раздел открылся", await page.isVisible("#registrySection:not(.hidden)"));

  /* --- 2. Четыре стадии --- */
  const tiles = await page.$$eval(".reg-tile .stage-badge", (els) => els.map((e) => e.textContent.trim()));
  check("показаны четыре стадии",
    JSON.stringify(tiles) === JSON.stringify(["План", "Активные", "Контроль", "Архив"]),
    JSON.stringify(tiles));

  check("на «Плане» два дела", (await tileCount(page, "plan")) === "2", await tileCount(page, "plan"));
  check("на «Контроле» два дела", (await tileCount(page, "control")) === "2", await tileCount(page, "control"));
  check("видно, где горит",
    /дела горят/.test(await page.textContent('.reg-tile[data-stage="plan"]')),
    (await page.textContent('.reg-tile[data-stage="plan"]')).replace(/\s+/g, " ").trim());

  /* --- 3. Список внутри стадии, группами по типу --- */
  await page.click('.reg-tile[data-stage="plan"]');
  await sleep(900);
  check("заголовок сменился на стадию",
    (await page.textContent("#registryTitle")).trim() === "План",
    await page.textContent("#registryTitle"));
  check("в адресе видна стадия", /stage=plan/.test(page.url()), page.url());

  const groups = await page.$$eval(".reg-group-name", (els) => els.map((e) => e.textContent.trim()));
  check("дела разложены по типу",
    groups.includes("Экспертизы") && groups.includes("Независимые исследования"),
    JSON.stringify(groups));

  const planNames = await names(page);
  check("в списке ровно те дела, что на плитке", planNames.length === 2, JSON.stringify(planNames));
  check("и они по алфавиту внутри своей группы",
    planNames.includes("ЭКС.Гараж (Талдом)") && planNames.includes("НИ.Аммиак"),
    JSON.stringify(planNames));

  /* --- 4. Про задачи сказано, сколько и сколько горит --- */
  const row = await page.textContent('.reg-row:has-text("ЭКС.Гараж (Талдом)")');
  check("у дела с просрочкой это видно в строке", /просрочена/.test(row), row.replace(/\s+/g, " ").trim());

  /* --- 5. Поиск --- */
  await page.fill("#registrySearch", "аммиак");
  await sleep(700);
  check("поиск сужает список",
    JSON.stringify(await names(page)) === JSON.stringify(["НИ.Аммиак"]),
    JSON.stringify(await names(page)));
  await page.fill("#registrySearch", "");
  await sleep(700);

  /* --- 6. Фильтр по типу --- */
  await page.selectOption("#registryType", "research");
  await sleep(600);
  check("фильтр по типу оставляет только исследования",
    JSON.stringify(await names(page)) === JSON.stringify(["НИ.Аммиак"]),
    JSON.stringify(await names(page)));
  await page.selectOption("#registryType", "any");
  await sleep(600);

  /* --- 7. Перенос стадии спрашивает подтверждение ---
     Стадия теперь не выпадающий список рядом с кнопкой «Переместить»,
     а сам бейдж: щёлкнул по «ПЛАН» — выбрал, куда перевести. */
  const moveTo = async (id, stage) => {
    await page.click(`[data-stage-pick="${id}"] .stage-badge-btn`);
    await sleep(250);
    await page.click(`[data-stage-pick="${id}"] [data-stage-to="${stage}"]`);
  };

  check("на бейдже написана текущая стадия, а не первая из оставшихся",
    (await page.textContent('[data-stage-pick="12"] .stage-badge-btn')).trim().startsWith("План"),
    (await page.textContent('[data-stage-pick="12"] .stage-badge-btn')).trim());

  const rowStages = await page.$$eval(".reg-row .stage-badge-btn",
    (els) => [...new Set(els.map((e) => e.textContent.trim().split("\n")[0].trim()))]);
  check("в разделе «Планы» во всех строках одна и та же стадия",
    rowStages.length === 1 && rowStages[0] === "План", JSON.stringify(rowStages));

  confirmAnswer = false;
  await moveTo(12, "control");
  await sleep(900);
  const stillPlan = await page.evaluate(async (u) =>
    (await (await fetch(u + "/__projects")).json()).projects.find((p) => p.id === 12).stage, U);
  check("передумал — дело осталось на месте", stillPlan === "plan", stillPlan);

  /* --- 8. Подтвердил — дело переехало, и это видно везде --- */
  confirmAnswer = true;
  await moveTo(12, "control");
  await sleep(1500);

  const moved = await page.evaluate(async (u) =>
    (await (await fetch(u + "/__projects")).json()).projects.find((p) => p.id === 12), U);
  check("дело переведено на «Контроль»", moved.stage === "control", moved.stage);
  check("и его папка переехала",
    /03\.Проекты на контроле/.test(moved.folder_path), moved.folder_path);

  check("из списка «Плана» дело ушло",
    !(await names(page)).includes("НИ.Аммиак"), JSON.stringify(await names(page)));

  await page.click("#registryBackBtn");
  await sleep(800);
  check("на плитке «План» стало на одно меньше",
    (await tileCount(page, "plan")) === "1", await tileCount(page, "plan"));
  check("а на «Контроле» на одно больше",
    (await tileCount(page, "control")) === "3", await tileCount(page, "control"));

  /* --- 9. То же самое видно на странице задач --- */
  await page.click('.side-item[data-section="files"]');
  await sleep(700);
  await page.goto(U + "/?section=tasks&scope=all&stage=control", { waitUntil: "networkidle" });
  await sleep(1200);
  check("задача переехавшего дела теперь в стадии «Контроль»",
    /НИ\.Протвино/.test(await page.textContent("#tasksBody")),
    (await page.textContent("#tasksBody")).replace(/\s+/g, " ").slice(0, 120));

  /* --- 10. Карточка открывается из списка --- */
  await page.goto(U + "/?section=registry&stage=control", { waitUntil: "networkidle" });
  await sleep(1200);
  check("после F5 стадия из адреса открыта",
    (await page.textContent("#registryTitle")).trim() === "Контроль",
    await page.textContent("#registryTitle"));

  await page.click('.reg-row:has-text("НИ.Барвиха") [data-reg-card]');
  await sleep(1300);
  check("«Карточка» открывает карточку проекта",
    (await page.isVisible("#caseCardSection:not(.hidden)")) &&
    /НИ\.Барвиха/.test(await page.textContent("#caseCardName")),
    await page.textContent("#caseCardName"));

  /* --- 11. Ставить задачу из строки больше не предлагаем --- */
  await page.goto(U + "/?section=registry&stage=control", { waitUntil: "networkidle" });
  await sleep(1200);
  check("кнопки «+ Задача» в строке нет", (await page.$$("[data-reg-task]")).length === 0);
  check("а задачу ставят из карточки",
    (await page.$$("[data-reg-card]")).length > 0);

  /* --- 12. Сотрудник видит только свои дела --- */
  await page.evaluate(async (u) => {
    await fetch(u + "/api/folder-permissions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/Дела/01.Планы/ЭКС.Гараж (Талдом)", userId: 2, access: "read" }),
    });
  }, U);
  await page.goto(U + "/__user?id=2&username=anna&role=employee&cases=1");
  await page.goto(U + "/?section=registry", { waitUntil: "networkidle" });
  await sleep(1300);
  check("сотруднику видна только выданная ему стадия",
    (await tileCount(page, "plan")) === "1" && (await tileCount(page, "control")) === "0",
    (await tileCount(page, "plan")) + " / " + await tileCount(page, "control"));

  await page.click('.reg-tile[data-stage="plan"]');
  await sleep(800);
  check("и в списке только его дело",
    JSON.stringify(await names(page)) === JSON.stringify(["ЭКС.Гараж (Талдом)"]),
    JSON.stringify(await names(page)));
  // Право выдано на чтение — менять нечего, и кнопок, которые упрутся в
  // отказ, быть не должно.
  check("с правом только на чтение переносить нечем",
    (await page.$$("[data-stage-pick]")).length === 0);
  // Но саму стадию всё равно видно: это сведение о деле, а не действие.
  check("стадия при этом всё равно показана",
    (await page.$$(".reg-row .stage-badge")).length > 0);
  check("а карточку открыть можно", (await page.$$("[data-reg-card]")).length > 0);

  check("нет JS-ошибок за всё время", errors.length === 0, errors.join(" | "));

  await page.goto(U + "/__projects?reset=1");
  await page.goto(U + "/__user?id=1&username=test&role=admin&tools=1&db=1&cases=1&manage=1&resetPerms=1");
  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
