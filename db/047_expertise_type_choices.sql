-- Переносим существовавшие в форме ГП виды в общий справочник базы.
-- Не удаляем пользовательские виды и не изменяем проекты.
INSERT INTO fm_lookups (kind, value)
SELECT 'expertise_type', value
FROM (VALUES
  ('Строительно-техническая'),
  ('Пожарно-техническая'),
  ('Землеустроительная'),
  ('Почерковедческая')
) AS defaults(value)
WHERE NOT EXISTS (
  SELECT 1 FROM fm_lookups existing
  WHERE existing.kind = 'expertise_type'
    AND lower(btrim(existing.value)) = lower(defaults.value)
)
ON CONFLICT DO NOTHING;
