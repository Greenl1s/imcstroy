// Снимки раздела «Оборудование» в ИСУ.
const { chromium } = require("playwright");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const U = "http://localhost:3999";
const OUT = "/home/claude/test/";

(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const p = await b.newPage({ viewport: { width: 1560, height: 880 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));

  await p.goto(U + "/__auth?state=in");
  await p.goto(U + "/__user?id=1&username=kirill&role=admin&tools=1&db=1&cases=1");
  await p.goto(U + "/", { waitUntil: "networkidle" });
  await sleep(700);

  await p.click('.col[data-col="db"] .row-item:has-text("Оборудование")');
  await sleep(2200);
  await p.screenshot({ path: OUT + "q1-корень.png" });

  await p.click('#folderList .file-row:has-text("Геодезическое оборудование")');
  await sleep(1000);
  await p.screenshot({ path: OUT + "q2-классификация.png" });

  await p.click("#folderList .file-row");
  await sleep(1200);
  await p.screenshot({ path: OUT + "q3-прибор.png" });

  await p.click("#addInstrumentBtn");
  await sleep(700);
  await p.fill('#instrumentForm [name="inventory_no"]', "ИМС-0999");
  await p.fill('#instrumentForm [name="name"]', "Толщиномер А1210");
  await p.fill('#instrumentForm [name="serial_number"]', "1210-4471");
  await sleep(300);
  await p.screenshot({ path: OUT + "q4-форма.png" });

  console.log("ошибки:", errs.join(" | ") || "нет");
  await b.close();
})();
