-- Завершение задач прямо из ИСУ.
--
-- Храним числовой статус задачи (он нужен, чтобы понять, каким статусом
-- Planfix помечает завершение) и отметку о том, кто и когда завершил
-- задачу у нас.
ALTER TABLE case_tasks ADD COLUMN IF NOT EXISTS status_id INTEGER;
ALTER TABLE case_tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE case_tasks ADD COLUMN IF NOT EXISTS completed_by INTEGER;

CREATE INDEX IF NOT EXISTS case_tasks_open_idx ON case_tasks (is_done, end_date);

-- Фильтр "Мои задачи" сравнивает исполнителя из Planfix с человеком в ИСУ.
-- Логин у нас латиницей ("kirill"), а в Planfix стоит полное имя
-- ("Кирилл Базаев") — совпасть они не могут, поэтому имя указывается явно.
ALTER TABLE users ADD COLUMN IF NOT EXISTS planfix_name TEXT;
