function showMessage(text, isError) {
  const el = document.getElementById("editor");
  el.innerHTML = `<div id="message"${isError ? ' class="error"' : ""}>${text}</div>`;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error("Не удалось загрузить скрипт OnlyOffice"));
    document.body.appendChild(s);
  });
}

(async function init() {
  const params = new URLSearchParams(location.search);
  const path = params.get("path");
  if (!path) {
    showMessage("Не указан файл для открытия.", true);
    return;
  }

  try {
    const res = await fetch(`/api/onlyoffice/config?path=${encodeURIComponent(path)}`, {
      credentials: "same-origin",
    });
    if (res.status === 401) {
      showMessage('Сессия истекла. <a href="/">Войдите заново</a> и откройте файл ещё раз.', true);
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || "HTTP " + res.status);
    }
    const { config, scriptUrl } = await res.json();
    await loadScript(scriptUrl);
    new DocsAPI.DocEditor("editor", config);
  } catch (err) {
    showMessage("Не удалось открыть документ: " + err.message, true);
  }
})();
