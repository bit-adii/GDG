"""
nyaya_ai/pipeline.py
====================
Master Pipeline Runner for Nyaya AI

This script ties together all six modules and runs the full
bias-detection → mitigation → comparison pipeline on a given dataset.

Usage (from the ml/ directory):
  python -m nyaya_ai.pipeline --dataset biased
  python -m nyaya_ai.pipeline --dataset fair
  python -m nyaya_ai.pipeline --dataset biased --mitigation reweighting
  python -m nyaya_ai.pipeline --dataset biased --mitigation smote

Pipeline Stages
───────────────
  [1] Load & Preprocess      (preprocessing.py)
  [2] Train baseline model   (model.py)
  [3] Fairness analysis      (fairness.py)
  [4] Plain-English insights (explainer.py)
  [5] Apply mitigation       (mitigation.py)
  [6] Retrain mitigated      (model.py)
  [7] Re-evaluate fairness   (fairness.py)
  [8] Compare BEFORE / AFTER (explainer.py + visualizer.py)
"""

from __future__ import annotations

import os
import sys
import argparse
import numpy as np
import pandas as pd

# Force UTF-8 output on Windows (avoids CP1252 UnicodeEncodeError)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Make sure the ml/ directory is on the path when running as a script
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from nyaya_ai.preprocessing import load_and_preprocess
from nyaya_ai.model          import train_model, evaluate_model
from nyaya_ai.fairness       import compute_fairness_metrics
from nyaya_ai.mitigation     import compute_reweighting_weights, apply_smote
from nyaya_ai.explainer      import (
    generate_plain_english_insights,
    generate_comparison_summary,
    print_insights,
)
from nyaya_ai.visualizer     import generate_all_charts


# --------------------------------------------------------------------------- #
#  Paths
# --------------------------------------------------------------------------- #
_THIS_DIR  = os.path.dirname(__file__)
_DATA_DIR  = os.path.join(_THIS_DIR, "..", "..", "backend", "src", "data")

DATASET_PATHS = {
    "biased": os.path.join(_DATA_DIR, "biased_dataset.csv"),
    "fair":   os.path.join(_DATA_DIR, "fair_dataset.csv"),
}


# --------------------------------------------------------------------------- #
#  Main pipeline
# --------------------------------------------------------------------------- #

