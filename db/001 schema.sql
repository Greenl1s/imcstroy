
-- ============================================================
--  Учёт приборов — схема базы данных
--  PostgreSQL 16+
-- ============================================================
--  Принципы:
--   * Все идентификаторы генерирует база (никаких ручных ID и
--     хаков с префиксом '0' для списанных).
--   * Списание — это статус, а не отдельная таблица.
--   * История — журнал событий, только добавление (append-only).
--     Ничего никогда не удаляется и не переписывается.
--   * Пароли хранятся только в виде bcrypt-хэша.
--   * Фото лежат отдельной таблицей, чтобы список приборов
--     не тащил мегабайты картинок при каждой загрузке.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- быстрый поиск по подстроке

-- ---------- Справочные типы ----------

CREATE TYPE user_role         AS ENUM ('admin', 'employee');
CREATE TYPE instrument_status AS ENUM ('free', 'busy', 'booked', 'retired');
CREATE TYPE check_type        AS ENUM ('verification', 'calibration'); -- поверка / калибровка

-- Что именно произошло с прибором (для журнала)
CREATE TYPE history_action AS ENUM (
  'create', 'update', 'delete',
  'issue', 'return', 'transfer',
  'book', 'cancel_booking', 'confirm_booking',
  'retire', 'restore'
);

-- ---------- Пользователи ----------

