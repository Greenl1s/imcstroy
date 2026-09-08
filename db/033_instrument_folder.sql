-- ============================================================
--  Папка прибора в файловом менеджере
-- ============================================================
--  Папка «База данных / Оборудование» в ИСУ становится отражением
--  этой таблицы:
--
--    Оборудование/<Классификация>/<ИНВ — Название>/Изображения/
--                                                 /Поверка/
--
--  Чтобы папку можно было ПЕРЕНЕСТИ при смене классификации или
--  переименовании, надо знать, где она лежит сейчас. Вычислить это
--  из текущих полей нельзя: классификация уже изменилась, а папка
--  ещё стоит по старому адресу. Поэтому фактический путь хранится
--  здесь — ровно так же, как у проектов в cases.folder_path.
--
--  Пусто = папки ещё нет (прибор завели до этой возможности либо
--  файловый менеджер был недоступен). Сверка заведёт её при первом
--  удобном случае.
--
--  Обе системы ходят в одну базу, поэтому колонка нужна одна и живёт
--  здесь, рядом с самими приборами.
--
--  Миграция идемпотентная.
-- ============================================================

ALTER TABLE instruments ADD COLUMN IF NOT EXISTS folder_path text;

COMMENT ON COLUMN instruments.folder_path IS
  'Где лежит папка прибора в файловом менеджере ИСУ. NULL — папки ещё нет.';

-- Быстрый ответ на вопрос «чей это путь» — по нему файловый менеджер
-- узнаёт прибор, когда человек открывает его папку.
CREATE UNIQUE INDEX IF NOT EXISTS instruments_folder_path_key
  ON instruments (folder_path) WHERE folder_path IS NOT NULL;

-- ---------- Представление ----------
-- У представлений набор столбцов фиксируется в момент создания, поэтому
-- новая колонка попадёт в instruments_view только после пересоздания.
--
-- Пишем i.* вместо перечисления колонок — это ровно то, что было в
-- 001_schema.sql, и именно поэтому здесь легко ошибиться: в 013 колонки
-- перечислены поимённо, и, скопировав старое определение, можно молча
-- потерять company_name, поля передачи и booked_where. Через i.* новые
-- колонки подхватываются сами, и следующая такая миграция не сможет
-- ничего уронить.
DROP VIEW IF EXISTS instruments_view;
CREATE VIEW instruments_view AS
SELECT
  i.*,
  tu.username  AS taken_by_name,
  bu.username  AS booked_by_name,
  ptu.username AS pending_transfer_to_name,
  c.name       AS company_name,
  -- Фото может лежать двумя способами: байтами в базе (как раньше) или
  -- файлом в файловом менеджере (photo_link_path). Для интерфейса это
  -- одно и то же — «фото есть».
  (p.instrument_id IS NOT NULL OR i.photo_link_path    IS NOT NULL) AS has_photo,
  (d.instrument_id IS NOT NULL OR i.document_link_path IS NOT NULL) AS has_document
FROM instruments i
LEFT JOIN users tu  ON tu.id  = i.taken_by
LEFT JOIN users bu  ON bu.id  = i.booked_by
LEFT JOIN users ptu ON ptu.id = i.pending_transfer_to
LEFT JOIN instrument_photos    p ON p.instrument_id = i.id
LEFT JOIN instrument_documents d ON d.instrument_id = i.id
LEFT JOIN companies c ON c.code = i.company_code;
