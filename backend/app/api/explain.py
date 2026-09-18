import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from ..ml.loader import artifacts
from ..schemas.transaction import ExplainResponse, FeatureContribution, TransactionInput
from ..services.repository import save_analysis_record
from ..services.risk import compute_prediction, compute_risk_level
from ..services.supabase import get_supabase_client

log = logging.getLogger(__name__)
router = APIRouter()


@router.post("/explain", response_model=ExplainResponse, tags=["Inference"])
async def explain(
    transaction: TransactionInput,
    supabase: Optional[Client] = Depends(get_supabase_client),
) -> ExplainResponse:
    """
    Run fraud prediction AND generate SHAP-based feature explanations.
    Returns top contributing features and their direction (toward/away from fraud).
    Safely persists transaction, prediction, SHAP evidence, and investigation in Supabase.
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

        analysis_id: str | None = None
        investigation_id: str | None = None

        # Safe DB persistence — failures do not crash inference or explanation
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
                evidence_list=shap_result.get("contributions", []),
                source=transaction.source or "custom",
            )
            if persisted:
                analysis_id = persisted.get("analysis_id")
                investigation_id = persisted.get("investigation_id")
        except Exception as db_exc:
            log.warning("Database save skipped due to error: %s", db_exc)

        return ExplainResponse(
            fraud_probability=round(fraud_probability, 6),
            prediction=prediction,
            risk_level=risk_level,
            threshold=artifacts.threshold,
            model_version=artifacts.model_version,
            model_name=artifacts.model_name,
            top_contributions=top_contributions,
            analysis_id=analysis_id,
            investigation_id=investigation_id,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Explanation failed: {str(e)}"
        )
