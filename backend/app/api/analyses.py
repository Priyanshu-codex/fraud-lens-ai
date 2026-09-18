"""
FraudLens AI — Analyses API Endpoints
Provides list and detail retrieval for persisted fraud analyses.
"""
from __future__ import annotations

from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client

from ..schemas.transaction import (
    AnalysisDetailResponse,
    FeatureContribution,
)
from ..services.repository import (
    get_recent_analyses,
    get_analysis_by_id,
)
from ..services.supabase import get_supabase_client

router = APIRouter(prefix="/analyses", tags=["Analyses"])


def _get_val(obj: Any, key: str, default: Any = None) -> Any:
    """Helper to extract attribute or dict key."""
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def format_analysis(a: Any) -> AnalysisDetailResponse:
    """Helper to convert Supabase query dict (or model) to AnalysisDetailResponse."""
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

    inv = _get_val(a, "investigations") or _get_val(a, "investigation")
    if isinstance(inv, list) and len(inv) > 0:
        inv = inv[0]

    created_at_val = _get_val(a, "created_at")
    if hasattr(created_at_val, "isoformat"):
        created_at_str = created_at_val.isoformat()
    else:
        created_at_str = str(created_at_val or "")

    return AnalysisDetailResponse(
        id=str(_get_val(a, "id", "")),
        transaction_id=str(_get_val(a, "transaction_id", "")),
        fraud_probability=float(_get_val(a, "fraud_probability", 0.0)),
        prediction=str(_get_val(a, "prediction", "LEGITIMATE")),
        risk_level=str(_get_val(a, "risk_level", "LOW")),
        threshold=float(_get_val(a, "threshold", 0.5)),
        model_name=str(_get_val(a, "model_name", "XGBoost")),
        model_version=str(_get_val(a, "model_version", "v1.0.0")),
        created_at=created_at_str,
        source=source,
        amount=amount,
        time=time_val,
        features=features_dict,
        evidence=evidence_list,
        investigation_id=str(_get_val(inv, "id")) if inv and _get_val(inv, "id") else None,
        investigation_status=str(_get_val(inv, "status")) if inv and _get_val(inv, "status") else None,
    )


@router.get("", response_model=list[AnalysisDetailResponse])
async def list_analyses(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    supabase: Optional[Client] = Depends(get_supabase_client),
):
    """Retrieve persisted analyses ordered by newest first."""
    analyses = get_recent_analyses(client=supabase, limit=limit, offset=offset)
    return [format_analysis(a) for a in analyses]


@router.get("/{analysis_id}", response_model=AnalysisDetailResponse)
async def get_single_analysis(
    analysis_id: str,
    supabase: Optional[Client] = Depends(get_supabase_client),
):
    """Retrieve an analysis by ID."""
    analysis = get_analysis_by_id(client=supabase, analysis_id=analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return format_analysis(analysis)
