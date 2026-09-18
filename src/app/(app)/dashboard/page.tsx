"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { MetricSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { api, type AnalyticsResponse, type ModelInfoResponse } from "@/lib/api";
import { formatNumber, formatPercent } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, m] = await Promise.all([api.analytics(), api.modelInfo()]);
      setAnalytics(a);
      setModelInfo(m);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <Header
        title="Overview"
        description="Transaction risk intelligence and model performance"
      />

      <main style={{ flex: 1, padding: "2rem", maxWidth: "1400px", width: "100%" }}>
        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <ErrorState
            title="Unable to load dashboard"
            message={error}
            onRetry={fetchData}
          />
        ) : analytics && modelInfo ? (
          <DashboardContent analytics={analytics} modelInfo={modelInfo} />
        ) : null}
      </main>
    </div>
  );
}

function DashboardContent({
  analytics,
  modelInfo,
}: {
  analytics: AnalyticsResponse;
  modelInfo: ModelInfoResponse;
}) {
  const { confusion_matrix: cm } = analytics;

  // Distribution data for pie chart
  const distributionData = [
    {
      name: "Legitimate",
      value: analytics.legitimate_transactions,
      fill: "#2D6A4F",
    },
    {
      name: "Fraud",
      value: analytics.fraud_transactions,
      fill: "#C1392B",
    },
  ];

  // Model comparison data
  const comparisonData = analytics.model_comparison.map((m) => ({
    model: m.model.replace(" ", "\n"),
    "PR-AUC": m.pr_auc,
    "ROC-AUC": m.roc_auc,
    F1: m.f1,
  }));

  const containerAnim = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08 } },
  };
  const itemAnim = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <motion.div
      variants={containerAnim}
      initial="hidden"
      animate="show"
      style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}
    >
      {/* Section heading */}
      <motion.div variants={itemAnim}>
        <div className="text-section-heading" style={{ marginBottom: "0.25rem" }}>
          Dataset Intelligence
        </div>
        <div style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
          Analyzed from the credit card fraud detection dataset — 284,807 transactions
        </div>
      </motion.div>

      {/* Primary metrics row */}
      <motion.div
        variants={itemAnim}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
        }}
      >
        <MetricCard
          label="Total Transactions"
          value={formatNumber(analytics.total_transactions)}
          sub="Complete dataset"
          accent="#1A3A4A"
        />
        <MetricCard
          label="Fraud Transactions"
          value={formatNumber(analytics.fraud_transactions)}
          sub={`${analytics.fraud_rate.toFixed(4)}% of all transactions`}
          accent="var(--color-risk-high)"
        />
        <MetricCard
          label="Legitimate Transactions"
          value={formatNumber(analytics.legitimate_transactions)}
          sub="Non-fraudulent activity"
          accent="var(--color-risk-low)"
        />
        <MetricCard
          label="Fraud Rate"
          value={`${analytics.fraud_rate.toFixed(4)}%`}
          sub="Extreme class imbalance"
          accent="var(--color-risk-review)"
          highlight
        />
      </motion.div>

      {/* Main charts row */}
      <motion.div
        variants={itemAnim}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.5fr",
          gap: "1.25rem",
        }}
      >
        {/* Class distribution pie */}
        <div className="card" style={{ padding: "1.5rem" }}>
          <div style={{ marginBottom: "1rem" }}>
            <div className="text-section-heading" style={{ marginBottom: "0.25rem" }}>
              Class Distribution
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
              Visualizing the extreme imbalance
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={distributionData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {distributionData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [formatNumber(value), ""]}
                contentStyle={{
                  background: "white",
                  border: "1px solid var(--color-border)",
                  borderRadius: "6px",
                  fontSize: "0.8125rem",
                }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(v) => (
                  <span style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
                    {v}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
          <div
            style={{
              textAlign: "center",
              fontSize: "0.8125rem",
              color: "var(--color-text-tertiary)",
              marginTop: "0.5rem",
              padding: "0.5rem",
              backgroundColor: "var(--color-risk-review-bg)",
              borderRadius: "4px",
              border: "1px solid var(--color-risk-review-border)",
            }}
          >
            <span style={{ fontWeight: 600, color: "var(--color-risk-review)" }}>
              577:1
            </span>
            {" "}legitimate-to-fraud ratio — accuracy is an insufficient metric
          </div>
        </div>

        {/* Model comparison chart */}
        <div className="card" style={{ padding: "1.5rem" }}>
          <div style={{ marginBottom: "1rem" }}>
            <div className="text-section-heading" style={{ marginBottom: "0.25rem" }}>
              Model Comparison
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
              Validation set performance — PR-AUC is the primary metric
            </div>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={comparisonData} barGap={3} barCategoryGap="30%">
              <XAxis
                dataKey="model"
                tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 1]}
                tick={{ fontSize: 11, fill: "var(--color-text-tertiary)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => v.toFixed(1)}
              />
              <Tooltip
                formatter={(value: number) => value.toFixed(4)}
                contentStyle={{
                  background: "white",
                  border: "1px solid var(--color-border)",
                  borderRadius: "6px",
                  fontSize: "0.8125rem",
                }}
              />
              <Legend
                iconType="square"
                iconSize={8}
                formatter={(v) => (
                  <span style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
                    {v}
                  </span>
                )}
              />
              <Bar dataKey="PR-AUC" fill="#1A3A4A" radius={[3, 3, 0, 0]} />
              <Bar dataKey="ROC-AUC" fill="#6B8CAE" radius={[3, 3, 0, 0]} />
              <Bar dataKey="F1" fill="#A7C4D4" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Model Performance */}
      <motion.div variants={itemAnim}>
        <div className="text-section-heading" style={{ marginBottom: "1rem" }}>
          Selected Model Performance
        </div>
        <div
          className="card"
          style={{ padding: "1.5rem", overflow: "hidden" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "1.5rem",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "1.125rem",
                  fontWeight: 700,
                  color: "var(--color-text-primary)",
                  letterSpacing: "-0.01em",
                }}
              >
                {modelInfo.model_name}
              </div>
              <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", marginTop: "0.25rem" }}>
                Test set evaluation · Threshold:{" "}
                <span style={{ fontWeight: 600, fontFamily: "var(--font-mono)" }}>
                  {(modelInfo.threshold * 100).toFixed(0)}%
                </span>
              </div>
            </div>
            <div
              style={{
                padding: "0.375rem 0.875rem",
                backgroundColor: "var(--color-risk-low-bg)",
                border: "1px solid var(--color-risk-low-border)",
                borderRadius: "4px",
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "var(--color-risk-low)",
              }}
            >
              Active Model
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "1.25rem",
            }}
          >
            <PerformanceMetric
              label="Precision"
              value={modelInfo.precision}
              description="Fraud alerts that are real"
            />
            <PerformanceMetric
              label="Recall"
              value={modelInfo.recall}
              description="Fraud cases detected"
            />
            <PerformanceMetric
              label="F1 Score"
              value={modelInfo.f1}
              description="Precision-recall balance"
            />
            <PerformanceMetric
              label="PR-AUC"
              value={modelInfo.pr_auc}
              description="Primary fraud metric"
              highlight
            />
            <PerformanceMetric
              label="ROC-AUC"
              value={modelInfo.roc_auc}
              description="Overall discrimination"
            />
          </div>
        </div>
      </motion.div>

      {/* Confusion Matrix */}
      <motion.div variants={itemAnim}>
        <div className="text-section-heading" style={{ marginBottom: "1rem" }}>
          Test Set Confusion Matrix
        </div>
        <div className="card" style={{ padding: "1.5rem" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr 1fr",
              gap: "0",
              maxWidth: "400px",
            }}
          >
            {/* Header row */}
            <div />
            <div
              style={{
                textAlign: "center",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--color-text-tertiary)",
                padding: "0.5rem",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Pred. Legit
            </div>
            <div
              style={{
                textAlign: "center",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--color-text-tertiary)",
                padding: "0.5rem",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Pred. Fraud
            </div>

            {/* Actual Legit row */}
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--color-text-tertiary)",
                display: "flex",
                alignItems: "center",
                padding: "0 0.75rem 0 0",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Act. Legit
            </div>
            <CMCell value={cm.true_negatives} label="TN" type="good" />
            <CMCell value={cm.false_positives} label="FP" type="warn" />

            {/* Actual Fraud row */}
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--color-text-tertiary)",
                display: "flex",
                alignItems: "center",
                padding: "0 0.75rem 0 0",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Act. Fraud
            </div>
            <CMCell value={cm.false_negatives} label="FN" type="bad" />
            <CMCell value={cm.true_positives} label="TP" type="good" />
          </div>
          <div
            style={{
              marginTop: "1rem",
              fontSize: "0.8125rem",
              color: "var(--color-text-secondary)",
            }}
          >
            FN = {cm.false_negatives} fraud cases missed · FP = {cm.false_positives} false alerts generated
          </div>
        </div>
      </motion.div>

      {/* Imbalance note */}
      <motion.div variants={itemAnim}>
        <div
          style={{
            padding: "1rem 1.25rem",
            backgroundColor: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            fontSize: "0.875rem",
            color: "var(--color-text-secondary)",
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: "var(--color-text-primary)" }}>
            Why PR-AUC is the primary metric:
          </strong>{" "}
          With only {analytics.fraud_rate.toFixed(4)}% of transactions being fraudulent, a classifier
          predicting "legitimate" for every transaction would achieve {(100 - analytics.fraud_rate).toFixed(2)}% accuracy
          while catching zero fraud cases. Precision-Recall AUC measures performance on the
          positive (fraud) class specifically — making it far more informative for rare-event detection.
        </div>
      </motion.div>
    </motion.div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  accent,
  highlight = false,
}: {
  label: string;
  value: string;
  sub: string;
  accent: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="card"
      style={{
        padding: "1.25rem 1.5rem",
        borderTop: `3px solid ${accent}`,
        ...(highlight ? { backgroundColor: "var(--color-surface)" } : {}),
      }}
    >
      <div
        style={{
          fontSize: "0.75rem",
          fontWeight: 600,
          color: "var(--color-text-tertiary)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          marginBottom: "0.75rem",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "1.75rem",
          fontWeight: 700,
          color: "var(--color-text-primary)",
          letterSpacing: "-0.03em",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.1,
          marginBottom: "0.5rem",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: "0.8125rem",
          color: "var(--color-text-secondary)",
        }}
      >
        {sub}
      </div>
    </div>
  );
}

