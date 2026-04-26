/**
 * src/services/biasService.js
 * ───────────────────────────
 * Detects gender bias in a hiring dataset using pure-JS metric calculations.
 *
 * This service is intentionally self-contained (no Python call) so the
 * front-end can get FAST bias indicators even when the Python service is
 * unavailable.  The deep ML-based analysis is done by modelService.js.
 *
 * Metrics computed
 * ────────────────
 *  • Selection rate per gender group
 *  • Disparate Impact  (DI < 0.8 = illegal adverse impact)
 *  • Fairness Score    (0–100)
 *  • Statistical Parity Difference
 *  • Per-education-level breakdown
 *  • Per-age-bucket breakdown
 */

const { computeAllMetrics, selectionRates } = require("../utils/metrics");

/** Age buckets for cross-tab analysis */
const AGE_BUCKETS = [
  { label: "Under 25",  min: 0,   max: 24  },
  { label: "25–34",     min: 25,  max: 34  },
  { label: "35–44",     min: 35,  max: 44  },
  { label: "45+",       min: 45,  max: Infinity },
];

/**
 * Bucket a numeric age into a label.
 * @param {number} age
 * @returns {string}
 */
function ageBucket(age) {
  const n = parseInt(age, 10);
  for (const b of AGE_BUCKETS) {
    if (n >= b.min && n <= b.max) return b.label;
  }
  return "Unknown";
}

/**
 * Run all bias-detection metrics on the given rows.
 *
 * @param {object[]} rows  - CSV rows as parsed objects
 * @returns {object}       - Full bias report
 */
function detectBias(rows) {
  // ── Core gender fairness metrics ──────────────────────────────────── //
  const core = computeAllMetrics(rows, "gender", "shortlisted");

  // ── Education-level breakdown ──────────────────────────────────────── //
  const educationGroups = {};
  rows.forEach((r) => {
    const edu = String(r["education_level"] || "Unknown").trim();
    if (!educationGroups[edu]) educationGroups[edu] = [];
    educationGroups[edu].push(r);
  });

  const byEducation = {};
  Object.entries(educationGroups).forEach(([edu, eduRows]) => {
    byEducation[edu] = computeAllMetrics(eduRows, "gender", "shortlisted");
  });

  // ── Age-bucket breakdown ───────────────────────────────────────────── //
  const ageBuckets = {};
  rows.forEach((r) => {
    const bucket = ageBucket(r["age"]);
    if (!ageBuckets[bucket]) ageBuckets[bucket] = [];
    ageBuckets[bucket].push(r);
  });

  const byAge = {};
  Object.entries(ageBuckets).forEach(([bucket, bucketRows]) => {
    byAge[bucket] = computeAllMetrics(bucketRows, "gender", "shortlisted");
  });

  // ── Bias summary narrative ─────────────────────────────────────────── //
  const { disadvantagedGroup, privilegedGroup, selectionRates: rates,
          disparateImpact, fairnessScore, biasExists } = core;

  const rateDisadv = rates[disadvantagedGroup] || 0;
  const ratePriv   = rates[privilegedGroup]    || 0;
  const pctGap     = Math.abs(ratePriv - rateDisadv) * 100;

  const narrative = biasExists
    ? `${disadvantagedGroup} candidates are ${pctGap.toFixed(1)}% less likely to be ` +
      `selected than ${privilegedGroup} candidates. ` +
      `Disparate Impact = ${disparateImpact.toFixed(3)} (threshold: 0.80). ` +
      `Immediate mitigation is recommended.`
    : `No significant bias detected between ${privilegedGroup} and ` +
      `${disadvantagedGroup} candidates. ` +
      `Disparate Impact = ${disparateImpact.toFixed(3)} — meets the 80% rule.`;

  return {
    summary:     core,
    byEducation,
    byAge,
    narrative,
  };
}

module.exports = { detectBias };
