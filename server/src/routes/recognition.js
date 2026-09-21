import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { fetchLinkedFile, storeRecognitionFile, deleteRecognitionFile } from '../fileLink.js';

export const recognition = Router();
recognition.use(requireAuth);

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_DESCRIPTORS = 9;
const VECTOR_SIZE = 176;

function parseDataUrl(value) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(value || ''));
  if (!match) throw Object.assign(new Error('Нужно фото JPEG, PNG или WebP'), { status: 400 });
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_BYTES) throw Object.assign(new Error('Фото должно быть не больше 4 МБ'), { status: 400 });
  return { mimeType: match[1], bytes };
}

function validateDescriptors(value) {
  if (!Array.isArray(value) || !value.length || value.length > MAX_DESCRIPTORS) {
    throw Object.assign(new Error('Не удалось получить признаки фотографии'), { status: 400 });
  }
  return value.map((vector) => {
    if (!Array.isArray(vector) || vector.length !== VECTOR_SIZE || vector.some((n) => !Number.isFinite(n))) {
      throw Object.assign(new Error('Некорректные признаки фотографии'), { status: 400 });
    }
    return vector.map((n) => Math.max(-1, Math.min(1, Number(n))));
  });
}

function cosine(a, b) {
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i += 1) { dot += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}

recognition.get('/instruments/:id/photos', async (req, res) => {
  const { rows } = await query(
    `SELECT id, instrument_id, mime_type, size_bytes, created_at, file_path
       FROM instrument_recognition_photos WHERE instrument_id = $1 ORDER BY created_at DESC`, [req.params.id]);
  res.json(rows);
});

recognition.post('/instruments/:id/photos', requireAdmin, async (req, res) => {
  const descriptors = validateDescriptors(req.body?.descriptors);
  const { mimeType, bytes } = parseDataUrl(req.body?.data_url);
  const exists = await query('SELECT 1 FROM instruments WHERE id = $1', [req.params.id]);
  if (!exists.rows.length) return res.status(404).json({ error: 'Прибор не найден' });
  const count = await query('SELECT count(*)::int AS count FROM instrument_recognition_photos WHERE instrument_id = $1', [req.params.id]);
  if (count.rows[0].count >= 24) return res.status(409).json({ error: 'Для одного прибора можно сохранить до 24 фотографий' });
  const stored = await storeRecognitionFile(req.params.id, bytes, mimeType);
  try {
    const { rows } = await query(
      `INSERT INTO instrument_recognition_photos
         (instrument_id, mime_type, bytes, size_bytes, descriptors, created_by, file_path)
       VALUES ($1,$2,NULL,$3,$4::jsonb,$5,$6)
       RETURNING id, instrument_id, mime_type, size_bytes, created_at, file_path`,
      [req.params.id, mimeType, bytes.length, JSON.stringify(descriptors), req.user.id, stored.path]);
    res.status(201).json(rows[0]);
  } catch (err) {
    await deleteRecognitionFile(stored.path).catch(() => {});
    throw err;
  }
});

recognition.get('/photos/:id', async (req, res) => {
  const { rows } = await query('SELECT mime_type, bytes, file_path FROM instrument_recognition_photos WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Фотография не найдена' });
  let bytes = rows[0].bytes;
  let contentType = rows[0].mime_type;
  if (rows[0].file_path) {
    const linked = await fetchLinkedFile(rows[0].file_path, req.user.id);
    bytes = linked.buffer; contentType = linked.contentType;
  }
  res.set('Content-Type', contentType).set('Cache-Control', 'private, max-age=3600').send(bytes);
});

// Повторная обработка старого эталона: браузер размывает фон и присылает
// новые признаки, а запись остаётся привязана к тому же прибору.
recognition.put('/photos/:id', requireAdmin, async (req, res) => {
  const descriptors = validateDescriptors(req.body?.descriptors);
  const { mimeType, bytes } = parseDataUrl(req.body?.data_url);
  const found = await query(
    'SELECT id, instrument_id, file_path FROM instrument_recognition_photos WHERE id = $1',
    [req.params.id]);
  if (!found.rows.length) return res.status(404).json({ error: 'Фотография не найдена' });

  const old = found.rows[0];
  const stored = await storeRecognitionFile(old.instrument_id, bytes, mimeType);
  try {
    const { rows } = await query(
      `UPDATE instrument_recognition_photos
          SET mime_type = $1, bytes = NULL, size_bytes = $2,
              descriptors = $3::jsonb, file_path = $4
        WHERE id = $5
        RETURNING id, instrument_id, mime_type, size_bytes, created_at, file_path`,
      [mimeType, bytes.length, JSON.stringify(descriptors), stored.path, req.params.id]);
    if (old.file_path && old.file_path !== stored.path) {
      await deleteRecognitionFile(old.file_path).catch(() => {});
    }
    res.json(rows[0]);
  } catch (err) {
    await deleteRecognitionFile(stored.path).catch(() => {});
    throw err;
  }
});

recognition.delete('/photos/:id', requireAdmin, async (req, res) => {
  const found = await query('SELECT file_path FROM instrument_recognition_photos WHERE id = $1', [req.params.id]);
  if (!found.rows.length) return res.status(404).json({ error: 'Фотография не найдена' });
  if (found.rows[0].file_path) await deleteRecognitionFile(found.rows[0].file_path);
  await query('DELETE FROM instrument_recognition_photos WHERE id = $1', [req.params.id]);
  res.status(204).end();
});

recognition.post('/search', async (req, res) => {
  const wanted = validateDescriptors(req.body?.descriptors);
  const { rows } = await query(`
    SELECT rp.instrument_id, rp.descriptors, i.name, i.model, i.serial_number,
           i.inventory_no, i.status, i.has_photo
      FROM instrument_recognition_photos rp
      JOIN instruments_view i ON i.id = rp.instrument_id`);
  const best = new Map();
  for (const row of rows) {
    const saved = Array.isArray(row.descriptors) ? row.descriptors : [];
    let score = 0;
    for (const a of wanted) for (const b of saved) score = Math.max(score, cosine(a, b));
    const old = best.get(String(row.instrument_id));
    if (!old || score > old.score) best.set(String(row.instrument_id), { ...row, descriptors: undefined, score });
  }
  res.json([...best.values()].sort((a, b) => b.score - a.score).slice(0, 3));
});
