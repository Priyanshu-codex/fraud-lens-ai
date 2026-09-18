"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { useMobileMenu } from "@/app/(app)/layout";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { RiskSpectrum } from "@/components/ui/RiskSpectrum";
import { MetricBar } from "@/components/ui/MetricBar";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  api,
  type TransactionInput,
  type ExplainResponse,
  type SamplesResponse,
} from "@/lib/api";
import { formatCurrencyINR } from "@/lib/utils";

type Mode = "legitimate" | "fraud" | "custom";
type Stage = "idle" | "loaded" | "validating" | "analyzing" | "computing" | "explaining" | "done" | "error";

const STAGE_LABELS: Record<string, string> = {
  validating: "Validating input",
  analyzing:  "Running XGBoost model",
  computing:  "Computing fraud probability",
  explaining: "Generating SHAP evidence",
  done:       "Analysis complete",
};

const STAGE_ORDER: Stage[] = ["validating", "analyzing", "computing", "explaining"];

export default function AnalyzePage() {
  const [mode, setMode] = useState<Mode>("legitimate");
  const [samples, setSamples] = useState<SamplesResponse | null>(null);
  const [samplesError, setSamplesError] = useState(false);
  const [selectedSample, setSelectedSample] = useState<TransactionInput | null>(null);
  const [customForm, setCustomForm] = useState<Partial<TransactionInput>>({});
  const [advancedMode, setAdvancedMode] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [stageIndex, setStageIndex] = useState(0);
  const [result, setResult] = useState<ExplainResponse | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const { onMenuToggle } = useMobileMenu();

  useEffect(() => {
    api.samples().then(setSamples).catch(() => setSamplesError(true));
  }, []);

  useEffect(() => {
    if (!samples) return;
    if (mode === "legitimate") { setSelectedSample(samples.legitimate[0]); setStage("loaded"); }
    else if (mode === "fraud") { setSelectedSample(samples.fraud[0]); setStage("loaded"); }
    else { setSelectedSample(null); setStage("idle"); }
    setResult(null);
    setAnalyzeError(null);
  }, [mode, samples]);

  const handleAnalyze = useCallback(async () => {
    const txn = mode === "custom" ? (customForm as TransactionInput) : selectedSample;
    if (!txn) return;

    setStage("validating");
    setStageIndex(0);
    setResult(null);
    setAnalyzeError(null);

    // Animate through stages
    let idx = 0;
    const interval = setInterval(() => {
      idx++;
      if (idx < STAGE_ORDER.length) {
        setStage(STAGE_ORDER[idx]);
        setStageIndex(idx);
      } else {
        clearInterval(interval);
      }
    }, 400);

    try {
      const response = await api.explain(txn);
      clearInterval(interval);
      setStage("done");
      setStageIndex(STAGE_ORDER.length);
      setResult(response);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    } catch (e: unknown) {
      clearInterval(interval);
      setStage("error");
      setAnalyzeError(e instanceof Error ? e.message : "Analysis failed");
    }
  }, [mode, selectedSample, customForm]);

  const isAnalyzing = ["validating", "analyzing", "computing", "explaining"].includes(stage);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <Header
        title="Transaction Analyzer"
        description="Evaluate transaction-level fraud risk using the FraudLens inference engine"
        onMenuToggle={onMenuToggle}
      />
      <main
        style={{
          flex: 1,
          padding: "2rem",
          maxWidth: "1280px",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1.75rem",
            alignItems: "start",
          }}
          className="analyze-grid"
        >
          {/* ── LEFT: Input ──────────────────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            {/* Source selector */}
            <div className="card" style={{ padding: "1.375rem" }}>
              <div className="intelligence-label" style={{ marginBottom: "1rem" }}>
                Transaction Source
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.625rem" }}>
                {([
                  { m: "legitimate" as Mode, label: "Legitimate Sample", desc: "Real test-set transaction", color: "var(--color-risk-low)" },
                  { m: "fraud" as Mode,      label: "Fraud Sample",      desc: "Real fraud transaction",   color: "var(--color-risk-high)" },
                  { m: "custom" as Mode,     label: "Custom Input",      desc: "Enter your own values",    color: "var(--color-accent)" },
                ] as const).map(({ m, label, desc, color }) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    style={{
                      padding: "0.875rem 0.75rem",
                      borderRadius: "var(--radius-md)",
                      border: `2px solid ${mode === m ? color : "var(--color-border)"}`,
                      background: mode === m ? `${color}10` : "var(--color-surface-2)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      textAlign: "left",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: mode === m ? color : "var(--color-text-primary)",
                        marginBottom: "0.2rem",
                      }}
                    >
                      {label}
                    </div>
                    <div style={{ fontSize: "0.6875rem", color: "var(--color-text-tertiary)" }}>{desc}</div>
                  </button>
                ))}
              </div>
              {samplesError && (
                <div style={{ marginTop: "0.75rem", fontSize: "0.8125rem", color: "var(--color-risk-review)" }}>
                  ⚠ Could not load samples — use Custom Input mode
                </div>
              )}
            </div>

            {/* Sample preview */}
            {mode !== "custom" && selectedSample && (
              <motion.div
                key="sample-preview"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="card"
                style={{ padding: "1.375rem" }}
              >
                <div className="intelligence-label" style={{ marginBottom: "1rem" }}>
                  Transaction Preview
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0.875rem",
                    marginBottom: "1rem",
                  }}
                >
                  <DataField label="Amount" value={formatCurrencyINR(selectedSample.Amount)} />
                  <DataField label="Time" value={`${selectedSample.Time.toFixed(0)}s elapsed`} mono />
                  <DataField label="Features" value="V1 – V28 (PCA)" mono />
                  <DataField
                    label="Ground Truth"
                    value={mode === "fraud" ? "FRAUD" : "LEGITIMATE"}
                    valueColor={mode === "fraud" ? "var(--color-risk-high)" : "var(--color-risk-low)"}
                  />
                </div>
                <div
                  style={{
                    padding: "0.625rem 0.875rem",
                    background: "var(--color-surface-2)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.8125rem",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  V1–V28 are anonymized PCA-transformed features from the original dataset.
                  The amount shown is the raw transaction value.
                </div>
              </motion.div>
            )}

            {/* Custom form */}
            {mode === "custom" && (
              <motion.div
                key="custom-form"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="card"
                style={{ padding: "1.375rem" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "1rem",
                  }}
                >
                  <div className="intelligence-label">Transaction Features</div>
                  <div style={{ display: "flex", gap: "0.375rem" }}>
                    {["Basic", "Advanced"].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setAdvancedMode(tab === "Advanced")}
                        className="btn btn-sm"
                        style={{
                          ...(advancedMode === (tab === "Advanced")
                            ? { background: "var(--color-text-primary)", color: "white" }
                            : { background: "var(--color-surface-2)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" }),
                        }}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <FormField
                    label="Amount (₹)"
                    placeholder="e.g. 24580"
                    value={customForm.Amount?.toString() ?? ""}
                    onChange={(v) => setCustomForm((f) => ({ ...f, Amount: parseFloat(v) || 0 }))}
                  />
                  <FormField
                    label="Time (seconds)"
                    placeholder="e.g. 406"
                    value={customForm.Time?.toString() ?? ""}
                    onChange={(v) => setCustomForm((f) => ({ ...f, Time: parseFloat(v) || 0 }))}
                  />
                </div>

                {advancedMode && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    style={{ marginTop: "1rem" }}
                  >
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--color-text-secondary)",
                        marginBottom: "0.625rem",
                        fontWeight: 500,
                      }}
                    >
                      V1 – V28 (anonymized PCA features — leave 0 if unknown)
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.4rem" }}>
                      {Array.from({ length: 28 }, (_, i) => {
                        const key = `V${i + 1}` as keyof TransactionInput;
                        return (
                          <FormField
                            key={key}
                            label={`V${i + 1}`}
                            placeholder="0.0"
                            value={(customForm[key] as number | undefined)?.toString() ?? ""}
                            onChange={(v) => setCustomForm((f) => ({ ...f, [key]: parseFloat(v) || 0 }))}
                            compact
                          />
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Analyze button */}
            <button
              className="btn btn-analyze btn-lg"
              onClick={handleAnalyze}
              disabled={isAnalyzing || (!selectedSample && mode !== "custom")}
              style={{ width: "100%", position: "relative", overflow: "hidden" }}
              id="analyze-btn"
            >
              <AnimatePresence mode="wait">
                {isAnalyzing ? (
                  <motion.span
                    key="analyzing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: "16px",
                        height: "16px",
                        border: "2px solid rgba(255,255,255,0.3)",
                        borderTopColor: "white",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                        flexShrink: 0,
                      }}
                    />
                    <span>{STAGE_LABELS[stage] ?? "Processing…"}</span>
                  </motion.span>
                ) : (
                  <motion.span
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    Run Risk Analysis →
                  </motion.span>
                )}
              </AnimatePresence>
            </button>

            {/* Stage progress (visible while analyzing) */}
            <AnimatePresence>
              {isAnalyzing && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="card"
                  style={{ padding: "1.25rem", overflow: "hidden" }}
                >
                  <div className="intelligence-label" style={{ marginBottom: "1rem" }}>
                    Processing Pipeline
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {STAGE_ORDER.map((s, i) => (
                      <div
                        key={s}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.875rem",
                          opacity: i <= stageIndex ? 1 : 0.35,
                          transition: "opacity 0.3s ease",
                        }}
                      >
                        <div
                          style={{
                            width: "22px",
                            height: "22px",
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            background:
                              i < stageIndex
                                ? "var(--color-risk-low)"
                                : i === stageIndex
                                ? "var(--color-text-primary)"
                                : "var(--color-surface-3)",
                            border: `2px solid ${i < stageIndex ? "var(--color-risk-low)" : i === stageIndex ? "var(--color-text-primary)" : "var(--color-border)"}`,
                          }}
                        >
                          {i < stageIndex ? (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : i === stageIndex ? (
                            <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "white" }} />
                          ) : null}
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: "0.875rem",
                              fontWeight: i === stageIndex ? 600 : 400,
                              color: i <= stageIndex ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                            }}
                          >
                            {STAGE_LABELS[s]}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── RIGHT: Result ─────────────────────────────────────────────── */}
          <div ref={resultRef}>
            <AnimatePresence mode="wait">
              {(stage === "idle" || stage === "loaded") && !result && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="card"
                  style={{ padding: "3rem 2rem", textAlign: "center" }}
                >
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
                      margin: "0 auto 1.25rem",
                    }}
                  >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-border-strong)" strokeWidth="1.5">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.5rem", color: "var(--color-text-primary)" }}>
                    {stage === "loaded" ? "Transaction Ready" : "Awaiting Transaction"}
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "var(--color-text-tertiary)", maxWidth: "260px", margin: "0 auto" }}>
                    {stage === "loaded"
                      ? "Click Run Risk Analysis to evaluate this transaction"
                      : "Select a source and click Run Risk Analysis"}
                  </div>
                </motion.div>
              )}

              {stage === "error" && (
                <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <ErrorState
                    title="Analysis failed"
                    message={analyzeError || "An unexpected error occurred"}
                    onRetry={handleAnalyze}
                  />
                </motion.div>
              )}

              {stage === "done" && result && (
                <ResultPanel key="result" result={result} mode={mode} />
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      <style>{`
        @media (max-width: 900px) {
          .analyze-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ─── Result Panel ─────────────────────────────────────────────────────────── */
function ResultPanel({ result, mode }: { result: ExplainResponse; mode: Mode }) {
  const prob = result.fraud_probability;
  const probPct = prob * 100;
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

  const panelClass =
    result.risk_level === "HIGH"
      ? "result-panel-high"
      : result.risk_level === "REVIEW"
      ? "result-panel-review"
      : "result-panel-low";

  const containerAnim = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08 } },
  };
  const itemAnim = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.42 } },
  };

  return (
    <motion.div
      variants={containerAnim}
      initial="hidden"
      animate="show"
      style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
    >
      {/* ── Primary result card ─────────────────────────────────────────── */}
      <motion.div variants={itemAnim} className={`card ${panelClass}`} style={{ padding: "1.75rem" }}>
        <div className="intelligence-label" style={{ marginBottom: "1rem" }}>
          Risk Assessment
        </div>

        {/* Probability + badge row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "1.75rem",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "4rem",
                fontWeight: 800,
                color: riskColor,
                letterSpacing: "-0.05em",
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
                marginBottom: "0.375rem",
              }}
            >
              {probPct.toFixed(2)}%
            </div>
            <div style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", marginBottom: "0.75rem" }}>
              Fraud probability
            </div>
            <RiskBadge level={result.risk_level} size="lg" pulse={result.risk_level === "HIGH"} />
          </div>

          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: "0.6875rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: isFraud ? "var(--color-risk-high)" : "var(--color-risk-low)",
                background: isFraud ? "var(--color-risk-high-bg)" : "var(--color-risk-low-bg)",
                border: `1px solid ${isFraud ? "var(--color-risk-high-border)" : "var(--color-risk-low-border)"}`,
                padding: "0.4rem 0.875rem",
                borderRadius: "4px",
                marginBottom: "0.625rem",
              }}
            >
              {result.prediction}
            </div>
            {mode !== "custom" && (
              <div style={{ fontSize: "0.75rem", color: "var(--color-text-tertiary)" }}>
                Ground truth: <strong>{mode.toUpperCase()}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Risk Spectrum */}
        <RiskSpectrum
          probability={prob}
          threshold={threshold}
          riskLevel={result.risk_level}
          animate
        />

        {/* Meta row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "0.75rem",
            marginTop: "1.25rem",
            paddingTop: "1.25rem",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <DataField label="Threshold" value={`${(threshold * 100).toFixed(0)}%`} mono />
          <DataField label="Model" value={result.model_name} mono />
          <DataField label="Version" value={result.model_version} mono />
        </div>
      </motion.div>

      {/* ── SHAP Evidence ───────────────────────────────────────────────── */}
      <motion.div variants={itemAnim} className="card" style={{ padding: "1.75rem" }}>
        <div className="intelligence-label" style={{ marginBottom: "0.375rem" }}>
          Why did the model flag this?
        </div>
        <div style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", marginBottom: "1.5rem" }}>
          Model evidence — SHAP feature contributions to this prediction
        </div>

        {fraudContribs.length > 0 && (
          <div style={{ marginBottom: "1.375rem" }}>
            <div
              style={{
                fontSize: "0.6875rem",
                fontWeight: 700,
                letterSpacing: "0.09em",
                textTransform: "uppercase",
                color: "var(--color-risk-high)",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.875rem",
                paddingBottom: "0.625rem",
                borderBottom: "1px solid var(--color-risk-high-border)",
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
              </svg>
              Pushing toward fraud
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
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
                gap: "0.5rem",
                marginBottom: "0.875rem",
                paddingBottom: "0.625rem",
                borderBottom: "1px solid var(--color-risk-low-border)",
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" /><polyline points="5 12 12 5 19 12" />
              </svg>
              Pushing away from fraud
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {legitContribs.map((c, i) => (
                <MetricBar
                  key={c.feature}
                  contribution={c}
                  maxAbs={maxAbs}
                  index={i}
                />
              ))}
            </div>
          </div>
        )}

        <div
          style={{
            marginTop: "1.25rem",
            padding: "0.75rem 1rem",
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            fontSize: "0.8125rem",
            color: "var(--color-text-secondary)",
            fontStyle: "italic",
            lineHeight: 1.6,
          }}
        >
          {result.disclaimer}
        </div>
      </motion.div>

      {/* Model footer */}
      <motion.div
        variants={itemAnim}
        style={{
          textAlign: "center",
          fontSize: "0.75rem",
          color: "var(--color-text-tertiary)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {result.model_name} · {result.model_version} · threshold {(threshold * 100).toFixed(0)}%
      </motion.div>
    </motion.div>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function DataField({
  label,
  value,
  mono = false,
  valueColor,
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueColor?: string;
}) {
  return (
    <div>
      <div className="intelligence-label" style={{ marginBottom: "0.25rem" }}>{label}</div>
      <div
        style={{
          fontSize: "0.9375rem",
          fontWeight: 700,
          color: valueColor || "var(--color-text-primary)",
          fontFamily: mono ? "var(--font-mono)" : undefined,
          letterSpacing: mono ? "0.01em" : undefined,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function FormField({
  label,
  placeholder,
  value,
  onChange,
  compact = false,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  compact?: boolean;
}) {
  return (
    <div>
      <label className="input-label" style={{ fontSize: compact ? "0.6875rem" : undefined }}>
        {label}
      </label>
      <input
        type="number"
        step="any"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: compact ? "0.75rem" : "0.875rem",
          padding: compact ? "0.375rem 0.625rem" : undefined,
        }}
      />
    </div>
  );
}
