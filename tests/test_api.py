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

    def test_health_root_returns_200(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200

    def test_health_has_required_fields(self, client):
        data = client.get("/api/health").json()
        assert "status" in data
        assert "model_loaded" in data
        assert "model_version" in data
        assert "timestamp" in data
        assert "api" in data
        assert "preprocessing" in data

    def test_health_model_loaded(self, client):
        data = client.get("/api/health").json()
        assert data["model_loaded"] is True
        assert data["status"] == "ok"

    def test_ready_endpoint_returns_200(self, client):
        resp = client.get("/ready")
        assert resp.status_code == 200
        data = resp.json()
        assert data["ready"] is True
        assert data["status"] == "ready"
        assert data["model"] == "ready"
        assert "threshold" in data

    def test_api_ready_endpoint_returns_200(self, client):
        resp = client.get("/api/ready")
        assert resp.status_code == 200
        data = resp.json()
        assert data["ready"] is True

    def test_model_health_endpoint_returns_200(self, client):
        resp = client.get("/health/model")
        assert resp.status_code == 200
        data = resp.json()
        assert data["model_loaded"] is True
        assert data["model_name"] == "XGBoost"
        assert data["feature_count"] == 30
        assert data["shap_ready"] is True
        assert len(data["features"]) == 30

    def test_api_model_health_endpoint_returns_200(self, client):
        resp = client.get("/api/health/model")
        assert resp.status_code == 200
        data = resp.json()
        assert data["model_loaded"] is True



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


class TestReadinessFailure:
    def test_ready_and_model_health_return_503_when_not_loaded(self, client, monkeypatch):
        """Verify readiness probe returns 503 Service Unavailable when model is uninitialized."""
        from app.ml.loader import artifacts
        original_loaded = artifacts.loaded
        try:
            artifacts.loaded = False
            # /ready should return 503
            resp = client.get("/ready")
            assert resp.status_code == 503
            data = resp.json()
            assert data["ready"] is False
            assert data["status"] == "initializing"

            # /health/model should return 503
            resp_m = client.get("/health/model")
            assert resp_m.status_code == 503
            data_m = resp_m.json()
            assert data_m["model_loaded"] is False

            # /health (liveness) should still return 200 with degraded status
            resp_h = client.get("/health")
            assert resp_h.status_code == 200
            data_h = resp_h.json()
            assert data_h["status"] == "degraded"
            assert data_h["model_loaded"] is False
        finally:
            artifacts.loaded = original_loaded


class TestVercelEntrypoint:
    def test_vercel_entrypoint_app_exports(self):
        """Verify api.index exports a valid FastAPI app instance for @vercel/python."""
        import api.index as vercel_entry
        assert hasattr(vercel_entry, "app")
        assert vercel_entry.app.title == "FraudLens AI"

    def test_vercel_entrypoint_health_endpoints(self):
        """Verify api.index handles both /health and /api/health."""
        from fastapi.testclient import TestClient
        import api.index as vercel_entry
        with TestClient(vercel_entry.app) as c:
            resp_root = c.get("/health")
            assert resp_root.status_code == 200
            assert resp_root.json()["status"] == "ok"

            resp_api = c.get("/api/health")
            assert resp_api.status_code == 200
            assert resp_api.json()["status"] == "ok"

    def test_vercel_entrypoint_predict_and_explain(self, samples):
        """Verify api.index executes real model inference and SHAP explainability."""
        from fastapi.testclient import TestClient
        import api.index as vercel_entry
        with TestClient(vercel_entry.app) as c:
            txn = samples["fraud"][0]
            pred = c.post("/api/predict", json=txn)
            assert pred.status_code == 200
            assert pred.json()["prediction"] == "FRAUD"
            assert pred.json()["fraud_probability"] > 0.9

            expl = c.post("/api/explain", json=txn)
            assert expl.status_code == 200
            assert len(expl.json()["top_contributions"]) == 15

    def test_vercel_docs_endpoint(self):
        """Verify /api/docs and /api/openapi.json return valid schemas."""
        from fastapi.testclient import TestClient
        import api.index as vercel_entry
        with TestClient(vercel_entry.app) as c:
            docs = c.get("/api/docs")
            assert docs.status_code == 200
            openapi = c.get("/api/openapi.json")
            assert openapi.status_code == 200
            assert "paths" in openapi.json()