function PerformanceMetric({
  label,
  value,
  description,
  highlight = false,
}: {
  label: string;
  value: number;
  description: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        padding: "1rem",
        backgroundColor: highlight ? "var(--color-brand-subtle)" : "var(--color-surface-2)",
        borderRadius: "var(--radius-md)",
        border: `1px solid ${highlight ? "var(--color-brand-border)" : "var(--color-border)"}`,
      }}
    >
      <div
        style={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: highlight ? "var(--color-brand)" : "var(--color-text-tertiary)",
          marginBottom: "0.5rem",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "1.375rem",
          fontWeight: 700,
          color: "var(--color-text-primary)",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.02em",
          marginBottom: "0.25rem",
        }}
      >
        {(value * 100).toFixed(2)}%
      </div>
      <div style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
        {description}
      </div>
    </div>
  );
}

function CMCell({
  value,
  label,
  type,
}: {
  value: number;
  label: string;
  type: "good" | "bad" | "warn";
}) {
  const colors = {
    good: { bg: "var(--color-risk-low-bg)", border: "var(--color-risk-low-border)", text: "var(--color-risk-low)" },
    bad: { bg: "var(--color-risk-high-bg)", border: "var(--color-risk-high-border)", text: "var(--color-risk-high)" },
    warn: { bg: "var(--color-risk-review-bg)", border: "var(--color-risk-review-border)", text: "var(--color-risk-review)" },
  }[type];

  return (
    <div
      style={{
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: "6px",
        padding: "0.875rem",
        textAlign: "center",
        margin: "3px",
      }}
    >
      <div
        style={{
          fontSize: "0.6875rem",
          fontWeight: 600,
          letterSpacing: "0.06em",
          color: colors.text,
          marginBottom: "0.375rem",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "1.375rem",
          fontWeight: 700,
          color: "var(--color-text-primary)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {formatNumber(value)}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      <div>
        <div className="skeleton" style={{ width: "160px", height: "0.75rem", marginBottom: "0.5rem" }} />
        <div className="skeleton" style={{ width: "300px", height: "0.875rem" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
        {Array.from({ length: 4 }).map((_, i) => <MetricSkeleton key={i} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "1.25rem" }}>
        <div className="card" style={{ height: "300px" }} />
        <div className="card" style={{ height: "300px" }} />
      </div>
    </div>
  );
}
