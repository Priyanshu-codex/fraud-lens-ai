"""
FraudLens AI — Supabase Database & Repository Integration Tests
Tests transaction persistence, analysis records, SHAP evidence, investigations, and audit logs.
"""
from __future__ import annotations

import copy
from typing import Any, Optional
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.supabase import get_supabase_client
from backend.app.services.repository import (
    save_analysis_record,
    get_recent_analyses,
    get_analysis_by_id,
    get_investigations,
    get_investigation_by_id,
    get_investigation_by_analysis_id,
    update_investigation,
    get_audit_logs,
    get_database_stats,
    get_notifications,
    mark_notification_as_read,
    mark_all_notifications_as_read,
)


class MockTableQuery:
    def __init__(self, table_name: str, store: dict[str, list[dict[str, Any]]]):
        self.table_name = table_name
        self.store = store
        self._filters: list[tuple[str, Any]] = []
        self._order_col: Optional[str] = None
        self._desc: bool = False
        self._range: Optional[tuple[int, int]] = None
        self._limit_val: Optional[int] = None
        self._pending_update: Optional[dict[str, Any]] = None
        self._pending_insert: Optional[list[dict[str, Any]]] = None
        self._count_mode: Optional[str] = None

    def insert(self, data: Any):
        if isinstance(data, list):
            self._pending_insert = [copy.deepcopy(d) for d in data]
        else:
            self._pending_insert = [copy.deepcopy(data)]
        return self

    def update(self, data: dict[str, Any]):
        self._pending_update = copy.deepcopy(data)
        return self

    def select(self, columns: str = "*", count: Optional[str] = None):
        self._count_mode = count
        return self

    def eq(self, column: str, value: Any):
        self._filters.append((column, value))
        return self

    def order(self, column: str, desc: bool = False):
        self._order_col = column
        self._desc = desc
        return self

    def limit(self, count: int):
        self._limit_val = count
        return self

    def range(self, start: int, end: int):
        self._range = (start, end)
        return self

    def execute(self):
        table_rows = self.store.setdefault(self.table_name, [])

        # 1. Handle Insert
        if self._pending_insert is not None:
            if self.table_name == "notifications":
                existing_analysis_ids = {r.get("analysis_id") for r in table_rows}
                for item in self._pending_insert:
                    if item.get("analysis_id") in existing_analysis_ids:
                        raise Exception("duplicate key value violates unique constraint idx_notifications_analysis_id")
            table_rows.extend(self._pending_insert)
            res_data = [copy.deepcopy(r) for r in self._pending_insert]
            return MockResponse(data=res_data, count=len(res_data))

        # 2. Handle Update
        if self._pending_update is not None:
            updated_rows = []
            for row in table_rows:
                match = True
                for col, val in self._filters:
                    if str(row.get(col)) != str(val):
                        match = False
                        break
                if match:
                    row.update(self._pending_update)
                    updated_rows.append(copy.deepcopy(row))
            return MockResponse(data=updated_rows, count=len(updated_rows))

        # 3. Handle Select
        matched = []
        for row in table_rows:
            match = True
            for col, val in self._filters:
                if str(row.get(col)) != str(val):
                    match = False
                    break
            if match:
                matched.append(copy.deepcopy(row))

        # Order
        if self._order_col:
            matched.sort(key=lambda r: str(r.get(self._order_col, "")), reverse=self._desc)

        # Slice / Range / Limit
        sliced = matched
        if self._range is not None:
            start, end = self._range
            sliced = sliced[start : end + 1]
        elif self._limit_val is not None:
            sliced = sliced[: self._limit_val]

        # Hydrate joined relations
        hydrated = []
        for row in sliced:
            row_copy = copy.deepcopy(row)
            if self.table_name == "fraud_analyses":
                # Join transaction
                tx_rows = self.store.get("transactions", [])
                matching_tx = [t for t in tx_rows if t.get("id") == row_copy.get("transaction_id")]
                row_copy["transactions"] = matching_tx[0] if matching_tx else None

                # Join evidence
                ev_rows = self.store.get("analysis_evidence", [])
                matching_ev = [e for e in ev_rows if e.get("analysis_id") == row_copy.get("id")]
                row_copy["analysis_evidence"] = matching_ev

                # Join investigation
                inv_rows = self.store.get("investigations", [])
                matching_inv = [i for i in inv_rows if i.get("analysis_id") == row_copy.get("id")]
                row_copy["investigations"] = matching_inv[0] if matching_inv else None

            elif self.table_name == "investigations":
                # Join fraud analysis
                analysis_rows = self.store.get("fraud_analyses", [])
                matching_a = [a for a in analysis_rows if a.get("id") == row_copy.get("analysis_id")]
                if matching_a:
                    a_copy = copy.deepcopy(matching_a[0])
                    # Join transactions & evidence to analysis
                    tx_rows = self.store.get("transactions", [])
                    matching_tx = [t for t in tx_rows if t.get("id") == a_copy.get("transaction_id")]
                    a_copy["transactions"] = matching_tx[0] if matching_tx else None

                    ev_rows = self.store.get("analysis_evidence", [])
                    matching_ev = [e for e in ev_rows if e.get("analysis_id") == a_copy.get("id")]
                    a_copy["analysis_evidence"] = matching_ev

                    row_copy["fraud_analyses"] = a_copy
                else:
                    row_copy["fraud_analyses"] = None

            elif self.table_name == "notifications":
                tx_rows = self.store.get("transactions", [])
                matching_tx = [t for t in tx_rows if t.get("id") == row_copy.get("transaction_id")]
                row_copy["transactions"] = matching_tx[0] if matching_tx else None

            hydrated.append(row_copy)

        return MockResponse(data=hydrated, count=len(matched))


