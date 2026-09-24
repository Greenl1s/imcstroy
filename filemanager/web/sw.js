/* ============================================================
 *  Служебный работник (service worker) — один на весь домен.
 *
 *  Он стоит между страницей и сетью и решает, что отдать: свежее
 *  из интернета или последнее сохранённое. Благодаря этому:
 *
 *    — приложение открывается мгновенно и работает без связи;
 *    — на объекте без интернета видно дела, приборы и календарь
 *      такими, какими они были при последнем выходе в сеть;
 *    — вместо ошибки браузера показывается понятная страница.
 *
 *  Он ОДИН на три системы: ИСУ лежит в корне, «Учёт» в /instruments/,
 *  календарь в /calendar/ — всё это один адрес, значит и приложение
 *  одно. Иначе телефон предлагал бы установить три иконки.
 *
 *  Правило, которое здесь главное: НИЧЕГО, кроме чтения, не кэшируем.
 *  Запросы, которые меняют данные (POST, PATCH, DELETE), всегда идут
 *  в сеть и не подменяются сохранённым ответом. Показать вчерашний
 *  список — нормально; молча «выдать» прибор из кэша — недопустимо.
 * ============================================================ */

// Версия меняется при каждой правке этого файла — по ней браузер
// понимает, что работник новый, и выбрасывает старые хранилища.
const VERSION = "v4";
const SHELL_CACHE = `оболочка-${VERSION}`;
const DATA_CACHE = `данные-${VERSION}`;
const OFFLINE_URL = "/app/offline.html";

// Оболочка — то, без чего страница не нарисуется. Список короткий
// нарочно: всё остальное дозагрузится и осядет в кэше само.
const SHELL = [
  OFFLINE_URL,
  "/app/icon-192.png",
  "/app/icon-512.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // Не падаем целиком, если один файл недоступен: приложение важнее
    // полноты кэша.
    await Promise.allSettled(SHELL.map((url) => cache.add(url)));
    // Новый работник заступает сразу, не дожидаясь закрытия вкладок.
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((n) => !n.endsWith(VERSION))
      .map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

/** Запросы, которые меняют данные, кэшировать нельзя ни при каких условиях. */
const isRead = (request) => request.method === "GET";

/** Всё, что ведёт к данным, а не к файлам оболочки. */
const isApi = (url) => url.pathname.includes("/api/");

/**
 * Файлы из хранилища (документы, фотографии приборов, выгрузки) через
 * кэш не пропускаем: они большие, их много, и место на телефоне
 * кончится раньше, чем это принесёт пользу.
 */
const isHeavy = (url) =>
  url.pathname.startsWith("/api/download") ||
  url.pathname.startsWith("/api/raw") ||
  url.pathname.includes("/document") ||
  url.pathname.includes("/photo") ||
  url.pathname.includes("qr-archive");

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Чужие адреса не наше дело.
  if (url.origin !== self.location.origin) return;
  if (!isRead(request)) return;
  if (isHeavy(url)) return;

  // Переходы по страницам: сначала сеть (чтобы не показать вчерашнюю
  // версию приложения), при отказе — сохранённое, и только если и его
  // нет — честная страница «нет связи».
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(SHELL_CACHE);
        cache.put(request, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(request);
        return cached || caches.match(OFFLINE_URL);
      }
    })());
    return;
  }

  if (isApi(url)) {
    // Данные: сеть первой, кэш — как память о последнем удачном ответе.
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        if (fresh.ok) {
          const cache = await caches.open(DATA_CACHE);
          cache.put(request, fresh.clone());
        }
        return fresh;
      } catch {
        const cached = await caches.match(request);
        if (cached) {
          // Помечаем ответ, чтобы страница могла честно сказать:
          // «это данные на такое-то время, связи сейчас нет».
          const body = await cached.blob();
          const headers = new Headers(cached.headers);
          headers.set("X-Из-кэша", "1");
          return new Response(body, { status: cached.status, headers });
        }
        return new Response(
          JSON.stringify({ message: "Нет связи с сервером, и сохранённой копии этих данных нет" }),
          { status: 503, headers: { "Content-Type": "application/json; charset=utf-8" } }
        );
      }
    })());
    return;
  }

  // Скрипты, стили, иконки: отдаём сохранённое сразу (быстро), а свежее
  // подтягиваем в фоне — к следующему открытию оно уже будет.
  event.respondWith((async () => {
    const cached = await caches.match(request);
    const network = fetch(request).then((res) => {
      if (res.ok) caches.open(SHELL_CACHE).then((c) => c.put(request, res.clone()));
      return res;
    }).catch(() => null);
    return cached || (await network) || caches.match(OFFLINE_URL);
  })());
});

/* ---------- Уведомления ----------
   Приходят с сервера, когда истекает поверка, начинается встреча или
   горит срок по делу. Щелчок открывает не «приложение вообще», а ровно
   то место, о котором уведомление. */

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* пустое уведомление */ }

  const title = data.title || "ИМС";
  const options = {
    body: data.body || "",
    icon: "/app/icon-192.png",
    badge: "/app/icon-192.png",
    tag: data.tag || undefined,       // одинаковые не копятся стопкой
    renotify: Boolean(data.tag),
    data: { url: data.url || "/" },
    requireInteraction: Boolean(data.important),
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    // Если приложение уже открыто — переводим его, а не плодим окна.
    for (const client of all) {
      if (client.url.includes(self.location.origin)) {
        await client.focus();
        if ("navigate" in client) await client.navigate(target);
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
