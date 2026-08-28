-- Импорт проектов и задач из Planfix.
--
-- 1. У проекта появляются поля, которые ведутся в Planfix: тип экспертизы
--    и отметка о последней успешной сверке.
-- 2. Задачи проекта живут в отдельной таблице: Planfix остаётся источником
--    правды, мы держим у себя их зеркало, чтобы показывать на карточке
--    проекта без похода в чужой API на каждый клик.

ALTER TABLE cases ADD COLUMN IF NOT EXISTS expertise_type TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS planfix_synced_at TIMESTAMPTZ;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS planfix_tasks_synced_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS cases_planfix_id_key
  ON cases (planfix_id) WHERE planfix_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS case_tasks (
  id SERIAL PRIMARY KEY,
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  planfix_id BIGINT NOT NULL,
  name TEXT NOT NULL,
  status_name TEXT,
  is_done BOOLEAN NOT NULL DEFAULT false,
  assignees TEXT,
  assigner TEXT,
  start_date DATE,
  end_date DATE,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS case_tasks_planfix_id_key ON case_tasks (planfix_id);
CREATE INDEX IF NOT EXISTS case_tasks_case_idx ON case_tasks (case_id, is_done);

-- Отчёты о запусках сверки: видно, когда синхронизировались в последний
-- раз и что именно тогда произошло.
CREATE TABLE IF NOT EXISTS planfix_sync_runs (
  id SERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  trigger TEXT NOT NULL DEFAULT 'manual',
  ok BOOLEAN,
  report JSONB,
  error TEXT
);
