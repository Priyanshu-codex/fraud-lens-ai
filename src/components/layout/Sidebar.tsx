"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api, type HealthResponse } from "@/lib/api";

const navItems = [
  {
    href: "/dashboard",
    label: "Intelligence",
    description: "Risk overview",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    href: "/analyze",
    label: "Analyzer",
    description: "Transaction analysis",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3h18v4H3z" rx="1" />
        <path d="M3 11h10" />
        <path d="M3 15h7" />
        <circle cx="18" cy="16" r="4" />
        <path d="m21 19-1.5-1.5" />
      </svg>
    ),
  },
  {
    href: "/investigations",
    label: "Investigation",
    description: "Forensic workspace",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    ),
  },
  {
    href: "/model",
    label: "Model Lab",
    description: "ML performance",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "System",
    description: "Health & config",
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.07 4.93A10 10 0 0 1 21.64 9h-2.05A8 8 0 0 0 12 4c-.36 0-.71.02-1.05.07M4.93 4.93A10 10 0 0 0 2.36 9h2.05A8 8 0 0 1 20 12h2a10 10 0 0 1-2.93 7.07M4.93 19.07A10 10 0 0 0 9 21.64v-2.05A8 8 0 0 1 4 12H2a10 10 0 0 0 2.93 7.07" />
      </svg>
    ),
  },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    api.health().then(setHealth).catch(() => null);
  }, []);

  const sidebarContent = (
    <aside
      style={{
        width: "240px",
        minHeight: "100vh",
        backgroundColor: "var(--color-sidebar-bg)",
        borderRight: "1px solid var(--color-sidebar-border)",
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 40,
        boxShadow: "var(--shadow-sidebar)",
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "1.375rem 1.375rem 1.125rem",
          borderBottom: "1px solid var(--color-sidebar-border)",
        }}
      >
        <Link href="/" style={{ textDecoration: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <FraudLensLogo />
            <div>
              <div
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 800,
                  color: "var(--color-sidebar-text-active)",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                }}
              >
                FraudLens
              </div>
              <div
                style={{
                  fontSize: "0.6rem",
                  color: "var(--color-sidebar-text)",
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  marginTop: "1px",
                }}
              >
                Signal Intelligence
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "1rem 0.75rem" }}>
        <div
          style={{
            fontSize: "0.5875rem",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--color-sidebar-text)",
            padding: "0.25rem 0.625rem 0.75rem",
            opacity: 0.5,
          }}
        >
          Platform
        </div>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "1px" }}>
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link href={item.href} style={{ textDecoration: "none" }} onClick={onMobileClose}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "0.5625rem 0.75rem",
                      borderRadius: "6px",
                      color: isActive
                        ? "var(--color-sidebar-text-active)"
                        : "var(--color-sidebar-text)",
                      backgroundColor: isActive
                        ? "var(--color-sidebar-active-bg)"
                        : "transparent",
                      fontWeight: isActive ? 600 : 400,
                      fontSize: "0.875rem",
                      transition: "all 0.12s ease",
                      cursor: "pointer",
                      position: "relative",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLDivElement).style.backgroundColor = "var(--color-sidebar-hover-bg)";
                        (e.currentTarget as HTMLDivElement).style.color = "rgba(242,242,240,0.85)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent";
                        (e.currentTarget as HTMLDivElement).style.color = "var(--color-sidebar-text)";
                      }
                    }}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: "18%",
                          bottom: "18%",
                          width: "2.5px",
                          backgroundColor: "var(--color-brand)",
                          borderRadius: "0 2px 2px 0",
                        }}
                      />
                    )}
                    <span
                      style={{
                        opacity: isActive ? 1 : 0.65,
                        color: isActive ? "var(--color-sidebar-text-active)" : undefined,
                        transition: "opacity 0.12s ease",
                      }}
                    >
                      {item.icon}
                    </span>
                    <div>
                      <div>{item.label}</div>
                      {isActive && (
                        <div
                          style={{
                            fontSize: "0.6875rem",
                            color: "var(--color-sidebar-text)",
                            fontWeight: 400,
                            marginTop: "1px",
                          }}
                        >
                          {item.description}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer — system status */}
      <div
        style={{
          padding: "1rem 1.125rem",
          borderTop: "1px solid var(--color-sidebar-border)",
        }}
      >
        {health && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.625rem",
            }}
          >
            <div
              className={health.model_loaded ? "status-dot-live" : undefined}
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: health.model_loaded ? "#34C676" : "#F14949",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: "0.75rem",
                color: health.model_loaded ? "#34C676" : "#F14949",
                fontWeight: 600,
                letterSpacing: "0.04em",
              }}
            >
              {health.model_loaded ? "MODEL READY" : "MODEL OFFLINE"}
            </span>
          </div>
        )}
        <div style={{ fontSize: "0.6875rem", color: "var(--color-sidebar-text)", lineHeight: 1.5, opacity: 0.6 }}>
          <div style={{ fontWeight: 600, marginBottom: "1px", opacity: 1 }}>
            FraudLens AI v1.0
          </div>
          <div>Decision Support Prototype</div>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="sidebar-desktop">{sidebarContent}</div>

      {/* Mobile: slide-in drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="sidebar-overlay open"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onMobileClose}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 39, display: "block" }}
            />
            <motion.div
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              style={{ position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 50 }}
            >
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`
        @media (max-width: 768px) {
          .sidebar-desktop { display: none; }
        }
        @media (min-width: 769px) {
          .sidebar-desktop { display: block; }
        }
      `}</style>
    </>
  );
}

function FraudLensLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="#141518" />
      <circle cx="16" cy="16" r="9.5" stroke="#C1321F" strokeWidth="1.5" fill="none" />
      <circle cx="16" cy="16" r="5.5" stroke="rgba(255,255,255,0.35)" strokeWidth="1" fill="none" />
      <line x1="16" y1="6.5" x2="16" y2="4.5" stroke="#C1321F" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="27.5" x2="16" y2="25.5" stroke="#C1321F" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="6.5" y1="16" x2="4.5" y2="16" stroke="#C1321F" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="27.5" y1="16" x2="25.5" y2="16" stroke="#C1321F" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="16" cy="16" r="2.5" fill="white" />
    </svg>
  );
}
