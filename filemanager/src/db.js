const { Pool } = require("pg");

// Если задана DATABASE_URL — используем её.
// Иначе pg сам подхватит стандартные переменные окружения:
// PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE
// (те же значения, что уже использует контейнер "api" для своей базы).
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : new Pool();

/**
 * Не накатили миграцию?
 *
 * PostgreSQL отвечает на это кодами 42P01 (нет таблицы) и 42703 (нет
 * колонки), а текст у него свой: «relation "fm_lookups" does not exist».
 * Показывать такое человеку — значит заставить его гадать; на деле
 * ответ всегда один и тот же и очень простой.
 *
 * Возвращает готовую фразу или null, если ошибка не про это.
 */
pool.notMigrated = function notMigrated(err) {
  if (!err || (err.code !== "42P01" && err.code !== "42703")) return null;
  return "База данных не обновлена: не накатили миграции из папки db/. " +
    "Посмотрите памятку к последнему архиву — там команда целиком.";
};

module.exports = pool;
