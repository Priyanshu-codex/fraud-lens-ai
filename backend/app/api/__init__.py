"""FraudLens AI — API routers."""

from .health import router as health_router
from .predict import router as predict_router
from .explain import router as explain_router
from .analytics import router as analytics_router
from .model_info import router as model_info_router

__all__ = [
    "health_router",
    "predict_router",
    "explain_router",
    "analytics_router",
    "model_info_router",
]
