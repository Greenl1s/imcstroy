// ============================================================
//  Новый экран «Учёт оборудования» — проверки в настоящем браузере
//  против живого API и настоящей базы.
//
//  Проверяем не «нарисовалось ли», а работает ли: фильтры стоят над
//  своими колонками (замером, а не на глаз), кнопка в строке реально
//  меняет состояние прибора в базе, сводка фильтрует, поиск честно
//  объясняет пустоту.
//
//  Запуск (сервер, статика и база должны быть подняты):
//    node test/ui.test.mjs
// ============================================================

// playwright лежит в общей папке песочницы, а не рядом с проектом:
// путь берётся из PLAYWRIGHT (по умолчанию — там, где он установлен).
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
   Данные для проверки заводим сами: тест не должен зависеть от того,
   что кто-то раньше насыпал в базу. Если приборы уже есть — ничего
   не делаем.
   ============================================================ */

const day = (n) => new Date(Date.now() + (n + 0) * 86400000 + 3 * 3600000).toISOString().slice(0, 10);

async function seed() {
  const token = (await api('/api/auth/login', {
    method: 'POST', body: { username: 'admin', password: 'admin12345' },
  })).data?.token;
  if (!token) throw new Error('не удалось войти администратором — проверьте, что сервер поднят');

  const have = (await api('/api/instruments', { token })).data || [];
  const needCreate = have.length < 15;

  for (const [code, name] of [['nic', 'АО «НИЦ Строительство»'], ['ano', 'АНО НТЦиНИ'], ['rea', 'РЭА']]) {
    await api('/api/companies', { method: 'POST', token, body: { code, name } });
  }
  for (const u of ['petrov', 'sidorov']) {
    await api('/api/users', { method: 'POST', token,
      body: { username: u, password: 'test123456', role: 'employee' } });
  }

  // Сроки поверок заданы относительно сегодня: набор про «просрочено»
  // и «истекает через пять дней» протух бы через сутки, будь тут числа.
  const items = [
    ['ИМС-0009', 'Мегаомметр Е6-24', 'Е6-24', '24-00871', 'elk', 'nic', day(25)],
    ['ИМС-0056', 'Измеритель прочности ИПС-МГ4.03', 'ИПС-МГ4.03', 'МГ4-7781', 'kbt', 'nic', day(215)],
    ['ИМС-0077', 'Нивелир оптический RGK C-32', 'C-32', 'C32-8890', 'gdz', null, day(275)],
    ['ИМС-0087', 'Нивелир Sokkia B40A', 'B40A', 'B40-99213', 'gdz', 'nic', day(45)],
    ['ИМС-0118', 'Лазерный дальномер Leica DISTO X4', 'DISTO X4', 'X4-55120', 'vik', null, day(265)],
    ['ИМС-0142', 'Тахеометр Leica TS16', 'TS16-P 3"', '1834271', 'vik', 'nic', day(65)],
    ['ИМС-0166', 'Анемометр Testo 416', '416', '416-2290', 'ak', 'rea', day(175)],
    ['ИМС-0195', 'Тепловизор Testo 875-1i', '875-1i', '8751-4471', 'tk', 'ano', day(165)],
    ['ИМС-0231', 'Дефектоскоп УД2В-П46', 'УД2В-П46', '46-1120', 'uzk', 'nic', day(-12)],
    ['ИМС-0274', 'Влагомер древесины ВИМС-2.11', 'ВИМС-2.11', '2-11-0092', 'kbt', 'ano', day(5)],
    ['ИМС-0303', 'Толщиномер УТ-911', 'УТ-911', '911-3345', 'uzk', 'rea', day(85)],
    ['ИМС-0388', 'Прибор ПОС-50МГ4', 'ПОС-50МГ4', '50-4412', 'kbt', 'nic', day(245)],
    ['ИМС-0421', 'Электронный теодолит 4Т30П', '4Т30П', '30П-1177', 'gdz', 'nic', day(-60)],
    ['ИМС-0500', 'Рентгенаппарат РПД-200', 'РПД-200', '200-0031', 'rgk', 'nic', day(105)],
    ['ИМС-0611', 'Толщиномер УТ-911 (второй)', 'УТ-911', '911-3346', 'uzk', null, day(285)],
  ];
  for (const [inventory_no, name, model, serial_number, control_type, company_code, valid_until] of items) {
    if (!needCreate) break;
    await api('/api/instruments', { method: 'POST', token, body: {
      inventory_no, name, model, serial_number, control_type, company_code,
      valid_until, verification_date: day(-400), check_type: 'verification', comment: '',
    } });
  }

  const list = (await api('/api/instruments', { token })).data;
  const idOf = (no) => list.find((i) => i.inventory_no === no)?.id;

  // Просроченный прибор нужен сразу нескольким проверкам, а одна из них
  // (окно со сроками после нового документа) даты как раз и меняет —
  // на то она и проверка. Возвращаем их на место при каждом запуске,
  // иначе второй прогон падал бы на первом.
  await api(`/api/instruments/${idOf('ИМС-0231')}`, { method: 'PATCH', token,
    body: { verification_date: day(-400), valid_until: day(-12) } });

  // Состояния выставляем при каждом запуске, а не только при первом:
  // предыдущий прогон мог вернуть приборы, и тогда «на руках» стало бы
  // ноль, а проверка упала бы на пустом месте.
  const busyOrBooked = list.filter((i) => i.status !== 'free').map((i) => i.id);
  if (busyOrBooked.length) {
    await api('/api/instruments/bulk/return', { method: 'POST', token, body: { ids: busyOrBooked } });
    await api('/api/instruments/bulk/cancel-booking', { method: 'POST', token, body: { ids: busyOrBooked } });
  }
  // Выдаём и бронируем администраторским токеном: у входа стоит защита
  // от перебора, и лишние входы за сотрудников упираются в неё раньше,
  // чем в проверяемое поведение. Кто именно держит прибор, для этих
  // проверок неважно — важно, что держит и что это видно.
  await api(`/api/instruments/${idOf('ИМС-0142')}/issue`, { method: 'POST', token,
    body: { taken_where: 'Объект «Сколково», корп. 4' } });
  await api(`/api/instruments/${idOf('ИМС-0231')}/issue`, { method: 'POST', token,
    body: { taken_where: 'Лаборатория, Вешних Вод' } });
  await api(`/api/instruments/${idOf('ИМС-0166')}/issue`, { method: 'POST', token,
    body: { taken_where: 'Объект «Барвиха»' } });
  await api(`/api/instruments/${idOf('ИМС-0303')}/book`, { method: 'POST', token,
    body: { booked_for: day(2), booked_where: 'Талдом' } });
  await api(`/api/instruments/${idOf('ИМС-0500')}/book`, { method: 'POST', token,
    body: { booked_for: day(5), booked_where: 'Калуга' } });
  return token;
}

