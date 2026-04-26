# Nyaya AI – Bias Detection & Fairness Evaluation System

> A modular Python ML pipeline for detecting and mitigating gender bias in AI-based hiring decisions.

---

## 🗂️ Project Structure

```
GDG/
├── backend/
│   └── src/
│       └── data/
│           ├── biased_dataset.csv     ← Synthetic biased hiring data
│           └── fair_dataset.csv       ← Synthetic fair hiring data
└── ml/
    ├── requirements.txt
    ├── reports/                       ← Auto-generated PNG charts
    └── nyaya_ai/
        ├── __init__.py
        ├── preprocessing.py           ← Stage 1: Load & preprocess
        ├── model.py                   ← Stage 2: Train Logistic Regression
        ├── fairness.py                ← Stage 3: Bias detection & metrics
        ├── mitigation.py              ← Stage 5: Reweighting / SMOTE
        ├── explainer.py               ← Stage 6: Plain-English insights
        ├── visualizer.py              ← Stage 8: Charts (before vs after)
        ├── pipeline.py                ← Master runner (CLI)
        └── api_service.py             ← Flask HTTP service for Node.js
```

---

## 📦 Installation

```bash
cd GDG/ml
pip install -r requirements.txt
```

---

## ▶️ Running the Pipeline

### CLI (standalone)

```bash
# From GDG/ml/
python -m nyaya_ai.pipeline --dataset biased --mitigation reweighting
python -m nyaya_ai.pipeline --dataset biased --mitigation smote
python -m nyaya_ai.pipeline --dataset fair   --mitigation reweighting
```

**Options:**

| Flag | Values | Default | Description |
|------|--------|---------|-------------|
| `--dataset` | `biased`, `fair` | `biased` | Which CSV to use |
| `--mitigation` | `reweighting`, `smote`, `none` | `reweighting` | Mitigation technique |
| `--test-size` | float 0–1 | `0.20` | Test split fraction |
| `--seed` | int | `42` | Random seed |

### As a Flask API (for Node.js backend)

```bash
python -m nyaya_ai.api_service        # starts on http://localhost:5001
```

**Endpoints:**

```
GET  /health
POST /analyze   { "dataset": "biased", "mitigation": "reweighting" }
```

---

## 🔬 Pipeline Stages

| Stage | Module | Description |
|-------|--------|-------------|
| 1 | `preprocessing.py` | Load CSV, impute NaNs, encode gender & education, train/test split |
| 2 | `model.py` | Train `StandardScaler → LogisticRegression` pipeline |
| 3 | `fairness.py` | Compute selection rates, Disparate Impact, Fairness Score |
| 4 | `explainer.py` | Generate plain-English bias insights |
| 5 | `mitigation.py` | Reweighting (default) or SMOTE |
| 6 | `model.py` | Retrain model with mitigation applied |
| 7 | `fairness.py` | Re-evaluate fairness on mitigated model |
| 8 | `explainer.py` + `visualizer.py` | Compare before/after, save PNG charts |

---

## 📊 Fairness Metrics

| Metric | Formula | Threshold |
|--------|---------|-----------|
| **Selection Rate** | selected / total per group | — |
| **Disparate Impact** | min(rate) / max(rate) | ≥ 0.80 = OK (EEOC 4/5ths rule) |
| **Fairness Score** | DI × 100 (capped at 100) | ≥ 80 = Fair, ≥ 60 = Moderate, < 60 = High Bias |

---

## 🛠️ Mitigation Techniques

### 1. Reweighting (Default)
Assigns higher training weights to underrepresented group samples. The dataset is unchanged; only the LogisticRegression loss weighting changes.

```
w(x) = N / (N_group × k)
```

### 2. SMOTE
Generates synthetic minority-class samples to balance the `shortlisted` class distribution. Requires `imbalanced-learn`.

---

## 📈 Sample Output

```
  Fairness Analysis – Before Mitigation
  ═══════════════════════════════════════════════════════
  Sensitive attribute : gender_raw
  Selection rate [   Male] : 32.50%
  Selection rate [ Female] :  9.80%

  Privileged group    : Male   (rate = 32.50%)
  Disadvantaged group : Female (rate = 9.80%)

  Disparate Impact    : 0.3015  ⚠  < 0.80 → BIAS DETECTED
  Fairness Score      : 30 / 100
  Verdict             : 🚨  HIGH BIAS

  ─────────────────────────────────────────────
  📊  Mitigation Impact Summary
  Disparate Impact : 0.302 → 0.784  (▲ +0.482)
  Fairness Score   : 30/100 → 78/100  (▲ +48 pts)
  Female selection rate: 9.8% → 25.6%  (▲ +15.8pp)

  ✅  Mitigation IMPROVED fairness by 48 points.
```

---

## 🌐 API Response Format

```json
{
  "dataset": "biased",
  "mitigation": "reweighting",
  "before": {
    "selection_rates": { "Male": 0.325, "Female": 0.098 },
    "disparate_impact": 0.3015,
    "fairness_score": 30,
    "bias_exists": true,
    "verdict": "🚨  HIGH BIAS",
    "disadvantaged": "Female",
    "insights": ["Female candidates have a selection rate of 9.8% ..."]
  },
  "after": {
    "selection_rates": { "Male": 0.326, "Female": 0.256 },
    "disparate_impact": 0.784,
    "fairness_score": 78,
    "bias_exists": true,
    "verdict": "⚠️  MODERATE RISK",
    "insights": ["Female candidates have a selection rate of 25.6% ..."]
  },
  "comparison": {
    "di_delta": 0.4825,
    "fs_delta": 48,
    "improved": true
  }
}
```
