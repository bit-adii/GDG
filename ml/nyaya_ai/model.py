"""
nyaya_ai/model.py
=================
Step 2 – Model Training & Evaluation

Trains a Logistic Regression classifier wrapped in a sklearn Pipeline
(StandardScaler → LogisticRegression) and returns predictions along
with standard classification metrics.
"""

import numpy as np
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    classification_report,
    accuracy_score,
    roc_auc_score,
    confusion_matrix,
)


def build_model(random_state: int = 42, class_weight="balanced",
                sample_weight=None) -> Pipeline:
    """
    Build a sklearn Pipeline:
      StandardScaler → LogisticRegression

    Parameters
    ----------
    class_weight   : passed directly to LogisticRegression
                     (e.g. 'balanced' or a dict {0: w0, 1: w1})
    sample_weight  : per-sample weights used during .fit()
                     (stored here so the pipeline can accept them)

    Returns
    -------
    sklearn Pipeline (untrained)
    """
    pipeline = Pipeline([
        ("scaler", StandardScaler()),                # z-score normalisation
        ("clf",    LogisticRegression(
            max_iter=1000,
            random_state=random_state,
            class_weight=class_weight,               # supports 'balanced'
            solver="lbfgs",
        ))
    ])
    return pipeline


def train_model(X_train, y_train,
                class_weight="balanced",
                sample_weight=None,
                random_state: int = 42) -> Pipeline:
    """
    Train and return a fitted Pipeline.

    Parameters
    ----------
    sample_weight : array-like of shape (n_train_samples,) or None
                    Per-sample importance weights (used in reweighting mitigation).
    """
    model = build_model(random_state=random_state,
                        class_weight=class_weight)

    # sklearn Pipelines pass **fit_params to the final estimator
    # using the "stepname__paramname" convention
    if sample_weight is not None:
        model.fit(X_train, y_train,
                  clf__sample_weight=sample_weight)
    else:
        model.fit(X_train, y_train)

    return model


def evaluate_model(model, X_test, y_test, label: str = "Model") -> dict:
    """
    Evaluate a trained model and print a nicely formatted report.

    Returns
    -------
    dict with keys: accuracy, roc_auc, y_pred, y_prob
    """
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    acc     = accuracy_score(y_test, y_pred)
    roc     = roc_auc_score(y_test, y_prob)
    cm      = confusion_matrix(y_test, y_pred)

    print(f"\n{'='*55}")
    print(f"  Evaluation Report – {label}")
    print(f"{'='*55}")
    print(f"  Accuracy : {acc:.4f}")
    print(f"  ROC-AUC  : {roc:.4f}")
    print("\n  Classification Report:")
    print(classification_report(y_test, y_pred,
                                target_names=["Not Selected", "Selected"]))
    print(f"  Confusion Matrix:\n{cm}")

    return {
        "accuracy": acc,
        "roc_auc":  roc,
        "y_pred":   y_pred,
        "y_prob":   y_prob,
        "confusion_matrix": cm,
    }
