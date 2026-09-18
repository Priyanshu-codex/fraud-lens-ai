/** FraudLens AI — Design tokens and utilities */

export const RISK_CONFIG = {
  LOW: {
    label: "Low Risk",
    color: "#236641",
    bg: "#EEF9F3",
    border: "#9ED4B9",
    text: "#236641",
  },
  REVIEW: {
    label: "Review Required",
    color: "#A64C00",
    bg: "#FFF8EE",
    border: "#FBCF8A",
    text: "#A64C00",
  },
  HIGH: {
    label: "High Risk",
    color: "#C1321F",
    bg: "#FFF4F3",
    border: "#F8BCB7",
    text: "#C1321F",
  },
} as const;

export type RiskLevel = keyof typeof RISK_CONFIG;

export function formatPercent(value: number, decimals = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatProbability(prob: number): string {
  return `${(prob * 100).toFixed(2)}%`;
}

/** Format as Indian Rupees (₹) — primary currency display in FraudLens */
export function formatCurrencyINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Format as INR without decimals for large numbers */
export function formatCurrencyINRCompact(amount: number): string {
  if (amount >= 10_000_000) {
    return `₹${(amount / 10_000_000).toFixed(2)} Cr`;
  }
  if (amount >= 100_000) {
    return `₹${(amount / 100_000).toFixed(2)} L`;
  }
  return formatCurrencyINR(amount);
}

/** Legacy — kept for compatibility but redirects to INR */
export function formatCurrency(amount: number): string {
  return formatCurrencyINR(amount);
}

/** Format number using Indian number system */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-IN").format(n);
}

export function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatTimeOnly(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

/** Generate a pseudo-unique transaction ID from amount+time for display */
export function generateTxnId(amount: number, time: number): string {
  const hash = Math.abs(Math.floor((amount * 1000 + time * 7) % 99999));
  return `TX-${String(hash).padStart(5, "0")}`;
}
