"""FraudLens AI — Risk scoring service."""
from __future__ import annotations


def compute_risk_level(fraud_probability: float, threshold: float) -> str:
    """
    Determine risk level based on fraud probability relative to threshold.

    HIGH:   probability >= threshold (model signals fraud)
    REVIEW: probability >= threshold * 0.6 (borderline zone)
    LOW:    probability < threshold * 0.6
    """
    if fraud_probability >= threshold:
        return "HIGH"
    elif fraud_probability >= threshold * 0.6:
        return "REVIEW"
    else:
        return "LOW"


def compute_prediction(fraud_probability: float, threshold: float) -> str:
    """Return FRAUD or LEGITIMATE based on threshold."""
    return "FRAUD" if fraud_probability >= threshold else "LEGITIMATE"
