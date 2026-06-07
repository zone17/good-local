// ===========================================================================
// review-hardening.test.ts — regression coverage for the 2026-06-07 review
// findings (todos/review-consolidated.md). One test per closed gap:
//
//   P1-1/2  concurrent claim_passport for one phone — serialized, no raw 23505,
//           merged_into chains stay flat (single-hop canonical)
//   P1-3    OTP verify brute-force lockout (5 wrong guesses kills the code)
//   P1-5    security_invoker views — direct PostgREST reads run under caller RLS
//   P2-6    concurrent redeem_perk same patron+perk — exactly one redemption
//   P2-7    duplicate/concurrent Stripe webhook delivery — side effects once
//   P2-9    merge with colliding impressions/unlocks — no orphans on the loser
//   P2-11   gate_metrics_evaluated not executable by app roles
//   P3-12   business-detail perk progress resets after redemption
//   P3-13   regulars ordering numeric across digit-length boundaries
//   P3-14   perk_progress_count not executable by app roles
//
// RPC custom errors surface as { code: "P0001", message: "<§7 CODE>" };
// assertions branch on error.message, never prose. Raw Postgres "23505"
// / "duplicate key" must NEVER reach a client — asserted explicitly.
// ===========================================================================
import { beforeAll, describe, expect, it } from "vitest";
import { type SupabaseClient } from "@supabase/supabase-js";
import {
  SEED,
  serviceClient,
  ownerClient,
  anonPatronClient,
  ensureSeedAuthPasswords,
} from "./helpers";
import { handleStripeEvent } from "../../supabase/functions/_shared/stripe-webhook-core";

let svc: SupabaseClient;
let owner: SupabaseClient;
let seasonId: string;
let codeAId: string;
let perkId: string;
let perkThreshold: number;
let serverToday: string;

const runTag = crypto.randomUUID().slice(0, 8);
let phoneSeq = 0;
/** Unique E.164 phone per call (random block + per-run sequence → no collisions). */
function freshPhone(): string {
  phoneSeq += 1;
  const block = String(Math.floor(Math.random() * 90000) + 10000); // 5 digits
  return `+1845${block}${String(phoneSeq).padStart(2, "0")}`; // +1845 + 7 digits
}

