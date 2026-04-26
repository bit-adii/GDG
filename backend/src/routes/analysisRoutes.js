/**
 * src/routes/analysisRoutes.js
 * ────────────────────────────
 * Express router for all Nyaya AI analysis endpoints.
 *
 * Base path (mounted in app.js): /api/v1
 *
 * Route map
 * ─────────
 *  GET  /analyze/status          → check service health
 *  GET  /analyze/datasets        → list built-in datasets & mitigation options
 *  GET  /analyze/builtin         → run ML pipeline on a built-in dataset (query params)
 *  POST /analyze/upload          → upload your own CSV → instant JS bias report
 *  POST /analyze/ml              → run full ML pipeline (body: dataset + mitigation)
 */

const { Router }     = require("express");
const { uploadSingle } = require("../middleware/uploadMiddleware");
const ctrl           = require("../controllers/analysisController");

const router = Router();

// ── Read-only / quick endpoints ────────────────────────────────────────── //
router.get("/analyze/status",   ctrl.getServiceStatus);
router.get("/analyze/datasets", ctrl.listDatasets);
router.get("/analyze/builtin",  ctrl.runBuiltinAnalysis);

// ── Upload endpoint (multipart/form-data, field: "dataset") ───────────── //
router.post("/analyze/upload",  uploadSingle, ctrl.uploadAndAnalyze);

// ── ML pipeline endpoint (JSON body) ──────────────────────────────────── //
router.post("/analyze/ml",      ctrl.runMLAnalysis);

module.exports = router;
