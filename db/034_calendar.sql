-- ============================================================
--  Календарь
--
--  Третий сервис на той же базе. Своих пользователей не заводит:
--  и ИСУ, и «Учёт», и календарь смотрят в одну таблицу users, вход
--  общий (одна cookie sso_token, один JWT_SECRET). Поэтому здесь
--  только две таблицы — сами дела и участники встреч.
--
--  Время хранится как дата + минуты от полуночи, а не как timestamp.
--  Причина простая: планёрка в 09:30 — это 09:30 по настенным часам
--  в Москве, а не момент времени, который надо пересчитывать в UTC
--  и обратно. Так дата не может «уехать» на день, как это уже
--  случалось в «Учёте» до перехода на московские даты.
--
--  start_min IS NULL — дело без времени («забрать тахеометр»).
--  Такие дела висят отдельной строкой над часами и не участвуют
--  в проверке занятости: они никого не занимают.
-- ============================================================

CREATE TABLE IF NOT EXISTS cal_events (
  id           BIGSERIAL PRIMARY KEY,
  owner_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  note         TEXT NOT NULL DEFAULT '',
  place        TEXT NOT NULL DEFAULT '',
  event_date   DATE NOT NULL,
  start_min    INT,
  end_min      INT,
  kind         TEXT NOT NULL DEFAULT 'task',
  done_at      TIMESTAMPTZ,
  -- Повторы разворачиваются в отдельные строки при создании, а не
  -- вычисляются при чтении. Так перенос или отметка одного дня —
  -- это обычное изменение одной строки, без слоя исключений из
  -- правила. Вся серия связана общим series_id.
  series_id    BIGINT,
  repeat_rule  TEXT NOT NULL DEFAULT 'none',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT cal_events_kind_chk CHECK (kind IN ('task', 'meeting')),
  CONSTRAINT cal_events_repeat_chk CHECK (repeat_rule IN ('none', 'daily', 'weekdays', 'weekly', 'monthly')),
  -- Либо оба конца времени заданы, либо ни одного.
  CONSTRAINT cal_events_time_chk CHECK (
    (start_min IS NULL AND end_min IS NULL) OR
    (start_min IS NOT NULL AND end_min IS NOT NULL
     AND start_min >= 0 AND end_min <= 1440 AND end_min > start_min)
  )
);

CREATE INDEX IF NOT EXISTS cal_events_owner_date_idx ON cal_events (owner_id, event_date);
CREATE INDEX IF NOT EXISTS cal_events_series_idx ON cal_events (series_id);

-- Участники встречи. Владелец в этой таблице не дублируется: он и так
-- owner_id. Строка здесь означает «эта встреча стоит и в его календаре».
CREATE TABLE IF NOT EXISTS cal_event_guests (
  event_id BIGINT NOT NULL REFERENCES cal_events(id) ON DELETE CASCADE,
  user_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS cal_event_guests_user_idx ON cal_event_guests (user_id);

-- Одно дело человека — со всеми, кого оно касается, одной строкой.
-- Списком участников удобнее пользоваться, чем джойном на каждый запрос.
CREATE OR REPLACE VIEW cal_events_view AS
SELECT
  e.*,
  u.username AS owner_name,
  COALESCE(
    (SELECT json_agg(json_build_object('id', g.user_id, 'username', gu.username) ORDER BY gu.username)
       FROM cal_event_guests g
       JOIN users gu ON gu.id = g.user_id
      WHERE g.event_id = e.id),
    '[]'::json
  ) AS guests
FROM cal_events e
JOIN users u ON u.id = e.owner_id;
