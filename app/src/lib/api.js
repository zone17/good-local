// ============================================================
// api.js — the typed seam (contracts §§2–4).
//
// One function per domain verb. Every mutation is either a Postgres
// RPC (deterministic, RLS-aware) or an edge function (external
// secret/service only) — see contracts §1.4. Arg names are
// p_-prefixed to match the RPC signatures. Response shapes in the
// JSDoc are copied from the contract response JSON.
//
// Screens still run on mocks (app/src/data.js); this file is the seam
// that the story phases wire in. Do NOT import it into screens yet.
// ============================================================

import { supabase } from "./auth.js";
import { toApiError } from "./errors.js";

/**
 * Thin RPC caller — invokes a Postgres function and returns its data,
 * or throws a normalized ApiError.
 * @param {string} name  the RPC name (snake_case).
 * @param {object} [args] p_-prefixed arguments.
 * @returns {Promise<any>}
 */
async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw toApiError(error);
  return data;
}

/**
 * Thin edge-function caller — invokes a deployed function with a JSON
 * body and returns its data, or throws a normalized ApiError. Edge
 * errors may surface the §1.2 envelope inside `data` or as `error`.
 * @param {string} name  the edge function name.
 * @param {object} [body] JSON request body.
 * @returns {Promise<any>}
 */
async function edge(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw toApiError(error);
  if (data && typeof data === "object" && data.error) throw toApiError(data);
  return data;
}

// ============================================================
// §2 — Patron capabilities
// ============================================================

/**
 * §2.1 record_check_in — earn a stamp for this visit (RPC).
 * @param {{ businessSlug: string, codeValue: string, deviceRef: string }} args
 * @returns {Promise<{
 *   stamp: { id: string, business_slug: string, code_version: number, stamped_at: string, attribution: string },
 *   perk_progress: { perk_id: string, name: string, current: number, threshold: number, ready: boolean },
 *   regional_progress: { towns_visited: number, towns_total: number, milestones_unlocked: string[] },
 *   first_visit_flags: { first_at_business: boolean, first_in_town: boolean, steered: boolean }
 * }>}
 */
export function recordCheckIn({ businessSlug, codeValue, deviceRef }) {
  return rpc("record_check_in", {
    p_business_slug: businessSlug,
    p_code_value: codeValue,
    p_device_ref: deviceRef,
  });
}

/**
 * §2.2 record_impressions — log that businesses were surfaced (RPC).
 * @param {{ businessIds: string[], surface: 'discovery' | 'business_detail' }} args
 * @returns {Promise<{ recorded: number, deduped: number }>}
 */
export function recordImpressions({ businessIds, surface }) {
  return rpc("record_impressions", {
    p_business_ids: businessIds,
    p_surface: surface,
  });
}

/**
 * §2.3 claim_passport — claim/merge into one identity by phone (edge fn).
 * @param {{ phone: string, otp: string }} args  phone in E.164.
 * @returns {Promise<{ patron_id: string, merged_from: string[], linked_devices: number, claimed: boolean }>}
 */
export function claimPassport({ phone, otp }) {
  return edge("claim-passport", { phone, otp });
}

/**
 * §2.3 link_device — add another device to the claimed identity (RPC).
 * @param {{ deviceRef: string }} args
 * @returns {Promise<{ linked_devices: number }>}
 */
export function linkDevice({ deviceRef }) {
  return rpc("link_device", { p_device_token: deviceRef });
}

/**
 * §2.4 get_my_passport — passport home view (RPC, read).
 * @returns {Promise<{
 *   patron: { id: string, display_name: string, claimed: boolean },
 *   businesses: Array<{ business_slug: string, name: string, town: string, stamp_count: number,
 *     stamp_dates: string[], perks: Array<{ perk_id: string, name: string, current: number, threshold: number, ready: boolean }> }>,
 *   region: { towns_visited: number, towns_total: number,
 *     milestones: Array<{ id: string, name: string, unlocked_at: string }> }
 * }>}
 */
export function getMyPassport() {
  return rpc("get_my_passport");
}

/**
 * §2.5 get_discovery — curated picks + true-regulars counters (RPC, read).
 * No ordering/ranking params exist by contract (Art. I).
 * @param {{ town?: string }} [args]  omit town for all towns in region.
 * @returns {Promise<{
 *   towns: Array<{ town: string, picks: Array<{ business_slug: string, name: string, category?: string,
 *     owner_note?: string, regulars_this_season: number, curation_label?: string, regulars_empty?: boolean }> }>
 * }>}
 */
export function getDiscovery({ town } = {}) {
  return rpc("get_discovery", { p_town: town ?? null });
}

/**
 * §2.6 get_business_detail — single business view (RPC, read).
 * @param {{ businessSlug: string }} args
 * @returns {Promise<{
 *   business_slug: string, name: string, town: string, category: string, hours: string,
 *   owner_note: string, directions_url: string, regulars_this_season: number, regulars_empty: boolean,
 *   my_progress: { stamp_count: number, perks: Array<{ perk_id: string, current: number, threshold: number }> }
 * }>}
 */
