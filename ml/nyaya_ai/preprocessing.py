"""
nyaya_ai/preprocessing.py
=========================
Step 1 – Data Loading & Preprocessing

Handles:
  - Loading the CSV dataset
  - Imputing missing values
  - Encoding categorical features (OrdinalEncoder for education,
    LabelEncoder for gender)
  - Splitting into train / test sets
  - Returning both the processed arrays AND a clean DataFrame for
    fairness analysis
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OrdinalEncoder, StandardScaler


# Education levels ordered from lowest to highest credential
EDUCATION_ORDER = [["High School", "Bachelors", "Masters", "PhD"]]


def load_and_preprocess(csv_path: str, target_col: str = "shortlisted",
                        test_size: float = 0.2, random_state: int = 42):
    """
    Load a recruitment CSV, clean it, encode features, and split into
    train/test sets.

    Parameters
    ----------
    csv_path     : path to the CSV file
    target_col   : column name of the binary hiring label (0 / 1)
    test_size    : fraction of rows reserved for testing
    random_state : seed for reproducibility

    Returns
    -------
    X_train, X_test, y_train, y_test : numpy arrays ready for sklearn
    df_clean                          : the processed DataFrame (with
                                        original string columns preserved
                                        alongside encoded ones) used later
                                        for fairness analysis
    feature_names                     : list of feature column names used
    """

    # ------------------------------------------------------------------ #
    # 1.  Load raw data
    # ------------------------------------------------------------------ #
    df = pd.read_csv(csv_path)
    print(f"[Preprocessing] Loaded {len(df)} rows × {len(df.columns)} cols "
          f"from {csv_path}")
    print(f"[Preprocessing] Columns: {list(df.columns)}")

    # ------------------------------------------------------------------ #
    # 2.  Handle missing values
    #     - Numeric columns  → fill with median (robust to outliers)
    #     - Categorical cols → fill with mode (most frequent value)
    # ------------------------------------------------------------------ #
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    cat_cols     = df.select_dtypes(include=["object"]).columns.tolist()

    for col in numeric_cols:
        if df[col].isnull().any():
            median_val = df[col].median()
            df[col].fillna(median_val, inplace=True)
            print(f"[Preprocessing] Filled {col} NaNs with median={median_val:.2f}")

    for col in cat_cols:
        if df[col].isnull().any():
            mode_val = df[col].mode()[0]
            df[col].fillna(mode_val, inplace=True)
            print(f"[Preprocessing] Filled {col} NaNs with mode='{mode_val}'")

    # ------------------------------------------------------------------ #
    # 3.  Keep a copy of the original string gender column for fairness
    #     analysis (we need 'Male' / 'Female' labels later)
    # ------------------------------------------------------------------ #
    df["gender_raw"] = df["gender"]          # preserve original string

    # ------------------------------------------------------------------ #
    # 4.  Encode categorical features
    #     - gender          : binary 0/1  (Male=0, Female=1)
    #     - education_level : ordinal 0‑3 (High School → PhD)
    # ------------------------------------------------------------------ #

    # Gender encoding
    df["gender"] = (df["gender"].str.strip().str.lower() == "female").astype(int)

    # Education ordinal encoding
    if "education_level" in df.columns:
        enc = OrdinalEncoder(categories=EDUCATION_ORDER,
                             handle_unknown="use_encoded_value",
                             unknown_value=-1)
        df["education_level"] = enc.fit_transform(
            df[["education_level"]]
        ).astype(int)

    # ------------------------------------------------------------------ #
    # 5.  Define feature set
    #     We drop the target, the bias_flag (meta-column), and the
    #     preserved raw gender string – none of these are model inputs.
    # ------------------------------------------------------------------ #
    drop_cols = [target_col, "bias_flag", "gender_raw"]
    feature_names = [c for c in df.columns if c not in drop_cols]

    X = df[feature_names].values
    y = df[target_col].values

    # ------------------------------------------------------------------ #
    # 6.  Train / Test split  (stratified to keep class balance)
    # ------------------------------------------------------------------ #
    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=test_size,
        random_state=random_state,
        stratify=y
    )

    print(f"[Preprocessing] Train size: {len(X_train)}  |  "
          f"Test size: {len(X_test)}")

    # Return the clean df so fairness analysis can still access gender_raw
    return X_train, X_test, y_train, y_test, df, feature_names
