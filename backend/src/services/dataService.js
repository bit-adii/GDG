/**
 * src/services/dataService.js
 * ───────────────────────────
 * Responsible for everything related to loading and describing a dataset.
 *
 * Capabilities
 * ────────────
 *  • Parse an uploaded CSV Buffer into structured rows
 *  • Validate that required columns exist
 *  • Compute column-level descriptive statistics (mean, std, min, max)
 *  • Return a dataset summary object consumed by the controller
 */

const { parseCSV, validateHeaders } = require("../utils/csvParser");
const { numericSummary }            = require("../utils/encoder");

// Columns we always expect to exist in a recruitment dataset
const REQUIRED_COLS = ["gender", "shortlisted"];

// Numeric columns we want to summarise
const NUMERIC_COLS = ["age", "experience_years", "screening_score"];

/**
 * Parse and describe a CSV dataset from a Buffer.
 *
 * @param {Buffer} fileBuffer   - raw file bytes from multer memory storage
 * @param {string} filename     - original filename (for labelling)
 * @returns {{ headers, rowCount, columnStats, sample, rawRows }}
 */
function loadDataset(fileBuffer, filename = "dataset.csv") {
  const { headers, rows } = parseCSV(fileBuffer);

  // Validate required columns
  validateHeaders(headers, REQUIRED_COLS);

  // Descriptive statistics for numeric columns
  const columnStats = {};
  NUMERIC_COLS.forEach((col) => {
    if (headers.map((h) => h.toLowerCase()).includes(col)) {
      const values = rows
        .map((r) => parseFloat(r[col]))
        .filter((v) => !isNaN(v));
      columnStats[col] = numericSummary(values);
    }
  });

  // Gender distribution
  const genderDist = {};
  rows.forEach((r) => {
    const g = String(r["gender"] || "Unknown").trim();
    genderDist[g] = (genderDist[g] || 0) + 1;
  });

  // Shortlisting distribution
  const shortlistedDist = { selected: 0, notSelected: 0 };
  rows.forEach((r) => {
    if (parseInt(r["shortlisted"], 10) === 1) shortlistedDist.selected++;
    else shortlistedDist.notSelected++;
  });

  return {
    filename,
    headers,
    rowCount:        rows.length,
    columnStats,
    genderDist,
    shortlistedDist,
    sample:          rows.slice(0, 5),  // first 5 rows for preview
    rawRows:         rows,              // full rows (passed to other services)
  };
}

module.exports = { loadDataset };
