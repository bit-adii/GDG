/**
 * src/services/modelService.js
 * ────────────────────────────
 * Bridge between the Node.js backend and the Python Nyaya AI Flask service.
 *
 * Responsibilities
 * ────────────────
 *  • Health-check the Python service before calling it
 *  • POST /analyze to the Python service with dataset and mitigation params
 *  • Return the structured JSON response (before/after metrics, insights)
 *  • Handle timeouts and connection errors gracefully
 *
 * The Python service (nyaya_ai/api_service.py) must be running on
 * PYTHON_SERVICE_URL (default: http://localhost:5001).
 */

const axios                 = require("axios");
const { PYTHON_SERVICE_URL } = require("../config/env");

const TIMEOUT_MS = 120_000; // 2 minutes – ML training can be slow

/**
 * Check whether the Python ML service is reachable.
 *
 * @returns {Promise<boolean>}
 */
async function isPythonServiceHealthy() {
  try {
    const res = await axios.get(`${PYTHON_SERVICE_URL}/health`, {
      timeout: 5000,
    });
    return res.data?.status === "ok";
  } catch {
    return false;
  }
}

/**
 * Run the full Nyaya AI pipeline on a built-in dataset.
 *
 * The Python service uses its own copy of the CSV files (in backend/src/data/).
 * We pass the dataset key ("biased" or "fair") and the mitigation technique.
 *
 * @param {object}  opts
 * @param {string}  opts.dataset      - "biased" | "fair"
 * @param {string}  opts.mitigation   - "reweighting" | "smote"
 * @returns {Promise<object>}         - full pipeline result from Python
 */
async function runFullPipeline({ dataset = "biased", mitigation = "reweighting" } = {}) {
  const healthy = await isPythonServiceHealthy();
  if (!healthy) {
    throw Object.assign(
      new Error(
        "Python ML service is not reachable. " +
        `Make sure it is running at ${PYTHON_SERVICE_URL}. ` +
        "Start it with: py -m nyaya_ai.api_service"
      ),
      { status: 503 }
    );
  }

  const response = await axios.post(
    `${PYTHON_SERVICE_URL}/analyze`,
    { dataset, mitigation },
    { timeout: TIMEOUT_MS }
  );

  return response.data;
}

/**
 * Lightweight wrapper: just check Python health and return status info.
 *
 * @returns {Promise<{ healthy: boolean, url: string }>}
 */
async function getPythonServiceStatus() {
  const healthy = await isPythonServiceHealthy();
  return { healthy, url: PYTHON_SERVICE_URL };
}

module.exports = { runFullPipeline, isPythonServiceHealthy, getPythonServiceStatus };
