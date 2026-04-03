const { Pool } = require("pg");
const env = require("./env");

const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  max: env.db.max,
  idleTimeoutMillis: env.db.idleTimeoutMillis
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error);
});

async function query(text, params = []) {
  return pool.query(text, params);
}

module.exports = {
  pool,
  query
};
