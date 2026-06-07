// ============================================================
// checkin-api.js — the lean, fetch-only seam for the /c/{slug} entry (T030/T035).
//
// The check-in landing must stay under the 60KB gz budget (R7/SC-008), so it
// does NOT import @supabase/supabase-js. Instead it talks to the REST/Auth
// endpoints directly with plain fetch:
//   - anonymous sign-in via /auth/v1/signup (grant=anonymous)  → patron JWT
//   - record_check_in via /rest/v1/rpc/record_check_in         → the stamp
//   - record_impressions / claim-passport edge fn for the claim sheet
//
// Errors are normalized to { code } where code is a §7 machine code; the PostgREST
// error from a `raise exception` surfaces the code in `message`.
// ============================================================

const URL = import.meta.env.VITE_SUPABASE_URL;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

// SHARED with the main SPA (auth.js sets supabase-js storageKey to the same
// value): the patron who scans IS the patron who opens the passport. The
// stored value is the full GoTrue session JSON, the exact shape supabase-js
// reads, so either entry can mint it and the other resumes it.
const SESSION_KEY = "gl-auth";
const DEVICE_KEY = "gl_device";

/** Stable per-device token (mirrors auth.js deviceToken). */
export function deviceToken() {
  try {
    let t = localStorage.getItem(DEVICE_KEY);
    if (!t) {
      t = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, t);
    }
    return t;
  } catch {
    return `gl_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function saveSession(s) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    /* best effort */
  }
}

/**
 * Ensure an anonymous patron JWT exists (R3 — no account wall before stamp #1).
 * Reuses a stored, unexpired token; otherwise mints a fresh anonymous session.
 * @returns {Promise<string>} the access token
 */
export async function ensurePatronSession() {
  const existing = loadSession();
  if (existing?.access_token && existing.expires_at && existing.expires_at * 1000 > Date.now() + 30_000) {
    return existing.access_token;
  }
  // Expired but refreshable (e.g. an SPA session from a prior visit): refresh
  // instead of minting a NEW anonymous patron — identity must not fork.
  if (existing?.refresh_token) {
    const r = await fetch(`${URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON },
      body: JSON.stringify({ refresh_token: existing.refresh_token }),
    });
    const refreshed = await r.json().catch(() => null);
    if (r.ok && refreshed?.access_token) {
      saveSession(refreshed); // full session JSON — supabase-js readable
      return refreshed.access_token;
    }
    // fall through to a fresh anonymous session if refresh fails
  }
  const res = await fetch(`${URL}/auth/v1/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON },
    body: JSON.stringify({}), // empty body → anonymous sign-up when enabled
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw normalizeError(data, "UNAUTHENTICATED");
  }
  saveSession(data); // FULL session JSON (incl. refresh_token + user)
  return data.access_token;
}

async function rpc(name, args, token) {
  const res = await fetch(`${URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(args),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw normalizeError(data, "VALIDATION");
  return data;
}

/** record_check_in (contract §2.1) — the durable stamp. */
export async function recordCheckIn({ businessSlug, codeValue }) {
  const token = await ensurePatronSession();
  return rpc(
    "record_check_in",
    { p_business_slug: businessSlug, p_code_value: codeValue, p_device_ref: deviceToken() },
    token,
  );
}

/**
 * add_wallet_pass (T032/R5) — record the passport add so the installs gate
 * counts it, web variant. Platform inferred from UA (iOS → apple, else google).
 */
export async function addToPassport() {
  const token = await ensurePatronSession();
  const platform = /iphone|ipad|ipod|mac os/i.test(
    typeof navigator !== "undefined" ? navigator.userAgent : "",
  )
    ? "apple"
    : "google";
  return rpc("add_wallet_pass", { p_platform: platform }, token);
}

/** claim-passport edge fn — send OTP ({phone}) or verify ({phone, otp}). */
export async function claimPassport(body) {
  const token = await ensurePatronSession();
  const res = await fetch(`${URL}/functions/v1/claim-passport`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || (data && data.error)) throw normalizeError(data, "VALIDATION");
  return data;
}

/**
 * Map a PostgREST / envelope error to { code, message }. A `raise exception`
 * surfaces the §7 code in `message`; the envelope path carries `error.code`.
 */
function normalizeError(data, fallback) {
  const code =
    (data && data.error && data.error.code) ||
    (data && typeof data.message === "string" && data.message.trim()) ||
    (data && data.code) ||
    fallback;
  const err = new Error(code);
  err.code = String(code).toUpperCase().replace(/[^A-Z_]/g, "_").replace(/^_+|_+$/g, "") || fallback;
  // Prefer an exact §7 token when the message is exactly a code.
  if (data && typeof data.message === "string" && /^[A-Z_]+$/.test(data.message.trim())) {
    err.code = data.message.trim();
  }
  return err;
}
