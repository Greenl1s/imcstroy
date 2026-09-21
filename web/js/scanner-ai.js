const API = location.pathname.startsWith('/instruments/') ? '/instruments/api' : '/api';
const token = sessionStorage.getItem('token');
const video = document.getElementById('cameraVideo');
const capture = document.getElementById('captureButton');
const input = document.getElementById('photoInput');
const preview = document.getElementById('preview');
const previewWrap = document.getElementById('previewWrap');
const status = document.getElementById('status');
const results = document.getElementById('results');
const referenceMode = document.getElementById('referenceMode');
const picker = document.getElementById('instrumentPicker');
const instrumentSelect = document.getElementById('instrumentSelect');
const saveButton = document.getElementById('saveReferenceButton');
let mode = 'search';
let stream = null;
let pendingDataUrl = null;

async function call(path, options = {}) {
  const response = await fetch(API + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) throw new Error('Сначала войдите в учёт оборудования');
  if (!response.ok) throw new Error(data.error || 'Ошибка сервера');
  return data;
}

function setStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle('error', error);
}

async function init() {
  try {
    const [user] = await Promise.all([call('/auth/me'), call('/recognition/ai/health')]);
    document.getElementById('accountBadge').textContent = `${user.username} · ${user.role === 'admin' ? 'администратор' : 'пользователь'}`;
    if (user.role === 'admin') {
      referenceMode.hidden = false;
      const instruments = await call('/instruments');
      instruments.filter((item) => item.status !== 'retired').forEach((item) => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = `#${item.id} · ${item.name} · ${item.model || 'без модели'} · ${item.serial_number || 'без с/н'}`;
        instrumentSelect.appendChild(option);
      });
    }
    await startCamera();
  } catch (error) {
    setStatus(error.message, true);
  }
}

document.querySelectorAll('[data-mode]').forEach((button) => {
  button.onclick = () => {
    mode = button.dataset.mode;
    document.querySelectorAll('[data-mode]').forEach((item) => item.classList.toggle('active', item === button));
    picker.hidden = mode !== 'reference';
    capture.textContent = mode === 'reference' ? 'Проверить фото' : 'Распознать прибор';
    document.getElementById('pageTitle').textContent = mode === 'reference' ? 'Добавить вид прибора' : 'Наведите камеру на прибор';
    document.getElementById('pageHint').textContent = mode === 'reference'
      ? 'Снимите прибор с нового ракурса. Перед сохранением вы увидите, насколько хорошо удалился фон.'
      : 'В кадре должен быть один прибор. Фон будет удалён на сервере до сравнения.';
    resetResult();
  };
});

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus('Выберите готовое фото: этот браузер не открыл камеру напрямую.');
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1920 } }, audio: false
    });
    video.srcObject = stream;
    await video.play();
    capture.disabled = false;
    setStatus('Камера готова. Держите в кадре один прибор.');
  } catch {
    setStatus('Разрешите доступ к камере или выберите готовую фотографию.', true);
  }
}

capture.onclick = async () => {
  if (!video.videoWidth) return;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', .88));
  await processPhoto(await resizeToDataUrl(blob));
};

input.onchange = async () => {
  const file = input.files?.[0];
  if (file) await processPhoto(await resizeToDataUrl(file));
  input.value = '';
};

async function resizeToDataUrl(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', .86);
}

async function processPhoto(dataUrl) {
  resetResult();
  capture.disabled = true;
  setStatus('Удаляю фон и анализирую сам прибор…');
  try {
    if (mode === 'reference') {
      if (!instrumentSelect.value) throw new Error('Сначала выберите прибор из списка');
      const analyzed = await call('/recognition/ai/preview', { method: 'POST', body: JSON.stringify({ data_url: dataUrl }) });
      pendingDataUrl = dataUrl;
      showPreview(analyzed.preview_data_url || analyzed.data_url);
      saveButton.hidden = false;
      setStatus('Проверьте вырезанный предмет. Если прибор отделён правильно, сохраните эталон.');
    } else {
      const answer = await call('/recognition/ai/search', { method: 'POST', body: JSON.stringify({ data_url: dataUrl }) });
      showPreview(answer.preview_data_url);
      renderResults(answer);
    }
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    capture.disabled = !stream;
  }
}

saveButton.onclick = async () => {
  if (!pendingDataUrl || !instrumentSelect.value) return;
  saveButton.disabled = true;
  setStatus('Сохраняю эталон и его AI-признаки…');
  try {
    const saved = await call(`/recognition/ai/instruments/${instrumentSelect.value}/photos`, {
      method: 'POST', body: JSON.stringify({ data_url: pendingDataUrl })
    });
    showPreview(saved.preview_data_url);
    pendingDataUrl = null;
    saveButton.hidden = true;
    setStatus('Эталон сохранён. Добавьте ещё 4–6 ракурсов этого прибора.');
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    saveButton.disabled = false;
  }
};

function showPreview(dataUrl) {
  preview.src = dataUrl;
  previewWrap.hidden = false;
}

function resetResult() {
  pendingDataUrl = null;
  results.innerHTML = '';
  previewWrap.hidden = true;
  saveButton.hidden = true;
  status.classList.remove('error');
}

function renderResults(answer) {
  if (!answer.results.length) {
    setStatus('В AI-базе пока нет эталонных фотографий.', true);
    return;
  }
  if (!answer.accepted) {
    setStatus('Надёжного совпадения нет. Снимите прибор ближе или с другого ракурса.', true);
    return;
  }
  setStatus('Прибор найден. Перед выдачей проверьте серийный или инвентарный номер.');
  answer.results.slice(0, 1).forEach(async (item) => {
    const card = document.createElement('article');
    card.className = 'result';
    card.innerHTML = `<div class="no-photo"></div><div><h2>${escapeHtml(item.name)}</h2><p>${escapeHtml(item.model || 'Модель не указана')}</p><p>Инв. № ${escapeHtml(item.inventory_no || '—')} · Серийный № ${escapeHtml(item.serial_number || '—')}</p><span class="score">Сходство ${Math.round(item.score * 100)}%</span></div><a class="open" href="./?id=${encodeURIComponent(item.instrument_id)}">Открыть карточку</a>`;
    results.appendChild(card);
    if (item.has_photo) {
      const response = await fetch(`${API}/instruments/${item.instrument_id}/photo`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (response.ok) {
        const url = URL.createObjectURL(await response.blob());
        const image = document.createElement('img'); image.src = url; image.alt = '';
        card.firstElementChild.replaceWith(image);
      }
    }
  });
}

function escapeHtml(value) {
  const node = document.createElement('div');
  node.textContent = String(value ?? '');
  return node.innerHTML;
}

window.addEventListener('pagehide', () => stream?.getTracks().forEach((track) => track.stop()));
init();
