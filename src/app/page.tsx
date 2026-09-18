"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

/* ─── Hero Canvas Animation ────────────────────────────────────────────────── */
function SignalCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // non-null assertion so inner draw() function can use ctx safely
    const c2d = ctx;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas!.width = canvas!.offsetWidth * dpr;
      canvas!.height = canvas!.offsetHeight * dpr;
      ctx!.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    // Transaction node types
    type Node = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      type: "legitimate" | "review" | "fraud";
      flagged: boolean;
      flagProgress: number; // 0-1
      opacity: number;
      age: number;
      maxAge: number;
    };

    const nodes: Node[] = [];
    let tick = 0;

    function spawnNode(): Node {
      const W = canvas!.offsetWidth;
      const H = canvas!.offsetHeight;
      const rand = Math.random();
      const type: Node["type"] =
        rand < 0.82 ? "legitimate" : rand < 0.94 ? "review" : "fraud";
      return {
        x: Math.random() * W * 0.15,
        y: H * 0.2 + Math.random() * H * 0.6,
        vx: 1.2 + Math.random() * 0.8,
        vy: (Math.random() - 0.5) * 0.3,
        r: type === "fraud" ? 5 : type === "review" ? 4 : 3.5,
        type,
        flagged: false,
        flagProgress: 0,
        opacity: 0,
        age: 0,
        maxAge: 280 + Math.random() * 120,
      };
    }

    const COLORS = {
      legitimate: { fill: "#236641", ring: "rgba(35,102,65,0.15)" },
      review:     { fill: "#A64C00", ring: "rgba(166,76,0,0.15)" },
      fraud:      { fill: "#C1321F", ring: "rgba(193,50,31,0.20)" },
    };

    function draw() {
      const W = canvas!.offsetWidth;
      const H = canvas!.offsetHeight;
      ctx!.clearRect(0, 0, W, H);

      tick++;

      // Spawn nodes
      if (tick % 18 === 0 && nodes.length < 28) {
        nodes.push(spawnNode());
      }

      // Draw connections between close legitimate nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          if (a.type === "fraud" || b.type === "fraud") continue;
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 90) {
            const alpha = (1 - dist / 90) * Math.min(a.opacity, b.opacity) * 0.15;
            ctx!.beginPath();
            ctx!.strokeStyle = `rgba(90,90,90,${alpha})`;
            ctx!.lineWidth = 0.8;
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.stroke();
          }
        }
      }

      // Update + draw nodes
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        n.x += n.vx;
        n.y += n.vy;
        n.age++;

        // Fade in/out
        if (n.age < 20) n.opacity = n.age / 20;
        else if (n.age > n.maxAge - 30) n.opacity = (n.maxAge - n.age) / 30;
        else n.opacity = 1;

        // Remove old nodes
        if (n.age >= n.maxAge || n.x > W + 30) {
          nodes.splice(i, 1);
          continue;
        }

        // Flag fraud/review nodes when they reach center-ish
        if (!n.flagged && n.type !== "legitimate" && n.x > W * 0.35) {
          n.flagged = true;
        }
        if (n.flagged && n.flagProgress < 1) {
          n.flagProgress = Math.min(1, n.flagProgress + 0.04);
        }

        const c = COLORS[n.type];

        // Ring glow for fraud (when flagged)
        if (n.flagged && n.type === "fraud" && n.flagProgress > 0.3) {
          const ringR = n.r + 8 * n.flagProgress;
          const grad = ctx!.createRadialGradient(n.x, n.y, n.r, n.x, n.y, ringR);
          grad.addColorStop(0, `rgba(193,50,31,${0.3 * n.flagProgress * n.opacity})`);
          grad.addColorStop(1, "rgba(193,50,31,0)");
          ctx!.beginPath();
          ctx!.arc(n.x, n.y, ringR, 0, Math.PI * 2);
          ctx!.fillStyle = grad;
          ctx!.fill();
        }

        // Node body
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx!.fillStyle = c.fill + Math.round(n.opacity * 255).toString(16).padStart(2, "0");
        ctx!.fill();

        // Detection ring on fraud
        if (n.flagged && n.type === "fraud") {
          ctx!.beginPath();
          ctx!.arc(n.x, n.y, n.r + 5 * n.flagProgress, 0, Math.PI * 2);
          ctx!.strokeStyle = `rgba(193,50,31,${0.6 * n.flagProgress * n.opacity})`;
          ctx!.lineWidth = 1.5;
          ctx!.stroke();
        }
      }

      // Detection scanner line
      const scanX = W * 0.38 + Math.sin(tick * 0.008) * W * 0.04;
      const gradient = ctx!.createLinearGradient(scanX - 2, 0, scanX + 2, 0);
      gradient.addColorStop(0, "rgba(179,38,27,0)");
      gradient.addColorStop(0.5, "rgba(179,38,27,0.12)");
      gradient.addColorStop(1, "rgba(179,38,27,0)");
      ctx!.fillStyle = gradient;
      ctx!.fillRect(scanX - 2, H * 0.1, 4, H * 0.8);

      animRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
      }}
    />
  );
}