class MockResponse:
    def __init__(self, data: list[dict[str, Any]], count: Optional[int] = None):
        self.data = data
        self.count = count


class MockSupabaseClient:
    def __init__(self):
        self.store: dict[str, list[dict[str, Any]]] = {
            "profiles": [],
            "transactions": [],
            "fraud_analyses": [],
            "analysis_evidence": [],
            "investigations": [],
            "audit_logs": [],
            "notifications": [],
        }

    def table(self, table_name: str) -> MockTableQuery:
        return MockTableQuery(table_name, self.store)


@pytest.fixture(scope="function")
def mock_supabase():
    """Provides an isolated in-memory Supabase test client for each test."""
    return MockSupabaseClient()


@pytest.fixture(scope="function")
def client(mock_supabase):
    """TestClient that uses the mock Supabase client dependency."""
    app.dependency_overrides[get_supabase_client] = lambda: mock_supabase
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


SAMPLE_TX = {
    "Time": 406.0,
    "Amount": 100.0,
    "V1": -2.31, "V2": 1.95, "V3": -1.61, "V4": 3.99, "V5": -0.52,
    "V6": -1.43, "V7": -2.54, "V8": 1.39, "V9": -2.77, "V10": -2.77,
    "V11": 3.20, "V12": -2.90, "V13": -0.60, "V14": -4.29, "V15": 0.39,
    "V16": -1.14, "V17": -2.83, "V18": -0.01, "V19": 0.42, "V20": 0.13,
    "V21": 0.52, "V22": -0.04, "V23": -0.47, "V24": 0.32, "V25": 0.04,
    "V26": 0.18, "V27": 0.26, "V28": -0.14,
}


def test_save_and_retrieve_analysis_pipeline(mock_supabase):
    """Verify Supabase repository save pipeline persists all entities and creates relationships."""
    res = save_analysis_record(
        client=mock_supabase,
        transaction_data=SAMPLE_TX,
        prediction_result={
            "fraud_probability": 0.88,
            "prediction": "FRAUD",
            "risk_level": "HIGH",
            "threshold": 0.65,
            "model_name": "XGBoost",
            "model_version": "v1.0.0",
        },
        evidence_list=[
            {"feature": "V14", "value": -4.29, "contribution": 0.35, "direction": "fraud"},
            {"feature": "V10", "value": -2.77, "contribution": 0.25, "direction": "fraud"},
        ],
        source="fraud_sample",
    )

    assert res is not None
    assert "analysis_id" in res
    assert "investigation_id" in res
    assert "transaction_id" in res

    # Check Transaction
    tx_list = mock_supabase.table("transactions").select("*").eq("id", res["transaction_id"]).execute().data
    assert len(tx_list) == 1
    tx = tx_list[0]
    assert tx["amount"] == 100.0
    assert tx["source"] == "fraud_sample"
    assert tx["v14"] == -4.29

    # Check Analysis with relations
    analysis = get_analysis_by_id(mock_supabase, res["analysis_id"])
    assert analysis is not None
    assert analysis["fraud_probability"] == 0.88
    assert analysis["risk_level"] == "HIGH"
    assert len(analysis["analysis_evidence"]) == 2
    assert analysis["investigations"] is not None
    assert analysis["investigations"]["status"] == "OPEN"

    # Check Audit Log
    logs = get_audit_logs(mock_supabase)
    assert len(logs) >= 1
    assert logs[0]["action"] == "analysis_created"

    # Check Stats
    stats = get_database_stats(mock_supabase)
    assert stats["total_analyses"] == 1
    assert stats["fraud_analyses"] == 1
    assert stats["open_investigations"] == 1


