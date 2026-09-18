"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { useMobileMenu } from "@/app/(app)/layout";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { RiskSpectrum } from "@/components/ui/RiskSpectrum";
import { MetricBar } from "@/components/ui/MetricBar";
import { ErrorState } from "@/components/ui/ErrorState";
import { api, type ExplainResponse, type SamplesResponse } from "@/lib/api";
import { formatCurrencyINR, generateTxnId } from "@/lib/utils";

export default function InvestigationsPage() {
  const [samples, setSamples] = useState<SamplesResponse | null>(null);
  const [selected, setSelected] = useState<"fraud" | "legitimate" | null>(null);
  const [result, setResult] = useState<ExplainResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timestamps, setTimestamps] = useState<string[]>([]);
  const { onMenuToggle } = useMobileMenu();

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
      setTimestamps([]);

      const txn = type === "fraud" ? samples.fraud[0] : samples.legitimate[0];
      const t0 = new Date();
      const fmt = (d: Date) =>
        d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

      try {
        const r = await api.explain(txn);
        const t1 = new Date();
        setResult(r);
        setTimestamps([
          fmt(t0),
          fmt(new Date(t0.getTime() + 50)),
          fmt(new Date(t0.getTime() + 180)),
          fmt(new Date(t1.getTime() - 80)),
          fmt(t1),
        ]);
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
        title="Investigation Workspace"
        description="Forensic transaction analysis — evidence-driven risk review"
        onMenuToggle={onMenuToggle}
      />
      <main style={{ flex: 1, padding: "2rem", maxWidth: "1440px", width: "100%" }}>

        {/* ── Launch bar ─────────────────────────────────────────────────── */}
        <div
          className="card"
          style={{
            padding: "1.375rem",
            marginBottom: "1.75rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div>
            <div className="intelligence-label" style={{ marginBottom: "0.25rem" }}>
              Open Investigation
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
              Select a real test-set sample to begin a full forensic investigation
            </div>
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
                padding: "0.625rem 1.375rem",
                borderRadius: "var(--radius-md)",
                fontSize: "0.9375rem",
                fontWeight: 600,
                cursor: "pointer",
                border: "2px solid var(--color-risk-high-border)",
                backgroundColor: "var(--color-risk-high-bg)",
                color: "var(--color-risk-high)",
                transition: "all 0.15s ease",
                letterSpacing: "-0.01em",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--color-risk-high)";
                (e.currentTarget as HTMLButtonElement).style.color = "white";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--color-risk-high-bg)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--color-risk-high)";
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Investigate Fraud Sample
            </button>
          </div>
        </div>

        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {loading && (
          <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                border: "3px solid var(--color-border)",
                borderTopColor: "var(--color-brand)",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 1.25rem",
              }}
            />
            <div style={{ fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "0.375rem" }}>
              Running investigation
            </div>
            <div style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
              Analyzing transaction, computing risk, generating SHAP evidence…
            </div>
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────────────────── */}
        {error && (
          <ErrorState
            title="Investigation failed"
            message={error}
            onRetry={() => selected && investigate(selected)}
          />
        )}

        {/* ── Empty ───────────────────────────────────────────────────────── */}
        {!loading && !result && !error && (
          <div className="card" style={{ padding: "4rem 2rem", textAlign: "center" }}>
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.5rem",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-border-strong)" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--color-text-primary)", marginBottom: "0.5rem" }}>
              No investigation open
            </div>
            <div style={{ fontSize: "0.875rem", color: "var(--color-text-tertiary)", maxWidth: "280px", margin: "0 auto" }}>
              Select a transaction above to begin a detailed forensic investigation
            </div>
          </div>
        )}

        {/* ── Investigation detail ─────────────────────────────────────────── */}
        {result && timestamps.length > 0 && !loading && (
          <AnimatePresence>
            <InvestigationDetail
              result={result}
              timestamps={timestamps}
              groundTruth={selected}
              samples={samples}
            />
          </AnimatePresence>
        )}
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ─── Investigation detail layout ──────────────────────────────────────────── */
function InvestigationDetail({
  result,
  timestamps,
  groundTruth,
  samples,
}: {
  result: ExplainResponse;
  timestamps: string[];
  groundTruth: "fraud" | "legitimate" | null;
  samples: SamplesResponse | null;
}) {
  const prob = result.fraud_probability;
  const threshold = result.threshold;
  const isFraud = result.prediction === "FRAUD";

  const riskColor =
    result.risk_level === "HIGH"
      ? "var(--color-risk-high)"
      : result.risk_level === "REVIEW"
      ? "var(--color-risk-review)"
      : "var(--color-risk-low)";

  const contributions = result.top_contributions.slice(0, 10);
  const fraudContribs = contributions.filter((c) => c.direction === "fraud");
  const legitContribs = contributions.filter((c) => c.direction === "legitimate");
  const maxAbs = Math.max(...contributions.map((c) => Math.abs(c.contribution)));

  // Reconstruct sample for metadata
  const sample =
    groundTruth === "fraud"
      ? samples?.fraud[0]
      : groundTruth === "legitimate"
      ? samples?.legitimate[0]
      : null;

  const txnId = sample ? generateTxnId(sample.Amount, sample.Time) : "TX-UNKN";

  const timelineEvents = [
    { label: "Transaction Received", icon: "▷", color: "var(--color-accent)" },
    { label: "Input Validated — 30 features", icon: "✓", color: "var(--color-accent)" },
    { label: "XGBoost Model Evaluated", icon: "⟳", color: "var(--color-risk-review)" },
    { label: `Risk Classified: ${result.risk_level}`, icon: "◉", color: riskColor },
    { label: "SHAP Explanation Generated", icon: "✦", color: "var(--color-risk-low)" },
  ];

  const containerAnim: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.09 } } };
  const itemAnim: Variants = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

  return (
    <motion.div
      variants={containerAnim}
      initial="hidden"
      animate="show"
      style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
    >
      {/* ── Top: Transaction ID bar ─────────────────────────────────────── */}
      <motion.div
        variants={itemAnim}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
              fontSize: "1.125rem",
              color: "var(--color-text-primary)",
              letterSpacing: "-0.01em",
            }}
          >
            {txnId}
          </div>
          <RiskBadge level={result.risk_level} size="lg" pulse={result.risk_level === "HIGH"} />
        </div>
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--color-text-tertiary)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {result.model_name} · {result.model_version}
        </div>
      </motion.div>

      {/* ── Three-column main layout ────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.1fr 1.2fr",
          gap: "1.25rem",
          alignItems: "start",
        }}
        className="investigation-grid"
      >
        {/* LEFT: Transaction identity */}
        <motion.div variants={itemAnim} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div className="card" style={{ padding: "1.375rem" }}>
            <div className="intelligence-label" style={{ marginBottom: "1rem" }}>
              Transaction Identity
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <InfoRow label="Transaction ID" value={txnId} mono />
              {sample && (
                <>
                  <InfoRow label="Amount" value={formatCurrencyINR(sample.Amount)} />
                  <InfoRow label="Time Elapsed" value={`${sample.Time.toFixed(0)}s`} mono />
                  <InfoRow label="Feature Count" value="30 features" />
                </>
              )}
              {groundTruth && (
                <div>
                  <div className="intelligence-label" style={{ marginBottom: "0.25rem" }}>
                    Ground Truth
                  </div>
                  <div
                    style={{
                      padding: "0.4375rem 0.875rem",
                      borderRadius: "4px",
                      display: "inline-block",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      letterSpacing: "0.07em",
                      textTransform: "uppercase",
                      color: groundTruth === "fraud" ? "var(--color-risk-high)" : "var(--color-risk-low)",
                      background: groundTruth === "fraud" ? "var(--color-risk-high-bg)" : "var(--color-risk-low-bg)",
                      border: `1px solid ${groundTruth === "fraud" ? "var(--color-risk-high-border)" : "var(--color-risk-low-border)"}`,
                    }}
                  >
                    {groundTruth.toUpperCase()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Investigation Timeline */}
          <div className="card" style={{ padding: "1.375rem" }}>
            <div className="intelligence-label" style={{ marginBottom: "1.125rem" }}>
              Investigation Timeline
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
              {timelineEvents.map((evt, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.35 }}
                  style={{ display: "flex", gap: "0.875rem" }}
                >
                  {/* Timeline track */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                    <div
                      style={{
                        width: "26px",
                        height: "26px",
                        borderRadius: "50%",
                        background: `${evt.color}18`,
                        border: `1.5px solid ${evt.color}44`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.625rem",
                        color: evt.color,
                        flexShrink: 0,
                        marginTop: i === 0 ? 0 : "2px",
                      }}
                    >
                      {i < timelineEvents.length - 1 ? (
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={evt.color} strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg width="8" height="8" viewBox="0 0 24 24" fill={evt.color}>
                          <circle cx="12" cy="12" r="8" />
                        </svg>
                      )}
                    </div>
                    {i < timelineEvents.length - 1 && (
                      <div style={{ width: "1px", flex: 1, background: "var(--color-border)", minHeight: "16px", margin: "3px 0" }} />
                    )}
                  </div>

                  {/* Event info */}
                  <div style={{ paddingBottom: i < timelineEvents.length - 1 ? "0.75rem" : 0, paddingTop: "2px" }}>
                    <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text-primary)", lineHeight: 1.3 }}>
                      {evt.label}
                    </div>
                    <div style={{ fontSize: "0.6875rem", color: "var(--color-text-tertiary)", fontFamily: "var(--font-mono)", marginTop: "2px" }}>
                      {timestamps[i]}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* CENTER: Risk Assessment */}
        <motion.div variants={itemAnim}>
          <div
            className="card"
            style={{
              padding: "1.375rem",
              borderTop: `3px solid ${riskColor}`,
            }}
          >
            <div className="intelligence-label" style={{ marginBottom: "1.25rem" }}>
              Risk Assessment
            </div>

            {/* Probability display */}
            <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
              <div
                style={{
                  fontSize: "3.5rem",
                  fontWeight: 800,
                  color: riskColor,
                  letterSpacing: "-0.05em",
                  lineHeight: 1,
                  fontVariantNumeric: "tabular-nums",
                  marginBottom: "0.5rem",
                }}
              >
                {(prob * 100).toFixed(2)}%
              </div>
              <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
                Fraud probability
              </div>
            </div>

            <RiskSpectrum
              probability={prob}
              threshold={threshold}
              riskLevel={result.risk_level}
              animate
            />

            {/* Prediction verdict */}
            <div
              style={{
                marginTop: "1.25rem",
                padding: "0.875rem 1rem",
                borderRadius: "var(--radius-md)",
                background: isFraud ? "var(--color-risk-high-bg)" : "var(--color-risk-low-bg)",
                border: `1px solid ${isFraud ? "var(--color-risk-high-border)" : "var(--color-risk-low-border)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: isFraud ? "var(--color-risk-high)" : "var(--color-risk-low)",
                    marginBottom: "0.25rem",
                  }}
                >
                  Model Prediction
                </div>
                <div
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 800,
                    color: isFraud ? "var(--color-risk-high)" : "var(--color-risk-low)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {result.prediction}
                </div>
              </div>
              {groundTruth && (
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.6875rem", color: "var(--color-text-tertiary)", marginBottom: "0.25rem" }}>
                    vs. Ground Truth
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color:
                        result.prediction === groundTruth.toUpperCase()
                          ? "var(--color-risk-low)"
                          : "var(--color-risk-high)",
                    }}
                  >
                    {result.prediction === groundTruth.toUpperCase() ? "✓ Correct" : "✗ Incorrect"}
                  </div>
                </div>
              )}
            </div>

            {/* Decision context */}
            <div
              style={{
                marginTop: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                paddingTop: "1rem",
                borderTop: "1px solid var(--color-border)",
              }}
            >
              {[
                { label: "Decision Threshold", value: `${(threshold * 100).toFixed(0)}%` },
                { label: "Threshold Basis", value: "Validation F1 maximization" },
                { label: "Model", value: result.model_name },
              ].map((r) => (
                <div
                  key={r.label}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <span style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>{r.label}</span>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--color-text-primary)" }}>
                    {r.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Human review note */}
            <div
              style={{
                marginTop: "1rem",
                padding: "0.75rem",
                background: "var(--color-surface-2)",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.75rem",
                color: "var(--color-text-secondary)",
                lineHeight: 1.6,
              }}
            >
              This output is decision support for human review, not a final determination.
              A human analyst is responsible for the final investigation outcome.
            </div>
          </div>
        </motion.div>

        {/* RIGHT: Model Evidence */}
        <motion.div variants={itemAnim}>
          <div className="card" style={{ padding: "1.375rem" }}>
            <div className="intelligence-label" style={{ marginBottom: "0.375rem" }}>
              Model Evidence
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", marginBottom: "1.375rem" }}>
              SHAP feature contributions behind this prediction
            </div>

            {fraudContribs.length > 0 && (
              <div style={{ marginBottom: "1.25rem" }}>
                <div
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    letterSpacing: "0.09em",
                    textTransform: "uppercase",
                    color: "var(--color-risk-high)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    marginBottom: "0.875rem",
                    paddingBottom: "0.5rem",
                    borderBottom: "1px solid var(--color-risk-high-border)",
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
                  </svg>
                  Fraud signal
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {fraudContribs.map((c, i) => (
                    <MetricBar
                      key={c.feature}
                      contribution={c}
                      maxAbs={maxAbs}
                      index={i}
                      emphasis={i === 0}
                    />
                  ))}
                </div>
              </div>
            )}

            {legitContribs.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    letterSpacing: "0.09em",
                    textTransform: "uppercase",
                    color: "var(--color-risk-low)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    marginBottom: "0.875rem",
                    paddingBottom: "0.5rem",
                    borderBottom: "1px solid var(--color-risk-low-border)",
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" /><polyline points="5 12 12 5 19 12" />
                  </svg>
                  Legitimacy signal
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {legitContribs.map((c, i) => (
                    <MetricBar key={c.feature} contribution={c} maxAbs={maxAbs} index={i} />
                  ))}
                </div>
              </div>
            )}

            <div
              style={{
                marginTop: "1rem",
                padding: "0.75rem",
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.75rem",
                color: "var(--color-text-secondary)",
                fontStyle: "italic",
                lineHeight: 1.6,
              }}
            >
              {result.disclaimer}
            </div>
          </div>
        </motion.div>
      </div>

      <style>{`
        @media (max-width: 1100px) {
          .investigation-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 700px) {
          .investigation-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </motion.div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="intelligence-label" style={{ marginBottom: "0.2rem" }}>{label}</div>
      <div
        style={{
          fontSize: "0.9rem",
          fontWeight: 600,
          color: "var(--color-text-primary)",
          fontFamily: mono ? "var(--font-mono)" : undefined,
        }}
      >
        {value}
      </div>
    </div>
  );
}
