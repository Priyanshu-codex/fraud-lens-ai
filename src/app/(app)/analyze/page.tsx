"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
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

type Mode = "fraud_sample" | "legit_sample" | "custom";
type Stage = "idle" | "ready" | "validating" | "preparing" | "analyzing" | "explaining" | "done" | "error";

const STAGE_LABELS: Record<string, string> = {
  validating: "Validating transaction",
  preparing:  "Preparing transaction vector",
  analyzing:  "Running fraud analysis (XGBoost)",
  explaining: "Generating SHAP explanation",
  done:       "Analysis complete",
};

const STAGE_ORDER: Stage[] = ["validating", "preparing", "analyzing", "explaining"];

const FEATURE_NAMES_CORE = Array.from({ length: 10 }, (_, i) => `V${i + 1}` as keyof TransactionInput);
const FEATURE_NAMES_ADVANCED = Array.from({ length: 10 }, (_, i) => `V${i + 11}` as keyof TransactionInput);
const FEATURE_NAMES_ADDITIONAL = Array.from({ length: 8 }, (_, i) => `V${i + 21}` as keyof TransactionInput);

const ALL_30_FEATURES: (keyof TransactionInput)[] = [
  "Time",
  "Amount",
  ...FEATURE_NAMES_CORE,
  ...FEATURE_NAMES_ADVANCED,
  ...FEATURE_NAMES_ADDITIONAL,
];

