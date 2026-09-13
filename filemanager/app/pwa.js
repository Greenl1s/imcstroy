/* ============================================================
 *  Приложение: установка на устройство и работа без сети.
 *
 *  Один файл на три системы — ИСУ, «Учёт» и календарь лежат на одном
 *  адресе, значит и приложение у них одно. Подключается строкой
 *  <script src="/app/pwa.js" defer></script> в каждой из них.
 *
 *  Делает три вещи и больше ничего:
 *    1. включает служебного работника (offline и уведомления);
 *    2. предлагает установить приложение — но не назойливо;
 *    3. показывает, когда связи нет, чтобы человек не думал, что
 *       данные исчезли.
 * ============================================================ */

(function () {
  "use strict";

  const STORAGE_KEY = "имс-установка-скрыта";
  const isStandalone = () =>
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  /* ---------- 1. Служебный работник ---------- */

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
        // Не ругаемся в интерфейсе: без работника всё просто работает
        // как обычный сайт, а это рабочее состояние, а не поломка.
        console.warn("Служебный работник не включился:", err && err.message);
      });
    });
  }

  /* ---------- 2. Предложение установить ---------- */

  const hidden = () => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  };
  const hide = () => {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* приват-режим */ }
  };

  function bar(html) {
    const node = document.createElement("div");
    node.className = "pwa-bar";
    node.innerHTML = html;
    document.body.appendChild(node);
    const close = node.querySelector("[data-pwa-close]");
    if (close) close.onclick = () => { hide(); node.remove(); };
    return node;
  }

  // Android и настольные браузеры сами сообщают, что приложение можно
  // установить. Перехватываем это событие и показываем свою кнопку:
  // системная подсказка выскакивает не вовремя и часто не замечается.
  let deferred = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
    if (hidden() || isStandalone()) return;

    const node = bar(`
      <span class="pwa-bar-text"><b>Установить приложение</b>
        Иконка на экране, работа без интернета и уведомления.</span>
      <button type="button" class="pwa-bar-go" data-pwa-install>Установить</button>
      <button type="button" class="pwa-bar-x" data-pwa-close aria-label="Не сейчас">✕</button>`);

    node.querySelector("[data-pwa-install]").onclick = async () => {
      node.remove();
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      // Отказался — больше не предлагаем: одного раза достаточно.
      if (outcome !== "accepted") hide();
      deferred = null;
    };
  });

  // На iPhone такого события нет: Apple не даёт установить приложение
  // из кода. Единственный путь — «Поделиться» → «На экран Домой»,
  // и человеку надо один раз это показать. Без установки на iPhone
  // не работают уведомления, поэтому подсказка не косметическая.
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isSafari = isIos && !/crios|fxios|edgios/i.test(navigator.userAgent);
  if (isIos && isSafari && !isStandalone() && !hidden()) {
    window.addEventListener("load", () => {
      setTimeout(() => {
        bar(`
          <span class="pwa-bar-text"><b>Добавьте на экран «Домой»</b>
            Нажмите <span class="pwa-ios-share">Поделиться</span> внизу экрана и выберите
            «На экран Домой». Только так на iPhone работают уведомления.</span>
          <button type="button" class="pwa-bar-x" data-pwa-close aria-label="Понятно">✕</button>`);
      }, 2500); // не в первую секунду: человек ещё смотрит на экран
    });
  }

  /* ---------- 3. Полоса «нет связи» ---------- */

  let offlineBar = null;
  function showOffline() {
    if (offlineBar || navigator.onLine) return;
    offlineBar = document.createElement("div");
    offlineBar.className = "pwa-offline";
    offlineBar.textContent = "Нет связи — показано последнее загруженное";
    document.body.appendChild(offlineBar);
  }
  function hideOffline() {
    if (offlineBar) { offlineBar.remove(); offlineBar = null; }
  }

  window.addEventListener("offline", showOffline);
  window.addEventListener("online", hideOffline);
  window.addEventListener("load", () => { if (!navigator.onLine) showOffline(); });

  /* ---------- Стили ---------- */
  // Стили здесь, а не в трёх файлах: у систем разные оформления, а эта
  // полоса должна выглядеть одинаково во всех.
  const style = document.createElement("style");
  style.textContent = `
    .pwa-bar {
      position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%);
      z-index: 9000; display: flex; align-items: center; gap: 12px;
      width: min(560px, calc(100vw - 24px)); padding: 12px 14px;
      background: #232a28; color: #e8efea; border-radius: 12px;
      box-shadow: 0 12px 32px rgba(0,0,0,.35);
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      font-size: 14px; line-height: 1.45;
    }
    .pwa-bar-text { flex: 1; }
    .pwa-bar-text b { display: block; font-weight: 600; }
    .pwa-bar-text { color: #a9bdb2; }
    .pwa-bar-text b { color: #e8efea; }
    .pwa-ios-share {
      display: inline-block; padding: 0 5px; border-radius: 4px;
      background: rgba(255,255,255,.12); color: #e8efea;
    }
    .pwa-bar-go {
      min-height: 40px; padding: 0 18px; border: 0; border-radius: 8px;
      background: #7fc0a1; color: #10201a; font: inherit; font-weight: 600; cursor: pointer;
    }
    .pwa-bar-x {
      min-height: 34px; width: 34px; padding: 0; border: 0; border-radius: 8px;
      background: rgba(255,255,255,.1); color: #cddbd3; font: inherit; cursor: pointer;
    }
    .pwa-offline {
      position: fixed; left: 0; right: 0; top: 0; z-index: 9001;
      padding: 7px 12px; text-align: center;
      background: #8a5320; color: #fff; font-size: 13px; font-weight: 600;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    }
    @media (max-width: 520px) {
      .pwa-bar { flex-wrap: wrap; }
      .pwa-bar-go { width: 100%; }
    }`;
  document.head.appendChild(style);
})();
