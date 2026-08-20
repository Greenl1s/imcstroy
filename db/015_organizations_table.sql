-- ============================================================
--  "Структура" в проекте становится управляемым списком (как
--  Компании/Классификации в "Учёте оборудования") — добавлять и
--  удалять можно через интерфейс, а не печатать заново каждый раз.
-- ============================================================

CREATE TABLE IF NOT EXISTS organizations (
  name TEXT PRIMARY KEY,
  position INT NOT NULL DEFAULT 0
);

-- Переносим то, что уже могло быть введено вручную в существующих
-- проектах, чтобы ничего не потерялось при включении справочника.
INSERT INTO organizations (name, position)
SELECT DISTINCT organization, 0
FROM cases
WHERE organization IS NOT NULL AND organization <> ''
ON CONFLICT (name) DO NOTHING;

-- Внешний ключ — не даёт присвоить проекту несуществующую организацию
-- и не даёт удалить ту, что ещё используется (страховка поверх
-- проверки в самом приложении).
ALTER TABLE cases
  ADD CONSTRAINT cases_organization_fkey
  FOREIGN KEY (organization) REFERENCES organizations(name);
