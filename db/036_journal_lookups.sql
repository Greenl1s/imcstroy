-- ============================================================
--  Справочники журнала регистрации.
--
--  Столбцы «Тип экспертизы» и «Год» раньше заполнялись руками, каждый
--  по-своему: «строительно-техническая», «Строительно-техническая»,
--  «стр.-техническая» — для человека одно и то же, для фильтра и
--  выгрузки три разных значения. Теперь их выбирают из списка, а список
--  ведёт администратор.
--
--  Одна таблица на все списки, а не таблица на каждый: списки простые
--  (имя и порядок), и заводить под каждый свою миграцию значит не
--  завести ни одной.
--
--  «Структура» сюда НЕ переезжает: у неё уже есть своя таблица
--  organizations, на которую ссылается cases.organization. Переносить
--  её значило бы ломать связь ради единообразия — на экране разницы
--  всё равно не видно.
-- ============================================================

CREATE TABLE IF NOT EXISTS fm_lookups (
  -- Какой это список: expertise_type | year
  kind       TEXT NOT NULL,
  value      TEXT NOT NULL,
  -- Порядок на экране. Годы сортируются числом, остальное — по-русски,
  -- поэтому позиция нужна только чтобы поднять частое наверх.
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (kind, value)
);

-- Наполняем тем, что уже вписано в проектах: иначе после обновления
-- половина журнала показывала бы значения, которых «нет в списке», и
-- поправить их стало бы нечем.
INSERT INTO fm_lookups (kind, value)
SELECT DISTINCT 'expertise_type', btrim(expertise_type)
  FROM cases
 WHERE expertise_type IS NOT NULL AND btrim(expertise_type) <> ''
ON CONFLICT DO NOTHING;

INSERT INTO fm_lookups (kind, value)
SELECT DISTINCT 'year', btrim(year::text)
  FROM cases
 WHERE year IS NOT NULL AND btrim(year::text) <> ''
ON CONFLICT DO NOTHING;

-- Нынешний год и следующий: заводить проект в январе, не вспомнив про
-- справочник, — обычное дело.
INSERT INTO fm_lookups (kind, value)
VALUES ('year', to_char(now(), 'YYYY')),
       ('year', to_char(now() + interval '1 year', 'YYYY'))
ON CONFLICT DO NOTHING;

-- ============================================================
--  Кто попадает в списки «Руководитель» и «Специалисты/Эксперты».
--
--  Раньше в оба выпадающих списка попадали ВСЕ пользователи системы,
--  включая тех, кто к проектам отношения не имеет. Теперь это отдельное
--  свойство человека.
--
--  Умолчание — TRUE, а не FALSE: на сервере, который просто обновили,
--  списки должны остаться такими же, какими были вчера. Сузить их
--  администратор может сам, а вот молча опустевший список «Руководитель»
--  выглядел бы как поломка.
-- ============================================================

ALTER TABLE fm_permissions
  ADD COLUMN IF NOT EXISTS can_be_manager BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE fm_permissions
  ADD COLUMN IF NOT EXISTS can_be_expert BOOLEAN NOT NULL DEFAULT TRUE;

-- У пользователя может не быть строки в fm_permissions вовсе (она
-- заводится при первой правке прав). Для списков это означало бы
-- «не показывать», поэтому заводим строки всем, кого ещё нет.
INSERT INTO fm_permissions (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;
