-- ============================================================
--  Миграция 004: исправление триггера "история только для добавления"
-- ============================================================
--  Была ошибка: правило блокировало ЛЮБОЕ изменение строк history,
--  включая безобидное автоматическое обнуление instrument_id/actor_id,
--  которое сама база делает при удалении прибора или пользователя
--  (внешний ключ ON DELETE SET NULL). Из-за этого удаление прибора,
--  у которого уже есть записи в истории, падало с ошибкой
--  "История доступна только для добавления записей".
--
--  Эта миграция просто заменяет функцию триггера на исправленную версию —
--  саму таблицу и данные в ней трогать не нужно.
--
--  Запуск:
--    docker compose exec -T db psql -U pribory -d pribory < db/004_fix_history_trigger.sql
-- ============================================================

CREATE OR REPLACE FUNCTION history_is_append_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'История доступна только для добавления записей';
  END IF;

  -- Разрешаем ровно один случай: instrument_id и/или actor_id обнулились,
  -- а всё остальное содержимое строки осталось прежним.
  IF TG_OP = 'UPDATE'
     AND NEW.instrument_name IS NOT DISTINCT FROM OLD.instrument_name
     AND NEW.action          IS NOT DISTINCT FROM OLD.action
     AND NEW.actor_name      IS NOT DISTINCT FROM OLD.actor_name
     AND NEW.target_name     IS NOT DISTINCT FROM OLD.target_name
     AND NEW.place           IS NOT DISTINCT FROM OLD.place
     AND NEW.extra           IS NOT DISTINCT FROM OLD.extra
     AND NEW.note            IS NOT DISTINCT FROM OLD.note
     AND NEW.created_at      IS NOT DISTINCT FROM OLD.created_at
     AND (NEW.instrument_id IS NOT DISTINCT FROM OLD.instrument_id OR NEW.instrument_id IS NULL)
     AND (NEW.actor_id      IS NOT DISTINCT FROM OLD.actor_id      OR NEW.actor_id      IS NULL)
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'История доступна только для добавления записей';
END;
$$ LANGUAGE plpgsql;
