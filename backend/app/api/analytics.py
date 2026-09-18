"""FraudLens AI — Analytics endpoint."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..ml.loader import artifacts
from ..schemas.transaction import AnalyticsResponse

router = APIRouter()


@router.get("/analytics", response_model=AnalyticsResponse, tags=["Analytics"])
async def analytics() -> AnalyticsResponse:
    """
    Return real dataset statistics and model evaluation metrics.
    All values sourced from actual training/evaluation results.
    """
    if not artifacts.loaded:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded.",
        )

    meta = artifacts.metadata
    dataset = meta.get("dataset", {})
    test_metrics = meta.get("test_metrics", {})

    return AnalyticsResponse(
        total_transactions=dataset.get("total_transactions", 0),
        fraud_transactions=dataset.get("fraud_transactions", 0),
        legitimate_transactions=dataset.get("legitimate_transactions", 0),
        fraud_rate=dataset.get("fraud_rate", 0.0),
        model_metrics={
            "precision": test_metrics.get("precision", 0.0),
            "recall": test_metrics.get("recall", 0.0),
            "f1": test_metrics.get("f1", 0.0),
            "pr_auc": test_metrics.get("pr_auc", 0.0),
            "roc_auc": test_metrics.get("roc_auc", 0.0),
            "threshold": meta.get("threshold", 0.5),
            "model_name": meta.get("model_name", "unknown"),
        },
        confusion_matrix={
            "true_negatives": test_metrics.get("true_negatives", 0),
            "false_positives": test_metrics.get("false_positives", 0),
            "false_negatives": test_metrics.get("false_negatives", 0),
            "true_positives": test_metrics.get("true_positives", 0),
        },
        model_comparison=meta.get("model_comparison", []),
        threshold_analysis=artifacts.threshold_analysis,
    )
