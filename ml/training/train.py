"""
FraudLens AI — ML Training Pipeline
====================================
Leakage-safe fraud detection pipeline.
Trains Logistic Regression, Random Forest, and XGBoost.
Selects the best model based on PR-AUC (fraud-aware metric).
Optimizes threshold on validation set.
Evaluates final metrics on held-out test set.
Persists everything required for consistent inference.

Run from the repo root:
    python ml/training/train.py
"""

from __future__ import annotations

import json
import logging
import os
import sys
import time
import warnings
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ── Paths ──────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[2]
DATASET_PATH = (
    ROOT
    / "fraud detection-20260918T042820Z-1-001"
    / "fraud detection"
    / "creditcard.csv"
)
MODELS_DIR = ROOT / "backend" / "models"
REPORTS_DIR = ROOT / "ml" / "reports"
MODELS_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

# ── Feature definition ─────────────────────────────────────────────────────────
V_FEATURES = [f"V{i}" for i in range(1, 29)]
FEATURES = ["Time", "Amount"] + V_FEATURES  # 30 features
TARGET = "Class"
SCALE_FEATURES = ["Time", "Amount"]  # Only these two need scaling

# ── Splits ─────────────────────────────────────────────────────────────────────
TRAIN_SIZE = 0.70
VAL_SIZE = 0.15
TEST_SIZE = 0.15
RANDOM_STATE = 42

# ── Training config ────────────────────────────────────────────────────────────
N_JOBS = -1


# ══════════════════════════════════════════════════════════════════════════════
#  1. DATA LOADING & VALIDATION
# ══════════════════════════════════════════════════════════════════════════════

def load_and_validate(path: Path) -> pd.DataFrame:
    log.info("Loading dataset from %s", path)
    df = pd.read_csv(path)
    log.info("Shape: %s", df.shape)

    # Schema validation
    expected_cols = FEATURES + [TARGET]
    missing = [c for c in expected_cols if c not in df.columns]
    if missing:
        raise ValueError(f"Missing columns: {missing}")

    # Data quality checks
    log.info("Missing values: %d", df.isnull().sum().sum())
    log.info("Duplicates: %d", df.duplicated().sum())

    class_counts = df[TARGET].value_counts()
    log.info("Class distribution:\n%s", class_counts.to_string())
    fraud_rate = class_counts[1] / len(df) * 100
    log.info("Fraud rate: %.4f%%", fraud_rate)

    # Statistical summary for Time and Amount
    log.info("Amount range: %.2f – %.2f", df["Amount"].min(), df["Amount"].max())
    log.info("Time range: %.2f – %.2f", df["Time"].min(), df["Time"].max())

    return df


# ══════════════════════════════════════════════════════════════════════════════
#  2. STRATIFIED SPLIT (train / val / test)
# ══════════════════════════════════════════════════════════════════════════════

