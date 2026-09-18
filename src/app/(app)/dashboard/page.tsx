"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { useMobileMenu } from "@/app/(app)/layout";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { MetricSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  api,
  type AnalyticsResponse,
  type ModelInfoResponse,
  type InvestigationRecord,
} from "@/lib/api";
import { formatNumber, formatCurrencyINR } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, LineChart, Line, Legend,
} from "recharts";

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfoResponse | null>(null);
  const [investigations, setInvestigations] = useState<InvestigationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { onMenuToggle } = useMobileMenu();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, m, invs] = await Promise.all([
        api.analytics(),
        api.modelInfo(),
        api.listInvestigations().catch(() => [] as InvestigationRecord[]),
      ]);
      setAnalytics(a);
      setModelInfo(m);
      setInvestigations(invs);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function loadInitial() {
      try {
        const [a, m, invs] = await Promise.all([
          api.analytics(),
          api.modelInfo(),
          api.listInvestigations().catch(() => [] as InvestigationRecord[]),
        ]);
        if (!ignore) {
          setAnalytics(a);
          setModelInfo(m);
          setInvestigations(invs);
        }
      } catch (e: unknown) {
        if (!ignore) {
          setError(e instanceof Error ? e.message : "Failed to load dashboard data");
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

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <Header
        title="Fraud Intelligence"
        description="Real-time view of transaction risk, model performance, and signal activity"
        onMenuToggle={onMenuToggle}
      />
      <main
        style={{
          flex: 1,
          padding: "2rem",
          maxWidth: "1440px",
          width: "100%",
        }}
      >
        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <ErrorState title="Unable to load intelligence data" message={error} onRetry={fetchData} />
        ) : analytics && modelInfo ? (
          <DashboardContent analytics={analytics} modelInfo={modelInfo} investigations={investigations} />
        ) : null}
      </main>
    </div>
  );
}

/* ─── Container animation ─────────────────────────────────────────────────── */
const containerAnim: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const itemAnim: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
};

