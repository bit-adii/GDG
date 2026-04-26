/**
 * src/app.js
 * ──────────
 * Express application factory.
 *
 * Registers:
 *  - CORS with allowed origins from .env
 *  - JSON / URL-encoded body parsing
 *  - HTTP request logging (morgan)
 *  - All API routes under /api/v1
 *  - Global error handler
 */

const express       = require("express");
const cors          = require("cors");
const morgan        = require("morgan");
const { ALLOWED_ORIGINS, NODE_ENV } = require("./config/env");

// Routes
const analysisRoutes = require("./routes/analysisRoutes");

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────── //
// In development: allow all origins (frontend served from same server or any port).
// In production: restrict to ALLOWED_ORIGINS list from .env.
app.use(
  cors({
    origin: NODE_ENV === "production"
      ? (origin, cb) => {
          if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
          cb(new Error(`CORS: origin '${origin}' not allowed`));
        }
      : true,   // allow everything in development
    methods:      ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ── Body parsing ──────────────────────────────────────────────────────────── //
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ── HTTP logging ──────────────────────────────────────────────────────────── //
app.use(morgan(NODE_ENV === "production" ? "combined" : "dev"));

const path          = require("path");

// ── Static frontend ───────────────────────────────────────────────────────── //
// Serves e:\GDG\frontend at http://localhost:5000/
const frontendPath = path.resolve(__dirname, "..", "..", "frontend");
app.use(express.static(frontendPath));

// ── Health check (JSON, not HTML) ─────────────────────────────────────────── //
app.get("/health", (req, res) =>
  res.json({ service: "Nyaya AI Backend", status: "ok" })
);

// ── API routes ────────────────────────────────────────────────────────────── //
app.use("/api/v1", analysisRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────── //
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.path} not found` });
});

// ── Global error handler ──────────────────────────────────────────────────── //
app.use((err, req, res, _next) => {
  console.error("[Error]", err.message);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: err.message || "Internal Server Error",
    ...(NODE_ENV !== "production" && { stack: err.stack }),
  });
});

module.exports = app;
