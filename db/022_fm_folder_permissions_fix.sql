-- Персональный доступ к папкам внутри "Дела".
-- Приводит таблицу в рабочий вид независимо от того, в каком она сейчас
-- состоянии: создаёт, если её нет, добавляет недостающие столбцы и
-- уникальность (path, user_id) — без неё запрос "выдать доступ"
-- (INSERT ... ON CONFLICT) падал с ошибкой.

CREATE TABLE IF NOT EXISTS fm_folder_permissions (
  id SERIAL PRIMARY KEY,
  path TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  access TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fm_folder_permissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Правила пользователей, которых уже нет, только мешают.
DELETE FROM fm_folder_permissions fp
 WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = fp.user_id);

-- Дубли по (папка, пользователь) — оставляем самое свежее правило,
-- иначе уникальный индекс не создастся.
DELETE FROM fm_folder_permissions a
 USING fm_folder_permissions b
 WHERE a.id < b.id AND a.path = b.path AND a.user_id = b.user_id;

CREATE UNIQUE INDEX IF NOT EXISTS fm_folder_permissions_path_user_key
  ON fm_folder_permissions (path, user_id);

CREATE INDEX IF NOT EXISTS fm_folder_permissions_user_idx
  ON fm_folder_permissions (user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'fm_folder_permissions'::regclass AND conname = 'fm_folder_permissions_access_check'
  ) THEN
    ALTER TABLE fm_folder_permissions
      ADD CONSTRAINT fm_folder_permissions_access_check
      CHECK (access IN ('read', 'write', 'none'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'fm_folder_permissions'::regclass AND contype = 'f'
  ) THEN
    ALTER TABLE fm_folder_permissions
      ADD CONSTRAINT fm_folder_permissions_user_fk
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;
