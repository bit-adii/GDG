/* ============================================================
   Nyaya AI  —  Dashboard Script
   Connects to Node.js backend at http://localhost:5000
   ============================================================ */

const API = "http://localhost:5000/api/v1";

// ── Service health check on page load ────────────────────────
window.addEventListener("DOMContentLoaded", checkStatus);

async function checkStatus() {
  const nodeEl = document.getElementById("nodeStatus");
  const pyEl   = document.getElementById("pyStatus");

  try {
    const res  = await fetch(`${API}/analyze/status`, { signal: AbortSignal.timeout(4000) });
    const data = await res.json();

    nodeEl.classList.add(data.success ? "online" : "offline");
    pyEl.classList.add(data.data?.pythonService?.healthy ? "online" : "offline");
  } catch {
    nodeEl.classList.add("offline");
    pyEl.classList.add("offline");
  }
}

// ── Run ML Pipeline (POST /analyze/ml) ───────────────────────
async function runPipeline() {
  const dataset    = document.getElementById("datasetSelect").value;
  const mitigation = document.getElementById("mitigationSelect").value;
  const btn        = document.getElementById("runBtn");

  showLoading(true);
  btn.disabled = true;
  hideResults();
  closeToast();

  try {
    const res = await fetch(`${API}/analyze/ml`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ dataset, mitigation }),
      signal:  AbortSignal.timeout(150_000),   // 2.5 min timeout
    });

    const json = await res.json();
    if (!json.success) throw new Error(json.message || "Pipeline failed");

    renderResults(json.data);
  } catch (err) {
    showToast(err.message || "Could not reach the backend. Is it running on port 5000?");
  } finally {
    showLoading(false);
    btn.disabled = false;
  }
}

