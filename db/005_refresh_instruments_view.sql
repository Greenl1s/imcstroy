-- ============================================================
--  Миграция 005: пересоздание instruments_view
-- ============================================================
--  Представление instruments_view построено через "i.*" — а список полей
--  за этой звёздочкой ФИКСИРУЕТСЯ в момент создания представления и не
--  пересчитывается заново при каждом запросе. Когда в миграции 003
--  добавляли колонку control_type, представление не тронули (ошибочно
--  решив, что i.* подхватит новое поле сама) — из-за этого API отдавал
--  все данные БЕЗ control_type вообще, хотя в самой таблице значение
--  сохранялось верно.
--
--  Важно: используем DROP + CREATE, а не CREATE OR REPLACE. Колонка
--  control_type физически стоит в таблице не последней, а где-то
--  посередине (сразу после check_type) — из-за этого при разворачивании
--  i.* все колонки, что раньше шли следом, съезжают на одну позицию.
--  CREATE OR REPLACE VIEW такое запрещает: он разрешает добавлять новые
--  колонки только строго в конец списка, но не может ничего вставить
--  в середину — Postgres в этом случае жалуется на "смену имени колонки".
--  У обычного пересоздания (DROP + CREATE) такого ограничения нет.
--
--  Запуск:
--    docker compose exec -T db psql -U pribory -d pribory < db/005_refresh_instruments_view.sql
-- ============================================================

BEGIN;

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

COMMIT;
