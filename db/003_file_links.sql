-- ============================================================
--  Миграция 003: привязка фото/документа к файлу в files.imcstroy.ru
-- ============================================================
--  Применяется ОДИН РАЗ на уже работающей базе.
--
--  Запуск:
--    cat db/003_file_links.sql | docker compose exec -T db psql -U pribory -d pribory
-- ============================================================

-- Если поле заполнено — фото/документ берётся из файлового менеджера
-- (files.imcstroy.ru) по этому пути, а не из instrument_photos/instrument_documents.
-- Заполнены оба варианта одновременно быть не должны: выбор одного
-- способа (загрузка с компьютера или привязка из файлового менеджера)
-- очищает другой — это делает backend, не база.
ALTER TABLE instruments
  ADD COLUMN IF NOT EXISTS photo_link_path text,
  ADD COLUMN IF NOT EXISTS document_link_path text;

-- Представление пересоздаём: has_photo/has_document теперь учитывают
-- и привязанный файл тоже, не только байты в базе.
DROP VIEW IF EXISTS instruments_view;

CREATE VIEW instruments_view AS
SELECT
  i.*,
  tu.username AS taken_by_name,
  bu.username AS booked_by_name,
  (p.instrument_id IS NOT NULL OR i.photo_link_path IS NOT NULL) AS has_photo,
  (d.instrument_id IS NOT NULL OR i.document_link_path IS NOT NULL) AS has_document
FROM instruments i
LEFT JOIN users tu ON tu.id = i.taken_by
LEFT JOIN users bu ON bu.id = i.booked_by
LEFT JOIN instrument_photos p ON p.instrument_id = i.id
LEFT JOIN instrument_documents d ON d.instrument_id = i.id;