def run_pipeline(dataset_key: str = "biased",
                 mitigation: str = "reweighting",
                 test_size: float = 0.20,
                 random_state: int = 42) -> dict:
    """
    Execute the full Nyaya AI pipeline.

    Parameters
    ----------
    dataset_key  : 'biased' or 'fair'  (selects the CSV file)
    mitigation   : 'reweighting' | 'smote'
    test_size    : fraction of data held out for evaluation
    random_state : reproducibility seed

    Returns
    -------
    dict with keys:
        before_metrics, after_metrics, comparison_lines
    """

    csv_path = DATASET_PATHS.get(dataset_key)
    if csv_path is None or not os.path.exists(csv_path):
        raise FileNotFoundError(
            f"Dataset '{dataset_key}' not found at {csv_path}. "
            f"Valid keys: {list(DATASET_PATHS.keys())}"
        )

    # ----------------------------------------------------------------------- #
    # STAGE 1 - Load & Preprocess
    # ----------------------------------------------------------------------- #
    print("\n" + "="*55)
    print("  STAGE 1 - Load & Preprocess")
    print("="*55)

    (X_train, X_test,
     y_train, y_test,
     df_clean, feature_names) = load_and_preprocess(
        csv_path=csv_path,
        target_col="shortlisted",
        test_size=test_size,
        random_state=random_state,
    )

    # Separate the training slice of df_clean (for reweighting)
    # We use the same random split index logic sklearn used internally.
    # Simplest approach: re-split df_clean identically.
    from sklearn.model_selection import train_test_split
    df_train, df_test = train_test_split(
        df_clean, test_size=test_size,
        random_state=random_state,
        stratify=df_clean["shortlisted"]
    )

    # ----------------------------------------------------------------------- #
    # STAGE 2 - Train Baseline (Before Mitigation)
    # ----------------------------------------------------------------------- #
    print("\n" + "="*55)
    print("  STAGE 2 - Train Baseline Model (Before Mitigation)")
    print("="*55)

    model_before = train_model(X_train, y_train, random_state=random_state)
    eval_before  = evaluate_model(model_before, X_test, y_test,
                                  label="Baseline Model")

    # ----------------------------------------------------------------------- #
    # STAGE 3 - Fairness Analysis (Before)
    # ----------------------------------------------------------------------- #
    print("\n" + "="*55)
    print("  STAGE 3 - Fairness Analysis (Before Mitigation)")
    print("="*55)

    before_metrics = compute_fairness_metrics(
        df_clean=df_test.reset_index(drop=True),
        y_pred=eval_before["y_pred"],
        sensitive_col="gender_raw",
        label="Before Mitigation",
    )

    # ----------------------------------------------------------------------- #
    # STAGE 4 - Plain-English Insights (Before)
    # ----------------------------------------------------------------------- #
    print("\n" + "="*55)
    print("  STAGE 4 - Plain-English Insights (Before)")
    print("="*55)

    insights_before = generate_plain_english_insights(
        before_metrics, dataset_label=f"'{dataset_key}' dataset (baseline)"
    )
    print_insights(insights_before, header="[!] Baseline Bias Insights")

    # ----------------------------------------------------------------------- #
    # STAGE 5 - Apply Mitigation
    # ----------------------------------------------------------------------- #
    print("\n" + "="*55)
    print(f"  STAGE 5 - Applying Mitigation: {mitigation.upper()}")
    print("="*55)

    sample_weight_train = None
    X_train_mit         = X_train.copy()
    y_train_mit         = y_train.copy()

    if mitigation == "reweighting":
        # Compute per-sample weights from the training portion of df_clean
        sample_weight_train = compute_reweighting_weights(
            df_train=df_train.reset_index(drop=True),
            y_train=y_train,
            sensitive_col="gender_raw",
        )

    elif mitigation == "smote":
        X_train_mit, y_train_mit = apply_smote(
            X_train, y_train, random_state=random_state
        )
    else:
        print(f"[Warning] Unknown mitigation '{mitigation}'. "
              f"Skipping mitigation step.")

    # ----------------------------------------------------------------------- #
    # STAGE 6 - Retrain Mitigated Model
    # ----------------------------------------------------------------------- #
    print("\n" + "="*55)
    print("  STAGE 6 - Retrain Model (After Mitigation)")
    print("="*55)

    model_after = train_model(
        X_train_mit, y_train_mit,
        sample_weight=sample_weight_train,
        random_state=random_state,
    )
    eval_after = evaluate_model(model_after, X_test, y_test,
                                label="Mitigated Model")

    # ----------------------------------------------------------------------- #
    # STAGE 7 - Fairness Analysis (After)
    # ----------------------------------------------------------------------- #
    print("\n" + "="*55)
    print("  STAGE 7 - Fairness Analysis (After Mitigation)")
    print("="*55)

    after_metrics = compute_fairness_metrics(
        df_clean=df_test.reset_index(drop=True),
        y_pred=eval_after["y_pred"],
        sensitive_col="gender_raw",
        label="After Mitigation",
    )

    # ----------------------------------------------------------------------- #
    # STAGE 8 - Compare Before / After + Visualise
    # ----------------------------------------------------------------------- #
    print("\n" + "="*55)
    print("  STAGE 8 - Comparison: Before vs After")
    print("="*55)

    comparison = generate_comparison_summary(before_metrics, after_metrics)
    print()
    for line in comparison:
        print(" ", line)

    insights_after = generate_plain_english_insights(
        after_metrics, dataset_label="mitigated model"
    )
    print_insights(insights_after, header="[+] Post-Mitigation Insights")

    # Generate and save charts
    try:
        chart_paths = generate_all_charts(before_metrics, after_metrics)
        print(f"\n[Pipeline] Charts saved: {chart_paths}")
    except Exception as e:
        print(f"[Pipeline] Chart generation skipped: {e}")

    print("\n" + "="*55)
    print("  [OK] Nyaya AI Pipeline Complete!")
    print("="*55 + "\n")

    return {
        "before_metrics":   before_metrics,
        "after_metrics":    after_metrics,
        "comparison_lines": comparison,
        "model_before":     model_before,
        "model_after":      model_after,
    }


# --------------------------------------------------------------------------- #
#  CLI entry point
# --------------------------------------------------------------------------- #

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Nyaya AI – Bias Detection & Fairness Pipeline"
    )
    parser.add_argument(
        "--dataset",
        choices=["biased", "fair"],
        default="biased",
        help="Which dataset to use (default: biased)",
    )
    parser.add_argument(
        "--mitigation",
        choices=["reweighting", "smote", "none"],
        default="reweighting",
        help="Mitigation technique (default: reweighting)",
    )
    parser.add_argument(
        "--test-size",
        type=float,
        default=0.20,
        help="Train/test split fraction (default: 0.20)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed (default: 42)",
    )
    args = parser.parse_args()

    run_pipeline(
        dataset_key=args.dataset,
        mitigation=args.mitigation,
        test_size=args.test_size,
        random_state=args.seed,
    )
