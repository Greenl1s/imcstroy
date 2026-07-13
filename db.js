import pg from 'pg';

// Postgres отдаёт DATE как объект Date в часовом поясе сервера — из-за этого
// дата может «уехать» на день. Нам нужны просто строки вида 2026-07-12.
pg.types.setTypeParser(1082, (value) => value);

// bigint драйвер по умолчанию возвращает СТРОКОЙ (чтобы не потерять точность
// на числах больше 2^53). Из-за этого сравнения вида id === user.id молча
// давали бы false. Идентификаторов у нас несопоставимо меньше, поэтому
// безопасно приводим их к числам.
pg.types.setTypeParser(20, (value) => parseInt(value, 10));

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000
});

pool.on('error', (err) => {
  console.error('[db] непредвиденная ошибка пула соединений:', err);
});

/** Обычный запрос. */
export function query(text, params) {
  return pool.query(text, params);
}

/**
 * Выполняет несколько запросов в одной транзакции.
 * Если внутри что-то упало — откатывается всё целиком.
 * Именно это защищает от «половина операции записалась, половина нет».
 */
export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Ждём, пока база поднимется (важно при старте через docker compose). */
export async function waitForDb(attempts = 30) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('[db] соединение установлено');
      return;
    } catch (err) {
      console.log(`[db] база ещё не готова (попытка ${i}/${attempts})`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error('Не удалось подключиться к базе данных');
}
