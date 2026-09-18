/** FraudLens AI — Design tokens and utilities */

export const RISK_CONFIG = {
  LOW: {
    label: "Low Risk",
    color: "#2D6A4F",
    bg: "#F0FBF5",
    border: "#A7D7C5",
    text: "#2D6A4F",
  },
  REVIEW: {
    label: "Review",
    color: "#B45309",
    bg: "#FFFBEB",
    border: "#FCD34D",
    text: "#B45309",
  },
  HIGH: {
    label: "High Risk",
    color: "#C1392B",
    bg: "#FFF5F5",
    border: "#FCA5A5",
    text: "#C1392B",
  },
} as const;

export type RiskLevel = keyof typeof RISK_CONFIG;

export function formatPercent(value: number, decimals = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatProbability(prob: number): string {
  return `${(prob * 100).toFixed(2)}%`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
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

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
