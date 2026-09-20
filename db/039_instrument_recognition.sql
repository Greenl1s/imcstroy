CREATE TABLE IF NOT EXISTS instrument_recognition_photos (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  instrument_id bigint NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
  mime_type     text NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  bytes         bytea NOT NULL,
  size_bytes    integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 4 * 1024 * 1024),
  descriptors   jsonb NOT NULL,
  created_by    bigint REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS instrument_recognition_photos_instrument_idx
  ON instrument_recognition_photos(instrument_id);
