const jwt = require("jsonwebtoken");
const db = require("./db");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("Переменная окружения JWT_SECRET не задана");
}

// Должно совпадать с cookie, которую выставляет "Учёт оборудования" —
// так вход на любом из двух сайтов сразу открывает и второй (SSO).
const COOKIE_NAME = "sso_token";
const COOKIE_DOMAIN = process.env.SSO_COOKIE_DOMAIN || undefined;

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
 * Личность (id/username/role) теперь всегда приходит из общего токена,
 * подписанного "Учётом оборудования" при входе — паролей мы у себя
 * больше не храним и не проверяем. Права на разделы ИСУ (can_tools/
 * can_db/can_cases) по-прежнему свои, берём их из fm_permissions.
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
    req.user = {
      id: userId,
      username: identity.username,
      role: identity.role,
      can_tools: perms.can_tools,
      can_db: perms.can_db,
      can_cases: perms.can_cases,
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

module.exports = {
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
  requireAdmin,
  getPermissions,
  COOKIE_NAME,
};
