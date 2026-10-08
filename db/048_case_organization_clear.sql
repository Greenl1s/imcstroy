-- Явное «не указано» в ИСУ не должно заменяться старым значением Planfix.
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS organization_cleared_locally boolean NOT NULL DEFAULT false;
