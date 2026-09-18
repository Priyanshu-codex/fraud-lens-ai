"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { useMobileMenu } from "@/app/(app)/layout";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { RiskSpectrum } from "@/components/ui/RiskSpectrum";
import { MetricBar } from "@/components/ui/MetricBar";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  api,
  type ExplainResponse,
  type SamplesResponse,
  type InvestigationRecord,
  type TransactionInput,
} from "@/lib/api";
import { formatCurrencyINR, generateTxnId } from "@/lib/utils";

export default function InvestigationsPage() {
  return (
    <Suspense
      fallback={
        <div style={{ flex: 1, padding: "3rem", textAlign: "center", color: "var(--color-text-secondary)" }}>
          Initializing Investigation Workspace…
        </div>
      }
    >
      <InvestigationsContent />
    </Suspense>
  );
}

function InvestigationsContent() {
  const searchParams = useSearchParams();
  const requestedId = searchParams.get("id");

  const [samples, setSamples] = useState<SamplesResponse | null>(null);
  const [selected, setSelected] = useState<"fraud" | "legitimate" | "persisted" | null>(null);
  const [result, setResult] = useState<ExplainResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timestamps, setTimestamps] = useState<string[]>([]);
  const { onMenuToggle } = useMobileMenu();

  // Database investigations queue
  const [dbInvestigations, setDbInvestigations] = useState<InvestigationRecord[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [activeInvestigation, setActiveInvestigation] = useState<InvestigationRecord | null>(null);
  const [txDetails, setTxDetails] = useState<{ amount: number; time: number; id: string; source?: string } | null>(null);

  // Case management form state
  const [caseStatus, setCaseStatus] = useState<"OPEN" | "UNDER_REVIEW" | "RESOLVED">("OPEN");
  const [caseNotes, setCaseNotes] = useState<string>("");
  const [isSavingCase, setIsSavingCase] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Refresh DB investigations list
  const refreshDbInvestigations = useCallback(async () => {
    setLoadingQueue(true);
    try {
      const list = await api.listInvestigations();
      setDbInvestigations(list);
    } catch (e) {
      console.error("Could not fetch investigations queue:", e);
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  // Load an investigation from DB by record or ID
  const loadDbInvestigation = useCallback(async (invId: string) => {
    setLoading(true);
    setError(null);
    setSelected("persisted");
    setSaveMessage(null);

    try {
      const inv = await api.getInvestigation(invId);
      setActiveInvestigation(inv);
      setCaseStatus(inv.status);
      setCaseNotes(inv.notes || "");

      if (inv.analysis) {
        const a = inv.analysis;
        const persistedExplain: ExplainResponse = {
          fraud_probability: a.fraud_probability,
          prediction: a.prediction,
          risk_level: a.risk_level,
          threshold: a.threshold,
          model_name: a.model_name,
          model_version: a.model_version,
          top_contributions: a.evidence || [],
          disclaimer: "Feature contributions describe model behavior and are not proof of fraudulent activity.",
          analysis_id: a.id,
          investigation_id: inv.id,
        };
        setResult(persistedExplain);
        setTxDetails({
          amount: a.amount,
          time: a.time,
          id: a.transaction_id,
          source: a.source,
        });

        const createdDate = new Date(inv.created_at);
        const fmt = (d: Date) =>
          d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
        setTimestamps([
          fmt(createdDate),
          fmt(new Date(createdDate.getTime() + 45)),
          fmt(new Date(createdDate.getTime() + 160)),
          fmt(new Date(createdDate.getTime() + 230)),
          fmt(new Date(createdDate.getTime() + 310)),
        ]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load investigation");
    } finally {
      setLoading(false);
    }
  }, []);

  // On initial mount
  useEffect(() => {
    let ignore = false;
    api.samples().then((s) => {
      if (!ignore) setSamples(s);
    }).catch(console.error);

    api.listInvestigations().then((list) => {
      if (!ignore) setDbInvestigations(list);
    }).catch((e) => {
      console.error("Could not fetch investigations queue:", e);
    });

    // Check if user navigated with ?id=
    if (requestedId) {
      api.getInvestigation(requestedId).then((inv) => {
        if (ignore) return;
        setActiveInvestigation(inv);
        setCaseStatus(inv.status);
        setCaseNotes(inv.notes || "");
        setSelected("persisted");
        if (inv.analysis) {
          const a = inv.analysis;
          const persistedExplain: ExplainResponse = {
            fraud_probability: a.fraud_probability,
            prediction: a.prediction,
            risk_level: a.risk_level,
            threshold: a.threshold,
            model_name: a.model_name,
            model_version: a.model_version,
            top_contributions: a.evidence || [],
            disclaimer: "Feature contributions describe model behavior and are not proof of fraudulent activity.",
            analysis_id: a.id,
            investigation_id: inv.id,
          };
          setResult(persistedExplain);
          setTxDetails({
            amount: a.amount,
            time: a.time,
            id: a.transaction_id,
            source: a.source,
          });

          const createdDate = new Date(inv.created_at);
          const fmt = (d: Date) =>
            d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
          setTimestamps([
            fmt(createdDate),
            fmt(new Date(createdDate.getTime() + 45)),
            fmt(new Date(createdDate.getTime() + 160)),
            fmt(new Date(createdDate.getTime() + 230)),
            fmt(new Date(createdDate.getTime() + 310)),
          ]);
        }
      }).catch((err: unknown) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load investigation");
        }
      });
      return () => {
        ignore = true;
      };
    }

    // Check session storage from Analyzer
    const restoreTimer = setTimeout(() => {
      try {
        const stored = sessionStorage.getItem("fraudlens_investigation_txn");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.result) {
            const res: ExplainResponse = parsed.result;
            setResult(res);
            setSelected(parsed.datasetLabel === "FRAUD" ? "fraud" : parsed.datasetLabel === "LEGITIMATE" ? "legitimate" : "persisted");
            if (parsed.transaction) {
              setTxDetails({
                amount: parsed.transaction.Amount,
                time: parsed.transaction.Time,
                id: res.analysis_id || generateTxnId(parsed.transaction.Amount, parsed.transaction.Time),
                source: parsed.datasetLabel?.toLowerCase(),
              });
            }
            const t0 = new Date(parsed.timestamp || Date.now());
            const fmt = (d: Date) =>
              d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
            setTimestamps([
              fmt(t0),
              fmt(new Date(t0.getTime() + 50)),
              fmt(new Date(t0.getTime() + 180)),
              fmt(new Date(t0.getTime() + 250)),
              fmt(new Date(t0.getTime() + 320)),
            ]);

            // If result has investigation_id from backend persistence, fetch the DB case
            if (res.investigation_id) {
              api.getInvestigation(res.investigation_id).then((inv) => {
                if (!ignore) {
                  setActiveInvestigation(inv);
                  setCaseStatus(inv.status);
                  setCaseNotes(inv.notes || "");
                }
              }).catch(console.error);
            }

            sessionStorage.removeItem("fraudlens_investigation_txn");
          }
        }
      } catch (err) {
        console.error("Failed to restore investigation", err);
      }
    }, 0);

    return () => {
      ignore = true;
      clearTimeout(restoreTimer);
    };
  }, [requestedId]);

  // Investigate real test sample button handler
  const investigate = useCallback(
    async (type: "fraud" | "legitimate") => {
      if (!samples) return;
      setLoading(true);
      setError(null);
      setSelected(type);
      setResult(null);
      setTimestamps([]);
      setActiveInvestigation(null);
      setSaveMessage(null);

      const baseTxn = type === "fraud" ? samples.fraud[0] : samples.legitimate[0];
      const txn: TransactionInput = {
        ...baseTxn,
        source: type === "fraud" ? "fraud_sample" : "legitimate_sample",
      };
      const t0 = new Date();
      const fmt = (d: Date) =>
        d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

      try {
        const r = await api.explain(txn);
        const t1 = new Date();
        setResult(r);
        setTxDetails({
          amount: txn.Amount,
          time: txn.Time,
          id: r.analysis_id || generateTxnId(txn.Amount, txn.Time),
          source: txn.source,
        });
        setTimestamps([
          fmt(t0),
          fmt(new Date(t0.getTime() + 50)),
          fmt(new Date(t0.getTime() + 180)),
          fmt(new Date(t1.getTime() - 80)),
          fmt(t1),
        ]);

        // If backend returned persisted investigation_id, load it
        if (r.investigation_id) {
          const inv = await api.getInvestigation(r.investigation_id);
          setActiveInvestigation(inv);
          setCaseStatus(inv.status);
          setCaseNotes(inv.notes || "");
          refreshDbInvestigations();
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Investigation failed");
      } finally {
        setLoading(false);
      }
    },
    [samples, refreshDbInvestigations]
  );

  // Update investigation case in DB
  const handleSaveInvestigation = async () => {
    if (!activeInvestigation) return;
    setIsSavingCase(true);
    setSaveMessage(null);
    try {
      const updated = await api.updateInvestigation(activeInvestigation.id, {
        status: caseStatus,
        notes: caseNotes,
        reviewed_by: "Analyst",
      });
      setActiveInvestigation(updated);
      setSaveMessage("Case updated and saved to database ✓");
      refreshDbInvestigations();
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to update case");
    } finally {
      setIsSavingCase(false);
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <Header
        title="Investigation Workspace"
        description="Forensic transaction analysis — evidence-driven risk review & database case tracking"
        onMenuToggle={onMenuToggle}
      />
      <main style={{ flex: 1, padding: "2rem", maxWidth: "1440px", width: "100%" }}>
        {/* ── Launch bar ─────────────────────────────────────────────────── */}
        <div
          className="card"
          style={{
            padding: "1.375rem",
            marginBottom: "1.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div>
            <div className="intelligence-label" style={{ marginBottom: "0.25rem" }}>
              Run New Forensic Sample
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
              Run ML inference and SHAP explainability on a genuine dataset sample
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              className="btn btn-secondary"
              onClick={() => investigate("legitimate")}
              disabled={loading || !samples}
            >
              Investigate Legitimate Sample
            </button>
            <button
              onClick={() => investigate("fraud")}
              disabled={loading || !samples}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.625rem 1.375rem",
                borderRadius: "var(--radius-md)",
                fontSize: "0.9375rem",
                fontWeight: 600,
                cursor: "pointer",
                border: "2px solid var(--color-risk-high-border)",
                backgroundColor: "var(--color-risk-high-bg)",
                color: "var(--color-risk-high)",
                transition: "all 0.15s ease",
                letterSpacing: "-0.01em",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--color-risk-high)";
                (e.currentTarget as HTMLButtonElement).style.color = "white";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--color-risk-high-bg)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--color-risk-high)";
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Investigate Fraud Sample
            </button>
          </div>
        </div>

        {/* ── Persistent Database Investigations Queue ────────────────────── */}
        <div
          className="card"
          style={{
            padding: "1.125rem 1.375rem",
            marginBottom: "1.75rem",
            background: "var(--color-surface)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "var(--color-risk-low)",
                  boxShadow: "0 0 8px var(--color-risk-low)",
                }}
              />
              <span className="intelligence-label" style={{ color: "var(--color-text-primary)" }}>
                Database Investigation Queue
              </span>
            </div>
            <button
              onClick={refreshDbInvestigations}
              disabled={loadingQueue}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "0.75rem",
                color: "var(--color-brand)",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {loadingQueue ? "Refreshing…" : "↻ Refresh Queue"}
            </button>
          </div>

          {dbInvestigations.length === 0 ? (
            <div style={{ fontSize: "0.8125rem", color: "var(--color-text-tertiary)", padding: "0.5rem 0" }}>
              No transactions analyzed yet. Run an analysis in the Transaction Analyzer or select a sample above to persist cases into the database.
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                gap: "0.625rem",
                overflowX: "auto",
                paddingBottom: "0.375rem",
              }}
            >
              {dbInvestigations.map((inv) => {
                const isActive = activeInvestigation?.id === inv.id;
                const risk = inv.analysis?.risk_level || "LOW";
                const amount = inv.analysis?.amount || 0;
                return (
                  <button
                    key={inv.id}
                    onClick={() => loadDbInvestigation(inv.id)}
                    style={{
                      padding: "0.5rem 0.875rem",
                      borderRadius: "var(--radius-sm)",
                      border: isActive
                        ? "1.5px solid var(--color-brand)"
                        : "1px solid var(--color-border)",
                      background: isActive ? "var(--color-surface-2)" : "var(--color-surface)",
                      textAlign: "left",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      transition: "all 0.15s ease",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.25rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <RiskBadge level={risk} size="sm" />
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          fontFamily: "var(--font-mono)",
                          color: "var(--color-text-primary)",
                        }}
                      >
                        {formatCurrencyINR(amount)}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          color:
                            inv.status === "RESOLVED"
                              ? "var(--color-risk-low)"
                              : inv.status === "UNDER_REVIEW"
                              ? "var(--color-risk-review)"
                              : "var(--color-risk-high)",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {inv.status}
                      </span>
                      <span
                        style={{
                          fontSize: "0.625rem",
                          color: "var(--color-text-tertiary)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {inv.id.slice(0, 8)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {loading && (
          <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                border: "3px solid var(--color-border)",
                borderTopColor: "var(--color-brand)",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 1.25rem",
              }}
            />
            <div style={{ fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "0.375rem" }}>
              Loading Forensic Investigation
            </div>
            <div style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
              Retrieving transaction features, XGBoost prediction, and SHAP evidence from database…
            </div>
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────────────────── */}
        {error && (
          <ErrorState
            title="Investigation failed"
            message={error}
            onRetry={() => {
              if (selected === "fraud" || selected === "legitimate") {
                investigate(selected);
              } else if (activeInvestigation) {
                loadDbInvestigation(activeInvestigation.id);
              }
            }}
          />
        )}

        {/* ── Empty ───────────────────────────────────────────────────────── */}
        {!loading && !result && !error && (
          <div className="card" style={{ padding: "4rem 2rem", textAlign: "center" }}>
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.5rem",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-border-strong)" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--color-text-primary)", marginBottom: "0.5rem" }}>
              No investigation open
            </div>
            <div style={{ fontSize: "0.875rem", color: "var(--color-text-tertiary)", maxWidth: "340px", margin: "0 auto" }}>
              Select an existing transaction from the queue above, or click a sample button to begin a detailed forensic review.
            </div>
          </div>
        )}

        {/* ── Investigation detail ─────────────────────────────────────────── */}
        {result && timestamps.length > 0 && !loading && (
          <AnimatePresence>
            <InvestigationDetail
              result={result}
              timestamps={timestamps}
              groundTruth={selected === "persisted" ? null : selected}
              samples={samples}
              txDetails={txDetails}
              activeInvestigation={activeInvestigation}
              caseStatus={caseStatus}
              setCaseStatus={setCaseStatus}
              caseNotes={caseNotes}
              setCaseNotes={setCaseNotes}
              onSaveCase={handleSaveInvestigation}
              isSavingCase={isSavingCase}
              saveMessage={saveMessage}
            />
          </AnimatePresence>
        )}
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ─── Investigation detail layout ──────────────────────────────────────────── */
function InvestigationDetail({
  result,
  timestamps,
  groundTruth,
  samples,
  txDetails,
  activeInvestigation,
  caseStatus,
  setCaseStatus,
  caseNotes,
  setCaseNotes,
  onSaveCase,
  isSavingCase,
  saveMessage,
}: {
  result: ExplainResponse;
  timestamps: string[];
  groundTruth: "fraud" | "legitimate" | null;
  samples: SamplesResponse | null;
  txDetails: { amount: number; time: number; id: string; source?: string } | null;
  activeInvestigation: InvestigationRecord | null;
  caseStatus: "OPEN" | "UNDER_REVIEW" | "RESOLVED";
  setCaseStatus: (status: "OPEN" | "UNDER_REVIEW" | "RESOLVED") => void;
  caseNotes: string;
  setCaseNotes: (notes: string) => void;
  onSaveCase: () => Promise<void>;
  isSavingCase: boolean;
  saveMessage: string | null;
}) {
  const prob = result.fraud_probability;
  const threshold = result.threshold;
  const isFraud = result.prediction === "FRAUD";

  const riskColor =
    result.risk_level === "HIGH"
      ? "var(--color-risk-high)"
      : result.risk_level === "REVIEW"
      ? "var(--color-risk-review)"
      : "var(--color-risk-low)";

  const contributions = result.top_contributions.slice(0, 10);
  const fraudContribs = contributions.filter((c) => c.direction === "fraud");
  const legitContribs = contributions.filter((c) => c.direction === "legitimate");
  const maxAbs = Math.max(...contributions.map((c) => Math.abs(c.contribution)), 0.01);

  // Determine metadata values
  const amount = txDetails ? txDetails.amount : groundTruth === "fraud" ? samples?.fraud[0]?.Amount || 0 : groundTruth === "legitimate" ? samples?.legitimate[0]?.Amount || 0 : 0;
  const timeVal = txDetails ? txDetails.time : groundTruth === "fraud" ? samples?.fraud[0]?.Time || 0 : groundTruth === "legitimate" ? samples?.legitimate[0]?.Time || 0 : 0;
  const txnId = txDetails ? (txDetails.id.startsWith("TX-") ? txDetails.id : `TX-${txDetails.id.slice(0, 8)}`) : generateTxnId(amount, timeVal);

  const timelineEvents = [
    { label: "Transaction Ingested", icon: "▷", color: "var(--color-accent)" },
    { label: "Input Validated — 30 PCA Features", icon: "✓", color: "var(--color-accent)" },
    { label: "XGBoost Model Inference", icon: "⟳", color: "var(--color-risk-review)" },
    { label: `Risk Classified: ${result.risk_level}`, icon: "◉", color: riskColor },
    { label: "SHAP Explainability Computed", icon: "✦", color: "var(--color-risk-low)" },
  ];

  const containerAnim: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.09 } } };
  const itemAnim: Variants = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

  return (
    <motion.div
      variants={containerAnim}
      initial="hidden"
      animate="show"
      style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
    >
      {/* ── Top: Transaction ID bar ─────────────────────────────────────── */}
      <motion.div
        variants={itemAnim}
        className="card"
        style={{
          padding: "1rem 1.375rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
              fontSize: "1.125rem",
              color: "var(--color-text-primary)",
              letterSpacing: "-0.01em",
            }}
          >
            {txnId}
          </div>
          <RiskBadge level={result.risk_level} size="lg" pulse={result.risk_level === "HIGH"} />

          {activeInvestigation && (
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                padding: "0.25rem 0.625rem",
                borderRadius: "4px",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                background:
                  caseStatus === "RESOLVED"
                    ? "var(--color-risk-low-bg)"
                    : caseStatus === "UNDER_REVIEW"
                    ? "var(--color-risk-review-bg)"
                    : "var(--color-risk-high-bg)",
                color:
                  caseStatus === "RESOLVED"
                    ? "var(--color-risk-low)"
                    : caseStatus === "UNDER_REVIEW"
                    ? "var(--color-risk-review)"
                    : "var(--color-risk-high)",
                border: `1px solid ${
                  caseStatus === "RESOLVED"
                    ? "var(--color-risk-low-border)"
                    : caseStatus === "UNDER_REVIEW"
                    ? "var(--color-risk-review-border)"
                    : "var(--color-risk-high-border)"
                }`,
              }}
            >
              Case: {caseStatus}
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--color-text-tertiary)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {result.model_name} · {result.model_version}
          {result.analysis_id && ` · Analysis #${result.analysis_id.slice(0, 8)}`}
        </div>
      </motion.div>

      {/* ── Three-column main layout ────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.1fr 1.2fr",
          gap: "1.25rem",
          alignItems: "start",
        }}
        className="investigation-grid"
      >
        {/* LEFT: Transaction identity + Case Management + Timeline */}
        <motion.div variants={itemAnim} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Transaction identity */}
          <div className="card" style={{ padding: "1.375rem" }}>
            <div className="intelligence-label" style={{ marginBottom: "1rem" }}>
              Transaction Identity
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <InfoRow label="Transaction ID" value={txnId} mono />
              <InfoRow label="Amount" value={formatCurrencyINR(amount)} />
              <InfoRow label="Time Elapsed" value={`${timeVal.toFixed(0)}s`} mono />
              <InfoRow label="Feature Count" value="30 features (Time, Amount, V1–V28)" />
              {txDetails?.source && (
                <InfoRow label="Source" value={txDetails.source.toUpperCase()} mono />
              )}
              {groundTruth && (
                <div>
                  <div className="intelligence-label" style={{ marginBottom: "0.25rem" }}>
                    Ground Truth
                  </div>
                  <div
                    style={{
                      padding: "0.4375rem 0.875rem",
                      borderRadius: "4px",
                      display: "inline-block",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      letterSpacing: "0.07em",
                      textTransform: "uppercase",
                      color: groundTruth === "fraud" ? "var(--color-risk-high)" : "var(--color-risk-low)",
                      background: groundTruth === "fraud" ? "var(--color-risk-high-bg)" : "var(--color-risk-low-bg)",
                      border: `1px solid ${groundTruth === "fraud" ? "var(--color-risk-high-border)" : "var(--color-risk-low-border)"}`,
                    }}
                  >
                    {groundTruth.toUpperCase()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Database Case Management Card */}
          {activeInvestigation && (
            <div className="card" style={{ padding: "1.375rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <div className="intelligence-label">Analyst Case Review</div>
                <span
                  style={{
                    fontSize: "0.625rem",
                    fontFamily: "var(--font-mono)",
                    color: "var(--color-text-tertiary)",
                  }}
                >
                  ID: {activeInvestigation.id.slice(0, 8)}
                </span>
              </div>
              <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", marginBottom: "1rem" }}>
                Record review findings and update persistent case state in the database.
              </div>

              {/* Status Buttons */}
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "0.5rem" }}>
                  Case Status:
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.375rem" }}>
                  {(["OPEN", "UNDER_REVIEW", "RESOLVED"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setCaseStatus(st)}
                      style={{
                        padding: "0.5rem 0.25rem",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "0.6875rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        border:
                          caseStatus === st
                            ? "1.5px solid var(--color-brand)"
                            : "1px solid var(--color-border)",
                        background: caseStatus === st ? "var(--color-surface-2)" : "transparent",
                        color:
                          caseStatus === st
                            ? "var(--color-text-primary)"
                            : "var(--color-text-secondary)",
                      }}
                    >
                      {st.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes input */}
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "0.375rem" }}>
                  Forensic Notes:
                </div>
                <textarea
                  value={caseNotes}
                  onChange={(e) => setCaseNotes(e.target.value)}
                  placeholder="Enter analyst findings, merchant verification, cardholder confirmation..."
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "0.625rem",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-surface-2)",
                    color: "var(--color-text-primary)",
                    fontSize: "0.8125rem",
                    resize: "vertical",
                    outline: "none",
                  }}
                />
              </div>

              {/* Action button */}
              <button
                className="btn btn-primary"
                onClick={onSaveCase}
                disabled={isSavingCase}
                style={{ width: "100%", justifyContent: "center", fontSize: "0.875rem" }}
              >
                {isSavingCase ? "Saving to Database…" : "Save Case Status & Notes"}
              </button>

              {saveMessage && (
                <div
                  style={{
                    marginTop: "0.625rem",
                    fontSize: "0.75rem",
                    color: "var(--color-risk-low)",
                    fontWeight: 600,
                    textAlign: "center",
                  }}
                >
                  {saveMessage}
                </div>
              )}
            </div>
          )}

          {/* Investigation Timeline */}
          <div className="card" style={{ padding: "1.375rem" }}>
            <div className="intelligence-label" style={{ marginBottom: "1.125rem" }}>
              Investigation Timeline
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
              {timelineEvents.map((evt, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.35 }}
                  style={{ display: "flex", gap: "0.875rem" }}
                >
                  {/* Timeline track */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                    <div
                      style={{
                        width: "26px",
                        height: "26px",
                        borderRadius: "50%",
                        background: `${evt.color}18`,
                        border: `1.5px solid ${evt.color}44`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.625rem",
                        color: evt.color,
                        flexShrink: 0,
                        marginTop: i === 0 ? 0 : "2px",
                      }}
                    >
                      {i < timelineEvents.length - 1 ? (
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={evt.color} strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg width="8" height="8" viewBox="0 0 24 24" fill={evt.color}>
                          <circle cx="12" cy="12" r="8" />
                        </svg>
                      )}
                    </div>
                    {i < timelineEvents.length - 1 && (
                      <div style={{ width: "1px", flex: 1, background: "var(--color-border)", minHeight: "16px", margin: "3px 0" }} />
                    )}
                  </div>

                  {/* Event info */}
                  <div style={{ paddingBottom: i < timelineEvents.length - 1 ? "0.75rem" : 0, paddingTop: "2px" }}>
                    <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text-primary)", lineHeight: 1.3 }}>
                      {evt.label}
                    </div>
                    <div style={{ fontSize: "0.6875rem", color: "var(--color-text-tertiary)", fontFamily: "var(--font-mono)", marginTop: "2px" }}>
                      {timestamps[i] || "Logged"}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* CENTER: Risk Assessment */}
        <motion.div variants={itemAnim}>
          <div
            className="card"
            style={{
              padding: "1.375rem",
              borderTop: `3px solid ${riskColor}`,
            }}
          >
            <div className="intelligence-label" style={{ marginBottom: "0.375rem" }}>
              Risk Assessment
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", marginBottom: "1.25rem" }}>
              Machine learning probability vs. validated operational threshold
            </div>

            {/* Probability gauge */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "1.5rem 0",
                borderBottom: "1px solid var(--color-border)",
                marginBottom: "1.25rem",
              }}
            >
              <div
                style={{
                  fontSize: "3rem",
                  fontWeight: 900,
                  fontFamily: "var(--font-mono)",
                  color: riskColor,
                  letterSpacing: "-0.04em",
                  lineHeight: 1,
                  marginBottom: "0.375rem",
                }}
              >
                {(prob * 100).toFixed(2)}%
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--color-text-tertiary)", marginBottom: "1rem" }}>
                Fraud Probability
              </div>
              <RiskBadge level={result.risk_level} size="lg" pulse={result.risk_level === "HIGH"} />
            </div>

            {/* Risk spectrum */}
            <div style={{ marginBottom: "1.25rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.75rem",
                  color: "var(--color-text-secondary)",
                  marginBottom: "0.5rem",
                }}
              >
                <span>Probability Spectrum</span>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--color-text-primary)" }}>
                  {(prob * 100).toFixed(1)}% / {(threshold * 100).toFixed(0)}% thr
                </span>
              </div>
              <RiskSpectrum
                probability={prob}
                threshold={threshold}
                riskLevel={result.risk_level}
              />
            </div>

            {/* Decision card */}
            <div
              style={{
                padding: "0.875rem 1rem",
                borderRadius: "var(--radius-sm)",
                background: isFraud ? "var(--color-risk-high-bg)" : "var(--color-risk-low-bg)",
                border: `1px solid ${isFraud ? "var(--color-risk-high-border)" : "var(--color-risk-low-border)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: isFraud ? "var(--color-risk-high)" : "var(--color-risk-low)",
                    marginBottom: "0.25rem",
                  }}
                >
                  Model Prediction
                </div>
                <div
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 800,
                    color: isFraud ? "var(--color-risk-high)" : "var(--color-risk-low)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {result.prediction}
                </div>
              </div>
              {groundTruth && (
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.6875rem", color: "var(--color-text-tertiary)", marginBottom: "0.25rem" }}>
                    vs. Ground Truth
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color:
                        result.prediction === groundTruth.toUpperCase()
                          ? "var(--color-risk-low)"
                          : "var(--color-risk-high)",
                    }}
                  >
                    {result.prediction === groundTruth.toUpperCase() ? "✓ Correct" : "✗ Incorrect"}
                  </div>
                </div>
              )}
            </div>

            {/* Decision context */}
            <div
              style={{
                marginTop: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                paddingTop: "1rem",
                borderTop: "1px solid var(--color-border)",
              }}
            >
              {[
                { label: "Decision Threshold", value: `${(threshold * 100).toFixed(0)}%` },
                { label: "Threshold Basis", value: "Validation F1 maximization" },
                { label: "Model", value: result.model_name },
              ].map((r) => (
                <div
                  key={r.label}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <span style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>{r.label}</span>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--color-text-primary)" }}>
                    {r.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Human review note */}
            <div
              style={{
                marginTop: "1rem",
                padding: "0.75rem",
                background: "var(--color-surface-2)",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.75rem",
                color: "var(--color-text-secondary)",
                lineHeight: 1.6,
              }}
            >
              This output is decision support for human review, not a final determination.
              A human analyst is responsible for the final investigation outcome.
            </div>
          </div>
        </motion.div>

        {/* RIGHT: Model Evidence */}
        <motion.div variants={itemAnim}>
          <div className="card" style={{ padding: "1.375rem" }}>
            <div className="intelligence-label" style={{ marginBottom: "0.375rem" }}>
              Model Evidence
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", marginBottom: "1.375rem" }}>
              SHAP feature contributions behind this prediction
            </div>

            {fraudContribs.length > 0 && (
              <div style={{ marginBottom: "1.25rem" }}>
                <div
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    letterSpacing: "0.09em",
                    textTransform: "uppercase",
                    color: "var(--color-risk-high)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    marginBottom: "0.875rem",
                    paddingBottom: "0.5rem",
                    borderBottom: "1px solid var(--color-risk-high-border)",
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <polyline points="19 12 12 19 5 12" />
                  </svg>
                  Fraud signal
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {fraudContribs.map((c, i) => (
                    <MetricBar
                      key={c.feature}
                      contribution={c}
                      maxAbs={maxAbs}
                      index={i}
                      emphasis={i === 0}
                    />
                  ))}
                </div>
              </div>
            )}

            {legitContribs.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    letterSpacing: "0.09em",
                    textTransform: "uppercase",
                    color: "var(--color-risk-low)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    marginBottom: "0.875rem",
                    paddingBottom: "0.5rem",
                    borderBottom: "1px solid var(--color-risk-low-border)",
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                  Legitimacy signal
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {legitContribs.map((c, i) => (
                    <MetricBar key={c.feature} contribution={c} maxAbs={maxAbs} index={i} />
                  ))}
                </div>
              </div>
            )}

            <div
              style={{
                marginTop: "1rem",
                padding: "0.75rem",
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.75rem",
                color: "var(--color-text-secondary)",
                fontStyle: "italic",
                lineHeight: 1.6,
              }}
            >
              {result.disclaimer}
            </div>
          </div>
        </motion.div>
      </div>

      <style>{`
        @media (max-width: 1100px) {
          .investigation-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 700px) {
          .investigation-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </motion.div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="intelligence-label" style={{ marginBottom: "0.2rem" }}>{label}</div>
      <div
        style={{
          fontSize: "0.9rem",
          fontWeight: 600,
          color: "var(--color-text-primary)",
          fontFamily: mono ? "var(--font-mono)" : undefined,
        }}
      >
        {value}
      </div>
    </div>
  );
}
