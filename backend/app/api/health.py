"""
FraudLens AI — Health & Readiness Endpoints
============================================
/health: Lightweight, non-blocking liveness probe (used by cloud host health checks).
/ready: Readiness probe verifying ML model and dependencies are loaded before receiving traffic.
/health/model: Detailed model availability and feature status probe.
"""
from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse

from ..ml.loader import FEATURES, artifacts
from ..schemas.transaction import (
    HealthResponse,
    ModelHealthResponse,
    ReadyResponse,
)
from ..services.supabase import (
    check_supabase_connection,
    is_supabase_configured,
)

router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check(request: Request) -> HealthResponse:
    """
    Lightweight liveness check.
    Returns immediately without blocking on external network dependencies.
    Used by Render, Railway, and load balancers to detect process health.
    """
    db_configured = is_supabase_configured()
    # Non-blocking cached status check (never stalls on remote DB timeouts)
    db_ok = check_supabase_connection(force=False) if db_configured else True
    prep_ok = artifacts.preprocessing_pipeline is not None
    is_ok = artifacts.loaded and prep_ok

    uptime: Optional[float] = None
    start_time = getattr(request.app.state, "start_time", None)
    if start_time:
        uptime = round((datetime.now(timezone.utc) - start_time).total_seconds(), 2)

    return HealthResponse(
        status="ok" if is_ok else "degraded",
        api="ok",
        model="ok" if artifacts.loaded else "error",
        preprocessing="ok" if prep_ok else "error",
        shap="ok" if artifacts.loaded else "error",
        database="ok" if db_ok else "offline",
        model_loaded=artifacts.loaded,
        model_version=artifacts.model_version,
        model_name=artifacts.model_name,
        timestamp=datetime.now(timezone.utc).isoformat(),
        database_connected=db_ok,
        preprocessing_loaded=prep_ok,
        shap_ready=artifacts.loaded,
        uptime_seconds=uptime,
        database_configured=db_configured,
    )


@router.get(
    "/ready",
    response_model=ReadyResponse,
    responses={
        200: {"model": ReadyResponse, "description": "Backend is ready to serve predictions"},
        503: {"description": "Backend is still initializing or model failed to load"},
    },
    tags=["System"],
)
async def readiness_check():
    """
    Readiness check confirming model and required services are initialized.
    Returns 200 OK when ready to accept inference requests, or 503 when initializing.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    if not artifacts.is_ready:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "ready": False,
                "status": "initializing",
                "error": artifacts.load_error or "Model artifacts still loading or unavailable",
                "timestamp": now_iso,
            },
        )

    return ReadyResponse(
        ready=True,
        status="ready",
        model="ready",
        model_version=artifacts.model_version,
        model_name=artifacts.model_name,
        threshold=artifacts.threshold,
        timestamp=now_iso,
    )


@router.get(
    "/health/model",
    response_model=ModelHealthResponse,
    responses={
        200: {"model": ModelHealthResponse, "description": "Model is loaded and healthy"},
        503: {"description": "Model is not loaded"},
    },
    tags=["System"],
)
async def model_health():
    """
    Detailed model availability and initialization report.
    Returns model metadata, threshold, feature dimensions, and explainer status.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    if not artifacts.loaded:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unavailable",
                "model_loaded": False,
                "error": artifacts.load_error or "Model artifacts not loaded",
                "timestamp": now_iso,
            },
        )

    features = artifacts.metadata.get("features", FEATURES)
    return ModelHealthResponse(
        status="ready",
        model_loaded=True,
        model_name=artifacts.model_name,
        model_version=artifacts.model_version,
        threshold=artifacts.threshold,
        feature_count=len(features),
        features=features,
        shap_ready=artifacts._explainer is not None,
        timestamp=now_iso,
        load_error=None,
    )

