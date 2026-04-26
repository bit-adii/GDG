/**
 * src/utils/csvParser.js
 * ──────────────────────
 * Parses a CSV file (from disk path or Buffer) into an array of row objects.
 *
 * Uses the fast `csv-parse` library (sync API for simplicity).
 *
 * Expected CSV columns (flexible – any subset is accepted):
 *   gender, age, education_level, experience_years,
 *   screening_score, shortlisted, bias_flag
 */

const { parse } = require("csv-parse/sync");
const fs        = require("fs");

/**
 * Parse a CSV file from a Buffer or a file-system path.
 *
 * @param {Buffer|string} source  Buffer of file contents OR absolute path string
 * @returns {{ headers: string[], rows: object[], count: number }}
 */
function parseCSV(source) {
  let content;

  if (Buffer.isBuffer(source)) {
    content = source.toString("utf-8");
  } else if (typeof source === "string") {
    content = fs.readFileSync(source, "utf-8");
  } else {
    throw new TypeError("csvParser: source must be a Buffer or file path string");
  }

  const records = parse(content, {
    columns:          true,   // first row → column names
    skip_empty_lines: true,
    trim:             true,
    cast:             true,   // auto-cast numbers / booleans
  });

  if (!records || records.length === 0) {
    throw new Error("CSV is empty or has no data rows");
  }

  return {
    headers: Object.keys(records[0]),
    rows:    records,
    count:   records.length,
  };
}

/**
 * Validate that the parsed CSV contains at minimum the required columns.
 *
 * @param {string[]} headers
 * @param {string[]} required
 */
function validateHeaders(headers, required = ["gender", "shortlisted"]) {
  const lc      = headers.map((h) => h.toLowerCase());
  const missing = required.filter((r) => !lc.includes(r.toLowerCase()));
  if (missing.length > 0) {
    throw new Error(
      `CSV is missing required columns: ${missing.join(", ")}`
    );
  }
}

module.exports = { parseCSV, validateHeaders };
