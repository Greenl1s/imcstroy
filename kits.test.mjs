// ============================================================
//  Комплекты приборов — проверки против живого API и настоящей базы,
//  плюс браузерная часть на экране проверки перед выездом.
//
//  Проверяем не «нарисовалось ли», а работает ли механика, о которой
//  договорились:
//    * прибор входит в сколько угодно комплектов;
//    * взятый в одном комплекте, в остальных он показан занятым
//      и в выдачу не попадает;
//    * снятая галочка действует на один выезд, состав не меняет;
//    * «Убрать» меняет состав насовсем — это другое действие;
//    * состояние комплекта нигде не хранится, а считается заново.
//
//  Запуск (сервер, статика и база должны быть подняты):
//    node test/kits.test.mjs
// ============================================================

const pw = await import(process.env.PLAYWRIGHT || '/home/claude/.npm-global/lib/node_modules/playwright/index.js');
const { chromium } = pw.default || pw;

const WEB = process.env.WEB || 'http://localhost:4400/index.html';
const API = process.env.API || 'http://localhost:4200';
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok: !!ok });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  -> ' + extra : ''));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch { /* пусто */ }
  return { status: res.status, data };
}

/* ============================================================
   Подготовка. Приборы берём те, что уже есть (их насыпает ui.test),
   а свои комплекты заводим с уникальными именами и в конце убираем —
   набор должен переживать повторный запуск без ручной чистки базы.
   ============================================================ */

const token = (await api('/api/auth/login', {
  method: 'POST', body: { username: 'admin', password: 'admin12345' },
})).data?.token;
if (!token) throw new Error('не удалось войти администратором — проверьте, что сервер поднят');

const KIT_A = 'ТЕСТ Выезд на трубопровод';
const KIT_B = 'ТЕСТ Приёмка резервуара';

async function dropTestKits() {
  const kits = (await api('/api/kits', { token })).data || [];
  for (const k of kits) {
    if (k.name.startsWith('ТЕСТ ')) await api(`/api/kits/${k.id}`, { method: 'DELETE', token });
  }
}
await dropTestKits();

// Освобождаем всё, что могло остаться на руках от прошлого прогона.
const all = (await api('/api/instruments', { token })).data || [];
const notFree = all.filter((i) => i.status !== 'free').map((i) => i.id);
if (notFree.length) {
  await api('/api/instruments/bulk/return', { method: 'POST', token, body: { ids: notFree } });
  await api('/api/instruments/bulk/cancel-booking', { method: 'POST', token, body: { ids: notFree } });
}

const pool = (await api('/api/instruments', { token })).data.filter((i) => i.status === 'free');
if (pool.length < 5) throw new Error('в базе слишком мало свободных приборов — сначала прогоните ui.test.mjs');
const [i1, i2, i3, i4, i5] = pool.slice(0, 5).map((i) => i.id);

/* ============================================================
   1. Создание и состав
   ============================================================ */

const createA = await api('/api/kits', {
  method: 'POST', token, body: { name: KIT_A, description: 'линейная часть', ids: [i1, i2, i3] },
});
check('комплект создаётся сразу с составом',
  createA.status === 201 && createA.data.total === 3, `${createA.status} / ${createA.data?.total}`);
const kitA = createA.data.id;

const dup = await api('/api/kits', { method: 'POST', token, body: { name: KIT_A.toLowerCase() } });
check('название-близнец не заводится (регистр не спасает)',
  dup.status === 409, `${dup.status} ${dup.data?.error || ''}`);

const noName = await api('/api/kits', { method: 'POST', token, body: { name: '   ' } });
check('комплект без названия не создаётся', noName.status === 400, String(noName.status));

// Ключевое условие из постановки: один прибор — в неограниченном
// количестве комплектов.
const createB = await api('/api/kits', {
  method: 'POST', token, body: { name: KIT_B, ids: [i1, i4, i5] },
});
check('тот же прибор входит и во второй комплект',
  createB.status === 201 && createB.data.items.some((i) => i.id === i1),
  String(createB.status));
const kitB = createB.data.id;

const again = await api(`/api/kits/${kitA}/items`, { method: 'POST', token, body: { ids: [i2] } });
check('повторное добавление того же прибора не плодит дублей',
  again.data.total === 3, String(again.data?.total));

// Считаем только свои комплекты: в базе могли остаться чужие,
// и падать из-за них набор не должен.
const mineOnly = (list) => list.filter((k) => k.name.startsWith('ТЕСТ '));
const fromCard = mineOnly((await api(`/api/instruments/${i1}/kits`, { token })).data);
check('карточка прибора знает оба своих комплекта',
  fromCard.length === 2, fromCard.map((k) => k.name).join(', '));

/* ============================================================
   2. Проверка перед выездом: занятый прибор
   ============================================================ */

let a = (await api(`/api/kits/${kitA}`, { token })).data;
check('пока всё свободно — весь состав можно взять',
  a.items.every((i) => i.takeable), a.items.map((i) => i.takeable).join(','));

