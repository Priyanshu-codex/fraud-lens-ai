"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { ErrorState } from "@/components/ui/ErrorState";
import { api, type ExplainResponse, type SamplesResponse } from "@/lib/api";

export default function InvestigationsPage() {
  const [samples, setSamples] = useState<SamplesResponse | null>(null);
  const [selected, setSelected] = useState<"fraud" | "legitimate" | null>(null);
  const [result, setResult] = useState<ExplainResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState<string | null>(null);

  useEffect(() => {
    api.samples().then(setSamples).catch(console.error);
  }, []);

  const investigate = useCallback(
    async (type: "fraud" | "legitimate") => {
      if (!samples) return;
      setLoading(true);
      setError(null);
      setSelected(type);
      setResult(null);
      setTimestamp(null);

      const txn = type === "fraud" ? samples.fraud[0] : samples.legitimate[0];
      try {
        const r = await api.explain(txn);
        setResult(r);
        setTimestamp(new Date().toISOString());
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Investigation failed");
      } finally {
        setLoading(false);
      }
    },
    [samples]
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <Header
        title="Investigations"
        description="Detailed transaction investigation workspace"
      />
      <main style={{ flex: 1, padding: "2rem", maxWidth: "1100px", width: "100%" }}>
        {/* Quick launch */}
        <div className="card" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
          <div className="text-section-heading" style={{ marginBottom: "0.875rem" }}>
            Open Investigation
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              className="btn btn-secondary"
              onClick={() => investigate("legitimate")}
              disabled={loading || !samples}
            >
              Investigate Legitimate Sample
            </button>
            <button
              onClick={() => investigate("fraud")}
              disabled={loading || !samples}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.625rem 1.25rem",
                borderRadius: "var(--radius-md)",
                fontSize: "0.9375rem",
                fontWeight: 500,
                cursor: "pointer",
                border: "1px solid var(--color-risk-high-border)",
                backgroundColor: "var(--color-risk-high-bg)",
                color: "var(--color-risk-high)",
                transition: "all 0.15s ease",
              }}
            >
              Investigate Fraud Sample
            </button>
          </div>
        </div>

        {/* Content */}
        {loading && <LoadingInvestigation />}
        {error && <ErrorState title="Investigation failed" message={error} onRetry={() => selected && investigate(selected)} />}
        {result && timestamp && !loading && (
          <InvestigationDetail result={result} timestamp={timestamp} groundTruth={selected} />
        )}
        {!loading && !result && !error && (
          <div
            className="card"
            style={{ padding: "3rem", textAlign: "center", color: "var(--color-text-tertiary)" }}
          >
            <div style={{ fontSize: "0.9375rem", fontWeight: 500, marginBottom: "0.5rem" }}>
              No investigation open
            </div>
            <div style={{ fontSize: "0.875rem" }}>
              Select a transaction to begin a detailed investigation
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function InvestigationDetail({
  result,
  timestamp,
  groundTruth,
}: {
  result: ExplainResponse;
  timestamp: string;
  groundTruth: "fraud" | "legitimate" | null;
}) {
  const prob = result.fraud_probability * 100;
  const threshold = result.threshold * 100;
  const isFraud = result.prediction === "FRAUD";
  const riskColor =
    result.risk_level === "HIGH"
      ? "var(--color-risk-high)"
      : result.risk_level === "REVIEW"
      ? "var(--color-risk-review)"
      : "var(--color-risk-low)";

  const contributions = result.top_contributions.slice(0, 10);
  const fraudContributions = contributions.filter((c) => c.direction === "fraud");
  const legitContributions = contributions.filter((c) => c.direction === "legitimate");
  const maxAbs = Math.max(...contributions.map((c) => Math.abs(c.contribution)));

  const now = new Date(timestamp);
  const timeStr = now.toLocaleTimeString("en-US", { hour12: false });

  const containerAnim = {
    hidden: {},
    show: { transition: { staggerChildren: 0.1 } },
  };
  const itemAnim = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.45 } },
  };

  return (
    <motion.div
      variants={containerAnim}
      initial="hidden"
      animate="show"
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", alignItems: "start" }}
    >
      {/* Left column */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {/* Summary card */}
        <motion.div
          variants={itemAnim}
          className="card"
          style={{ padding: "1.5rem", borderTop: `3px solid ${riskColor}` }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "1.25rem",
            }}
          >
            <div>
              <div className="text-section-heading" style={{ marginBottom: "0.5rem" }}>
                Investigation Result
              </div>
              <div
                style={{
                  fontSize: "1.375rem",
                  fontWeight: 800,
                  color: isFraud ? "var(--color-risk-high)" : "var(--color-risk-low)",
                  letterSpacing: "-0.02em",
                }}
              >
                {result.prediction}
              </div>
            </div>
            <RiskBadge level={result.risk_level} size="lg" />
          </div>

          {/* Probability ring */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1.25rem",
              padding: "1rem",
              backgroundColor: "var(--color-surface-2)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                background: `conic-gradient(${riskColor} ${prob}%, var(--color-border) ${prob}%)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  backgroundColor: "var(--color-surface-2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 800,
                    color: riskColor,
                    lineHeight: 1,
                  }}
                >
                  {prob.toFixed(0)}%
                </div>
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.9375rem", marginBottom: "0.25rem" }}>
                Fraud Probability
              </div>
              <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
                Decision threshold: {threshold.toFixed(0)}%
              </div>
              <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
                Model: {result.model_name} {result.model_version}
              </div>
            </div>
          </div>

          {/* Ground truth note */}
          {groundTruth && (
            <div
              style={{
                marginTop: "0.875rem",
                padding: "0.625rem 0.875rem",
                backgroundColor:
                  groundTruth === "fraud"
                    ? "var(--color-risk-high-bg)"
                    : "var(--color-risk-low-bg)",
                border: `1px solid ${groundTruth === "fraud" ? "var(--color-risk-high-border)" : "var(--color-risk-low-border)"}`,
                borderRadius: "4px",
                fontSize: "0.8125rem",
                color: groundTruth === "fraud" ? "var(--color-risk-high)" : "var(--color-risk-low)",
              }}
            >
              Dataset ground truth:{" "}
              <strong>{groundTruth.toUpperCase()}</strong> — verification: model
              {" "}{result.prediction === groundTruth.toUpperCase() ? "correct" : "incorrect"}
            </div>
          )}
        </motion.div>

        {/* Investigation timeline */}
        <motion.div variants={itemAnim} className="card" style={{ padding: "1.5rem" }}>
          <div className="text-section-heading" style={{ marginBottom: "1rem" }}>
            Investigation Timeline
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {[
              { time: timeStr, event: "Transaction received" },
              { time: timeStr, event: "Input validated — 30 features" },
              { time: timeStr, event: "XGBoost model evaluated" },
              { time: timeStr, event: `Risk classified: ${result.risk_level}` },
              { time: timeStr, event: "SHAP explanation generated" },
            ].map((item, i, arr) => (
              <div key={i} style={{ display: "flex", gap: "1rem" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: "var(--color-text-primary)",
                      marginTop: "4px",
                      flexShrink: 0,
                    }}
                  />
                  {i < arr.length - 1 && (
                    <div
                      style={{
                        width: "1px",
                        flex: 1,
                        backgroundColor: "var(--color-border)",
                        margin: "4px 0",
                        minHeight: "20px",
                      }}
                    />
                  )}
                </div>
                <div style={{ paddingBottom: i < arr.length - 1 ? "0.75rem" : 0 }}>
                  <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--color-text-primary)" }}>
                    {item.event}
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--color-text-tertiary)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {item.time}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Right column — SHAP evidence */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <motion.div variants={itemAnim} className="card" style={{ padding: "1.5rem" }}>
          <div className="text-section-heading" style={{ marginBottom: "0.25rem" }}>
            Model Evidence
          </div>
          <div
            style={{
              fontSize: "0.8125rem",
              color: "var(--color-text-secondary)",
              marginBottom: "1.25rem",
            }}
          >
            Why did the model produce this result?
          </div>

          {fraudContributions.length > 0 && (
            <div style={{ marginBottom: "1.25rem" }}>
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--color-risk-high)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  marginBottom: "0.75rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
                </svg>
                Pushing toward fraud
              </div>
              {fraudContributions.map((c, i) => (
                <ContribRow key={i} contribution={c} maxAbs={maxAbs} />
              ))}
            </div>
          )}

          {legitContributions.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--color-risk-low)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  marginBottom: "0.75rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" /><polyline points="5 12 12 5 19 12" />
                </svg>
                Pushing away from fraud
              </div>
              {legitContributions.map((c, i) => (
                <ContribRow key={i} contribution={c} maxAbs={maxAbs} />
              ))}
            </div>
          )}

          <div
            style={{
              marginTop: "1rem",
              padding: "0.625rem 0.875rem",
              backgroundColor: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              borderRadius: "4px",
              fontSize: "0.75rem",
              color: "var(--color-text-secondary)",
              fontStyle: "italic",
            }}
          >
            {result.disclaimer}
          </div>
        </motion.div>

        {/* Decision context */}
        <motion.div variants={itemAnim} className="card" style={{ padding: "1.5rem" }}>
          <div className="text-section-heading" style={{ marginBottom: "0.875rem" }}>
            Decision Context
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <ContextRow label="Model" value={result.model_name} />
            <ContextRow label="Version" value={result.model_version} />
            <ContextRow label="Decision threshold" value={`${threshold.toFixed(0)}%`} />
            <ContextRow label="Fraud probability" value={`${prob.toFixed(4)}%`} />
            <ContextRow label="Threshold basis" value="Validation set F1 optimization" />
            <div className="divider" />
            <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
              This output is decision support for human review, not a final determination.
              A human analyst is responsible for the final investigation outcome.
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function ContribRow({
  contribution,
  maxAbs,
}: {
  contribution: { feature: string; value: number; contribution: number; direction: string };
  maxAbs: number;
}) {
  const barWidth = maxAbs > 0 ? Math.abs(contribution.contribution) / maxAbs : 0;
  const color = contribution.direction === "fraud" ? "var(--color-risk-high)" : "var(--color-risk-low)";

  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.875rem", fontWeight: 500 }}>
          {contribution.feature}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", color, fontWeight: 600 }}>
          {contribution.contribution > 0 ? "+" : ""}{contribution.contribution.toFixed(3)}
        </span>
      </div>
      <div style={{ height: "5px", backgroundColor: "var(--color-border)", borderRadius: "3px" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${barWidth * 100}%` }}
          transition={{ duration: 0.5 }}
          style={{ height: "100%", backgroundColor: color, borderRadius: "3px" }}
        />
      </div>
    </div>
  );
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>{label}</span>
      <span style={{ fontSize: "0.875rem", fontWeight: 600, fontFamily: "var(--font-mono)" }}>{value}</span>
    </div>
  );
}

function LoadingInvestigation() {
  return (
    <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
      <div
        style={{
          display: "inline-block",
          width: "24px",
          height: "24px",
          border: "2px solid var(--color-border)",
          borderTopColor: "var(--color-text-primary)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
          marginBottom: "1rem",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
      <div style={{ color: "var(--color-text-secondary)" }}>Analyzing transaction...</div>
    </div>
  );
}
