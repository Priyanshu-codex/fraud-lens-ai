"""
FraudLens AI — Supabase Database Repository & Persistence Service
Provides safe CRUD operations for transactions, fraud analyses, evidence, investigations, and audit logs.
Uses official Supabase PostgREST client. Fails safely without breaking callers.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from supabase import Client

log = logging.getLogger(__name__)


def generate_uuid() -> str:
    return str(uuid.uuid4())


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def save_analysis_record(
    client: Optional[Client],
    transaction_data: dict[str, Any],
    prediction_result: dict[str, Any],
    evidence_list: Optional[list[dict[str, Any]]] = None,
    source: str = "custom",
    user_id: Optional[str] = None,
) -> Optional[dict[str, str]]:
    """
    Safely persist a transaction, its fraud analysis, SHAP evidence, and an initial investigation record to Supabase.
    Returns {"analysis_id": ..., "investigation_id": ..., "transaction_id": ...} or None on error/offline.
    """
    if client is None:
        log.debug("Supabase client not available. Skipping persistence.")
        return None

    try:
        tx_id = generate_uuid()
        analysis_id = generate_uuid()
        investigation_id = generate_uuid()
        now = utc_now_iso()

        # 1. Insert Transaction
        tx_payload: dict[str, Any] = {
            "id": tx_id,
            "user_id": user_id,
            "source": source,
            "time": float(transaction_data.get("Time", 0.0)),
            "amount": float(transaction_data.get("Amount", 0.0)),
            "created_at": now,
        }
        for i in range(1, 29):
            col_key = f"V{i}"
            tx_payload[f"v{i}"] = float(transaction_data.get(col_key, transaction_data.get(col_key.lower(), 0.0)))

        client.table("transactions").insert(tx_payload).execute()

        # 2. Insert Fraud Analysis
        risk_level = str(prediction_result["risk_level"])
        fraud_prob = float(prediction_result["fraud_probability"])
        pred_label = str(prediction_result["prediction"])
        threshold_val = float(prediction_result["threshold"])

        analysis_payload: dict[str, Any] = {
            "id": analysis_id,
            "transaction_id": tx_id,
            "fraud_probability": fraud_prob,
            "prediction": pred_label,
            "risk_level": risk_level,
            "threshold": threshold_val,
            "model_name": str(prediction_result.get("model_name", "XGBoost")),
            "model_version": str(prediction_result.get("model_version", "v1.0.0")),
            "created_at": now,
        }
        client.table("fraud_analyses").insert(analysis_payload).execute()

        # 3. Insert SHAP Evidence (if provided)
        if evidence_list:
            evidence_rows = []
            for idx, item in enumerate(evidence_list, start=1):
                evidence_rows.append({
                    "id": generate_uuid(),
                    "analysis_id": analysis_id,
                    "feature_name": item.get("feature", f"V{idx}"),
                    "feature_value": float(item.get("value", 0.0)),
                    "contribution": float(item.get("contribution", 0.0)),
                    "direction": str(item.get("direction", "fraud")),
                    "rank": idx,
                    "created_at": now,
                })
            if evidence_rows:
                client.table("analysis_evidence").insert(evidence_rows).execute()

        # 4. Insert Initial Investigation Record
        initial_status = "OPEN" if risk_level in ("HIGH", "REVIEW") else "RESOLVED"
        investigation_payload: dict[str, Any] = {
            "id": investigation_id,
            "analysis_id": analysis_id,
            "status": initial_status,
            "notes": f"Automatic intake: risk classified as {risk_level} (probability {fraud_prob:.4f}).",
            "reviewed_by": "System",
            "created_at": now,
            "updated_at": now,
        }
        client.table("investigations").insert(investigation_payload).execute()

        # 5. Automatically create Notification Record if HIGH risk
        if risk_level == "HIGH":
            try:
                notif_payload: dict[str, Any] = {
                    "id": generate_uuid(),
                    "user_id": user_id,
                    "transaction_id": tx_id,
                    "analysis_id": analysis_id,
                    "investigation_id": investigation_id,
                    "fraud_probability": fraud_prob,
                    "risk_level": risk_level,
                    "title": "Critical Fraud Alert",
                    "message": f"High risk anomaly detected with {fraud_prob * 100:.1f}% fraud probability.",
                    "is_read": False,
                    "created_at": now,
                }
                client.table("notifications").insert(notif_payload).execute()
            except Exception as notif_exc:
                log.warning("Notification creation skipped/failed: %s", notif_exc)

        # 6. Insert Audit Log
        audit_payload: dict[str, Any] = {
            "id": generate_uuid(),
            "user_id": user_id,
            "action": "analysis_created",
            "entity_type": "analysis",
            "entity_id": analysis_id,
            "details": {
                "risk_level": risk_level,
                "fraud_probability": fraud_prob,
                "source": source,
                "investigation_id": investigation_id,
            },
            "created_at": now,
        }
        client.table("audit_logs").insert(audit_payload).execute()

        return {
            "transaction_id": tx_id,
            "analysis_id": analysis_id,
            "investigation_id": investigation_id,
        }
    except Exception as exc:
        log.error("Supabase database persistence failed: %s", exc, exc_info=True)
        return None


def get_recent_analyses(
    client: Optional[Client],
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """Retrieve recent analyses ordered by creation time descending with related records."""
    if client is None:
        return []

    try:
        res = (
            client.table("fraud_analyses")
            .select("*, transactions(*), analysis_evidence(*), investigations(*)")
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return res.data or []
    except Exception as exc:
        log.error("Failed to fetch recent analyses from Supabase: %s", exc)
        return []


def get_analysis_by_id(client: Optional[Client], analysis_id: str) -> Optional[dict[str, Any]]:
    """Retrieve a single analysis record with all relations."""
    if client is None:
        return None

    try:
        res = (
            client.table("fraud_analyses")
            .select("*, transactions(*), analysis_evidence(*), investigations(*)")
            .eq("id", analysis_id)
            .limit(1)
            .execute()
        )
        if res.data and len(res.data) > 0:
            return res.data[0]
        return None
    except Exception as exc:
        log.error("Failed to fetch analysis %s from Supabase: %s", analysis_id, exc)
        return None


def get_investigations(
    client: Optional[Client],
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """Retrieve investigations, optionally filtered by status, with joined analysis context."""
    if client is None:
        return []

    try:
        query = (
            client.table("investigations")
            .select("*, fraud_analyses(*, transactions(id, amount, time, source))")
            .order("created_at", desc=True)
        )
        if status:
            query = query.eq("status", status.upper())

        res = query.range(offset, offset + limit - 1).execute()
        return res.data or []
    except Exception as exc:
        log.error("Failed to fetch investigations from Supabase: %s", exc)
        return []


def get_investigation_by_id(client: Optional[Client], investigation_id: str) -> Optional[dict[str, Any]]:
    """Retrieve an investigation by ID with full transaction and evidence context."""
    if client is None:
        return None

    try:
        res = (
            client.table("investigations")
            .select("*, fraud_analyses(*, transactions(*), analysis_evidence(*))")
            .eq("id", investigation_id)
            .limit(1)
            .execute()
        )
        if res.data and len(res.data) > 0:
            return res.data[0]
        return None
    except Exception as exc:
        log.error("Failed to fetch investigation %s from Supabase: %s", investigation_id, exc)
        return None


def get_investigation_by_analysis_id(client: Optional[Client], analysis_id: str) -> Optional[dict[str, Any]]:
    """Retrieve an investigation by its linked analysis ID."""
    if client is None:
        return None

    try:
        res = (
            client.table("investigations")
            .select("*, fraud_analyses(*, transactions(*), analysis_evidence(*))")
            .eq("analysis_id", analysis_id)
            .limit(1)
            .execute()
        )
        if res.data and len(res.data) > 0:
            return res.data[0]
        return None
    except Exception as exc:
        log.error("Failed to fetch investigation for analysis %s: %s", analysis_id, exc)
        return None


def update_investigation(
    client: Optional[Client],
    investigation_id: str,
    status: Optional[str] = None,
    notes: Optional[str] = None,
    reviewed_by: Optional[str] = None,
) -> Optional[dict[str, Any]]:
    """Update investigation status and analyst review notes, and write an audit log."""
    if client is None:
        return None

    try:
        update_data: dict[str, Any] = {
            "updated_at": utc_now_iso(),
        }
        if status is not None:
            update_data["status"] = status.upper()
        if notes is not None:
            update_data["notes"] = notes
        if reviewed_by is not None:
            update_data["reviewed_by"] = reviewed_by

        res = (
            client.table("investigations")
            .update(update_data)
            .eq("id", investigation_id)
            .execute()
        )
        if not res.data:
            return None

        # Write audit log
        try:
            client.table("audit_logs").insert({
                "id": generate_uuid(),
                "action": "investigation_updated",
                "entity_type": "investigation",
                "entity_id": investigation_id,
                "details": update_data,
                "created_at": utc_now_iso(),
            }).execute()
        except Exception as audit_exc:
            log.warning("Audit log write failed: %s", audit_exc)

        # Retrieve full updated record with joined relationships
        return get_investigation_by_id(client, investigation_id)
    except Exception as exc:
        log.error("Failed to update investigation %s in Supabase: %s", investigation_id, exc)
        return None


def get_audit_logs(
    client: Optional[Client],
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """Retrieve recent audit logs."""
    if client is None:
        return []

    try:
        res = (
            client.table("audit_logs")
            .select("*")
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return res.data or []
    except Exception as exc:
        log.error("Failed to fetch audit logs from Supabase: %s", exc)
        return []


def get_database_stats(client: Optional[Client]) -> dict[str, Any]:
    """Retrieve high level counters for database-backed operations."""
    default_stats = {
        "total_analyses": 0,
        "fraud_analyses": 0,
        "legitimate_analyses": 0,
        "open_investigations": 0,
        "review_investigations": 0,
        "resolved_investigations": 0,
    }
    if client is None:
        return default_stats

    try:
        total_res = client.table("fraud_analyses").select("id", count="exact").execute()
        total_analyses = total_res.count or 0

        fraud_res = client.table("fraud_analyses").select("id", count="exact").eq("prediction", "FRAUD").execute()
        fraud_analyses = fraud_res.count or 0

        open_res = client.table("investigations").select("id", count="exact").eq("status", "OPEN").execute()
        open_inv = open_res.count or 0

        review_res = client.table("investigations").select("id", count="exact").eq("status", "UNDER_REVIEW").execute()
        review_inv = review_res.count or 0

        resolved_res = client.table("investigations").select("id", count="exact").eq("status", "RESOLVED").execute()
        resolved_inv = resolved_res.count or 0

        return {
            "total_analyses": total_analyses,
            "fraud_analyses": fraud_analyses,
            "legitimate_analyses": max(0, total_analyses - fraud_analyses),
            "open_investigations": open_inv,
            "review_investigations": review_inv,
            "resolved_investigations": resolved_inv,
        }
    except Exception as exc:
        log.error("Failed to query database stats from Supabase: %s", exc)
        return default_stats


def get_notifications(
    client: Optional[Client],
    unread_only: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[dict[str, Any]], int, int]:
    """
    Retrieve notification records with joined transaction details.
    Returns (items, unread_count, total_count).
    """
    if client is None:
        return [], 0, 0

    try:
        query = (
            client.table("notifications")
            .select("*, transactions(id, amount, source)", count="exact")
            .order("created_at", desc=True)
        )
        if unread_only:
            query = query.eq("is_read", False)

        res = query.range(offset, offset + limit - 1).execute()
        items = res.data or []
        total_count = res.count or len(items)

        # Query unread count specifically
        unread_res = (
            client.table("notifications")
            .select("id", count="exact")
            .eq("is_read", False)
            .execute()
        )
        unread_count = unread_res.count or 0

        return items, unread_count, total_count
    except Exception as exc:
        log.error("Failed to fetch notifications from Supabase: %s", exc)
        return [], 0, 0


def mark_notification_as_read(
    client: Optional[Client],
    notification_id: str,
) -> Optional[dict[str, Any]]:
    """Mark a single notification as read."""
    if client is None:
        return None

    try:
        now = utc_now_iso()
        res = (
            client.table("notifications")
            .update({"is_read": True, "read_at": now})
            .eq("id", notification_id)
            .execute()
        )
        if res.data and len(res.data) > 0:
            # Re-fetch with joined transactions
            fetch_res = (
                client.table("notifications")
                .select("*, transactions(*)")
                .eq("id", notification_id)
                .limit(1)
                .execute()
            )
            return fetch_res.data[0] if fetch_res.data else res.data[0]
        return None
    except Exception as exc:
        log.error("Failed to mark notification %s as read: %s", notification_id, exc)
        return None


def mark_all_notifications_as_read(
    client: Optional[Client],
    user_id: Optional[str] = None,
) -> int:
    """Mark all unread notifications as read. Returns count of marked items."""
    if client is None:
        return 0

    try:
        now = utc_now_iso()
        query = (
            client.table("notifications")
            .update({"is_read": True, "read_at": now})
            .eq("is_read", False)
        )
        if user_id:
            query = query.eq("user_id", user_id)

        res = query.execute()
        return len(res.data or [])
    except Exception as exc:
        log.error("Failed to mark all notifications as read: %s", exc)
        return 0

