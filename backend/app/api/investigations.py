"""
FraudLens AI — Investigations API Endpoints
Provides list, retrieval, and status/notes update for persisted fraud investigations.
"""
from __future__ import annotations

from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client

from ..schemas.transaction import (
    InvestigationResponse,
    InvestigationUpdateInput,
    AnalysisDetailResponse,
    FeatureContribution,
)
from ..services.repository import (
    get_investigations,
    get_investigation_by_id,
    get_investigation_by_analysis_id,
    update_investigation,
)
from ..services.supabase import get_supabase_client

router = APIRouter(prefix="/investigations", tags=["Investigations"])


def _get_val(obj: Any, key: str, default: Any = None) -> Any:
    """Helper to extract attribute or dict key."""
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def format_investigation(inv: Any) -> InvestigationResponse:
    """Helper to convert Supabase investigation dict (or model) to InvestigationResponse."""
    analysis_detail = None
    raw_analysis = _get_val(inv, "fraud_analyses") or _get_val(inv, "analysis")
    if isinstance(raw_analysis, list) and len(raw_analysis) > 0:
        raw_analysis = raw_analysis[0]

    inv_id = str(_get_val(inv, "id", ""))
    inv_status = str(_get_val(inv, "status", "OPEN"))

    if raw_analysis:
        a = raw_analysis
        raw_evidence = _get_val(a, "analysis_evidence") or _get_val(a, "evidence") or []
        if isinstance(raw_evidence, dict):
            raw_evidence = [raw_evidence]

        evidence_list = [
            FeatureContribution(
                feature=_get_val(ev, "feature_name", ""),
                value=float(_get_val(ev, "feature_value", 0.0)),
                contribution=float(_get_val(ev, "contribution", 0.0)),
                direction=str(_get_val(ev, "direction", "fraud")),
            )
            for ev in raw_evidence
        ]

        tx = _get_val(a, "transactions") or _get_val(a, "transaction")
        if isinstance(tx, list) and len(tx) > 0:
            tx = tx[0]

        features_dict = {}
        source = "unknown"
        amount = 0.0
        time_val = 0.0

        if tx:
            source = _get_val(tx, "source", "custom")
            amount = float(_get_val(tx, "amount", 0.0))
            time_val = float(_get_val(tx, "time", 0.0))
            for i in range(1, 29):
                val = _get_val(tx, f"v{i}")
                if val is not None:
                    features_dict[f"V{i}"] = float(val)

        created_at_val = _get_val(a, "created_at")
        if hasattr(created_at_val, "isoformat"):
            a_created_at = created_at_val.isoformat()
        else:
            a_created_at = str(created_at_val or "")

        analysis_detail = AnalysisDetailResponse(
            id=str(_get_val(a, "id", "")),
            transaction_id=str(_get_val(a, "transaction_id", "")),
            fraud_probability=float(_get_val(a, "fraud_probability", 0.0)),
            prediction=str(_get_val(a, "prediction", "LEGITIMATE")),
            risk_level=str(_get_val(a, "risk_level", "LOW")),
            threshold=float(_get_val(a, "threshold", 0.5)),
            model_name=str(_get_val(a, "model_name", "XGBoost")),
            model_version=str(_get_val(a, "model_version", "v1.0.0")),
            created_at=a_created_at,
            source=source,
            amount=amount,
            time=time_val,
            features=features_dict,
            evidence=evidence_list,
            investigation_id=inv_id,
            investigation_status=inv_status,
        )

    inv_created_at = _get_val(inv, "created_at")
    inv_created_str = inv_created_at.isoformat() if hasattr(inv_created_at, "isoformat") else str(inv_created_at or "")

    inv_updated_at = _get_val(inv, "updated_at")
    inv_updated_str = inv_updated_at.isoformat() if hasattr(inv_updated_at, "isoformat") else str(inv_updated_at or "")

    return InvestigationResponse(
        id=inv_id,
        analysis_id=str(_get_val(inv, "analysis_id", "")),
        status=inv_status,
        notes=_get_val(inv, "notes"),
        reviewed_by=_get_val(inv, "reviewed_by"),
        created_at=inv_created_str,
        updated_at=inv_updated_str,
        analysis=analysis_detail,
    )


@router.get("", response_model=list[InvestigationResponse])
async def list_investigations(
    status: Optional[str] = Query(None, description="Filter by status: OPEN, UNDER_REVIEW, RESOLVED"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    supabase: Optional[Client] = Depends(get_supabase_client),
):
    """Retrieve persisted investigations ordered by newest first."""
    records = get_investigations(client=supabase, status=status, limit=limit, offset=offset)
    return [format_investigation(r) for r in records]


@router.get("/{investigation_id}", response_model=InvestigationResponse)
async def get_single_investigation(
    investigation_id: str,
    supabase: Optional[Client] = Depends(get_supabase_client),
):
    """Retrieve an investigation by ID with full transaction and evidence context."""
    inv = get_investigation_by_id(client=supabase, investigation_id=investigation_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
    return format_investigation(inv)


@router.get("/by-analysis/{analysis_id}", response_model=InvestigationResponse)
async def get_by_analysis(
    analysis_id: str,
    supabase: Optional[Client] = Depends(get_supabase_client),
):
    """Retrieve an investigation by its linked analysis ID."""
    inv = get_investigation_by_analysis_id(client=supabase, analysis_id=analysis_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found for this analysis")
    return format_investigation(inv)


@router.patch("/{investigation_id}", response_model=InvestigationResponse)
async def update_single_investigation(
    investigation_id: str,
    body: InvestigationUpdateInput,
    supabase: Optional[Client] = Depends(get_supabase_client),
):
    """Update investigation status and analyst review notes."""
    valid_statuses = {"OPEN", "UNDER_REVIEW", "RESOLVED"}
    if body.status and body.status.upper() not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{body.status}'. Valid: {', '.join(valid_statuses)}",
        )

    updated = update_investigation(
        client=supabase,
        investigation_id=investigation_id,
        status=body.status,
        notes=body.notes,
        reviewed_by=body.reviewed_by,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Investigation not found or update failed")
    return format_investigation(updated)
