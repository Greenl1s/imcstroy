ALTER TABLE instrument_recognition_photos
  ADD COLUMN IF NOT EXISTS file_path text;

ALTER TABLE instrument_recognition_photos
  ALTER COLUMN bytes DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS instrument_recognition_photos_file_path_key
  ON instrument_recognition_photos(file_path) WHERE file_path IS NOT NULL;
