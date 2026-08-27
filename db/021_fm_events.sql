-- ============================================================
--  Лента событий файлового менеджера.
--
--  Пишем сюда всё, что меняет содержимое: загрузку, создание,
--  переименование, перемещение, удаление, восстановление, смену стадии
--  проекта. Из этой же таблицы строится раздел "Последние" — отдельно
--  обходить диск не нужно.
--
--  actor_name — снимок имени на момент события: если сотрудника потом
--  удалят из системы, в истории всё равно останется видно, кто это был.
-- ============================================================

CREATE TABLE IF NOT EXISTS fm_events (
  id BIGSERIAL PRIMARY KEY,
  actor_id INT,
  actor_name TEXT,
  action TEXT NOT NULL,
  target_path TEXT,
  target_name TEXT,
  is_dir BOOLEAN NOT NULL DEFAULT false,
  -- подробности, зависящие от действия: старое имя при переименовании,
  -- откуда/куда при перемещении, стадия проекта и т.п.
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fm_events_created_idx ON fm_events (created_at DESC);
CREATE INDEX IF NOT EXISTS fm_events_action_idx ON fm_events (action);
CREATE INDEX IF NOT EXISTS fm_events_actor_idx ON fm_events (actor_id);
-- Для раздела "Последние": быстро находим последнее событие по каждому файлу.
CREATE INDEX IF NOT EXISTS fm_events_path_idx ON fm_events (target_path, created_at DESC);
