// ============================================================
// auth.js — Supabase client singleton + identity helpers.
//
// Implements the auth contexts from contracts §1.1 on the client
// side: anon-patron (anonymous session, R3), patron (phone-claimed,
// handled by claim-passport), owner (email+password), admin (role
// claim). RLS + SECURITY DEFINER guards enforce the boundary; this
// module only obtains and reads the session — it never authorizes.
//
// Plain JS to match the repo style; shapes documented with JSDoc.
// ============================================================

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing Supabase env vars. Set VITE_SUPABASE_URL and " +
      "VITE_SUPABASE_ANON_KEY in app/.env.local (see app/.env.example)."
  );
}

/**
 * Shared Supabase client for the browser. Single instance per tab so
 * the auth session and realtime connection are not duplicated.
 * @type {import("@supabase/supabase-js").SupabaseClient}
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Shared with the lean check-in entry (checkin-api.js): one identity
    // across both bundles — the scan and the passport are the same patron.
    storageKey: "gl-auth",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * @typedef {Object} PatronSession
 * @property {string} userId       Supabase auth user id (durable patron identity, R3).
 * @property {boolean} isAnonymous True until a phone claim promotes anon → patron.
 */

/**
 * Ensure there is a patron session, creating an anonymous one on first
 * scan so stamp #1 is instant (R3 / SC-002 — no account wall). Safe to
 * call repeatedly; returns the existing session when one is present.
 * @returns {Promise<PatronSession>}
 */
export async function ensurePatronSession() {
  const { data: existing } = await supabase.auth.getSession();
  let user = existing?.session?.user ?? null;

  if (!user) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    user = data.user;
  }

  return {
    userId: user.id,
    isAnonymous: user.is_anonymous ?? user.app_metadata?.provider === "anonymous",
  };
}

/**
 * Sign in a business owner with email + password (contracts §1.1 owner).
 * @param {string} email
 * @param {string} password
 * @returns {Promise<import("@supabase/supabase-js").Session>}
 */
export async function signInOwner(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data.session;
}

/**
 * Create a business-owner auth account (email + password) at signup
 * (contracts §1.1 owner; US1 T021). The business row itself is created
 * `pending` by the create-checkout-session edge function via the service
 * role — this only establishes the owner identity.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<import("@supabase/supabase-js").Session | null>}
 */
export async function signUpOwner(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data.session;
}

/**
 * Send a password-reset email (spec 002 FR-021). The link returns the owner
 * to /business, where the PASSWORD_RECOVERY auth event mounts the
 * set-new-password form. Origin-relative so local dev and production both
 * resolve correctly (the hosted auth allowlist carries the production URL).
 * @param {string} email
 * @returns {Promise<void>}
 */
export async function resetOwnerPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/business`,
  });
  if (error) throw error;
}

/**
 * Set a new password on the active (recovery) session.
 * @param {string} newPassword
 * @returns {Promise<void>}
 */
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/**
 * End the current session (owner/admin sign-out; patrons stay anonymous-first).
 * @returns {Promise<void>}
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Role of the current session.
 * - 'admin'  — carried in app_metadata.role (the experiment apparatus, Art. III).
 * - 'owner'  — inferred when the session owns business rows.
 * - null     — anon/claimed patron, or signed out.
 * @returns {Promise<'admin' | 'owner' | null>}
 */
export async function getRole() {
  const { data } = await supabase.auth.getSession();
  const user = data?.session?.user;
  if (!user) return null;

  const role = user.app_metadata?.role;
  if (role === "admin") return "admin";

  // TODO: owner inference completed when api.getMyBusiness lands — until then
  // we cannot confirm owned business rows from the client, so report null.
  return null;
}

/**
 * Stable per-device token, persisted in localStorage. Used as the opaque
 * `device_ref` that links a scan to a patron session (contracts §2.1).
 * @returns {string}
 */
export function deviceToken() {
  const KEY = "gl_device";
  let token = null;
  try {
    token = localStorage.getItem(KEY);
  } catch {
    // localStorage unavailable (private mode / SSR) — fall through to ephemeral.
  }
  if (!token) {
    token =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `gl_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    try {
      localStorage.setItem(KEY, token);
    } catch {
      // best-effort persistence; token is still returned for this session.
    }
  }
  return token;
}
