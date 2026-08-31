-- Тип проекта может быть не задан.
--
-- В списке проектов есть три группы: «Экспертизы», «Независимые
-- исследования» и «Прочее». Первые две — это type = 'expertise' и
-- 'research', а «Прочее» до сих пор было состоянием, которое негде
-- хранить: колонка объявлена NOT NULL. Из-за этого проект, у которого
-- тип не распознан, нельзя было ни завести, ни поправить в карточке.
--
-- Существующие строки не меняются: у всех у них тип уже проставлен.
ALTER TABLE cases ALTER COLUMN type DROP NOT NULL;

-- И заодно защита от опечаток: кроме двух известных значений и пустого
-- (это и есть «Прочее»), в колонку ничего не попадёт.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cases_type_known'
  ) THEN
    ALTER TABLE cases
      ADD CONSTRAINT cases_type_known
      CHECK (type IS NULL OR type IN ('expertise', 'research'));
  END IF;
END $$;