export function getBusinessDetail({ businessSlug }) {
  return rpc("get_business_detail", { p_business_slug: businessSlug });
}

// ============================================================
// §3 — Owner capabilities
// ============================================================

/**
 * §3.1 create_checkout_session — signup billing handoff (edge fn).
 * @param {{ businessName: string, ownerEmail: string, town: string, idempotencyKey: string }} args
 * @returns {Promise<{ checkout_url: string, business_id: string }>}
 */
export function createCheckoutSession({ businessName, ownerEmail, town, idempotencyKey }) {
  return edge("create_checkout_session", {
    business_name: businessName,
    owner_email: ownerEmail,
    town,
    idempotency_key: idempotencyKey,
  });
}

/**
 * §3.2 update_business_profile — edit profile (RPC). All fields optional (set-state).
 * `businessId` is optional; when omitted the RPC resolves to the caller's own
 * business (RLS-scoped). `town` is a town slug.
 * @param {{ businessId?: string, name?: string, town?: string, category?: string,
 *   hours?: string, ownerNote?: string, stampCode?: string }} args
 * @returns {Promise<object>} the updated `business` row.
 */
export function updateBusinessProfile({ businessId, name, town, category, hours, ownerNote, stampCode } = {}) {
  return rpc("update_business_profile", {
    p_business_id: businessId ?? null,
    p_name: name ?? null,
    p_town_slug: town ?? null,
    p_category: category ?? null,
    p_hours: hours ?? null,
    p_owner_note: ownerNote ?? null,
    p_stamp_code: stampCode ?? null,
  });
}

/**
 * §3.3 publish_perk — create a standalone perk (RPC).
 * @param {{ businessId: string, name: string, description: string, threshold: number,
 *   kind: 'status_good' | 'off_peak_treat' | 'small_discount' }} args
 * @returns {Promise<object>} the created `perk`.
 */
export function publishPerk({ businessId, name, description, threshold, kind }) {
  return rpc("publish_perk", {
    p_business_id: businessId,
    p_name: name,
    p_description: description,
    p_threshold: threshold,
    p_kind: kind,
  });
}

/**
 * §3.3 update_perk — edit a perk; threshold edits apply prospectively (RPC).
 * @param {{ perkId: string, name?: string, description?: string, threshold?: number,
 *   kind?: 'status_good' | 'off_peak_treat' | 'small_discount' }} args
 * @returns {Promise<object & { applies_prospectively: boolean }>} the updated `perk`.
 */
export function updatePerk({ perkId, name, description, threshold, kind }) {
  return rpc("update_perk", {
    p_perk_id: perkId,
    p_name: name ?? null,
    p_description: description ?? null,
    p_threshold: threshold ?? null,
    p_kind: kind ?? null,
  });
}

/**
 * §3.3 set_perk_active — activate/deactivate a perk; never destroys stamps (RPC).
 * @param {{ perkId: string, active: boolean }} args
 * @returns {Promise<object>} the updated `perk`.
 */
export function setPerkActive({ perkId, active }) {
  return rpc("set_perk_active", {
    p_perk_id: perkId,
    p_active: active,
  });
}

/**
 * §3.4 get_register_kit — current code + print payload (RPC, read).
 * `businessId` is optional; when omitted the RPC resolves to the caller's own
 * business (RLS-scoped).
 * @param {{ businessId?: string }} [args]
 * @returns {Promise<{
 *   business_slug: string, code_value: string, code_version: number, qr_url: string,
 *   rotates_at: string, instructions: string, reprint_needed: boolean
 * }>}
 */
export function getRegisterKit({ businessId } = {}) {
  return rpc("get_register_kit", { p_business_id: businessId ?? null });
}

/**
 * §3.5 staff_check_in — auditable phone-number check-in (RPC).
 * The owner's business is the target; pass its id (the RPC verifies ownership).
 * @param {{ businessId: string, phone: string }} args  phone in E.164.
 * @returns {Promise<{
 *   stamp: { id: string, attribution: string, staff_session: string, stamped_at: string },
 *   perk_progress: { perk_id: string, current: number, threshold: number, ready: boolean },
 *   claim_link_sent: boolean
 * }>}
 */
export function staffCheckIn({ businessId, phone }) {
  return rpc("staff_check_in", {
    p_business_id: businessId,
    p_phone: phone,
  });
}

/**
 * §3.6 redeem_perk — record a redemption at the register (RPC).
 * @param {{ patronRef: string, perkId: string }} args
 * @returns {Promise<{
 *   redemption: { id: string, patron_ref: string, perk_id: string, redeemed_at: string, verifying_staff: string },
 *   perk_progress: { current: number, threshold: number, ready: boolean }
 * }>}
 */
export function redeemPerk({ patronRef, perkId }) {
  return rpc("redeem_perk", {
    p_patron_ref: patronRef,
    p_perk_id: perkId,
  });
}

