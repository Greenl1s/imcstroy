-- ============================================================
--  Автоматизация делопроизводства по экспертизам и НИ (ИСУ).
--
--  Таблица "дел" — экспертиз и независимых исследований, проходящих
--  по стадиям согласно рабочей инструкции. Это и есть будущий "живой"
--  журнал регистрации: одна строка = один проект.
--
--  Стадия (stage) — где физически находится папка проекта:
--    plan    -> 01. Планы
--    active  -> 02. Активные проекты
--    control -> 03. Проекты на контроле
--    done    -> 04. Архив/Завершённые (проект архивирован как завершённый)
--
--  Отмена — НЕ стадия, а отдельный флаг (is_cancelled), потому что по
--  инструкции отменить можно с любой стадии, а факт отмены и сама
--  стадия, на которой это произошло, — разные вещи для истории.
--  Отменённый проект физически уезжает в 04. Архив/Отменённые.
-- ============================================================

CREATE TABLE IF NOT EXISTS cases (
  id SERIAL PRIMARY KEY,

  type TEXT NOT NULL CHECK (type IN ('expertise', 'research')), -- ЭКС / НИ
  name TEXT NOT NULL UNIQUE,   -- полное условное наименование, напр. "ЭКС.Сколково"

  stage TEXT NOT NULL DEFAULT 'plan' CHECK (stage IN ('plan', 'active', 'control', 'done')),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'problem')),

  is_cancelled BOOLEAN NOT NULL DEFAULT false,
  cancel_reason TEXT,

  court_or_customer TEXT,   -- суд/заказчик
  case_number TEXT,         -- номер дела/договора
  manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- руководитель
  experts TEXT,             -- эксперты (свободный текст на первом этапе)
  year INTEGER,
  description TEXT,

  folder_path TEXT,         -- актуальный путь к папке проекта в ИСУ

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cases_stage ON cases(stage);
CREATE INDEX IF NOT EXISTS idx_cases_type ON cases(type);
CREATE INDEX IF NOT EXISTS idx_cases_manager ON cases(manager_id);

-- История — движения по стадиям и ключевые изменения. Это "сырой" журнал,
-- поверх которого потом строится читаемый экран.
CREATE TABLE IF NOT EXISTS case_history (
  id SERIAL PRIMARY KEY,
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  action TEXT NOT NULL,      -- created / stage_changed / cancelled / updated
  from_stage TEXT,
  to_stage TEXT,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_history_case ON case_history(case_id);
