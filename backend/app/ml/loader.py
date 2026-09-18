"""
FraudLens AI — Model Loader
Loads all ML artifacts once at startup.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import joblib
import numpy as np

log = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).resolve().parents[3] / "backend" / "models"

# Features (must match training order)
V_FEATURES = [f"V{i}" for i in range(1, 29)]
FEATURES = ["Time", "Amount"] + V_FEATURES


class ModelArtifacts:
    """Singleton container for loaded model artifacts."""

    def __init__(self) -> None:
        self.model: Any = None
        self.preprocessing_pipeline: Any = None
        self.metadata: dict = {}
        self.threshold_analysis: list[dict] = []
        self.sample_transactions: dict = {}
        self.loaded: bool = False
        self.load_error: str | None = None

    def load(self) -> bool:
        """Load all artifacts from disk. Returns True on success."""
        try:
            log.info("Loading preprocessing pipeline...")
            self.preprocessing_pipeline = joblib.load(
                MODELS_DIR / "preprocessing_pipeline.joblib"
            )

            log.info("Loading trained model...")
            self.model = joblib.load(MODELS_DIR / "fraud_model.joblib")

            log.info("Loading metadata...")
            with open(MODELS_DIR / "model_metadata.json") as f:
                self.metadata = json.load(f)

            log.info("Loading threshold analysis...")
            with open(MODELS_DIR / "threshold_analysis.json") as f:
                self.threshold_analysis = json.load(f)

            log.info("Loading sample transactions...")
            with open(MODELS_DIR / "sample_transactions.json") as f:
                self.sample_transactions = json.load(f)

            self.loaded = True
            self.load_error = None
            log.info(
                "Model artifacts loaded: %s v%s",
                self.metadata.get("model_name"),
                self.metadata.get("model_version"),
            )
            return True

        except Exception as e:
            self.loaded = False
            self.load_error = str(e)
            log.error("Failed to load model artifacts: %s", e)
            return False

    @property
    def threshold(self) -> float:
        return float(self.metadata.get("threshold", 0.5))

    @property
    def model_version(self) -> str:
        return str(self.metadata.get("model_version", "unknown"))

    @property
    def model_name(self) -> str:
        return str(self.metadata.get("model_name", "unknown"))

    def predict_proba(self, feature_vector: list[float]) -> float:
        """
        Run inference on a single transaction.
        Returns the fraud probability (0-1).
        """
        import pandas as pd

        if not self.loaded:
            raise RuntimeError("Model artifacts not loaded")

        df = pd.DataFrame([feature_vector], columns=FEATURES)
        arr_t = self.preprocessing_pipeline.transform(df)
        proba = float(self.model.predict_proba(arr_t)[0, 1])
        return proba


    def get_shap_values(self, feature_vector: list[float]) -> dict:
        """
        Compute SHAP values for a single transaction.
        Returns dict with feature names and their SHAP contributions.
        """
        import shap
        import pandas as pd

        # Build DataFrame with proper column names (required by preprocessing pipeline)
        df = pd.DataFrame([feature_vector], columns=FEATURES)
        arr_t = self.preprocessing_pipeline.transform(df)

        # Convert to numpy array explicitly for SHAP
        if hasattr(arr_t, "toarray"):
            arr_t = arr_t.toarray()
        arr_t = np.asarray(arr_t, dtype=float)

        # Use TreeExplainer for tree-based models, LinearExplainer for LR
        model_type = type(self.model).__name__
        try:
            if model_type in ("XGBClassifier", "RandomForestClassifier"):
                explainer = shap.TreeExplainer(self.model)
                shap_values = explainer(arr_t)
                # Modern SHAP: Explanation object, .values shape (1, n_features) or (1, n_features, n_classes)
                vals = shap_values.values
                if vals.ndim == 3:
                    # (samples, features, classes) -> take class 1
                    sv = vals[0, :, 1]
                elif vals.ndim == 2:
                    sv = vals[0]
                else:
                    sv = vals
            else:
                # LinearExplainer for Logistic Regression
                explainer = shap.LinearExplainer(self.model, arr_t)
                shap_values = explainer(arr_t)
                vals = shap_values.values
                sv = vals[0] if vals.ndim == 2 else vals
        except Exception:
            # Fallback: use legacy API
            if model_type in ("XGBClassifier", "RandomForestClassifier"):
                explainer = shap.TreeExplainer(self.model)
                sv_raw = explainer.shap_values(arr_t)
                if isinstance(sv_raw, list):
                    sv = sv_raw[1][0]
                else:
                    sv = sv_raw[0]
            else:
                explainer = shap.LinearExplainer(self.model, arr_t)
                sv_raw = explainer.shap_values(arr_t)
                sv = sv_raw[0]

        # Map to feature names
        contributions = []
        for i, fname in enumerate(FEATURES):
            contributions.append(
                {
                    "feature": fname,
                    "value": round(float(feature_vector[i]), 4),
                    "contribution": round(float(sv[i]), 4),
                    "direction": "fraud" if sv[i] > 0 else "legitimate",
                }
            )

        # Sort by absolute contribution
        contributions.sort(key=lambda x: abs(x["contribution"]), reverse=True)
        return {"contributions": contributions[:15]}  # top 15


# Global singleton
artifacts = ModelArtifacts()

