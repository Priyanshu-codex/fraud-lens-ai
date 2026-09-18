/**
 * FraudLens AI — API Client
 * All backend communication is centralized here.
 * Never mock or hardcode values — everything comes from the real FastAPI backend.
 */

const rawBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const API_BASE = rawBase.replace(/\/+$/, "");

export class ApiError extends Error {
  status?: number;
  isConnectionError?: boolean;
  constructor(message: string, status?: number, isConnectionError = false) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.isConnectionError = isConnectionError;
  }
}

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
  source?: string;
}

export interface PredictionResponse {
  fraud_probability: number;
  prediction: "FRAUD" | "LEGITIMATE";
  risk_level: "LOW" | "REVIEW" | "HIGH";
  threshold: number;
  model_version: string;
  model_name: string;
  analysis_id?: string;
  investigation_id?: string;
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

export interface AnalysisDetail {
  id: string;
  transaction_id: string;
  fraud_probability: number;
  prediction: "FRAUD" | "LEGITIMATE";
  risk_level: "LOW" | "REVIEW" | "HIGH";
  threshold: number;
  model_name: string;
  model_version: string;
  created_at: string;
  source: string;
  amount: number;
  time: number;
  features: Record<string, number>;
  evidence: FeatureContribution[];
  investigation_id?: string;
  investigation_status?: string;
}

export interface InvestigationRecord {
  id: string;
  analysis_id: string;
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED";
  notes?: string | null;
  reviewed_by?: string | null;
  created_at: string;
  updated_at: string;
  analysis?: AnalysisDetail | null;
}

export interface InvestigationUpdateInput {
  status?: "OPEN" | "UNDER_REVIEW" | "RESOLVED";
  notes?: string;
  reviewed_by?: string;
}

export interface NotificationItem {
  id: string;
  transaction_id: string;
  analysis_id: string;
  investigation_id?: string | null;
  fraud_probability: number;
  risk_level: "HIGH" | "REVIEW" | "LOW";
  title: string;
  message?: string | null;
  is_read: boolean;
  created_at: string;
  read_at?: string | null;
  amount?: number | null;
  source?: string | null;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  unread_count: number;
  total_count: number;
}


export interface HealthResponse {
  status: string;
  api?: string;
  model?: string;
  preprocessing?: string;
  shap?: string;
  database?: string;
  model_loaded: boolean;
  model_version: string;
  model_name: string;
  timestamp: string;
  database_connected?: boolean;
  preprocessing_loaded?: boolean;
  shap_ready?: boolean;
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
  options?: RequestInit,
  timeoutMs: number = 15000
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      ...options,
    });

    clearTimeout(timeoutId);

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
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        throw new Error("Analysis timed out. Please retry.");
      }
      if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
        throw new Error("Unable to connect to FraudLens AI service. Please check System Health.");
      }
    }
    throw err;
  }
}

// ── Cached promises for static metadata ─────────────────────────────────────
let analyticsCache: Promise<AnalyticsResponse> | null = null;
let modelInfoCache: Promise<ModelInfoResponse> | null = null;
let samplesCache: Promise<SamplesResponse> | null = null;

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

  analytics: (force = false): Promise<AnalyticsResponse> => {
    if (!analyticsCache || force) {
      analyticsCache = apiFetch<AnalyticsResponse>("/analytics").catch((err) => {
        analyticsCache = null;
        throw err;
      });
    }
    return analyticsCache;
  },

  modelInfo: (force = false): Promise<ModelInfoResponse> => {
    if (!modelInfoCache || force) {
      modelInfoCache = apiFetch<ModelInfoResponse>("/model-info").catch((err) => {
        modelInfoCache = null;
        throw err;
      });
    }
    return modelInfoCache;
  },

  samples: (force = false): Promise<SamplesResponse> => {
    if (!samplesCache || force) {
      samplesCache = (async () => {
        try {
          return await apiFetch<SamplesResponse>("/samples");
        } catch {
          // Fallback to static sample file in public folder (same genuine dataset samples)
          const res = await fetch("/sample_transactions.json");
          if (!res.ok) throw new Error("Could not load sample transactions");
          return res.json() as Promise<SamplesResponse>;
        }
      })().catch((err) => {
        samplesCache = null;
        throw err;
      });
    }
    return samplesCache;
  },

  listInvestigations: (status?: string, limit: number = 50) =>
    apiFetch<InvestigationRecord[]>(
      `/investigations${status ? `?status=${status}&limit=${limit}` : `?limit=${limit}`}`
    ),

  getInvestigation: (id: string) =>
    apiFetch<InvestigationRecord>(`/investigations/${id}`),

  getInvestigationByAnalysis: (analysisId: string) =>
    apiFetch<InvestigationRecord>(`/investigations/by-analysis/${analysisId}`),

  updateInvestigation: (id: string, update: InvestigationUpdateInput) =>
    apiFetch<InvestigationRecord>(`/investigations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(update),
    }),

  listAnalyses: (limit: number = 50) =>
    apiFetch<AnalysisDetail[]>(`/analyses?limit=${limit}`),

  getAnalysis: (id: string) =>
    apiFetch<AnalysisDetail>(`/analyses/${id}`),

  listNotifications: (unreadOnly?: boolean, limit: number = 50) =>
    apiFetch<NotificationListResponse>(
      `/notifications${unreadOnly ? `?unread_only=true&limit=${limit}` : `?limit=${limit}`}`
    ),

  markNotificationAsRead: (id: string) =>
    apiFetch<NotificationItem>(`/notifications/${id}/read`, {
      method: "PATCH",
    }),

  markAllNotificationsAsRead: () =>
    apiFetch<{ status: string; marked_count: number }>("/notifications/mark-all-read", {
      method: "POST",
    }),
};

