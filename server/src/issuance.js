import { todayIso, toIso } from './dates.js';

// Enforced on the locked database row, never on a client-supplied issue date.
// The last day remains valid until midnight Moscow time. No admin exception.
export function assertIssuable(instrument, day = todayIso()) {
  if (instrument.check_type === 'none') return;
  const until = toIso(instrument.valid_until);
  if (!until || until < day) {
    const reason = until ? 'срок метрологического контроля истёк' : 'срок метрологического контроля не указан';
    const err = new Error(`«${instrument.name}»: ${reason}. Выдача и передача запрещены.`);
    err.status = 409;
    throw err;
  }
}

export async function assertIssuableLocked(client, id) {
  const { rows } = await client.query(
    'SELECT id, name, check_type, valid_until FROM instruments WHERE id = $1 FOR UPDATE', [id]
  );
  if (!rows.length) {
    const err = new Error('Прибор не найден');
    err.status = 404;
    throw err;
  }
  assertIssuable(rows[0]);
}
