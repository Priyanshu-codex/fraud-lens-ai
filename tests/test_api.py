"""
FraudLens AI — API Tests
=========================
Tests all FastAPI endpoints for correctness.
Run from repo root: pytest tests/test_api.py -v
"""
from __future__ import annotations

import json
import pytest
from pathlib import Path


# A known fraud transaction (first in the test samples)
ROOT = Path(__file__).resolve().parent.parent
SAMPLES_PATH = ROOT / "backend" / "models" / "sample_transactions.json"


@pytest.fixture(scope="module")
def samples():
    with open(SAMPLES_PATH) as f:
        return json.load(f)


@pytest.fixture(scope="module")
def client():
    """Create a test client. Model must be loaded first."""
    import sys
    backend_path = str(ROOT / "backend")
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)
    from fastapi.testclient import TestClient
    from app.main import app
    with TestClient(app) as c:
        yield c



class TestHealth:
    def test_health_returns_200(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200

    def test_health_has_required_fields(self, client):
        data = client.get("/api/health").json()
        assert "status" in data
        assert "model_loaded" in data
        assert "model_version" in data
        assert "timestamp" in data

    def test_health_model_loaded(self, client):
        data = client.get("/api/health").json()
        assert data["model_loaded"] is True
        assert data["status"] == "ok"


class TestPredict:
    def test_predict_legitimate_sample(self, client, samples):
        txn = samples["legitimate"][0]
        resp = client.post("/api/predict", json=txn)
        assert resp.status_code == 200
        data = resp.json()
        assert "fraud_probability" in data
        assert "prediction" in data
        assert "risk_level" in data
        assert "threshold" in data
        assert data["prediction"] in ("FRAUD", "LEGITIMATE")
        assert data["risk_level"] in ("LOW", "REVIEW", "HIGH")
        assert 0.0 <= data["fraud_probability"] <= 1.0
        assert 0.0 < data["threshold"] < 1.0

    def test_predict_fraud_sample(self, client, samples):
        txn = samples["fraud"][0]
        resp = client.post("/api/predict", json=txn)
        assert resp.status_code == 200
        data = resp.json()
        assert data["prediction"] == "FRAUD"
        assert data["fraud_probability"] >= data["threshold"]
        assert data["risk_level"] == "HIGH"

    def test_predict_missing_field_fails(self, client, samples):
        txn = {k: v for k, v in samples["legitimate"][0].items() if k != "Amount"}
        resp = client.post("/api/predict", json=txn)
        assert resp.status_code == 422

    def test_predict_invalid_amount_fails(self, client, samples):
        txn = dict(samples["legitimate"][0])
        txn["Amount"] = -10  # negative amount not allowed
        resp = client.post("/api/predict", json=txn)
        assert resp.status_code == 422

    def test_predict_wrong_type_fails(self, client, samples):
        txn = dict(samples["legitimate"][0])
        txn["V1"] = "not_a_number"
        resp = client.post("/api/predict", json=txn)
        assert resp.status_code == 422


class TestExplain:
    def test_explain_returns_contributions(self, client, samples):
        txn = samples["fraud"][0]
        resp = client.post("/api/explain", json=txn)
        assert resp.status_code == 200
        data = resp.json()
        assert "top_contributions" in data
        assert len(data["top_contributions"]) > 0
        contrib = data["top_contributions"][0]
        assert "feature" in contrib
        assert "value" in contrib
        assert "contribution" in contrib
        assert "direction" in contrib
        assert contrib["direction"] in ("fraud", "legitimate")

    def test_explain_has_disclaimer(self, client, samples):
        txn = samples["legitimate"][0]
        resp = client.post("/api/explain", json=txn)
        data = resp.json()
        assert "disclaimer" in data
        assert len(data["disclaimer"]) > 0

    def test_explain_fraud_top_contribution(self, client, samples):
        txn = samples["fraud"][0]
        data = client.post("/api/explain", json=txn).json()
        # Top contribution for a fraud transaction should push toward fraud
        top = data["top_contributions"][0]
        assert top["direction"] == "fraud"


class TestAnalytics:
    def test_analytics_returns_200(self, client):
        resp = client.get("/api/analytics")
        assert resp.status_code == 200

    def test_analytics_correct_counts(self, client):
        data = client.get("/api/analytics").json()
        assert data["total_transactions"] == 284807
        assert data["fraud_transactions"] == 492
        assert data["legitimate_transactions"] == 284315
        assert abs(data["fraud_rate"] - 0.1727) < 0.01

    def test_analytics_has_model_metrics(self, client):
        data = client.get("/api/analytics").json()
        metrics = data["model_metrics"]
        assert "pr_auc" in metrics
        assert "precision" in metrics
        assert "recall" in metrics
        assert metrics["pr_auc"] > 0.7  # XGBoost should have good PR-AUC

    def test_analytics_has_confusion_matrix(self, client):
        data = client.get("/api/analytics").json()
        cm = data["confusion_matrix"]
        assert all(k in cm for k in ("true_negatives", "false_positives", "false_negatives", "true_positives"))
        assert cm["true_negatives"] > 40000  # Most legitimates correctly classified

    def test_analytics_has_threshold_analysis(self, client):
        data = client.get("/api/analytics").json()
        assert len(data["threshold_analysis"]) > 0
        point = data["threshold_analysis"][0]
        assert "threshold" in point
        assert "f1" in point
        assert "precision" in point
        assert "recall" in point


class TestModelInfo:
    def test_model_info_returns_200(self, client):
        resp = client.get("/api/model-info")
        assert resp.status_code == 200

    def test_model_info_correct_model(self, client):
        data = client.get("/api/model-info").json()
        assert data["model_name"] == "XGBoost"
        assert data["feature_count"] == 30
        assert 0.0 < data["threshold"] < 1.0

    def test_model_info_has_metrics(self, client):
        data = client.get("/api/model-info").json()
        assert data["pr_auc"] > 0.7
        assert data["precision"] > 0.8
        assert "selection_reason" in data
        assert len(data["selection_reason"]) > 0


class TestThreshold:
    def test_threshold_not_default(self, client):
        """Threshold must not be the naive default of 0.5."""
        data = client.get("/api/model-info").json()
        assert data["threshold"] != 0.5

    def test_prediction_uses_correct_threshold(self, client, samples):
        """Verify prediction/threshold consistency."""
        txn = samples["fraud"][0]
        data = client.post("/api/predict", json=txn).json()
        prob = data["fraud_probability"]
        threshold = data["threshold"]
        prediction = data["prediction"]
        if prob >= threshold:
            assert prediction == "FRAUD"
        else:
            assert prediction == "LEGITIMATE"