const seedToken = await seed();

const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  // Внешние библиотеки (QR, Excel) лежат на CDN, в песочнице он недоступен —
  // это не ошибка приложения.
  const t = m.text();
  if (m.type() === 'error' && !/TUNNEL|favicon|401/.test(t)) errors.push('console: ' + t.slice(0, 160));
});
page.on('dialog', (d) => d.accept());

/* --- вход --- */
await page.goto(WEB, { waitUntil: 'networkidle' });
await page.fill('#loginUsername', 'admin');
await page.fill('#loginPassword', 'admin12345');
await page.click('#loginForm button[type=submit]');
await page.waitForSelector('.list .row', { timeout: 15000 });
await sleep(600);

const rows = () => page.locator('.list .row');
const names = async () => rows().locator('.row-title').allInnerTexts();

check('список приборов открывается', (await rows().count()) > 0, String(await rows().count()));

/* ============================================================
   1. Фильтр стоит ровно над своей колонкой.
      Это главное требование к экрану — проверяем замером.
   ============================================================ */

const align = await page.evaluate(() => {
  const fils = [...document.querySelectorAll('.filters-row .filter-chip')];
  const cols = [...document.querySelectorAll('.list .row:first-child .row-col')];
  return fils.map((f, i) => {
    const a = f.getBoundingClientRect();
    const b = cols[i]?.getBoundingClientRect();
    return b ? Math.round((a.left + a.width / 2) - (b.left + b.width / 2)) : 999;
  });
});
check('все четыре фильтра стоят точно над своими колонками',
  align.length === 4 && align.every((d) => Math.abs(d) <= 1), JSON.stringify(align));