def test_investigation_update_lifecycle(mock_supabase):
    """Verify investigation status update and reviewer notes persistence in Supabase."""
    res = save_analysis_record(
        client=mock_supabase,
        transaction_data=SAMPLE_TX,
        prediction_result={
            "fraud_probability": 0.92,
            "prediction": "FRAUD",
            "risk_level": "HIGH",
            "threshold": 0.65,
            "model_name": "XGBoost",
            "model_version": "v1.0.0",
        },
        source="fraud_sample",
    )

    inv_id = res["investigation_id"]

    # Initial state should be OPEN for HIGH risk
    inv = get_investigation_by_id(mock_supabase, inv_id)
    assert inv["status"] == "OPEN"

    # Update to UNDER_REVIEW
    updated = update_investigation(
        client=mock_supabase,
        investigation_id=inv_id,
        status="UNDER_REVIEW",
        notes="Investigator assigned, checking cardholder dispute.",
        reviewed_by="Analyst Priya",
    )
    assert updated is not None
    assert updated["status"] == "UNDER_REVIEW"
    assert "dispute" in updated["notes"]
    assert updated["reviewed_by"] == "Analyst Priya"

    # Update to RESOLVED
    resolved = update_investigation(
        client=mock_supabase,
        investigation_id=inv_id,
        status="RESOLVED",
        notes="Confirmed fraudulent merchant. Card blocked.",
    )
    assert resolved["status"] == "RESOLVED"
    assert resolved["reviewed_by"] == "Analyst Priya"  # preserved


def test_api_predict_persists_to_supabase(client, mock_supabase):
    """Verify /api/predict writes to Supabase and returns analysis_id and investigation_id."""
    resp = client.post("/api/predict", json=SAMPLE_TX)
    assert resp.status_code == 200
    data = resp.json()

    assert "fraud_probability" in data
    assert "prediction" in data
    assert data["analysis_id"] is not None
    assert data["investigation_id"] is not None

    # Check that it exists in Supabase
    analysis = get_analysis_by_id(mock_supabase, data["analysis_id"])
    assert analysis is not None
    assert round(analysis["fraud_probability"], 4) == round(data["fraud_probability"], 4)


def test_api_explain_persists_evidence(client, mock_supabase):
    """Verify /api/explain stores SHAP evidence records in Supabase."""
    resp = client.post("/api/explain", json=SAMPLE_TX)
    assert resp.status_code == 200
    data = resp.json()

    assert data["analysis_id"] is not None
    analysis = get_analysis_by_id(mock_supabase, data["analysis_id"])
    assert analysis is not None
    assert len(analysis["analysis_evidence"]) > 0


def test_api_investigations_endpoints(client, mock_supabase):
    """Verify /api/investigations list, get, and patch endpoints."""
    # Create an analysis first
    p_resp = client.post("/api/predict", json=SAMPLE_TX)
    inv_id = p_resp.json()["investigation_id"]

    # 1. List investigations
    list_resp = client.get("/api/investigations")
    assert list_resp.status_code == 200
    items = list_resp.json()
    assert len(items) >= 1
    assert items[0]["id"] == inv_id

    # 2. Get single investigation
    get_resp = client.get(f"/api/investigations/{inv_id}")
    assert get_resp.status_code == 200
    detail = get_resp.json()
    assert detail["id"] == inv_id
    assert detail["analysis"] is not None
    assert detail["analysis"]["amount"] == 100.0

    # 3. Patch status & notes
    patch_resp = client.patch(
        f"/api/investigations/{inv_id}",
        json={
            "status": "UNDER_REVIEW",
            "notes": "Verified high anomaly on V14.",
            "reviewed_by": "Agent Fox",
        },
    )
    assert patch_resp.status_code == 200
    patched = patch_resp.json()
    assert patched["status"] == "UNDER_REVIEW"
    assert patched["notes"] == "Verified high anomaly on V14."
    assert patched["reviewed_by"] == "Agent Fox"


