-- Вопросы из запроса относятся к проекту, а не к отдельному ГП.
-- JSONB сохраняет порядок и позволяет хранить каждый вопрос отдельно.
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS questions JSONB NOT NULL DEFAULT '[]'::jsonb;

