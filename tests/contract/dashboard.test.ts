// ===========================================================================
// dashboard.test.ts — T049 [US6] contract tests for get_dashboard +
// share_weekly_note (contract §§3.7, 3.8).
//
// Arrangement (isolated business so aggregates are deterministic): a fresh
// owner + business + perk + code; a week of stamps for several patrons
// (including 2+ repeat pairs, a redemption, and a staff entry); then the owner
// calls get_dashboard and we assert the full shape, the template-composed
// weekly note, ordering, the zero-filled 14-day series, and — critically — that
// NO field anywhere exposes another business or a patron's other-business
// activity (we walk the JSON).
//
// share_weekly_note: valid email → { sent, week_of }; bad email → VALIDATION;
// per-email-per-week idempotency (second call → sent:true, no duplicate row).
//
// Requires the local stack with migrations + seed applied.
// ===========================================================================
import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SEED, serviceClient, ensureSeedAuthPasswords } from "../integration/helpers";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.API_URL ?? "http://127.0.0.1:54321";
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.ANON_KEY ?? "";

const OWNER_D_EMAIL = `owner-db-${crypto.randomUUID().slice(0, 8)}@test`;
const OWNER_D_PASSWORD = "test-password-owner-db";

let svc: SupabaseClient;
let owner: SupabaseClient;
let businessId: string;
let otherBusinessId: string; // a foreign business the dashboard must never leak
let perkId: string;
let codeId: string;
let otherCodeId: string;
let seasonId: string;
let serverToday: string;
const patrons: string[] = [];
let sharedPatron: string; // has stamps at BOTH businesses

