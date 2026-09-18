"""
FraudLens AI — ML Pipeline Tests
Tests dataset schema, class distribution, preprocessing, and model behavior.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parent.parent
MODELS_DIR = ROOT / "backend" / "models"
DATASET_CANDIDATES = [
    ROOT / "data" / "creditcard.csv",
    ROOT / "ml" / "data" / "creditcard.csv",
    ROOT / "fraud detection-20260918T042820Z-1-001" / "fraud detection" / "creditcard.csv",
]
DATASET_PATH = next((p for p in DATASET_CANDIDATES if p.exists()), DATASET_CANDIDATES[0])

EXPECTED_FEATURES = (
    ["Time", "Amount"]
    + [f"V{i}" for i in range(1, 29)]
)


class TestDataset:
    """Basic sanity checks on the dataset schema."""

    @pytest.fixture(scope="class")
    def metadata(self):
        with open(MODELS_DIR / "model_metadata.json") as f:
            return json.load(f)

    def test_total_transactions(self, metadata):
        assert metadata["dataset"]["total_transactions"] == 284807

    def test_fraud_count(self, metadata):
        assert metadata["dataset"]["fraud_transactions"] == 492

    def test_legitimate_count(self, metadata):
        assert metadata["dataset"]["legitimate_transactions"] == 284315

    def test_fraud_rate_correct(self, metadata):
        rate = metadata["dataset"]["fraud_rate"]
        assert abs(rate - 0.1727) < 0.01

    def test_feature_count(self, metadata):
        assert metadata["feature_count"] == 30

    def test_features_correct(self, metadata):
        assert set(metadata["features"]) == set(EXPECTED_FEATURES)


class TestSplit:
    """Verify stratified split properties."""

    @pytest.fixture(scope="class")
    def metadata(self):
        with open(MODELS_DIR / "model_metadata.json") as f:
            return json.load(f)

    def test_split_sizes_sum_to_total(self, metadata):
        ds = metadata["dataset"]
        total = ds["train_size"] + ds["val_size"] + ds["test_size"]
        assert total == ds["total_transactions"]

    def test_train_is_largest_split(self, metadata):
        ds = metadata["dataset"]
        assert ds["train_size"] > ds["val_size"]
        assert ds["train_size"] > ds["test_size"]


class TestModelArtifacts:
    """Verify all model artifacts are present and valid."""

    def test_model_file_exists(self):
        assert (MODELS_DIR / "fraud_model.joblib").exists()

    def test_preprocessing_file_exists(self):
        assert (MODELS_DIR / "preprocessing_pipeline.joblib").exists()

    def test_metadata_file_exists(self):
        assert (MODELS_DIR / "model_metadata.json").exists()

    def test_threshold_analysis_file_exists(self):
        assert (MODELS_DIR / "threshold_analysis.json").exists()

    def test_samples_file_exists(self):
        assert (MODELS_DIR / "sample_transactions.json").exists()

    def test_model_loads_successfully(self):
        import joblib
        model = joblib.load(MODELS_DIR / "fraud_model.joblib")
        assert hasattr(model, "predict_proba")

    def test_preprocessing_loads_successfully(self):
        import joblib
        pipeline = joblib.load(MODELS_DIR / "preprocessing_pipeline.joblib")
        assert hasattr(pipeline, "transform")


class TestThresholdAnalysis:
    """Verify threshold analysis properties."""

    @pytest.fixture(scope="class")
    def analysis(self):
        with open(MODELS_DIR / "threshold_analysis.json") as f:
            return json.load(f)

    @pytest.fixture(scope="class")
    def metadata(self):
        with open(MODELS_DIR / "model_metadata.json") as f:
            return json.load(f)

    def test_threshold_not_default(self, metadata):
        """Selected threshold should not be the naive 0.5."""
        assert metadata["threshold"] != 0.5

    def test_threshold_in_valid_range(self, metadata):
        t = metadata["threshold"]
        assert 0.0 < t < 1.0

    def test_analysis_covers_range(self, analysis):
        thresholds = [p["threshold"] for p in analysis]
        assert min(thresholds) < 0.5
        assert max(thresholds) > 0.8

    def test_analysis_has_required_fields(self, analysis):
        required = {"threshold", "precision", "recall", "f1", "false_positives", "false_negatives"}
        for point in analysis:
            assert required.issubset(set(point.keys()))


class TestModelPerformance:
    """Verify final test set metrics meet minimum quality bar."""

    @pytest.fixture(scope="class")
    def metadata(self):
        with open(MODELS_DIR / "model_metadata.json") as f:
            return json.load(f)

    def test_pr_auc_above_minimum(self, metadata):
        """XGBoost PR-AUC should be well above random baseline."""
        assert metadata["test_metrics"]["pr_auc"] > 0.70

    def test_precision_above_minimum(self, metadata):
        assert metadata["test_metrics"]["precision"] > 0.80

    def test_model_selected_is_xgboost(self, metadata):
        """Based on experiment, XGBoost should win."""
        assert metadata["model_name"] == "XGBoost"

    def test_selection_reason_documented(self, metadata):
        assert len(metadata["selection_reason"]) > 0


class TestSamples:
    """Verify sample transactions are properly structured."""

    @pytest.fixture(scope="class")
    def samples(self):
        with open(MODELS_DIR / "sample_transactions.json") as f:
            return json.load(f)

    def test_fraud_samples_exist(self, samples):
        assert len(samples["fraud"]) > 0

    def test_legitimate_samples_exist(self, samples):
        assert len(samples["legitimate"]) > 0

    def test_sample_has_all_features(self, samples):
        txn = samples["fraud"][0]
        for f in EXPECTED_FEATURES:
            assert f in txn, f"Missing feature: {f}"

    def test_all_feature_values_are_float(self, samples):
        txn = samples["fraud"][0]
        for f in EXPECTED_FEATURES:
            assert isinstance(txn[f], (int, float)), f"Feature {f} is not numeric"
