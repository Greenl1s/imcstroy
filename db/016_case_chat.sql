-- ============================================================
--  История переписки с ИИ-ассистентом внутри карточки проекта.
--  Одна строка = одно сообщение (человека или ассистента), хранится
--  по проекту, чтобы переписка не терялась при обновлении страницы.
-- ============================================================

CREATE TABLE IF NOT EXISTS case_chat_messages (
  id SERIAL PRIMARY KEY,
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_chat_messages_case ON case_chat_messages(case_id, created_at);