/**
 * §3.7 get_dashboard — weekly aggregates view (RPC, read).
 * @returns {Promise<{
 *   weekly_note: string,
 *   headline: { repeat_visit_rate: number, verified_regulars: number, new_patrons: number,
 *     redemptions: number, deltas: { verified_regulars: number, new_patrons: number } },
 *   perk_performance: Array<{ perk_id: string, name: string, redemptions: number, eligible: number, read: string }>,
 *   activity_feed: Array<{ at: string, patron_display: string, event: string }>,
 *   visit_pattern_14d: Array<{ date: string, stamps: number }>
 * }>}
 */
export function getDashboard() {
  return rpc("get_dashboard");
}

/**
 * §3.8 share_weekly_note — email the weekly note to a co-owner (RPC).
 * @param {{ email: string }} args
 * @returns {Promise<{ sent: boolean, week_of: string }>}
 */
export function shareWeeklyNote({ email }) {
  return rpc("share_weekly_note", { p_email: email });
}

/**
 * §3.9 switch_winter_tier — move to the $49 winter tier (edge fn, Stripe write).
 * @returns {Promise<{ plan: string, monthly: number, founding_rate_preserved: boolean }>}
 */
export function switchWinterTier() {
  return edge("update-subscription-plan", { action: "winter" });
}

/**
 * §3.9 revert_founding_rate — revert to the locked $79 founding rate (edge fn, Stripe write).
 * @returns {Promise<{ plan: string, monthly: number }>}
 */
export function revertFoundingRate() {
  return edge("update-subscription-plan", { action: "founding" });
}

// ============================================================
// §4 — Admin capabilities
// ============================================================

/**
 * §4.1 approve_business — gate a pending signup to active (RPC).
 * @param {{ businessId: string }} args
 * @returns {Promise<{ business_id: string, status: string, approved_by: string, approved_at: string }>}
 */
export function approveBusiness({ businessId }) {
  return rpc("approve_business", { p_business_id: businessId });
}

/**
 * §4.1 decline_business — decline a pending signup; cancels subscription (RPC).
 * @param {{ businessId: string, reason: string }} args
 * @returns {Promise<{ business_id: string, status: string, subscription_cancelled: boolean }>}
 */
export function declineBusiness({ businessId, reason }) {
  return rpc("decline_business", {
    p_business_id: businessId,
    p_reason: reason,
  });
}

/**
 * §4.2 curate_founding_pick — set/unset/order picks per town (RPC).
 * @param {{ businessId: string, town: string, action: 'set' | 'unset' | 'order', position?: number }} args
 * @returns {Promise<{ town: string, picks: Array<{ business_id: string, position: number, curated_by: string }> }>}
 */
export function curateFoundingPick({ businessId, town, action, position }) {
  return rpc("curate_founding_pick", {
    p_business_id: businessId,
    p_town: town,
    p_action: action,
    p_position: position ?? null,
  });
}

/**
 * §4.3 rotate_code — rotate a business code + optionally update schedule (RPC).
 * @param {{ businessId: string, reason: string, schedule?: { interval_days: number, grace_hours: number } }} args
 * @returns {Promise<{
 *   business_id: string, new_version: number, grace_until: string, reprint_prompted: boolean,
 *   schedule: { interval_days: number, grace_hours: number }
 * }>}
 */
export function rotateCode({ businessId, reason, schedule }) {
  return rpc("rotate_code", {
    p_business_id: businessId,
    p_reason: reason,
    p_schedule: schedule ?? null,
  });
}

/**
 * §4.4 read_gate_metrics — the pre-registered gate readings (RPC, read). No params.
 * @returns {Promise<Array<{
 *   metric: string, value: number, n: number,
 *   threshold: { target?: number, kill?: number, sample_floor?: number },
 *   kill_floor: number | null, sample_floor: number | null,
 *   valid: boolean, verdict_eligibility: 'ELIGIBLE' | 'INSUFFICIENT_SAMPLE' | 'TRUST_MODEL_VOID'
 * }>>}
 */
export function readGateMetrics() {
  return rpc("read_gate_metrics");
}

/**
 * §4.5 list_staff_entry_audit — staff-path audit (RPC, read).
 * @param {{ businessId?: string, since?: string }} [args]  since is timestamptz.
 * @returns {Promise<Array<{
 *   stamp_id: string, business_id: string, staff_session: string, patron_ref: string,
 *   at: string, flagged_anomaly: boolean
 * }>>}
 */
export function listStaffEntryAudit({ businessId, since } = {}) {
  return rpc("list_staff_entry_audit", {
    p_business_id: businessId ?? null,
    p_since: since ?? null,
  });
}

/**
 * §4.6 void_stamp — Tier-3 history-preserving correction (RPC).
 * @param {{ stampId: string, reason: string }} args
 * @returns {Promise<{ stamp_id: string, status: string, voided_by: string, voided_at: string, reason: string }>}
 */
export function voidStamp({ stampId, reason }) {
  return rpc("void_stamp", {
    p_stamp_id: stampId,
    p_reason: reason,
  });
}
