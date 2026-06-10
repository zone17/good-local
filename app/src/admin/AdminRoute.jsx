// ============================================================
// AdminRoute.jsx — the /admin gate, split into its own lazy chunk so the
// Supabase client (auth/realtime/postgrest, ~40KB gz) it pulls in via auth.js
// never ships in the main entry. The most-hit route (the marketing landing)
// no longer downloads the SDK it does not use (D-028).
//
// Renders AdminApp only when the session role is admin; otherwise a plain
// email sign-in with a FORBIDDEN notice for authenticated non-admins.
// ============================================================
import React from "react";
import { supabase, getRole, signInOwner, signOut } from "../lib/auth.js";

const AdminApp = React.lazy(() => import("./AdminApp.jsx"));

export default function AdminRoute() {
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
        <label style={{ fontSize: 13, fontWeight: 600 }}>
          Email
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="gl-input" style={{ marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 13, fontWeight: 600 }}>
          Password
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="gl-input" style={{ marginTop: 4 }} />
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
