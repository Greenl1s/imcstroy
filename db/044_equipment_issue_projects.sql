ALTER TABLE instruments ADD COLUMN IF NOT EXISTS taken_project_id integer REFERENCES cases(id) ON DELETE SET NULL;
ALTER TABLE instrument_holdings ADD COLUMN IF NOT EXISTS project_id integer REFERENCES cases(id) ON DELETE SET NULL;
DO $$
DECLARE definition text;
BEGIN
  SELECT pg_get_viewdef('instruments_view'::regclass, true) INTO definition;
  definition := regexp_replace(definition, ';\s*$', '');
  -- Данные выдачи для будущих интерфейсов; текущее место уже содержит название проекта.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='instruments_view' AND column_name='taken_project_id') THEN
    EXECUTE 'CREATE OR REPLACE VIEW instruments_view AS SELECT v.*, i.taken_project_id FROM (' || definition || ') v JOIN instruments i ON i.id=v.id';
  END IF;
END $$;