// Берём i1 обычной поштучной выдачей — мимо комплектов.
await api(`/api/instruments/${i1}/issue`, { method: 'POST', token, body: { taken_where: 'Ямбург' } });

a = (await api(`/api/kits/${kitA}`, { token })).data;
const blockedA = a.items.find((i) => i.id === i1);
check('занятый прибор помечен как недоступный',
  blockedA && blockedA.takeable === false, String(blockedA?.takeable));
check('и написано, у кого он',
  /Занят/.test(blockedA?.blocked || '') && /admin/.test(blockedA?.blocked || ''), blockedA?.blocked);

const b = (await api(`/api/kits/${kitB}`, { token })).data;
const blockedB = b.items.find((i) => i.id === i1);
check('в другом комплекте тот же прибор тоже занят',
  blockedB && blockedB.takeable === false, blockedB?.blocked);
check('счётчики комплекта пересчитались сами, без хранимого состояния',
  b.busy_count === 1 && b.free_count === 2, `busy=${b.busy_count} free=${b.free_count}`);

/* ============================================================
   3. Выдача: берём доступные, комплект при этом не меняется
   ============================================================ */

const issued = await api(`/api/kits/${kitA}/issue`, {
  method: 'POST', token, body: { ids: [i2, i3], taken_where: 'Резервуарный парк' },
});
check('выдаются ровно отмеченные приборы',
  issued.data.succeeded.length === 2 && issued.data.failed.length === 0,
  `ок=${issued.data?.succeeded?.length} нет=${issued.data?.failed?.length}`);

const afterIssue = (await api(`/api/kits/${kitA}`, { token })).data;
check('снятая галочка НЕ убрала прибор из состава',
  afterIssue.total === 3 && afterIssue.items.some((i) => i.id === i1),
  `в составе ${afterIssue.total}`);

const stranger = await api(`/api/kits/${kitA}/issue`, {
  method: 'POST', token, body: { ids: [i5] },
});
check('через комплект нельзя выдать прибор не из его состава',
  stranger.status === 400, `${stranger.status} ${stranger.data?.error || ''}`);

const takenTwice = await api(`/api/kits/${kitA}/issue`, {
  method: 'POST', token, body: { ids: [i1] },
});
check('повторная выдача занятого прибора отклоняется с причиной',
  takenTwice.data.succeeded.length === 0 && /занят|забронирован/i.test(takenTwice.data.failed[0]?.message || ''),
  takenTwice.data?.failed?.[0]?.message);

const log = (await api(`/api/instruments/${i2}/history`, { token })).data;
check('в журнале обычная выдача с пометкой комплекта',
  log[0]?.action === 'issue' && log[0]?.note?.includes(KIT_A), log[0]?.note);

/* ============================================================
   4. Возврат
   ============================================================ */

const returned = await api(`/api/kits/${kitA}/return`, { method: 'POST', token, body: {} });
check('возврат комплекта вернул все выданные приборы',
  returned.data.succeeded.length === 3, String(returned.data?.succeeded?.length));

const emptyReturn = await api(`/api/kits/${kitA}/return`, { method: 'POST', token, body: {} });
check('повторный возврат честно говорит, что возвращать нечего',
  emptyReturn.status === 409, `${emptyReturn.status} ${emptyReturn.data?.error || ''}`);

/* ============================================================
   5. «Убрать из состава» — это другое действие
   ============================================================ */

const removed = await api(`/api/kits/${kitA}/items/${i1}`, { method: 'DELETE', token });
check('«Убрать» уменьшает состав комплекта',
  removed.data.total === 2, String(removed.data?.total));

const stillThere = (await api(`/api/instruments/${i1}`, { token })).data;
check('но сам прибор никуда не делся',
  stillThere?.id === i1 && stillThere.status === 'free', stillThere?.status);

const stillInB = (await api(`/api/kits/${kitB}`, { token })).data;
check('и из второго комплекта он не пропал',
  stillInB.items.some((i) => i.id === i1), String(stillInB.total));

const removeTwice = await api(`/api/kits/${kitA}/items/${i1}`, { method: 'DELETE', token });
check('убрать то, чего нет, — понятная ошибка, а не 500',
  removeTwice.status === 404, String(removeTwice.status));

/* ============================================================
   6. Удаление комплекта не трогает приборы
   ============================================================ */

const beforeDelete = (await api('/api/instruments', { token })).data.length;
await api(`/api/kits/${kitB}`, { method: 'DELETE', token });
const afterDelete = (await api('/api/instruments', { token })).data.length;
check('удаление комплекта не удаляет приборы',
  beforeDelete === afterDelete, `${beforeDelete} → ${afterDelete}`);
// i1 убрали из kitA (раздел 5), а kitB только что удалили —
// значит своих комплектов у него не осталось ни одного.
check('и карточка прибора это видит',
  mineOnly((await api(`/api/instruments/${i1}/kits`, { token })).data).length === 0);

/* ============================================================
   7. Браузер: экран проверки перед выездом
   ============================================================ */

