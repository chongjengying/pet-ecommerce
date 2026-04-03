const app = require("./app");
const env = require("./config/env");
const { pool } = require("./config/db");

async function startServer() {
  try {
    await pool.query("SELECT 1");
    app.listen(env.port, () => {
      console.log(`Auth service running on http://localhost:${env.port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();