/* ============================================================
   2. Сортировка.
   ============================================================ */

const invNos = async () => rows().locator('.row-title i').allInnerTexts();
const firstInv = (await invNos())[0];
check('по умолчанию список отсортирован по инвентарному номеру',
  firstInv === 'ИМС-0009', firstInv);

await page.click('.filter-chip-label[data-sort="valid_until"]');
await sleep(400);
const byVerification = await invNos();
check('щелчок по подписи «Поверка» сортирует по сроку: сверху самый ранний',
  byVerification[0] === 'ИМС-0421', byVerification.slice(0, 3).join(', '));

await page.click('.filter-chip-label[data-sort="valid_until"]');
await sleep(400);
const reversed = await invNos();
check('повторный щелчок переворачивает порядок',
  reversed[0] !== byVerification[0], `${byVerification[0]} → ${reversed[0]}`);

await page.click('.filter-chip-label[data-sort="inventory_no"]').catch(() => {});
await page.selectOption('#conditionFilter', 'all');

/* ============================================================
   3. Сводка — это фильтры.
   ============================================================ */

const summaryText = await page.locator('.summary').innerText();
check('в сводке посчитаны состояния и поверки',
  /\d+\s+всего/.test(summaryText) && /поверка истекла/.test(summaryText),
  summaryText.replace(/\s+/g, ' ').slice(0, 120));

await page.click('[data-summary="expired"]');
await sleep(500);
const expiredNames = await names();
check('«поверка истекла» оставляет в списке только просроченные',
  expiredNames.length === 2, `${expiredNames.length}: ${expiredNames.join(' | ')}`);
check('и все они действительно просрочены',
  (await page.locator('.list .row .col-rest.t-bad').count()) === 2);

await page.click('[data-summary="busy"]');
await sleep(500);
check('«на руках» оставляет только занятые',
  (await rows().count()) === 3, String(await rows().count()));

await page.click('[data-summary="all"]');
await sleep(500);
const totalInList = await rows().count();
check('«всего» возвращает весь список', totalInList >= 15, String(totalInList));

/* ============================================================
   4. Колонка поверки: дата, остаток и два разных «пусто».
   ============================================================ */

const adminToken = (await api('/api/auth/login', {
  method: 'POST', body: { username: 'admin', password: 'admin12345' },
})).data.token;

// Прибор, которому поверка не нужна, и прибор с незаполненным сроком.
await api('/api/instruments', { method: 'POST', token: adminToken,
  body: { name: 'Штангенциркуль без поверки', inventory_no: 'ИМС-9001', check_type: 'none' } });
await api('/api/instruments', { method: 'POST', token: adminToken,
  body: { name: 'Прибор без срока', inventory_no: 'ИМС-9002', check_type: 'verification' } });

await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.list .row');
await sleep(700);

const noneRow = page.locator('.list .row', { hasText: 'Штангенциркуль без поверки' });
const unsetRow = page.locator('.list .row', { hasText: 'Прибор без срока' });
check('у прибора без метрологического контроля написано «не требуется»',
  (await noneRow.locator('.col-empty').innerText()) === 'не требуется',
  await noneRow.locator('.col-empty').innerText());
