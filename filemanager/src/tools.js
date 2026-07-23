const db = require("./db");

async function listLinks() {
  const res = await db.query(
    "SELECT id, label, url FROM fm_tools_links ORDER BY position ASC, id ASC"
  );
  return res.rows;
}

async function addLink(label, url) {
  const res = await db.query(
    "INSERT INTO fm_tools_links (label, url) VALUES ($1, $2) RETURNING id, label, url",
    [label, url]
  );
  return res.rows[0];
}

async function removeLink(id) {
  await db.query("DELETE FROM fm_tools_links WHERE id = $1", [id]);
}

module.exports = { listLinks, addLink, removeLink };
