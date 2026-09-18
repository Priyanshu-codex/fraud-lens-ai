"use client";

import { useEffect, useState } from "react";
import { api, type HealthResponse } from "@/lib/api";

interface HeaderProps {
  title: string;
  description?: string;
}

export function Header({ title, description }: HeaderProps) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.health()
      .then(setHealth)
      .catch(() => setError(true));
  }, []);

  return (
    <header
      style={{
        backgroundColor: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
        padding: "0 2rem",
        height: "60px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 30,
      }}
    >
      <div>
        <h1
          style={{
            fontSize: "1.0625rem",
            fontWeight: 600,
            color: "var(--color-text-primary)",
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </h1>
        {description && (
          <p
            style={{
              fontSize: "0.8125rem",
              color: "var(--color-text-tertiary)",
              margin: 0,
            }}
          >
            {description}
          </p>
        )}
      </div>

      {/* Status indicators */}
      <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
        {health !== null ? (
          <>
            <StatusPill
              label="API"
              status={health.status === "ok" ? "connected" : "degraded"}
            />
            <StatusPill
              label="Model"
              status={health.model_loaded ? "ready" : "offline"}
            />
            <span
              style={{
                fontSize: "0.8125rem",
                color: "var(--color-text-tertiary)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {health.model_version}
            </span>
          </>
        ) : error ? (
          <StatusPill label="API" status="error" />
        ) : (
          <div className="skeleton" style={{ width: "120px", height: "20px" }} />
        )}
      </div>
    </header>
  );
}

function StatusPill({ label, status }: { label: string; status: string }) {
  const configs: Record<string, { color: string; bg: string; dot: string }> = {
    connected: { color: "var(--color-risk-low)", bg: "var(--color-risk-low-bg)", dot: "var(--color-risk-low)" },
    ready: { color: "var(--color-risk-low)", bg: "var(--color-risk-low-bg)", dot: "var(--color-risk-low)" },
    degraded: { color: "var(--color-risk-review)", bg: "var(--color-risk-review-bg)", dot: "var(--color-risk-review)" },
    offline: { color: "var(--color-risk-high)", bg: "var(--color-risk-high-bg)", dot: "var(--color-risk-high)" },
    error: { color: "var(--color-risk-high)", bg: "var(--color-risk-high-bg)", dot: "var(--color-risk-high)" },
  };
  const cfg = configs[status] || configs.error;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.375rem",
        padding: "0.25rem 0.625rem",
        borderRadius: "4px",
        backgroundColor: cfg.bg,
        fontSize: "0.75rem",
        fontWeight: 600,
        color: cfg.color,
      }}
    >
      <div
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          backgroundColor: cfg.dot,
        }}
      />
      <span>{label}</span>
      <span style={{ textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.7 }}>
        {status}
      </span>
    </div>
  );
}
