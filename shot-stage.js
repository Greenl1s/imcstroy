// Снимки для утверждения: боковая панель, полоса проекта и список дел
// после переделки стадии в бейдж-кнопку.
const { chromium } = require("playwright");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const U = "http://localhost:3999";
const OUT = "/home/claude/test/";

(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const p = await b.newPage({ viewport: { width: 1560, height: 900 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));

  await p.goto(U + "/__projects?reset=1");
  await p.goto(U + "/__tasksfixture?set=base");
  await p.goto(U + "/__auth?state=in");
  await p.goto(U + "/__user?id=1&username=kirill&role=admin&tools=1&db=1&cases=1&pf=9");
  await p.goto(U + "/", { waitUntil: "networkidle" });
  await sleep(900);

  // 1. Боковая панель: «Главная» вместо «Файлы», «Учёт оборудования»
  //    обычным пунктом, «Ссылок» больше нет.
  await p.locator(".sidebar").screenshot({ path: OUT + "s1-панель.png" });

  // 2. Полоса проекта в папке: бейдж стадии — закрытый.
  await p.click('.col[data-col="cases"] .row-item:has-text("01.Планы")');
  await sleep(1000);
  await p.click('#folderList .file-row:has-text("ЭКС.Гараж (Талдом)")');
  await sleep(1300);
  await p.screenshot({ path: OUT + "s2-папка-закрыт.png" });

  // 3. Тот же бейдж — раскрытый.
  const badge = p.locator("#caseBanner .stage-badge-btn").first();
  if (await badge.count()) {
    await badge.click();
    await sleep(500);
    await p.screenshot({ path: OUT + "s3-папка-меню.png" });
    await p.keyboard.press("Escape");
  } else {
    errs.push("бейдж в полосе проекта не найден");
  }

  // 4. Список дел, стадия «Планы»: во всех строках должно быть «План».
  await p.click('.side-item[data-section="registry"]');
  await sleep(1300);
  await p.click('.reg-tile[data-stage="plan"]');
  await sleep(1000);
  await p.screenshot({ path: OUT + "s4-список.png" });

  // 5. Меню в строке списка.
  const rowBadge = p.locator(".reg-row .stage-badge-btn").first();
  if (await rowBadge.count()) {
    await rowBadge.click();
    await sleep(500);
    await p.screenshot({ path: OUT + "s5-список-меню.png" });
  } else {
    errs.push("бейдж в строке списка не найден");
  }

  // Что реально написано на бейджах — проверяем текстом, а не глазами.
  const labels = await p.$$eval(".reg-row .stage-badge-btn", (n) => n.map((x) => x.textContent.trim()));
  console.log("стадии в строках:", JSON.stringify([...new Set(labels)]));

  console.log("ошибки:", errs.join(" | ") || "нет");
  await b.close();
})();
