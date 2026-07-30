-- ============================================================
--  Единый вход (SSO) между ИСУ и "Учётом оборудования".
--
--  ИСУ и "Учёт оборудования" используют ОДНУ И ТУ ЖЕ базу данных —
--  поэтому вся миграция укладывается в один обычный SQL-скрипт,
--  без каких-либо сетевых ухищрений между контейнерами/базами.
--
--  Личность пользователя (логин/пароль/роль) впредь проверяется по
--  общей таблице users (та же, что уже ведёт "Учёт оборудования").
--  Здесь остаются только СВОИ права ИСУ на разделы (Инструменты/
--  База данных/Дела) — таблица fm_permissions, с настоящим внешним
--  ключом на users(id), раз уж они в одной базе.
--
--  Запуск:
--    cat 008_fm_sso_shared_db.sql | docker compose exec -T db psql -U ${POSTGRES_USER} -d ${POSTGRES_DB}
-- ============================================================

CREATE TABLE IF NOT EXISTS fm_permissions (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  can_tools BOOLEAN NOT NULL DEFAULT false,
  can_db BOOLEAN NOT NULL DEFAULT false,
  can_cases BOOLEAN NOT NULL DEFAULT false
);

-- Переносим права из старых fm_users в fm_permissions, сопоставляя
-- пользователей по логину (без учёта регистра) с общей таблицей users.
DO $$
DECLARE
  fm_row RECORD;
  matched_id INTEGER;
  unmatched_count INTEGER := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fm_users') THEN
    FOR fm_row IN SELECT * FROM fm_users LOOP
      SELECT id INTO matched_id FROM users WHERE lower(username) = lower(fm_row.username);

      IF matched_id IS NOT NULL THEN
        INSERT INTO fm_permissions (user_id, can_tools, can_db, can_cases)
        VALUES (matched_id, fm_row.can_tools, fm_row.can_db, fm_row.can_cases)
        ON CONFLICT (user_id) DO UPDATE SET
          can_tools = EXCLUDED.can_tools, can_db = EXCLUDED.can_db, can_cases = EXCLUDED.can_cases;
        RAISE NOTICE 'Перенесены права ИСУ: "%" -> users.id=%', fm_row.username, matched_id;
      ELSE
        unmatched_count := unmatched_count + 1;
        RAISE WARNING 'Пользователь "%" из ИСУ НЕ найден в "Учёте оборудования" — права не перенесены. Создайте ему аккаунт в "Учёте оборудования" и запустите этот блок заново вручную.', fm_row.username;
      END IF;
    END LOOP;

    IF unmatched_count = 0 THEN
      RAISE NOTICE 'Все пользователи ИСУ успешно сопоставлены.';
    END IF;
  ELSE
    RAISE NOTICE 'Таблица fm_users не найдена — перенос прав пропущен (возможно, уже выполнялся ранее).';
  END IF;
END $$;

-- Перевешиваем персональные права на конкретные папки/файлы ("Дела")
-- со старых fm_users.id на новые users.id.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fm_users') THEN
    ALTER TABLE fm_folder_permissions ADD COLUMN IF NOT EXISTS new_user_id INTEGER;

    UPDATE fm_folder_permissions fp
    SET new_user_id = u.id
    FROM fm_users fu
    JOIN users u ON lower(u.username) = lower(fu.username)
    WHERE fp.user_id = fu.id;

    -- Правила для несопоставленных пользователей (если такие есть) —
    -- удаляем, иначе NOT NULL ниже не даст завершить миграцию. Их можно
    -- будет выдать заново вручную через окно "Доступ" после того, как
    -- у человека появится аккаунт в "Учёте оборудования".
    DELETE FROM fm_folder_permissions WHERE new_user_id IS NULL;

    ALTER TABLE fm_folder_permissions DROP COLUMN user_id;
    ALTER TABLE fm_folder_permissions RENAME COLUMN new_user_id TO user_id;
    ALTER TABLE fm_folder_permissions ALTER COLUMN user_id SET NOT NULL;
    ALTER TABLE fm_folder_permissions
      ADD CONSTRAINT fm_folder_permissions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

    -- Не удаляем — переименовываем как подстраховку.
    ALTER TABLE fm_users RENAME TO fm_users_old;
  END IF;
END $$;
