"use client";

import { useState, createContext, useContext } from "react";
import { Sidebar } from "@/components/layout/Sidebar";

/* ─── Mobile menu context ─────────────────────────────────────────────────── */
const MobileMenuContext = createContext<{ onMenuToggle: () => void }>({
  onMenuToggle: () => {},
});

export function useMobileMenu() {
  return useContext(MobileMenuContext);
}

/* ─── App layout ──────────────────────────────────────────────────────────── */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <MobileMenuContext.Provider value={{ onMenuToggle: () => setMobileOpen(true) }}>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <div
          className="app-content"
          style={{
            marginLeft: "var(--sidebar-width, 240px)",
            flex: 1,
            minHeight: "100vh",
            backgroundColor: "var(--color-bg)",
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          {children}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .app-content {
            margin-left: 0 !important;
          }
        }
      `}</style>
    </MobileMenuContext.Provider>
  );
}
