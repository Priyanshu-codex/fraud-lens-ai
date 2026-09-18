"use client";

import { motion } from "framer-motion";

interface RiskSpectrumProps {
  probability: number;    // 0-1
  threshold: number;      // 0-1
  riskLevel: "LOW" | "REVIEW" | "HIGH";
  animate?: boolean;
}

const RISK_COLORS = {
  LOW:    "var(--color-risk-low)",
  REVIEW: "var(--color-risk-review)",
  HIGH:   "var(--color-risk-high)",
};

export function RiskSpectrum({
  probability,
  threshold,
  riskLevel,
  animate = true,
}: RiskSpectrumProps) {
  const prob = Math.min(1, Math.max(0, probability));
  const thresh = Math.min(0.99, Math.max(0.01, threshold));
  const color = RISK_COLORS[riskLevel];
  const probPct = `${prob * 100}%`;
  const threshPct = `${thresh * 100}%`;

  return (
    <div>
      {/* Labels row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.6875rem",
          fontWeight: 600,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          marginBottom: "0.5rem",
        }}
      >
        <span style={{ color: "var(--color-risk-low)" }}>Low</span>
        <span style={{ color: "var(--color-risk-review)" }}>Review</span>
        <span style={{ color: "var(--color-risk-high)" }}>High</span>
      </div>

      {/* Track */}
      <div
        style={{
          position: "relative",
          height: "12px",
          borderRadius: "6px",
          background:
            "linear-gradient(to right, var(--color-risk-low-bg) 0%, var(--color-risk-low-bg) 33%, var(--color-risk-review-bg) 33%, var(--color-risk-review-bg) 66%, var(--color-risk-high-bg) 66%, var(--color-risk-high-bg) 100%)",
          border: "1px solid var(--color-border)",
          overflow: "visible",
        }}
      >
        {/* Fill bar */}
        <motion.div
          initial={animate ? { width: 0 } : { width: probPct }}
          animate={{ width: probPct }}
          transition={{ duration: 0.8, ease: [0.34, 1.2, 0.64, 1] }}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            borderRadius: "6px",
            background: color,
            opacity: 0.75,
          }}
        />

        {/* Threshold marker */}
        <div
          style={{
            position: "absolute",
            left: threshPct,
            top: "-6px",
            bottom: "-6px",
            width: "3px",
            backgroundColor: "var(--color-text-primary)",
            borderRadius: "2px",
            transform: "translateX(-50%)",
            zIndex: 3,
          }}
        />

        {/* Probability marker (dot) */}
        <motion.div
          initial={animate ? { left: "0%" } : { left: probPct }}
          animate={{ left: probPct }}
          transition={{ duration: 0.8, ease: [0.34, 1.2, 0.64, 1] }}
          style={{
            position: "absolute",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            backgroundColor: color,
            border: "3px solid var(--color-surface)",
            boxShadow: `0 0 0 2px ${color}44, 0 2px 8px rgba(0,0,0,0.16)`,
            zIndex: 4,
          }}
        />
      </div>

      {/* Annotations */}
      <div
        style={{
          position: "relative",
          height: "28px",
          marginTop: "4px",
        }}
      >
        {/* 0% */}
        <span
          style={{
            position: "absolute",
            left: "0%",
            fontSize: "0.6875rem",
            color: "var(--color-text-tertiary)",
            transform: "translateX(0)",
          }}
        >
          0%
        </span>

        {/* Threshold label */}
        <motion.span
          initial={animate ? { opacity: 0 } : { opacity: 1 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          style={{
            position: "absolute",
            left: threshPct,
            fontSize: "0.6875rem",
            color: "var(--color-text-secondary)",
            fontWeight: 600,
            transform: "translateX(-50%)",
            whiteSpace: "nowrap",
          }}
        >
          ↑ Threshold {(thresh * 100).toFixed(0)}%
        </motion.span>

        {/* 100% */}
        <span
          style={{
            position: "absolute",
            right: "0%",
            fontSize: "0.6875rem",
            color: "var(--color-text-tertiary)",
          }}
        >
          100%
        </span>
      </div>

      {/* Probability callout */}
      <motion.div
        initial={animate ? { opacity: 0, y: 6 } : { opacity: 1, y: 0 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.625rem",
          marginTop: "0.75rem",
          padding: "0.625rem 1rem",
          backgroundColor: `${color}12`,
          border: `1px solid ${color}33`,
          borderRadius: "var(--radius-md)",
        }}
      >
        <div
          style={{
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            backgroundColor: color,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
            Fraud probability:{" "}
          </span>
          <span
            style={{
              fontSize: "0.9375rem",
              fontWeight: 800,
              color,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.02em",
            }}
          >
            {(prob * 100).toFixed(2)}%
          </span>
        </div>
        <span
          style={{
            fontSize: "0.6875rem",
            fontWeight: 700,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color,
            background: `${color}14`,
            border: `1px solid ${color}33`,
            padding: "0.2rem 0.5rem",
            borderRadius: "3px",
          }}
        >
          {riskLevel === "LOW" ? "Low Risk" : riskLevel === "REVIEW" ? "Review" : "High Risk"}
        </span>
      </motion.div>
    </div>
  );
}
