import React from "react";
import PatronApp from "./patron/PatronApp.jsx";
import BusinessApp from "./business/BusinessApp.jsx";
import Signup, { PendingApproval } from "./business/Signup.jsx";

// Minimal path routing — two surfaces, zero router dependency.
//   /                  → patron mobile web (capped at 560px per design layout rules)
//   /business          → owner dashboard (sidebar + 1320px content lane)
//   /business/signup   → owner self-serve onboarding (US1)
//   /c/:code           → check-in entry (what the register QR encodes) — opens the
//                        patron app on the check-in flow.
export default function App() {
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);

  if (path.startsWith("/business/signup")) {
    return (
      <div style={{ height: "100dvh", margin: "0 auto" }}>
        <Signup />
      </div>
    );
  }

  if (path.startsWith("/business")) {
    // Post-checkout return: the calm pending-approval screen (FR-006).
    if (params.get("signup") === "pending") {
      return (
        <div style={{ height: "100dvh", margin: "0 auto" }}>
          <PendingApproval />
        </div>
      );
    }
    return (
      <div style={{ height: "100dvh", maxWidth: 1320, margin: "0 auto" }}>
        <BusinessApp />
      </div>
    );
  }

  const initialTab = path.startsWith("/c/") ? "checkin" : "home";
  return (
    <div
      style={{
        height: "100dvh",
        maxWidth: 560,
        margin: "0 auto",
        background: "var(--paper-50)",
        boxShadow: "0 0 0 1px var(--ink-100)",
      }}
    >
      <PatronApp initialTab={initialTab} />
    </div>
  );
}