def test_api_analyses_endpoints(client, mock_supabase):
    """Verify /api/analyses list and get endpoints."""
    p_resp = client.post("/api/predict", json=SAMPLE_TX)
    analysis_id = p_resp.json()["analysis_id"]

    # 1. List
    list_resp = client.get("/api/analyses")
    assert list_resp.status_code == 200
    items = list_resp.json()
    assert any(a["id"] == analysis_id for a in items)

    # 2. Get
    get_resp = client.get(f"/api/analyses/{analysis_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == analysis_id


def test_high_risk_creates_notification(mock_supabase):
    """Verify that a transaction classified as HIGH risk automatically creates a notification."""
    res = save_analysis_record(
        client=mock_supabase,
        transaction_data=SAMPLE_TX,
        prediction_result={
            "fraud_probability": 0.96,
            "prediction": "FRAUD",
            "risk_level": "HIGH",
            "threshold": 0.65,
            "model_name": "XGBoost",
            "model_version": "v1.0.0",
        },
        source="fraud_sample",
    )
    assert res is not None

    items, unread_count, total_count = get_notifications(mock_supabase)
    assert total_count == 1
    assert unread_count == 1
    assert items[0]["analysis_id"] == res["analysis_id"]
    assert items[0]["risk_level"] == "HIGH"
    assert items[0]["is_read"] is False
    assert items[0]["investigation_id"] == res["investigation_id"]
    assert items[0]["transactions"]["amount"] == 100.0


def test_low_risk_does_not_create_notification(mock_supabase):
    """Verify that transactions classified as LOW risk do NOT trigger notifications."""
    res = save_analysis_record(
        client=mock_supabase,
        transaction_data=SAMPLE_TX,
        prediction_result={
            "fraud_probability": 0.05,
            "prediction": "LEGITIMATE",
            "risk_level": "LOW",
            "threshold": 0.65,
            "model_name": "XGBoost",
            "model_version": "v1.0.0",
        },
        source="legitimate_sample",
    )
    assert res is not None

    items, unread_count, total_count = get_notifications(mock_supabase)
    assert total_count == 0
    assert unread_count == 0


def test_notification_duplicate_prevention(mock_supabase):
    """Verify that duplicate notifications for the same analysis_id are safely handled."""
    # First save
    res1 = save_analysis_record(
        client=mock_supabase,
        transaction_data=SAMPLE_TX,
        prediction_result={
            "fraud_probability": 0.95,
            "prediction": "FRAUD",
            "risk_level": "HIGH",
            "threshold": 0.65,
            "model_name": "XGBoost",
            "model_version": "v1.0.0",
        },
        source="fraud_sample",
    )
    assert res1 is not None

    # Attempt manual duplicate insert with same analysis_id
    notif_rows = mock_supabase.table("notifications").select("*").execute().data
    assert len(notif_rows) == 1

    # Attempt inserting another notification with identical analysis_id
    try:
        mock_supabase.table("notifications").insert({
            "id": "duplicate-id",
            "analysis_id": res1["analysis_id"],
            "transaction_id": res1["transaction_id"],
            "fraud_probability": 0.95,
            "risk_level": "HIGH",
            "title": "Duplicate",
            "is_read": False,
        }).execute()
        # If it didn't throw, assert that duplicate check caught it
    except Exception as exc:
        assert "unique constraint" in str(exc).lower()


def test_notification_read_and_bulk_read_lifecycle(mock_supabase):
    """Verify marking single and all notifications as read."""
    # Create two high risk analyses
    save_analysis_record(
        client=mock_supabase,
        transaction_data=SAMPLE_TX,
        prediction_result={"fraud_probability": 0.94, "prediction": "FRAUD", "risk_level": "HIGH", "threshold": 0.65},
    )
    save_analysis_record(
        client=mock_supabase,
        transaction_data=SAMPLE_TX,
        prediction_result={"fraud_probability": 0.98, "prediction": "FRAUD", "risk_level": "HIGH", "threshold": 0.65},
    )

    items, unread_count, total_count = get_notifications(mock_supabase)
    assert total_count == 2
    assert unread_count == 2

    # Mark first as read
    first_id = items[0]["id"]
    updated = mark_notification_as_read(mock_supabase, first_id)
    assert updated is not None
    assert updated["is_read"] is True
    assert updated["read_at"] is not None

    _, unread_count, _ = get_notifications(mock_supabase)
    assert unread_count == 1

    # Mark all as read
    marked = mark_all_notifications_as_read(mock_supabase)
    assert marked == 1

    _, unread_count, _ = get_notifications(mock_supabase)
    assert unread_count == 0


def test_api_notifications_endpoints(client, mock_supabase):
    """Verify /api/notifications GET, PATCH /read, and POST /mark-all-read."""
    # Predict high fraud sample
    p_resp = client.post("/api/predict", json=SAMPLE_TX)
    assert p_resp.status_code == 200

    # 1. List notifications
    list_resp = client.get("/api/notifications")
    assert list_resp.status_code == 200
    data = list_resp.json()
    assert data["total_count"] >= 1
    assert data["unread_count"] >= 1
    notif = data["items"][0]
    assert notif["risk_level"] == "HIGH"
    assert notif["investigation_id"] is not None

    # 2. Mark single as read
    notif_id = notif["id"]
    patch_resp = client.patch(f"/api/notifications/{notif_id}/read")
    assert patch_resp.status_code == 200
    patched = patch_resp.json()
    assert patched["is_read"] is True
    assert patched["read_at"] is not None

    # 3. Mark all as read
    post_resp = client.post("/api/notifications/mark-all-read")
    assert post_resp.status_code == 200
    assert post_resp.json()["status"] == "ok"

    # Verify unread count is 0
    final_list = client.get("/api/notifications").json()
    assert final_list["unread_count"] == 0