check('а у прибора с пустой датой — «срок не заполнен», и это видно отдельно',
  (await unsetRow.locator('.col-empty.is-unset').innerText()) === 'срок не заполнен',
  await unsetRow.locator('.col-empty').innerText());

await page.selectOption('#verificationFilter', 'unset');
await sleep(500);
const unsetCount = await rows().count();
const unsetMarks = await page.locator('.list .row .col-empty.is-unset').count();
check('фильтр «Срок не заполнен» оставляет только приборы без даты',
  unsetCount > 0 && unsetCount === unsetMarks, `${unsetCount} строк, ${unsetMarks} с пометкой`);
check('и заведённый нами прибор без срока среди них',
  (await names()).some((n) => n.includes('Прибор без срока')));

await page.selectOption('#verificationFilter', 'soon');
await sleep(500);
check('фильтр «Истекает ≤ 30 дней» находит два прибора',
  (await rows().count()) === 2, String(await rows().count()));

await page.selectOption('#verificationFilter', 'all');
await sleep(400);

/* ============================================================
   5. Кнопка в строке действительно меняет состояние прибора.
   ============================================================ */

const free = page.locator('.list .row', { hasText: 'Нивелир Sokkia B40A' });
check('у свободного прибора в строке кнопка «Взять»',
  (await free.locator('.row-act button').innerText()) === 'Взять');

await free.locator('[data-row-act="issue"]').click();
await page.waitForSelector('#modal[open]', { timeout: 5000 });
check('«Взять» открывает форму, а не берёт молча',
  await page.locator('#modal').isVisible());
check('и в форме спрашивают место использования',
  (await page.locator('#modal').innerText()).includes('Место использования'),
  (await page.locator('#modal').innerText()).replace(/\s+/g, ' ').slice(0, 90));

await page.fill('#modal input[name="taken_where"]', 'Объект «Проверка»');
await page.click('#modal button[type=submit]');
await sleep(1600);

const takenState = await api('/api/instruments', { token: adminToken });
const sokkia = takenState.data.find((i) => i.inventory_no === 'ИМС-0087');
check('после формы прибор действительно занят в базе',
  sokkia.status === 'busy' && sokkia.taken_where === 'Объект «Проверка»',
  `${sokkia.status} / ${sokkia.taken_where}`);
check('и дата выдачи проставлена сегодняшняя',
  sokkia.taken_at === new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10),
  String(sokkia.taken_at));

const busyRow = page.locator('.list .row', { hasText: 'Нивелир Sokkia B40A' });
check('в списке у него теперь кнопка «Вернуть»',
  (await busyRow.locator('.row-act button').innerText()) === 'Вернуть');
check('и видно, кто держит прибор',
  (await busyRow.locator('.col-who').innerText()).length > 0,
  await busyRow.locator('.col-who').innerText());

await busyRow.locator('[data-row-act="return"]').click();
await sleep(1600);
const afterReturn = (await api('/api/instruments', { token: adminToken }))
  .data.find((i) => i.inventory_no === 'ИМС-0087');
check('«Вернуть» из строки возвращает прибор', afterReturn.status === 'free', afterReturn.status);

/* ============================================================
   6. Режим «Выбрать» и панель массовых действий.
   ============================================================ */

check('панель массовых действий спрятана, пока не включён режим',
  await page.locator('#massPanel').isHidden());

await page.click('#massToggleBtn');
await sleep(500);
check('в режиме «Выбрать» панель появляется', await page.locator('#massPanel').isVisible());
check('и сначала честно пишет, что ничего не выбрано',
  (await page.locator('#massCount').innerText()) === 'Ничего не выбрано');

await page.locator('.list .row .instrument-checkbox').nth(0).check();
await page.locator('.list .row .instrument-checkbox').nth(1).check();
await sleep(300);
check('счётчик показывает, сколько приборов выбрано',
  (await page.locator('#massCount').innerText()) === 'Выбрано 2',
  await page.locator('#massCount').innerText());
check('опасные действия в панели отделены от обычных',
  (await page.locator('#massPanel .mass-danger').count()) === 2);

