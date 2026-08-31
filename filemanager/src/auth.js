const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./db");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("Переменная окружения JWT_SECRET не задана");
}

// Должно совпадать с тем, что выставляет "Учёт оборудования" — так вход
// на любом из двух сайтов сразу открывает и второй (SSO). ИСУ и "Учёт
// оборудования" используют одну и ту же базу данных, поэтому пароль
// проверяем напрямую по общей таблице users — отдельно свою таблицу
// пользователей (и уж тем более отдельные пароли) здесь больше не ведём.
const COOKIE_NAME = "sso_token";
const COOKIE_DOMAIN = process.env.SSO_COOKIE_DOMAIN || undefined;
const TOKEN_TTL = "12h";

async function verifyLogin(username, password) {
  const res = await db.query(
    "SELECT id, username, password_hash, role FROM users WHERE lower(username) = lower($1)",
    [username]
  );
  const user = res.rows[0];
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return null;
  return { id: user.id, username: user.username, role: user.role };
}

// Форма токена та же, что у "Учёта оборудования" (sub/username/role) —
// токен, выданный любым из двух сайтов, принимается другим без изменений.
function issueToken(user) {
  return jwt.sign(
    { sub: String(user.id), username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    domain: COOKIE_DOMAIN,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 12 * 60 * 60 * 1000,
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { domain: COOKIE_DOMAIN });
}

async function getPermissions(userId) {
  const res = await db.query(
    "SELECT can_tools, can_db, can_cases FROM fm_permissions WHERE user_id = $1",
    [userId]
  );
  return res.rows[0] || { can_tools: false, can_db: false, can_cases: false };
}

/**
 * Личность (id/username/role) — из общей cookie, подписанной либо этим
 * сайтом, либо "Учётом оборудования" (у обоих один и тот же JWT_SECRET).
 * Права на разделы ИСУ (can_tools/can_db/can_cases) — из fm_permissions.
 */
async function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ message: "Не авторизован" });
  }

  let identity;
  try {
    identity = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: "Сессия недействительна" });
  }

  try {
    const userId = Number(identity.sub);
    const perms = await getPermissions(userId);
    // Кто этот человек в Planfix. Логин ИСУ ("kirill") и сотрудник Planfix
    // ("Кирилл Базаев", id 9) — разные вещи, связь проставляет админ.
    // Именно от этого id зависят фильтр "Мои задачи" и авторство всего,
    // что ИСУ пишет в Planfix.
    const { rows: nameRows } = await db.query(
      "SELECT planfix_name, planfix_user_id FROM users WHERE id = $1", [userId]);
    req.user = {
      id: userId,
      username: identity.username,
      role: identity.role,
      can_tools: perms.can_tools,
      can_db: perms.can_db,
      can_cases: perms.can_cases,
      planfix_name: nameRows.length ? nameRows[0].planfix_name : null,
      planfix_user_id: nameRows.length ? nameRows[0].planfix_user_id : null,
    };
    next();
  } catch (err) {
    console.error("Не удалось получить права пользователя:", err);
    res.status(500).json({ message: "Не удалось проверить права доступа" });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Требуются права администратора" });
  }
  next();
}

/**
 * Кто выступает автором события, когда запрос пришёл не от браузера
 * пользователя, а от стороннего сервиса (OnlyOffice сообщает лишь id).
 * Если такого пользователя уже нет — вернём null, событие запишется
 * без автора, а не потеряется.
 */
async function userForEvent(userId) {
  const id = Number(userId);
  if (!id) return null;
  try {
    const res = await db.query("SELECT id, username FROM users WHERE id = $1", [id]);
    return res.rows[0] || null;
  } catch (err) {
    return null;
  }
}

module.exports = {
  userForEvent,
  verifyLogin,
  issueToken,
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
  requireAdmin,
  getPermissions,
  COOKIE_NAME,
};
