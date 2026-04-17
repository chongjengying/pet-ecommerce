const db = require("../config/db");

const ACCOUNT_STATUSES = ["active", "inactive", "suspended", "deleted"];
const ASSIGNABLE_ROLES = ["admin", "customer"];

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeStatus(status) {
  return String(status || "").trim().toLowerCase();
}

function normalizeRoles(roles) {
  const list = Array.isArray(roles) ? roles : [];
  const normalized = list.map((role) => String(role || "").trim().toLowerCase()).filter(Boolean);
  return [...new Set(normalized)];
}

async function findByEmailForAuth(email) {
  const result = await db.query(
    `SELECT
       u.id,
       u.email,
       u.password_hash,
       u.account_status,
       u.last_login_at,
       u.password_updated_at,
       u.created_at,
       COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), ARRAY[]::text[]) AS roles
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id
     WHERE u.email = $1
     GROUP BY u.id
     LIMIT 1`,
    [normalizeEmail(email)]
  );
  return result.rows[0] || null;
}

async function findByIdWithRoles(id) {
  const result = await db.query(
    `SELECT
       u.id,
       u.email,
       u.account_status,
       u.last_login_at,
       u.password_updated_at,
       u.created_at,
       u.updated_at,
       COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), ARRAY[]::text[]) AS roles
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id
     WHERE u.id = $1
     GROUP BY u.id
     LIMIT 1`,
    [id]
  );
  return result.rows[0] || null;
}

async function createUser({ email, passwordHash, accountStatus = "active", roles = ["customer"] }) {
  const normalizedStatus = normalizeStatus(accountStatus);
  if (!ACCOUNT_STATUSES.includes(normalizedStatus)) {
    const err = new Error("Invalid account status.");
    err.statusCode = 400;
    throw err;
  }

  const normalizedRoles = normalizeRoles(roles);
  if (normalizedRoles.length === 0 || normalizedRoles.some((role) => !ASSIGNABLE_ROLES.includes(role))) {
    const err = new Error("Invalid roles. Allowed roles: admin, customer.");
    err.statusCode = 400;
    throw err;
  }

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    const createResult = await client.query(
      `INSERT INTO users (email, password_hash, account_status)
       VALUES ($1, $2, $3::account_status_enum)
       RETURNING id, email, account_status, created_at, updated_at`,
      [normalizeEmail(email), passwordHash, normalizedStatus]
    );
    const user = createResult.rows[0];

    await client.query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, r.id
       FROM roles r
       WHERE r.name = ANY($2::text[])
       ON CONFLICT DO NOTHING`,
      [user.id, normalizedRoles]
    );

    await client.query("COMMIT");
    return findByIdWithRoles(user.id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listUsers() {
  const result = await db.query(
    `SELECT
       u.id,
       u.email,
       u.account_status,
       u.last_login_at,
       u.password_updated_at,
       u.created_at,
       u.updated_at,
       COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), ARRAY[]::text[]) AS roles
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id
     GROUP BY u.id
     ORDER BY u.created_at DESC`
  );
  return result.rows;
}

async function updateUserBasic(id, { email, passwordHash }) {
  const fields = [];
  const params = [];
  let p = 1;

  if (email != null) {
    fields.push(`email = $${p++}`);
    params.push(normalizeEmail(email));
  }
  if (passwordHash != null) {
    fields.push(`password_hash = $${p++}`);
    params.push(passwordHash);
  }

  if (fields.length === 0) {
    return findByIdWithRoles(id);
  }

  params.push(id);
  const result = await db.query(
    `UPDATE users
     SET ${fields.join(", ")}
     WHERE id = $${p}
     RETURNING id`,
    params
  );
  if (!result.rows[0]) return null;
  return findByIdWithRoles(id);
}

async function setAccountStatus(id, accountStatus) {
  const normalizedStatus = normalizeStatus(accountStatus);
  if (!ACCOUNT_STATUSES.includes(normalizedStatus)) {
    const err = new Error("Invalid account status.");
    err.statusCode = 400;
    throw err;
  }

  const result = await db.query(
    `UPDATE users
     SET account_status = $2::account_status_enum
     WHERE id = $1
     RETURNING id`,
    [id, normalizedStatus]
  );
  if (!result.rows[0]) return null;
  return findByIdWithRoles(id);
}

async function softDeleteUser(id) {
  return setAccountStatus(id, "deleted");
}

async function assignRoles(id, roles) {
  const normalizedRoles = normalizeRoles(roles);
  if (normalizedRoles.length === 0 || normalizedRoles.some((role) => !ASSIGNABLE_ROLES.includes(role))) {
    const err = new Error("Invalid roles. Allowed roles: admin, customer.");
    err.statusCode = 400;
    throw err;
  }

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM user_roles WHERE user_id = $1", [id]);
    await client.query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, r.id
       FROM roles r
       WHERE r.name = ANY($2::text[])`,
      [id, normalizedRoles]
    );
    await client.query("COMMIT");
    return findByIdWithRoles(id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updateLastLoginAt(id) {
  try {
    await db.query(
      `UPDATE users
       SET last_login_at = now()
       WHERE id = $1`,
      [id]
    );
  } catch (error) {
    // Graceful fallback when column is not deployed yet.
    if (error && error.code === "42703") {
      return;
    }
    throw error;
  }
}

async function updatePasswordByEmail(email, passwordHash) {
  const normalizedEmail = normalizeEmail(email);
  try {
    const result = await db.query(
      `UPDATE users
       SET password_hash = $2,
           password_updated_at = now()
       WHERE email = $1
       RETURNING id`,
      [normalizedEmail, passwordHash]
    );
    return result.rows[0] || null;
  } catch (error) {
    // Graceful fallback when password_updated_at is not deployed yet.
    if (error && error.code === "42703") {
      const result = await db.query(
        `UPDATE users
         SET password_hash = $2
         WHERE email = $1
         RETURNING id`,
        [normalizedEmail, passwordHash]
      );
      return result.rows[0] || null;
    }
    throw error;
  }
}

module.exports = {
  ACCOUNT_STATUSES,
  ASSIGNABLE_ROLES,
  findByEmailForAuth,
  findByIdWithRoles,
  createUser,
  listUsers,
  updateLastLoginAt,
  updatePasswordByEmail,
  updateUserBasic,
  setAccountStatus,
  softDeleteUser,
  assignRoles
};
