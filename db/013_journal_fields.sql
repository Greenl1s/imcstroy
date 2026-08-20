-- ============================================================
--  Поля, нужные для автоматического журнала регистрации —
--  повторяют структуру реального журнала (13 колонок): организация,
--  стороны судебного дела и судья, которых раньше в карточке
--  проекта не было.
-- ============================================================

ALTER TABLE cases ADD COLUMN IF NOT EXISTS organization TEXT;   -- "Структура" — какое юрлицо ведёт проект
ALTER TABLE cases ADD COLUMN IF NOT EXISTS party1 TEXT;          -- "Сторона 1"
ALTER TABLE cases ADD COLUMN IF NOT EXISTS party2 TEXT;          -- "Сторона 2"
ALTER TABLE cases ADD COLUMN IF NOT EXISTS judge_name TEXT;       -- "Судья"