// Готовим состояние: в комплекте три прибора, один занят.
await api(`/api/kits/${kitA}/items`, { method: 'POST', token, body: { ids: [i1, i4] } });
await api(`/api/instruments/${i4}/issue`, { method: 'POST', token, body: { taken_where: 'Талдом' } });

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const errors = [];
const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
page.on('pageerror', (e) => errors.push(String(e)));
// Ошибки загрузки внешних скриптов (qrcodejs, xlsx, docx с CDN) не считаем:
// в песочнице нет выхода наружу, к комплектам это отношения не имеет.
page.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
});

await page.addInitScript((t) => sessionStorage.setItem('token', t), token);
await page.goto(WEB);
await page.waitForSelector('#appView:not(.hidden)', { timeout: 15000 });

await page.click('#kitsButton');
await page.waitForSelector('.kits-list .kit-row', { timeout: 10000 });
check('кнопка «Комплекты» открывает список',
  (await page.locator('.kit-row').count()) >= 1, String(await page.locator('.kit-row').count()));

const rowA = page.locator(`.kit-row:has(a[data-open-kit="${kitA}"])`);
check('в строке комплекта видно, что часть приборов на руках',
  /на руках/.test(await rowA.innerText()),
  (await rowA.innerText()).replace(/\n/g, ' | '));

await page.click(`.kit-row a[data-open-kit="${kitA}"]`);
await page.waitForSelector('.kit-item', { timeout: 10000 });

const boxes = await page.$$eval('.kit-item input[type=checkbox]',
  (nodes) => nodes.map((n) => ({ checked: n.checked, disabled: n.disabled })));
check('свободные приборы отмечены заранее',
  boxes.filter((b) => b.checked).length === 3, JSON.stringify(boxes));
check('занятый — не отмечен и галочку поставить нельзя',
  boxes.some((b) => !b.checked && b.disabled), JSON.stringify(boxes));

check('у занятого прибора написана причина',
  /Занят/.test(await page.locator('.kit-item.is-off').first().innerText()),
  (await page.locator('.kit-item.is-off').first().innerText()).replace(/\n/g, ' | '));

check('сводка сверху говорит, сколько можно взять',
  /3 можно взять/.test(await page.locator('.kit-summary').innerText()),
  await page.locator('.kit-summary').innerText());

check('кнопка «Взять» показывает число',
  /Взять 3/.test(await page.locator('[data-kit-issue]').innerText()),
  await page.locator('[data-kit-issue]').innerText());

// Снимаем галочку — это и есть «пропустить прибор на один выезд».
await page.locator('.kit-item:not(.is-off) input[type=checkbox]').first().uncheck();
check('снятая галочка сразу меняет число на кнопке',
  /Взять 2/.test(await page.locator('[data-kit-issue]').innerText()),
  await page.locator('[data-kit-issue]').innerText());

await page.fill('#kitWhere', 'Резервуарный парк, Ямбург');
await page.click('[data-kit-issue]');
await page.waitForTimeout(1800);

const afterUi = (await api(`/api/kits/${kitA}`, { token })).data;
check('через браузер выдались ровно отмеченные приборы',
  afterUi.busy_count === 3, `занято ${afterUi.busy_count} из ${afterUi.total}`);
check('состав комплекта от снятой галочки не изменился',
  afterUi.total === 4, String(afterUi.total));

const place = (await api('/api/instruments', { token })).data
  .find((i) => i.status === 'busy' && i.taken_where === 'Резервуарный парк, Ямбург');
check('место использования доехало до базы', !!place, place?.name);

/* --- телефон --- */
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
});
await mobile.addInitScript((t) => sessionStorage.setItem('token', t), token);
const mp = await mobile.newPage();
mp.on('pageerror', (e) => errors.push(String(e)));
await mp.goto(`${WEB}?kit=${kitA}`);
await mp.waitForSelector('.kit-item', { timeout: 15000 });

const noOverflow = await mp.evaluate(() =>
  document.documentElement.scrollWidth <= window.innerWidth + 1);
check('на телефоне экран не уезжает вбок', noOverflow,
  String(await mp.evaluate(() => document.documentElement.scrollWidth)));

const cbSize = await mp.evaluate(() => {
  const n = document.querySelector('.kit-item input[type=checkbox]');
  return n ? Math.round(n.getBoundingClientRect().width) : 0;
});
check('галочка на телефоне достаточно крупная для пальца', cbSize >= 20, cbSize + 'px');

const takeBtnWidth = await mp.evaluate(() => {
  const b = document.querySelector('[data-kit-issue]');
  return b ? Math.round(b.getBoundingClientRect().width) : 0;
});
check('кнопка «Взять» на телефоне крупная', takeBtnWidth > 120, takeBtnWidth + 'px');

await mobile.close();

/* --- уборка --- */
const mine = (await api('/api/instruments', { token })).data
  .filter((i) => i.status !== 'free').map((i) => i.id);
if (mine.length) await api('/api/instruments/bulk/return', { method: 'POST', token, body: { ids: mine } });
await dropTestKits();

check('за всё время ни одной ошибки JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
