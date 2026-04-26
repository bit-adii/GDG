/**
 * src/utils/encoder.js
 * ────────────────────
 * Pure-JS feature encoding utilities that mirror what the Python
 * preprocessing module does — used for quick in-memory validation
 * and descriptive stats before the data reaches the Python service.
 *
 * NOTE: The authoritative encoding for model training happens in
 *       Python (nyaya_ai/preprocessing.py).  This module is for
 *       lightweight JS-side data inspection only.
 */

/** Education levels in ordinal order */
const EDUCATION_ORDER = ["High School", "Bachelors", "Masters", "PhD"];

/**
 * Encode a single education-level string to an integer 0-3.
 * Returns -1 if the value is unrecognised.
 *
 * @param {string} level
 * @returns {number}
 */
function encodeEducation(level) {
  const idx = EDUCATION_ORDER.findIndex(
    (e) => e.toLowerCase() === String(level).toLowerCase().trim()
  );
  return idx; // -1 if not found
}

/**
 * Encode a gender string to 0 (Male) or 1 (Female).
 * Returns -1 for unrecognised values.
 *
 * @param {string} gender
 * @returns {number}
 */
function encodeGender(gender) {
  const g = String(gender).toLowerCase().trim();
  if (g === "male")   return 0;
  if (g === "female") return 1;
  return -1;
}

/**
 * Summarise a numeric array: { min, max, mean, std }.
 *
 * @param {number[]} values
 * @returns {{ min: number, max: number, mean: number, std: number }}
 */
function numericSummary(values) {
  if (!values || values.length === 0) {
    return { min: null, max: null, mean: null, std: null };
  }
  const n    = values.length;
  const min  = Math.min(...values);
  const max  = Math.max(...values);
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
  return {
    min:  +min.toFixed(4),
    max:  +max.toFixed(4),
    mean: +mean.toFixed(4),
    std:  +Math.sqrt(variance).toFixed(4),
  };
}

module.exports = { encodeEducation, encodeGender, numericSummary, EDUCATION_ORDER };
