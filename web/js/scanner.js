import { prepareRecognitionPhoto } from './image-fingerprint.js';

const API = location.pathname.startsWith('/instruments/') ? '/instruments/api' : '/api';
const input = document.getElementById('photoInput');
const video = document.getElementById('cameraVideo');
const capture = document.getElementById('captureButton');
const preview = document.getElementById('preview');
const status = document.getElementById('status');
const results = document.getElementById('results');
const token = sessionStorage.getItem('token');
let stream = null;

async function call(path, options = {}) {
  const response = await fetch(API + path, { ...options, headers: {
    'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {})
  }});
  if (response.status === 401) throw new Error('Сначала войдите в учёт оборудования');
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Ошибка сервера');
  }
  return response.json();
}

async function instrumentPhoto(id) {
  const response = await fetch(`${API}/instruments/${id}/photo`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  return response.ok ? URL.createObjectURL(await response.blob()) : null;
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    status.textContent = 'Браузер не умеет открывать камеру напрямую. Выберите готовое фото.';
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1920 } }, audio: false
    });
    video.srcObject = stream;
    await video.play();
    capture.disabled = false;
    status.textContent = 'Камера готова. Наведите её на прибор и нажмите «Распознать прибор».';
  } catch {
    status.textContent = 'Разрешите доступ к камере или выберите готовую фотографию.';
  }
}

capture.onclick = async () => {
  if (!video.videoWidth) return;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', .9));
  await recognize(new File([blob], 'camera.jpg', { type: 'image/jpeg' }));
};

input.onchange = async () => {
  const file = input.files?.[0];
  if (file) await recognize(file);
  input.value = '';
};

async function recognize(file) {
  results.innerHTML = '';
  capture.disabled = true;
  status.textContent = 'Выделяю прибор и размываю фон…';
  try {
    const data = await prepareRecognitionPhoto(file);
    preview.src = data.dataUrl; preview.hidden = false;
    status.textContent = data.usedFallbackMask
      ? 'Прибор виден нечётко. Сравниваю центр кадра…'
      : 'Фон исключён. Сравниваю прибор с фотобазой…';
    const found = await call('/recognition/search', {
      method: 'POST', body: JSON.stringify({ descriptors: data.descriptors })
    });
    if (!found.length) { status.textContent = 'В фотобазе пока нет эталонных снимков.'; return; }
    const top = found[0];
    if (top.score < .64) {
      status.textContent = 'Прибор не распознан. Подойдите ближе, поместите прибор в рамку и повторите снимок.';
      return;
    }
    const visible = found.filter((item, index) => index === 0 || (item.score >= .72 && top.score - item.score <= .045));
    const confident = top.score >= .78 && (found.length === 1 || top.score - found[1].score >= .025);
    status.textContent = confident
      ? 'Прибор найден. Проверьте инвентарный или серийный номер.'
      : 'Есть один вероятный вариант. Проверьте номер перед выдачей.';
    for (const item of visible) {
      const card = document.createElement('article'); card.className = 'result';
      const pct = Math.max(0, Math.min(100, Math.round(item.score * 100)));
      card.innerHTML = `<div class="no-photo"></div><div><h2>${esc(item.name)}</h2><p>${esc(item.model || 'Модель не указана')}</p><p>Инв. № ${esc(item.inventory_no || '—')} · Серийный № ${esc(item.serial_number || '—')}</p><span class="score">Сходство ${pct}%</span></div><a class="open" href="./?id=${item.instrument_id}">Открыть карточку</a>`;
      results.appendChild(card);
      if (item.has_photo) {
        const url = await instrumentPhoto(item.instrument_id);
        if (url) card.firstElementChild.outerHTML = `<img src="${url}" alt="">`;
      }
    }
  } catch (error) { status.textContent = error.message; }
  finally { capture.disabled = !stream; }
}

function esc(value) { const div = document.createElement('div'); div.textContent = String(value ?? ''); return div.innerHTML; }
window.addEventListener('pagehide', () => stream?.getTracks().forEach((track) => track.stop()));
startCamera();
