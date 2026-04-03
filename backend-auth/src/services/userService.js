const db = require("../config/db");

async function findByEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const result = await db.query(
    `SELECT id, email, password, name, role, created_at
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [normalizedEmail]
  );
  return result.rows[0] || null;
}

async function findById(id) {
  const result = await db.query(
    `SELECT id, email, name, role, created_at
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  return result.rows[0] || null;
}

async function createUser({ email, hashedPassword, name, role = "customer" }) {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedName = typeof name === "string" ? name.trim() : null;

  const result = await db.query(
    `INSERT INTO users (email, password, name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, name, role, created_at`,
    [normalizedEmail, hashedPassword, trimmedName, role]
  );

  return result.rows[0];
}

module.exports = {
  findByEmail,
  findById,
  createUser
};