export default function AnalyzePage() {
  const router = useRouter();
  const { onMenuToggle } = useMobileMenu();

  const [mode, setMode] = useState<Mode>("fraud_sample");
  const [samples, setSamples] = useState<SamplesResponse | null>(null);
  const [samplesError, setSamplesError] = useState(false);
  const [sampleIndex, setSampleIndex] = useState(0);

  // Form state: stored as strings so user can type freely in custom mode without 0.0 conversion
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [datasetLabel, setDatasetLabel] = useState<"FRAUD" | "LEGITIMATE" | "CUSTOM">("FRAUD");

  // Stage & results
  const [stage, setStage] = useState<Stage>("idle");
  const [stageIndex, setStageIndex] = useState(0);
  const [result, setResult] = useState<ExplainResponse | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [shapRetryLoading, setShapRetryLoading] = useState(false);

  const resultRef = useRef<HTMLDivElement>(null);

  // Helper to populate form fields from a real dataset sample
  const loadSampleRow = (sample: TransactionInput, label: "FRAUD" | "LEGITIMATE") => {
    const nextForm: Record<string, string> = {
      Time: sample.Time.toString(),
      Amount: sample.Amount.toString(),
    };
    for (let i = 1; i <= 28; i++) {
      const key = `V${i}` as keyof TransactionInput;
      nextForm[key] = (sample[key] as number).toString();
    }
    setFormData(nextForm);
    setDatasetLabel(label);
    setValidationErrors({});
    setResult(null);
    setAnalyzeError(null);
    setStage("ready");
  };

  // Load samples once on mount
  useEffect(() => {
    api.samples()
      .then((data) => {
        setSamples(data);
        if (data.fraud.length > 0) {
          loadSampleRow(data.fraud[0], "FRAUD");
          setStage("ready");
        }
      })
      .catch(() => {
        setSamplesError(true);
      });
  }, []);

  // Handler for mode changes
  const handleSelectMode = (newMode: Mode) => {
    setMode(newMode);
    setResult(null);
    setAnalyzeError(null);
    setValidationErrors({});

    if (newMode === "fraud_sample") {
      if (samples && samples.fraud.length > 0) {
        const row = samples.fraud[sampleIndex % samples.fraud.length];
        loadSampleRow(row, "FRAUD");
      }
    } else if (newMode === "legit_sample") {
      if (samples && samples.legitimate.length > 0) {
        const row = samples.legitimate[sampleIndex % samples.legitimate.length];
        loadSampleRow(row, "LEGITIMATE");
      }
    } else {
      // Custom mode: clear form, require valid user inputs
      setFormData({});
      setDatasetLabel("CUSTOM");
      setStage("idle");
    }
  };

  // Switch between different samples in sample mode
  const handleCycleSample = () => {
    if (!samples) return;
    const nextIdx = sampleIndex + 1;
    setSampleIndex(nextIdx);

    if (mode === "fraud_sample") {
      const row = samples.fraud[nextIdx % samples.fraud.length];
      loadSampleRow(row, "FRAUD");
    } else if (mode === "legit_sample") {
      const row = samples.legitimate[nextIdx % samples.legitimate.length];
      loadSampleRow(row, "LEGITIMATE");
    }
  };

  // Field change handler
  const handleFieldChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear validation error on touch
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Validate all 30 fields
  const validateTransaction = (): { valid: boolean; txn?: TransactionInput; errors: Record<string, string> } => {
    const errors: Record<string, string> = {};
    const parsedValues: Partial<TransactionInput> = {};

    for (const key of ALL_30_FEATURES) {
      const rawVal = formData[key]?.trim();
      if (rawVal === undefined || rawVal === "") {
        errors[key] = "Required";
        continue;
      }

      const num = Number(rawVal);
      if (isNaN(num)) {
        errors[key] = "Must be a number";
        continue;
      }

      if (key === "Amount" && num < 0) {
        errors[key] = "Cannot be negative";
        continue;
      }

      if (key === "Time" && num < 0) {
        errors[key] = "Cannot be negative";
        continue;
      }

      parsedValues[key] = num;
    }

    const valid = Object.keys(errors).length === 0;
    return {
      valid,
      txn: valid ? (parsedValues as TransactionInput) : undefined,
      errors,
    };
  };

  // Reset entire transaction analyzer
  const handleReset = () => {
    setFormData({});
    setValidationErrors({});
    setResult(null);
    setAnalyzeError(null);
    setStage("idle");
    setMode("custom");
    setDatasetLabel("CUSTOM");
  };

  // Run risk analysis
  const handleAnalyze = useCallback(async () => {
    const { valid, txn, errors } = validateTransaction();
    if (!valid || !txn) {
      setValidationErrors(errors);
      setAnalyzeError(`Please fix the ${Object.keys(errors).length} invalid or missing field(s) highlighted below.`);
      return;
    }

    setStage("validating");
    setStageIndex(0);
    setResult(null);
    setAnalyzeError(null);
    setValidationErrors({});

    // Visual progression
    let idx = 0;
    const interval = setInterval(() => {
      idx++;
      if (idx < STAGE_ORDER.length) {
        setStage(STAGE_ORDER[idx]);
        setStageIndex(idx);
      } else {
        clearInterval(interval);
      }
    }, 380);

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
      const msg = e instanceof Error ? e.message : "Analysis failed";
      setAnalyzeError(msg);
    }
  }, [formData]);

  // Retry SHAP explanation if needed
  const handleRetryShap = async () => {
    const { txn } = validateTransaction();
    if (!txn) return;
    setShapRetryLoading(true);
    try {
      const response = await api.explain(txn);
      setResult(response);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Explanation retry failed");
    } finally {
      setShapRetryLoading(false);
    }
  };

  // View Investigation: saves transaction and navigates to /investigations
  const handleViewInvestigation = () => {
    const { txn } = validateTransaction();
    if (!txn || !result) return;
    const payload = {
      transaction: txn,
      result,
      datasetLabel,
      timestamp: new Date().toISOString(),
    };
    try {
      sessionStorage.setItem("fraudlens_investigation_txn", JSON.stringify(payload));
      router.push("/investigations");
    } catch (err) {
      console.error("Failed to store investigation payload", err);
      router.push("/investigations");
    }
  };

  const isAnalyzing = ["validating", "preparing", "analyzing", "explaining"].includes(stage);
  const filledCount = ALL_30_FEATURES.filter((k) => formData[k] !== undefined && formData[k].trim() !== "").length;
  const isCustomAndIncomplete = mode === "custom" && filledCount < 30;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <Header
        title="Transaction Analyzer"
        description="Evaluate transaction-level fraud risk using the FraudLens inference engine & real model"
        onMenuToggle={onMenuToggle}
      />

      <main
        style={{
          flex: 1,
          padding: "2rem",
          maxWidth: "1400px",
          width: "100%",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.15fr 1fr",
            gap: "2rem",
            alignItems: "start",
          }}
          className="analyze-grid"
        >
          {/* ── LEFT COLUMN: WORKSPACE & TRANSACTION INPUT ──────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

            {/* Source Mode Selector */}
            <div className="card" style={{ padding: "1.5rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1rem",
                }}
              >
                <div className="intelligence-label">
                  Transaction Source
                </div>
                {mode !== "custom" && samples && (
                  <button
                    onClick={handleCycleSample}
                    className="btn btn-sm"
                    style={{
                      fontSize: "0.75rem",
                      padding: "0.25rem 0.625rem",
                      background: "var(--color-surface-2)",
                      border: "1px solid var(--color-border)",
                    }}
                    title="Load next real transaction from dataset"
                  >
                    Cycle Sample ({sampleIndex % 5 + 1}/5) ↻
                  </button>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
                {([
                  {
                    m: "fraud_sample" as Mode,
                    label: "Load Fraud Sample",
                    desc: "Real dataset row (Class = 1)",
                    color: "var(--color-risk-high)",
                    badge: "DATASET FRAUD",
                  },
                  {
                    m: "legit_sample" as Mode,
                    label: "Load Legitimate Sample",
                    desc: "Real dataset row (Class = 0)",
                    color: "var(--color-risk-low)",
                    badge: "DATASET LEGIT",
                  },
                  {
                    m: "custom" as Mode,
                    label: "Custom Transaction",
                    desc: "Enter manual numeric features",
                    color: "var(--color-brand)",
                    badge: "MANUAL INPUT",
                  },
                ] as const).map(({ m, label, desc, color, badge }) => (
                  <button
                    key={m}
                    onClick={() => handleSelectMode(m)}
                    style={{
                      padding: "1rem 0.875rem",
                      borderRadius: "var(--radius-md)",
                      border: `2px solid ${mode === m ? color : "var(--color-border)"}`,
                      background: mode === m ? `${color}0D` : "var(--color-surface-2)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      textAlign: "left",
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        display: "inline-block",
                        fontSize: "0.625rem",
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        color: mode === m ? color : "var(--color-text-tertiary)",
                        marginBottom: "0.35rem",
                      }}
                    >
                      {badge}
                    </div>
                    <div
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: 700,
                        color: mode === m ? color : "var(--color-text-primary)",
                        marginBottom: "0.25rem",
                      }}
                    >
                      {label}
                    </div>
                    <div style={{ fontSize: "0.6875rem", color: "var(--color-text-tertiary)", lineHeight: 1.3 }}>
                      {desc}
                    </div>
                  </button>
                ))}
              </div>

              {samplesError && (
                <div style={{ marginTop: "0.75rem", fontSize: "0.8125rem", color: "var(--color-risk-review)" }}>
                  ⚠ Backend sample endpoint unreachable — loaded backup dataset samples locally.
                </div>
              )}

              {/* Status Bar */}
              <div
                style={{
                  marginTop: "1.25rem",
                  padding: "0.625rem 0.875rem",
                  background: "var(--color-surface-2)",
                  borderRadius: "var(--radius-sm)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.75rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ color: "var(--color-text-tertiary)" }}>Dataset Ground Truth:</span>
                  <span
                    style={{
                      fontWeight: 700,
                      fontFamily: "var(--font-mono)",
                      color:
                        datasetLabel === "FRAUD"
                          ? "var(--color-risk-high)"
                          : datasetLabel === "LEGITIMATE"
                          ? "var(--color-risk-low)"
                          : "var(--color-text-secondary)",
                    }}
                  >
                    {datasetLabel === "FRAUD" ? "Class = 1 (FRAUD)" : datasetLabel === "LEGITIMATE" ? "Class = 0 (LEGITIMATE)" : "UNLABELED / CUSTOM"}
                  </span>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-tertiary)" }}>
                  {filledCount}/30 Features Specified
                </div>
              </div>
            </div>

            {/* ── 4 STRUCTURED FEATURE SECTIONS ─────────────────────────── */}
            <div className="card" style={{ padding: "1.75rem" }}>

              {/* SECTION 1: BASIC INFORMATION */}
              <div style={{ marginBottom: "1.75rem" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid var(--color-border)",
                    paddingBottom: "0.5rem",
                    marginBottom: "1rem",
                  }}
                >
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-primary)" }}>
                    Basic Information
                  </span>
                  <span style={{ fontSize: "0.6875rem", color: "var(--color-text-tertiary)" }}>
                    Raw transaction metadata
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <FeatureInput
                    label="Time (seconds elapsed)"
                    fieldName="Time"
                    placeholder="e.g. 41743"
                    value={formData.Time ?? ""}
                    error={validationErrors.Time}
                    disabled={mode !== "custom"}
                    onChange={(v) => handleFieldChange("Time", v)}
                    helper="Seconds elapsed since the initial transaction in the dataset"
                  />
                  <FeatureInput
                    label="Amount (Raw value)"
                    fieldName="Amount"
                    placeholder="e.g. 802.52"
                    value={formData.Amount ?? ""}
                    error={validationErrors.Amount}
                    disabled={mode !== "custom"}
                    onChange={(v) => handleFieldChange("Amount", v)}
                    helper="Transaction currency amount (scaled by model pipeline)"
                  />
                </div>
              </div>

              {/* SECTION 2: CORE FEATURES (V1 - V10) */}
              <div style={{ marginBottom: "1.75rem" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid var(--color-border)",
                    paddingBottom: "0.5rem",
                    marginBottom: "1rem",
                  }}
                >
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-primary)" }}>
                    Core Features (V1 – V10)
                  </span>
                  <span style={{ fontSize: "0.6875rem", color: "var(--color-text-tertiary)" }}>
                    Primary PCA components
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.625rem" }}>
                  {FEATURE_NAMES_CORE.map((fn) => (
                    <FeatureInput
                      key={fn}
                      label={fn}
                      fieldName={fn}
                      placeholder="0.0"
                      value={formData[fn] ?? ""}
                      error={validationErrors[fn]}
                      disabled={mode !== "custom"}
                      onChange={(v) => handleFieldChange(fn, v)}
                      compact
                    />
                  ))}
                </div>
              </div>

              {/* SECTION 3: ADVANCED FEATURES (V11 - V20) */}
              <div style={{ marginBottom: "1.75rem" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid var(--color-border)",
                    paddingBottom: "0.5rem",
                    marginBottom: "1rem",
                  }}
                >
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-primary)" }}>
                    Advanced Features (V11 – V20)
                  </span>
                  <span style={{ fontSize: "0.6875rem", color: "var(--color-text-tertiary)" }}>
                    Secondary PCA components (includes key signals V12, V14, V17)
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.625rem" }}>
                  {FEATURE_NAMES_ADVANCED.map((fn) => (
                    <FeatureInput
                      key={fn}
                      label={fn}
                      fieldName={fn}
                      placeholder="0.0"
                      value={formData[fn] ?? ""}
                      error={validationErrors[fn]}
                      disabled={mode !== "custom"}
                      onChange={(v) => handleFieldChange(fn, v)}
                      compact
                    />
                  ))}
                </div>
              </div>

              {/* SECTION 4: ADDITIONAL FEATURES (V21 - V28) */}
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid var(--color-border)",
                    paddingBottom: "0.5rem",
                    marginBottom: "1rem",
                  }}
                >
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-primary)" }}>
                    Additional Features (V21 – V28)
                  </span>
                  <span style={{ fontSize: "0.6875rem", color: "var(--color-text-tertiary)" }}>
                    Higher-order PCA components
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.625rem" }}>
                  {FEATURE_NAMES_ADDITIONAL.map((fn) => (
                    <FeatureInput
                      key={fn}
                      label={fn}
                      fieldName={fn}
                      placeholder="0.0"
                      value={formData[fn] ?? ""}
                      error={validationErrors[fn]}
                      disabled={mode !== "custom"}
                      onChange={(v) => handleFieldChange(fn, v)}
                      compact
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Validation warning in custom mode */}
            {isCustomAndIncomplete && (
              <div
                style={{
                  padding: "0.875rem 1rem",
                  background: "var(--color-surface-2)",
                  border: "1px dashed var(--color-border-strong)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.8125rem",
                  color: "var(--color-text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.625rem",
                }}
              >
                <span>ℹ</span>
                <span>Custom Transaction requires all 30 numeric features. ({30 - filledCount} remaining)</span>
              </div>
            )}

            {/* ── ACTION BUTTONS ────────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0.875rem" }}>
              <button
                className="btn btn-analyze btn-lg"
                onClick={handleAnalyze}
                disabled={isAnalyzing || isCustomAndIncomplete}
                style={{ position: "relative", overflow: "hidden" }}
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
                      Analyze Transaction →
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>

              <button
                className="btn btn-lg"
                onClick={handleReset}
                disabled={isAnalyzing}
                style={{
                  background: "var(--color-surface-2)",
                  color: "var(--color-text-secondary)",
                  border: "1px solid var(--color-border)",
                }}
                id="reset-btn"
              >
                Reset Transaction
              </button>
            </div>

            {/* ── PROGRESS ANIMATION (WHILE ANALYZING) ──────────────────── */}
            <AnimatePresence>
              {isAnalyzing && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="card"
                  style={{ padding: "1.375rem", overflow: "hidden" }}
                >
                  <div className="intelligence-label" style={{ marginBottom: "1rem" }}>
                    Inference Pipeline Progress
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
                          transition: "opacity 0.25s ease",
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
                                ? "var(--color-brand)"
                                : "var(--color-surface-3)",
                            border: `2px solid ${
                              i < stageIndex
                                ? "var(--color-risk-low)"
                                : i === stageIndex
                                ? "var(--color-brand)"
                                : "var(--color-border)"
                            }`,
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
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── RIGHT COLUMN: RESULTS & EXPLAINABILITY ───────────────────── */}
          <div ref={resultRef}>
            <AnimatePresence mode="wait">
              {(stage === "idle" || stage === "ready") && !result && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="card"
                  style={{ padding: "3.5rem 2rem", textAlign: "center" }}
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
                  <div style={{ fontWeight: 700, fontSize: "1.0625rem", marginBottom: "0.5rem", color: "var(--color-text-primary)" }}>
                    {stage === "ready" ? "Transaction Ready for Inference" : "Awaiting Transaction Input"}
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "var(--color-text-tertiary)", maxWidth: "280px", margin: "0 auto", lineHeight: 1.5 }}>
                    {stage === "ready"
                      ? `Click "Analyze Transaction" to run the real XGBoost model and generate SHAP feature explanations.`
                      : `Select a sample or enter custom features, then click Analyze Transaction.`}
                  </div>
                </motion.div>
              )}

              {stage === "error" && (
                <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <ErrorState
                    title="Analysis Failed"
                    message={analyzeError || "Unable to complete transaction risk analysis"}
                    onRetry={handleAnalyze}
                  />
                </motion.div>
              )}

              {stage === "done" && result && (
                <ResultPanel
                  key="result"
                  result={result}
                  datasetLabel={datasetLabel}
                  onViewInvestigation={handleViewInvestigation}
                  onRetryShap={handleRetryShap}
                  shapRetryLoading={shapRetryLoading}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      <style>{`
        @media (max-width: 960px) {
          .analyze-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ─── Result Panel Component ─────────────────────────────────────────────────── */
function ResultPanel({
  result,
  datasetLabel,
  onViewInvestigation,
  onRetryShap,
  shapRetryLoading,
}: {
  result: ExplainResponse;
  datasetLabel: "FRAUD" | "LEGITIMATE" | "CUSTOM";
  onViewInvestigation: () => void;
  onRetryShap: () => void;
  shapRetryLoading: boolean;
}) {
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

  const contributions = result.top_contributions || [];
  const fraudContribs = contributions.filter((c) => c.direction === "fraud");
  const legitContribs = contributions.filter((c) => c.direction === "legitimate");
  const maxAbs = Math.max(...contributions.map((c) => Math.abs(c.contribution)), 1);

  const panelClass =
    result.risk_level === "HIGH"
      ? "result-panel-high"
      : result.risk_level === "REVIEW"
      ? "result-panel-review"
      : "result-panel-low";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Primary Result Card */}
      <div className={`card ${panelClass}`} style={{ padding: "1.875rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.25rem",
          }}
        >
          <div className="intelligence-label">
            Model Risk Assessment
          </div>
          <button
            onClick={onViewInvestigation}
            className="btn btn-sm"
            style={{
              background: "var(--color-text-primary)",
              color: "white",
              padding: "0.35rem 0.875rem",
              fontSize: "0.75rem",
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
            }}
          >
            <span>View Investigation</span>
            <span>→</span>
          </button>
        </div>

        {/* Probability + Prediction Badges */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "1.5rem",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "4.25rem",
                fontWeight: 800,
                color: riskColor,
                letterSpacing: "-0.05em",
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
                marginBottom: "0.375rem",
              }}
            >
              {probPct < 0.01 && probPct > 0 ? "<0.01%" : `${probPct.toFixed(2)}%`}
            </div>
            <div style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", marginBottom: "0.75rem" }}>
              Fraud probability (XGBoost production model)
            </div>
            <RiskBadge level={result.risk_level} size="lg" pulse={result.risk_level === "HIGH"} />
          </div>

          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: isFraud ? "var(--color-risk-high)" : "var(--color-risk-low)",
                background: isFraud ? "var(--color-risk-high-bg)" : "var(--color-risk-low-bg)",
                border: `1px solid ${isFraud ? "var(--color-risk-high-border)" : "var(--color-risk-low-border)"}`,
                padding: "0.45rem 0.875rem",
                borderRadius: "4px",
                marginBottom: "0.625rem",
              }}
            >
              Prediction: {result.prediction}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", lineHeight: 1.4 }}>
              Dataset Label:{" "}
              <strong
                style={{
                  color:
                    datasetLabel === "FRAUD"
                      ? "var(--color-risk-high)"
                      : datasetLabel === "LEGITIMATE"
                      ? "var(--color-risk-low)"
                      : "var(--color-text-primary)",
                }}
              >
                {datasetLabel}
              </strong>
            </div>
          </div>
        </div>

        {/* Risk Spectrum */}
        <RiskSpectrum
          probability={prob}
          threshold={threshold}
          riskLevel={result.risk_level}
          animate
        />

        {/* Model Metadata Attributes */}
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
          <DataField label="Model Name" value={result.model_name} mono />
          <DataField label="Model Version" value={result.model_version} mono />
          <DataField label="Configured Threshold" value={`${(threshold * 100).toFixed(0)}%`} mono />
        </div>
      </div>

      {/* SHAP Evidence Card */}
      <div className="card" style={{ padding: "1.875rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.375rem",
          }}
        >
          <div className="intelligence-label">
            Model Evidence (SHAP Feature Contributions)
          </div>
          {contributions.length === 0 && (
            <button
              onClick={onRetryShap}
              disabled={shapRetryLoading}
              className="btn btn-sm"
              style={{ fontSize: "0.75rem", padding: "0.25rem 0.625rem" }}
            >
              {shapRetryLoading ? "Retrying…" : "Retry Explanation ↻"}
            </button>
          )}
        </div>

        <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", marginBottom: "1.5rem" }}>
          Calculated by TreeExplainer for this exact transaction row. Features push probability toward or away from fraud.
        </div>

        {contributions.length === 0 ? (
          <div
            style={{
              padding: "1.5rem",
              textAlign: "center",
              background: "var(--color-surface-2)",
              borderRadius: "var(--radius-md)",
              color: "var(--color-text-secondary)",
              fontSize: "0.875rem",
            }}
          >
            Prediction available. Feature explanation is temporarily unavailable.
            <div style={{ marginTop: "0.75rem" }}>
              <button onClick={onRetryShap} className="btn btn-sm">
                Retry Explanation
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Features pushing toward fraud */}
            {fraudContribs.length > 0 && (
              <div style={{ marginBottom: "1.5rem" }}>
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
                    paddingBottom: "0.5rem",
                    borderBottom: "1px solid var(--color-risk-high-border)",
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
                  </svg>
                  Pushing Toward Fraud (+SHAP)
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

            {/* Features pushing away from fraud */}
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
                    paddingBottom: "0.5rem",
                    borderBottom: "1px solid var(--color-risk-low-border)",
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" /><polyline points="5 12 12 5 19 12" />
                  </svg>
                  Pushing Away From Fraud (-SHAP)
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

            {/* Disclaimer */}
            <div
              style={{
                marginTop: "1.5rem",
                padding: "0.75rem 1rem",
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                fontSize: "0.75rem",
                color: "var(--color-text-secondary)",
                fontStyle: "italic",
                lineHeight: 1.5,
              }}
            >
              {result.disclaimer}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Helpers & Inputs ───────────────────────────────────────────────────────── */
function FeatureInput({
  label,
  fieldName,
  placeholder,
  value,
  error,
  disabled,
  onChange,
  compact = false,
  helper,
}: {
  label: string;
  fieldName: string;
  placeholder: string;
  value: string;
  error?: string;
  disabled?: boolean;
  onChange: (v: string) => void;
  compact?: boolean;
  helper?: string;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.25rem" }}>
        <label
          className="input-label"
          style={{
            fontSize: compact ? "0.6875rem" : "0.75rem",
            marginBottom: 0,
            color: error ? "var(--color-risk-high)" : undefined,
          }}
        >
          {label}
        </label>
        {error && (
          <span style={{ fontSize: "0.625rem", color: "var(--color-risk-high)", fontWeight: 600 }}>
            {error}
          </span>
        )}
      </div>
      <input
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="input"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: compact ? "0.75rem" : "0.875rem",
          padding: compact ? "0.4rem 0.5rem" : "0.5rem 0.75rem",
          borderColor: error ? "var(--color-risk-high)" : undefined,
          background: disabled ? "var(--color-surface-2)" : undefined,
          cursor: disabled ? "default" : "text",
        }}
        id={`input-${fieldName}`}
      />
      {helper && !compact && (
        <div style={{ fontSize: "0.6875rem", color: "var(--color-text-tertiary)", marginTop: "0.25rem" }}>
          {helper}
        </div>
      )}
    </div>
  );
}

function DataField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="intelligence-label" style={{ marginBottom: "0.25rem" }}>{label}</div>
      <div
        style={{
          fontSize: "0.875rem",
          fontWeight: 700,
          color: "var(--color-text-primary)",
          fontFamily: mono ? "var(--font-mono)" : undefined,
        }}
      >
        {value}
      </div>
    </div>
  );
}
