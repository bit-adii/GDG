"""
nyaya_ai/fairness.py
====================
Step 3 – Bias Detection & Fairness Scoring

Computes the following fairness metrics across a sensitive attribute
(default: gender):

  ▸ Selection rate per group  – fraction of candidates selected in each group
  ▸ Disparate Impact (DI)     – ratio of selection rates (minority / majority)
                                 DI < 0.8 signals illegal adverse impact
                                 (the "80% rule" from the EEOC 4/5ths rule)
  ▸ Fairness Score (0–100)    – human-readable score derived from DI

Thresholds
----------
  Fairness Score ≥ 80   → Fair
  60 ≤ Score < 80       → Moderate Risk
  Score < 60            → High Bias
"""

import numpy as np
import pandas as pd


# --------------------------------------------------------------------------- #
#  FAIRNESS SCORE FORMULA
#  We map Disparate Impact → [0, 100] with a piecewise linear function:
#    DI ≥ 1.00  →  score 100  (perfect or inverted – cap at 100)
#    DI = 0.80  →  score  80  (the legal boundary)
#    DI = 0.00  →  score   0  (complete exclusion)
# --------------------------------------------------------------------------- #

FAIR_THRESHOLD     = 80   # score ≥ 80 → fair
MODERATE_THRESHOLD = 60   # score ≥ 60 → moderate risk


def _selection_rate(y_true, y_pred=None):
    """
    If y_pred is given return its selection rate, otherwise use y_true.
    This lets us call the function on ground-truth or model predictions.
    """
    arr = y_pred if y_pred is not None else y_true
    return float(np.mean(arr))


def compute_fairness_metrics(df_clean: pd.DataFrame,
                             y_pred: np.ndarray,
                             sensitive_col: str = "gender_raw",
                             label: str = "Analysis") -> dict:
    """
    Compute and print fairness metrics.

    Parameters
    ----------
    df_clean      : the processed DataFrame returned by preprocessing
                    (must contain sensitive_col)
    y_pred        : model predictions aligned with df_clean
    sensitive_col : column name of the sensitive attribute (default gender_raw)
    label         : string tag printed in the header

    Returns
    -------
    dict with keys:
        groups           – list of unique values in sensitive_col
        selection_rates  – dict {group_name: rate}
        privileged_group – group with the highest selection rate
        disparate_impact – DI value (minority / majority)
        fairness_score   – 0‑100 integer score
        bias_exists      – bool (True if DI < 0.80)
        disadvantaged    – group name that is disadvantaged
    """

    # Align predictions with df_clean (use iloc index)
    df = df_clean.copy().reset_index(drop=True)
    df["_y_pred"] = y_pred

    groups = df[sensitive_col].unique().tolist()

    # Selection rate per group
    selection_rates = {}
    for g in groups:
        mask = df[sensitive_col] == g
        rate = df.loc[mask, "_y_pred"].mean()
        selection_rates[g] = round(float(rate), 4)

    # Identify privileged (highest rate) and disadvantaged (lowest rate)
    privileged_group    = max(selection_rates, key=selection_rates.get)
    disadvantaged_group = min(selection_rates, key=selection_rates.get)

    rate_privileged    = selection_rates[privileged_group]
    rate_disadvantaged = selection_rates[disadvantaged_group]

    # Disparate Impact  (avoid division by zero)
    if rate_privileged == 0:
        disparate_impact = 1.0
    else:
        disparate_impact = round(rate_disadvantaged / rate_privileged, 4)

    # Fairness Score: linear mapping of DI ∈ [0, 1] → [0, 100], capped at 100
    fairness_score = int(min(disparate_impact * 100, 100))

    bias_exists = disparate_impact < 0.80

    # ------------------------------------------------------------------ #
    # Pretty print
    # ------------------------------------------------------------------ #
    print(f"\n{'='*55}")
    print(f"  Fairness Analysis – {label}")
    print(f"{'='*55}")
    print(f"  Sensitive attribute : {sensitive_col}")
    for g, r in selection_rates.items():
        print(f"  Selection rate [{g:>8}] : {r:.2%}")
    print(f"\n  Privileged group    : {privileged_group}  "
          f"(rate = {rate_privileged:.2%})")
    print(f"  Disadvantaged group : {disadvantaged_group}  "
          f"(rate = {rate_disadvantaged:.2%})")
    print(f"\n  Disparate Impact    : {disparate_impact:.4f}  "
          f"{'⚠  < 0.80 → BIAS DETECTED' if bias_exists else '✓  ≥ 0.80 → OK'}")
    print(f"  Fairness Score      : {fairness_score} / 100")

    if fairness_score >= FAIR_THRESHOLD:
        verdict = "✅  FAIR"
    elif fairness_score >= MODERATE_THRESHOLD:
        verdict = "⚠️   MODERATE RISK"
    else:
        verdict = "🚨  HIGH BIAS"

    print(f"  Verdict             : {verdict}")

    return {
        "groups":           groups,
        "selection_rates":  selection_rates,
        "privileged_group": privileged_group,
        "disparate_impact": disparate_impact,
        "fairness_score":   fairness_score,
        "bias_exists":      bias_exists,
        "disadvantaged":    disadvantaged_group,
        "verdict":          verdict,
    }


def fairness_score_to_label(score: int) -> str:
    """Map a numeric score to a human-readable risk label."""
    if score >= FAIR_THRESHOLD:
        return "Fair"
    elif score >= MODERATE_THRESHOLD:
        return "Moderate Risk"
    return "High Bias"
