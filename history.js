/**
 * Журнал событий. Только добавление записей — ничего не переписывается.
 * Вызывается ВНУТРИ той же транзакции, что и само изменение прибора:
 * либо записывается и действие, и его след в истории, либо ничего.
 */
export function logEvent(client, { instrument, action, actor, targetName = null, place = null, extra = null, note = null }) {
  return client.query(
    `INSERT INTO history
       (instrument_id, instrument_name, action, actor_id, actor_name, target_name, place, extra, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      instrument.id,
      instrument.name,
      action,
      actor.id,
      actor.username,
      targetName,
      place,
      extra,
      note
    ]
  );
}
