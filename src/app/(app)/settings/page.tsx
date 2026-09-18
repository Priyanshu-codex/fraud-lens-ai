"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, type Variants } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { useMobileMenu } from "@/app/(app)/layout";
import { ErrorState } from "@/components/ui/ErrorState";
import { api, getApiBase, type HealthResponse, type ModelInfoResponse } from "@/lib/api";
import { formatTimestamp } from "@/lib/utils";

export default function SettingsPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { onMenuToggle } = useMobileMenu();

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
    let ignore = false;
    async function loadInitial() {
      try {
        const [h, m] = await Promise.all([api.health(), api.modelInfo()]);
        if (!ignore) {
          setHealth(h);
          setModelInfo(m);
        }
      } catch (e: unknown) {
        if (!ignore) {
          setError(e instanceof Error ? e.message : "Failed to load system info");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    loadInitial();
    return () => {
      ignore = true;
    };
  }, []);

  const containerAnim: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
  const itemAnim: Variants = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <Header
        title="System Health"
        description="API status, model information, and platform configuration"
        onMenuToggle={onMenuToggle}
      />
      <main style={{ flex: 1, padding: "2rem", maxWidth: "900px", width: "100%" }}>
        {loading ? (
          <div style={{ padding: "4rem", textAlign: "center" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                border: "3px solid var(--color-border)",
                borderTopColor: "var(--color-brand)",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 1rem",
              }}
            />
            <div style={{ fontSize: "0.875rem", color: "var(--color-text-tertiary)" }}>
              Checking system status…
            </div>
          </div>
        ) : error ? (
          <ErrorState title="Connection failed" message={error} onRetry={fetchData} />
        ) : (
          <motion.div
            variants={containerAnim}
            initial="hidden"
            animate="show"
            style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}
          >
            {/* ── System health ───────────────────────────────────────────── */}
            <motion.div variants={itemAnim}>
              <div className="intelligence-label" style={{ marginBottom: "1rem" }}>
                System Status
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "1rem",
                }}
              >
                {[
                  {
                    label: "API Backend",
                    status: health?.status === "ok" ? "CONNECTED" : "DEGRADED",
                    type: (health?.status === "ok" ? "good" : "warn") as "good" | "warn" | "bad",
                    detail: "FraudLens FastAPI backend",
                    mono: false,
                  },
                  {
                    label: "Supabase Database",
                    status: health?.database_connected ? "CONNECTED" : "OFFLINE",
                    type: (health?.database_connected ? "good" : "bad") as "good" | "warn" | "bad",
                    detail: "PostgreSQL with RLS",
                    mono: false,
                  },
                  {
                    label: "ML Model",
                    status: health?.model_loaded ? "READY" : "OFFLINE",
                    type: (health?.model_loaded ? "good" : "bad") as "good" | "warn" | "bad",
                    detail: health?.model_name ?? "Unknown",
                    mono: true,
                  },
                  {
                    label: "Preprocessing",
                    status: health?.preprocessing_loaded ? "READY" : "OFFLINE",
                    type: (health?.preprocessing_loaded ? "good" : "bad") as "good" | "warn" | "bad",
                    detail: "StandardScaler & robust transform",
                    mono: false,
                  },
                  {
                    label: "Explainability",
                    status: health?.shap_ready ? "READY" : "OFFLINE",
                    type: (health?.shap_ready ? "good" : "bad") as "good" | "warn" | "bad",
                    detail: "SHAP TreeExplainer",
                    mono: false,
                  },
                  {
                    label: "Dataset",
                    status: "AVAILABLE",
                    type: "good" as const,
                    detail: "creditcard.csv — 284,807 rows",
                    mono: false,
                  },
                ].map((s) => (
                  <StatusCard key={s.label} {...s} />
                ))}
              </div>
            </motion.div>

            {/* ── Model information ───────────────────────────────────────── */}
            {modelInfo && (
              <motion.div variants={itemAnim}>
                <div className="intelligence-label" style={{ marginBottom: "1rem" }}>
                  Model Information
                </div>
                <div className="card" style={{ padding: "1.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
                    <div>
                      <div style={{ fontSize: "1.125rem", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--color-text-primary)" }}>
                        {modelInfo.model_name}
                      </div>
                      <div style={{ fontSize: "0.8125rem", color: "var(--color-text-tertiary)", fontFamily: "var(--font-mono)", marginTop: "2px" }}>
                        {modelInfo.model_version}
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.375rem 0.875rem",
                        background: "var(--color-risk-low-bg)",
                        border: "1px solid var(--color-risk-low-border)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "0.6875rem",
                        fontWeight: 700,
                        letterSpacing: "0.07em",
                        color: "var(--color-risk-low)",
                        textTransform: "uppercase",
                      }}
                    >
                      <div className="status-dot-live" style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--color-risk-low)" }} />
                      Active Model
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                    {[
                      { label: "Training Timestamp", value: formatTimestamp(modelInfo.training_timestamp) },
                      { label: "Decision Threshold", value: `${(modelInfo.threshold * 100).toFixed(0)}%` },
                      { label: "Threshold Basis", value: "Validation set F1 maximization" },
                      { label: "Feature Count", value: `${modelInfo.feature_count} features (V1–V28, Amount, Time)` },
                      { label: "Dataset Size", value: `${modelInfo.dataset?.total_transactions?.toLocaleString("en-IN") ?? "284,807"} transactions` },
                    ].map((item, i, arr) => (
                      <div
                        key={item.label}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "0.875rem 0",
                          borderBottom: i < arr.length - 1 ? "1px solid var(--color-border)" : "none",
                          gap: "1rem",
                        }}
                      >
                        <span style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", flexShrink: 0 }}>
                          {item.label}
                        </span>
                        <span style={{ fontSize: "0.875rem", fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--color-text-primary)", textAlign: "right" }}>
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Test metrics ─────────────────────────────────────────────── */}
            {modelInfo && (
              <motion.div variants={itemAnim}>
                <div className="intelligence-label" style={{ marginBottom: "1rem" }}>
                  Test Set Performance
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                    gap: "0.875rem",
                  }}
                >
                  {[
                    { label: "PR-AUC", value: modelInfo.pr_auc, primary: true },
                    { label: "ROC-AUC", value: modelInfo.roc_auc },
                    { label: "F1 Score", value: modelInfo.f1 },
                    { label: "Precision", value: modelInfo.precision },
                    { label: "Recall", value: modelInfo.recall },
                  ].map((m) => (
                    <div
                      key={m.label}
                      style={{
                        padding: "1rem 1.125rem",
                        background: m.primary ? "var(--color-brand-subtle)" : "var(--color-surface-2)",
                        border: `1px solid ${m.primary ? "var(--color-brand-border)" : "var(--color-border)"}`,
                        borderRadius: "var(--radius-lg)",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      {m.primary && (
                        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "var(--color-brand)" }} />
                      )}
                      <div style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: m.primary ? "var(--color-brand)" : "var(--color-text-tertiary)", marginBottom: "0.5rem" }}>
                        {m.label}
                      </div>
                      <div style={{ fontSize: "1.375rem", fontWeight: 800, color: "var(--color-text-primary)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.025em" }}>
                        {(m.value * 100).toFixed(2)}%
                      </div>
                      <div style={{ height: "3px", background: "var(--color-border)", borderRadius: "2px", marginTop: "0.5rem", overflow: "hidden" }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${m.value * 100}%` }}
                          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                          style={{ height: "100%", background: m.primary ? "var(--color-brand)" : "var(--color-accent)", borderRadius: "2px", opacity: 0.75 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── API config ───────────────────────────────────────────────── */}
            <motion.div variants={itemAnim}>
              <div className="intelligence-label" style={{ marginBottom: "1rem" }}>
                API Configuration
              </div>
              <div className="card" style={{ padding: "1.5rem" }}>
                {[
                  {
                    label: "Backend URL",
                    value: getApiBase() || (typeof window !== "undefined" ? `${window.location.origin}/api` : "Configured via Vercel"),
                  },
                  {
                    label: "Frontend Host",
                    value: typeof window !== "undefined" ? window.location.host : "fraudlens-ai.vercel.app",
                  },
                  { label: "API Version", value: "1.0.0" },
                  {
                    label: "Deployment Environment",
                    value: process.env.NODE_ENV === "production" ? "Production (Vercel)" : "Development",
                  },
                ].map((item, i, arr) => (
                  <div
                    key={item.label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.75rem 0",
                      borderBottom: i < arr.length - 1 ? "1px solid var(--color-border)" : "none",
                    }}
                  >
                    <span style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>{item.label}</span>
                    <code
                      style={{
                        fontSize: "0.8125rem",
                        fontFamily: "var(--font-mono)",
                        color: "var(--color-text-primary)",
                        fontWeight: 600,
                        background: "var(--color-surface-2)",
                        padding: "0.1875rem 0.5rem",
                        borderRadius: "4px",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      {item.value}
                    </code>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* ── About ────────────────────────────────────────────────────── */}
            <motion.div variants={itemAnim}>
              <div className="card" style={{ padding: "1.5rem" }}>
                <div style={{ fontSize: "1rem", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "0.625rem" }}>
                  FraudLens AI — Financial Signal Intelligence
                </div>
                <div style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", lineHeight: 1.7, marginBottom: "1.25rem" }}>
                  AI-powered transaction risk detection and explainability platform. Every prediction
                  comes from a trained XGBoost model with a validated decision threshold. SHAP values
                  provide transparent model explanations for every result.
                </div>
                <div
                  style={{
                    padding: "0.875rem 1rem",
                    backgroundColor: "var(--color-risk-review-bg)",
                    border: "1px solid var(--color-risk-review-border)",
                    borderLeft: "4px solid var(--color-risk-review)",
                    borderRadius: "var(--radius-md)",
                    fontSize: "0.8125rem",
                    color: "var(--color-text-secondary)",
                    lineHeight: 1.65,
                  }}
                >
                  <strong style={{ color: "var(--color-text-primary)" }}>Decision support limitation:</strong>{" "}
                  FraudLens AI is a prototype. Model outputs are probabilistic and intended to assist
                  human review — not to make final determinations about fraudulent activity.
                </div>
                <div style={{ marginTop: "1.25rem", fontSize: "0.8125rem", color: "var(--color-text-tertiary)", fontFamily: "var(--font-mono)" }}>
                  XGBoost · FastAPI · Next.js 16 · SHAP · scikit-learn · Framer Motion
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function StatusCard({
  label,
  status,
  type,
  detail,
}: {
  label: string;
  status: string;
  type: "good" | "bad" | "warn";
  detail: string;
}) {
  const colors = {
    good: { text: "var(--color-risk-low)", bg: "var(--color-risk-low-bg)", border: "var(--color-risk-low-border)" },
    bad:  { text: "var(--color-risk-high)", bg: "var(--color-risk-high-bg)", border: "var(--color-risk-high-border)" },
    warn: { text: "var(--color-risk-review)", bg: "var(--color-risk-review-bg)", border: "var(--color-risk-review-border)" },
  }[type];

  return (
    <div
      className="card"
      style={{ padding: "1.125rem 1.25rem" }}
    >
      <div className="intelligence-label" style={{ marginBottom: "0.625rem" }}>{label}</div>
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
          fontSize: "0.6875rem",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          marginBottom: "0.5rem",
        }}
      >
        <div
          className={type === "good" ? "status-dot-live" : undefined}
          style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: colors.text }}
        />
        {status}
      </div>
      <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>{detail}</div>
    </div>
  );
}