/* ─── Feature card component ────────────────────────────────────────────────── */
function FeatureCard({
  step,
  title,
  description,
  color,
  delay,
}: {
  step: string;
  title: string;
  description: string;
  color: string;
  delay: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-xl)",
        padding: "2rem",
        boxShadow: "var(--shadow-card)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: "3px",
          background: color,
          borderRadius: "var(--radius-xl) var(--radius-xl) 0 0",
        }}
      />
      <div
        style={{
          fontSize: "0.6875rem",
          fontWeight: 700,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          color: color,
          marginBottom: "0.75rem",
        }}
      >
        {step}
      </div>
      <div
        style={{
          fontSize: "1.0625rem",
          fontWeight: 700,
          color: "var(--color-text-primary)",
          letterSpacing: "-0.015em",
          marginBottom: "0.625rem",
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: "0.9rem", color: "var(--color-text-secondary)", lineHeight: 1.65 }}>
        {description}
      </div>
    </motion.div>
  );
}

/* ─── Hero Stats Carousel Data & Component ─────────────────────────────────── */
const STATS_ITEMS = [
  {
    value: "284K*",
    label: "Transactions analyzed",
    accent: null,
  },
  {
    value: "0.17%",
    label: "Fraud rate detected",
    accent: "crimson",
  },
  {
    value: "284,807",
    label: "Transactions analyzed",
    accent: null,
  },
  {
    value: "XGBoost",
    label: "Model architecture",
    accent: "amber",
  },
  {
    value: "492",
    label: "Fraud signals detected",
    accent: "crimson",
  },
  {
    value: "Decision threshold",
    label: "Model risk calibration",
    accent: null,
  },
  {
    value: "SHAP",
    label: "Explainability engine",
    accent: "green",
  },
];

