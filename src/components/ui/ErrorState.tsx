import Link from "next/link";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  apiStatus?: string;
  modelStatus?: string;
  databaseStatus?: string;
}

export function ErrorState({
  title,
  message,
  onRetry,
  apiStatus = "Offline",
  modelStatus = "Unknown",
  databaseStatus = "Unknown",
}: ErrorStateProps) {
  const isConnectionError =
    message.includes("Unable to connect") ||
    message.includes("Failed to fetch") ||
    message.includes("Connection failed") ||
    message.includes("NetworkError");

  const displayTitle = isConnectionError
    ? "FraudLens AI Service Unavailable"
    : title || "Something went wrong";

  const displaySubtitle = isConnectionError
    ? "Unable to reach the analysis service."
    : message;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "3.5rem 2rem",
        textAlign: "center",
        maxWidth: "480px",
        margin: "0 auto",
        gap: "1.25rem",
      }}
    >
      <div
        style={{
          width: "52px",
          height: "52px",
          borderRadius: "50%",
          backgroundColor: "var(--color-risk-high-bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid var(--color-risk-high-border)",
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-risk-high)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      <div>
        <div
          style={{
            fontWeight: 700,
            fontSize: "1.125rem",
            color: "var(--color-text-primary)",
            marginBottom: "0.5rem",
            letterSpacing: "-0.01em",
          }}
        >
          {displayTitle}
        </div>
        <div
          style={{
            fontSize: "0.875rem",
            color: "var(--color-text-secondary)",
            lineHeight: 1.5,
          }}
        >
          {displaySubtitle}
        </div>
      </div>

      {isConnectionError && (
        <div
          style={{
            width: "100%",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)",
            padding: "1rem 1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            fontSize: "0.8125rem",
            textAlign: "left",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--color-text-tertiary)" }}>API Status:</span>
            <span style={{ fontWeight: 600, color: "var(--color-risk-high)" }}>{apiStatus}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--color-text-tertiary)" }}>Model Status:</span>
            <span style={{ fontWeight: 600, color: "var(--color-text-secondary)" }}>{modelStatus}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--color-text-tertiary)" }}>Database Status:</span>
            <span style={{ fontWeight: 600, color: "var(--color-text-secondary)" }}>{databaseStatus}</span>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
        {onRetry && (
          <button className="btn btn-primary btn-sm" onClick={onRetry}>
            Retry Connection
          </button>
        )}
        <Link href="/settings" className="btn btn-secondary btn-sm">
          Open System Health
        </Link>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "3rem 2rem",
        textAlign: "center",
        gap: "0.75rem",
      }}
    >
      <div
        style={{
          width: "44px",
          height: "44px",
          borderRadius: "50%",
          backgroundColor: "var(--color-surface-2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid var(--color-border)",
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-text-tertiary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="9" y1="9" x2="15" y2="15" />
          <line x1="15" y1="9" x2="9" y2="15" />
        </svg>
      </div>
      <div>
        <div
          style={{
            fontWeight: 600,
            fontSize: "0.9375rem",
            color: "var(--color-text-primary)",
            marginBottom: "0.25rem",
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: "0.875rem", color: "var(--color-text-tertiary)" }}>
          {message}
        </div>
      </div>
    </div>
  );
}
