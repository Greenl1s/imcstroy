// Использование: node src/seed.js <логин>
//
// Личность (логин/пароль) ведёт "Учёт оборудования" в общей таблице users
// (ИСУ и "Учёт оборудования" используют одну и ту же базу данных).
// Этот скрипт находит уже существующего пользователя по логину и выдаёт
// ему полный доступ ко всем разделам ИСУ (Инструменты/База данных/Дела).

const db = require("./db");

async function main() {
  const [, , username] = process.argv;
  if (!username) {
    console.error("Использование: node src/seed.js <логин>");
    process.exit(1);
  }

  const res = await db.query(
    "SELECT id, username FROM users WHERE lower(username) = lower($1)",
    [username]
  );
  const user = res.rows[0];
  if (!user) {
    console.error(`Пользователь "${username}" не найден. Создайте его сначала в "Учёте оборудования".`);
    process.exit(1);
  }

  await db.query(
    `INSERT INTO fm_permissions (user_id, can_tools, can_db, can_cases)
     VALUES ($1, true, true, true)
     ON CONFLICT (user_id) DO UPDATE SET can_tools = true, can_db = true, can_cases = true`,
    [user.id]
  );

  console.log(`Пользователю "${user.username}" (id ${user.id}) выдан полный доступ ко всем разделам ИСУ.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
