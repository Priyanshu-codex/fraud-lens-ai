"use client";

import { useEffect, useState } from "react";
import { api, type HealthResponse } from "@/lib/api";
import { NotificationBell } from "./NotificationBell";

interface HeaderProps {
  title: string;
  description?: string;
  onMenuToggle?: () => void;
}

export function Header({ title, description, onMenuToggle }: HeaderProps) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [connectionState, setConnectionState] = useState<
    "connecting" | "connected" | "degraded" | "temporarily_unavailable"
  >("connecting");
  const [time, setTime] = useState("");

  const checkHealth = async (isRetry = false) => {
    if (!isRetry) setConnectionState("connecting");
    try {
      const res = await api.health();
      setHealth(res);
      setConnectionState(res.status === "ok" ? "connected" : "degraded");
    } catch {
      setConnectionState("temporarily_unavailable");
      // If initial check fails, auto-retry once after 3s in case backend was finishing startup
      if (!isRetry) {
        setTimeout(() => {
          checkHealth(true);
        }, 3000);
      }
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  useEffect(() => {
    const update = () => {
      setTime(
        new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);


  return (
    <header
      style={{
        backgroundColor: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
        padding: "0 2rem",
        height: "58px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 30,
        gap: "1rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", minWidth: 0 }}>
        {/* Mobile menu button */}
        <button
          onClick={onMenuToggle}
          aria-label="Open navigation"
          style={{
            display: "none",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0.25rem",
            color: "var(--color-text-secondary)",
          }}
          className="mobile-menu-btn"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              fontSize: "0.9375rem",
              fontWeight: 700,
              color: "var(--color-text-primary)",
              margin: 0,
              letterSpacing: "-0.015em",
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </h1>
          {description && (
            <p
              style={{
                fontSize: "0.75rem",
                color: "var(--color-text-tertiary)",
                margin: 0,
                lineHeight: 1.3,
                fontWeight: 400,
              }}
            >
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Right: Status + notifications + time */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.875rem", flexShrink: 0 }}>
        {/* Real-time Fraud Notification Bell */}
        <NotificationBell />

        {/* Live clock */}
        {time && (
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--color-text-tertiary)",
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.04em",
            }}
          >
            {time}
          </span>
        )}

        {/* Status pills */}
        {connectionState === "connected" && health !== null ? (
          <>
            <StatusPill
              label="API"
              status="connected"
              onClick={() => checkHealth(true)}
            />
            <StatusPill
              label="Model"
              status={health.model_loaded ? "ready" : "offline"}
              modelName={health.model_loaded ? health.model_name : undefined}
            />
          </>
        ) : connectionState === "degraded" && health !== null ? (
          <>
            <StatusPill
              label="API"
              status="degraded"
              onClick={() => checkHealth(true)}
            />
            <StatusPill
              label="Model"
              status={health.model_loaded ? "ready" : "offline"}
              modelName={health.model_loaded ? health.model_name : undefined}
            />
          </>
        ) : connectionState === "connecting" ? (
          <StatusPill label="API" status="connecting" />
        ) : (
          <StatusPill
            label="API"
            status="temporarily_unavailable"
            onClick={() => checkHealth(true)}
          />
        )}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </header>
  );
}

function StatusPill({
  label,
  status,
  modelName,
  onClick,
}: {
  label: string;
  status: string;
  modelName?: string;
  onClick?: () => void;
}) {
  const configs: Record<string, { color: string; bg: string; dot: string; text: string }> = {
    connected: { color: "var(--color-risk-low)", bg: "var(--color-risk-low-bg)", dot: "var(--color-risk-low)", text: "CONNECTED" },
    ready:     { color: "var(--color-risk-low)", bg: "var(--color-risk-low-bg)", dot: "var(--color-risk-low)", text: "READY" },
    connecting: { color: "#F59E0B", bg: "rgba(245, 158, 11, 0.12)", dot: "#F59E0B", text: "CONNECTING..." },
    degraded:  { color: "var(--color-risk-review)", bg: "var(--color-risk-review-bg)", dot: "var(--color-risk-review)", text: "DEGRADED" },
    offline:   { color: "var(--color-risk-high)", bg: "var(--color-risk-high-bg)", dot: "var(--color-risk-high)", text: "OFFLINE" },
    temporarily_unavailable: { color: "var(--color-risk-high)", bg: "var(--color-risk-high-bg)", dot: "var(--color-risk-high)", text: "TEMPORARILY UNAVAILABLE (RETRY)" },
    error:     { color: "var(--color-risk-high)", bg: "var(--color-risk-high-bg)", dot: "var(--color-risk-high)", text: "ERROR" },
  };
  const cfg = configs[status] || configs.error;

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.375rem",
        padding: "0.25rem 0.625rem",
        borderRadius: "5px",
        backgroundColor: cfg.bg,
        border: `1px solid ${cfg.dot}33`,
        fontSize: "0.6875rem",
        fontWeight: 700,
        color: cfg.color,
        letterSpacing: "0.05em",
        whiteSpace: "nowrap",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div
        className={status === "ready" || status === "connected" ? "status-dot-live" : undefined}
        style={{
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          backgroundColor: cfg.dot,
          flexShrink: 0,
        }}
      />
      <span>{label}</span>
      {modelName ? (
        <span style={{ opacity: 0.7, fontFamily: "var(--font-mono)", fontWeight: 500 }}>
          {modelName.split(" ")[0]}
        </span>
      ) : (
        <span style={{ opacity: 0.65 }}>{cfg.text}</span>
      )}
    </div>
  );
}
