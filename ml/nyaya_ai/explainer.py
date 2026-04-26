"""
nyaya_ai/explainer.py
=====================
Step 6 – Plain-English Explanation Layer

Converts raw fairness metrics into human-readable insight strings
so non-technical stakeholders can immediately understand the findings.

Examples of generated text
--------------------------
  "Female candidates are 40% less likely to be selected than Male candidates."
  "The model shows HIGH BIAS against Female applicants (Disparate Impact = 0.55)."
  "After mitigation, the Fairness Score improved from 55 to 78 (+23 points)."
"""

from __future__ import annotations


def generate_plain_english_insights(metrics: dict,
                                    dataset_label: str = "dataset") -> list[str]:
    """
    Convert a fairness metrics dictionary into a list of plain-English
    sentences.

    Parameters
    ----------
    metrics       : dict returned by fairness.compute_fairness_metrics()
    dataset_label : short label like "biased dataset" or "mitigated model"

    Returns
    -------
    list of insight strings (one sentence per insight)
    """
    insights = []

    # -- 1. Selection rate insight ----------------------------------------- #
    sel = metrics["selection_rates"]
    priv  = metrics["privileged_group"]
    disad = metrics["disadvantaged"]

    rate_priv  = sel[priv]
    rate_disad = sel[disad]

    pct_gap = abs(rate_priv - rate_disad) * 100
    ratio   = rate_disad / rate_priv if rate_priv > 0 else 0

    insights.append(
        f"On the {dataset_label}, "
        f"{disad} candidates have a selection rate of {rate_disad:.1%}, "
        f"compared to {rate_priv:.1%} for {priv} candidates."
    )

    if pct_gap > 0.5:
        insights.append(
            f"{disad} candidates are {pct_gap:.1f}% less likely to be selected "
            f"than {priv} candidates — a notable disparity."
        )

    # -- 2. Disparate Impact insight --------------------------------------- #
    di = metrics["disparate_impact"]
    if di < 0.80:
        insights.append(
            f"⚠  Disparate Impact = {di:.3f}, which is BELOW the legal 80% "
            f"(0.80) threshold. This constitutes potential adverse impact "
            f"under EEOC guidelines."
        )
    else:
        insights.append(
            f"✓  Disparate Impact = {di:.3f}, which MEETS the 80% rule "
            f"(≥ 0.80). No illegal adverse impact detected."
        )

    # -- 3. Fairness Score insight ---------------------------------------- #
    fs = metrics["fairness_score"]
    label = metrics["verdict"]
    insights.append(
        f"Overall Fairness Score: {fs}/100 — classified as \"{label}\"."
    )

    # -- 4. Bias narrative ------------------------------------------------- #
    if metrics["bias_exists"]:
        severity = "severely" if di < 0.60 else "moderately"
        insights.append(
            f"The model {severity} disadvantages {disad} applicants. "
            f"Bias mitigation is strongly recommended before deployment."
        )
    else:
        insights.append(
            f"The model treats both demographic groups fairly. "
            f"Continued monitoring is still advisable."
        )

    return insights


def generate_comparison_summary(before: dict, after: dict) -> list[str]:
    """
    Compare before-mitigation and after-mitigation fairness metrics and
    produce a human-readable improvement summary.

    Parameters
    ----------
    before : metrics dict from the original biased model
    after  : metrics dict from the mitigated model

    Returns
    -------
    list of summary strings
    """
    lines = []

    disad = before["disadvantaged"]

    di_before  = before["disparate_impact"]
    di_after   = after["disparate_impact"]
    di_delta   = di_after - di_before

    fs_before  = before["fairness_score"]
    fs_after   = after["fairness_score"]
    fs_delta   = fs_after - fs_before

    sr_before  = before["selection_rates"].get(disad, 0)
    sr_after   = after["selection_rates"].get(disad, 0)
    sr_delta   = (sr_after - sr_before) * 100

    lines.append("📊  Mitigation Impact Summary")
    lines.append("─" * 45)

    lines.append(
        f"  Disparate Impact : {di_before:.3f} → {di_after:.3f}  "
        f"({'▲ +' if di_delta >= 0 else '▼ '}{abs(di_delta):.3f})"
    )
    lines.append(
        f"  Fairness Score   : {fs_before}/100 → {fs_after}/100  "
        f"({'▲ +' if fs_delta >= 0 else '▼ '}{abs(fs_delta)} pts)"
    )
    lines.append(
        f"  {disad} selection rate: {sr_before:.1%} → {sr_after:.1%}  "
        f"({'▲ +' if sr_delta >= 0 else '▼ '}{abs(sr_delta):.1f}pp)"
    )

    if fs_delta > 0:
        lines.append(
            f"\n  ✅  Mitigation IMPROVED fairness by {fs_delta} points."
        )
        if fs_after >= 80:
            lines.append(
                "  The model now meets the fairness threshold (≥ 80/100)."
            )
        else:
            lines.append(
                "  Further mitigation or algorithmic changes may still be needed."
            )
    else:
        lines.append(
            "\n  ⚠  Mitigation did not improve the Fairness Score. "
            "Consider alternative techniques."
        )

    return lines


def print_insights(insights: list[str], header: str = "💡 Insights"):
    """Pretty-print a list of insight strings."""
    print(f"\n{'='*55}")
    print(f"  {header}")
    print(f"{'='*55}")
    for i, line in enumerate(insights, 1):
        print(f"  {i}. {line}")