function daysAgo(n: number): string {
  const d = new Date(`${serverToday}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

async function mkPatron(label: string): Promise<string> {
  const { data } = await svc.from("patrons").insert({ display_name: label }).select("id").single();
  return data!.id as string;
}

async function stamp(patronId: string, biz: string, code: string, date: string, staff = false) {
  if (staff) {
    const se = await svc
      .from("staff_entries")
      .insert({
        business_id: biz,
        staff_user_id: SEED.adminUserId,
        patron_phone: "+15555550100",
        local_date: date,
      })
      .select("id")
      .single();
    await svc.from("stamps").insert({
      patron_id: patronId,
      business_id: biz,
      season_id: seasonId,
      local_date: date,
      staff_entry_ref: se.data!.id,
      trust_valid: true,
    });
  } else {
    await svc.from("stamps").insert({
      patron_id: patronId,
      business_id: biz,
      season_id: seasonId,
      local_date: date,
      code_version_ref: code,
      trust_valid: true,
    });
  }
}

beforeAll(async () => {
  svc = serviceClient();
  await ensureSeedAuthPasswords();

  {
    const { data } = await svc.from("seasons").select("id").eq("is_current", true).single();
    seasonId = data!.id as string;
  }
  {
    const { data } = await svc.rpc("current_local_date");
    serverToday = data as string;
  }

  // owner-d auth user.
  const created = await svc.auth.admin.createUser({
    email: OWNER_D_EMAIL,
    password: OWNER_D_PASSWORD,
    email_confirm: true,
  });
  let ownerDId = created.data?.user?.id;
  if (!ownerDId) {
    const list = await svc.auth.admin.listUsers();
    ownerDId = list.data.users.find((u) => u.email === OWNER_D_EMAIL)?.id;
  }

  const { data: town } = await svc.from("towns").select("id").eq("slug", "bethel").single();

  // Primary business.
  const biz = await svc
    .from("businesses")
    .insert({
      region_id: SEED.regionId,
      town_id: town!.id,
      owner_user_id: ownerDId,
      name: "The Forge",
      slug: `the-forge-${crypto.randomUUID().slice(0, 6)}`,
      category: "cafe",
      stamp_code: "FRG",
      status: "active",
      approved_at: new Date().toISOString(),
      approved_by: SEED.adminUserId,
    })
    .select("id")
    .single();
  businessId = biz.data!.id as string;

  const perk = await svc
    .from("perks")
    .insert({
      business_id: businessId,
      name: "Forge Pour",
      description: "Fifth visit, on us",
      visit_threshold: 5,
      kind: "status_good",
      status: "active",
    })
    .select("id")
    .single();
  perkId = perk.data!.id as string;

  const code = await svc
    .from("check_in_codes")
    .insert({
      business_id: businessId,
      value: `forge-code-${crypto.randomUUID().slice(0, 6)}`,
      version: 1,
      status: "current",
    })
    .select("id")
    .single();
  codeId = code.data!.id as string;

  // A foreign business (different owner) for the privacy walk.
  otherBusinessId = SEED.businessId; // The Heron (owned by mira)
  {
    const { data } = await svc
      .from("check_in_codes")
      .select("id")
      .eq("business_id", otherBusinessId)
      .eq("status", "current")
      .single();
    otherCodeId = data!.id as string;
  }

  // ---- a week of activity ----
  // p1, p2 repeat (2+ visits) → verified regulars + repeat pairs.
  // p3 single visit. shared patron repeats here AND has a Heron stamp.
  const p1 = await mkPatron("Forge Ann");
  const p2 = await mkPatron("Forge Ben");
  const p3 = await mkPatron("Forge Cy");
  sharedPatron = await mkPatron("Forge Dee");
  patrons.push(p1, p2, p3, sharedPatron);

  await stamp(p1, businessId, codeId, daysAgo(2));
  await stamp(p1, businessId, codeId, daysAgo(1)); // repeat
  await stamp(p2, businessId, codeId, daysAgo(3));
  await stamp(p2, businessId, codeId, daysAgo(0)); // repeat
  await stamp(p3, businessId, codeId, daysAgo(1)); // single → new patron
  await stamp(sharedPatron, businessId, codeId, daysAgo(2));
  await stamp(sharedPatron, businessId, codeId, daysAgo(0)); // repeat
  // staff entry stamp (auditable path).
  await stamp(p1, businessId, codeId, daysAgo(0), true);

  // shared patron ALSO has activity at The Heron — must never surface here.
  await stamp(sharedPatron, otherBusinessId, otherCodeId, daysAgo(2));

  // a redemption: bring p1 to threshold then redeem under owner.
  const c = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email: OWNER_D_EMAIL, password: OWNER_D_PASSWORD });
  owner = c;

  // p1 needs 5 valid stamps; add the rest on older dates.
  await svc.from("stamps").insert(
    [5, 6, 7].map((d) => ({
      patron_id: p1,
      business_id: businessId,
      season_id: seasonId,
      local_date: daysAgo(d),
      code_version_ref: codeId,
      trust_valid: true,
    })),
  );
  await owner.rpc("redeem_perk", { p_patron_ref: p1, p_perk_id: perkId });
});

/** Recursively collect every string value in a JSON tree. */
function allStrings(node: unknown, acc: string[] = []): string[] {
  if (typeof node === "string") acc.push(node);
  else if (Array.isArray(node)) node.forEach((n) => allStrings(n, acc));
  else if (node && typeof node === "object") Object.values(node).forEach((n) => allStrings(n, acc));
  return acc;
}

describe("get_dashboard (contract §3.7)", () => {
  it("returns the full shape with template-composed weekly note", async () => {
    const { data, error } = await owner.rpc("get_dashboard", { p_business_id: null });
    expect(error).toBeNull();
    expect(data).toBeTruthy();

    // weekly_note mentions the regulars count and the word 'regulars'.
    expect(typeof data.weekly_note).toBe("string");
    expect(data.weekly_note).toContain("regulars");
    expect(data.weekly_note).toContain(String(data.headline.verified_regulars));

    // headline.
    expect(typeof data.headline.repeat_visit_rate).toBe("number");
    expect(data.headline.repeat_visit_rate).toBeGreaterThanOrEqual(0);
    expect(data.headline.repeat_visit_rate).toBeLessThanOrEqual(1);
    expect(Number.isInteger(data.headline.verified_regulars)).toBe(true);
    expect(Number.isInteger(data.headline.new_patrons)).toBe(true);
    expect(Number.isInteger(data.headline.redemptions)).toBe(true);
    expect(data.headline.redemptions).toBeGreaterThanOrEqual(1);
    expect(data.headline.deltas).toBeTruthy();

    // 3 repeat patrons (p1, p2, shared) → verified_regulars >= 3.
    expect(data.headline.verified_regulars).toBeGreaterThanOrEqual(3);
  });

  it("perk_performance has the right shape", async () => {
    const { data } = await owner.rpc("get_dashboard", { p_business_id: null });
    expect(Array.isArray(data.perk_performance)).toBe(true);
    const perf = data.perk_performance.find((p: any) => p.perk_id === perkId);
    expect(perf).toBeTruthy();
    expect(perf.name).toBe("Forge Pour");
    expect(Number.isInteger(perf.redemptions)).toBe(true);
    expect(Number.isInteger(perf.eligible)).toBe(true);
    expect(typeof perf.read).toBe("string");
    expect(perf.redemptions).toBeGreaterThanOrEqual(1);
  });

  it("activity_feed is ordered desc with allowed events", async () => {
    const { data } = await owner.rpc("get_dashboard", { p_business_id: null });
    expect(Array.isArray(data.activity_feed)).toBe(true);
    expect(data.activity_feed.length).toBeGreaterThan(0);
    const allowed = ["stamp", "redemption", "staff_stamp"];
    for (const e of data.activity_feed) {
      expect(typeof e.at).toBe("string");
      expect(typeof e.patron_display).toBe("string");
      expect(allowed).toContain(e.event);
    }
    // descending by `at`.
    const ats = data.activity_feed.map((e: any) => e.at);
    const sorted = [...ats].sort((a, b) => (a < b ? 1 : -1));
    expect(ats).toEqual(sorted);
    // both a staff_stamp and a redemption appear.
    expect(data.activity_feed.some((e: any) => e.event === "staff_stamp")).toBe(true);
    expect(data.activity_feed.some((e: any) => e.event === "redemption")).toBe(true);
  });

  it("visit_pattern_14d is a zero-filled 14-day series", async () => {
    const { data } = await owner.rpc("get_dashboard", { p_business_id: null });
    expect(Array.isArray(data.visit_pattern_14d)).toBe(true);
    expect(data.visit_pattern_14d).toHaveLength(14);
    for (const d of data.visit_pattern_14d) {
      expect(typeof d.date).toBe("string");
      expect(Number.isInteger(d.stamps)).toBe(true);
      expect(d.stamps).toBeGreaterThanOrEqual(0);
    }
    // ascending by date.
    const dates = data.visit_pattern_14d.map((d: any) => d.date);
    expect(dates).toEqual([...dates].sort());
  });

  it("PRIVACY: no field exposes another business or cross-business patron activity", async () => {
    const { data } = await owner.rpc("get_dashboard", { p_business_id: null });
    const strings = allStrings(data);

    // The foreign business id / slug must never appear.
    expect(strings).not.toContain(otherBusinessId);
    expect(strings.some((s) => s.includes("the-heron"))).toBe(false);

    // ready_redemptions only references THIS business's perk + its own patrons.
    for (const rr of data.ready_redemptions ?? []) {
      expect(rr.perk_id).toBe(perkId);
      expect(patrons).toContain(rr.patron_ref);
    }
    // No leaked patron from a business this owner doesn't own beyond our set.
    // (The shared patron is fine to show — it's a regular HERE; what must not
    // leak is its Heron activity, which is not a field in this payload at all.)
  });
});

describe("share_weekly_note (contract §3.8)", () => {
  it("valid email → { sent:true, week_of }", async () => {
    const { data, error } = await owner.rpc("share_weekly_note", { p_email: "co@forge.test" });
    expect(error).toBeNull();
    expect(data.sent).toBe(true);
    expect(typeof data.week_of).toBe("string");
  });

  it("bad email → VALIDATION", async () => {
    const { error } = await owner.rpc("share_weekly_note", { p_email: "not-an-email" });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("VALIDATION");
  });

  it("idempotent per email per week (no duplicate row)", async () => {
    const email = `dup-${crypto.randomUUID().slice(0, 6)}@forge.test`;
    const first = await owner.rpc("share_weekly_note", { p_email: email });
    expect(first.error).toBeNull();
    const second = await owner.rpc("share_weekly_note", { p_email: email });
    expect(second.error).toBeNull();
    expect(second.data.sent).toBe(true);
    expect(second.data.week_of).toBe(first.data.week_of);

    const { data: rows } = await svc
      .from("weekly_note_shares")
      .select("id")
      .eq("business_id", businessId)
      .eq("email", email);
    expect(rows).toHaveLength(1);
  });
});