// ── Upload own CSV (POST /analyze/upload) ────────────────────
async function uploadCSV() {
  const file = document.getElementById("csvFile").files[0];
  if (!file) return;

  document.querySelector(".upload-text").textContent = `📄 ${file.name}`;

  const formData = new FormData();
  formData.append("dataset", file);

  showLoading(true);
  hideResults();
  closeToast();

  try {
    const res  = await fetch(`${API}/analyze/upload`, {
      method: "POST",
      body:   formData,
      signal: AbortSignal.timeout(30_000),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || "Upload analysis failed");

    renderUploadResults(json.data);
  } catch (err) {
    showToast(err.message || "Upload failed.");
  } finally {
    showLoading(false);
  }
}

// ── Render full ML pipeline results ──────────────────────────
function renderResults(data) {
  const { mitigationReport, recommendations, dataset, mitigation } = data;

  if (!mitigationReport || !mitigationReport.before) {
    showToast("Unexpected response from server.");
    return;
  }

  const { before, after, comparison } = mitigationReport;

  // ─ Score cards ─
  const scoresRow = document.getElementById("scoresRow");
  scoresRow.innerHTML = "";

  addScoreCard(scoresRow, "Before — Fairness Score",
    `${before.fairnessScore}/100`, verdictClass(before.fairnessScore), before.fairnessLabel);
  addScoreCard(scoresRow, "After — Fairness Score",
    `${after.fairnessScore}/100`, verdictClass(after.fairnessScore), after.fairnessLabel);
  addScoreCard(scoresRow, "Disparate Impact (Before)",
    before.disparateImpact.toFixed(3), before.disparateImpact < 0.8 ? "val-red" : "val-green",
    before.disparateImpact < 0.8 ? "Below 0.80 ⚠" : "Above 0.80 ✓");
  addScoreCard(scoresRow, "Disparate Impact (After)",
    after.disparateImpact.toFixed(3), after.disparateImpact < 0.8 ? "val-red" : "val-green",
    after.disparateImpact < 0.8 ? "Below 0.80 ⚠" : "Above 0.80 ✓");
  addScoreCard(scoresRow, "Improvement",
    `+${comparison.fairnessScoreDelta} pts`, "val-purple", "Fairness Score delta");

  // ─ Comparison cards ─
  const grid = document.getElementById("comparisonGrid");
  grid.innerHTML = "";
  grid.appendChild(makeCompareCard("before", before));
  grid.appendChild(makeCompareCard("after", after));

  // ─ Selection rate bars ─
  const srCard = document.getElementById("selectionRateCard");
  srCard.innerHTML = `<div class="section-title">📊 Selection Rates by Gender</div>`;

  if (mitigationReport.selectionRateChart) {
    const rateRow = document.createElement("div");
    rateRow.className = "rate-row";

    // Build from before and after selection_rates
    const groups   = Object.keys(before.selectionRates || {});
    const colors   = ["#6c8aff", "#a78bfa", "#22d3a5", "#f59e0b"];

    groups.forEach((group, idx) => {
      const bRate = (before.selectionRates[group] || 0) * 100;
      const aRate = (after.selectionRates[group]  || 0) * 100;
      const col   = colors[idx % colors.length];

      rateRow.appendChild(makeRateBar(`${group} (Before)`, bRate, col));
      rateRow.appendChild(makeRateBar(`${group} (After)`, aRate, col, 0.55));
    });

    srCard.appendChild(rateRow);
  }

  // ─ Insights ─
  const insightsCard = document.getElementById("insightsCard");
  insightsCard.innerHTML = `<div class="section-title">💡 AI Insights</div>`;

  const allInsights = [...(before.insights || []), ...(after.insights || [])];
  if (allInsights.length) {
    const ul = document.createElement("ul");
    ul.className = "insight-list";
    allInsights.forEach((txt, i) => {
      const li = document.createElement("li");
      li.className = "insight-item";
      li.innerHTML = `<span class="insight-num">${i+1}</span><span>${txt}</span>`;
      ul.appendChild(li);
    });
    insightsCard.appendChild(ul);
  } else {
    insightsCard.innerHTML += `<p style="color:var(--text-muted);font-size:.85rem">No insights returned.</p>`;
  }

  // ─ Recommendations ─
  renderRecommendations(recommendations);

  showResults();
  animateBars();
}

// ── Render upload-only (JS metrics) results ───────────────────
function renderUploadResults(data) {
  const { bias, fairness, recommendations, dataset: ds } = data;

  const scoresRow = document.getElementById("scoresRow");
  scoresRow.innerHTML = "";

  const gt = fairness.groundTruth;
  addScoreCard(scoresRow, "Fairness Score",
    `${gt.fairnessScore}/100`, verdictClass(gt.fairnessScore), gt.fairnessLabel);
  addScoreCard(scoresRow, "Disparate Impact",
    gt.disparateImpact.toFixed(3), gt.disparateImpact < 0.8 ? "val-red" : "val-green",
    gt.biasExists ? "Bias Detected ⚠" : "Passes 80% Rule ✓");
  addScoreCard(scoresRow, "Total Rows",
    ds.rowCount.toLocaleString(), "val-blue", "Dataset size");
  addScoreCard(scoresRow, "Selected",
    ds.shortlistedDist?.selected ?? "–", "val-green", "Shortlisted candidates");

  // Simple before-only compare
  const grid = document.getElementById("comparisonGrid");
  grid.innerHTML = "";
  grid.appendChild(makeCompareCard("before", {
    disparateImpact: gt.disparateImpact,
    fairnessScore:   gt.fairnessScore,
    fairnessLabel:   gt.fairnessLabel,
    selectionRates:  gt.selectionRates,
  }));

  // Selection rates
  const srCard = document.getElementById("selectionRateCard");
  srCard.innerHTML = `<div class="section-title">📊 Selection Rates by Gender</div>`;
  const rateRow = document.createElement("div");
  rateRow.className = "rate-row";
  const colors = ["#6c8aff","#a78bfa"];
  Object.entries(gt.selectionRates || {}).forEach(([g, r], i) => {
    rateRow.appendChild(makeRateBar(g, r * 100, colors[i % colors.length]));
  });
  srCard.appendChild(rateRow);

  // Narrative insight
  const insightsCard = document.getElementById("insightsCard");
  insightsCard.innerHTML = `<div class="section-title">💡 Bias Narrative</div>
    <ul class="insight-list">
      <li class="insight-item"><span class="insight-num">1</span><span>${bias.narrative}</span></li>
    </ul>`;

  renderRecommendations(recommendations);

  document.getElementById("comparisonGrid").style.gridTemplateColumns = "1fr";
  showResults();
  animateBars();
}

// ── Helpers ───────────────────────────────────────────────────

function addScoreCard(parent, label, value, cls, sub) {
  const el = document.createElement("div");
  el.className = "score-card fade-in";
  el.innerHTML = `
    <div class="score-card-label">${label}</div>
    <div class="score-card-value ${cls}">${value}</div>
    <div class="score-card-sub">${sub || ""}</div>`;
  parent.appendChild(el);
}

function makeCompareCard(stage, metrics) {
  const isAfter = stage === "after";
  const di      = metrics.disparateImpact ?? 0;
  const fs      = metrics.fairnessScore   ?? 0;
  const label   = metrics.fairnessLabel   || verdictLabel(fs);
  const vc      = fs >= 80 ? "verdict-fair" : fs >= 60 ? "verdict-moderate" : "verdict-bias";

  const card = document.createElement("div");
  card.className = `compare-card ${isAfter ? "after-card" : "before-card"} fade-in`;
  card.innerHTML = `
    <span class="compare-badge ${isAfter ? "badge-after" : "badge-before"}">
      ${isAfter ? "✓ After Mitigation" : "⚠ Before Mitigation"}
    </span>
    <div class="compare-di" style="color:${di < 0.8 ? "var(--red)" : "var(--green)"}">
      ${di.toFixed(3)}
    </div>
    <div class="compare-label">Disparate Impact</div>
    <div class="compare-di" style="font-size:1.6rem; color:${scoreColor(fs)}">
      ${fs}/100
    </div>
    <div class="compare-label">Fairness Score</div>
    <span class="compare-verdict ${vc}">${label}</span>`;

  // Per-group selection rates
  if (metrics.selectionRates) {
    const table = document.createElement("div");
    table.style.cssText = "margin-top:16px; display:flex; flex-direction:column; gap:6px;";
    Object.entries(metrics.selectionRates).forEach(([g, r]) => {
      const pct = (r * 100).toFixed(1);
      table.innerHTML += `
        <div style="display:flex;justify-content:space-between;font-size:.8rem;color:var(--text-secondary)">
          <span>${g}</span>
          <strong style="color:var(--text-primary)">${pct}% selected</strong>
        </div>`;
    });
    card.appendChild(table);
  }
  return card;
}

function makeRateBar(label, pct, color, opacity = 1) {
  const item = document.createElement("div");
  item.className = "rate-item";
  item.innerHTML = `
    <div class="rate-meta">
      <strong>${label}</strong>
      <span>${pct.toFixed(1)}%</span>
    </div>
    <div class="rate-bar-track">
      <div class="rate-bar-fill"
           data-width="${Math.min(pct, 100)}"
           style="background:${color}; opacity:${opacity}"></div>
    </div>`;
  return item;
}

function renderRecommendations(recs) {
  const card = document.getElementById("recommendationsCard");
  card.innerHTML = `<div class="section-title">🛡️ Recommendations</div>`;
  if (!recs || recs.length === 0) {
    card.innerHTML += `<p style="color:var(--text-muted);font-size:.85rem">No recommendations available.</p>`;
    return;
  }
  const icons = { CRITICAL: "🚨", WARNING: "⚠️", INFO: "ℹ️" };
  const list  = document.createElement("div");
  list.className = "rec-list";
  recs.forEach((r) => {
    const item = document.createElement("div");
    item.className = `rec-item ${r.level}`;
    item.innerHTML = `
      <span class="rec-icon">${icons[r.level] || "•"}</span>
      <div class="rec-body">
        <div class="rec-title">${r.title}</div>
        <div class="rec-desc">${r.description}</div>
        ${r.action ? `<div class="rec-action">→ ${r.action}</div>` : ""}
      </div>`;
    list.appendChild(item);
  });
  card.appendChild(list);
}

function animateBars() {
  setTimeout(() => {
    document.querySelectorAll(".rate-bar-fill").forEach((el) => {
      el.style.width = el.dataset.width + "%";
    });
  }, 100);
}

function verdictClass(score) {
  if (score >= 80) return "val-green";
  if (score >= 60) return "val-yellow";
  return "val-red";
}
function verdictLabel(score) {
  if (score >= 80) return "Fair";
  if (score >= 60) return "Moderate Risk";
  return "High Bias";
}
function scoreColor(score) {
  if (score >= 80) return "var(--green)";
  if (score >= 60) return "var(--yellow)";
  return "var(--red)";
}

// ── UI state helpers ──────────────────────────────────────────
function showLoading(show) {
  document.getElementById("loadingPanel").classList.toggle("hidden", !show);
}
function showResults() {
  document.getElementById("results").classList.remove("hidden");
}
function hideResults() {
  document.getElementById("results").classList.add("hidden");
  // reset grid
  document.getElementById("comparisonGrid").style.gridTemplateColumns = "";
}
function showToast(msg) {
  document.getElementById("errorMsg").textContent = msg;
  document.getElementById("errorToast").classList.remove("hidden");
}
function closeToast() {
  document.getElementById("errorToast").classList.add("hidden");
}
