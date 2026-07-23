const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./db");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("Переменная окружения JWT_SECRET не задана");
}

const COOKIE_NAME = "fm_token";
const TOKEN_TTL = "12h";

async function findUser(username) {
  const res = await db.query(
    "SELECT id, username, password_hash, role, can_tools, can_db, can_cases FROM fm_users WHERE username = $1",
    [username]
  );
  return res.rows[0] || null;
}

async function verifyLogin(username, password) {
  const user = await findUser(username);
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return null;
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    can_tools: user.can_tools,
    can_db: user.can_db,
    can_cases: user.can_cases,
  };
}

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      can_tools: user.can_tools,
      can_db: user.can_db,
      can_cases: user.can_cases,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 12 * 60 * 60 * 1000,
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ message: "Не авторизован" });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ message: "Сессия недействительна" });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Требуются права администратора" });
  }
  next();
}

module.exports = {
  verifyLogin,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
  requireAdmin,
  COOKIE_NAME,
};
