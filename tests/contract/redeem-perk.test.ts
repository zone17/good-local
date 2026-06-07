// ===========================================================================
// redeem-perk.test.ts — T036 [US3] contract tests for redeem_perk.
//
// Validates contract §3.6 + §7: ready-only redemption, the reset rule, audit
// fields, and the FORBIDDEN/PERK_NOT_FOUND boundary for a non-owner.
//
// Arrangement: a patron is brought to threshold (5 valid stamps at The Heron
// on distinct past local_dates, via the service-role client). The redemption
// is performed under the OWNER's JWT (ownerClient) so auth.uid() inside the RPC
// is the verifying staff — verified_by must equal the owner user.
//
// RPC custom errors surface as { code: "P0001", message: "<CODE>" }; assertions
// branch on error.message (the stable §7 code), never on prose.
//
// Requires the local stack with migrations + seed applied:
//   supabase db reset
//   eval "$(supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
//   npx vitest run tests/contract/redeem-perk.test.ts
// ===========================================================================
import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  SEED,
  serviceClient,
  ownerClient,
  ensureSeedAuthPasswords,
} from "../integration/helpers";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.API_URL ?? "http://127.0.0.1:54321";
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.ANON_KEY ?? "";

/** Sign in an arbitrary email/password (for non-seeded owner-b). */
async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const c = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signIn(${email}) failed: ${error.message}`);
  return c;
}

let svc: SupabaseClient;
let owner: SupabaseClient;
let seasonId: string;
let codeAId: string;
let perkId: string;
let serverToday: string;

// A second owner (no business needed) — proves the cross-owner boundary:
// calling redeem_perk on The Heron's perk must NOT reveal it.
const OWNER_B_EMAIL = `owner-rp-${crypto.randomUUID().slice(0, 8)}@test`;
const OWNER_B_PASSWORD = "test-password-owner-rp";

function daysAgo(n: number): string {
  const d = new Date(`${serverToday}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Create a fresh patron at threshold (5 valid stamps on distinct past dates). */
async function patronAtThreshold(label: string): Promise<string> {
  const { data: p, error: pErr } = await svc
    .from("patrons")
    .insert({ display_name: label })
    .select("id")
    .single();
  if (pErr || !p) throw new Error(`insert patron failed: ${pErr?.message}`);
  const patronId = p.id as string;

  const rows = [1, 2, 3, 4, 5].map((d) => ({
    patron_id: patronId,
    business_id: SEED.businessId,
    season_id: seasonId,
    local_date: daysAgo(d),
    code_version_ref: codeAId,
    trust_valid: true,
  }));
  const ins = await svc.from("stamps").insert(rows);
  if (ins.error) throw new Error(`arrange stamps failed: ${ins.error.message}`);
  return patronId;
}

beforeAll(async () => {
  svc = serviceClient();
  await ensureSeedAuthPasswords();
  owner = await ownerClient(SEED.ownerEmail);

  {
    const { data } = await svc.from("seasons").select("id").eq("is_current", true).single();
    seasonId = data!.id as string;
  }
  {
    const { data } = await svc
      .from("check_in_codes")
      .select("id")
      .eq("business_id", SEED.businessId)
      .eq("status", "current")
      .single();
    codeAId = data!.id as string;
  }
  {
    const { data } = await svc
      .from("perks")
      .select("id")
      .eq("business_id", SEED.businessId)
      .eq("status", "active")
      .order("visit_threshold", { ascending: true })
      .limit(1)
      .single();
    perkId = data!.id as string;
  }
  {
    const { data } = await svc.rpc("current_local_date");
    serverToday = data as string;
  }

  // owner-b auth user (idempotent).
  const created = await svc.auth.admin.createUser({
    email: OWNER_B_EMAIL,
    password: OWNER_B_PASSWORD,
    email_confirm: true,
  });
  if (created.error && !/already|registered|exists/i.test(created.error.message)) {
    throw new Error(`createUser(owner-b) failed: ${created.error.message}`);
  }
});

describe("redeem_perk (contract §3.6)", () => {
  it("redeems a ready perk → redemption shape + perk_progress reset", async () => {
    const patronId = await patronAtThreshold("Redeem Ready 1");

    const { data, error } = await owner.rpc("redeem_perk", {
      p_patron_ref: patronId,
      p_perk_id: perkId,
    });
    expect(error).toBeNull();
    expect(data).toBeTruthy();

    // redemption fields (who/what/when).
    expect(typeof data.redemption.id).toBe("string");
    expect(data.redemption.patron_ref).toBe(patronId);
    expect(data.redemption.perk_id).toBe(perkId);
    expect(typeof data.redemption.redeemed_at).toBe("string");
    // verifying_staff = the owner user.
    expect(data.redemption.verifying_staff).toBe(SEED.ownerUserId);

    // progress reset.
    expect(data.perk_progress.current).toBe(0);
    expect(data.perk_progress.ready).toBe(false);

    // recorded with verified_by = owner.
    const rec = await svc
      .from("perk_redemptions")
      .select("verified_by, patron_id, perk_id")
      .eq("id", data.redemption.id)
      .single();
    expect(rec.data!.verified_by).toBe(SEED.ownerUserId);
  });

  it("second immediate redemption → PERK_NOT_READY (already redeemed this cycle)", async () => {
    const patronId = await patronAtThreshold("Redeem Twice");

    const first = await owner.rpc("redeem_perk", { p_patron_ref: patronId, p_perk_id: perkId });
    expect(first.error).toBeNull();

    const second = await owner.rpc("redeem_perk", { p_patron_ref: patronId, p_perk_id: perkId });
    expect(second.error).not.toBeNull();
    expect(second.error!.message).toContain("PERK_NOT_READY");
  });

  it("below-threshold patron → PERK_NOT_READY", async () => {
    const { data: p } = await svc
      .from("patrons")
      .insert({ display_name: "Below Threshold" })
      .select("id")
      .single();
    const patronId = p!.id as string;
    // only 2 stamps (< 5).
    await svc.from("stamps").insert(
      [1, 2].map((d) => ({
        patron_id: patronId,
        business_id: SEED.businessId,
        season_id: seasonId,
        local_date: daysAgo(d + 10),
        code_version_ref: codeAId,
        trust_valid: true,
      })),
    );

    const { error } = await owner.rpc("redeem_perk", { p_patron_ref: patronId, p_perk_id: perkId });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("PERK_NOT_READY");
  });

  it("a different owner → PERK_NOT_FOUND (boundary; existence not leaked)", async () => {
    const patronId = await patronAtThreshold("Redeem Boundary");
    const ownerB = await signIn(OWNER_B_EMAIL, OWNER_B_PASSWORD);

    const { error } = await ownerB.rpc("redeem_perk", {
      p_patron_ref: patronId,
      p_perk_id: perkId,
    });
    expect(error).not.toBeNull();
    expect(["PERK_NOT_FOUND", "FORBIDDEN"]).toContain(error!.message.trim());
  });

  it("unknown perk id → PERK_NOT_FOUND", async () => {
    const patronId = await patronAtThreshold("Redeem No Perk");
    const { error } = await owner.rpc("redeem_perk", {
      p_patron_ref: patronId,
      p_perk_id: "00000000-0000-0000-0000-0000000000ff",
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("PERK_NOT_FOUND");
  });
});
