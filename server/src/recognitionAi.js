const AI_URL = (process.env.RECOGNITION_AI_URL || 'http://recognition-ai:8000').replace(/\/$/, '');
const AI_TIMEOUT_MS = Number(process.env.RECOGNITION_AI_TIMEOUT_MS || 60000);

async function readError(response) {
  try {
    const body = await response.json();
    return body.detail || body.error;
  } catch {
    return null;
  }
}

export async function analyzeRecognitionPhoto(dataUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${AI_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data_url: dataUrl }),
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw Object.assign(new Error('Распознавание заняло слишком много времени. Повторите снимок.'), { status: 504 });
    }
    throw Object.assign(new Error('AI-сервис пока недоступен'), { status: 503 });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const message = await readError(response);
    throw Object.assign(new Error(message || 'AI-сервис не смог обработать фотографию'), {
      status: response.status === 422 || response.status === 400 ? response.status : 503
    });
  }
  const result = await response.json();
  if (!Array.isArray(result.embedding) || result.embedding.length !== 384 || !result.data_url) {
    throw Object.assign(new Error('AI-сервис вернул неполный результат'), { status: 503 });
  }
  return result;
}

export async function recognitionAiHealth() {
  try {
    const response = await fetch(`${AI_URL}/health`, { signal: AbortSignal.timeout(5000) });
    return response.ok ? response.json() : { ok: false };
  } catch {
    return { ok: false };
  }
}
