-- ============================================================
--  Новые действия для журнала (history), связанные с подтверждением
--  передачи прибора: раньше был только 'transfer', теперь ещё
--  запрос передачи, подтверждение и отклонение.
-- ============================================================

ALTER TYPE history_action ADD VALUE IF NOT EXISTS 'transfer_request';
ALTER TYPE history_action ADD VALUE IF NOT EXISTS 'transfer_accept';
ALTER TYPE history_action ADD VALUE IF NOT EXISTS 'transfer_reject';
