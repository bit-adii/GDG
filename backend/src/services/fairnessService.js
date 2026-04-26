/**
 * src/services/fairnessService.js
 * ───────────────────────────────
 * Aggregates fairness information and generates a structured fairness report.
 *
 * Combines:
 *  • JS-computed metrics   (fast, always available)
 *  • ML-powered results    (from Python service, if available)
 *
 * The report structure is what the frontend chart components consume.
 */

const { computeAllMetrics, FAIR_THRESHOLD, MODERATE_THRESHOLD } =
  require("../utils/metrics");

/**
 * Build the complete fairness report for the BEFORE state.
 *
 * @param {object[]} rows        - raw CSV rows
 * @param {object|null} mlResult - result from Python service (or null)
 * @returns {object}
 */
function buildFairnessReport(rows, mlResult = null) {
  // JS-computed ground-truth metrics (on the raw labels – no model)
  const groundTruth = computeAllMetrics(rows, "gender", "shortlisted");

  // Determine which data source is authoritative for display
  const authoritative = mlResult ? mlResult.before : groundTruth;

  // Format chart-ready data
  const selectionRateChart = Object.entries(
    authoritative.selectionRates || authoritative.selection_rates || {}
  ).map(([group, rate]) => ({
    group,
    rate: +(rate * 100).toFixed(2),     // convert to percentage
  }));

  const disparateImpact =
    authoritative.disparateImpact ?? authoritative.disparate_impact ?? 0;
  const fs =
    authoritative.fairnessScore ?? authoritative.fairness_score ?? 0;

  return {
    groundTruth,
    selectionRateChart,
    disparateImpact: +disparateImpact.toFixed(4),
    fairnessScore:   fs,
    fairnessLabel:   fairnessLabel(fs),
    biasExists:      disparateImpact < 0.80,
    privileged:
      authoritative.privilegedGroup ?? authoritative.privileged ?? "N/A",
    disadvantaged:
      authoritative.disadvantagedGroup ?? authoritative.disadvantaged ?? "N/A",
    // Forward ML insights if available
    mlInsights:      mlResult?.before?.insights || [],
  };
}

/**
 * Build the AFTER (post-mitigation) fairness report.
 *
 * @param {object|null} mlResult
 * @returns {object}
 */
function buildMitigationReport(mlResult) {
  if (!mlResult || !mlResult.after) {
    return { error: "ML mitigation results not available" };
  }

  const { before, after, comparison } = mlResult;

  const selectionRateChart = ["before", "after"].map((stage) => {
    const src = stage === "before" ? before : after;
    const rates = src.selection_rates || src.selectionRates || {};
    return {
      stage,
      ...Object.fromEntries(
        Object.entries(rates).map(([g, r]) => [g, +(r * 100).toFixed(2)])
      ),
    };
  });

  return {
    before: {
      disparateImpact: before.disparate_impact,
      fairnessScore:   before.fairness_score,
      fairnessLabel:   fairnessLabel(before.fairness_score),
      selectionRates:  before.selection_rates,
      insights:        before.insights || [],
    },
    after: {
      disparateImpact: after.disparate_impact,
      fairnessScore:   after.fairness_score,
      fairnessLabel:   fairnessLabel(after.fairness_score),
      selectionRates:  after.selection_rates,
      insights:        after.insights || [],
    },
    comparison: {
      disparateImpactDelta: comparison?.di_delta ?? 0,
      fairnessScoreDelta:   comparison?.fs_delta ?? 0,
      improved:             comparison?.improved ?? false,
    },
    selectionRateChart,
  };
}

/**
 * Human-readable risk label for a Fairness Score.
 * @param {number} score
 */
function fairnessLabel(score) {
  if (score >= FAIR_THRESHOLD)     return "Fair";
  if (score >= MODERATE_THRESHOLD) return "Moderate Risk";
  return "High Bias";
}

module.exports = { buildFairnessReport, buildMitigationReport };
