/**
 * src/utils/metrics.js
 * ────────────────────
 * Pure-JS fairness metric calculations.
 *
 * These are used by biasService.js to compute lightweight metrics
 * directly from the raw CSV rows without calling Python.
 *
 * Metrics implemented
 * ───────────────────
 *  • Selection rate per group
 *  • Disparate Impact  (minority_rate / majority_rate)
 *  • Fairness Score    (DI × 100, capped at 100)
 *  • Statistical Parity Difference (rate_privileged − rate_disadvantaged)
 */

const FAIR_THRESHOLD     = 80;
const MODERATE_THRESHOLD = 60;

/**
 * Compute per-group selection rates.
 *
 * @param {object[]} rows         - CSV rows as objects
 * @param {string}   groupCol     - column name of the sensitive attribute
 * @param {string}   outcomeCol   - column name of the binary outcome (0/1)
 * @returns {{ [group: string]: number }}
 */
function selectionRates(rows, groupCol = "gender", outcomeCol = "shortlisted") {
  const groups = {};

  rows.forEach((row) => {
    const g = String(row[groupCol]).trim();
    const o = parseInt(row[outcomeCol], 10);
    if (!groups[g]) groups[g] = { total: 0, selected: 0 };
    groups[g].total    += 1;
    groups[g].selected += isNaN(o) ? 0 : o;
  });

  const rates = {};
  Object.entries(groups).forEach(([g, { total, selected }]) => {
    rates[g] = total > 0 ? +(selected / total).toFixed(4) : 0;
  });
  return rates;
}

/**
 * Compute Disparate Impact from a selection-rates map.
 * DI = min(rate) / max(rate)  →  range [0, 1]
 *
 * @param {{ [group: string]: number }} rates
 * @returns {{ disparateImpact: number, privileged: string, disadvantaged: string }}
 */
function disparateImpact(rates) {
  const entries     = Object.entries(rates);
  const privileged  = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  const disadv      = entries.reduce((a, b) => (b[1] < a[1] ? b : a));

  const di =
    privileged[1] === 0
      ? 1.0
      : +(disadv[1] / privileged[1]).toFixed(4);

  return {
    disparateImpact: di,
    privileged:      privileged[0],
    disadvantaged:   disadv[0],
  };
}

/**
 * Convert a Disparate Impact value to a Fairness Score (0–100).
 *
 * @param {number} di
 * @returns {number}
 */
function fairnessScore(di) {
  return Math.min(Math.round(di * 100), 100);
}

/**
 * Map a Fairness Score to a risk label.
 *
 * @param {number} score
 * @returns {"Fair"|"Moderate Risk"|"High Bias"}
 */
function fairnessLabel(score) {
  if (score >= FAIR_THRESHOLD)     return "Fair";
  if (score >= MODERATE_THRESHOLD) return "Moderate Risk";
  return "High Bias";
}

/**
 * Statistical Parity Difference = rate_privileged − rate_disadvantaged.
 * Negative values mean the disadvantaged group has a LOWER selection rate.
 *
 * @param {number} ratePriv
 * @param {number} rateDisadv
 * @returns {number}
 */
function statisticalParityDifference(ratePriv, rateDisadv) {
  return +(ratePriv - rateDisadv).toFixed(4);
}

/**
 * Master function: compute all fairness metrics for a dataset.
 *
 * @param {object[]} rows
 * @param {string}   groupCol
 * @param {string}   outcomeCol
 * @returns {object}  Full metrics object
 */
function computeAllMetrics(rows, groupCol = "gender", outcomeCol = "shortlisted") {
  const rates = selectionRates(rows, groupCol, outcomeCol);
  const { disparateImpact: di, privileged, disadvantaged } = disparateImpact(rates);
  const fs    = fairnessScore(di);
  const label = fairnessLabel(fs);
  const spd   = statisticalParityDifference(
    rates[privileged] || 0,
    rates[disadvantaged] || 0
  );
  const biasExists = di < 0.80;

  return {
    selectionRates:             rates,
    disparateImpact:            di,
    privilegedGroup:            privileged,
    disadvantagedGroup:         disadvantaged,
    fairnessScore:              fs,
    fairnessLabel:              label,
    statisticalParityDiff:      spd,
    biasExists,
    totalRows:                  rows.length,
  };
}

module.exports = {
  selectionRates,
  disparateImpact,
  fairnessScore,
  fairnessLabel,
  statisticalParityDifference,
  computeAllMetrics,
  FAIR_THRESHOLD,
  MODERATE_THRESHOLD,
};
