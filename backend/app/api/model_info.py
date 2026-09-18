"""FraudLens AI — Model info endpoint."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..ml.loader import artifacts
from ..schemas.transaction import ModelInfoResponse

router = APIRouter()


@router.get("/model-info", response_model=ModelInfoResponse, tags=["Model"])
async def model_info() -> ModelInfoResponse:
    """
    Return detailed model metadata, training configuration, and evaluation results.
    """
    if not artifacts.loaded:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded.",
        )

    meta = artifacts.metadata
    test_metrics = meta.get("test_metrics", {})
    dataset = meta.get("dataset", {})

    return ModelInfoResponse(
        model_name=meta.get("model_name", "unknown"),
        model_version=meta.get("model_version", "unknown"),
        training_timestamp=meta.get("training_timestamp", ""),
        threshold=meta.get("threshold", 0.5),
        features=meta.get("features", []),
        feature_count=meta.get("feature_count", 0),
        precision=test_metrics.get("precision", 0.0),
        recall=test_metrics.get("recall", 0.0),
        f1=test_metrics.get("f1", 0.0),
        pr_auc=test_metrics.get("pr_auc", 0.0),
        roc_auc=test_metrics.get("roc_auc", 0.0),
        dataset=dataset,
        selection_reason=meta.get("selection_reason", ""),
    )


@router.get("/samples", tags=["Model"])
async def get_samples():
    """Return real legitimate and fraud transaction samples from the test set."""
    if not artifacts.loaded:
        raise HTTPException(status_code=503, detail="Model not loaded.")
    return artifacts.sample_transactions