function daysAgo(n: number): string {
  const d = new Date(`${serverToday}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

async function insertOtp(phone: string, code: string): Promise<void> {
  const { error } = await svc.from("otp_codes").insert({
    phone,
    code,
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  if (error) throw new Error(`insert otp failed: ${error.message}`);
}

/** First-touch so the anon session has a patrons row; returns its patron id. */
async function ensurePatronRow(client: SupabaseClient): Promise<string> {
  await client.rpc("link_device", { p_device_token: `rh-${crypto.randomUUID()}` });
  const { data } = await client.auth.getUser();
  const { data: row, error } = await svc
    .from("patrons")
    .select("id")
    .eq("auth_user_id", data.user!.id)
    .single();
  if (error || !row) throw new Error(`no patron row: ${error?.message}`);
  return row.id as string;
}

/** N valid stamps at The Heron on distinct past dates for a patron. */
async function stampTimes(patronId: string, n: number, offset = 0): Promise<void> {
  const rows = Array.from({ length: n }, (_, i) => ({
    patron_id: patronId,
    business_id: SEED.businessId,
    season_id: seasonId,
    local_date: daysAgo(i + 1 + offset),
    code_version_ref: codeAId,
    trust_valid: true,
  }));
  const { error } = await svc.from("stamps").insert(rows);
  if (error) throw new Error(`arrange stamps failed: ${error.message}`);
}

beforeAll(async () => {
  svc = serviceClient();
  await ensureSeedAuthPasswords();
  owner = await ownerClient(SEED.ownerEmail);

  seasonId = (await svc.from("seasons").select("id").eq("is_current", true).single()).data!
    .id as string;
  codeAId = (
    await svc
      .from("check_in_codes")
      .select("id")
      .eq("business_id", SEED.businessId)
      .eq("status", "current")
      .single()
  ).data!.id as string;
  {
    const { data } = await svc
      .from("perks")
      .select("id, visit_threshold")
      .eq("business_id", SEED.businessId)
      .eq("status", "active")
      .order("visit_threshold", { ascending: true })
      .limit(1)
      .single();
    perkId = data!.id as string;
    perkThreshold = data!.visit_threshold as number;
  }
  serverToday = (await svc.rpc("current_local_date")).data as string;
});

// ---------------------------------------------------------------------------
// P1-1 / P1-2 — claim_passport concurrency
// ---------------------------------------------------------------------------
describe("claim_passport concurrency (P1-1/P1-2)", () => {
  it("two simultaneous claims of one phone: serialized, no raw 23505, one canonical holder", async () => {
    const phone = freshPhone();
    const a = await anonPatronClient();
    const b = await anonPatronClient();
    await ensurePatronRow(a.client);
    await ensurePatronRow(b.client);
    await insertOtp(phone, "111222");

    const [ra, rb] = await Promise.all([
      a.client.rpc("claim_passport", { p_phone: phone, p_otp: "111222" }),
      b.client.rpc("claim_passport", { p_phone: phone, p_otp: "111222" }),
    ]);

    // Exactly one wins the (single-use) OTP; the loser gets a §7 code — never
    // a raw Postgres duplicate-key error.
    const results = [ra, rb];
    const successes = results.filter((r) => !r.error);
    const failures = results.filter((r) => r.error);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0].error!.message).not.toMatch(/duplicate key|23505/i);
    expect(failures[0].error!.message).toMatch(/OTP_INVALID|INVALID_STATE|RATE_LIMITED/);

    // Exactly one patron holds the phone.
    const holders = await svc.from("patrons").select("id").eq("phone", phone);
    expect(holders.data).toHaveLength(1);
  });

  it("merge flattens merged_into chains — single-hop resolution stays canonical", async () => {
    const phone = freshPhone();

    // Winner W: existing patron already holding the phone.
    const w = await anonPatronClient();
    const wId = await ensurePatronRow(w.client);
    await svc.from("patrons").update({ phone }).eq("id", wId);

    // Loser L: the claiming session's patron. X: a patron previously merged
    // into L (simulated prior merge) — after L loses, X must point at W, not
    // at the merged-away L (the 2-hop chain the review constructed).
    const l = await anonPatronClient();
    const lId = await ensurePatronRow(l.client);
    const { data: x } = await svc
      .from("patrons")
      .insert({ display_name: `chain-x-${runTag}`, merged_into: lId })
      .select("id")
      .single();

    await insertOtp(phone, "333444");
    const { data, error } = await l.client.rpc("claim_passport", {
      p_phone: phone,
      p_otp: "333444",
    });
    expect(error).toBeNull();
    expect(data.patron_id).toBe(wId);

    // L points at W; X was FLATTENED to point at W directly (no 2-hop chain).
    const rows = await svc
      .from("patrons")
      .select("id, merged_into")
      .in("id", [lId, x!.id as string]);
    for (const row of rows.data ?? []) {
      expect(row.merged_into).toBe(wId);
    }

    // Invariant: nobody anywhere points at a patron that is itself merged away.
    const { data: merged } = await svc
      .from("patrons")
      .select("id, merged_into")
      .not("merged_into", "is", null);
    const mergedIds = new Set((merged ?? []).map((r) => r.id as string));
    for (const row of merged ?? []) {
      expect(mergedIds.has(row.merged_into as string)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// P1-3 — OTP brute-force lockout
// ---------------------------------------------------------------------------
describe("OTP verify lockout (P1-3)", () => {
  it("5 wrong guesses kill the code; the correct code then gets RATE_LIMITED", async () => {
    const phone = freshPhone();
    const s = await anonPatronClient();
    await ensurePatronRow(s.client);
    await insertOtp(phone, "777888");

    for (let i = 0; i < 5; i++) {
      const { error } = await s.client.rpc("claim_passport", {
        p_phone: phone,
        p_otp: "000001",
      });
      expect(error).not.toBeNull();
      expect(error!.message).toContain("OTP_INVALID");
    }

    // Even the CORRECT code is now refused — the attacker can't brute the
    // 6-digit space and the legitimate user simply requests a fresh code.
    const { error } = await s.client.rpc("claim_passport", {
      p_phone: phone,
      p_otp: "777888",
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("RATE_LIMITED");
  });
});

// ---------------------------------------------------------------------------
// P1-5 — security_invoker views
// ---------------------------------------------------------------------------
describe("views run under caller RLS (P1-5)", () => {
  it("a patron reading valid_stamps directly sees only their own rows", async () => {
    // Arrange: another patron's stamp exists (any prior test guarantees data;
    // add one defensively).
    const other = await anonPatronClient();
    const otherId = await ensurePatronRow(other.client);
    await stampTimes(otherId, 1, 40);

    const me = await anonPatronClient();
    await ensurePatronRow(me.client);
    const { data, error } = await me.client.from("valid_stamps").select("patron_id");
    expect(error).toBeNull();
    // Fresh patron, no stamps → zero rows visible; the other patron's stamp
    // must NOT appear (pre-fix the view read with owner privileges → leaked).
    expect(data ?? []).toHaveLength(0);
  });

  it("an owner reading owner_visit_pattern_14d sees only businesses they own", async () => {
    // mira may own several businesses (other suites create more) — the
    // boundary is "no business owned by someone ELSE", not "only The Heron".
    const { data: mine } = await svc
      .from("businesses")
      .select("id")
      .eq("owner_user_id", SEED.ownerUserId);
    const myIds = new Set((mine ?? []).map((b) => b.id as string));

    const { data, error } = await owner.from("owner_visit_pattern_14d").select("business_id");
    expect(error).toBeNull();
    for (const row of data ?? []) {
      expect(myIds.has(row.business_id as string)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// P2-11 / P3-14 — internal functions not executable by app roles
// ---------------------------------------------------------------------------
describe("internal function grants (P2-11/P3-14)", () => {
  it("gate_metrics_evaluated is not executable by a patron JWT", async () => {
    const s = await anonPatronClient();
    const { error } = await s.client.rpc("gate_metrics_evaluated");
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/permission denied/i);
  });

  it("perk_progress_count is not executable by a patron JWT", async () => {
    const s = await anonPatronClient();
    const patronId = await ensurePatronRow(s.client);
    const { error } = await s.client.rpc("perk_progress_count", {
      p_patron_id: patronId,
      p_perk_id: perkId,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/permission denied/i);
  });
});

// ---------------------------------------------------------------------------
// P2-6 — redeem_perk TOCTOU
// ---------------------------------------------------------------------------
describe("concurrent redemption (P2-6)", () => {
  it("two simultaneous redeems for one ready patron → exactly one redemption", async () => {
    const { data: p } = await svc
      .from("patrons")
      .insert({ display_name: `race-redeem-${runTag}` })
      .select("id")
      .single();
    const patronId = p!.id as string;
    await stampTimes(patronId, perkThreshold);

    const [r1, r2] = await Promise.all([
      owner.rpc("redeem_perk", { p_patron_ref: patronId, p_perk_id: perkId }),
      owner.rpc("redeem_perk", { p_patron_ref: patronId, p_perk_id: perkId }),
    ]);

    const successes = [r1, r2].filter((r) => !r.error);
    const failures = [r1, r2].filter((r) => r.error);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0].error!.message).toContain("PERK_NOT_READY");

    const recs = await svc
      .from("perk_redemptions")
      .select("id")
      .eq("patron_id", patronId)
      .eq("perk_id", perkId);
    expect(recs.data).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// P2-7 — webhook idempotency under concurrent duplicate delivery
// ---------------------------------------------------------------------------
describe("concurrent duplicate Stripe delivery (P2-7)", () => {
  it("the same event delivered twice at once applies side effects exactly once", async () => {
    // Fresh business (subscriptions.business_id is UNIQUE — can't reuse Heron).
    const { data: town } = await svc.from("towns").select("id").limit(1).single();
    const { data: biz, error: bizErr } = await svc
      .from("businesses")
      .insert({
        region_id: SEED.regionId,
        town_id: town!.id,
        owner_user_id: SEED.ownerUserId,
        name: `Webhook Race ${runTag}`,
        slug: `webhook-race-${runTag}`,
        category: "cafe",
        hours: {},
        stamp_code:
          "W" +
          String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
          String.fromCharCode(65 + Math.floor(Math.random() * 26)),
        status: "pending",
      })
      .select("id")
      .single();
    if (bizErr) throw new Error(`arrange business failed: ${bizErr.message}`);
    const businessId = biz!.id as string;

    const ev = {
      id: `evt_race_${runTag}`,
      type: "checkout.session.completed",
      data: {
        object: {
          customer: `cus_race_${runTag}`,
          subscription: `sub_race_${runTag}`,
          metadata: { business_id: businessId },
        },
      },
    };

    const [a, b] = await Promise.all([handleStripeEvent(ev, svc), handleStripeEvent(ev, svc)]);

    // One applied, one deduped — and only ONE subscription row exists.
    expect([a.deduped, b.deduped].filter(Boolean)).toHaveLength(1);
    const subs = await svc.from("subscriptions").select("id").eq("business_id", businessId);
    expect(subs.data).toHaveLength(1);
    const processed = await svc
      .from("processed_stripe_events")
      .select("event_id")
      .eq("event_id", ev.id);
    expect(processed.data).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// P2-9 — merge with colliding impressions/unlocks; devices repoint totally
// ---------------------------------------------------------------------------
describe("merge collision semantics (P2-9)", () => {
  it("colliding impressions/unlocks dedupe to the winner; nothing stays on the loser", async () => {
    const phone = freshPhone();
    const day = daysAgo(3);

    const w = await anonPatronClient();
    const wId = await ensurePatronRow(w.client);
    await svc.from("patrons").update({ phone }).eq("id", wId);

    const l = await anonPatronClient();
    const lId = await ensurePatronRow(l.client);

    // Same-business-same-day impression on BOTH sides (the colliding pair) +
    // a loser-only impression that must move.
    const { data: milestone } = await svc
      .from("regional_milestones")
      .select("id")
      .limit(1)
      .single();
    await svc.from("steer_impressions").insert([
      { patron_id: wId, business_id: SEED.businessId, surface: "discovery_list", local_date: day },
      { patron_id: lId, business_id: SEED.businessId, surface: "discovery_list", local_date: day },
      { patron_id: lId, business_id: SEED.businessId, surface: "discovery_list", local_date: daysAgo(9) },
    ]);
    await svc.from("milestone_unlocks").insert([
      { patron_id: wId, milestone_id: milestone!.id },
      { patron_id: lId, milestone_id: milestone!.id },
    ]);

    await insertOtp(phone, "555666");
    const { error } = await l.client.rpc("claim_passport", { p_phone: phone, p_otp: "555666" });
    expect(error).toBeNull();

    // Loser owns NOTHING afterward — colliding rows deleted, the rest moved.
    for (const table of ["steer_impressions", "milestone_unlocks", "patron_devices"]) {
      const { data } = await svc.from(table).select("id").eq("patron_id", lId);
      expect(data ?? []).toHaveLength(0);
    }
    // Winner: exactly ONE impression for the colliding (business, day) and the
    // loser-only impression arrived; exactly one unlock for the milestone.
    const collided = await svc
      .from("steer_impressions")
      .select("id")
      .eq("patron_id", wId)
      .eq("business_id", SEED.businessId)
      .eq("local_date", day);
    expect(collided.data).toHaveLength(1);
    const moved = await svc
      .from("steer_impressions")
      .select("id")
      .eq("patron_id", wId)
      .eq("local_date", daysAgo(9));
    expect(moved.data).toHaveLength(1);
    const unlocks = await svc
      .from("milestone_unlocks")
      .select("id")
      .eq("patron_id", wId)
      .eq("milestone_id", milestone!.id);
    expect(unlocks.data).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// P3-12 — business-detail progress reset
// ---------------------------------------------------------------------------
describe("business-detail progress reset (P3-12)", () => {
  it("perk 'current' resets to 0 after redemption; lifetime stamp_count stays", async () => {
    const s = await anonPatronClient();
    const patronId = await ensurePatronRow(s.client);
    await stampTimes(patronId, perkThreshold);

    const before = await s.client.rpc("get_business_detail", {
      p_business_slug: SEED.businessSlug,
    });
    expect(before.error).toBeNull();
    const beforePerk = before.data.my_progress.perks.find(
      (p: { perk_id: string }) => p.perk_id === perkId,
    );
    expect(beforePerk.current).toBe(perkThreshold);

    const redeemed = await owner.rpc("redeem_perk", {
      p_patron_ref: patronId,
      p_perk_id: perkId,
    });
    expect(redeemed.error).toBeNull();

    const after = await s.client.rpc("get_business_detail", {
      p_business_slug: SEED.businessSlug,
    });
    expect(after.error).toBeNull();
    expect(after.data.my_progress.stamp_count).toBe(perkThreshold); // lifetime, by design
    const afterPerk = after.data.my_progress.perks.find(
      (p: { perk_id: string }) => p.perk_id === perkId,
    );
    expect(afterPerk.current).toBe(0); // since-last-redemption (D-018)
  });
});

// ---------------------------------------------------------------------------
// P3-13 — regulars numeric ordering
// ---------------------------------------------------------------------------
describe("regulars ordering across digit boundaries (P3-13)", () => {
  it("a 12-visit patron sorts above a 9-visit patron (lexicographic would invert)", async () => {
    const { data: p12 } = await svc
      .from("patrons")
      .insert({ display_name: `Twelve ${runTag}` })
      .select("id")
      .single();
    const { data: p9 } = await svc
      .from("patrons")
      .insert({ display_name: `Nine ${runTag}` })
      .select("id")
      .single();
    await stampTimes(p12!.id as string, 12, 20);
    await stampTimes(p9!.id as string, 9, 20);

    const { data, error } = await owner.rpc("get_business_regulars");
    expect(error).toBeNull();
    const rows = data as Array<{ patron_ref: string; visits: number }>;

    // Globally non-increasing numeric order…
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].visits).toBeGreaterThanOrEqual(rows[i].visits);
    }
    // …and the digit-boundary pair lands the right way around.
    const i12 = rows.findIndex((r) => r.patron_ref === p12!.id);
    const i9 = rows.findIndex((r) => r.patron_ref === p9!.id);
    expect(i12).toBeGreaterThanOrEqual(0);
    expect(i9).toBeGreaterThanOrEqual(0);
    expect(i12).toBeLessThan(i9);
  });
});
