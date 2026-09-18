-- ============================================================
--  Наличие: сколько штук прибора есть и сколько у кого на руках
-- ============================================================
--  Два одинаковых фонаря — это одна карточка и цифра «2», а не две
--  карточки-близнеца. Поверять их не надо, серийные номера никому не
--  нужны, а вот знать, что фонарей два и один уже унесли, — надо.
--
--  ОТКУДА ВЗЯЛАСЬ ОТДЕЛЬНАЯ ТАБЛИЦА
--
--  До сих пор «у кого прибор» хранилось прямо в строке прибора:
--  taken_by, taken_where, taken_at. Одна строка — один держатель. Как
--  только штук становится несколько, держателей тоже может быть
--  несколько, и в одну строку они не помещаются. Поэтому появляется
--  instrument_holdings — «кто сколько держит».
--
--  ЧТО ПРИ ЭТОМ НЕ ЛОМАЕТСЯ
--
--  У прибора с наличием 1 (а это все нынешние приборы) всё остаётся
--  ровно как было: держатель в taken_by, выдача, возврат, бронь,
--  передача, комплекты — ни одна строка кода для них не меняется.
--  Таблица наполняется только у приборов с наличием больше одного.
--  Так сделано намеренно: переводить на новый лад работающий механизм
--  выдачи ради того, чтобы «было единообразно», — значит рисковать тем,
--  что работает каждый день, ради того, что нужно для фонарей.
--
--  СОСТОЯНИЕ У МНОГОШТУЧНОГО ПРИБОРА
--
--  status считается от остатка: есть хоть одна свободная штука — free,
--  все разобраны — busy. taken_by при этом пуст: держателей несколько,
--  и назвать одного из них «тем самым» было бы неправдой. Ради этого
--  ослаблено ограничение целостности — ровно на один случай qty > 1,
--  и только для busy.
--
--  Миграция идемпотентная.
-- ============================================================

ALTER TABLE instruments ADD COLUMN IF NOT EXISTS qty integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'instruments_qty_positive'
  ) THEN
    ALTER TABLE instruments
      ADD CONSTRAINT instruments_qty_positive CHECK (qty >= 1);
  END IF;
END
$$;

COMMENT ON COLUMN instruments.qty IS
  'Наличие: сколько штук этого прибора есть. 1 — обычный прибор.';

-- ---------- Кто сколько держит ----------

CREATE TABLE IF NOT EXISTS instrument_holdings (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  instrument_id bigint  NOT NULL REFERENCES instruments (id) ON DELETE CASCADE,
  user_id       bigint  NOT NULL REFERENCES users (id)       ON DELETE CASCADE,
  qty           integer NOT NULL CHECK (qty >= 1),
  taken_where   text,
  taken_extra   text,
  taken_at      date    NOT NULL DEFAULT current_date,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Один человек — одна запись на прибор. Взял ещё одну штуку — прибавляется
-- к его же строке. Иначе в карточке было бы «Петров — 1 шт» три раза
-- подряд, и никто бы не понял, три это или один.
CREATE UNIQUE INDEX IF NOT EXISTS instrument_holdings_one_per_user
  ON instrument_holdings (instrument_id, user_id);

CREATE INDEX IF NOT EXISTS instrument_holdings_user_idx
  ON instrument_holdings (user_id);

COMMENT ON TABLE instrument_holdings IS
  'Кто сколько штук держит на руках. Заполняется только при наличии > 1.';

-- ---------- Ослабление ограничения ----------
-- Было: busy обязательно с taken_by. Стало: либо taken_by, либо это
-- многоштучный прибор, у которого держатели в instrument_holdings.
ALTER TABLE instruments DROP CONSTRAINT IF EXISTS instruments_state_consistent;
ALTER TABLE instruments ADD CONSTRAINT instruments_state_consistent CHECK (
  CASE status
    WHEN 'busy'    THEN (taken_by IS NOT NULL OR qty > 1)
                        AND booked_by IS NULL AND retired_at IS NULL
    WHEN 'booked'  THEN booked_by IS NOT NULL AND taken_by  IS NULL AND retired_at IS NULL
    WHEN 'free'    THEN taken_by  IS NULL     AND booked_by IS NULL AND retired_at IS NULL
    WHEN 'retired' THEN taken_by  IS NULL     AND booked_by IS NULL AND retired_at IS NOT NULL
  END
);

-- ---------- Представление ----------
-- Пишем i.* — новые колонки подхватываются сами (см. 033).
--
-- Заодно исправлено давнее: taken_by_name и booked_by_name брались из
-- username, то есть карточка прибора показывала ЛОГИН. С тех пор у
-- человека есть имя (миграция 037), и логин должен оставаться делом
-- входа. Здесь он и перестаёт быть виден.
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
) h ON TRUE;
