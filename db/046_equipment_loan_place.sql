-- Отдельное место использования в снимке выдачи, независимо от проекта.
DO $$ BEGIN LOCK TABLE instruments, instrument_holdings IN SHARE ROW EXCLUSIVE MODE; END $$;
ALTER TABLE equipment_loans ADD COLUMN IF NOT EXISTS place text;

CREATE OR REPLACE FUNCTION equipment_loan_clean_place(raw text, project text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(btrim(CASE
    WHEN project IS NOT NULL AND raw = 'Проект: ' || project THEN ''
    WHEN project IS NOT NULL AND left(raw, length('Проект: ' || project || ' · ')) = 'Проект: ' || project || ' · '
      THEN substr(raw, length('Проект: ' || project || ' · ') + 1)
    ELSE raw END), '');
$$;

CREATE OR REPLACE FUNCTION set_equipment_loan_borrower() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE raw_place text;
BEGIN
  NEW.issued_to_name := COALESCE(NEW.issued_to_name, NEW.holder_name);
  IF NEW.place IS NULL THEN
    IF NEW.source='holding' THEN
      SELECT taken_where INTO raw_place FROM instrument_holdings
        WHERE instrument_id=NEW.instrument_id AND user_id=NEW.holder_id;
    ELSIF NEW.source='legacy' THEN
      SELECT place INTO raw_place FROM history WHERE id=NEW.history_id;
    ELSE
      SELECT taken_where INTO raw_place FROM instruments WHERE id=NEW.instrument_id;
    END IF;
    NEW.place := equipment_loan_clean_place(raw_place, NEW.project_name);
  END IF;
  RETURN NEW;
END $$;

-- Восстанавливаем ранее сохранённое место по событию выдачи; для открытых
-- выдач также можно прочитать текущую карточку/остаток. Не придумываем
-- место старой закрытой выдачи, если его нигде не сохранили.
UPDATE equipment_loans l SET place = equipment_loan_clean_place(COALESCE(
  (SELECT h.place FROM history h WHERE h.id=l.history_id OR
     (h.instrument_id=l.instrument_id AND h.created_at=l.issued_at AND h.action IN ('issue','confirm_booking'))
     ORDER BY h.id LIMIT 1),
  CASE WHEN l.remaining>0 THEN CASE WHEN l.source='holding' THEN
    (SELECT taken_where FROM instrument_holdings WHERE instrument_id=l.instrument_id AND user_id=l.holder_id)
    ELSE (SELECT taken_where FROM instruments WHERE id=l.instrument_id) END END
), l.project_name) WHERE l.place IS NULL;
