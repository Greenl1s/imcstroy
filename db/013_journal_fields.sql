-- ============================================================
--  Поля, нужные для автоматического журнала регистрации —
--  повторяют структуру реального журнала (13 колонок): организация,
--  стороны судебного дела и судья, которых раньше в карточке
--  проекта не было.
-- ============================================================

--  Файлы из этой папки выполняются по алфавиту, поэтому при развёртывании
--  с нуля этот файл попадает СЮДА — раньше 014_cases_schema.sql, который
--  создаёт саму таблицу cases. Тогда делать нечего: те же колонки заведёт
--  014, он их добавляет сам. На уже работающей базе таблица есть, и файл
--  отрабатывает как раньше.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cases') THEN
    RAISE NOTICE 'Таблицы cases ещё нет — поля журнала заведёт 014_cases_schema.sql';
    RETURN;
  END IF;

  ALTER TABLE cases ADD COLUMN IF NOT EXISTS organization TEXT;   -- "Структура" — какое юрлицо ведёт проект
  ALTER TABLE cases ADD COLUMN IF NOT EXISTS party1 TEXT;         -- "Сторона 1"
  ALTER TABLE cases ADD COLUMN IF NOT EXISTS party2 TEXT;         -- "Сторона 2"
  ALTER TABLE cases ADD COLUMN IF NOT EXISTS judge_name TEXT;     -- "Судья"
END $$;
