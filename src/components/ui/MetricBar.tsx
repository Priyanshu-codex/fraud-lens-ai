"use client";

import { motion } from "framer-motion";
import type { FeatureContribution } from "@/lib/api";

interface MetricBarProps {
  contribution: FeatureContribution;
  maxAbs: number;
  index: number;
  emphasis?: boolean;
}

export function MetricBar({ contribution: c, maxAbs, index, emphasis = false }: MetricBarProps) {
  const barWidth = maxAbs > 0 ? Math.abs(c.contribution) / maxAbs : 0;
  const isFraud = c.direction === "fraud";
  const color = isFraud ? "var(--color-risk-high)" : "var(--color-risk-low)";
  const bgColor = isFraud ? "var(--color-risk-high-dim)" : "var(--color-risk-low-dim)";

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: index * 0.045 }}
      style={{
        padding: emphasis ? "0.875rem 1rem" : "0.625rem 0",
        borderRadius: emphasis ? "var(--radius-md)" : 0,
        backgroundColor: emphasis ? bgColor : "transparent",
        border: emphasis ? `1px solid ${color}22` : "none",
      }}
    >
      {/* Feature name + value row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.4rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.8125rem",
              fontWeight: emphasis ? 700 : 600,
              color: "var(--color-text-primary)",
              minWidth: "52px",
            }}
          >
            {c.feature}
          </span>
          <span
            style={{
              fontSize: "0.6875rem",
              color: "var(--color-text-tertiary)",
              fontFamily: "var(--font-mono)",
            }}
          >
            = {c.value.toFixed(3)}
          </span>
        </div>
        <span
          style={{
            fontSize: "0.8125rem",
            fontFamily: "var(--font-mono)",
            color,
            fontWeight: 700,
          }}
        >
          {c.contribution > 0 ? "+" : ""}{c.contribution.toFixed(4)}
        </span>
      </div>

      {/* Bar */}
      <div
        style={{
          height: "8px",
          backgroundColor: `${color}18`,
          borderRadius: "4px",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${barWidth * 100}%` }}
          transition={{ duration: 0.55, delay: index * 0.045, ease: [0.22, 1, 0.36, 1] }}
          style={{
            height: "100%",
            backgroundColor: color,
            borderRadius: "4px",
            opacity: emphasis ? 0.9 : 0.75,
          }}
        />
      </div>

      {/* Direction label */}
      <div
        style={{
          fontSize: "0.625rem",
          color,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          marginTop: "0.25rem",
          opacity: 0.8,
        }}
      >
        {isFraud ? "↑ Pushing toward fraud" : "↓ Away from fraud"}
      </div>
    </motion.div>
  );
}
