-- ============================================================
--  Классификация приборов раньше была жёстко зашитым enum-типом
--  в базе (значения нельзя было удалить средствами PostgreSQL —
--  только добавлять). Теперь это обычная таблица-справочник,
--  которой может управлять администратор через интерфейс:
--  добавлять новые классификации и удалять неиспользуемые.
--
--  ВАЖНО: выполняется одним файлом от начала до конца, не по частям —
--  представление instruments_view временно удаляется и пересоздаётся.
-- ============================================================

DROP VIEW IF EXISTS instruments_view;

ALTER TABLE instruments ALTER COLUMN control_type TYPE TEXT USING control_type::TEXT;

CREATE TABLE IF NOT EXISTS control_types (
  code TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0
);

-- Переносим прежние 9 значений enum — те же коды, что были, чтобы
-- у существующих приборов классификация не потерялась.
INSERT INTO control_types (code, full_name, short_name, position) VALUES
  ('vik', 'Визуально-измерительный контроль', 'ВИК', 1),
  ('uzk', 'Ультразвуковой контроль', 'УЗК', 2),
  ('elk', 'Электрический контроль', 'ЭЛК', 3),
  ('tk', 'Тепловой контроль', 'ТК', 4),
  ('ak', 'Акустический контроль', 'АК', 5),
  ('kbt', 'Контроль бетона', 'КБТ', 6),
  ('rgk', 'Радиографический контроль', 'РГК', 7),
  ('gdz', 'Геодезическое оборудование', 'ГДЗ', 8),
  ('vspom', 'Вспомогательные приборы', 'ВСПОМ', 9)
ON CONFLICT (code) DO NOTHING;

-- Внешний ключ — двойная страховка поверх проверки в самом приложении:
-- нельзя присвоить прибору несуществующую классификацию, и нельзя удалить
-- классификацию, которая ещё используется хотя бы одним прибором.
ALTER TABLE instruments
  ADD CONSTRAINT instruments_control_type_fkey
  FOREIGN KEY (control_type) REFERENCES control_types(code);

DROP TYPE IF EXISTS control_type;

-- Пересоздаём представление — структура ровно та же, что была,
-- просто control_type теперь обычный текст, а не enum.
CREATE VIEW instruments_view AS
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
    ptu.username AS pending_transfer_to_name
   FROM instruments i
     LEFT JOIN users tu ON tu.id = i.taken_by
     LEFT JOIN users bu ON bu.id = i.booked_by
     LEFT JOIN users ptu ON ptu.id = i.pending_transfer_to
     LEFT JOIN instrument_photos p ON p.instrument_id = i.id
     LEFT JOIN instrument_documents d ON d.instrument_id = i.id;
