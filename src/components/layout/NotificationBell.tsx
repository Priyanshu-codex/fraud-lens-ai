"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Check,
  CheckCheck,
  AlertTriangle,
  ExternalLink,
  ShieldAlert,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { api, type NotificationItem } from "@/lib/api";
import { formatProbability, formatCurrencyINR } from "@/lib/utils";

export function NotificationBell() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async (quiet = false) => {
    if (!quiet) {
      setIsLoading(true);
      setError(null);
    }
    try {
      const res = await api.listNotifications(false, 30);
      setNotifications(res.items);
      setUnreadCount(res.unread_count);
    } catch (err: unknown) {
      if (!quiet) {
        setError(err instanceof Error ? err.message : "Failed to load alerts");
      }
    } finally {
      if (!quiet) setIsLoading(false);
    }
  }, []);

  // Initial load & periodic polling every 12 seconds
  useEffect(() => {
    const initialTimer = setTimeout(() => {
      fetchNotifications(true);
    }, 0);
    const interval = setInterval(() => {
      fetchNotifications(true);
    }, 12000);

    const handleAnalysisCreated = () => {
      fetchNotifications(true);
    };
    window.addEventListener("fraudlens:analysis-created", handleAnalysisCreated);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      window.removeEventListener("fraudlens:analysis-created", handleAnalysisCreated);
    };
  }, [fetchNotifications]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Escape key to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const [pendingReadIds, setPendingReadIds] = useState<Set<string>>(new Set());
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const item = notifications.find((n) => n.id === id);
    if (!item || item.is_read || pendingReadIds.has(id)) return;

    setPendingReadIds((prev) => new Set(prev).add(id));
    try {
      await api.markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    } finally {
      setPendingReadIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0 || isMarkingAll) return;
    setIsMarkingAll(true);
    try {
      await api.markAllNotificationsAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all as read", err);
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleOpenInvestigation = (n: NotificationItem) => {
    if (!n.is_read) {
      handleMarkAsRead(n.id);
    }
    setIsOpen(false);
    if (n.investigation_id) {
      router.push(`/investigations?id=${n.investigation_id}`);
    } else {
      router.push("/investigations");
    }
  };

  const displayedItems = activeTab === "unread" ? notifications.filter((n) => !n.is_read) : notifications;

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          if (!isOpen) fetchNotifications(true);
        }}
        aria-label={`Notifications (${unreadCount} unread)`}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "36px",
          height: "36px",
          borderRadius: "8px",
          border: "1px solid var(--color-border)",
          backgroundColor: isOpen ? "var(--color-surface-hover)" : "var(--color-surface)",
          color: unreadCount > 0 ? "var(--color-risk-high)" : "var(--color-text-secondary)",
          cursor: "pointer",
          transition: "all 0.15s ease",
        }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: "-4px",
              right: "-4px",
              minWidth: "18px",
              height: "18px",
              padding: "0 4px",
              borderRadius: "9px",
              backgroundColor: "var(--color-risk-high)",
              color: "#ffffff",
              fontSize: "0.6875rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 8px rgba(193, 50, 31, 0.5)",
              border: "2px solid var(--color-surface)",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 8px)",
              width: "380px",
              maxWidth: "calc(100vw - 2rem)",
              maxHeight: "520px",
              display: "flex",
              flexDirection: "column",
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "12px",
              boxShadow: "0 12px 36px rgba(0, 0, 0, 0.28)",
              zIndex: 100,
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "0.875rem 1rem",
                borderBottom: "1px solid var(--color-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "var(--color-surface)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <ShieldAlert size={18} color="var(--color-risk-high)" />
                <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--color-text-primary)" }}>
                  Fraud Alerts
                </span>
                {unreadCount > 0 && (
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      backgroundColor: "var(--color-risk-high-bg)",
                      color: "var(--color-risk-high)",
                      border: "1px solid var(--color-risk-high-border)",
                      padding: "0.125rem 0.375rem",
                      borderRadius: "10px",
                    }}
                  >
                    {unreadCount} new
                  </span>
                )}
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  disabled={isMarkingAll}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    background: "none",
                    border: "none",
                    color: "var(--color-primary, #3b82f6)",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: isMarkingAll ? "not-allowed" : "pointer",
                    padding: "0.25rem 0.5rem",
                    borderRadius: "4px",
                    opacity: isMarkingAll ? 0.6 : 1,
                  }}
                  title="Mark all as read"
                >
                  <CheckCheck size={14} />
                  <span>{isMarkingAll ? "Marking..." : "Mark all read"}</span>
                </button>
              )}
            </div>

            {/* Tabs (All / Unread) */}
            <div
              style={{
                display: "flex",
                padding: "0.375rem 0.75rem",
                gap: "0.5rem",
                borderBottom: "1px solid var(--color-border)",
                backgroundColor: "var(--color-bg)",
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                style={{
                  flex: 1,
                  padding: "0.3125rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: activeTab === "all" ? "var(--color-surface)" : "transparent",
                  color: activeTab === "all" ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                  boxShadow: activeTab === "all" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("unread")}
                style={{
                  flex: 1,
                  padding: "0.3125rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: activeTab === "unread" ? "var(--color-surface)" : "transparent",
                  color: activeTab === "unread" ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                  boxShadow: activeTab === "unread" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                Unread ({unreadCount})
              </button>
            </div>

            {/* Body / List */}
            <div
              style={{
                overflowY: "auto",
                flex: 1,
                maxHeight: "360px",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {isLoading && notifications.length === 0 ? (
                <div style={{ padding: "2.5rem 1rem", textAlign: "center", color: "var(--color-text-tertiary)" }}>
                  <Loader2 size={24} className="animate-spin" style={{ margin: "0 auto 0.5rem" }} />
                  <p style={{ fontSize: "0.8125rem", margin: 0 }}>Checking for real-time alerts…</p>
                </div>
              ) : error ? (
                <div style={{ padding: "2rem 1rem", textAlign: "center" }}>
                  <AlertTriangle size={24} color="var(--color-risk-review)" style={{ margin: "0 auto 0.5rem" }} />
                  <p style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", margin: "0 0 0.75rem" }}>
                    {error}
                  </p>
                  <button
                    type="button"
                    onClick={() => fetchNotifications()}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.375rem",
                      padding: "0.375rem 0.75rem",
                      borderRadius: "6px",
                      border: "1px solid var(--color-border)",
                      background: "var(--color-surface)",
                      fontSize: "0.75rem",
                      color: "var(--color-text-primary)",
                      cursor: "pointer",
                    }}
                  >
                    <RefreshCw size={12} /> Retry
                  </button>
                </div>
              ) : displayedItems.length === 0 ? (
                <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "50%",
                      backgroundColor: "var(--color-risk-low-bg)",
                      border: "1px solid var(--color-risk-low-border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 0.75rem",
                      color: "var(--color-risk-low)",
                    }}
                  >
                    <Check size={22} />
                  </div>
                  <h4 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 0.25rem" }}>
                    No alerts in this view
                  </h4>
                  <p style={{ fontSize: "0.75rem", color: "var(--color-text-tertiary)", margin: 0 }}>
                    {activeTab === "unread"
                      ? "All detected high-risk fraud alerts have been reviewed."
                      : "Transactions classified as High Risk will automatically trigger alerts here."}
                  </p>
                </div>
              ) : (
                displayedItems.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleOpenInvestigation(n)}
                    style={{
                      padding: "0.875rem 1rem",
                      borderBottom: "1px solid var(--color-border)",
                      backgroundColor: n.is_read ? "transparent" : "var(--color-surface-hover)",
                      cursor: "pointer",
                      transition: "background-color 0.15s ease",
                      position: "relative",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                      {/* Anomaly Indicator */}
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          backgroundColor: n.is_read ? "transparent" : "var(--color-risk-high)",
                          marginTop: "6px",
                          flexShrink: 0,
                          boxShadow: n.is_read ? "none" : "0 0 6px var(--color-risk-high)",
                        }}
                      />

                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Title & Probability */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                          <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--color-risk-high)" }}>
                            {n.title || "Critical Fraud Alert"}
                          </span>
                          <span
                            style={{
                              fontSize: "0.6875rem",
                              fontWeight: 700,
                              fontFamily: "var(--font-mono)",
                              padding: "0.125rem 0.375rem",
                              borderRadius: "4px",
                              backgroundColor: "var(--color-risk-high-bg)",
                              color: "var(--color-risk-high)",
                              border: "1px solid var(--color-risk-high-border)",
                            }}
                          >
                            {formatProbability(n.fraud_probability)}
                          </span>
                        </div>

                        {/* Message or Details */}
                        <p
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--color-text-secondary)",
                            margin: "0.25rem 0 0.5rem",
                            lineHeight: 1.35,
                          }}
                        >
                          {n.message || `Transaction flagged with high fraud probability.`}
                        </p>

                        {/* Metadata row */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            fontSize: "0.6875rem",
                            color: "var(--color-text-tertiary)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                            {n.amount !== null && n.amount !== undefined && (
                              <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>
                                {formatCurrencyINR(n.amount)}
                              </span>
                            )}
                            {n.source && (
                              <span style={{ textTransform: "capitalize" }}>
                                {n.source.replace("_", " ")}
                              </span>
                            )}
                            <span>{formatTimestamp(n.created_at)}</span>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                            {!n.is_read && (
                              <button
                                type="button"
                                onClick={(e) => handleMarkAsRead(n.id, e)}
                                title="Mark as read"
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "var(--color-text-tertiary)",
                                  cursor: "pointer",
                                  padding: "0.25rem",
                                  borderRadius: "4px",
                                }}
                              >
                                <Check size={14} />
                              </button>
                            )}
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.125rem",
                                color: "var(--color-primary, #3b82f6)",
                                fontWeight: 600,
                              }}
                            >
                              Investigate <ExternalLink size={11} />
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "0.625rem 1rem",
                borderTop: "1px solid var(--color-border)",
                backgroundColor: "var(--color-bg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "0.6875rem",
                color: "var(--color-text-tertiary)",
              }}
            >
              <span>Automated XGBoost Risk Alerts</span>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  router.push("/investigations");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--color-text-secondary)",
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: 0,
                  textDecoration: "underline",
                }}
              >
                View Investigation Queue →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
