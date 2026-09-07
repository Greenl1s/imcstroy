-- ============================================================
--  Подтверждение передачи прибора: тот, кому передают, должен
--  сам принять или отклонить — прибор не переходит к нему сразу.
--
--  Пока передача не подтверждена, taken_by (кто реально держит
--  прибор) НЕ меняется — новые поля просто говорят "кому-то
--  предложена передача", а фактический владелец остаётся прежним
--  до момента подтверждения.
-- ============================================================

ALTER TABLE instruments
  ADD COLUMN IF NOT EXISTS pending_transfer_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pending_transfer_where TEXT,
  ADD COLUMN IF NOT EXISTS pending_transfer_extra TEXT;

-- Пересоздаём представление: сохраняем ВСЕ существующие колонки в том же
-- порядке (иначе CREATE OR REPLACE VIEW откажется работать), новые поля —
-- строго в конце. Заодно возвращаем booked_where, которого тут не хватало.
-- ВНИМАНИЕ. В прежней версии этого файла представление ссылалось на
-- колонку document_url. Её удаляет 002_add_document_photo.sql (ссылку на
-- документ заменило фото документа), поэтому при развёртывании с нуля
-- файл падал: такой колонки уже нет. Строка убрана.
-- Пересоздаём представление целиком (DROP + CREATE), а не через
-- CREATE OR REPLACE: тот требует, чтобы прежние колонки совпадали по
-- именам и порядку, а на пустой базе к этому моменту представление уже
-- другое (003_add_control_type добавил control_type в середину).
-- Данных в представлении нет, пересоздать его ничего не стоит.
DROP VIEW IF EXISTS instruments_view;
CREATE VIEW instruments_view AS
 SELECT i.id,
    i.inventory_no,
    i.name,
    i.serial_number,
    i.model,
    i.check_type,
    i.verification_date,
    i.valid_until,
    i.comment,
    i.status,
    i.taken_by,
    i.taken_where,
    i.taken_extra,
    i.taken_at,
    i.booked_by,
    i.booked_for,
    i.booked_extra,
    i.retired_at,
    i.created_at,
    i.updated_at,
    i.photo_link_path,
    i.document_link_path,
    i.control_type,
    tu.username AS taken_by_name,
    bu.username AS booked_by_name,
    (p.instrument_id IS NOT NULL OR i.photo_link_path IS NOT NULL) AS has_photo,
    (d.instrument_id IS NOT NULL OR i.document_link_path IS NOT NULL) AS has_document,
    i.booked_where,
    i.pending_transfer_to,
    i.pending_transfer_where,
    i.pending_transfer_extra,
    ptu.username AS pending_transfer_to_name
   FROM instruments i
     LEFT JOIN users tu ON tu.id = i.taken_by
     LEFT JOIN users bu ON bu.id = i.booked_by
     LEFT JOIN users ptu ON ptu.id = i.pending_transfer_to
     LEFT JOIN instrument_photos p ON p.instrument_id = i.id
     LEFT JOIN instrument_documents d ON d.instrument_id = i.id;
