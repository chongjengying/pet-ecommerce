const dotenv = require("dotenv");

dotenv.config();

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || "development",
  db: {
    host: requireEnv("DB_HOST"),
    port: Number(process.env.DB_PORT || 5432),
    user: requireEnv("DB_USER"),
    password: requireEnv("DB_PASSWORD"),
    database: requireEnv("DB_NAME"),
    max: Number(process.env.DB_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000)
  },
  jwt: {
    secret: requireEnv("JWT_SECRET"),
    expiresIn: "1d"
  },
  auth: {
    bcryptRounds: Number(process.env.BCRYPT_SALT_ROUNDS || 12)
  }
};

module.exports = env;
