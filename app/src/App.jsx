import React from "react";
import { ErrorBoundary, lazyRetry } from "./lib/recover.jsx";

// Every route component is code-split so each surface only ships its own chunk
// — the landing page (the most-hit entry) loads minimal JS, and the main entry
// stays well under the SC-008 budget (R7). The Supabase client lives only inside
// these lazy chunks (via AdminRoute / the app surfaces), never in the main entry.
// lazyRetry survives the stale-deploy hashed-chunk 404 (spec 002 FR-013).
const Landing = lazyRetry(() => import("./marketing/Landing.jsx"));
const Blog = lazyRetry(() => import("./marketing/Blog.jsx"));
const Podcast = lazyRetry(() => import("./marketing/Podcast.jsx"));
const PatronApp = lazyRetry(() => import("./patron/PatronApp.jsx"));
const BusinessApp = lazyRetry(() => import("./business/BusinessApp.jsx"));
const Signup = lazyRetry(() => import("./business/Signup.jsx"));
const PendingApproval = lazyRetry(() =>
  import("./business/Signup.jsx").then((m) => ({ default: m.PendingApproval })));
const AdminRoute = lazyRetry(() => import("./admin/AdminRoute.jsx"));
const Legal = lazyRetry(() => import("./marketing/Legal.jsx"));

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
  if (at("/privacy")) return <Legal page="privacy" />;
  if (at("/terms")) return <Legal page="terms" />;

  // Root and anything else → the marketing landing.
  return <Landing />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <React.Suspense fallback={<div style={{ minHeight: "100dvh", background: "var(--paper-50)" }} />}>
        <Routes />
      </React.Suspense>
    </ErrorBoundary>
  );
}
