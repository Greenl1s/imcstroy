-- ============================================================
--  Корзина файлового менеджера.
--
--  Удаление больше не стирает файл с диска: он переезжает в скрытую
--  папку ".trash" внутри хранилища, а сюда пишется запись о том, что
--  это было, откуда и кто удалил. Через 30 дней запись и файл
--  вычищаются сами; до этого их можно вернуть на место.
--
--  perm_rules — снимок персональных правил доступа (fm_folder_permissions),
--  которые относились к удалённой папке. Сами правила при удалении
--  убираются, иначе новая папка с тем же названием случайно унаследовала
--  бы чужой доступ. При восстановлении снимок возвращается обратно.
-- ============================================================

CREATE TABLE IF NOT EXISTS fm_trash (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  original_path TEXT NOT NULL,
  is_dir BOOLEAN NOT NULL DEFAULT false,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  -- имя папки внутри ".trash", где физически лежит удалённое
  storage_key TEXT NOT NULL UNIQUE,
  perm_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  deleted_by INT,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fm_trash_deleted_at_idx ON fm_trash (deleted_at);
CREATE INDEX IF NOT EXISTS fm_trash_deleted_by_idx ON fm_trash (deleted_by);
