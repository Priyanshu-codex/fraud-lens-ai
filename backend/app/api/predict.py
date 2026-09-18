"""FraudLens AI — Prediction endpoint."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..ml.loader import artifacts
from ..schemas.transaction import PredictionResponse, TransactionInput
from ..services.risk import compute_prediction, compute_risk_level

router = APIRouter()


@router.post("/predict", response_model=PredictionResponse, tags=["Inference"])
async def predict(transaction: TransactionInput) -> PredictionResponse:
    """
    Run fraud risk prediction on a single transaction.
    Uses the trained model and validated decision threshold.
    """
    if not artifacts.loaded:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Backend is initializing.",
        )

    try:
        feature_vector = transaction.to_feature_vector()
        fraud_probability = artifacts.predict_proba(feature_vector)

        prediction = compute_prediction(fraud_probability, artifacts.threshold)
        risk_level = compute_risk_level(fraud_probability, artifacts.threshold)

        return PredictionResponse(
            fraud_probability=round(fraud_probability, 6),
            prediction=prediction,
            risk_level=risk_level,
            threshold=artifacts.threshold,
            model_version=artifacts.model_version,
            model_name=artifacts.model_name,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}")
