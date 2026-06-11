// ============================================================
// recover.jsx — the runtime safety net (spec 002 FR-013).
//
// Two pieces, shared by both entries:
//   <ErrorBoundary>  — catches render errors; shows a branded reload
//                      state instead of unmounting to a blank page.
//   lazyRetry(...)   — React.lazy wrapper that survives a stale deploy:
//                      a hashed chunk that 404s after a new release
//                      triggers ONE automatic reload (sessionStorage
//                      guard), after which the boundary takes over.
// ============================================================
import React from "react";

const RELOAD_KEY = "gl-chunk-reload";

/** One-shot reload guard: returns true if we just self-reloaded. */
function alreadyReloaded() {
  try {
    return sessionStorage.getItem(RELOAD_KEY) === "1";
  } catch {
    return true; // storage unavailable → never loop reloads
  }
}

function markReloaded() {
  try {
    sessionStorage.setItem(RELOAD_KEY, "1");
  } catch {
    /* storage unavailable — boundary will handle it */
  }
}

function clearReloadMark() {
  try {
    sessionStorage.removeItem(RELOAD_KEY);
  } catch {
    /* noop */
  }
}

/**
 * React.lazy with stale-deploy recovery. On a failed dynamic import
 * (classic post-deploy hashed-chunk 404), reload the page once; if the
 * import fails again after that reload, rethrow into the boundary.
 * @param {() => Promise<any>} importer
 */
export function lazyRetry(importer) {
  return React.lazy(() =>
    importer().then(
      (mod) => {
        clearReloadMark();
        return mod;
      },
      (err) => {
        if (!alreadyReloaded()) {
          markReloaded();
          window.location.reload();
          // Keep Suspense pending while the reload happens.
          return new Promise(() => {});
        }
        throw err;
      },
    ),
  );
}

/**
 * Branded last-resort error screen. Inline styles only — this must render
 * even when stylesheets or chunks failed to load.
 */
export function RecoveryScreen({ onRetry }) {
  return (
    <div
      role="alert"
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 24,
        textAlign: "center",
        background: "#faf7f0",
        color: "#1d4231",
        fontFamily: "Georgia, 'Times New Roman', serif",
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 600 }}>Something went sideways.</div>
      <div style={{ fontSize: 15, maxWidth: 360, lineHeight: 1.5 }}>
        Your passport and stamps are safe. Reload to pick up where you left off.
      </div>
      <button
        type="button"
        onClick={onRetry}
        style={{
          padding: "12px 28px",
          minHeight: 44,
          fontSize: 15,
          border: "1px solid #1d4231",
          borderRadius: 999,
          background: "#1d4231",
          color: "#faf7f0",
          cursor: "pointer",
        }}
      >
        Reload
      </button>
    </div>
  );
}

/**
 * Classic error boundary. Catches anything thrown during render in the
 * subtree (including lazyRetry rethrows after the one-shot reload).
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    // Error tracking hooks in here once telemetry lands (spec 002 US1).
    if (import.meta.env.DEV) console.error("[boundary]", error, info);
  }

  render() {
    if (this.state.failed) {
      return <RecoveryScreen onRetry={() => window.location.reload()} />;
    }
    return this.props.children;
  }
}
