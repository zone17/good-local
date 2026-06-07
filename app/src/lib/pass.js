// ============================================================
// pass.js — the PassIssuer adapter (T032; research R5).
//
// One thin interface, three operations: issuePass / updatePass / revokePass.
// The default WebPassportIssuer writes a row into wallet_pass_instances so the
// installs gate (gate_passport_adds) counts every "add to passport" even before
// native .pkpass / Google Wallet issuance ships. Platform-specific issuers are
// stubbed behind PLATFORM_PASS_FLAG — the pre-launch A/B (R5) decides which
// becomes real; the web passport is the complete fallback either way (FR-020).
// ============================================================

import { supabase } from "./auth.js";

/** A/B switch: 'web' (default), 'apple', or 'google'. Set via VITE_WALLET_AB. */
export const PLATFORM_PASS_FLAG = import.meta.env.VITE_WALLET_AB ?? "web";

/** Infer the wallet platform from the user agent (iOS → apple, else google). */
export function platformFromUA(ua = (typeof navigator !== "undefined" ? navigator.userAgent : "")) {
  return /iphone|ipad|ipod|mac os/i.test(ua) ? "apple" : "google";
}

/**
 * @typedef {Object} PassIssuer
 * @property {(args: { patronId: string, platform?: string }) => Promise<{ serial: string, platform: string }>} issuePass
 * @property {(args: { serial: string }) => Promise<void>} updatePass
 * @property {(args: { serial: string }) => Promise<void>} revokePass
 */

/**
 * The web passport issuer — the always-available default. Records the add in
 * wallet_pass_instances (RLS: patron-own insert) so the gate counts it. One
 * pass per (patron, platform): a repeat add updates the existing serial.
 * @type {PassIssuer}
 */
export const WebPassportIssuer = {
  async issuePass({ patronId, platform }) {
    // patronId is resolved server-side from the JWT (current_patron_id); the
    // add_wallet_pass RPC is the RLS-safe writer (one row per patron×platform).
    void patronId;
    const plat = platform ?? platformFromUA();
    const { data, error } = await supabase.rpc("add_wallet_pass", { p_platform: plat });
    if (error) throw error;
    return { serial: data?.serial, platform: data?.platform ?? plat };
  },

  async updatePass({ serial }) {
    const { error } = await supabase
      .from("wallet_pass_instances")
      .update({ last_updated_at: new Date().toISOString() })
      .eq("serial", serial);
    if (error) throw error;
  },

  async revokePass({ serial }) {
    // The web passport has no server artifact to revoke beyond the row; the
    // native issuers (below) call out to Apple/Google to invalidate the pass.
    void serial;
  },
};

// --- Platform stubs behind the A/B (R5) -------------------------------------
// These are intentionally minimal: the A/B decides which ships for real. Until
// then they fall back to the web issuer so the add still counts to the gate.
const AppleWalletIssuer = {
  async issuePass(args) {
    // Stub: real impl signs a .pkpass via an edge fn with the Pass Type ID cert.
    return WebPassportIssuer.issuePass({ ...args, platform: "apple" });
  },
  updatePass: WebPassportIssuer.updatePass,
  revokePass: WebPassportIssuer.revokePass,
};

const GoogleWalletIssuer = {
  async issuePass(args) {
    // Stub: real impl calls the Google Wallet API with a service account.
    return WebPassportIssuer.issuePass({ ...args, platform: "google" });
  },
  updatePass: WebPassportIssuer.updatePass,
  revokePass: WebPassportIssuer.revokePass,
};

/** Resolve the active issuer from the A/B flag. */
export function getPassIssuer() {
  switch (PLATFORM_PASS_FLAG) {
    case "apple":
      return AppleWalletIssuer;
    case "google":
      return GoogleWalletIssuer;
    default:
      return WebPassportIssuer;
  }
}
