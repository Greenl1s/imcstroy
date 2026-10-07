-- Учёт отдельных выдач. Триггеры работают и при возврате через основной сайт.
-- В режиме psql -1 блокировка сохраняется до завершения миграции,
-- чтобы выдача не попала между заполнением старых записей и созданием триггеров.
DO $$ BEGIN LOCK TABLE instruments, instrument_holdings IN SHARE ROW EXCLUSIVE MODE; END $$;
CREATE TABLE IF NOT EXISTS equipment_loans (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  instrument_id bigint REFERENCES instruments(id) ON DELETE SET NULL,
  instrument_name text NOT NULL,
  inventory_no text,
  model text,
  serial_number text,
  holder_id bigint REFERENCES users(id) ON DELETE SET NULL,
  holder_name text NOT NULL,
  issued_to_name text NOT NULL,
  project_id integer REFERENCES cases(id) ON DELETE SET NULL,
  project_name text,
  quantity integer NOT NULL CHECK (quantity > 0),
  remaining integer NOT NULL CHECK (remaining >= 0 AND remaining <= quantity),
  issue_date date,
  issued_at timestamptz,
  last_returned_at timestamptz,
  returned_at timestamptz,
  source text NOT NULL CHECK (source IN ('instrument','holding','legacy')),
  history_id bigint UNIQUE REFERENCES history(id) ON DELETE SET NULL,
  CHECK ((remaining = 0) = (returned_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS equipment_loans_active_idx ON equipment_loans(instrument_id, holder_id, id) WHERE remaining > 0;
CREATE TABLE IF NOT EXISTS equipment_loan_tracking_start (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton), installed_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO equipment_loan_tracking_start(singleton) VALUES (true) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION set_equipment_loan_borrower() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.issued_to_name := COALESCE(NEW.issued_to_name, NEW.holder_name);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS set_equipment_loan_borrower ON equipment_loans;
CREATE TRIGGER set_equipment_loan_borrower BEFORE INSERT ON equipment_loans
FOR EACH ROW EXECUTE FUNCTION set_equipment_loan_borrower();

CREATE OR REPLACE FUNCTION equipment_loan_open(iid bigint, uid bigint, amount integer, pid integer, day date, moment timestamptz, origin text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO equipment_loans (instrument_id,instrument_name,inventory_no,model,serial_number,
    holder_id,holder_name,project_id,project_name,quantity,remaining,issue_date,issued_at,source)
  SELECT i.id,i.name,i.inventory_no,i.model,i.serial_number,u.id,
    COALESCE(NULLIF(btrim(u.full_name),''),u.username),c.id,c.name,amount,amount,day,moment,origin
  FROM instruments i JOIN users u ON u.id=uid LEFT JOIN cases c ON c.id=pid WHERE i.id=iid;
END $$;

CREATE OR REPLACE FUNCTION equipment_loan_return(iid bigint, uid bigint, amount integer, origin text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE loan record; back integer; needed integer := amount;
BEGIN
  FOR loan IN SELECT id,remaining FROM equipment_loans
      WHERE instrument_id=iid AND holder_id=uid AND source=origin AND remaining>0
      ORDER BY id FOR UPDATE LOOP
    EXIT WHEN needed <= 0;
    back := LEAST(loan.remaining,needed);
    UPDATE equipment_loans SET remaining=remaining-back,last_returned_at=now(),
      returned_at=CASE WHEN remaining=back THEN now() ELSE NULL END WHERE id=loan.id;
    needed := needed-back;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION track_instrument_loans() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status='busy' AND OLD.taken_by IS NOT NULL THEN
    IF NEW.status<>'busy' OR NEW.taken_by IS NULL THEN
      PERFORM equipment_loan_return(OLD.id,OLD.taken_by,1,'instrument');
    ELSIF NEW.taken_by IS DISTINCT FROM OLD.taken_by THEN
      -- Передача не является возвратом на склад: выдача остаётся открытой.
      UPDATE equipment_loans SET holder_id=NEW.taken_by,
        holder_name=(SELECT COALESCE(NULLIF(btrim(full_name),''),username) FROM users WHERE id=NEW.taken_by)
        WHERE instrument_id=NEW.id AND source='instrument' AND remaining>0;
    END IF;
  END IF;
  IF NEW.status='busy' AND NEW.taken_by IS NOT NULL AND
      (OLD.status<>'busy' OR OLD.taken_by IS NULL) THEN
    PERFORM equipment_loan_open(NEW.id,NEW.taken_by,1,NEW.taken_project_id,NEW.taken_at,now(),'instrument');
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION track_holding_loans() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    PERFORM equipment_loan_open(NEW.instrument_id,NEW.user_id,NEW.qty,NEW.project_id,NEW.taken_at,now(),'holding');
    RETURN NEW;
  ELSIF TG_OP='DELETE' THEN
    PERFORM equipment_loan_return(OLD.instrument_id,OLD.user_id,OLD.qty,'holding');
    RETURN OLD;
  ELSIF NEW.qty>OLD.qty THEN
    PERFORM equipment_loan_open(NEW.instrument_id,NEW.user_id,NEW.qty-OLD.qty,NEW.project_id,NEW.taken_at,now(),'holding');
  ELSIF NEW.qty<OLD.qty THEN
    PERFORM equipment_loan_return(OLD.instrument_id,OLD.user_id,OLD.qty-NEW.qty,'holding');
  END IF;
  RETURN NEW;
END $$;

-- Уже открытые выдачи сохраняются. При отсутствии достоверного события
-- не придумываем часы/минуты: оставляем только введённую дату.
INSERT INTO equipment_loans (instrument_id,instrument_name,inventory_no,model,serial_number,
  holder_id,holder_name,project_id,project_name,quantity,remaining,issue_date,issued_at,source)
SELECT i.id,i.name,i.inventory_no,i.model,i.serial_number,u.id,
  COALESCE(NULLIF(btrim(u.full_name),''),u.username),c.id,c.name,1,1,i.taken_at,h.created_at,'instrument'
FROM instruments i JOIN users u ON u.id=i.taken_by LEFT JOIN cases c ON c.id=i.taken_project_id
LEFT JOIN LATERAL (SELECT created_at FROM history WHERE instrument_id=i.id AND action IN ('issue','confirm_booking')
  ORDER BY created_at DESC,id DESC LIMIT 1) h ON true
WHERE i.status='busy' AND i.taken_by IS NOT NULL AND i.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM equipment_loans l WHERE l.instrument_id=i.id AND l.source='instrument' AND l.remaining>0);

INSERT INTO equipment_loans (instrument_id,instrument_name,inventory_no,model,serial_number,
  holder_id,holder_name,project_id,project_name,quantity,remaining,issue_date,issued_at,source)
SELECT i.id,i.name,i.inventory_no,i.model,i.serial_number,u.id,
  COALESCE(NULLIF(btrim(u.full_name),''),u.username),c.id,c.name,h.qty,h.qty,h.taken_at,NULL,'holding'
FROM instrument_holdings h JOIN instruments i ON i.id=h.instrument_id JOIN users u ON u.id=h.user_id
LEFT JOIN cases c ON c.id=h.project_id WHERE i.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM equipment_loans l WHERE l.instrument_id=i.id AND l.holder_id=h.user_id AND l.source='holding' AND l.remaining>0);

-- Завершённые старые выдачи одиночных приборов восстанавливаем только
-- при наличии однозначной пары «выдача — возврат» до следующей выдачи.
INSERT INTO equipment_loans (instrument_id,instrument_name,inventory_no,model,serial_number,
  holder_id,holder_name,project_name,quantity,remaining,issue_date,issued_at,last_returned_at,returned_at,source,history_id)
SELECT i.id,h.instrument_name,i.inventory_no,i.model,i.serial_number,h.actor_id,
  COALESCE(NULLIF(h.target_name,''),h.actor_name),
  CASE WHEN h.place LIKE 'Проект: %' THEN substr(split_part(h.place,' · ',1),9) ELSE NULL END,
  1,0,(h.created_at AT TIME ZONE 'Europe/Moscow')::date,h.created_at,r.created_at,r.created_at,'legacy',h.id
FROM history h JOIN instruments i ON i.id=h.instrument_id AND i.qty=1
JOIN LATERAL (SELECT x.id,x.created_at FROM history x WHERE x.instrument_id=h.instrument_id
  AND (x.created_at,x.id)>(h.created_at,h.id) AND x.action IN ('return','issue','confirm_booking','retire')
  ORDER BY x.created_at,x.id LIMIT 1) r ON true
JOIN history rh ON rh.id=r.id AND rh.action='return'
WHERE h.action='issue' AND h.created_at < (SELECT installed_at FROM equipment_loan_tracking_start WHERE singleton)
ON CONFLICT(history_id) DO NOTHING;

DROP TRIGGER IF EXISTS track_instrument_loans ON instruments;
CREATE TRIGGER track_instrument_loans AFTER UPDATE ON instruments FOR EACH ROW EXECUTE FUNCTION track_instrument_loans();
DROP TRIGGER IF EXISTS track_holding_loans ON instrument_holdings;
CREATE TRIGGER track_holding_loans AFTER INSERT OR UPDATE OR DELETE ON instrument_holdings FOR EACH ROW EXECUTE FUNCTION track_holding_loans();
