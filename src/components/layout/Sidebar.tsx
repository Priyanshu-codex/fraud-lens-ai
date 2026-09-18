"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

const navItems = [
  {
    href: "/dashboard",
    label: "Overview",
    description: "Executive summary",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: "/analyze",
    label: "Analyze",
    description: "Run transaction analysis",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
        <path d="M11 8v6" />
        <path d="M8 11h6" />
      </svg>
    ),
  },
  {
    href: "/investigations",
    label: "Investigations",
    description: "Detailed review",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    href: "/model",
    label: "Model Lab",
    description: "ML performance",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 3H5a2 2 0 0 0-2 2v4" />
        <path d="M9 3h6" />
        <path d="M9 3v18" />
        <path d="M15 3h4a2 2 0 0 1 2 2v4" />
        <path d="M15 3v18" />
        <path d="M9 21H5a2 2 0 0 1-2-2v-4" />
        <path d="M9 21h6" />
        <path d="M15 21h4a2 2 0 0 0 2-2v-4" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "System",
    description: "Health & settings",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: "220px",
        minHeight: "100vh",
        backgroundColor: "var(--color-surface)",
        borderRight: "1px solid var(--color-border)",
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 40,
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "1.25rem 1.25rem 1rem",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <Link href="/" style={{ textDecoration: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <FraudLensLogo />
            <div>
              <div
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 700,
                  color: "var(--color-text-primary)",
                  letterSpacing: "-0.01em",
                  lineHeight: 1.2,
                }}
              >
                FraudLens
              </div>
              <div
                style={{
                  fontSize: "0.6875rem",
                  color: "var(--color-text-tertiary)",
                  fontWeight: 500,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                Intelligence
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "0.75rem 0.75rem" }}>
        <div
          style={{
            fontSize: "0.6875rem",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--color-text-tertiary)",
            padding: "0.5rem 0.5rem 0.75rem",
          }}
        >
          Platform
        </div>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  style={{ textDecoration: "none" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "0.5rem 0.625rem",
                      borderRadius: "6px",
                      color: isActive ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                      backgroundColor: isActive ? "var(--color-surface-2)" : "transparent",
                      fontWeight: isActive ? 600 : 400,
                      fontSize: "0.9rem",
                      transition: "all 0.15s ease",
                      cursor: "pointer",
                      position: "relative",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLDivElement).style.backgroundColor = "var(--color-surface-2)";
                        (e.currentTarget as HTMLDivElement).style.color = "var(--color-text-primary)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent";
                        (e.currentTarget as HTMLDivElement).style.color = "var(--color-text-secondary)";
                      }
                    }}
                  >
                    {isActive && (
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: "20%",
                          bottom: "20%",
                          width: "2px",
                          backgroundColor: "var(--color-brand)",
                          borderRadius: "0 2px 2px 0",
                        }}
                      />
                    )}
                    <span style={{ opacity: isActive ? 1 : 0.7 }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: "1rem 1.25rem",
          borderTop: "1px solid var(--color-border)",
        }}
      >
        <div style={{ fontSize: "0.75rem", color: "var(--color-text-tertiary)", lineHeight: 1.5 }}>
          <div style={{ fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: "2px" }}>
            FraudLens AI v1.0
          </div>
          <div>Decision Support Prototype</div>
        </div>
      </div>
    </aside>
  );
}

function FraudLensLogo() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
      <rect width="30" height="30" rx="7" fill="#0F0F0F" />
      {/* Outer lens ring */}
      <circle cx="15" cy="15" r="9" stroke="#C1392B" strokeWidth="1.5" fill="none" />
      {/* Inner lens */}
      <circle cx="15" cy="15" r="5.5" stroke="white" strokeWidth="1" fill="none" opacity="0.6" />
      {/* Signal lines */}
      <line x1="15" y1="6" x2="15" y2="4" stroke="#C1392B" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="15" y1="26" x2="15" y2="24" stroke="#C1392B" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="6" y1="15" x2="4" y2="15" stroke="#C1392B" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="26" y1="15" x2="24" y2="15" stroke="#C1392B" strokeWidth="1.5" strokeLinecap="round" />
      {/* Center dot */}
      <circle cx="15" cy="15" r="2" fill="white" />
    </svg>
  );
}
