-- ============================================================
--  fm_permissions: внешний ключ на users, которого там не оказалось.
--
--  Что случилось. Миграция 007 создавала fm_permissions БЕЗ внешнего
--  ключа (тогда ИСУ и «Учёт приборов» жили в разных базах, и сослаться
--  было не на что). Миграция 008 создаёт ту же таблицу уже С ключом,
--  но написана как CREATE TABLE IF NOT EXISTS — а таблица к тому моменту
--  уже существовала, поэтому её тело просто не выполнилось. Ключ так
--  и не появился.
--
--  Чем это плохо. Соседняя таблица fm_folder_permissions ключ получила
--  (008 добавляет его отдельным ALTER), и при удалении сотрудника его
--  персональные права на папки исчезают. А строка в fm_permissions
--  остаётся висеть без хозяина. Две половины одних и тех же прав ведут
--  себя по-разному — а это ровно тот случай, когда потом полдня ищешь,
--  почему «у уволенного всё ещё что-то есть».
--
--  Что делает этот файл: убирает уже накопившиеся строки без хозяина
--  и ставит ключ, если его нет. Если ключ уже есть — не делает ничего.
--
--  Запуск:
--    cat db/031_fm_permissions_fk.sql | docker compose exec -T db psql -U pribory -d pribory
-- ============================================================

-- 1. Строки, чьих пользователей уже нет. Показываем, что удаляем, —
--    чтобы это не прошло незамеченным в логе.
DO $$
DECLARE
  orphans INTEGER;
BEGIN
  SELECT count(*) INTO orphans
    FROM fm_permissions p
   WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = p.user_id);

  IF orphans > 0 THEN
    RAISE NOTICE 'Удаляю % строк(и) прав ИСУ, у которых больше нет пользователя', orphans;
    DELETE FROM fm_permissions p
     WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = p.user_id);
  ELSE
    RAISE NOTICE 'Прав без хозяина не найдено';
  END IF;
END $$;

-- 2. Сам внешний ключ — только если его ещё нет.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'fm_permissions'::regclass
       AND contype = 'f'
       AND confrelid = 'users'::regclass
  ) THEN
    ALTER TABLE fm_permissions
      ADD CONSTRAINT fm_permissions_user_fk
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    RAISE NOTICE 'Внешний ключ fm_permissions -> users добавлен';
  ELSE
    RAISE NOTICE 'Внешний ключ уже был на месте — ничего не меняю';
  END IF;
END $$;
