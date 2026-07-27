-- ============================================================
--  Миграция 003: классификация приборов по видам контроля
-- ============================================================
--  Применяется ОДИН РАЗ на уже работающей базе (не на новых
--  установках — там это уже учтено в 001_schema.sql).
--
--  Запуск:
--    docker compose exec -T db psql -U pribory -d pribory < db/003_add_control_type.sql
-- ============================================================

DO $$ BEGIN
  CREATE TYPE control_type AS ENUM ('vik', 'uzk', 'elk', 'tk', 'ak', 'kbt', 'rgk', 'gdz');
EXCEPTION
  WHEN duplicate_object THEN NULL; -- уже создан — ничего не делаем
END $$;

-- NULL = «не указано», отдельное значение перечисления для этого не заводим.
ALTER TABLE instruments ADD COLUMN IF NOT EXISTS control_type control_type;

CREATE INDEX IF NOT EXISTS instruments_control_type_idx ON instruments (control_type);

-- Представление уже отдаёт instruments.* целиком (i.*), поэтому новое поле
-- в нём появится само — пересоздавать instruments_view не требуется.
