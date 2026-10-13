// Shared PostgreSQL connection pool. Settings come from .env (see .env.example).
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || "BlogDB",
});

pool.on("error", (err) => console.error("Unexpected PostgreSQL error:", err.message));

module.exports = pool;