def stratified_split(
    df: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Three-way stratified split. Returns (train, val, test) DataFrames."""

    # First cut: split off test set
    splitter_test = StratifiedShuffleSplit(
        n_splits=1, test_size=TEST_SIZE, random_state=RANDOM_STATE
    )
    train_val_idx, test_idx = next(splitter_test.split(df, df[TARGET]))
    df_train_val = df.iloc[train_val_idx].reset_index(drop=True)
    df_test = df.iloc[test_idx].reset_index(drop=True)

    # Second cut: split train_val into train and val
    val_fraction_of_train_val = VAL_SIZE / (TRAIN_SIZE + VAL_SIZE)
    splitter_val = StratifiedShuffleSplit(
        n_splits=1, test_size=val_fraction_of_train_val, random_state=RANDOM_STATE
    )
    train_idx, val_idx = next(
        splitter_val.split(df_train_val, df_train_val[TARGET])
    )
    df_train = df_train_val.iloc[train_idx].reset_index(drop=True)
    df_val = df_train_val.iloc[val_idx].reset_index(drop=True)

    for name, split in [("Train", df_train), ("Val", df_val), ("Test", df_test)]:
        n_fraud = split[TARGET].sum()
        log.info(
            "%s: %d rows | fraud=%d (%.4f%%)",
            name,
            len(split),
            n_fraud,
            n_fraud / len(split) * 100,
        )

    return df_train, df_val, df_test


# ══════════════════════════════════════════════════════════════════════════════
#  3. PREPROCESSING PIPELINE (fit on train only)
# ══════════════════════════════════════════════════════════════════════════════

def build_preprocessing_pipeline() -> Pipeline:
    """
    StandardScaler is applied ONLY to Time and Amount.
    V1-V28 are already PCA-transformed and do not need scaling.
    Pipeline is built so it can be fit on train, then transform any split.
    """
    from sklearn.compose import ColumnTransformer
    from sklearn.pipeline import Pipeline as SKPipeline

    transformer = ColumnTransformer(
        transformers=[
            ("scaler", StandardScaler(), SCALE_FEATURES),
        ],
        remainder="passthrough",  # V1-V28 pass through unchanged
    )

    pipeline = SKPipeline(steps=[("preprocessor", transformer)])
    return pipeline


def get_X_y(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    return df[FEATURES], df[TARGET]


# ══════════════════════════════════════════════════════════════════════════════
#  4. MODEL TRAINING
# ══════════════════════════════════════════════════════════════════════════════

def get_candidate_models() -> dict:
    """Return candidate models with balanced class weights / params."""
    candidates = {}

    candidates["Logistic Regression"] = LogisticRegression(
        class_weight="balanced",
        max_iter=1000,
        random_state=RANDOM_STATE,
        n_jobs=N_JOBS,
        solver="lbfgs",
    )

    candidates["Random Forest"] = RandomForestClassifier(
        n_estimators=300,
        class_weight="balanced",
        max_depth=12,
        min_samples_split=5,
        random_state=RANDOM_STATE,
        n_jobs=N_JOBS,
    )

    try:
        from xgboost import XGBClassifier

        # Calculate scale_pos_weight from the training data distribution
        # This will be updated after we know the actual class counts
        candidates["XGBoost"] = "xgboost_placeholder"
    except ImportError:
        log.warning("XGBoost not available, skipping.")

    return candidates


def evaluate_on_set(
    model, X_transformed: np.ndarray, y: pd.Series, label: str
) -> dict:
    """Compute standard fraud-detection metrics."""
    proba = model.predict_proba(X_transformed)[:, 1]
    pred = model.predict(X_transformed)

    pr_auc = average_precision_score(y, proba)
    roc_auc = roc_auc_score(y, proba)
    precision = precision_score(y, pred, zero_division=0)
    recall = recall_score(y, pred, zero_division=0)
    f1 = f1_score(y, pred, zero_division=0)
    cm = confusion_matrix(y, pred)

    tn, fp, fn, tp = cm.ravel()

    metrics = {
        "set": label,
        "precision": round(float(precision), 4),
        "recall": round(float(recall), 4),
        "f1": round(float(f1), 4),
        "pr_auc": round(float(pr_auc), 4),
        "roc_auc": round(float(roc_auc), 4),
        "true_negatives": int(tn),
        "false_positives": int(fp),
        "false_negatives": int(fn),
        "true_positives": int(tp),
    }
    log.info(
        "[%s] %s → PR-AUC=%.4f ROC-AUC=%.4f F1=%.4f Prec=%.4f Rec=%.4f",
        label,
        "–",
        pr_auc,
        roc_auc,
        f1,
        precision,
        recall,
    )
    return metrics


# ══════════════════════════════════════════════════════════════════════════════
#  5. THRESHOLD OPTIMIZATION (on validation set only)
# ══════════════════════════════════════════════════════════════════════════════

def optimize_threshold(
    model, X_val_transformed: np.ndarray, y_val: pd.Series
) -> tuple[float, list[dict]]:
    """
    Evaluate multiple thresholds on the validation set.
    Select threshold that maximizes F1 score.
    Returns (best_threshold, threshold_analysis_list).
    """
    proba = model.predict_proba(X_val_transformed)[:, 1]

    thresholds = np.arange(0.1, 0.99, 0.01)
    analysis = []

    for t in thresholds:
        pred = (proba >= t).astype(int)
        cm = confusion_matrix(y_val, pred, labels=[0, 1])
        tn, fp, fn, tp = cm.ravel()
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (
            2 * precision * recall / (precision + recall)
            if (precision + recall) > 0
            else 0.0
        )
        analysis.append(
            {
                "threshold": round(float(t), 2),
                "precision": round(float(precision), 4),
                "recall": round(float(recall), 4),
                "f1": round(float(f1), 4),
                "false_positives": int(fp),
                "false_negatives": int(fn),
                "true_positives": int(tp),
                "true_negatives": int(tn),
            }
        )

    # Select threshold maximizing F1
    best = max(analysis, key=lambda x: x["f1"])
    log.info(
        "Best threshold=%.2f → F1=%.4f Prec=%.4f Rec=%.4f FP=%d FN=%d",
        best["threshold"],
        best["f1"],
        best["precision"],
        best["recall"],
        best["false_positives"],
        best["false_negatives"],
    )
    return best["threshold"], analysis


# ══════════════════════════════════════════════════════════════════════════════
#  6. SAMPLE EXTRACTION (real samples from dataset)
# ══════════════════════════════════════════════════════════════════════════════

def extract_samples(df_test: pd.DataFrame, n: int = 5) -> dict:
    """
    Extract real legitimate and fraud samples from the test set.
    These are used for the demo/showcase in the frontend.
    """
    fraud_samples = df_test[df_test[TARGET] == 1].head(n)
    legit_samples = df_test[df_test[TARGET] == 0].head(n)

    def to_feature_dict(row: pd.Series) -> dict:
        return {f: float(row[f]) for f in FEATURES}

    samples = {
        "fraud": [to_feature_dict(row) for _, row in fraud_samples.iterrows()],
        "legitimate": [to_feature_dict(row) for _, row in legit_samples.iterrows()],
    }
    return samples


# ══════════════════════════════════════════════════════════════════════════════
#  7. MAIN TRAINING ORCHESTRATOR
# ══════════════════════════════════════════════════════════════════════════════

def main() -> None:
    start_time = time.time()
    log.info("=" * 60)
    log.info("FraudLens AI — Model Training Pipeline")
    log.info("=" * 60)

    # 1. Load & validate
    df = load_and_validate(DATASET_PATH)
    dataset_stats = {
        "total_transactions": int(len(df)),
        "fraud_transactions": int(df[TARGET].sum()),
        "legitimate_transactions": int((df[TARGET] == 0).sum()),
        "fraud_rate": round(float(df[TARGET].mean() * 100), 4),
        "features": FEATURES,
        "feature_count": len(FEATURES),
    }
    log.info("Dataset statistics: %s", dataset_stats)

    # 2. Stratified split
    df_train, df_val, df_test = stratified_split(df)

    X_train, y_train = get_X_y(df_train)
    X_val, y_val = get_X_y(df_val)
    X_test, y_test = get_X_y(df_test)

    # 3. Preprocessing — fit on train ONLY
    log.info("Fitting preprocessing pipeline on training set...")
    preprocessing_pipeline = build_preprocessing_pipeline()
    X_train_t = preprocessing_pipeline.fit_transform(X_train)
    X_val_t = preprocessing_pipeline.transform(X_val)
    # X_test is NOT transformed until final evaluation

    # 4. Train candidate models
    log.info("-" * 40)
    log.info("Training candidate models...")

    n_legit_train = int((y_train == 0).sum())
    n_fraud_train = int((y_train == 1).sum())
    scale_pos_weight = n_legit_train / n_fraud_train
    log.info(
        "Class balance → legit=%d, fraud=%d, scale_pos_weight=%.2f",
        n_legit_train,
        n_fraud_train,
        scale_pos_weight,
    )

    model_results = {}

    # Logistic Regression
    log.info("Training Logistic Regression...")
    lr = LogisticRegression(
        class_weight="balanced",
        max_iter=1000,
        random_state=RANDOM_STATE,
        n_jobs=N_JOBS,
        solver="lbfgs",
    )
    lr.fit(X_train_t, y_train)
    model_results["Logistic Regression"] = {
        "model": lr,
        "val_metrics": evaluate_on_set(lr, X_val_t, y_val, "LR-Val"),
    }

    # Random Forest
    log.info("Training Random Forest...")
    rf = RandomForestClassifier(
        n_estimators=300,
        class_weight="balanced",
        max_depth=12,
        min_samples_split=5,
        random_state=RANDOM_STATE,
        n_jobs=N_JOBS,
    )
    rf.fit(X_train_t, y_train)
    model_results["Random Forest"] = {
        "model": rf,
        "val_metrics": evaluate_on_set(rf, X_val_t, y_val, "RF-Val"),
    }

    # XGBoost
    try:
        from xgboost import XGBClassifier

        log.info("Training XGBoost...")
        xgb = XGBClassifier(
            n_estimators=300,
            max_depth=6,
            learning_rate=0.1,
            scale_pos_weight=scale_pos_weight,
            subsample=0.8,
            colsample_bytree=0.8,
            use_label_encoder=False,
            eval_metric="aucpr",
            random_state=RANDOM_STATE,
            n_jobs=N_JOBS,
        )
        xgb.fit(
            X_train_t,
            y_train,
            eval_set=[(X_val_t, y_val)],
            verbose=False,
        )
        model_results["XGBoost"] = {
            "model": xgb,
            "val_metrics": evaluate_on_set(xgb, X_val_t, y_val, "XGB-Val"),
        }
    except ImportError:
        log.warning("XGBoost not installed, skipping.")
    except Exception as e:
        log.warning("XGBoost training failed: %s", e)

    # 5. Model selection — primary metric: PR-AUC
    log.info("-" * 40)
    log.info("Model comparison (validation set PR-AUC):")
    comparison = []
    for name, result in model_results.items():
        vm = result["val_metrics"]
        log.info(
            "  %-22s PR-AUC=%.4f ROC-AUC=%.4f F1=%.4f",
            name,
            vm["pr_auc"],
            vm["roc_auc"],
            vm["f1"],
        )
        comparison.append({"model": name, **vm})

    best_name = max(
        model_results,
        key=lambda k: model_results[k]["val_metrics"]["pr_auc"],
    )
    best_model = model_results[best_name]["model"]
    log.info("Selected model: %s (highest validation PR-AUC)", best_name)

    # 6. Threshold optimization on validation set
    log.info("-" * 40)
    log.info("Optimizing decision threshold on validation set...")
    best_threshold, threshold_analysis = optimize_threshold(
        best_model, X_val_t, y_val
    )

    # 7. Final evaluation on test set (UNTOUCHED until now)
    log.info("-" * 40)
    log.info("Final evaluation on held-out test set...")
    X_test_t = preprocessing_pipeline.transform(X_test)

    # Apply optimized threshold
    test_proba = best_model.predict_proba(X_test_t)[:, 1]
    test_pred = (test_proba >= best_threshold).astype(int)

    cm = confusion_matrix(y_test, test_pred, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()
    test_precision = precision_score(y_test, test_pred, zero_division=0)
    test_recall = recall_score(y_test, test_pred, zero_division=0)
    test_f1 = f1_score(y_test, test_pred, zero_division=0)
    test_pr_auc = average_precision_score(y_test, test_proba)
    test_roc_auc = roc_auc_score(y_test, test_proba)

    final_metrics = {
        "precision": round(float(test_precision), 4),
        "recall": round(float(test_recall), 4),
        "f1": round(float(test_f1), 4),
        "pr_auc": round(float(test_pr_auc), 4),
        "roc_auc": round(float(test_roc_auc), 4),
        "true_negatives": int(tn),
        "false_positives": int(fp),
        "false_negatives": int(fn),
        "true_positives": int(tp),
        "threshold_used": float(best_threshold),
    }
    log.info(
        "Test set → PR-AUC=%.4f ROC-AUC=%.4f F1=%.4f Prec=%.4f Rec=%.4f",
        test_pr_auc,
        test_roc_auc,
        test_f1,
        test_precision,
        test_recall,
    )
    log.info(
        "Confusion matrix → TN=%d FP=%d FN=%d TP=%d", tn, fp, fn, tp
    )

    # 8. Extract sample transactions from test set
    samples = extract_samples(df_test)

    # 9. Persist everything
    log.info("-" * 40)
    log.info("Persisting model artifacts...")

    model_version = "v1.0.0"
    training_timestamp = datetime.now(timezone.utc).isoformat()

    # Save preprocessing pipeline
    preprocessing_path = MODELS_DIR / "preprocessing_pipeline.joblib"
    joblib.dump(preprocessing_pipeline, preprocessing_path)
    log.info("Saved preprocessing pipeline → %s", preprocessing_path)

    # Save trained model
    model_path = MODELS_DIR / "fraud_model.joblib"
    joblib.dump(best_model, model_path)
    log.info("Saved model → %s", model_path)

    # Build and save metadata
    metadata = {
        "model_version": model_version,
        "model_name": best_name,
        "training_timestamp": training_timestamp,
        "threshold": float(best_threshold),
        "features": FEATURES,
        "scale_features": SCALE_FEATURES,
        "feature_count": len(FEATURES),
        "dataset": {
            **dataset_stats,
            "train_size": len(df_train),
            "val_size": len(df_val),
            "test_size": len(df_test),
        },
        "validation_metrics": model_results[best_name]["val_metrics"],
        "test_metrics": final_metrics,
        "model_comparison": comparison,
        "selection_reason": (
            f"{best_name} selected based on highest validation PR-AUC "
            f"({model_results[best_name]['val_metrics']['pr_auc']:.4f}). "
            f"PR-AUC is the primary metric for highly imbalanced fraud detection."
        ),
    }
    metadata_path = MODELS_DIR / "model_metadata.json"
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)
    log.info("Saved metadata → %s", metadata_path)

    # Save threshold analysis
    threshold_path = MODELS_DIR / "threshold_analysis.json"
    with open(threshold_path, "w") as f:
        json.dump(threshold_analysis, f, indent=2)
    log.info("Saved threshold analysis → %s", threshold_path)

    # Save sample transactions
    samples_path = MODELS_DIR / "sample_transactions.json"
    with open(samples_path, "w") as f:
        json.dump(samples, f, indent=2)
    log.info("Saved sample transactions → %s", samples_path)

    # Save model comparison report
    comparison_path = REPORTS_DIR / "model_comparison.json"
    with open(comparison_path, "w") as f:
        json.dump(comparison, f, indent=2)

    elapsed = time.time() - start_time
    log.info("=" * 60)
    log.info("Training complete in %.1f seconds", elapsed)
    log.info("Model: %s | Threshold: %.2f", best_name, best_threshold)
    log.info(
        "Test PR-AUC: %.4f | F1: %.4f | Precision: %.4f | Recall: %.4f",
        test_pr_auc,
        test_f1,
        test_precision,
        test_recall,
    )
    log.info("=" * 60)


if __name__ == "__main__":
    main()
