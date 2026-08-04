-- ============================================================
--  Фильтр "Привязан" — к какой компании привязан прибор. Управляется
--  администратором через интерфейс (аналогично классификациям):
--  можно добавлять и удалять компании.
-- ============================================================

CREATE TABLE IF NOT EXISTS companies (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0
);

ALTER TABLE instruments ADD COLUMN IF NOT EXISTS company_code TEXT REFERENCES companies(code);

-- Только добавляем колонки в конец — старые не трогаем, поэтому
-- CREATE OR REPLACE VIEW проходит без необходимости удалять представление.
CREATE OR REPLACE VIEW instruments_view AS
 SELECT i.id,
    i.inventory_no,
    i.name,
    i.serial_number,
    i.model,
    i.check_type,
    i.verification_date,
    i.valid_until,
    i.document_url,
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
    ptu.username AS pending_transfer_to_name,
    i.company_code,
    c.name AS company_name
   FROM instruments i
     LEFT JOIN users tu ON tu.id = i.taken_by
     LEFT JOIN users bu ON bu.id = i.booked_by
     LEFT JOIN users ptu ON ptu.id = i.pending_transfer_to
     LEFT JOIN instrument_photos p ON p.instrument_id = i.id
     LEFT JOIN instrument_documents d ON d.instrument_id = i.id
     LEFT JOIN companies c ON c.code = i.company_code;
