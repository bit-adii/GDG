/**
 * src/config/env.js
 * ─────────────────
 * Loads .env and exports all environment variables with sane defaults.
 * Import this ONCE at startup; every other module reads from here.
 */

require("dotenv").config();

module.exports = {
  PORT:               process.env.PORT               || 5000,
  NODE_ENV:           process.env.NODE_ENV           || "development",
  PYTHON_SERVICE_URL: process.env.PYTHON_SERVICE_URL || "http://localhost:5001",
  MAX_FILE_SIZE_MB:   parseInt(process.env.MAX_FILE_SIZE_MB || "10", 10),
  ALLOWED_ORIGINS:    (process.env.ALLOWED_ORIGINS   || "http://localhost:3000")
                        .split(",").map((o) => o.trim()),
};
