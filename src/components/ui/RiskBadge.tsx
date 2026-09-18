import { RiskLevel, RISK_CONFIG } from "@/lib/utils";

interface RiskBadgeProps {
  level: RiskLevel | string;
  size?: "sm" | "md" | "lg" | "xl";
  showIcon?: boolean;
  pulse?: boolean;
}

const ICONS: Record<RiskLevel, React.ReactNode> = {
  LOW: (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  REVIEW: (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  HIGH: (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
};

const SIZES = {
  sm: { fontSize: "0.625rem", padding: "0.1875rem 0.5rem", gap: "0.25rem" },
  md: { fontSize: "0.6875rem", padding: "0.3rem 0.75rem", gap: "0.375rem" },
  lg: { fontSize: "0.75rem", padding: "0.375rem 1rem", gap: "0.5rem" },
  xl: { fontSize: "0.875rem", padding: "0.5rem 1.25rem", gap: "0.5rem" },
};

export function RiskBadge({ level, size = "md", showIcon = true, pulse = false }: RiskBadgeProps) {
  const normalizedLevel = (level as RiskLevel) in RISK_CONFIG ? (level as RiskLevel) : "REVIEW";
  const config = RISK_CONFIG[normalizedLevel];
  const sizeConfig = SIZES[size];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: sizeConfig.gap,
        padding: sizeConfig.padding,
        borderRadius: "4px",
        fontSize: sizeConfig.fontSize,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: config.text,
        backgroundColor: config.bg,
        border: `1px solid ${config.border}`,
        whiteSpace: "nowrap",
        position: "relative",
      }}
      role="status"
      aria-label={`Risk level: ${config.label}`}
    >
      {showIcon && (
        <span style={pulse && normalizedLevel === "HIGH" ? { animation: "status-pulse 1.5s ease-in-out infinite" } : undefined}>
          {ICONS[normalizedLevel]}
        </span>
      )}
      {config.label}
    </span>
  );
}
