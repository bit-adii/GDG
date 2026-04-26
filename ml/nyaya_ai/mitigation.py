"""
nyaya_ai/mitigation.py
======================
Step 4 – Bias Mitigation

Two techniques are implemented:

  1. REWEIGHTING (default)
     ─────────────────────
     Assigns higher sample weights to the underrepresented group so that
     the Logistic Regression objective pays equal attention to both
     demographic groups. No rows are added or removed – the dataset
     remains unchanged; only the loss weighting changes.

     Weight formula (per sample):
       w(x) = (N / (N_g × k))
     where
       N   = total training samples
       N_g = number of samples in the gender group of x
       k   = number of unique gender groups

  2. OVERSAMPLING (SMOTE-style via imbalanced-learn)
     ─────────────────────────────────────────────────
     Generates synthetic minority-class samples to balance the *class*
     distribution (Selected vs Not Selected). Note: this addresses
     class imbalance, not group imbalance directly, but it often
     reduces intersectional bias simultaneously.

Both functions return objects compatible with nyaya_ai/model.py's
train_model().
"""

import numpy as np
import pandas as pd


# --------------------------------------------------------------------------- #
# Technique 1 – Reweighting
# --------------------------------------------------------------------------- #

def compute_reweighting_weights(df_train: pd.DataFrame,
                                y_train: np.ndarray,
                                sensitive_col: str = "gender_raw") -> np.ndarray:
    """
    Compute per-sample inverse-frequency weights based on the JOINT
    distribution of (sensitive_group × class_label).

    This is a stronger form of reweighting that corrects for label-level
    bias — e.g., when one demographic group has near-zero positive labels.

    Formula (Kamiran & Calders, 2012):
        w(x) = P(group) × P(label) / P(group, label)

    Parameters
    ----------
    df_train       : training slice of df_clean (must contain sensitive_col)
    y_train        : training labels aligned with df_train
    sensitive_col  : column with demographic group labels

    Returns
    -------
    weights : np.ndarray of shape (n_train,)
    """
    n          = len(y_train)
    groups     = df_train[sensitive_col].values
    labels     = y_train

    unique_groups = np.unique(groups)
    unique_labels = np.unique(labels)

    weights = np.ones(n, dtype=float)

    # Compute marginal probabilities
    p_group = {g: np.mean(groups == g) for g in unique_groups}
    p_label = {l: np.mean(labels == l) for l in unique_labels}

    for g in unique_groups:
        for l in unique_labels:
            mask   = (groups == g) & (labels == l)
            p_gl   = np.mean(mask)                 # joint probability
            if p_gl == 0:
                # No samples in this cell; assign a strong upweight
                # to nudge the model when similar samples appear at test time
                continue
            # Desired weight = P(G) * P(L) / P(G,L)
            w_gl  = (p_group[g] * p_label[l]) / p_gl
            weights[mask] = w_gl

    # Normalise so weights sum to n (preserves effective sample size)
    weights = weights / weights.mean()

    print(f"\n[Mitigation] Group x Class reweighting applied.")
    for g in unique_groups:
        for l in unique_labels:
            mask = (groups == g) & (labels == l)
            if mask.sum() > 0:
                print(f"  Group='{g}', Label={l}: n={mask.sum()}, "
                      f"weight = {weights[mask].mean():.4f}")

    return weights


# --------------------------------------------------------------------------- #
# Technique 2 – Dataset Balancing (SMOTE via imbalanced-learn)
# --------------------------------------------------------------------------- #

def apply_smote(X_train: np.ndarray, y_train: np.ndarray,
                random_state: int = 42):
    """
    Oversample the minority class using SMOTE so that Selected (1) and
    Not-Selected (0) classes have equal representation in training data.

    Parameters
    ----------
    X_train, y_train : original training split

    Returns
    -------
    X_resampled, y_resampled : balanced arrays  (no sample_weight needed)
    """
    try:
        from imblearn.over_sampling import SMOTE
    except ImportError:
        raise ImportError(
            "imbalanced-learn is required for SMOTE. "
            "Install with: pip install imbalanced-learn"
        )

    smote = SMOTE(random_state=random_state)
    X_res, y_res = smote.fit_resample(X_train, y_train)

    before_pos = int(y_train.sum())
    after_pos  = int(y_res.sum())

    print(f"\n[Mitigation] SMOTE applied.")
    print(f"  Before: {len(y_train)} samples "
          f"(selected={before_pos}, not-selected={len(y_train)-before_pos})")
    print(f"  After : {len(y_res)} samples "
          f"(selected={after_pos}, not-selected={len(y_res)-after_pos})")

    return X_res, y_res
