import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from ..ml.loader import artifacts
from ..schemas.transaction import PredictionResponse, TransactionInput
from ..services.repository import save_analysis_record
from ..services.risk import compute_prediction, compute_risk_level
from ..services.supabase import get_supabase_client

log = logging.getLogger(__name__)
router = APIRouter()


@router.post("/predict", response_model=PredictionResponse, tags=["Inference"])
async def predict(
    transaction: TransactionInput,
    supabase: Optional[Client] = Depends(get_supabase_client),
) -> PredictionResponse:
    """
    Run fraud risk prediction on a single transaction.
    Uses the trained model and validated decision threshold.
    Safely records transaction, prediction, and initial investigation record in Supabase.
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

        analysis_id: str | None = None
        investigation_id: str | None = None

        # Safe DB persistence — failures do not crash inference
        try:
            persisted = save_analysis_record(
                client=supabase,
                transaction_data=transaction.model_dump(),
                prediction_result={
                    "fraud_probability": fraud_probability,
                    "prediction": prediction,
                    "risk_level": risk_level,
                    "threshold": artifacts.threshold,
                    "model_name": artifacts.model_name,
                    "model_version": artifacts.model_version,
                },
                evidence_list=None,
                source=transaction.source or "custom",
            )
            if persisted:
                analysis_id = persisted.get("analysis_id")
                investigation_id = persisted.get("investigation_id")
        except Exception as db_exc:
            log.warning("Database save skipped due to error: %s", db_exc)

        return PredictionResponse(
            fraud_probability=round(fraud_probability, 6),
            prediction=prediction,
            risk_level=risk_level,
            threshold=artifacts.threshold,
            model_version=artifacts.model_version,
            model_name=artifacts.model_name,
            analysis_id=analysis_id,
            investigation_id=investigation_id,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}")
