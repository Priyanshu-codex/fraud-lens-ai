/**
 * FraudLens AI — API Client
 * All backend communication is centralized here.
 * Never mock or hardcode values — everything comes from the real FastAPI backend.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TransactionInput {
  Time: number;
  V1: number;
  V2: number;
  V3: number;
  V4: number;
  V5: number;
  V6: number;
  V7: number;
  V8: number;
  V9: number;
  V10: number;
  V11: number;
  V12: number;
  V13: number;
  V14: number;
  V15: number;
  V16: number;
  V17: number;
  V18: number;
  V19: number;
  V20: number;
  V21: number;
  V22: number;
  V23: number;
  V24: number;
  V25: number;
  V26: number;
  V27: number;
  V28: number;
  Amount: number;
}

export interface PredictionResponse {
  fraud_probability: number;
  prediction: "FRAUD" | "LEGITIMATE";
  risk_level: "LOW" | "REVIEW" | "HIGH";
  threshold: number;
  model_version: string;
  model_name: string;
}

export interface FeatureContribution {
  feature: string;
  value: number;
  contribution: number;
  direction: "fraud" | "legitimate";
}

export interface ExplainResponse extends PredictionResponse {
  top_contributions: FeatureContribution[];
  disclaimer: string;
}

export interface HealthResponse {
  status: string;
  model_loaded: boolean;
  model_version: string;
  model_name: string;
  timestamp: string;
}

export interface AnalyticsResponse {
  total_transactions: number;
  fraud_transactions: number;
  legitimate_transactions: number;
  fraud_rate: number;
  model_metrics: {
    precision: number;
    recall: number;
    f1: number;
    pr_auc: number;
    roc_auc: number;
    threshold: number;
    model_name: string;
  };
  confusion_matrix: {
    true_negatives: number;
    false_positives: number;
    false_negatives: number;
    true_positives: number;
  };
  model_comparison: Array<{
    model: string;
    precision: number;
    recall: number;
    f1: number;
    pr_auc: number;
    roc_auc: number;
  }>;
  threshold_analysis: Array<{
    threshold: number;
    precision: number;
    recall: number;
    f1: number;
    false_positives: number;
    false_negatives: number;
    true_positives: number;
    true_negatives: number;
  }>;
}

export interface ModelInfoResponse {
  model_name: string;
  model_version: string;
  training_timestamp: string;
  threshold: number;
  features: string[];
  feature_count: number;
  precision: number;
  recall: number;
  f1: number;
  pr_auc: number;
  roc_auc: number;
  dataset: {
    total_transactions: number;
    fraud_transactions: number;
    legitimate_transactions: number;
    fraud_rate: number;
    train_size: number;
    val_size: number;
    test_size: number;
  };
  selection_reason: string;
}

export interface SamplesResponse {
  fraud: TransactionInput[];
  legitimate: TransactionInput[];
}

// ── Fetch helpers ──────────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const errorBody = await res.text();
    let detail = errorBody;
    try {
      const parsed = JSON.parse(errorBody);
      detail = parsed.detail || errorBody;
    } catch {}
    throw new Error(`API error ${res.status}: ${detail}`);
  }

  return res.json() as Promise<T>;
}

// ── API functions ──────────────────────────────────────────────────────────────

export const api = {
  health: () => apiFetch<HealthResponse>("/health"),

  predict: (transaction: TransactionInput) =>
    apiFetch<PredictionResponse>("/predict", {
      method: "POST",
      body: JSON.stringify(transaction),
    }),

  explain: (transaction: TransactionInput) =>
    apiFetch<ExplainResponse>("/explain", {
      method: "POST",
      body: JSON.stringify(transaction),
    }),

  analytics: () => apiFetch<AnalyticsResponse>("/analytics"),

  modelInfo: () => apiFetch<ModelInfoResponse>("/model-info"),

  samples: () => apiFetch<SamplesResponse>("/samples"),
};
