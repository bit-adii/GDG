/**
 * src/services/recommendationService.js
 * ──────────────────────────────────────
 * Generates actionable recommendations based on the bias analysis results.
 *
 * Returns a structured list of recommendations the frontend can display
 * in a "What to do next?" panel.
 *
 * Recommendation categories
 * ─────────────────────────
 *  • CRITICAL  – immediate action required (High Bias)
 *  • WARNING   – action advised (Moderate Risk)
 *  • INFO      – monitoring tips (Fair)
 */

const { FAIR_THRESHOLD, MODERATE_THRESHOLD } = require("../utils/metrics");

/**
 * Generate recommendations from a fairness metrics object.
 *
 * @param {object}  metrics
 * @param {number}  metrics.fairnessScore
 * @param {number}  metrics.disparateImpact
 * @param {string}  metrics.disadvantagedGroup
 * @param {string}  metrics.privilegedGroup
 * @param {object}  metrics.selectionRates
 * @param {boolean} metrics.biasExists
 * @returns {{ level: string, title: string, description: string, action: string }[]}
 */
function generateRecommendations(metrics) {
  const {
    fairnessScore,
    disparateImpact,
    disadvantagedGroup,
    privilegedGroup,
    selectionRates = {},
    biasExists,
  } = metrics;

  const recs = [];

  // ── CRITICAL bias ───────────────────────────────────────────────────── //
  if (fairnessScore < MODERATE_THRESHOLD) {
    recs.push({
      level:       "CRITICAL",
      title:       "Apply Bias Mitigation Immediately",
      description: `The model shows HIGH BIAS against ${disadvantagedGroup} candidates ` +
                   `(Disparate Impact = ${disparateImpact.toFixed(3)}). ` +
                   "This may violate EEOC adverse-impact guidelines.",
      action:      "Run the Nyaya AI pipeline with reweighting or SMOTE mitigation.",
    });
    recs.push({
      level:       "CRITICAL",
      title:       `Audit Training Labels for ${disadvantagedGroup}`,
      description: `Selection rate for ${disadvantagedGroup} is ` +
                   `${((selectionRates[disadvantagedGroup] || 0) * 100).toFixed(1)}% ` +
                   `vs ${((selectionRates[privilegedGroup] || 0) * 100).toFixed(1)}% ` +
                   `for ${privilegedGroup}. Systematic label bias is likely present.`,
      action:      "Review historical hiring decisions and remove discriminatory signals.",
    });
  }

  // ── MODERATE bias ───────────────────────────────────────────────────── //
  if (fairnessScore >= MODERATE_THRESHOLD && fairnessScore < FAIR_THRESHOLD) {
    recs.push({
      level:       "WARNING",
      title:       "Consider Reweighting the Training Data",
      description: `Disparate Impact = ${disparateImpact.toFixed(3)} is approaching ` +
                   "the 0.80 threshold. While not yet illegal, it indicates systemic disparity.",
      action:      "Apply sample reweighting (Kamiran & Calders method) and retrain.",
    });
    recs.push({
      level:       "WARNING",
      title:       "Increase Monitoring Frequency",
      description: "Monitor fairness metrics every 30 days or after any model update.",
      action:      "Schedule regular Nyaya AI audits as part of your MLOps pipeline.",
    });
  }

  // ── FAIR ────────────────────────────────────────────────────────────── //
  if (fairnessScore >= FAIR_THRESHOLD) {
    recs.push({
      level:       "INFO",
      title:       "Model Meets Fairness Threshold",
      description: `Disparate Impact = ${disparateImpact.toFixed(3)} — above the legal 80% rule. ` +
                   "No immediate action required.",
      action:      "Continue periodic fairness audits to catch future drift.",
    });
  }

  // ── Always-on recommendations ────────────────────────────────────────── //
  recs.push({
    level:       "INFO",
    title:       "Remove Proxies for Protected Attributes",
    description: "Features like zip code, school name, or interview panel composition " +
                 "can act as proxies for gender, race, or socioeconomic background.",
    action:      "Review all features with a fairness-aware feature-importance audit.",
  });

  recs.push({
    level:       "INFO",
    title:       "Establish a Human-in-the-Loop Review",
    description: "AI screening should augment, not replace, human judgment. " +
                 "Borderline decisions should always be reviewed by a recruiter.",
    action:      "Define a confidence threshold below which all predictions go to manual review.",
  });

  return recs;
}

module.exports = { generateRecommendations };
