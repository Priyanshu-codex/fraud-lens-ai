/**
 * FraudLens AI — API Client
 * All backend communication is centralized here.
 * Never mock or hardcode values — everything comes from the real FastAPI backend.
 */

/**
 * Resolves the backend base URL dynamically:
 * 1. Checks NEXT_PUBLIC_API_URL environment variable (configured in Vercel project settings).
 * 2. If running on a deployed domain without an explicit env variable, uses relative path or window origin.
 * 3. In local development, falls back to http://127.0.0.1:8000/api.
 */
export function getApiBase(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, "");
  }
  if (typeof window !== "undefined") {
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (!isLocalhost) {
      // In production deployment on Vercel, use same-origin relative /api
      return "/api";
    }
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/api`;
  }
  return "http://127.0.0.1:8000/api";
}

export const API_BASE = getApiBase();

/**
 * Resolves a full, normalized endpoint URL ensuring consistent /api pathing across
 * local development, preview deployments, and unified Vercel production hosting.
 */
export function resolveApiUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const base = getApiBase();

  if (base.endsWith("/api")) {
    if (cleanPath.startsWith("/api/")) {
      return `${base}${cleanPath.slice(4)}`;
    }
    return `${base}${cleanPath}`;
  }

  if (cleanPath.startsWith("/api/") || cleanPath === "/api") {
    return `${base}${cleanPath}`;
  }

  return `${base}/api${cleanPath}`;
}


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
  uptime_seconds?: number | null;
  database_configured?: boolean;
}

export interface ReadyResponse {
  ready: boolean;
  status: string;
  model: string;
  model_version: string;
  model_name: string;
  threshold: number;
  timestamp: string;
}

export interface ModelHealthResponse {
  status: string;
  model_loaded: boolean;
  model_name: string;
  model_version: string;
  threshold: number;
  feature_count: number;
  features: string[];
  shap_ready: boolean;
  timestamp: string;
  load_error?: string | null;
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

/**
 * Executes an HTTP fetch with timeout and bounded automatic retry for safe GET requests.
 * Mutating requests (POST, PATCH, PUT, DELETE) are NEVER retried automatically to prevent duplicate state.
 */
async function apiFetch<T>(
  path: string,
  options?: RequestInit,
  timeoutMs: number = 15000,
  retryCount: number = 0
): Promise<T> {
  const method = (options?.method || "GET").toUpperCase();
  const isSafeMethod = method === "GET" || method === "HEAD";
  const maxRetries = isSafeMethod ? 1 : 0; // Only retry idempotent requests once

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const url = resolveApiUrl(path);

  try {
    const res = await fetch(url, {
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
        detail = parsed.detail || parsed.error || errorBody;
      } catch {}

      if (res.status === 503) {
        throw new ApiError(
          "FraudLens AI service is currently initializing. Please retry in a few seconds.",
          503
        );
      }
      throw new ApiError(`API error ${res.status}: ${detail}`, res.status);
    }

    return (await res.json()) as T;
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    // Controlled automatic retry for transient network failures on safe GET requests
    if (
      isSafeMethod &&
      retryCount < maxRetries &&
      err instanceof Error &&
      (err.name === "AbortError" ||
        err.message.includes("Failed to fetch") ||
        err.message.includes("NetworkError") ||
        err.message.includes("Load failed"))
    ) {
      await new Promise((r) => setTimeout(r, 1000));
      return apiFetch<T>(path, options, timeoutMs, retryCount + 1);
    }

    if (err instanceof ApiError) {
      throw err;
    }

    if (err instanceof Error) {
      if (err.name === "AbortError") {
        throw new ApiError(
          "Analysis request timed out. The backend service may be starting up or under heavy load. Please retry.",
          408,
          true
        );
      }
      if (
        err.message.includes("Failed to fetch") ||
        err.message.includes("NetworkError") ||
        err.message.includes("Load failed")
      ) {
        throw new ApiError(
          "Unable to connect to FraudLens AI service. The API may be starting up or temporarily unreachable. Please retry.",
          0,
          true
        );
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
  health: () => apiFetch<HealthResponse>("/health", undefined, 8000),

  ready: () => apiFetch<ReadyResponse>("/ready", undefined, 8000),

  modelHealth: () => apiFetch<ModelHealthResponse>("/health/model", undefined, 8000),

  predict: (transaction: TransactionInput) =>
    apiFetch<PredictionResponse>(
      "/predict",
      {
        method: "POST",
        body: JSON.stringify(transaction),
      },
      25000
    ),

  explain: (transaction: TransactionInput) =>
    apiFetch<ExplainResponse>(
      "/explain",
      {
        method: "POST",
        body: JSON.stringify(transaction),
      },
      25000
    ),

  analytics: (force = false): Promise<AnalyticsResponse> => {
    if (!analyticsCache || force) {
      analyticsCache = apiFetch<AnalyticsResponse>("/analytics", undefined, 15000).catch((err) => {
        analyticsCache = null;
        throw err;
      });
    }
    return analyticsCache;
  },

  modelInfo: (force = false): Promise<ModelInfoResponse> => {
    if (!modelInfoCache || force) {
      modelInfoCache = apiFetch<ModelInfoResponse>("/model-info", undefined, 15000).catch((err) => {
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
          return await apiFetch<SamplesResponse>("/samples", undefined, 15000);
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
      `/investigations${status ? `?status=${status}&limit=${limit}` : `?limit=${limit}`}`,
      undefined,
      15000
    ),

  getInvestigation: (id: string) =>
    apiFetch<InvestigationRecord>(`/investigations/${id}`, undefined, 15000),

  getInvestigationByAnalysis: (analysisId: string) =>
    apiFetch<InvestigationRecord>(`/investigations/by-analysis/${analysisId}`, undefined, 15000),

  updateInvestigation: (id: string, update: InvestigationUpdateInput) =>
    apiFetch<InvestigationRecord>(
      `/investigations/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(update),
      },
      20000
    ),

  listAnalyses: (limit: number = 50) =>
    apiFetch<AnalysisDetail[]>(`/analyses?limit=${limit}`, undefined, 15000),

  getAnalysis: (id: string) =>
    apiFetch<AnalysisDetail>(`/analyses/${id}`, undefined, 15000),

  listNotifications: (unreadOnly?: boolean, limit: number = 50) =>
    apiFetch<NotificationListResponse>(
      `/notifications${unreadOnly ? `?unread_only=true&limit=${limit}` : `?limit=${limit}`}`,
      undefined,
      15000
    ),

  markNotificationAsRead: (id: string) =>
    apiFetch<NotificationItem>(
      `/notifications/${id}/read`,
      {
        method: "PATCH",
      },
      15000
    ),

  markAllNotificationsAsRead: () =>
    apiFetch<{ status: string; marked_count: number }>(
      "/notifications/mark-all-read",
      {
        method: "POST",
      },
      15000
    ),
};


