"""FraudLens AI — Health check endpoint."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from ..ml.loader import artifacts
from ..schemas.transaction import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check() -> HealthResponse:
    """System health check — returns API status and model readiness."""
    return HealthResponse(
        status="ok" if artifacts.loaded else "degraded",
        model_loaded=artifacts.loaded,
        model_version=artifacts.model_version,
        model_name=artifacts.model_name,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
