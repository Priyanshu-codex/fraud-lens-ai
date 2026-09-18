"""FraudLens AI — Explanation endpoint (SHAP-based)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..ml.loader import artifacts
from ..schemas.transaction import ExplainResponse, FeatureContribution, TransactionInput
from ..services.risk import compute_prediction, compute_risk_level

router = APIRouter()


@router.post("/explain", response_model=ExplainResponse, tags=["Inference"])
async def explain(transaction: TransactionInput) -> ExplainResponse:
    """
    Run fraud prediction AND generate SHAP-based feature explanations.
    Returns top contributing features and their direction (toward/away from fraud).
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

        # Get SHAP explanations
        shap_result = artifacts.get_shap_values(feature_vector)
        top_contributions = [
            FeatureContribution(**c)
            for c in shap_result["contributions"]
        ]

        return ExplainResponse(
            fraud_probability=round(fraud_probability, 6),
            prediction=prediction,
            risk_level=risk_level,
            threshold=artifacts.threshold,
            model_version=artifacts.model_version,
            model_name=artifacts.model_name,
            top_contributions=top_contributions,
        )

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Explanation failed: {str(e)}"
        )