function StatsCarouselCard({ item }: { item: (typeof STATS_ITEMS)[0] }) {
  const isCrimson = item.accent === "crimson";
  const isAmber = item.accent === "amber";
  const isGreen = item.accent === "green";

  const dotColor = isCrimson
    ? "var(--color-brand)"
    : isAmber
    ? "var(--color-risk-review)"
    : isGreen
    ? "var(--color-risk-low)"
    : "var(--color-border-strong)";

  return (
    <div
      className="stats-carousel-card"
      style={{
        borderColor: isCrimson ? "var(--color-brand-border)" : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
        <span
          style={{
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            background: dotColor,
            flexShrink: 0,
            boxShadow: isCrimson ? "0 0 0 2px var(--color-brand-dim)" : undefined,
          }}
        />
        <span
          style={{
            fontSize: "1.0625rem",
            fontWeight: 800,
            color: isCrimson ? "var(--color-brand)" : "var(--color-text-primary)",
            letterSpacing: "-0.02em",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1.2,
          }}
        >
          {item.value}
        </span>
      </div>

      <div
        style={{
          width: "1px",
          height: "18px",
          background: "var(--color-border)",
          flexShrink: 0,
        }}
      />

      <span
        style={{
          fontSize: "0.8125rem",
          fontWeight: 500,
          color: "var(--color-text-secondary)",
          letterSpacing: "-0.01em",
          lineHeight: 1.3,
        }}
      >
        {item.label}
      </span>

      <span
        style={{
          color: "var(--color-text-tertiary)",
          fontSize: "0.75rem",
          opacity: 0.6,
          marginLeft: "0.125rem",
        }}
      >
        →
      </span>
    </div>
  );
}

/* ─── Main Page ────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const heroRef = useRef(null);

  const features = [
    {
      step: "01 — Detect",
      title: "Transaction Signal Analysis",
      description:
        "Every transaction enters a trained XGBoost model that evaluates 30 features — including 28 anonymized PCA components — to produce a calibrated fraud probability score.",
      color: "var(--color-accent)",
      delay: 0.05,
    },
    {
      step: "02 — Quantify",
      title: "Calibrated Risk Scoring",
      description:
        "The model outputs a precise probability between 0–100%, compared against a decision threshold optimized on a held-out validation set to maximize F1 score.",
      color: "var(--color-risk-review)",
      delay: 0.12,
    },
    {
      step: "03 — Explain",
      title: "SHAP Model Evidence",
      description:
        "SHAP (SHapley Additive exPlanations) reveals exactly which features drove the prediction — showing what pushed toward fraud and what provided legitimacy signal.",
      color: "var(--color-brand)",
      delay: 0.19,
    },
    {
      step: "04 — Investigate",
      title: "Human-Focused Review",
      description:
        "Results are structured for analyst review — risk classification, evidence, decision context, and full investigation timeline. The AI assists; the analyst decides.",
      color: "var(--color-risk-low)",
      delay: 0.26,
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        className="hero-section"
        style={{
          minHeight: "calc(100vh - 80px)",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
          paddingBottom: "1.5rem",
        }}
      >
        {/* Grid background */}
        <div className="hero-grid-bg" />

        {/* Navigation bar */}
        <nav
          className="hero-nav"
          style={{
            position: "relative",
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1.25rem 2.5rem",
            borderBottom: "1px solid var(--color-border)",
            background: "rgba(248,247,245,0.85)",
            backdropFilter: "blur(12px)",
          }}
        >
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <FraudLensLogo />
            <div>
              <div
                style={{
                  fontSize: "1rem",
                  fontWeight: 800,
                  color: "var(--color-text-primary)",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                }}
              >
                FraudLens AI
              </div>
              <div
                style={{
                  fontSize: "0.625rem",
                  color: "var(--color-text-tertiary)",
                  fontWeight: 600,
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                }}
              >
                Financial Signal Intelligence
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <Link
              href="/model"
              style={{
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                textDecoration: "none",
                padding: "0.5rem 1rem",
                borderRadius: "var(--radius-md)",
                transition: "all 0.15s ease",
              }}
            >
              Model Intelligence
            </Link>
            <Link href="/analyze" className="btn btn-primary btn-sm">
              Analyze Transaction →
            </Link>
          </div>
        </nav>

        {/* Hero content */}
        <div
          className="hero-content-grid"
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            maxWidth: "1280px",
            margin: "0 auto",
            width: "100%",
            padding: "3.5rem 2.5rem 3rem",
            gap: "4rem",
            alignItems: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Left: Text */}
          <div>
            {mounted && (
              <motion.div
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* Badge */}
                <div className="hero-badge" style={{ marginBottom: "1.75rem", display: "inline-flex" }}>
                  <div
                    className="status-dot-live"
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      background: "var(--color-risk-low)",
                    }}
                  />
                  <span>Financial Fraud Intelligence Platform</span>
                </div>

                {/* Headline */}
                <h1
                  className="text-display"
                  style={{
                    marginBottom: "1.5rem",
                    color: "var(--color-text-primary)",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  See the risk.
                  <br />
                  <span style={{ color: "var(--color-brand)" }}>Understand</span>
                  <br />
                  the reason.
                </h1>

                <p
                  className="text-body"
                  style={{
                    color: "var(--color-text-secondary)",
                    marginBottom: "2.5rem",
                    maxWidth: "420px",
                    lineHeight: 1.7,
                  }}
                >
                  AI-powered transaction intelligence that detects suspicious activity,
                  quantifies risk, explains model evidence, and helps teams focus human
                  attention where it matters.
                </p>

                <div style={{ display: "flex", gap: "0.875rem", flexWrap: "wrap" }}>
                  <Link href="/analyze" className="btn btn-primary btn-xl">
                    Analyze a Transaction
                  </Link>
                  <Link href="/model" className="btn btn-secondary btn-xl">
                    Explore Model Intelligence
                  </Link>
                </div>
              </motion.div>
            )}
          </div>

          {/* Right: Canvas visualization */}
          {mounted && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: "relative",
                height: "480px",
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-2xl)",
                boxShadow: "var(--shadow-elevated)",
                overflow: "hidden",
              }}
            >
              <SignalCanvas />

              {/* Legend overlay */}
              <div
                style={{
                  position: "absolute",
                  bottom: "1.25rem",
                  left: "1.25rem",
                  display: "flex",
                  gap: "1.25rem",
                  background: "rgba(255,255,255,0.92)",
                  backdropFilter: "blur(8px)",
                  padding: "0.625rem 1rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-border)",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                {[
                  { color: "#236641", label: "Legitimate" },
                  { color: "#A64C00", label: "Review" },
                  { color: "#C1321F", label: "Fraud Signal" },
                ].map((l) => (
                  <div key={l.label} style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: l.color,
                      }}
                    />
                    <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--color-text-secondary)" }}>
                      {l.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Top label */}
              <div
                style={{
                  position: "absolute",
                  top: "1.25rem",
                  left: "1.25rem",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                  color: "var(--color-text-tertiary)",
                }}
              >
                Live Transaction Signal Stream
              </div>

              {/* Detection label */}
              <div
                style={{
                  position: "absolute",
                  top: "1.25rem",
                  right: "1.25rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--color-brand)",
                }}
              >
                <div
                  className="status-dot-live"
                  style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--color-brand)" }}
                />
                Detection Active
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* ── Hero Stats Carousel ─────────────────────────────────────────────── */}
      <section
        className="stats-carousel-section"
        aria-label="Platform Statistics Carousel"
      >
        <div className="stats-carousel-fade-left" />
        <div className="stats-carousel-fade-right" />

        <div className="stats-carousel-track">
          <div className="stats-carousel-group">
            {STATS_ITEMS.map((item, i) => (
              <StatsCarouselCard key={`group1-${i}`} item={item} />
            ))}
          </div>
          <div className="stats-carousel-group" aria-hidden="true">
            {STATS_ITEMS.map((item, i) => (
              <StatsCarouselCard key={`group2-${i}`} item={item} />
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <section style={{ padding: "6rem 2.5rem" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
            <div className="intelligence-label" style={{ marginBottom: "0.75rem" }}>
              Intelligence Flow
            </div>
            <h2 className="text-headline" style={{ color: "var(--color-text-primary)", marginBottom: "1rem" }}>
              From transaction to insight
            </h2>
            <p style={{ fontSize: "1rem", color: "var(--color-text-secondary)", maxWidth: "480px", margin: "0 auto", lineHeight: 1.7 }}>
              Every transaction follows a clear path — signal detection, risk quantification, 
              model explanation, and investigator review.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "1.25rem",
            }}
          >
            {features.map((f) => (
              <FeatureCard key={f.step} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Section ────────────────────────────────────────────────────── */}
      <section
        style={{
          background: "var(--color-sidebar-bg)",
          padding: "6rem 2.5rem",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle grid on dark bg */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div
          style={{
            maxWidth: "640px",
            margin: "0 auto",
            textAlign: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.375rem 1rem",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "100px",
              fontSize: "0.75rem",
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.5)",
              marginBottom: "1.75rem",
            }}
          >
            Decision Support Prototype
          </div>
          <h2
            style={{
              fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
              fontWeight: 800,
              color: "#FFFFFF",
              letterSpacing: "-0.035em",
              lineHeight: 1.1,
              marginBottom: "1.25rem",
              fontFamily: "var(--font-display)",
            }}
          >
            Ready to investigate a transaction?
          </h2>
          <p
            style={{
              fontSize: "1rem",
              color: "rgba(255,255,255,0.55)",
              marginBottom: "2.5rem",
              lineHeight: 1.7,
            }}
          >
            Load a real sample or enter a custom transaction. The model runs in seconds — 
            probability, risk level, and full SHAP evidence included.
          </p>
          <div style={{ display: "flex", gap: "0.875rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/analyze"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.9375rem 2.25rem",
                background: "white",
                color: "#0B0C0E",
                borderRadius: "var(--radius-md)",
                fontWeight: 700,
                fontSize: "0.9375rem",
                textDecoration: "none",
                transition: "all 0.15s ease",
              }}
            >
              Run Risk Analysis →
            </Link>
            <Link
              href="/dashboard"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.9375rem 2.25rem",
                background: "transparent",
                color: "rgba(255,255,255,0.75)",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: "var(--radius-md)",
                fontWeight: 600,
                fontSize: "0.9375rem",
                textDecoration: "none",
                transition: "all 0.15s ease",
              }}
            >
              View Intelligence Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--color-border)",
          padding: "1.5rem 2.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--color-surface)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <FraudLensLogo size={22} />
          <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
            FraudLens AI
          </span>
          <span style={{ fontSize: "0.8125rem", color: "var(--color-text-tertiary)" }}>
            — Financial Signal Intelligence · Decision Support Prototype
          </span>
        </div>
        <div style={{ display: "flex", gap: "1.5rem" }}>
          {[
            { href: "/dashboard", label: "Dashboard" },
            { href: "/analyze", label: "Analyzer" },
            { href: "/model", label: "Model Lab" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              style={{
                fontSize: "0.8125rem",
                color: "var(--color-text-tertiary)",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </footer>
    </div>
  );
}

function FraudLensLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="#0B0C0E" />
      <circle cx="16" cy="16" r="9.5" stroke="#C1321F" strokeWidth="1.5" fill="none" />
      <circle cx="16" cy="16" r="5.5" stroke="rgba(255,255,255,0.5)" strokeWidth="1" fill="none" />
      <line x1="16" y1="6.5" x2="16" y2="4.5" stroke="#C1321F" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="27.5" x2="16" y2="25.5" stroke="#C1321F" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="6.5" y1="16" x2="4.5" y2="16" stroke="#C1321F" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="27.5" y1="16" x2="25.5" y2="16" stroke="#C1321F" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="16" cy="16" r="2.5" fill="white" />
    </svg>
  );
}
