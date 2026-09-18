"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { useMobileMenu } from "@/app/(app)/layout";
import { ErrorState } from "@/components/ui/ErrorState";
import { MetricSkeleton } from "@/components/ui/Skeleton";
import { api, type AnalyticsResponse, type ModelInfoResponse } from "@/lib/api";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend,
} from "recharts";

export default function ModelPage() {
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [thresholdPreview, setThresholdPreview] = useState<number | null>(null);
  const { onMenuToggle } = useMobileMenu();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, m] = await Promise.all([api.analytics(), api.modelInfo()]);
      setAnalytics(a);
      setModelInfo(m);
      setThresholdPreview(m.threshold);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load model data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const containerAnim: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.09 } } };
  const itemAnim: Variants = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <Header
        title="Model Intelligence"
        description="Candidate comparison, threshold analysis, and test-set performance metrics"
        onMenuToggle={onMenuToggle}
      />
      <main style={{ flex: 1, padding: "2rem", maxWidth: "1400px", width: "100%" }}>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState title="Could not load model intelligence" message={error} onRetry={fetchData} />
        ) : analytics && modelInfo ? (
          <motion.div
            variants={containerAnim}
            initial="hidden"
            animate="show"
            style={{ display: "flex", flexDirection: "column", gap: "2rem" }}
          >
            {/* ── Model comparison table ──────────────────────────────────── */}
            <motion.div variants={itemAnim}>
              <div className="intelligence-label" style={{ marginBottom: "1rem" }}>
                Model Comparison — Validation Set
              </div>
              <div className="card" style={{ overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Model</th>
                        <th>
                          <span style={{ color: "var(--color-brand)" }}>PR-AUC ▾</span>
                        </th>
                        <th>ROC-AUC</th>
                        <th>F1</th>
                        <th>Precision</th>
                        <th>Recall</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.model_comparison.map((m) => {
                        const isSelected = m.model === modelInfo.model_name;
                        return (
                          <tr key={m.model} className={isSelected ? "row-selected" : ""}>
                            <td>
                              <div
                                style={{
                                  fontWeight: isSelected ? 700 : 500,
                                  color: "var(--color-text-primary)",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.5rem",
                                }}
                              >
                                {isSelected && (
                                  <div
                                    style={{
                                      width: "6px",
                                      height: "6px",
                                      borderRadius: "50%",
                                      background: "var(--color-brand)",
                                    }}
                                  />
                                )}
                                {m.model}
                              </div>
                            </td>
                            <td>
                              <MetricCell value={m.pr_auc} highlight={isSelected} />
                            </td>
                            <td><MetricCell value={m.roc_auc} /></td>
                            <td><MetricCell value={m.f1} /></td>
                            <td><MetricCell value={m.precision} /></td>
                            <td><MetricCell value={m.recall} /></td>
                            <td>
                              {isSelected ? (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.375rem",
                                    padding: "0.2rem 0.625rem",
                                    borderRadius: "4px",
                                    fontSize: "0.6875rem",
                                    fontWeight: 700,
                                    color: "var(--color-risk-low)",
                                    backgroundColor: "var(--color-risk-low-bg)",
                                    border: "1px solid var(--color-risk-low-border)",
                                    letterSpacing: "0.05em",
                                    textTransform: "uppercase",
                                  }}
                                >
                                  <div
                                    className="status-dot-live"
                                    style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--color-risk-low)" }}
                                  />
                                  Active
                                </span>
                              ) : (
                                <span style={{ fontSize: "0.8125rem", color: "var(--color-text-tertiary)" }}>
                                  Candidate
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div
                  style={{
                    padding: "0.875rem 1.125rem",
                    background: "var(--color-surface-2)",
                    borderTop: "1px solid var(--color-border)",
                    fontSize: "0.8125rem",
                    color: "var(--color-text-secondary)",
                    lineHeight: 1.6,
                  }}
                >
                  <strong style={{ color: "var(--color-text-primary)" }}>Selection rationale:</strong>{" "}
                  {modelInfo.selection_reason}
                </div>
              </div>
            </motion.div>

            {/* ── Charts row ──────────────────────────────────────────────── */}
            <motion.div
              variants={itemAnim}
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}
              className="model-charts-grid"
            >
              {/* PR Curve */}
              <div className="card" style={{ padding: "1.5rem" }}>
                <div className="intelligence-label" style={{ marginBottom: "0.375rem" }}>
                  Precision–Recall Curve
                </div>
                <div
                  style={{
                    fontSize: "0.8125rem",
                    padding: "0.5rem 0.875rem",
                    background: "var(--color-brand-subtle)",
                    border: "1px solid var(--color-brand-border)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--color-brand)",
                    fontWeight: 600,
                    marginBottom: "1.25rem",
                    display: "inline-block",
                  }}
                >
                  PR-AUC = {(modelInfo.pr_auc * 100).toFixed(2)}% — primary fraud metric
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart
                    data={analytics.threshold_analysis
                      .filter((_, i) => i % 3 === 0)
                      .map((t) => ({
                        recall: +(t.recall * 100).toFixed(1),
                        precision: +(t.precision * 100).toFixed(1),
                      }))}
                  >
                    <XAxis
                      dataKey="recall"
                      label={{ value: "Recall (%)", position: "insideBottom", offset: -2, fontSize: 11, fill: "var(--color-text-tertiary)" }}
                      domain={[0, 100]}
                      tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }}
                      axisLine={false}
                      tickLine={false}
                      label={{ value: "Precision (%)", angle: -90, position: "insideLeft", offset: 12, fontSize: 11, fill: "var(--color-text-tertiary)" }}
                    />
                    <Tooltip
                      formatter={(v: any) => [`${Number(v ?? 0).toFixed(1)}%`, ""]}
                      contentStyle={{ background: "white", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "0.8125rem", boxShadow: "var(--shadow-elevated)" }}
                    />
                    <Line type="monotone" dataKey="precision" stroke="var(--color-chart-1)" strokeWidth={2.5} dot={false} name="Precision" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* F1 across thresholds */}
              <div className="card" style={{ padding: "1.5rem" }}>
                <div className="intelligence-label" style={{ marginBottom: "0.375rem" }}>
                  Threshold Performance
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", marginBottom: "1.25rem" }}>
                  F1, Precision, and Recall across decision thresholds
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={analytics.threshold_analysis.filter((_, i) => i % 2 === 0)}>
                    <XAxis
                      dataKey="threshold"
                      label={{ value: "Threshold", position: "insideBottom", offset: -2, fontSize: 11, fill: "var(--color-text-tertiary)" }}
                      tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                    />
                    <YAxis
                      domain={[0, 1]}
                      tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => v.toFixed(1)}
                    />
                    <Tooltip
                      formatter={(v: any, name: any) => [`${(Number(v ?? 0) * 100).toFixed(1)}%`, String(name ?? "")]}
                      labelFormatter={(v) => `Threshold: ${(Number(v) * 100).toFixed(0)}%`}
                      contentStyle={{ background: "white", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "0.8125rem", boxShadow: "var(--shadow-elevated)" }}
                    />
                    <ReferenceLine
                      x={modelInfo.threshold}
                      stroke="var(--color-brand)"
                      strokeDasharray="5 3"
                      label={{
                        value: `Optimal (${(modelInfo.threshold * 100).toFixed(0)}%)`,
                        fill: "var(--color-brand)",
                        fontSize: 11,
                        position: "insideTopRight",
                        fontWeight: 700,
                      }}
                    />
                    <Legend
                      iconType="line"
                      iconSize={14}
                      formatter={(v) => <span style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>{v}</span>}
                    />
                    <Line type="monotone" dataKey="f1" stroke="var(--color-chart-1)" strokeWidth={2.5} dot={false} name="F1" />
                    <Line type="monotone" dataKey="precision" stroke="var(--color-risk-low)" strokeWidth={1.5} dot={false} name="Precision" strokeDasharray="4 2" />
                    <Line type="monotone" dataKey="recall" stroke="var(--color-risk-high)" strokeWidth={1.5} dot={false} name="Recall" strokeDasharray="4 2" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* ── Threshold Intelligence ──────────────────────────────────── */}
            <motion.div variants={itemAnim} className="card" style={{ padding: "1.75rem" }}>
              <div className="intelligence-label" style={{ marginBottom: "0.375rem" }}>
                Threshold Intelligence
              </div>
              <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", marginBottom: "1.75rem" }}>
                Explore how the decision threshold affects performance on the validation set
              </div>
              {thresholdPreview !== null && (
                <ThresholdExplorer
                  thresholdAnalysis={analytics.threshold_analysis}
                  selectedThreshold={modelInfo.threshold}
                  preview={thresholdPreview}
                  setPreview={setThresholdPreview}
                />
              )}
            </motion.div>

            {/* ── Final test metrics ──────────────────────────────────────── */}
            <motion.div variants={itemAnim}>
              <div className="intelligence-label" style={{ marginBottom: "1rem" }}>
                Final Evaluation — Held-out Test Set
              </div>
              <div className="card" style={{ padding: "1.5rem" }}>
                <div style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", marginBottom: "1.25rem", lineHeight: 1.6 }}>
                  Test set was <strong>not used</strong> during model selection or threshold optimization —
                  these are unbiased performance estimates.
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(5, 1fr)",
                    gap: "1rem",
                  }}
                  className="metrics-grid"
                >
                  {[
                    { label: "Precision", value: modelInfo.precision, note: "Fraud alerts that are real" },
                    { label: "Recall", value: modelInfo.recall, note: "Fraud cases detected" },
                    { label: "F1 Score", value: modelInfo.f1, note: "Precision-recall balance" },
                    { label: "PR-AUC", value: modelInfo.pr_auc, primary: true, note: "Primary fraud metric" },
                    { label: "ROC-AUC", value: modelInfo.roc_auc, note: "Overall discrimination" },
                  ].map((m) => (
                    <div
                      key={m.label}
                      style={{
                        padding: "1.125rem",
                        background: m.primary ? "var(--color-brand-subtle)" : "var(--color-surface-2)",
                        border: `1px solid ${m.primary ? "var(--color-brand-border)" : "var(--color-border)"}`,
                        borderRadius: "var(--radius-lg)",
                        textAlign: "center",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      {m.primary && (
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            height: "3px",
                            background: "var(--color-brand)",
                          }}
                        />
                      )}
                      <div
                        style={{
                          fontSize: "0.6rem",
                          fontWeight: 700,
                          letterSpacing: "0.10em",
                          textTransform: "uppercase",
                          color: m.primary ? "var(--color-brand)" : "var(--color-text-tertiary)",
                          marginBottom: "0.625rem",
                        }}
                      >
                        {m.label}
                      </div>
                      <div
                        style={{
                          fontSize: "1.625rem",
                          fontWeight: 800,
                          color: "var(--color-text-primary)",
                          fontVariantNumeric: "tabular-nums",
                          letterSpacing: "-0.03em",
                          marginBottom: "0.5rem",
                        }}
                      >
                        {(m.value * 100).toFixed(2)}%
                      </div>
                      <div style={{ height: "4px", background: "var(--color-border)", borderRadius: "2px", overflow: "hidden" }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${m.value * 100}%` }}
                          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                          style={{ height: "100%", background: m.primary ? "var(--color-brand)" : "var(--color-accent)", borderRadius: "2px", opacity: 0.7 }}
                        />
                      </div>
                      <div style={{ fontSize: "0.6875rem", color: "var(--color-text-tertiary)", marginTop: "0.4rem" }}>
                        {m.note}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </main>

      <style>{`
        @media (max-width: 900px) {
          .model-charts-grid { grid-template-columns: 1fr !important; }
          .metrics-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 500px) {
          .metrics-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

/* ─── Threshold Explorer ──────────────────────────────────────────────────── */
function ThresholdExplorer({
  thresholdAnalysis,
  selectedThreshold,
  preview,
  setPreview,
}: {
  thresholdAnalysis: AnalyticsResponse["threshold_analysis"];
  selectedThreshold: number;
  preview: number;
  setPreview: (v: number) => void;
}) {
  const closestPoint = thresholdAnalysis.reduce((prev, curr) =>
    Math.abs(curr.threshold - preview) < Math.abs(prev.threshold - preview) ? curr : prev
  );

  const optimalPct = ((selectedThreshold - 0.1) / 0.89) * 100;

  return (
    <div>
      {/* Slider */}
      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", marginBottom: "1.5rem" }}>
        <span style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", flexShrink: 0, fontFamily: "var(--font-mono)" }}>10%</span>
        <div style={{ flex: 1, position: "relative", paddingTop: "1.5rem" }}>
          {/* Optimal marker */}
          <div
            style={{
              position: "absolute",
              left: `${optimalPct}%`,
              top: 0,
              transform: "translateX(-50%)",
              fontSize: "0.6875rem",
              color: "var(--color-brand)",
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            ▼ Optimal
          </div>
          <input
            type="range"
            min={0.1}
            max={0.99}
            step={0.01}
            value={preview}
            onChange={(e) => setPreview(parseFloat(e.target.value))}
            style={{ width: "100%" }}
            aria-label="Threshold value"
          />
        </div>
        <span style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", flexShrink: 0, fontFamily: "var(--font-mono)" }}>99%</span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "1.125rem",
            fontWeight: 800,
            color: "var(--color-text-primary)",
            minWidth: "52px",
            textAlign: "right",
          }}
        >
          {(preview * 100).toFixed(0)}%
        </span>
      </div>

      {/* Metrics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "0.75rem",
        }}
        className="threshold-metrics"
      >
        <ThresholdMetric label="F1 Score" value={closestPoint.f1} />
        <ThresholdMetric label="Precision" value={closestPoint.precision} />
        <ThresholdMetric label="Recall" value={closestPoint.recall} />
        <div
          style={{
            padding: "0.875rem",
            background: "var(--color-risk-review-bg)",
            border: "1px solid var(--color-risk-review-border)",
            borderRadius: "var(--radius-md)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--color-risk-review)", marginBottom: "0.375rem" }}>
            False Positives
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={closestPoint.false_positives}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--color-text-primary)", fontVariantNumeric: "tabular-nums" }}
            >
              {closestPoint.false_positives}
            </motion.div>
          </AnimatePresence>
          <div style={{ fontSize: "0.6875rem", color: "var(--color-text-tertiary)" }}>false alerts</div>
        </div>
        <div
          style={{
            padding: "0.875rem",
            background: "var(--color-risk-high-bg)",
            border: "1px solid var(--color-risk-high-border)",
            borderRadius: "var(--radius-md)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--color-risk-high)", marginBottom: "0.375rem" }}>
            False Negatives
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={closestPoint.false_negatives}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--color-text-primary)", fontVariantNumeric: "tabular-nums" }}
            >
              {closestPoint.false_negatives}
            </motion.div>
          </AnimatePresence>
          <div style={{ fontSize: "0.6875rem", color: "var(--color-text-tertiary)" }}>fraud missed</div>
        </div>
      </div>

      <style>{`
        @media (max-width: 700px) {
          .threshold-metrics { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}

function ThresholdMetric({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        padding: "0.875rem",
        background: "var(--color-surface-2)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--color-text-tertiary)", marginBottom: "0.375rem" }}>
        {label}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={value.toFixed(4)}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--color-text-primary)", fontVariantNumeric: "tabular-nums" }}
        >
          {(value * 100).toFixed(1)}%
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function MetricCell({ value, highlight = false }: { value: number; highlight?: boolean }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "0.875rem",
        fontWeight: highlight ? 700 : 500,
        color: highlight ? "var(--color-brand)" : "var(--color-text-primary)",
      }}
    >
      {(value * 100).toFixed(2)}%
    </span>
  );
}

function LoadingState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
        {Array.from({ length: 3 }).map((_, i) => <MetricSkeleton key={i} />)}
      </div>
      <div className="card" style={{ height: "200px" }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
        <div className="card" style={{ height: "300px" }} />
        <div className="card" style={{ height: "300px" }} />
      </div>
    </div>
  );
}
