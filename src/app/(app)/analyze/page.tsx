"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  api,
  type TransactionInput,
  type ExplainResponse,
  type SamplesResponse,
} from "@/lib/api";
import { formatNumber } from "@/lib/utils";

type Mode = "legitimate" | "fraud" | "custom";
type Stage = "idle" | "loaded" | "analyzing" | "done" | "error";

const STEPS = [
  "Validating transaction input",
  "Running XGBoost model",
  "Computing fraud probability",
  "Generating SHAP explanation",
];

export default function AnalyzePage() {
  const [mode, setMode] = useState<Mode>("legitimate");
  const [samples, setSamples] = useState<SamplesResponse | null>(null);
  const [samplesError, setSamplesError] = useState(false);
  const [selectedSample, setSelectedSample] = useState<TransactionInput | null>(null);
  const [customForm, setCustomForm] = useState<Partial<TransactionInput>>({});
  const [stage, setStage] = useState<Stage>("idle");
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<ExplainResponse | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.samples()
      .then(setSamples)
      .catch(() => setSamplesError(true));
  }, []);

  // Load sample when mode changes
  useEffect(() => {
    if (!samples) return;
    if (mode === "legitimate") {
      setSelectedSample(samples.legitimate[0]);
      setStage("loaded");
    } else if (mode === "fraud") {
      setSelectedSample(samples.fraud[0]);
      setStage("loaded");
    } else {
      setSelectedSample(null);
      setStage("idle");
    }
    setResult(null);
    setAnalyzeError(null);
  }, [mode, samples]);

  const handleAnalyze = useCallback(async () => {
    const txn =
      mode === "custom"
        ? (customForm as TransactionInput)
        : selectedSample;
    if (!txn) return;

    setStage("analyzing");
    setStep(0);
    setResult(null);
    setAnalyzeError(null);

    // Animate steps
    const stepInterval = setInterval(() => {
      setStep((s) => {
        if (s >= STEPS.length - 1) {
          clearInterval(stepInterval);
          return s;
        }
        return s + 1;
      });
    }, 300);

    try {
      const response = await api.explain(txn);
      clearInterval(stepInterval);
      setStep(STEPS.length - 1);
      setStage("done");
      setResult(response);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e: unknown) {
      clearInterval(stepInterval);
      setStage("error");
      setAnalyzeError(e instanceof Error ? e.message : "Analysis failed");
    }
  }, [mode, selectedSample, customForm]);

  const txnForDisplay = mode === "custom" ? customForm : selectedSample;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <Header
        title="Analyze Transaction"
        description="Evaluate transaction-level fraud risk using the trained FraudLens model"
      />

      <main style={{ flex: 1, padding: "2rem", maxWidth: "1200px", width: "100%" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", alignItems: "start" }}>
          {/* Left: Input panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Mode selector */}
            <div className="card" style={{ padding: "1.25rem" }}>
              <div className="text-section-heading" style={{ marginBottom: "0.875rem" }}>
                Transaction Source
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {(["legitimate", "fraud", "custom"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`btn btn-sm ${mode === m ? "btn-primary" : "btn-secondary"}`}
                    style={{
                      ...(m === "fraud" && mode !== m
                        ? { borderColor: "var(--color-risk-high-border)", color: "var(--color-risk-high)" }
                        : {}),
                      ...(m === "fraud" && mode === m
                        ? { backgroundColor: "var(--color-risk-high)" }
                        : {}),
                    }}
                  >
                    {m === "legitimate" && "Load Legitimate Sample"}
                    {m === "fraud" && "Load Fraud Sample"}
                    {m === "custom" && "Custom Transaction"}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: "0.75rem", fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
                {samplesError
                  ? "Could not load samples from backend — use Custom mode"
                  : "Sample transactions are real examples from the held-out test set"}
              </div>
            </div>

            {/* Transaction preview */}
            {mode !== "custom" && selectedSample && (
              <div className="card" style={{ padding: "1.25rem" }}>
                <div className="text-section-heading" style={{ marginBottom: "0.875rem" }}>
                  Transaction Preview
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <DataField label="Amount" value={`$${selectedSample.Amount.toFixed(2)}`} />
                  <DataField label="Time" value={`${selectedSample.Time.toFixed(0)}s`} />
                  <DataField label="Features" value="V1 – V28 (30 total)" />
                  <DataField label="Source" value={`Real ${mode} sample`} />
                </div>
                <div
                  style={{
                    marginTop: "0.875rem",
                    padding: "0.625rem 0.875rem",
                    backgroundColor: "var(--color-surface-2)",
                    borderRadius: "4px",
                    fontSize: "0.8125rem",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  V1–V28 are anonymized PCA-transformed features from the original dataset.
                  Ground truth label: <strong>{mode === "fraud" ? "FRAUD" : "LEGITIMATE"}</strong>
                </div>
              </div>
            )}

            {/* Custom form */}
            {mode === "custom" && (
              <div className="card" style={{ padding: "1.25rem" }}>
                <div className="text-section-heading" style={{ marginBottom: "0.875rem" }}>
                  Transaction Input
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <FormField
                      label="Time (seconds)"
                      placeholder="e.g. 406"
                      value={customForm.Time?.toString() ?? ""}
                      onChange={(v) => setCustomForm((f) => ({ ...f, Time: parseFloat(v) || 0 }))}
                    />
                    <FormField
                      label="Amount ($)"
                      placeholder="e.g. 149.62"
                      value={customForm.Amount?.toString() ?? ""}
                      onChange={(v) => setCustomForm((f) => ({ ...f, Amount: parseFloat(v) || 0 }))}
                    />
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", marginTop: "0.25rem" }}>
                    V1 – V28 (anonymized features)
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: "0.5rem",
                    }}
                  >
                    {Array.from({ length: 28 }, (_, i) => {
                      const key = `V${i + 1}` as keyof TransactionInput;
                      return (
                        <FormField
                          key={key}
                          label={`V${i + 1}`}
                          placeholder="0.0"
                          value={(customForm[key] as number | undefined)?.toString() ?? ""}
                          onChange={(v) =>
                            setCustomForm((f) => ({ ...f, [key]: parseFloat(v) || 0 }))
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Analyze button */}
            <button
              className="btn btn-primary btn-lg"
              onClick={handleAnalyze}
              disabled={stage === "analyzing" || (!selectedSample && mode !== "custom")}
              style={{ width: "100%" }}
            >
              {stage === "analyzing" ? (
                <>
                  <span
                    style={{
                      display: "inline-block",
                      width: "16px",
                      height: "16px",
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: "white",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                  Analyzing...
                </>
              ) : (
                "Analyze Transaction"
              )}
            </button>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>

          {/* Right: Result panel */}
          <div ref={resultRef}>
            <AnimatePresence mode="wait">
              {stage === "idle" && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="card"
                  style={{
                    padding: "2.5rem",
                    textAlign: "center",
                    color: "var(--color-text-tertiary)",
                  }}
                >
                  <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>
                    <svg
                      width="48"
                      height="48"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--color-border-strong)"
                      strokeWidth="1.5"
                      style={{ margin: "0 auto" }}
                    >
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" />
                    </svg>
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: "0.5rem", color: "var(--color-text-secondary)" }}>
                    Ready to analyze
                  </div>
                  <div style={{ fontSize: "0.875rem" }}>
                    Select a transaction source and click Analyze Transaction
                  </div>
                </motion.div>
              )}

              {stage === "loaded" && (
                <motion.div
                  key="loaded"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="card"
                  style={{ padding: "2rem", textAlign: "center" }}
                >
                  <div style={{ fontWeight: 600, fontSize: "1rem", marginBottom: "0.5rem" }}>
                    Transaction ready
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
                    Click Analyze Transaction to run the model
                  </div>
                </motion.div>
              )}

              {stage === "analyzing" && (
                <motion.div
                  key="analyzing"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="card"
                  style={{ padding: "2rem" }}
                >
                  <div className="text-section-heading" style={{ marginBottom: "1.25rem" }}>
                    Processing
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                    {STEPS.map((s, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.875rem",
                          opacity: i <= step ? 1 : 0.35,
                          transition: "opacity 0.3s ease",
                        }}
                      >
                        <div
                          style={{
                            width: "20px",
                            height: "20px",
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            backgroundColor:
                              i < step
                                ? "var(--color-risk-low)"
                                : i === step
                                ? "var(--color-text-primary)"
                                : "var(--color-border)",
                          }}
                        >
                          {i < step ? (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : i === step ? (
                            <div
                              style={{
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                backgroundColor: "white",
                              }}
                            />
                          ) : null}
                        </div>
                        <div
                          style={{
                            fontSize: "0.9rem",
                            color: i <= step ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                            fontWeight: i === step ? 600 : 400,
                          }}
                        >
                          {s}
                        </div>
                      </div>
                    ))}
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
                <ResultPanel result={result} mode={mode} />
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}

function ResultPanel({ result, mode }: { result: ExplainResponse; mode: Mode }) {
  const prob = result.fraud_probability * 100;
  const threshold = result.threshold * 100;
  const isFraud = result.prediction === "FRAUD";

  const riskColor =
    result.risk_level === "HIGH"
      ? "var(--color-risk-high)"
      : result.risk_level === "REVIEW"
      ? "var(--color-risk-review)"
      : "var(--color-risk-low)";

  const contributions = result.top_contributions.slice(0, 8);
  const maxAbs = Math.max(...contributions.map((c) => Math.abs(c.contribution)));

  const containerAnim = {
    hidden: {},
    show: { transition: { staggerChildren: 0.07 } },
  };
  const itemAnim = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  return (
    <motion.div
      variants={containerAnim}
      initial="hidden"
      animate="show"
      style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      {/* Primary result card */}
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
              Risk Assessment
            </div>
            <RiskBadge level={result.risk_level} size="lg" />
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: "3rem",
                fontWeight: 800,
                color: riskColor,
                letterSpacing: "-0.04em",
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {prob.toFixed(2)}%
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", marginTop: "0.25rem" }}>
              Fraud probability
            </div>
          </div>
        </div>

        {/* Probability scale */}
        <div style={{ marginBottom: "1.25rem" }}>
          <div style={{ position: "relative", height: "8px", borderRadius: "4px", backgroundColor: "var(--color-border)", marginBottom: "0.375rem" }}>
            {/* Threshold marker */}
            <div
              style={{
                position: "absolute",
                left: `${threshold}%`,
                top: "-4px",
                bottom: "-4px",
                width: "2px",
                backgroundColor: "var(--color-text-secondary)",
                borderRadius: "1px",
                zIndex: 2,
              }}
            />
            {/* Probability fill */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: `${Math.min(prob, 100)}%`,
                backgroundColor: riskColor,
                borderRadius: "4px",
                opacity: 0.8,
                transition: "width 0.6s ease",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.75rem",
              color: "var(--color-text-tertiary)",
            }}
          >
            <span>0%</span>
            <span style={{ color: "var(--color-text-secondary)" }}>
              Threshold: {threshold.toFixed(0)}%
            </span>
            <span>100%</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
          <DataField label="Prediction" value={result.prediction} valueColor={isFraud ? "var(--color-risk-high)" : "var(--color-risk-low)"} />
          <DataField label="Threshold" value={`${threshold.toFixed(0)}%`} mono />
          <DataField label="Model" value={result.model_name} mono />
        </div>
      </motion.div>

      {/* SHAP explanation */}
      <motion.div variants={itemAnim} className="card" style={{ padding: "1.5rem" }}>
        <div className="text-section-heading" style={{ marginBottom: "0.25rem" }}>
          Model Evidence
        </div>
        <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", marginBottom: "1.125rem" }}>
          Top features contributing to this prediction
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {contributions.map((c, i) => {
            const barWidth = maxAbs > 0 ? Math.abs(c.contribution) / maxAbs : 0;
            const isFraudDir = c.direction === "fraud";
            const barColor = isFraudDir ? "var(--color-risk-high)" : "var(--color-risk-low)";

            return (
              <div key={i}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.25rem",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      color: "var(--color-text-primary)",
                      minWidth: "64px",
                    }}
                  >
                    {c.feature}
                  </span>
                  <span
                    style={{
                      fontSize: "0.8125rem",
                      fontFamily: "var(--font-mono)",
                      color: barColor,
                      fontWeight: 600,
                    }}
                  >
                    {c.contribution > 0 ? "+" : ""}{c.contribution.toFixed(3)}
                  </span>
                </div>
                <div
                  style={{
                    height: "6px",
                    backgroundColor: "var(--color-border)",
                    borderRadius: "3px",
                    overflow: "hidden",
                  }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${barWidth * 100}%` }}
                    transition={{ duration: 0.5, delay: i * 0.05 }}
                    style={{
                      height: "100%",
                      backgroundColor: barColor,
                      borderRadius: "3px",
                      opacity: 0.85,
                    }}
                  />
                </div>
                <div style={{ fontSize: "0.6875rem", color: "var(--color-text-tertiary)", marginTop: "0.1875rem" }}>
                  Pushing{" "}
                  <span style={{ color: barColor, fontWeight: 600 }}>
                    {isFraudDir ? "toward fraud" : "away from fraud"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: "1rem",
            padding: "0.625rem 0.875rem",
            backgroundColor: "var(--color-surface-2)",
            borderRadius: "4px",
            fontSize: "0.75rem",
            color: "var(--color-text-secondary)",
            fontStyle: "italic",
          }}
        >
          {result.disclaimer}
        </div>
      </motion.div>

      {/* Model metadata */}
      <motion.div
        variants={itemAnim}
        style={{
          fontSize: "0.8125rem",
          color: "var(--color-text-tertiary)",
          textAlign: "center",
          fontFamily: "var(--font-mono)",
        }}
      >
        {result.model_name} · {result.model_version} · Threshold: {threshold.toFixed(0)}%
      </motion.div>
    </motion.div>
  );
}

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
      <div
        style={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          color: "var(--color-text-tertiary)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          marginBottom: "0.25rem",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "0.9375rem",
          fontWeight: 600,
          color: valueColor || "var(--color-text-primary)",
          fontFamily: mono ? "var(--font-mono)" : undefined,
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
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="input-label">{label}</label>
      <input
        type="number"
        step="any"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input"
        style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem" }}
      />
    </div>
  );
}
