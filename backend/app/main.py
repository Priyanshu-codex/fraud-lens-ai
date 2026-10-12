"""
FraudLens AI — FastAPI Application
===================================
Loads model artifacts once at startup.
Provides REST API for fraud prediction, explanation, and analytics.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from datetime import datetime, timezone
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api.health import router as health_router
from .api.predict import router as predict_router
from .api.explain import router as explain_router
from .api.analytics import router as analytics_router
from .api.model_info import router as model_info_router
from .api.investigations import router as investigations_router
from .api.analyses import router as analyses_router
from .api.notifications import router as notifications_router
from .config import settings
from .ml.loader import artifacts
from .services.supabase import check_supabase_connection

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model artifacts and initialize Supabase connection on startup."""
    app.state.start_time = datetime.now(timezone.utc)
    log.info("FraudLens AI backend starting up...")
    
    # Verify Supabase database readiness (non-fatal if offline)
    try:
        supabase_ok = check_supabase_connection(force=True)
        if supabase_ok:
            log.info("Supabase PostgreSQL connected successfully.")
        else:
            log.info("Supabase operating in offline/unconfigured mode (ML inference remains fully functional).")
    except Exception as db_err:
        log.warning("Supabase startup check bypassed: %s", db_err)

    # Load ML artifacts once at startup
    if not artifacts.loaded:
        success = artifacts.load()
        if success:
            log.info(
                "Model ready: %s %s (threshold=%.2f)",
                artifacts.model_name,
                artifacts.model_version,
                artifacts.threshold,
            )
        else:
            log.error("Model failed to load: %s", artifacts.load_error)
    else:
        log.info("Model already initialized in memory.")

    yield
    log.info("FraudLens AI backend shutting down gracefully.")


app = FastAPI(
    title=settings.APP_TITLE,
    version=settings.APP_VERSION,
    description=(
        "AI-powered financial fraud risk detection and explainability platform. "
        "Every prediction comes from a trained XGBoost model with validated threshold."
    ),
    lifespan=lifespan,
    redirect_slashes=False,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in settings.ALLOWED_ORIGINS if o],
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Ensure unexpected exceptions return structured JSON rather than crashing the process."""
    log.error("Unhandled exception on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An internal error occurred while processing the request.",
            "path": request.url.path,
        },
    )


# Routers — Mounted at both root and /api prefix so all URL configurations resolve cleanly
routers = [
    health_router,
    predict_router,
    explain_router,
    analytics_router,
    model_info_router,
    investigations_router,
    analyses_router,
    notifications_router,
]

for r in routers:
    app.include_router(r)
    app.include_router(r, prefix="/api")


@app.get("/api/docs", include_in_schema=False)
async def api_docs_swagger():
    from fastapi.openapi.docs import get_swagger_ui_html
    return get_swagger_ui_html(openapi_url="/api/openapi.json", title=f"{settings.APP_TITLE} - API Docs")


@app.get("/api/openapi.json", include_in_schema=False)
async def api_openapi_json(request: Request):
    return JSONResponse(app.openapi())


@app.get("/api", tags=["Root"])
@app.get("/", tags=["Root"])
async def root():
    return {
        "product": "FraudLens AI",
        "tagline": "See the risk. Understand the reason. Decide with confidence.",
        "status": "running",
        "model_loaded": artifacts.loaded,
        "docs": "/api/docs",
    }

