import React from "react";
import { supabase, getRole, signInOwner, signOut } from "./lib/auth.js";

// Every route component is code-split so each surface only ships its own chunk
// — the landing page (the most-hit entry) loads minimal JS, and the main entry
// stays well under the SC-008 budget (R7).
const Landing = React.lazy(() => import("./marketing/Landing.jsx"));
const Blog = React.lazy(() => import("./marketing/Blog.jsx"));
const Podcast = React.lazy(() => import("./marketing/Podcast.jsx"));
const PatronApp = React.lazy(() => import("./patron/PatronApp.jsx"));
const BusinessApp = React.lazy(() => import("./business/BusinessApp.jsx"));
const Signup = React.lazy(() => import("./business/Signup.jsx"));
const PendingApproval = React.lazy(() =>
  import("./business/Signup.jsx").then((m) => ({ default: m.PendingApproval })));
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

// Minimal path routing — zero router dependency.
//   /                  → marketing landing (the public front door)
//   /app               → patron mobile web (capped at 560px per design layout rules)
//   /blog, /blog/:slug → the weekly review
//   /podcast           → episodes
//   /business          → owner dashboard (sidebar + 1320px content lane)
//   /business/signup   → owner self-serve onboarding (US1)
//   /admin             → internal
//   /c/:code           → check-in entry (separate lean bundle via vercel rewrite)
function Routes() {
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);

  if (path.startsWith("/admin")) return <AdminRoute />;

  if (path.startsWith("/business/signup")) {
    return <div style={{ height: "100dvh", margin: "0 auto" }}><Signup /></div>;
  }
  if (path.startsWith("/business")) {
    if (params.get("signup") === "pending") {
      return <div style={{ height: "100dvh", margin: "0 auto" }}><PendingApproval /></div>;
    }
    return <div style={{ height: "100dvh", maxWidth: 1320, margin: "0 auto" }}><BusinessApp /></div>;
  }

  if (path.startsWith("/app")) {
    return (
      <div style={{ height: "100dvh", maxWidth: 560, margin: "0 auto", background: "var(--paper-50)", boxShadow: "0 0 0 1px var(--ink-100)" }}>
        <PatronApp initialTab="home" />
      </div>
    );
  }

  if (path.startsWith("/blog/")) {
    const slug = decodeURIComponent(path.replace(/^\/blog\//, "").replace(/\/+$/, ""));
    return <Blog slug={slug} />;
  }
  if (path.startsWith("/blog")) return <Blog />;
  if (path.startsWith("/podcast")) return <Podcast />;

  // Root and anything else → the marketing landing.
  return <Landing />;
}

export default function App() {
  return (
    <React.Suspense fallback={<div style={{ minHeight: "100dvh", background: "var(--paper-50)" }} />}>
      <Routes />
    </React.Suspense>
  );
}
