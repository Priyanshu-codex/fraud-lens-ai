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
from .config import settings
from .ml.loader import artifacts

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model artifacts on startup."""
    log.info("FraudLens AI backend starting up...")
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
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Routers
app.include_router(health_router, prefix="/api")
app.include_router(predict_router, prefix="/api")
app.include_router(explain_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")
app.include_router(model_info_router, prefix="/api")


@app.get("/", tags=["Root"])
async def root():
    return {
        "product": "FraudLens AI",
        "tagline": "See the risk. Understand the reason. Decide with confidence.",
        "status": "running",
        "model_loaded": artifacts.loaded,
        "docs": "/docs",
    }
