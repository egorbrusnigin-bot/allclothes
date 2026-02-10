"use client";

import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./sidebar";
import { useIsMobile } from "../lib/useIsMobile";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const router = useRouter();

  // On mobile, show content as overlay when not on /account root
  const isSubPage = pathname !== "/account";
  const showOverlay = isMobile && isSubPage;

  return (
    <main style={{ maxWidth: 1400, margin: "0 auto", padding: isMobile ? "24px 16px 60px" : "48px 24px 80px" }}>
      <section style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "360px 1fr",
        gap: isMobile ? 16 : 26,
        alignItems: "start",
      }}>
        <Sidebar />

        {/* Desktop: always show content inline */}
        {!isMobile && (
          <div style={{
            border: "1px solid #e6e6e6",
            borderRadius: 16,
            minHeight: 620,
            background: "#fff",
            padding: 28,
          }}>
            {children}
          </div>
        )}

        {/* Mobile: show content as overlay when on sub-page */}
        {showOverlay && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "#fff",
              zIndex: 900,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Overlay header with back button */}
            <div style={{
              display: "flex",
              alignItems: "center",
              padding: "12px 16px",
              borderBottom: "1px solid #e6e6e6",
              flexShrink: 0,
            }}>
              <button
                onClick={() => router.push("/account")}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#000",
                }}
              >
                <span style={{ fontSize: 18 }}>←</span>
                <span>Account</span>
              </button>
            </div>

            {/* Overlay content */}
            <div style={{
              flex: 1,
              overflow: "auto",
              padding: 16,
              WebkitOverflowScrolling: "touch",
            }}>
              {children}
            </div>
          </div>
        )}

        {/* Mobile: when on /account root, show children (null from page.tsx) */}
        {isMobile && !isSubPage && children}
      </section>
    </main>
  );
}
