ALTER TABLE instrument_recognition_photos
  ALTER COLUMN descriptors DROP NOT NULL;

ALTER TABLE instrument_recognition_photos
  ADD COLUMN IF NOT EXISTS embedding jsonb,
  ADD COLUMN IF NOT EXISTS model_version text,
  ADD COLUMN IF NOT EXISTS segmentation jsonb,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

CREATE INDEX IF NOT EXISTS instrument_recognition_photos_ai_idx
  ON instrument_recognition_photos(instrument_id)
  WHERE embedding IS NOT NULL;