await page.click('#massCancelBtn');
await sleep(400);
check('«Отменить выбор» выключает режим', await page.locator('#massPanel').isHidden());

/* ============================================================
   7. Пустой результат объясняет, что произошло.
   ============================================================ */

await page.fill('#searchInput', 'тахеометр trimble');
await sleep(600);
const empty = await page.locator('.empty-state').innerText();
check('при пустом результате видно, что искали',
  empty.includes('тахеометр trimble'), empty.replace(/\s+/g, ' ').slice(0, 120));
check('и сколько всего приборов в базе', /Всего в базе \d+/.test(empty));

await page.click('[data-empty-reset]');
await sleep(600);
check('«Сбросить поиск и фильтры» возвращает весь список',
  (await rows().count()) === totalInList + 2, String(await rows().count()));
check('и поле поиска очищено', (await page.inputValue('#searchInput')) === '');

/* ============================================================
   8. Карточка прибора.
   ============================================================ */

// Файловый менеджер на стенде живёт в /tmp/fmdata — кладём туда файл
// напрямую: привязка документа проверяет, что файл существует.
const fsp = (await import('node:fs/promises'));
const mkdirIn = (dir) => fsp.mkdir(dir, { recursive: true });
const writeIn = (file, text) => fsp.writeFile(file, text);

const expiredId = ((await api('/api/instruments', { token: adminToken })).data || [])
  .find((i) => i.inventory_no === 'ИМС-0231')?.id;
// Документ мог остаться от прошлого прогона — начинаем с чистого
// состояния, иначе проверка «без документа» зависела бы от порядка.
await api(`/api/instruments/${expiredId}/document`, { method: 'DELETE', token: adminToken });

await page.click('.list .row:has-text("Дефектоскоп УД2В-П46") [data-open-id]');
await page.waitForSelector('.card-screen', { timeout: 8000 });
await sleep(800);

const card = await page.locator('.card-screen').innerText();
check('в карточке сразу видно состояние прибора',
  /На руках у/.test(card), card.split('\n').slice(0, 6).join(' | '));
// Дату не вписываем числом: срок у прибора задаётся относительно
// сегодняшнего дня, и жёстко записанное «26.08.2026» ломалось на
// следующие сутки — падал не код, а календарь.
const expiredDate = day(-12).split('-').reverse().join('.');
check('поверка показана датой и остатком, а не «есть/нет»',
  card.includes(expiredDate) && /просрочено на/i.test(card),
  (card.match(/.*[Пп]росрочено.*/) || [''])[0]);
check('просроченная поверка выделена цветом',
  await page.locator('.card-verif.v-bad').isVisible());
check('есть блок «Где прибор сейчас» с местом использования',
  /где прибор сейчас/i.test(card) && /Лаборатория/.test(card),
  (card.match(/.*ПРИБОР СЕЙЧАС.*/i) || [''])[0]);
check('незаполненные поля собраны в одну строку',
  /Не заполнено:/.test(card), (card.match(/Не заполнено:.*/) || [''])[0]);
check('прочерков в характеристиках нет',
  !/^—$/m.test(card));
// Документа у этого прибора нет — полоса поверки остаётся обычным
// блоком. Делать её похожей на кнопку, когда открывать нечего, значит
// обещать то, чего не будет.
check('без документа полоса поверки не нажимается',
  (await page.locator('.card-verif').evaluate((e) => e.tagName)) === 'DIV' &&
  /не приложен/.test(await page.locator('.card-verif').innerText()),
  (await page.locator('.card-verif').innerText()).replace(/\n/g, ' | '));

