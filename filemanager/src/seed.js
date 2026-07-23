// Использование: node src/seed.js <логин> <пароль> [роль]
// Пример:        node src/seed.js admin MyStrongPass123 admin

const bcrypt = require("bcryptjs");
const db = require("./db");

async function main() {
  const [, , username, password, role = "admin"] = process.argv;
  if (!username || !password) {
    console.error("Использование: node src/seed.js <логин> <пароль> [роль]");
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 10);
  await db.query(
    `INSERT INTO fm_users (username, password_hash, role, can_tools, can_db, can_cases)
     VALUES ($1, $2, $3, true, true, true)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role`,
    [username, hash, role]
  );
  console.log(`Пользователь "${username}" создан/обновлён.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
