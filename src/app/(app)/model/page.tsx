"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { ErrorState } from "@/components/ui/ErrorState";
import { MetricSkeleton } from "@/components/ui/Skeleton";
import { api, type AnalyticsResponse, type ModelInfoResponse } from "@/lib/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
  Legend,
} from "recharts";

export default function ModelPage() {
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [thresholdPreview, setThresholdPreview] = useState<number | null>(null);

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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const containerAnim = {
    hidden: {},
    show: { transition: { staggerChildren: 0.1 } },
  };
  const itemAnim = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <Header
        title="Model Lab"
        description="Candidate model comparison, threshold analysis, and performance metrics"
      />
      <main style={{ flex: 1, padding: "2rem", maxWidth: "1300px", width: "100%" }}>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState title="Could not load model data" message={error} onRetry={fetchData} />
        ) : analytics && modelInfo ? (
          <motion.div
            variants={containerAnim}
            initial="hidden"
            animate="show"
            style={{ display: "flex", flexDirection: "column", gap: "2rem" }}
          >
            {/* Model comparison table */}
            <motion.div variants={itemAnim}>
              <div className="text-section-heading" style={{ marginBottom: "1rem" }}>
                Model Comparison — Validation Set
              </div>
              <div className="card" style={{ overflow: "hidden" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Model</th>
                      <th>PR-AUC ▾</th>
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
                        <tr key={m.model}>
                          <td>
                            <div
                              style={{
                                fontWeight: isSelected ? 700 : 500,
                                color: "var(--color-text-primary)",
                              }}
                            >
                              {m.model}
                            </div>
                          </td>
                          <td>
                            <MetricCell value={m.pr_auc} highlight={isSelected} />
                          </td>
                          <td>
                            <MetricCell value={m.roc_auc} />
                          </td>
                          <td>
                            <MetricCell value={m.f1} />
                          </td>
                          <td>
                            <MetricCell value={m.precision} />
                          </td>
                          <td>
                            <MetricCell value={m.recall} />
                          </td>
                          <td>
                            {isSelected ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.375rem",
                                  padding: "0.2rem 0.625rem",
                                  borderRadius: "4px",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  color: "var(--color-risk-low)",
                                  backgroundColor: "var(--color-risk-low-bg)",
                                  border: "1px solid var(--color-risk-low-border)",
                                }}
                              >
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="12" /></svg>
                                Selected
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
                <div
                  style={{
                    padding: "0.875rem 1rem",
                    backgroundColor: "var(--color-surface-2)",
                    borderTop: "1px solid var(--color-border)",
                    fontSize: "0.8125rem",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  <strong style={{ color: "var(--color-text-primary)" }}>Selection rationale:</strong>{" "}
                  {modelInfo.selection_reason}
                </div>
              </div>
            </motion.div>

            {/* PR Curve-like visualization and Threshold Analysis side by side */}
            <motion.div
              variants={itemAnim}
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}
            >
              {/* Precision-Recall trade-off */}
              <div className="card" style={{ padding: "1.5rem" }}>
                <div style={{ marginBottom: "1rem" }}>
                  <div className="text-section-heading" style={{ marginBottom: "0.25rem" }}>
                    Precision vs Recall Trade-off
                  </div>
                  <div
                    style={{
                      fontSize: "0.8125rem",
                      color: "var(--color-text-secondary)",
                      padding: "0.5rem 0.75rem",
                      backgroundColor: "var(--color-brand-subtle)",
                      borderRadius: "4px",
                      border: "1px solid var(--color-brand-border)",
                      marginTop: "0.5rem",
                    }}
                  >
                    PR-AUC = {(modelInfo.pr_auc * 100).toFixed(2)}% — Primary metric for rare-event fraud detection
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart
                    data={analytics.threshold_analysis
                      .filter((_, i) => i % 3 === 0)
                      .map((t) => ({
                        recall: t.recall,
                        precision: t.precision,
                        threshold: t.threshold,
                      }))}
                  >
                    <XAxis
                      dataKey="recall"
                      label={{ value: "Recall", position: "insideBottom", offset: -2, fontSize: 11 }}
                      domain={[0, 1]}
                      tick={{ fontSize: 11, fill: "var(--color-text-tertiary)" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => v.toFixed(1)}
                    />
                    <YAxis
                      domain={[0, 1]}
                      tick={{ fontSize: 11, fill: "var(--color-text-tertiary)" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => v.toFixed(1)}
                      label={{ value: "Precision", angle: -90, position: "insideLeft", offset: 10, fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(v: number) => v.toFixed(4)}
                      labelFormatter={(v) => `Recall: ${Number(v).toFixed(3)}`}
                      contentStyle={{ background: "white", border: "1px solid var(--color-border)", borderRadius: "6px", fontSize: "0.8125rem" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="precision"
                      stroke="#1A3A4A"
                      strokeWidth={2}
                      dot={false}
                      name="Precision"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* F1 across thresholds */}
              <div className="card" style={{ padding: "1.5rem" }}>
                <div style={{ marginBottom: "1rem" }}>
                  <div className="text-section-heading" style={{ marginBottom: "0.25rem" }}>
                    F1 Score Across Thresholds
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
                    Optimal threshold selected at peak F1 on validation set
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart
                    data={analytics.threshold_analysis.filter((_, i) => i % 2 === 0)}
                  >
                    <XAxis
                      dataKey="threshold"
                      tick={{ fontSize: 11, fill: "var(--color-text-tertiary)" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                      label={{ value: "Threshold", position: "insideBottom", offset: -2, fontSize: 11 }}
                    />
                    <YAxis
                      domain={[0, 1]}
                      tick={{ fontSize: 11, fill: "var(--color-text-tertiary)" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => v.toFixed(1)}
                    />
                    <Tooltip
                      formatter={(v: number, name: string) => [v.toFixed(4), name]}
                      labelFormatter={(v) => `Threshold: ${(Number(v) * 100).toFixed(0)}%`}
                      contentStyle={{ background: "white", border: "1px solid var(--color-border)", borderRadius: "6px", fontSize: "0.8125rem" }}
                    />
                    <ReferenceLine
                      x={modelInfo.threshold}
                      stroke="var(--color-brand)"
                      strokeDasharray="4 2"
                      label={{ value: `Selected (${(modelInfo.threshold * 100).toFixed(0)}%)`, fill: "var(--color-brand)", fontSize: 11, position: "insideTopRight" }}
                    />
                    <Line type="monotone" dataKey="f1" stroke="#1A3A4A" strokeWidth={2} dot={false} name="F1" />
                    <Line type="monotone" dataKey="precision" stroke="#2D6A4F" strokeWidth={1.5} dot={false} name="Precision" strokeDasharray="3 2" />
                    <Line type="monotone" dataKey="recall" stroke="#C1392B" strokeWidth={1.5} dot={false} name="Recall" strokeDasharray="3 2" />
                    <Legend iconType="line" iconSize={12} formatter={(v) => <span style={{ fontSize: "0.8125rem" }}>{v}</span>} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Interactive threshold explorer */}
            <motion.div variants={itemAnim} className="card" style={{ padding: "1.5rem" }}>
              <div className="text-section-heading" style={{ marginBottom: "0.25rem" }}>
                Threshold Explorer
              </div>
              <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", marginBottom: "1.25rem" }}>
                Explore how different thresholds affect performance metrics (validation set)
              </div>
              {thresholdPreview !== null && analytics && (
                <ThresholdExplorer
                  thresholdAnalysis={analytics.threshold_analysis}
                  selectedThreshold={modelInfo.threshold}
                  preview={thresholdPreview}
                  setPreview={setThresholdPreview}
                />
              )}
            </motion.div>

            {/* Final test metrics */}
            <motion.div variants={itemAnim}>
              <div className="text-section-heading" style={{ marginBottom: "1rem" }}>
                Final Evaluation — Held-out Test Set
              </div>
              <div className="card" style={{ padding: "1.5rem" }}>
                <div
                  style={{
                    marginBottom: "1rem",
                    fontSize: "0.875rem",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  Test set was not used during model selection or threshold optimization.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1rem" }}>
                  {[
                    { label: "Precision", value: modelInfo.precision },
                    { label: "Recall", value: modelInfo.recall },
                    { label: "F1 Score", value: modelInfo.f1 },
                    { label: "PR-AUC", value: modelInfo.pr_auc, highlight: true },
                    { label: "ROC-AUC", value: modelInfo.roc_auc },
                  ].map((m) => (
                    <div
                      key={m.label}
                      style={{
                        padding: "1rem",
                        backgroundColor: m.highlight ? "var(--color-brand-subtle)" : "var(--color-surface-2)",
                        border: `1px solid ${m.highlight ? "var(--color-brand-border)" : "var(--color-border)"}`,
                        borderRadius: "var(--radius-md)",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: m.highlight ? "var(--color-brand)" : "var(--color-text-tertiary)",
                          marginBottom: "0.5rem",
                        }}
                      >
                        {m.label}
                      </div>
                      <div
                        style={{
                          fontSize: "1.375rem",
                          fontWeight: 800,
                          color: "var(--color-text-primary)",
                          fontVariantNumeric: "tabular-nums",
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {(m.value * 100).toFixed(2)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </main>
    </div>
  );
}

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

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", marginBottom: "1.25rem" }}>
        <span style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", flexShrink: 0 }}>0%</span>
        <div style={{ flex: 1, position: "relative" }}>
          <input
            type="range"
            min={0.1}
            max={0.99}
            step={0.01}
            value={preview}
            onChange={(e) => setPreview(parseFloat(e.target.value))}
            style={{
              width: "100%",
              appearance: "none",
              height: "4px",
              borderRadius: "2px",
              backgroundColor: "var(--color-border)",
              cursor: "pointer",
              outline: "none",
            }}
          />
          {/* Selected threshold marker */}
          <div
            style={{
              position: "absolute",
              left: `${(selectedThreshold - 0.1) / 0.89 * 100}%`,
              top: "-14px",
              transform: "translateX(-50%)",
              fontSize: "0.6875rem",
              color: "var(--color-brand)",
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            ▼ Optimal
          </div>
        </div>
        <span style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", flexShrink: 0 }}>100%</span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.9375rem",
            fontWeight: 700,
            color: "var(--color-text-primary)",
            minWidth: "48px",
          }}
        >
          {(preview * 100).toFixed(0)}%
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.75rem" }}>
        <ThresholdMetric label="F1" value={closestPoint.f1} />
        <ThresholdMetric label="Precision" value={closestPoint.precision} />
        <ThresholdMetric label="Recall" value={closestPoint.recall} />
        <div style={{ padding: "0.875rem", backgroundColor: "var(--color-risk-review-bg)", border: "1px solid var(--color-risk-review-border)", borderRadius: "var(--radius-md)", textAlign: "center" }}>
          <div style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-risk-review)", marginBottom: "0.375rem" }}>False Pos.</div>
          <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--color-text-primary)" }}>{closestPoint.false_positives}</div>
        </div>
        <div style={{ padding: "0.875rem", backgroundColor: "var(--color-risk-high-bg)", border: "1px solid var(--color-risk-high-border)", borderRadius: "var(--radius-md)", textAlign: "center" }}>
          <div style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-risk-high)", marginBottom: "0.375rem" }}>False Neg.</div>
          <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--color-text-primary)" }}>{closestPoint.false_negatives}</div>
        </div>
      </div>
    </div>
  );
}

function ThresholdMetric({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        padding: "0.875rem",
        backgroundColor: "var(--color-surface-2)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--color-text-tertiary)",
          marginBottom: "0.375rem",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "1.125rem",
          fontWeight: 700,
          color: "var(--color-text-primary)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {(value * 100).toFixed(1)}%
      </div>
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
        <div className="card" style={{ height: "280px" }} />
        <div className="card" style={{ height: "280px" }} />
      </div>
    </div>
  );
}
