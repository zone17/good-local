// ============================================================
// trace.js — lightweight correlation + timing for the seam.
//
// Gives every call a correlation id and a dev-only timing log so a
// failed verb is traceable end to end. No-op cost in production:
// console.debug is gated on import.meta.env.DEV.
// ============================================================

/**
 * Fresh correlation id for one logical operation.
 * @returns {string} a UUID v4.
 */
export function newCorrelationId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID.
  return `cid_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/**
 * Wrap an async unit of work with a correlation id and timing log.
 * In dev, logs `{ correlationId, name, ms, ok }` on success and
 * `{ correlationId, name, ms, code }` on failure (then re-throws).
 *
 * @template T
 * @param {string} name        the verb/operation name (e.g. 'record_check_in').
 * @param {(correlationId: string) => Promise<T>} fn  the work; receives the id.
 * @returns {Promise<T>}
 */
export async function withTrace(name, fn) {
  const correlationId = newCorrelationId();
  const start =
    typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();

  const elapsed = () => {
    const now =
      typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
    return Math.round(now - start);
  };

  try {
    const result = await fn(correlationId);
    if (import.meta.env.DEV) {
      console.debug("[trace]", { correlationId, name, ms: elapsed(), ok: true });
    }
    return result;
  } catch (err) {
    if (import.meta.env.DEV) {
      const code = err && typeof err === "object" ? /** @type {any} */ (err).code : undefined;
      console.debug("[trace]", { correlationId, name, ms: elapsed(), code: code ?? "ERROR" });
    }
    throw err;
  }
}

// TODO: attach the correlation id as an outbound request header — set it via
// supabase-js global `headers` (e.g. 'x-correlation-id') so the id flows to
// Postgres/edge logs. supabase-js global headers are static at createClient
// time, so per-call propagation needs either a per-call fetch wrapper or an
// edge-side echo; wire this when server-side log correlation lands.
