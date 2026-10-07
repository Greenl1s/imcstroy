-- Обратимое удаление: карточка и связанные данные остаются в базе.
ALTER TABLE instruments ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE instruments ADD COLUMN IF NOT EXISTS deleted_by bigint REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS instruments_deleted_idx ON instruments(deleted_at) WHERE deleted_at IS NOT NULL;

-- Защита также для комплектов и старых клиентов, обходящих экранный список.
CREATE OR REPLACE FUNCTION protect_deleted_instrument() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND (
      NEW.status IN ('busy', 'booked') OR NEW.taken_by IS NOT NULL OR
      NEW.booked_by IS NOT NULL OR NEW.pending_transfer_to IS NOT NULL OR
      EXISTS (SELECT 1 FROM instrument_holdings WHERE instrument_id = NEW.id)) THEN
    RAISE EXCEPTION 'Сначала верните прибор и снимите бронь; удалённый прибор нельзя выдавать' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_deleted_instrument ON instruments;
CREATE TRIGGER protect_deleted_instrument BEFORE UPDATE ON instruments
FOR EACH ROW EXECUTE FUNCTION protect_deleted_instrument();

DROP VIEW IF EXISTS instruments_view;

CREATE VIEW instruments_view AS
SELECT
  i.*,
  COALESCE(NULLIF(btrim(tu.full_name),  ''), tu.username)  AS taken_by_name,
  COALESCE(NULLIF(btrim(bu.full_name),  ''), bu.username)  AS booked_by_name,
  COALESCE(NULLIF(btrim(ptu.full_name), ''), ptu.username) AS pending_transfer_to_name,
  c.name AS company_name,
  (p.instrument_id IS NOT NULL OR i.photo_link_path    IS NOT NULL) AS has_photo,
  (d.instrument_id IS NOT NULL OR i.document_link_path IS NOT NULL) AS has_document,
  -- Сколько штук на руках и сколько свободно. Считается здесь, а не в
  -- коде: два места, считающие одно и то же, рано или поздно разойдутся.
  COALESCE(h.held, 0) AS held_qty,
  i.qty - COALESCE(h.held, 0) AS free_qty,
  COALESCE(h.holders, '[]'::json) AS holders
FROM instruments i
LEFT JOIN users tu  ON tu.id  = i.taken_by
LEFT JOIN users bu  ON bu.id  = i.booked_by
LEFT JOIN users ptu ON ptu.id = i.pending_transfer_to
LEFT JOIN instrument_photos    p ON p.instrument_id = i.id
LEFT JOIN instrument_documents d ON d.instrument_id = i.id
LEFT JOIN companies c ON c.code = i.company_code
LEFT JOIN LATERAL (
  SELECT SUM(ih.qty)::int AS held,
         json_agg(json_build_object(
           'user_id', ih.user_id,
           'name', COALESCE(NULLIF(btrim(hu.full_name), ''), hu.username),
           'qty', ih.qty,
           'taken_where', ih.taken_where,
           'taken_extra', ih.taken_extra,
           'taken_at', ih.taken_at
         ) ORDER BY ih.taken_at, ih.id) AS holders
    FROM instrument_holdings ih
    JOIN users hu ON hu.id = ih.user_id
   WHERE ih.instrument_id = i.id
) h ON TRUE
WHERE i.deleted_at IS NULL;

CREATE OR REPLACE VIEW kits_view AS
SELECT
  k.id,
  k.name,
  k.description,
  k.created_by,
  u.username AS created_by_name,
  k.created_at,
  k.updated_at,
  COUNT(i.id)::int                                             AS total,
  COUNT(*) FILTER (WHERE i.status = 'free')::int               AS free_count,
  COUNT(*) FILTER (WHERE i.status = 'busy')::int               AS busy_count,
  COUNT(*) FILTER (WHERE i.status = 'booked')::int             AS booked_count,
  COUNT(*) FILTER (WHERE i.status = 'retired')::int            AS retired_count,
  -- Приборы, которым нужен метрологический контроль, а срок либо
  -- истёк, либо не заполнен. Списанные не считаем: они и так не едут.
  --
  -- Дата берётся по Москве, а не CURRENT_DATE: контейнер базы живёт
  -- по Гринвичу, и с полуночи до 03:00 МСК CURRENT_DATE — вчерашнее
  -- число. Тогда прибор, у которого поверка кончилась сегодня, ночью
  -- считался бы ещё действующим. Тот же сдвиг в server/src/dates.js.
  COUNT(*) FILTER (
    WHERE i.status <> 'retired'
      AND i.check_type <> 'none'
      AND (i.valid_until IS NULL
           OR i.valid_until < (now() AT TIME ZONE 'Europe/Moscow')::date)
  )::int                                                       AS check_problem_count
FROM kits k
LEFT JOIN users u      ON u.id = k.created_by
LEFT JOIN kit_items ki ON ki.kit_id = k.id
LEFT JOIN instruments i ON i.id = ki.instrument_id AND i.deleted_at IS NULL
GROUP BY k.id, k.name, k.description, k.created_by, u.username, k.created_at, k.updated_at;

