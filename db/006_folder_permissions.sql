CREATE TABLE IF NOT EXISTS fm_folder_permissions (
  id SERIAL PRIMARY KEY,
  path TEXT NOT NULL,
  user_id INT NOT NULL REFERENCES fm_users (id) ON DELETE CASCADE,
  access TEXT NOT NULL CHECK (access IN ('read', 'write', 'none')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (path, user_id)
);

CREATE INDEX IF NOT EXISTS fm_folder_permissions_user_idx ON fm_folder_permissions (user_id);
CREATE INDEX IF NOT EXISTS fm_folder_permissions_path_idx ON fm_folder_permissions (path);
