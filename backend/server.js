/**
 * server.js
 * ─────────
 * Entry point. Creates the HTTP server from the Express app.
 */

const app = require("./src/app");
const { PORT } = require("./src/config/env");

const port = PORT || 5000;

app.listen(port, () => {
  console.log(`\n🚀  Nyaya AI Backend running on http://localhost:${port}`);
  console.log(`   Environment : ${process.env.NODE_ENV || "development"}\n`);
});
