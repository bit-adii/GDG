/**
 * src/middleware/uploadMiddleware.js
 * ──────────────────────────────────
 * Multer-based file upload middleware.
 *
 * Accepts a single CSV file under the field name "dataset".
 * Stores the file in memory (as a Buffer) so it can be passed
 * directly to the csv-parse library without writing to disk.
 *
 * File constraints:
 *  - MIME type must be text/csv or application/octet-stream
 *  - Size limit: MAX_FILE_SIZE_MB (from .env, default 10 MB)
 */

const multer                  = require("multer");
const { MAX_FILE_SIZE_MB }    = require("../config/env");

// Store uploaded file entirely in memory
const storage = multer.memoryStorage();

/**
 * File filter – accept only CSV files.
 */
function fileFilter(req, file, cb) {
  const allowed = ["text/csv", "application/csv", "application/octet-stream",
                   "text/plain", "text/x-csv"];
  const ext     = file.originalname.split(".").pop().toLowerCase();

  if (allowed.includes(file.mimetype) || ext === "csv") {
    return cb(null, true);
  }
  cb(
    Object.assign(new Error("Only CSV files are accepted"), { status: 400 }),
    false
  );
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
});

/**
 * uploadSingle – middleware that accepts exactly one file with field "dataset".
 * Wraps multer's callback-based error in a next(err) call.
 */
function uploadSingle(req, res, next) {
  upload.single("dataset")(req, res, (err) => {
    if (!err) return next();

    if (err.code === "LIMIT_FILE_SIZE") {
      return next(
        Object.assign(
          new Error(`File exceeds the ${MAX_FILE_SIZE_MB} MB limit`),
          { status: 413 }
        )
      );
    }
    next(err);
  });
}

module.exports = { uploadSingle };
