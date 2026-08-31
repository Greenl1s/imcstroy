-- Связь "пользователь ИСУ ↔ сотрудник Planfix".
--
-- До этого фильтр "Мои задачи" сравнивал СТРОКИ: имя из Planfix
-- ("Кирилл Базаев") с тем, что человек однажды выбрал руками. Это ломалось
-- от однофамильцев, от переименования сотрудника в Planfix и от лишнего
-- пробела. Теперь связь хранится по числовому id, а имена нужны только
-- чтобы показать их человеку.

-- Справочник сотрудников Planfix. Это кэш: он нужен, чтобы админ мог
-- выбрать человека из списка, даже когда Planfix недоступен, и чтобы не
-- дёргать их API на каждое открытие страницы.
CREATE TABLE IF NOT EXISTS planfix_people (
  id         INTEGER PRIMARY KEY,          -- id пользователя в Planfix
  name       TEXT NOT NULL,
  email      TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  synced_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Привязка. Один сотрудник Planfix — не больше чем к одному аккаунту ИСУ,
-- иначе "кто поставил задачу" перестанет быть однозначным.
ALTER TABLE users ADD COLUMN IF NOT EXISTS planfix_user_id  INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS planfix_bound_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS planfix_bound_by INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS users_planfix_user_id_uidx
  ON users (planfix_user_id) WHERE planfix_user_id IS NOT NULL;

-- Исполнители и постановщик задачи — тоже по id, а не только строкой.
-- Строки (assignees/assigner) остаются: их удобно показывать, и они
-- переживают удаление человека из Planfix.
ALTER TABLE case_tasks ADD COLUMN IF NOT EXISTS assignee_ids INTEGER[];
ALTER TABLE case_tasks ADD COLUMN IF NOT EXISTS assigner_id  INTEGER;
ALTER TABLE case_tasks ADD COLUMN IF NOT EXISTS description  TEXT;

CREATE INDEX IF NOT EXISTS case_tasks_assignee_ids_idx ON case_tasks USING GIN (assignee_ids);
CREATE INDEX IF NOT EXISTS case_tasks_assigner_idx     ON case_tasks (assigner_id);

-- Журнал того, что ИСУ отправляла в Planfix. Нужен, когда придётся
-- отвечать на вопрос "кто это завершил" или "почему задача не создалась":
-- в Planfix всё уйдёт под служебным токеном, и без этого журнала следов
-- конкретного человека у нас не останется.
CREATE TABLE IF NOT EXISTS planfix_actions (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER,      -- кто в ИСУ
  planfix_user_id  INTEGER,      -- от чьего имени ушло в Planfix
  action           TEXT NOT NULL,-- create | complete | comment | update | bind | unbind
  task_id          INTEGER,      -- наш case_tasks.id, если он уже есть
  planfix_task_id  INTEGER,
  case_id          INTEGER,
  payload          JSONB,
  ok               BOOLEAN NOT NULL,
  error            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS planfix_actions_created_idx ON planfix_actions (created_at DESC);
CREATE INDEX IF NOT EXISTS planfix_actions_user_idx    ON planfix_actions (user_id, created_at DESC);