CREATE TABLE users (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username      text        NOT NULL,
  password_hash text        NOT NULL,          -- bcrypt, НИКОГДА не отдаётся наружу
  role          user_role   NOT NULL DEFAULT 'employee',
  extra         text        NOT NULL DEFAULT '', -- телефон, email и т.п.
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Логин уникален без учёта регистра: Ivanov и ivanov — один человек
CREATE UNIQUE INDEX users_username_key ON users (lower(username));

-- ---------- Приборы ----------

CREATE TABLE instruments (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- Инвентарный номер: то, что написано на наклейке.
  -- Необязателен; если пуст, в интерфейсе показывается #id.
  inventory_no      text,

  name              text              NOT NULL CHECK (length(btrim(name)) > 0),
  serial_number     text,
  model             text,
  check_type        check_type        NOT NULL DEFAULT 'verification',
  verification_date date,                        -- когда поверяли
  valid_until       date,                        -- до какого числа действует
  comment           text              NOT NULL DEFAULT '',

  status            instrument_status NOT NULL DEFAULT 'free',

  -- Кто держит прибор на руках (заполнено только при status = 'busy')
  taken_by          bigint REFERENCES users (id) ON DELETE SET NULL,
  taken_where       text,
  taken_extra       text,
  taken_at          date,

  -- Кто забронировал (заполнено только при status = 'booked')
  booked_by         bigint REFERENCES users (id) ON DELETE SET NULL,
  booked_for        date,                        -- на какую дату бронь
  booked_extra      text,

  retired_at        date,                        -- заполнено только при status = 'retired'

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- База сама следит за тем, чтобы состояние было непротиворечивым.
  -- Прибор не может быть «свободен» и одновременно числиться за Ивановым.
  CONSTRAINT instruments_state_consistent CHECK (
    CASE status
      WHEN 'busy'    THEN taken_by  IS NOT NULL AND booked_by IS NULL AND retired_at IS NULL
      WHEN 'booked'  THEN booked_by IS NOT NULL AND taken_by  IS NULL AND retired_at IS NULL
      WHEN 'free'    THEN taken_by  IS NULL     AND booked_by IS NULL AND retired_at IS NULL
      WHEN 'retired' THEN taken_by  IS NULL     AND booked_by IS NULL AND retired_at IS NOT NULL
    END
  ),
  -- Дата поверки не может быть позже даты окончания её действия
  CONSTRAINT instruments_dates_sane CHECK (
    verification_date IS NULL OR valid_until IS NULL OR verification_date <= valid_until
  )
);

CREATE UNIQUE INDEX instruments_inventory_no_key
  ON instruments (inventory_no) WHERE inventory_no IS NOT NULL AND inventory_no <> '';

CREATE INDEX instruments_status_idx      ON instruments (status);
CREATE INDEX instruments_valid_until_idx ON instruments (valid_until);
CREATE INDEX instruments_taken_by_idx    ON instruments (taken_by)  WHERE taken_by  IS NOT NULL;
CREATE INDEX instruments_booked_by_idx   ON instruments (booked_by) WHERE booked_by IS NOT NULL;

-- Поиск по названию / серийнику / модели без полного перебора таблицы
CREATE INDEX instruments_search_idx ON instruments
  USING gin ((coalesce(name, '') || ' ' || coalesce(serial_number, '') || ' ' ||
              coalesce(model, '') || ' ' || coalesce(inventory_no, '')) gin_trgm_ops);

-- ---------- Фотографии ----------
-- Отдельная таблица: тяжёлые данные не мешают выборке списка.
-- Одно фото на прибор (id прибора = первичный ключ).

CREATE TABLE instrument_photos (
  instrument_id bigint PRIMARY KEY REFERENCES instruments (id) ON DELETE CASCADE,
  mime_type     text        NOT NULL,
  bytes         bytea       NOT NULL,
  size_bytes    int         NOT NULL,
  uploaded_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT photo_size_limit CHECK (size_bytes <= 5 * 1024 * 1024) -- 5 МБ
);

-- ---------- Фото документа (замена «ссылки на документ») ----------
-- Отдельная таблица, а не то же поле, что фото прибора: это два разных
-- изображения — сам прибор и скан/фото документа поверки.

CREATE TABLE instrument_documents (
  instrument_id bigint PRIMARY KEY REFERENCES instruments (id) ON DELETE CASCADE,
  mime_type     text        NOT NULL,
  bytes         bytea       NOT NULL,
  size_bytes    int         NOT NULL,
  uploaded_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_size_limit CHECK (size_bytes <= 5 * 1024 * 1024) -- 5 МБ
);

-- ---------- История (журнал событий) ----------
-- Только INSERT. Строки не обновляются и не удаляются никогда.
-- Имена сохраняются копией: если прибор или пользователя удалят,
-- запись в журнале останется читаемой.

CREATE TABLE history (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  instrument_id   bigint REFERENCES instruments (id) ON DELETE SET NULL,
  instrument_name text           NOT NULL,
  action          history_action NOT NULL,

  actor_id        bigint REFERENCES users (id) ON DELETE SET NULL,
  actor_name      text           NOT NULL,   -- кто нажал кнопку
  target_name     text,                      -- кому выдали / кому передали

  place           text,                      -- место использования
  extra           text,
  note            text,                      -- человекочитаемое описание

  created_at      timestamptz    NOT NULL DEFAULT now()
);

CREATE INDEX history_instrument_idx ON history (instrument_id, created_at DESC);
CREATE INDEX history_created_idx    ON history (created_at DESC);

-- ---------- Автоматическое обновление updated_at ----------

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER instruments_touch BEFORE UPDATE ON instruments
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER users_touch BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ---------- Защита журнала от изменений ----------
-- Даже если кто-то из разработчиков случайно напишет UPDATE history,
-- база не даст этого сделать.

CREATE OR REPLACE FUNCTION history_is_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'История доступна только для добавления записей';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER history_no_update BEFORE UPDATE OR DELETE ON history
  FOR EACH ROW EXECUTE FUNCTION history_is_append_only();

-- ---------- Удобное представление для списка ----------
-- Отдаёт прибор вместе с именами пользователей и признаком наличия фото,
-- но без самих байтов фотографии.

CREATE VIEW instruments_view AS
SELECT
  i.*,
  tu.username AS taken_by_name,
  bu.username AS booked_by_name,
  (p.instrument_id IS NOT NULL) AS has_photo,
  (d.instrument_id IS NOT NULL) AS has_document
FROM instruments i
LEFT JOIN users tu ON tu.id = i.taken_by
LEFT JOIN users bu ON bu.id = i.booked_by
LEFT JOIN instrument_photos p ON p.instrument_id = i.id
LEFT JOIN instrument_documents d ON d.instrument_id = i.id;
