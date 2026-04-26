/**
 * src/controllers/analysisController.js
 * ───────────────────────────────────────
 * Request handlers for all Nyaya AI analysis endpoints.
 *
 * Endpoints handled
 * ─────────────────
 *  POST  /api/v1/analyze/upload      – upload CSV, get instant JS-computed bias report
 *  POST  /api/v1/analyze/ml          – trigger full ML pipeline (calls Python)
 *  GET   /api/v1/analyze/builtin     – run pipeline on a built-in dataset
 *  GET   /api/v1/analyze/status      – check Python ML service health
 *  GET   /api/v1/analyze/datasets    – list available built-in datasets
 *
 * Design: controllers are thin — they parse/validate requests, delegate to
 *         services, and format responses.  No business logic lives here.
 */

const path                      = require("path");
const { loadDataset }           = require("../services/dataService");
const { detectBias }            = require("../services/biasService");
const { buildFairnessReport,
        buildMitigationReport } = require("../services/fairnessService");
const { runFullPipeline,
        getPythonServiceStatus } = require("../services/modelService");
const { generateRecommendations } = require("../services/recommendationService");

// ────────────────────────────────────────────────────────────────────────── //
//  Helper: standard success envelope
// ────────────────────────────────────────────────────────────────────────── //
function ok(res, data, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

// ────────────────────────────────────────────────────────────────────────── //
//  POST /api/v1/analyze/upload
//  Accepts a multipart/form-data CSV file (field: "dataset").
//  Returns immediate bias metrics computed in pure JS — no ML call.
// ────────────────────────────────────────────────────────────────────────── //
async function uploadAndAnalyze(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded. Send a CSV file under the field name 'dataset'.",
      });
    }

    // 1. Parse & describe dataset
    const dataset  = loadDataset(req.file.buffer, req.file.originalname);

    // 2. Detect bias with JS metrics
    const bias     = detectBias(dataset.rawRows);

    // 3. Build fairness report (no ML result yet)
    const fairness = buildFairnessReport(dataset.rawRows, null);

    // 4. Generate recommendations
    const recommendations = generateRecommendations(fairness.groundTruth);

    return ok(res, {
      dataset: {
        filename:        dataset.filename,
        rowCount:        dataset.rowCount,
        headers:         dataset.headers,
        columnStats:     dataset.columnStats,
        genderDist:      dataset.genderDist,
        shortlistedDist: dataset.shortlistedDist,
        sample:          dataset.sample,
      },
      bias,
      fairness,
      recommendations,
      mlAvailable: false,   // hint to frontend that ML results are pending
    });
  } catch (err) {
    next(err);
  }
}

// ────────────────────────────────────────────────────────────────────────── //
//  POST /api/v1/analyze/ml
//  Body: { dataset: "biased"|"fair", mitigation: "reweighting"|"smote" }
//  Calls the Python service and returns the full ML pipeline result.
// ────────────────────────────────────────────────────────────────────────── //
async function runMLAnalysis(req, res, next) {
  try {
    const { dataset = "biased", mitigation = "reweighting" } = req.body;

    const validDatasets   = ["biased", "fair"];
    const validMitigation = ["reweighting", "smote"];

    if (!validDatasets.includes(dataset)) {
      return res.status(400).json({
        success: false,
        message: `Invalid dataset '${dataset}'. Valid options: ${validDatasets.join(", ")}`,
      });
    }
    if (!validMitigation.includes(mitigation)) {
      return res.status(400).json({
        success: false,
        message: `Invalid mitigation '${mitigation}'. Valid options: ${validMitigation.join(", ")}`,
      });
    }

    // Run Python ML pipeline
    const mlResult = await runFullPipeline({ dataset, mitigation });

    // Build structured before/after report
    const mitigationReport = buildMitigationReport(mlResult);

    // Generate recommendations from the BEFORE state
    const beforeMetrics = {
      fairnessScore:     mlResult.before?.fairness_score     ?? 0,
      disparateImpact:   mlResult.before?.disparate_impact   ?? 0,
      disadvantagedGroup: mlResult.before?.disadvantaged     ?? "Unknown",
      privilegedGroup:   mlResult.before?.privileged         ?? "Unknown",
      selectionRates:    mlResult.before?.selection_rates    ?? {},
      biasExists:        mlResult.before?.bias_exists        ?? false,
    };
    const recommendations = generateRecommendations(beforeMetrics);

    return ok(res, {
      dataset,
      mitigation,
      mlResult,
      mitigationReport,
      recommendations,
    });
  } catch (err) {
    next(err);
  }
}

// ────────────────────────────────────────────────────────────────────────── //
//  GET /api/v1/analyze/builtin?dataset=biased&mitigation=reweighting
//  Convenience endpoint: run ML pipeline on a built-in dataset via GET.
// ────────────────────────────────────────────────────────────────────────── //
async function runBuiltinAnalysis(req, res, next) {
  try {
    const { dataset = "biased", mitigation = "reweighting" } = req.query;

    const mlResult         = await runFullPipeline({ dataset, mitigation });
    const mitigationReport = buildMitigationReport(mlResult);

    const beforeMetrics = {
      fairnessScore:      mlResult.before?.fairness_score   ?? 0,
      disparateImpact:    mlResult.before?.disparate_impact ?? 0,
      disadvantagedGroup: mlResult.before?.disadvantaged    ?? "Unknown",
      privilegedGroup:    mlResult.before?.privileged       ?? "Unknown",
      selectionRates:     mlResult.before?.selection_rates  ?? {},
      biasExists:         mlResult.before?.bias_exists      ?? false,
    };
    const recommendations = generateRecommendations(beforeMetrics);

    return ok(res, {
      dataset,
      mitigation,
      mlResult,
      mitigationReport,
      recommendations,
    });
  } catch (err) {
    next(err);
  }
}

// ────────────────────────────────────────────────────────────────────────── //
//  GET /api/v1/analyze/status
//  Returns Node.js + Python service health information.
// ────────────────────────────────────────────────────────────────────────── //
async function getServiceStatus(req, res, next) {
  try {
    const python = await getPythonServiceStatus();
    return ok(res, {
      nodeBackend:   { status: "ok", version: process.version },
      pythonService: python,
    });
  } catch (err) {
    next(err);
  }
}

// ────────────────────────────────────────────────────────────────────────── //
//  GET /api/v1/analyze/datasets
//  Lists available built-in datasets and their metadata.
// ────────────────────────────────────────────────────────────────────────── //
function listDatasets(req, res) {
  return ok(res, {
    datasets: [
      {
        key:         "biased",
        label:       "Biased Hiring Dataset",
        description: "2,000 synthetic recruitment records with gender-based bias injected. " +
                     "Female candidates have near-zero selection rates.",
        rows:        2000,
        biasLevel:   "High",
      },
      {
        key:         "fair",
        label:       "Fair Hiring Dataset",
        description: "2,000 synthetic recruitment records with equal selection rates " +
                     "across gender groups.",
        rows:        2000,
        biasLevel:   "Low",
      },
    ],
    mitigationOptions: [
      {
        key:         "reweighting",
        label:       "Sample Reweighting",
        description: "Assigns higher training weights to underrepresented group×class " +
                     "combinations. No rows added or removed.",
      },
      {
        key:         "smote",
        label:       "SMOTE Oversampling",
        description: "Generates synthetic minority-class samples to balance the dataset. " +
                     "Requires imbalanced-learn.",
      },
    ],
  });
}

module.exports = {
  uploadAndAnalyze,
  runMLAnalysis,
  runBuiltinAnalysis,
  getServiceStatus,
  listDatasets,
};
