
-- ============================================================
--  Миграция 002: замена «Ссылка на документ» на фото документа
-- ============================================================
--  Применяется ОДИН РАЗ на уже работающей базе (не на новых
--  установках — там это уже учтено в 001_schema.sql).
--
--  Запуск:
--    docker compose exec -T db psql -U pribory -d pribory < db/002_add_document_photo.sql
-- ============================================================

-- Новая таблица — фото документа, устроена так же, как фото прибора.
CREATE TABLE IF NOT EXISTS instrument_documents (
  instrument_id bigint PRIMARY KEY REFERENCES instruments (id) ON DELETE CASCADE,
  mime_type     text        NOT NULL,
  bytes         bytea       NOT NULL,
  size_bytes    int         NOT NULL,
  uploaded_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_size_limit CHECK (size_bytes <= 5 * 1024 * 1024)
);

-- Старое текстовое поле со ссылкой больше не используется.
ALTER TABLE instruments DROP COLUMN IF EXISTS document_url;

-- Представление нужно пересоздать — раньше оно ссылалось на document_url
-- через i.*, теперь добавляем признак has_document вместо него.
DROP VIEW IF EXISTS instruments_view;

CREATE VIEW instruments_view AS
SELECT
  i.*,
  tu.username AS taken_by_name,
  bu.username AS booked_by_name,
  (p.instrument_id IS NOT NULL) AS has_photo,
  (d.instrument_id IS NOT NULL) AS has_document
FROM instruments i
LEFT JOIN users tu ON tu.id = i.taken_by
LEFT JOIN users bu ON bu.id = i.booked_by
LEFT JOIN instrument_photos p ON p.instrument_id = i.id
LEFT JOIN instrument_documents d ON d.instrument_id = i.id;
