"""
FraudLens AI — FastAPI Application
===================================
Loads model artifacts once at startup.
Provides REST API for fraud prediction, explanation, and analytics.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
    log.info("FraudLens AI backend starting up...")
    
    # Verify Supabase database readiness
    supabase_ok = check_supabase_connection()
    if supabase_ok:
        log.info("Supabase PostgreSQL connected successfully.")
    else:
        log.info("Supabase operating in offline/unconfigured mode (ML inference remains fully functional).")

    # Load ML artifacts
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
    yield
    log.info("FraudLens AI backend shutting down.")


app = FastAPI(
    title=settings.APP_TITLE,
    version=settings.APP_VERSION,
    description=(
        "AI-powered financial fraud risk detection and explainability platform. "
        "Every prediction comes from a trained XGBoost model with validated threshold."
    ),
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in settings.ALLOWED_ORIGINS if o],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
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


@app.get("/", tags=["Root"])
async def root():
    return {
        "product": "FraudLens AI",
        "tagline": "See the risk. Understand the reason. Decide with confidence.",
        "status": "running",
        "model_loaded": artifacts.loaded,
        "docs": "/docs",
    }
