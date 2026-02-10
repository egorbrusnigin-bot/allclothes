"use client";

import { useIsMobile } from "../lib/useIsMobile";

export default function AccountHome() {
  const isMobile = useIsMobile();

  if (isMobile) {
    return null; // On mobile the sidebar is visible directly, no need for placeholder
  }

  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: 560 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 11, color: "#000", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>SELECT A SECTION ON THE LEFT</div>
        <div style={{ fontSize: 10, color: "#999", marginTop: 8, letterSpacing: 0.3 }}>Minimal dashboard</div>
      </div>
    </div>
  );
}
