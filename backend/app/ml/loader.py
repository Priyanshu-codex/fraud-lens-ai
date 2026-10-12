"""
FraudLens AI — Model Loader
Loads all ML artifacts once at startup.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
import os
from typing import Any

import joblib
import numpy as np

log = logging.getLogger(__name__)


def _find_models_dir() -> Path:
    """
    Robustly locate backend/models directory regardless of working directory
    or deployment root path (e.g. Render root directory set to repo or 'backend').
    """
    this_file = Path(__file__).resolve()
    candidates = [
        Path(os.environ["MODELS_DIR"]) if "MODELS_DIR" in os.environ else None,
        this_file.parents[2] / "models" if len(this_file.parents) > 2 else None,
        this_file.parents[3] / "backend" / "models" if len(this_file.parents) > 3 else None,
        Path.cwd() / "backend" / "models",
        Path.cwd() / "models",
    ]
    for candidate in candidates:
        if candidate and candidate.is_dir() and (candidate / "fraud_model.joblib").exists():
            return candidate
    # Fallback to direct parent
    return this_file.parents[2] / "models"


MODELS_DIR = _find_models_dir()

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
        self._explainer: Any = None
        self.models_dir: Path = MODELS_DIR

    @property
    def is_ready(self) -> bool:
        """Check if all components are initialized and ready for prediction."""
        return self.loaded and self.model is not None and self.preprocessing_pipeline is not None

    def load(self, force: bool = False) -> bool:
        """Load all artifacts from disk. Returns True on success."""
        if self.loaded and not force:
            return True
        try:
            self.models_dir = _find_models_dir()
            log.info("Resolving model artifacts from: %s", self.models_dir)

            model_file = self.models_dir / "fraud_model.joblib"
            pipeline_file = self.models_dir / "preprocessing_pipeline.joblib"
            metadata_file = self.models_dir / "model_metadata.json"
            threshold_file = self.models_dir / "threshold_analysis.json"
            samples_file = self.models_dir / "sample_transactions.json"

            for required_file in [model_file, pipeline_file, metadata_file, threshold_file, samples_file]:
                if not required_file.is_file():
                    raise FileNotFoundError(f"Missing required model artifact file: {required_file.name}")

            log.info("Loading preprocessing pipeline...")
            self.preprocessing_pipeline = joblib.load(pipeline_file)

            log.info("Loading trained model...")
            self.model = joblib.load(model_file)

            log.info("Loading metadata...")
            with open(metadata_file, "r", encoding="utf-8") as f:
                self.metadata = json.load(f)

            log.info("Loading threshold analysis...")
            with open(threshold_file, "r", encoding="utf-8") as f:
                self.threshold_analysis = json.load(f)

            log.info("Loading sample transactions...")
            with open(samples_file, "r", encoding="utf-8") as f:
                self.sample_transactions = json.load(f)

            self.loaded = True
            self.load_error = None

            # Pre-initialize SHAP explainer once at startup for sub-millisecond inference
            try:
                import shap
                model_type = type(self.model).__name__
                if model_type in ("XGBClassifier", "RandomForestClassifier"):
                    self._explainer = shap.TreeExplainer(self.model)
            except Exception as expl_exc:
                log.warning("Deferred SHAP explainer initialization: %s", expl_exc)
                self._explainer = None

            log.info(
                "Model artifacts loaded successfully: %s v%s",
                self.metadata.get("model_name"),
                self.metadata.get("model_version"),
            )
            return True

        except Exception as e:
            self.loaded = False
            self.load_error = str(e)
            log.error("Failed to load model artifacts from %s: %s", self.models_dir, e)
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

        # Use cached explainer for sub-millisecond explanation
        model_type = type(self.model).__name__
        try:
            if self._explainer is None:
                if model_type in ("XGBClassifier", "RandomForestClassifier"):
                    self._explainer = shap.TreeExplainer(self.model)
                else:
                    self._explainer = shap.LinearExplainer(self.model, arr_t)
            explainer = self._explainer
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
        except Exception:
            # Fallback: use legacy API or fresh explainer
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

