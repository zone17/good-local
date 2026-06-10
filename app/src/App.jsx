import React from "react";

// Every route component is code-split so each surface only ships its own chunk
// — the landing page (the most-hit entry) loads minimal JS, and the main entry
// stays well under the SC-008 budget (R7). The Supabase client lives only inside
// these lazy chunks (via AdminRoute / the app surfaces), never in the main entry.
const Landing = React.lazy(() => import("./marketing/Landing.jsx"));
const Blog = React.lazy(() => import("./marketing/Blog.jsx"));
const Podcast = React.lazy(() => import("./marketing/Podcast.jsx"));
const PatronApp = React.lazy(() => import("./patron/PatronApp.jsx"));
const BusinessApp = React.lazy(() => import("./business/BusinessApp.jsx"));
const Signup = React.lazy(() => import("./business/Signup.jsx"));
const PendingApproval = React.lazy(() =>
  import("./business/Signup.jsx").then((m) => ({ default: m.PendingApproval })));
const AdminRoute = React.lazy(() => import("./admin/AdminRoute.jsx"));

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

  // Match a route as an exact path or a `/segment/...` subpath — never an
  // unanchored prefix, so `/app` can't be matched by `/apple`, etc.
  const at = (seg) => path === seg || path.startsWith(seg + "/");

  if (at("/admin")) return <AdminRoute />;

  if (at("/business/signup")) {
    return <div style={{ height: "100dvh", margin: "0 auto" }}><Signup /></div>;
  }
  if (at("/business")) {
    if (params.get("signup") === "pending") {
      return <div style={{ height: "100dvh", margin: "0 auto" }}><PendingApproval /></div>;
    }
    return <div style={{ height: "100dvh", maxWidth: 1320, margin: "0 auto" }}><BusinessApp /></div>;
  }

  if (at("/app")) {
    return (
      <div style={{ height: "100dvh", maxWidth: 560, margin: "0 auto", background: "var(--paper-50)", boxShadow: "0 0 0 1px var(--ink-100)" }}>
        <PatronApp initialTab="home" />
      </div>
    );
  }

  if (path.startsWith("/blog/")) {
    const slug = decodeURIComponent(path.replace(/^\/blog\//, "").replace(/\/+$/, ""));
    return slug ? <Blog slug={slug} /> : <Blog />;
  }
  if (at("/blog")) return <Blog />;
  if (at("/podcast")) return <Podcast />;

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
