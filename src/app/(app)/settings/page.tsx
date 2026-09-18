"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { ErrorState } from "@/components/ui/ErrorState";
import { api, type HealthResponse, type ModelInfoResponse } from "@/lib/api";
import { formatTimestamp } from "@/lib/utils";

export default function SettingsPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [h, m] = await Promise.all([api.health(), api.modelInfo()]);
      setHealth(h);
      setModelInfo(m);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load system info");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <Header title="System" description="System health, model information, and configuration" />
      <main style={{ flex: 1, padding: "2rem", maxWidth: "900px", width: "100%" }}>
        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--color-text-tertiary)" }}>
            Loading system information...
          </div>
        ) : error ? (
          <ErrorState title="Connection failed" message={error} onRetry={fetchData} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* System health */}
            <section>
              <div className="text-section-heading" style={{ marginBottom: "1rem" }}>
                System Health
              </div>
              <div className="card" style={{ padding: "1.5rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
                  <StatusCard
                    label="API"
                    status={health?.status === "ok" ? "CONNECTED" : "DEGRADED"}
                    statusType={health?.status === "ok" ? "good" : "warn"}
                    detail="FraudLens backend"
                  />
                  <StatusCard
                    label="Model"
                    status={health?.model_loaded ? "READY" : "OFFLINE"}
                    statusType={health?.model_loaded ? "good" : "bad"}
                    detail={health?.model_name ?? "—"}
                  />
                  <StatusCard
                    label="Dataset"
                    status="AVAILABLE"
                    statusType="good"
                    detail="creditcard.csv"
                  />
                  <StatusCard
                    label="Explainability"
                    status="READY"
                    statusType="good"
                    detail="SHAP (TreeExplainer)"
                  />
                </div>
              </div>
            </section>

            {/* Model information */}
            {modelInfo && (
              <section>
                <div className="text-section-heading" style={{ marginBottom: "1rem" }}>
                  Model Information
                </div>
                <div className="card" style={{ padding: "1.5rem" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                    {[
                      { label: "Model Name", value: modelInfo.model_name },
                      { label: "Version", value: modelInfo.model_version },
                      { label: "Training Timestamp", value: formatTimestamp(modelInfo.training_timestamp) },
                      { label: "Decision Threshold", value: `${(modelInfo.threshold * 100).toFixed(0)}%` },
                      { label: "Feature Count", value: `${modelInfo.feature_count} features` },
                      { label: "Threshold Basis", value: "Validation set F1 maximization" },
                      { label: "Test PR-AUC", value: `${(modelInfo.pr_auc * 100).toFixed(2)}%` },
                      { label: "Test F1", value: `${(modelInfo.f1 * 100).toFixed(2)}%` },
                      { label: "Test Precision", value: `${(modelInfo.precision * 100).toFixed(2)}%` },
                      { label: "Test Recall", value: `${(modelInfo.recall * 100).toFixed(2)}%` },
                    ].map((item, i, arr) => (
                      <div
                        key={item.label}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "0.875rem 0",
                          borderBottom: i < arr.length - 1 ? "1px solid var(--color-border)" : "none",
                        }}
                      >
                        <span style={{ fontSize: "0.9rem", color: "var(--color-text-secondary)" }}>
                          {item.label}
                        </span>
                        <span
                          style={{
                            fontSize: "0.9rem",
                            fontWeight: 600,
                            fontFamily: "var(--font-mono)",
                            color: "var(--color-text-primary)",
                          }}
                        >
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* API Configuration */}
            <section>
              <div className="text-section-heading" style={{ marginBottom: "1rem" }}>
                API Configuration
              </div>
              <div className="card" style={{ padding: "1.5rem" }}>
                {[
                  { label: "Backend URL", value: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api" },
                  { label: "Frontend Port", value: "3000" },
                  { label: "API Version", value: "1.0.0" },
                ].map((item, i, arr) => (
                  <div
                    key={item.label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "0.875rem 0",
                      borderBottom: i < arr.length - 1 ? "1px solid var(--color-border)" : "none",
                    }}
                  >
                    <span style={{ fontSize: "0.9rem", color: "var(--color-text-secondary)" }}>
                      {item.label}
                    </span>
                    <span
                      style={{
                        fontSize: "0.875rem",
                        fontFamily: "var(--font-mono)",
                        color: "var(--color-text-primary)",
                      }}
                    >
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* About */}
            <section>
              <div className="text-section-heading" style={{ marginBottom: "1rem" }}>
                About FraudLens AI
              </div>
              <div className="card" style={{ padding: "1.5rem" }}>
                <div style={{ fontSize: "0.9375rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                  FraudLens AI — Financial Fraud Intelligence
                </div>
                <div style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", lineHeight: 1.7, marginBottom: "1rem" }}>
                  AI-powered transaction risk detection and explainability platform.
                  Every prediction comes from a trained XGBoost model with a validated decision threshold.
                  SHAP values provide transparent model explanations for every result.
                </div>
                <div
                  style={{
                    padding: "0.875rem 1rem",
                    backgroundColor: "var(--color-surface-2)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    fontSize: "0.8125rem",
                    color: "var(--color-text-secondary)",
                    lineHeight: 1.6,
                  }}
                >
                  <strong style={{ color: "var(--color-text-primary)" }}>Important limitation:</strong>{" "}
                  This is a fraud-risk decision-support prototype. Model outputs are probabilistic
                  and intended to assist human review — not to make final determinations about fraudulent activity.
                </div>
                <div style={{ marginTop: "1rem", fontSize: "0.8125rem", color: "var(--color-text-tertiary)" }}>
                  Technology: XGBoost · FastAPI · Next.js 16 · SHAP · scikit-learn
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function StatusCard({
  label,
  status,
  statusType,
  detail,
}: {
  label: string;
  status: string;
  statusType: "good" | "bad" | "warn";
  detail: string;
}) {
  const colors = {
    good: { text: "var(--color-risk-low)", bg: "var(--color-risk-low-bg)", border: "var(--color-risk-low-border)" },
    bad: { text: "var(--color-risk-high)", bg: "var(--color-risk-high-bg)", border: "var(--color-risk-high-border)" },
    warn: { text: "var(--color-risk-review)", bg: "var(--color-risk-review-bg)", border: "var(--color-risk-review-border)" },
  }[statusType];

  return (
    <div
      style={{
        padding: "1rem 1.125rem",
        backgroundColor: "var(--color-surface-2)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
      }}
    >
      <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-tertiary)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "0.625rem" }}>
        {label}
      </div>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.375rem",
          padding: "0.25rem 0.625rem",
          borderRadius: "4px",
          backgroundColor: colors.bg,
          border: `1px solid ${colors.border}`,
          color: colors.text,
          fontSize: "0.75rem",
          fontWeight: 700,
          letterSpacing: "0.05em",
          marginBottom: "0.5rem",
        }}
      >
        <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: colors.text }} />
        {status}
      </div>
      <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>{detail}</div>
    </div>
  );
}
