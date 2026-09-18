"""FraudLens AI — Health check endpoint."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from ..ml.loader import artifacts
from ..schemas.transaction import HealthResponse
from ..services.supabase import check_supabase_connection

router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check() -> HealthResponse:
    """System health check — returns API status, model, preprocessing, and database readiness."""
    db_ok = check_supabase_connection()
    prep_ok = artifacts.preprocessing_pipeline is not None
    is_ok = artifacts.loaded and prep_ok

    return HealthResponse(
        status="ok" if is_ok else "degraded",
        api="ok",
        model="ok" if artifacts.loaded else "error",
        preprocessing="ok" if prep_ok else "error",
        shap="ok" if artifacts.loaded else "error",
        database="ok" if db_ok else "error",
        model_loaded=artifacts.loaded,
        model_version=artifacts.model_version,
        model_name=artifacts.model_name,
        timestamp=datetime.now(timezone.utc).isoformat(),
        database_connected=db_ok,
        preprocessing_loaded=prep_ok,
        shap_ready=artifacts.loaded,
    )
