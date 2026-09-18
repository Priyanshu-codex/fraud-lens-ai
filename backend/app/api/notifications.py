"""
FraudLens AI — Notifications API Endpoints
Provides listing, count, and read status updates for high-risk fraud alerts.
"""
from __future__ import annotations

from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client

from ..schemas.transaction import (
    NotificationResponse,
    NotificationListResponse,
)
from ..services.repository import (
    get_notifications,
    mark_notification_as_read,
    mark_all_notifications_as_read,
)
from ..services.supabase import get_supabase_client

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _get_val(obj: Any, key: str, default: Any = None) -> Any:
    """Helper to extract attribute or dict key."""
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def format_notification(n: Any) -> NotificationResponse:
    """Helper to convert Supabase notification dict to NotificationResponse."""
    tx = _get_val(n, "transactions") or _get_val(n, "transaction")
    if isinstance(tx, list) and len(tx) > 0:
        tx = tx[0]

    amount = float(_get_val(tx, "amount", 0.0)) if tx else None
    source = str(_get_val(tx, "source", "custom")) if tx else None

    created_at_val = _get_val(n, "created_at")
    created_at_str = created_at_val.isoformat() if hasattr(created_at_val, "isoformat") else str(created_at_val or "")

    read_at_val = _get_val(n, "read_at")
    read_at_str = read_at_val.isoformat() if hasattr(read_at_val, "isoformat") else (str(read_at_val) if read_at_val else None)

    return NotificationResponse(
        id=str(_get_val(n, "id", "")),
        transaction_id=str(_get_val(n, "transaction_id", "")),
        analysis_id=str(_get_val(n, "analysis_id", "")),
        investigation_id=str(_get_val(n, "investigation_id")) if _get_val(n, "investigation_id") else None,
        fraud_probability=float(_get_val(n, "fraud_probability", 0.0)),
        risk_level=str(_get_val(n, "risk_level", "HIGH")),
        title=str(_get_val(n, "title", "Critical Fraud Alert")),
        message=_get_val(n, "message"),
        is_read=bool(_get_val(n, "is_read", False)),
        created_at=created_at_str,
        read_at=read_at_str,
        amount=amount,
        source=source,
    )


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    unread_only: bool = Query(False, description="Filter for unread notifications only"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    supabase: Optional[Client] = Depends(get_supabase_client),
):
    """Retrieve notifications ordered by creation time descending with unread count."""
    items, unread_count, total_count = get_notifications(
        client=supabase,
        unread_only=unread_only,
        limit=limit,
        offset=offset,
    )
    formatted = [format_notification(n) for n in items]
    return NotificationListResponse(
        items=formatted,
        unread_count=unread_count,
        total_count=total_count,
    )


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_single_as_read(
    notification_id: str,
    supabase: Optional[Client] = Depends(get_supabase_client),
):
    """Mark an individual notification as read."""
    updated = mark_notification_as_read(client=supabase, notification_id=notification_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Notification not found or update failed")
    return format_notification(updated)


@router.post("/mark-all-read")
async def mark_all_as_read(
    supabase: Optional[Client] = Depends(get_supabase_client),
):
    """Mark all unread notifications as read."""
    count = mark_all_notifications_as_read(client=supabase)
    return {"status": "ok", "marked_count": count}
