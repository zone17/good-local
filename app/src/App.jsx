import React from "react";
import PatronApp from "./patron/PatronApp.jsx";
import BusinessApp from "./business/BusinessApp.jsx";
import Signup, { PendingApproval } from "./business/Signup.jsx";
import { supabase, getRole, signInOwner, signOut } from "./lib/auth.js";

// AdminApp is dynamically imported so the admin bundle never weighs on the
// main patron/owner entry (R7 / SC-008 — main ≤130KB gz).
const AdminApp = React.lazy(() => import("./admin/AdminApp.jsx"));

// /admin gate: render AdminApp only when the session role is admin; otherwise a
// plain email sign-in with a FORBIDDEN notice for authenticated non-admins.
function AdminRoute() {
  const [state, setState] = React.useState({ status: "loading" });
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  const refresh = React.useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data?.session) { setState({ status: "signed_out" }); return; }
    const role = await getRole();
    setState({ status: role === "admin" ? "admin" : "forbidden" });
  }, []);

  React.useEffect(() => { refresh(); }, [refresh]);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await signInOwner(email, password); await refresh(); }
    catch { setError("Sign-in failed. Check your email and password."); }
    finally { setBusy(false); }
  }
  async function onSignOut() { await signOut(); setState({ status: "signed_out" }); }

  if (state.status === "loading") {
    return <div style={{ padding: 40, fontFamily: "var(--font-body)" }}>Loading…</div>;
  }
  if (state.status === "admin") {
    return (
      <React.Suspense fallback={<div style={{ padding: 40 }}>Loading admin…</div>}>
        <div style={{ height: "100dvh" }}><AdminApp onSignOut={onSignOut} /></div>
      </React.Suspense>
    );
  }
  // signed_out or forbidden — show the sign-in card.
  return (
    <div style={{
      height: "100dvh", display: "grid", placeItems: "center",
      background: "var(--paper-50)", fontFamily: "var(--font-body)",
    }}>
      <form onSubmit={onSubmit} style={{
        width: 360, padding: 28, background: "var(--paper-100)",
        border: "1px solid var(--ink-100)", borderRadius: 12,
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600 }}>
          Good Local · Admin
        </div>
        {state.status === "forbidden" ? (
          <div style={{ color: "var(--clay-700, #9a3412)", fontSize: 13 }}>
            This account is not an admin. (FORBIDDEN)
          </div>
        ) : null}
        <label style={{ fontSize: 13 }}>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px" }} />
        </label>
        <label style={{ fontSize: 13 }}>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px" }} />
        </label>
        {error ? <div style={{ color: "var(--clay-700, #9a3412)", fontSize: 13 }}>{error}</div> : null}
        <button type="submit" disabled={busy} style={{
          padding: "10px 14px", border: 0, borderRadius: 8,
          background: "var(--pine-700)", color: "var(--paper-100)",
          fontWeight: 600, cursor: "pointer",
        }}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        {state.status === "forbidden" ? (
          <button type="button" onClick={onSignOut} style={{
            background: "none", border: 0, color: "var(--pine-700)",
            textDecoration: "underline", cursor: "pointer", fontSize: 13,
          }}>Sign out</button>
        ) : null}
      </form>
    </div>
  );
}

// Minimal path routing — two surfaces, zero router dependency.
//   /                  → patron mobile web (capped at 560px per design layout rules)
//   /business          → owner dashboard (sidebar + 1320px content lane)
//   /business/signup   → owner self-serve onboarding (US1)
//   /c/:code           → check-in entry (what the register QR encodes) — opens the
//                        patron app on the check-in flow.
export default function App() {
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);

  if (path.startsWith("/admin")) {
    return <AdminRoute />;
  }

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
