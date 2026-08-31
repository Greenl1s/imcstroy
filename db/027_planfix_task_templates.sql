-- Справочник типовых задач по стадиям проекта.
--
-- На боевом сервере эта таблица уже есть — она появилась раньше, когда
-- список задач переехал из кода в базу. Здесь мы её НЕ пересоздаём и
-- НЕ трогаем содержимое: миграция нужна, чтобы таблица гарантированно
-- существовала везде (в том числе на чистой базе) и чтобы у неё точно
-- были все поля и ограничения, на которые опирается код.
--
-- Ничего не заполняем нарочно: придумывать за вас список задач нельзя,
-- а на боевом сервере свой список уже наполнен.
CREATE TABLE IF NOT EXISTS planfix_task_templates (
  id       SERIAL PRIMARY KEY,
  stage    TEXT NOT NULL,
  name     TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE planfix_task_templates ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;

-- Одна и та же задача не должна дважды попасть в список одной стадии:
-- код рассчитывает на эту защиту и показывает по ней понятное сообщение
-- («такая задача уже есть»), а не ошибку базы.
CREATE UNIQUE INDEX IF NOT EXISTS planfix_task_templates_stage_name_uidx
  ON planfix_task_templates (stage, lower(btrim(name)));

CREATE INDEX IF NOT EXISTS planfix_task_templates_stage_idx
  ON planfix_task_templates (stage, position, id);
