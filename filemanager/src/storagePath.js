// One path representation for permission checks and filesystem operations.
// Reject traversal instead of silently changing which folder is requested.
function normalizeStoragePath(value = "/") {
  if (typeof value !== "string" || /[\\\u0000-\u001f]/.test(value)) {
    const err = new Error("Недопустимый путь");
    err.status = 400;
    throw err;
  }
  const parts = value.split("/").filter(Boolean);
  if (parts.some((part) => part === "." || part === "..")) {
    const err = new Error("Путь не должен содержать . или ..");
    err.status = 400;
    throw err;
  }
  return "/" + parts.join("/");
}

module.exports = { normalizeStoragePath };