// А с документом вся полоса — кнопка: отдельная кнопка в её углу делила
// надвое то, что для человека и так одно целое.
{
  const fmFile = '/База данных/Оборудование/Свидетельство-проверка.pdf';
  await mkdirIn('/tmp/fmdata/База данных/Оборудование');
  await writeIn(`/tmp/fmdata${fmFile}`, '%PDF-1.4');
  const linked = await api(`/api/instruments/${expiredId}/document/link`, {
    method: 'PUT', token: adminToken, body: { path: fmFile },
  });
  check('документ привязан к прибору', linked.status === 200, String(linked.status));

  await page.reload();
  await page.waitForSelector('.card-verif', { timeout: 10000 });
  await sleep(700);
  check('с документом вся полоса поверки становится кнопкой',
    (await page.locator('.card-verif').evaluate((e) => e.tagName)) === 'BUTTON');
  check('и на ней написано, что она делает',
    await page.locator('.card-verif-go:has-text("Открыть")').isVisible());
  check('отдельной кнопки «Открыть поверку» больше нет',
    (await page.locator('.card-verif button').count()) === 0);
}

// Кнопки под карточкой должны быть заметны: раньше это были одинаковые
// серые прямоугольники, и «Редактировать» терялось между ними.
check('под карточкой три заметных действия со значками',
  (await page.locator('.card-act').count()) === 3 &&
  (await page.locator('.card-act svg').count()) === 3,
  (await page.locator('.card-minor').innerText()).replace(/\n/g, ' | '));
check('главное из них — «Редактировать» — выделено',
  await page.locator('.card-act-main:has-text("Редактировать")').isVisible());
check('«К списку» отсюда убрана — она теперь в шапке',
  (await page.locator('.card-minor [data-back]').count()) === 0);

check('«Списать» и «Удалить» отделены в свою рамку',
  (await page.locator('.card-danger button').count()) === 2);
check('и рядом сказано, что отменить их нельзя',
  /отменить нельзя/.test(await page.locator('.card-danger').innerText()));

// Выход из карточки — рядом с выходом в ИСУ, а не в хвосте списка
// действий над прибором.
check('«К списку» появилась в шапке', await page.locator('#backToListButton').isVisible());
await page.click('#backToListButton');
await sleep(700);
check('и возвращает на список', (await rows().count()) > 0);
check('на списке её уже нет', !(await page.locator('#backToListButton').isVisible()));

/* ============================================================
   8б. Приложили новый документ поверки — сразу спрашиваем сроки.

   Сроки написаны на самом свидетельстве. Раньше их надо было помнить
   и вписывать в форме до того, как документ приложен; теперь документ
   показывается, а под ним стоят обе даты.
   ============================================================ */

// Раскладку файлов по папкам делает ИСУ, а его на этом стенде рядом нет.
// Подменяем только его ответы: проверяем окно со сроками, а не загрузку.
await page.route('**/api/equipment/**', (route) => route.fulfill({
  status: 200, contentType: 'application/json',
  body: JSON.stringify({ path: '/База данных/Оборудование' }),
}));
await page.route('**/api/upload', (route) => route.fulfill({
  status: 200, contentType: 'application/json', body: '{"ok":true}',
}));