function DashboardContent({
  analytics,
  modelInfo,
  investigations,
}: {
  analytics: AnalyticsResponse;
  modelInfo: ModelInfoResponse;
  investigations: InvestigationRecord[];
}) {
  const { confusion_matrix: cm } = analytics;
  const totalLegit = analytics.legitimate_transactions;
  const totalFraud = analytics.fraud_transactions;
  const total = analytics.total_transactions;

  // Model comparison bar chart data
  const comparisonData = analytics.model_comparison.map((m) => ({
    model: m.model.split(" ")[0],
    "PR-AUC": +(m.pr_auc * 100).toFixed(2),
    "ROC-AUC": +(m.roc_auc * 100).toFixed(2),
    F1: +(m.f1 * 100).toFixed(2),
    isSelected: m.model === modelInfo.model_name,
  }));

  // PR curve data
  const prCurveData = analytics.threshold_analysis
    .filter((_, i) => i % 4 === 0)
    .map((t) => ({
      recall: +(t.recall * 100).toFixed(1),
      precision: +(t.precision * 100).toFixed(1),
    }));

  return (
    <motion.div
      variants={containerAnim}
      initial="hidden"
      animate="show"
      style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}
    >
      {/* ── Section title ──────────────────────────────────────────────────── */}
      <motion.div variants={itemAnim}>
        <div className="intelligence-label" style={{ marginBottom: "0.25rem" }}>
          Transaction Intelligence
        </div>
        <div style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
          Analyzed from the credit card fraud detection dataset · {formatNumber(total)} transactions
        </div>
      </motion.div>

      {/* ── Primary metric strip ───────────────────────────────────────────── */}
      <motion.div
        variants={itemAnim}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "1rem",
        }}
      >
        {/* Total transactions */}
        <div className="intel-card intel-card-accent">
          <div className="intelligence-label" style={{ marginBottom: "0.875rem" }}>
            Transaction Intelligence
          </div>
          <div className="text-metric" style={{ marginBottom: "0.625rem" }}>
            {formatNumber(total)}
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", marginBottom: "0.875rem" }}>
            Analyzed transactions
          </div>
          {/* Distribution mini-bars */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <MiniBar
              label="Legitimate"
              count={totalLegit}
              total={total}
              color="var(--color-risk-low)"
            />
            <MiniBar
              label="Fraud"
              count={totalFraud}
              total={total}
              color="var(--color-risk-high)"
            />
          </div>
        </div>

        {/* Fraud signals */}
        <div className="intel-card intel-card-high">
          <div className="intelligence-label" style={{ marginBottom: "0.875rem" }}>
            Fraud Signals
          </div>
          <div className="text-metric" style={{ color: "var(--color-risk-high)", marginBottom: "0.25rem" }}>
            {formatNumber(totalFraud)}
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", marginBottom: "0.875rem" }}>
            Detected transactions
          </div>
          <div
            style={{
              height: "6px",
              background: "var(--color-border)",
              borderRadius: "3px",
              overflow: "hidden",
            }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(totalFraud / total) * 100}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              style={{
                height: "100%",
                background: "var(--color-risk-high)",
                borderRadius: "3px",
              }}
            />
          </div>
          <div style={{ fontSize: "0.6875rem", color: "var(--color-text-tertiary)", marginTop: "0.375rem" }}>
            {analytics.fraud_rate.toFixed(4)}% of total
          </div>
        </div>

        {/* Fraud rate */}
        <div className="intel-card intel-card-review">
          <div className="intelligence-label" style={{ marginBottom: "0.875rem" }}>
            Fraud Rate
          </div>
          <div className="text-metric" style={{ color: "var(--color-risk-review)", marginBottom: "0.25rem" }}>
            {analytics.fraud_rate.toFixed(4)}%
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", marginBottom: "0.875rem" }}>
            Extreme class imbalance
          </div>
          <div
            style={{
              padding: "0.4375rem 0.75rem",
              background: "var(--color-risk-review-bg)",
              border: "1px solid var(--color-risk-review-border)",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.75rem",
              color: "var(--color-risk-review)",
              fontWeight: 600,
            }}
          >
            577:1 legitimate-to-fraud ratio
          </div>
        </div>

        {/* Model readiness */}
        <div className="intel-card intel-card-low">
          <div className="intelligence-label" style={{ marginBottom: "0.875rem" }}>
            Model Readiness
          </div>
          <div
            style={{
              fontSize: "1.125rem",
              fontWeight: 800,
              color: "var(--color-text-primary)",
              letterSpacing: "-0.02em",
              marginBottom: "0.25rem",
            }}
          >
            {modelInfo.model_name}
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", marginBottom: "0.875rem" }}>
            Active inference engine
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <RiskBadge level="LOW" size="sm" showIcon={false} />
            <span style={{ fontSize: "0.75rem", color: "var(--color-text-tertiary)", fontFamily: "var(--font-mono)" }}>
              threshold: {(modelInfo.threshold * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </motion.div>

      {/* ── Model Intelligence + Comparison ───────────────────────────────── */}
      <motion.div
        variants={itemAnim}
        style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: "1.25rem" }}
        className="responsive-grid-2"
      >
        {/* Model performance panel */}
        <div className="card" style={{ padding: "1.5rem" }}>
          <div className="intelligence-label" style={{ marginBottom: "1.25rem" }}>
            Model Intelligence
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.25rem",
            }}
          >
            <div>
              <div style={{ fontSize: "1rem", fontWeight: 700, letterSpacing: "-0.015em" }}>
                {modelInfo.model_name}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--color-text-tertiary)", marginTop: "2px" }}>
                {modelInfo.model_version}
              </div>
            </div>
            <div
              style={{
                padding: "0.3125rem 0.75rem",
                background: "var(--color-risk-low-bg)",
                border: "1px solid var(--color-risk-low-border)",
                borderRadius: "4px",
                fontSize: "0.6875rem",
                fontWeight: 700,
                color: "var(--color-risk-low)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Active Model
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
            {[
              { label: "PR-AUC", value: modelInfo.pr_auc, primary: true, note: "Primary metric" },
              { label: "ROC-AUC", value: modelInfo.roc_auc, note: "Overall discrimination" },
              { label: "Precision", value: modelInfo.precision, note: "Fraud alerts that are real" },
              { label: "Recall", value: modelInfo.recall, note: "Fraud cases detected" },
              { label: "F1 Score", value: modelInfo.f1, note: "Precision-recall balance" },
            ].map((m) => (
              <div key={m.label}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.3rem",
                  }}
                >
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <span
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: m.primary ? 700 : 500,
                        color: m.primary ? "var(--color-brand)" : "var(--color-text-primary)",
                      }}
                    >
                      {m.label}
                    </span>
                    {m.primary && (
                      <span
                        style={{
                          fontSize: "0.5625rem",
                          fontWeight: 700,
                          letterSpacing: "0.07em",
                          textTransform: "uppercase",
                          color: "var(--color-brand)",
                          background: "var(--color-brand-subtle)",
                          border: "1px solid var(--color-brand-border)",
                          padding: "0.1rem 0.375rem",
                          borderRadius: "2px",
                        }}
                      >
                        Primary
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.875rem",
                      fontWeight: 700,
                      color: m.primary ? "var(--color-brand)" : "var(--color-text-primary)",
                    }}
                  >
                    {(m.value * 100).toFixed(2)}%
                  </span>
                </div>
                <div style={{ position: "relative", height: "5px", background: "var(--color-border)", borderRadius: "3px", overflow: "hidden" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${m.value * 100}%` }}
                    transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      background: m.primary ? "var(--color-brand)" : "var(--color-accent)",
                      borderRadius: "3px",
                      opacity: m.primary ? 0.9 : 0.65,
                    }}
                  />
                </div>
                <div style={{ fontSize: "0.6875rem", color: "var(--color-text-tertiary)", marginTop: "0.2rem" }}>
                  {m.note}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Model comparison chart */}
        <div className="card" style={{ padding: "1.5rem" }}>
          <div className="intelligence-label" style={{ marginBottom: "0.25rem" }}>
            Model Comparison
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", marginBottom: "1.25rem" }}>
            Validation set — PR-AUC is the primary evaluation metric for imbalanced fraud detection
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={comparisonData} barGap={3} barCategoryGap="32%">
              <XAxis
                dataKey="model"
                tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: "var(--color-text-tertiary)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                formatter={(value: unknown, name: unknown) => [`${Number(value ?? 0).toFixed(2)}%`, String(name ?? "")]}
                contentStyle={{
                  background: "white",
                  border: "1px solid var(--color-border)",
                  borderRadius: "8px",
                  fontSize: "0.8125rem",
                  boxShadow: "var(--shadow-elevated)",
                }}
              />
              <Legend
                iconType="square"
                iconSize={8}
                formatter={(v) => <span style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>{v}</span>}
              />
              <Bar dataKey="PR-AUC" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]}>
                {comparisonData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.isSelected ? "var(--color-brand)" : "var(--color-chart-1)"}
                    opacity={entry.isSelected ? 1 : 0.7}
                  />
                ))}
              </Bar>
              <Bar dataKey="ROC-AUC" fill="#6B8CAE" radius={[4, 4, 0, 0]} opacity={0.75} />
              <Bar dataKey="F1" fill="#A7C4D4" radius={[4, 4, 0, 0]} opacity={0.65} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* ── Confusion Matrix + PR Curve ────────────────────────────────────── */}
      <motion.div
        variants={itemAnim}
        style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: "1.25rem" }}
        className="responsive-grid-2"
      >
        {/* Confusion Matrix */}
        <div className="card" style={{ padding: "1.5rem" }}>
          <div className="intelligence-label" style={{ marginBottom: "1.25rem" }}>
            Test Set Confusion Matrix
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr 1fr",
              gap: "4px",
              maxWidth: "320px",
            }}
          >
            {/* Headers */}
            <div />
            {["Pred. Legit", "Pred. Fraud"].map((h) => (
              <div
                key={h}
                style={{
                  textAlign: "center",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  color: "var(--color-text-tertiary)",
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  padding: "0.375rem 0.5rem",
                }}
              >
                {h}
              </div>
            ))}
            {/* Row 1: Actual Legit */}
            <div
              style={{
                fontSize: "0.6875rem",
                fontWeight: 700,
                color: "var(--color-text-tertiary)",
                display: "flex",
                alignItems: "center",
                paddingRight: "0.625rem",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Legit
            </div>
            <CMCell value={cm.true_negatives}  label="TN" type="good" />
            <CMCell value={cm.false_positives} label="FP" type="warn" />
            {/* Row 2: Actual Fraud */}
            <div
              style={{
                fontSize: "0.6875rem",
                fontWeight: 700,
                color: "var(--color-text-tertiary)",
                display: "flex",
                alignItems: "center",
                paddingRight: "0.625rem",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Fraud
            </div>
            <CMCell value={cm.false_negatives} label="FN" type="bad" />
            <CMCell value={cm.true_positives}  label="TP" type="good" />
          </div>
          <div
            style={{
              marginTop: "1.125rem",
              fontSize: "0.8125rem",
              color: "var(--color-text-secondary)",
              lineHeight: 1.6,
            }}
          >
            <span style={{ color: "var(--color-risk-high)", fontWeight: 600 }}>
              FN = {formatNumber(cm.false_negatives)}
            </span>{" "}
            fraud cases missed ·{" "}
            <span style={{ color: "var(--color-risk-review)", fontWeight: 600 }}>
              FP = {formatNumber(cm.false_positives)}
            </span>{" "}
            false alerts
          </div>
        </div>

        {/* PR Curve */}
        <div className="card" style={{ padding: "1.5rem" }}>
          <div className="intelligence-label" style={{ marginBottom: "0.25rem" }}>
            Precision–Recall Curve
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", marginBottom: "1.25rem" }}>
            PR-AUC = {(modelInfo.pr_auc * 100).toFixed(2)}% — primary metric for rare-event fraud detection
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={prCurveData}>
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
                formatter={(v: unknown) => [`${Number(v ?? 0).toFixed(1)}%`, ""]}
                contentStyle={{ background: "white", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "0.8125rem" }}
              />
              <Line
                type="monotone"
                dataKey="precision"
                stroke="var(--color-chart-1)"
                strokeWidth={2.5}
                dot={false}
                name="Precision"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* ── Recent Persisted Cases & Live Ingestion Activity ─────────────── */}
      <motion.div variants={itemAnim}>
        <div className="card" style={{ padding: "1.375rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <div>
              <div className="intelligence-label">Recent Forensic Ingestion Activity</div>
              <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
                Live transactions processed through XGBoost inference and persisted in database
              </div>
            </div>
            <Link
              href="/investigations"
              style={{
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "var(--color-brand)",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              Open Workspace →
            </Link>
          </div>

          {investigations.length === 0 ? (
            <div style={{ padding: "2.5rem 1rem", textAlign: "center", color: "var(--color-text-tertiary)", fontSize: "0.875rem" }}>
              No live transactions analyzed yet. Run an analysis in the{" "}
              <Link href="/analyze" style={{ color: "var(--color-brand)", fontWeight: 600 }}>
                Transaction Analyzer
              </Link>{" "}
              to start recording persistent forensic cases.
            </div>
          ) : (
            <div style={{ overflowX: "auto", marginTop: "1rem" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left", color: "var(--color-text-secondary)" }}>
                    <th style={{ padding: "0.625rem 0.75rem", fontWeight: 600 }}>Case ID</th>
                    <th style={{ padding: "0.625rem 0.75rem", fontWeight: 600 }}>Amount</th>
                    <th style={{ padding: "0.625rem 0.75rem", fontWeight: 600 }}>Prediction</th>
                    <th style={{ padding: "0.625rem 0.75rem", fontWeight: 600 }}>Risk Level</th>
                    <th style={{ padding: "0.625rem 0.75rem", fontWeight: 600 }}>Probability</th>
                    <th style={{ padding: "0.625rem 0.75rem", fontWeight: 600 }}>Case Status</th>
                    <th style={{ padding: "0.625rem 0.75rem", textAlign: "right", fontWeight: 600 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {investigations.slice(0, 5).map((inv) => {
                    const a = inv.analysis;
                    return (
                      <tr
                        key={inv.id}
                        style={{
                          borderBottom: "1px solid var(--color-border)",
                        }}
                      >
                        <td style={{ padding: "0.75rem", fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--color-text-primary)" }}>
                          {inv.id.slice(0, 8)}
                        </td>
                        <td style={{ padding: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--color-text-primary)" }}>
                          {a ? formatCurrencyINR(a.amount) : "—"}
                        </td>
                        <td style={{ padding: "0.75rem", fontWeight: 700, color: a?.prediction === "FRAUD" ? "var(--color-risk-high)" : "var(--color-risk-low)" }}>
                          {a?.prediction || "—"}
                        </td>
                        <td style={{ padding: "0.75rem" }}>
                          {a ? <RiskBadge level={a.risk_level} size="sm" /> : "—"}
                        </td>
                        <td style={{ padding: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)" }}>
                          {a ? `${(a.fraud_probability * 100).toFixed(2)}%` : "—"}
                        </td>
                        <td style={{ padding: "0.75rem" }}>
                          <span
                            style={{
                              fontSize: "0.6875rem",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              padding: "0.2rem 0.5rem",
                              borderRadius: "4px",
                              letterSpacing: "0.04em",
                              background:
                                inv.status === "RESOLVED"
                                  ? "var(--color-risk-low-bg)"
                                  : inv.status === "UNDER_REVIEW"
                                  ? "var(--color-risk-review-bg)"
                                  : "var(--color-risk-high-bg)",
                              color:
                                inv.status === "RESOLVED"
                                  ? "var(--color-risk-low)"
                                  : inv.status === "UNDER_REVIEW"
                                  ? "var(--color-risk-review)"
                                  : "var(--color-risk-high)",
                              border: `1px solid ${
                                inv.status === "RESOLVED"
                                  ? "var(--color-risk-low-border)"
                                  : inv.status === "UNDER_REVIEW"
                                  ? "var(--color-risk-review-border)"
                                  : "var(--color-risk-high-border)"
                              }`,
                            }}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem", textAlign: "right" }}>
                          <Link
                            href={`/investigations?id=${inv.id}`}
                            className="btn btn-secondary"
                            style={{ padding: "0.3rem 0.625rem", fontSize: "0.75rem" }}
                          >
                            Review Case
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Why PR-AUC note ───────────────────────────────────────────────── */}
      <motion.div variants={itemAnim}>
        <div
          style={{
            padding: "1rem 1.375rem",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderLeft: "4px solid var(--color-accent)",
            borderRadius: "var(--radius-md)",
            fontSize: "0.875rem",
            color: "var(--color-text-secondary)",
            lineHeight: 1.65,
          }}
        >
          <strong style={{ color: "var(--color-text-primary)" }}>Why PR-AUC is the primary metric:</strong>{" "}
          With only {analytics.fraud_rate.toFixed(4)}% of transactions being fraudulent, a classifier
          predicting &ldquo;legitimate&rdquo; for every transaction would achieve {(100 - analytics.fraud_rate).toFixed(2)}% accuracy
          while catching zero fraud. Precision-Recall AUC measures performance specifically on the minority fraud class —
          making it far more meaningful for rare-event detection.
        </div>
      </motion.div>

      <style>{`
        @media (max-width: 900px) {
          .responsive-grid-2 {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </motion.div>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */
function MiniBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
        <span style={{ fontSize: "0.6875rem", color: "var(--color-text-tertiary)", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: "0.6875rem", color, fontWeight: 600, fontFamily: "var(--font-mono)" }}>
          {formatNumber(count)}
        </span>
      </div>
      <div style={{ height: "4px", background: "var(--color-border)", borderRadius: "2px", overflow: "hidden" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          style={{ height: "100%", background: color, borderRadius: "2px", opacity: 0.75 }}
        />
      </div>
    </div>
  );
}

function CMCell({ value, label, type }: { value: number; label: string; type: "good" | "bad" | "warn" }) {
  const colors = {
    good: { bg: "var(--color-risk-low-bg)", border: "var(--color-risk-low-border)", text: "var(--color-risk-low)" },
    bad:  { bg: "var(--color-risk-high-bg)", border: "var(--color-risk-high-border)", text: "var(--color-risk-high)" },
    warn: { bg: "var(--color-risk-review-bg)", border: "var(--color-risk-review-border)", text: "var(--color-risk-review)" },
  }[type];

  return (
    <div
      style={{
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: "7px",
        padding: "0.875rem",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "0.5875rem", fontWeight: 700, letterSpacing: "0.08em", color: colors.text, marginBottom: "0.375rem", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--color-text-primary)", fontVariantNumeric: "tabular-nums" }}>
        {formatNumber(value)}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      <div>
        <div className="skeleton" style={{ width: "140px", height: "0.6875rem", marginBottom: "0.5rem" }} />
        <div className="skeleton" style={{ width: "280px", height: "0.875rem" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
        {Array.from({ length: 4 }).map((_, i) => <MetricSkeleton key={i} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: "1.25rem" }}>
        <div className="card" style={{ height: "320px" }} />
        <div className="card" style={{ height: "320px" }} />
      </div>
    </div>
  );
}
