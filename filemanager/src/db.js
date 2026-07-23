const { Pool } = require("pg");

// Если задана DATABASE_URL — используем её.
// Иначе pg сам подхватит стандартные переменные окружения:
// PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE
// (те же значения, что уже использует контейнер "api" для своей базы).
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : new Pool();

module.exports = pool;