/** Прикладывает файл к полю документа: setInputFiles в песочнице молчит. */
const attachDocument = async (name) => {
  await page.click('[data-edit]');
  await page.waitForSelector('#instrumentForm');
  await page.evaluate((fileName) => {
    const dt = new DataTransfer();
    dt.items.add(new File(['%PDF-1.4'], fileName, { type: 'application/pdf' }));
    const input = document.querySelector('[data-document-input]');
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, name);
  await page.click('#instrumentForm button[type="submit"]');
};

{
  const before = (await api(`/api/instruments/${expiredId}`, { token: adminToken })).data;

  await page.click('.list .row:has-text("Дефектоскоп УД2В-П46") [data-open-id]');
  await page.waitForSelector('.card-verif', { timeout: 10000 });

  await attachDocument('Свидетельство-2026.pdf');
  let opened = true;
  await page.waitForSelector('#verificationDatesForm', { timeout: 15000 }).catch(() => { opened = false; });
  check('после нового документа открывается окно со сроками', opened);

  check('в заголовке сказано, о чём речь',
    /Новая поверка/.test(await page.locator('.modal-head h1').innerText()),
    (await page.locator('.modal-head h1').innerText()));
  // Документ — PDF, картинкой его не показать, поэтому даём открыть рядом.
  check('документ можно открыть прямо отсюда',
    await page.locator('[data-open-doc]').isVisible());
  check('даты подставлены те, что сейчас у прибора',
    (await page.locator('[name="verification_date"]').inputValue()) === (before.verification_date || '') &&
    (await page.locator('[name="valid_until"]').inputValue()) === (before.valid_until || ''),
    `${await page.locator('[name="verification_date"]').inputValue()} → ${await page.locator('[name="valid_until"]').inputValue()}`);

  // Ничего не трогаем — даты должны остаться прежними.
  await page.click('[data-keep-dates]');
  await sleep(1200);
  const kept = (await api(`/api/instruments/${expiredId}`, { token: adminToken })).data;
  check('«Оставить как было» не меняет сроки',
    kept.verification_date === before.verification_date && kept.valid_until === before.valid_until,
    `${kept.verification_date} → ${kept.valid_until}`);
  check('и возвращает к карточке прибора', await page.locator('.card-verif').isVisible());

  // А теперь вписываем новые.
  await attachDocument('Свидетельство-2027.pdf');
  await page.waitForSelector('#verificationDatesForm', { timeout: 15000 });
  await page.fill('[name="verification_date"]', '2026-03-05');
  await page.fill('[name="valid_until"]', '2027-03-05');
  await page.click('#verificationDatesForm button[type="submit"]');
  await sleep(1500);

  const saved = (await api(`/api/instruments/${expiredId}`, { token: adminToken })).data;
  check('вписанные сроки сохраняются',
    saved.verification_date === '2026-03-05' && saved.valid_until === '2027-03-05',
    `${saved.verification_date} → ${saved.valid_until}`);
  check('карточка сразу показывает новый срок',
    /05\.03\.2027/.test(await page.locator('#cardScreen').innerText()));

  await page.click('#backToListButton');
  await sleep(700);
}

/* ============================================================
   9. Телефон: фильтры в две колонки, действие во всю ширину.
   ============================================================ */

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mp = await mobile.newPage();
mp.on('pageerror', (e) => errors.push('mobile: ' + e));
// Входим уже готовым токеном, а не через форму: у входа стоит защита
// от перебора (10 попыток за 5 минут), и лишние входы из тестов
// упираются в неё раньше, чем в проверяемое поведение.
await mp.addInitScript((t) => sessionStorage.setItem('token', t), seedToken);
await mp.goto(WEB, { waitUntil: 'networkidle' });
await mp.waitForSelector('.list .row', { timeout: 15000 });
await sleep(700);

const cols = await mp.evaluate(() => getComputedStyle(document.querySelector('.filters-row')).gridTemplateColumns);
check('на телефоне фильтры складываются в две колонки',
  cols.split(' ').length === 2, cols);

const btnWidth = await mp.evaluate(() => {
  const b = document.querySelector('.list .row .row-act button');
  const row = document.querySelector('.list .row');
  return b ? Math.round(b.getBoundingClientRect().width / row.getBoundingClientRect().width * 100) : 0;
});
check('кнопка действия занимает всю ширину строки', btnWidth > 85, btnWidth + '%');

const noOverflow = await mp.evaluate(() =>
  document.documentElement.scrollWidth <= window.innerWidth + 1);
check('страница не уезжает вбок по горизонтали', noOverflow,
  String(await mp.evaluate(() => document.documentElement.scrollWidth)));

await mobile.close();

/* --- уборка --- */
for (const no of ['ИМС-9001', 'ИМС-9002']) {
  const found = (await api('/api/instruments', { token: adminToken })).data
    .find((i) => i.inventory_no === no);
  if (found) await api(`/api/instruments/${found.id}`, { method: 'DELETE', token: adminToken });
}

check('за всё время ни одной ошибки JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
