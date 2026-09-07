-- ============================================================
--  Комплекты приборов
-- ============================================================
--  Комплект — сохранённый список приборов, который берётся одной
--  кнопкой. Это ШАБЛОН, а не коробка: приборы продолжают жить
--  обычной жизнью, их видно в общем списке, их можно брать
--  поштучно, статус у каждого свой.
--
--  Один прибор может входить в сколько угодно комплектов.
--  Физически он один, поэтому если его взяли в одном комплекте —
--  в остальных он покажется занятым и в выдачу не попадёт.
--  Своего состояния у комплекта нет вообще: оно каждый раз
--  считается из статусов входящих приборов. Поэтому здесь
--  нет ни одного поля вроде "выдан"/"на руках" — такое поле
--  неизбежно разошлось бы с действительностью.
--
--  В таблицу instruments не добавляется ни одного столбца,
--  instruments_view не трогается. Всё, что работало раньше,
--  продолжает работать точно так же.
--
--  Миграция идемпотентная: повторный запуск ничего не ломает.
-- ============================================================

CREATE TABLE IF NOT EXISTS kits (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text NOT NULL CHECK (length(btrim(name)) > 0),
  description text NOT NULL DEFAULT '',

  -- Кто собрал. Комплекты общие: видит и берёт любой сотрудник,
  -- править состав тоже может любой. Это поле — только подпись
  -- «собрал Иванов», никаких прав оно не даёт.
  -- Удалили пользователя — комплект остаётся, подпись обнуляется.
  created_by  bigint REFERENCES users (id) ON DELETE SET NULL,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Название уникально без учёта регистра и лишних пробелов:
-- «Выезд на трубопровод» и «выезд на трубопровод» — один комплект.
-- Иначе в списке заводятся близнецы, и человек берёт не тот.
CREATE UNIQUE INDEX IF NOT EXISTS kits_name_key ON kits (lower(btrim(name)));

-- ---------- Состав комплекта ----------
-- Составной первичный ключ = один прибор не может попасть
-- в один комплект дважды, даже если очень постараться.

CREATE TABLE IF NOT EXISTS kit_items (
  kit_id        bigint NOT NULL REFERENCES kits (id)        ON DELETE CASCADE,
  instrument_id bigint NOT NULL REFERENCES instruments (id) ON DELETE CASCADE,
  position      int    NOT NULL DEFAULT 0,   -- порядок в списке, задаётся при добавлении
  added_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kit_id, instrument_id)
);

-- Удалили прибор — он сам исчезает из всех комплектов (CASCADE выше).
-- Удалили комплект — исчезает только его состав, приборы не трогаются.

-- Обратный поиск: в какие комплекты входит этот прибор.
-- Нужен для карточки прибора и для проверки перед удалением.
CREATE INDEX IF NOT EXISTS kit_items_instrument_idx ON kit_items (instrument_id);

-- ---------- updated_at ----------
-- Функция touch_updated_at() уже есть (001_schema.sql).
-- CREATE TRIGGER не умеет IF NOT EXISTS в Postgres 16, поэтому
-- проверяем сами — иначе повторный запуск миграции упадёт.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'kits_touch' AND tgrelid = 'kits'::regclass
  ) THEN
    CREATE TRIGGER kits_touch BEFORE UPDATE ON kits
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
END $$;

-- ---------- Представление для списка комплектов ----------
-- Отдаёт комплект вместе со счётчиками, посчитанными из текущих
-- статусов приборов. Ровно то, что показывается в списке:
-- «5 приборов, 4 на руках», «2 без поверки».
--
-- Пересоздаём через DROP: если у представления менялся набор
-- столбцов, CREATE OR REPLACE VIEW падает с ошибкой.

DROP VIEW IF EXISTS kits_view;
CREATE VIEW kits_view AS
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
LEFT JOIN instruments i ON i.id = ki.instrument_id
GROUP BY k.id, k.name, k.description, k.created_by, u.username, k.created_at, k.updated_at;
