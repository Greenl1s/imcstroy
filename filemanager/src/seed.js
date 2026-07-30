// Использование: node src/seed.js <логин_админа> <пароль_админа> <логин_кому_выдать_доступ>
//
// Личность (логин/пароль) теперь целиком живёт в "Учёте оборудования" —
// этот скрипт больше не создаёт локального пользователя ИСУ, а находит
// уже существующий аккаунт по логину и выдаёт ему полный доступ ко всем
// разделам ИСУ (Инструменты/База данных/Дела).

const db = require("./db");

const IDENTITY_API_URL = process.env.IDENTITY_API_URL;

async function main() {
  const [, , adminUsername, adminPassword, targetUsername] = process.argv;
  if (!adminUsername || !adminPassword || !targetUsername) {
    console.error("Использование: node src/seed.js <логин_админа> <пароль_админа> <логин_кому_выдать_доступ>");
    process.exit(1);
  }
  if (!IDENTITY_API_URL) {
    console.error('Переменная окружения IDENTITY_API_URL не задана (адрес API "Учёта оборудования")');
    process.exit(1);
  }

  const loginRes = await fetch(`${IDENTITY_API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: adminUsername, password: adminPassword }),
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok) {
    console.error('Не удалось войти в "Учёт оборудования":', loginData.error || loginRes.status);
    process.exit(1);
  }

  const usersRes = await fetch(`${IDENTITY_API_URL}/users`, {
    headers: { Authorization: `Bearer ${loginData.token}` },
  });
  const usersList = await usersRes.json();
  if (!usersRes.ok) {
    console.error("Не удалось получить список пользователей:", usersList.error || usersRes.status);
    process.exit(1);
  }

  const target = usersList.find((u) => u.username.toLowerCase() === targetUsername.toLowerCase());
  if (!target) {
    console.error(`Пользователь "${targetUsername}" не найден в "Учёте оборудования". Создайте его там сначала.`);
    process.exit(1);
  }

  await db.query(
    `INSERT INTO fm_permissions (user_id, can_tools, can_db, can_cases)
     VALUES ($1, true, true, true)
     ON CONFLICT (user_id) DO UPDATE SET can_tools = true, can_db = true, can_cases = true`,
    [target.id]
  );

  console.log(`Пользователю "${target.username}" (id ${target.id}) выдан полный доступ ко всем разделам ИСУ.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
