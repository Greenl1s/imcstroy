/**
 * allowHtml выставляем только для наших собственных сообщений со ссылкой.
 * Всё, что пришло с сервера или из ошибки, вставляем как текст — иначе
 * содержимое сообщения могло бы выполниться как разметка.
 */
function showMessage(text, isError, allowHtml) {
  const el = document.getElementById("editor");
  const box = document.createElement("div");
  box.id = "message";
  if (isError) box.className = "error";
  if (allowHtml) box.innerHTML = text;
  else box.textContent = text;
  el.replaceChildren(box);
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
      showMessage('Сессия истекла. <a href="/">Войдите заново</a> и откройте файл ещё раз.', true, true);
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
