"""
nyaya_ai/visualizer.py
======================
Step 7 – Comparison Visualisations

Generates publication-quality charts comparing the BEFORE and AFTER
fairness states, saved as PNG files in the ml/reports/ directory.

Charts produced
---------------
  1. Selection Rate Comparison  (grouped bar chart)
  2. Disparate Impact Gauge     (horizontal bar with 0.80 threshold line)
  3. Fairness Score Dial        (text-annotated bar chart)
"""

import os
import numpy as np
import matplotlib
matplotlib.use("Agg")          # non-interactive backend (safe on all platforms)
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches


REPORT_DIR = os.path.join(os.path.dirname(__file__), "..", "reports")


def _ensure_report_dir():
    os.makedirs(REPORT_DIR, exist_ok=True)


def plot_selection_rates(before: dict, after: dict,
                         filename: str = "selection_rates.png"):
    """Grouped bar chart showing per-group selection rates before/after."""
    _ensure_report_dir()

    groups  = list(before["selection_rates"].keys())
    x       = np.arange(len(groups))
    width   = 0.35

    rates_before = [before["selection_rates"][g] for g in groups]
    rates_after  = [after["selection_rates"][g]  for g in groups]

    fig, ax = plt.subplots(figsize=(8, 5))
    fig.patch.set_facecolor("#0f0f1a")
    ax.set_facecolor("#1a1a2e")

    bars1 = ax.bar(x - width/2, rates_before, width,
                   label="Before Mitigation", color="#e94560", alpha=0.85)
    bars2 = ax.bar(x + width/2, rates_after,  width,
                   label="After Mitigation",  color="#00b4d8", alpha=0.85)

    for bar in bars1 + bars2:
        h = bar.get_height()
        ax.annotate(f"{h:.1%}",
                    xy=(bar.get_x() + bar.get_width() / 2, h),
                    xytext=(0, 4), textcoords="offset points",
                    ha="center", va="bottom", fontsize=9, color="white")

    ax.set_xlabel("Demographic Group", color="white")
    ax.set_ylabel("Selection Rate", color="white")
    ax.set_title("Selection Rate: Before vs After Mitigation", color="white",
                 fontsize=13, fontweight="bold")
    ax.set_xticks(x)
    ax.set_xticklabels(groups, color="white")
    ax.tick_params(colors="white")
    ax.yaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(xmax=1))
    ax.legend(facecolor="#1a1a2e", labelcolor="white")
    ax.spines[:].set_color("#444466")

    path = os.path.join(REPORT_DIR, filename)
    plt.tight_layout()
    plt.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"[Visualizer] Saved → {path}")
    return path


def plot_disparate_impact(before: dict, after: dict,
                          filename: str = "disparate_impact.png"):
    """Horizontal bar chart with 0.80 threshold line."""
    _ensure_report_dir()

    di_before = before["disparate_impact"]
    di_after  = after["disparate_impact"]

    fig, ax = plt.subplots(figsize=(8, 3))
    fig.patch.set_facecolor("#0f0f1a")
    ax.set_facecolor("#1a1a2e")

    labels = ["Before Mitigation", "After Mitigation"]
    values = [di_before, di_after]
    colors = ["#e94560", "#00b4d8"]

    bars = ax.barh(labels, values, color=colors, height=0.4)
    ax.axvline(x=0.80, color="#f5a623", linewidth=2, linestyle="--",
               label="80% Rule (DI = 0.80)")

    for bar, val in zip(bars, values):
        ax.text(val + 0.01, bar.get_y() + bar.get_height()/2,
                f"{val:.3f}", va="center", color="white", fontsize=11)

    ax.set_xlim(0, 1.1)
    ax.set_xlabel("Disparate Impact", color="white")
    ax.set_title("Disparate Impact: Before vs After Mitigation",
                 color="white", fontsize=13, fontweight="bold")
    ax.tick_params(colors="white")
    ax.spines[:].set_color("#444466")
    ax.legend(facecolor="#1a1a2e", labelcolor="white")

    path = os.path.join(REPORT_DIR, filename)
    plt.tight_layout()
    plt.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"[Visualizer] Saved → {path}")
    return path


def plot_fairness_scores(before: dict, after: dict,
                         filename: str = "fairness_scores.png"):
    """Bar chart showing Fairness Score before/after with colour coding."""
    _ensure_report_dir()

    fs_before = before["fairness_score"]
    fs_after  = after["fairness_score"]

    def _score_color(score):
        if score >= 80: return "#2ecc71"
        if score >= 60: return "#f5a623"
        return "#e94560"

    fig, ax = plt.subplots(figsize=(6, 5))
    fig.patch.set_facecolor("#0f0f1a")
    ax.set_facecolor("#1a1a2e")

    labels = ["Before", "After"]
    scores = [fs_before, fs_after]
    cols   = [_score_color(s) for s in scores]

    bars = ax.bar(labels, scores, color=cols, width=0.4)

    for bar, score in zip(bars, scores):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1,
                f"{score}/100", ha="center", va="bottom",
                color="white", fontsize=13, fontweight="bold")

    ax.axhline(y=80, color="#2ecc71", linewidth=1.5, linestyle="--",
               label="Fair threshold (80)")
    ax.axhline(y=60, color="#f5a623", linewidth=1.5, linestyle=":",
               label="Moderate threshold (60)")

    ax.set_ylim(0, 110)
    ax.set_ylabel("Fairness Score (0–100)", color="white")
    ax.set_title("Fairness Score Comparison", color="white",
                 fontsize=13, fontweight="bold")
    ax.tick_params(colors="white")
    ax.spines[:].set_color("#444466")
    ax.legend(facecolor="#1a1a2e", labelcolor="white")

    path = os.path.join(REPORT_DIR, filename)
    plt.tight_layout()
    plt.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"[Visualizer] Saved → {path}")
    return path


def generate_all_charts(before: dict, after: dict):
    """Convenience wrapper – generate all three comparison charts."""
    p1 = plot_selection_rates(before, after)
    p2 = plot_disparate_impact(before, after)
    p3 = plot_fairness_scores(before, after)
    return p1, p2, p3
