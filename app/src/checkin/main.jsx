import React from "react";
import { createRoot } from "react-dom/client";
import "@ds/styles.css";

// Lean second Vite entry for the /c/{slug} scan landing (R7 — 3G budget).
// The real check-in flow (token parse → record_check_in → stamp confirmation
// + wallet/claim CTAs) lands in T030. This placeholder keeps the entry wired
// and on-brand so the build and the size gate measure the right thing.
function CheckinPlaceholder() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-6, 1.5rem)",
        background: "var(--surface-page, var(--paper-50))",
        color: "var(--text-primary, var(--ink-900))",
        fontFamily: "var(--font-body, var(--font-sans))",
        textAlign: "center",
      }}
    >
      <p style={{ fontSize: "var(--text-lg)", margin: 0 }}>
        Check-in flow lands in T030
      </p>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<CheckinPlaceholder />);
