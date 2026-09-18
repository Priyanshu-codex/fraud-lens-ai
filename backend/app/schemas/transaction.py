"""FraudLens AI — Pydantic schemas for transaction input/output."""
from __future__ import annotations

from pydantic import BaseModel, Field, model_validator


class TransactionInput(BaseModel):
    Time: float = Field(..., description="Seconds elapsed since the first transaction")
    V1: float
    V2: float
    V3: float
    V4: float
    V5: float
    V6: float
    V7: float
    V8: float
    V9: float
    V10: float
    V11: float
    V12: float
    V13: float
    V14: float
    V15: float
    V16: float
    V17: float
    V18: float
    V19: float
    V20: float
    V21: float
    V22: float
    V23: float
    V24: float
    V25: float
    V26: float
    V27: float
    V28: float
    Amount: float = Field(..., ge=0, description="Transaction amount (non-negative)")

    def to_feature_vector(self) -> list[float]:
        """Return features in the exact training order: Time, Amount, V1..V28"""
        return [
            self.Time, self.Amount,
            self.V1, self.V2, self.V3, self.V4, self.V5,
            self.V6, self.V7, self.V8, self.V9, self.V10,
            self.V11, self.V12, self.V13, self.V14, self.V15,
            self.V16, self.V17, self.V18, self.V19, self.V20,
            self.V21, self.V22, self.V23, self.V24, self.V25,
            self.V26, self.V27, self.V28,
        ]


class PredictionResponse(BaseModel):
    fraud_probability: float
    prediction: str  # "FRAUD" or "LEGITIMATE"
    risk_level: str  # "LOW" | "REVIEW" | "HIGH"
    threshold: float
    model_version: str
    model_name: str


class FeatureContribution(BaseModel):
    feature: str
    value: float
    contribution: float
    direction: str  # "fraud" or "legitimate"


class ExplainResponse(BaseModel):
    fraud_probability: float
    prediction: str
    risk_level: str
    threshold: float
    model_version: str
    model_name: str
    top_contributions: list[FeatureContribution]
    disclaimer: str = (
        "Feature contributions describe model behavior and are not proof of fraudulent activity."
    )


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_version: str
    model_name: str
    timestamp: str


class AnalyticsResponse(BaseModel):
    total_transactions: int
    fraud_transactions: int
    legitimate_transactions: int
    fraud_rate: float
    model_metrics: dict
    confusion_matrix: dict
    model_comparison: list[dict]
    threshold_analysis: list[dict]


class ModelInfoResponse(BaseModel):
    model_name: str
    model_version: str
    training_timestamp: str
    threshold: float
    features: list[str]
    feature_count: int
    precision: float
    recall: float
    f1: float
    pr_auc: float
    roc_auc: float
    dataset: dict
    selection_reason: str
