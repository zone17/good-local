// ===========================================================================
// rls-privacy.test.ts — Art. V / SC-005: the privacy boundary, proven.
//
// Proves structurally (not by app discipline) that an owner can NEVER read a
// patron's activity at another business, that patrons see only their own rows,
// and that the only door into `stamps` is the trust-model RPC. Each it() notes
// the data-model.md §3 matrix row it exercises.
//
// Arrangement uses the service-role client (bypasses RLS) to build a second
// owner + business so the cross-business boundary has something to hide.
//
// NOTE: requires a running local stack with migrations + seed applied.
//   supabase start && supabase db reset
//   export $(supabase status -o env | xargs)   # SUPABASE_* keys
//   npx vitest run tests/integration/rls-privacy.test.ts
// ===========================================================================
import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  SEED,
  serviceClient,
  ownerClient,
  adminClient,
  anonPatronClient,
  ensureSeedAuthPasswords,
} from "./helpers";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.API_URL ?? "http://127.0.0.1:54321";
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.ANON_KEY ?? "";

const OWNER_B_EMAIL = `owner-b-${crypto.randomUUID().slice(0, 8)}@test`;  // unique per run: repeated runs accumulate auth users
const OWNER_B_PASSWORD = "test-password-owner-b";
const BUSINESS_B_STAMP_CODE = "BBB";

// Fixtures arranged in beforeAll.
let svc: SupabaseClient;
let businessBId: string;
let codeAId: string; // The Heron's current code
let codeBId: string; // Business B's current code
let patronId: string;
let seasonId: string;
let today: string;

async function getCurrentCodeId(businessId: string): Promise<string> {
  const { data, error } = await svc
    .from("check_in_codes")
    .select("id")
    .eq("business_id", businessId)
    .eq("status", "current")
    .single();
  if (error || !data) throw new Error(`no current code for ${businessId}: ${error?.message}`);
  return data.id as string;
}

beforeAll(async () => {
  svc = serviceClient();
  await ensureSeedAuthPasswords();

  // Region timezone-local "today" (region is America/New_York; close enough for
  // the daily-unique key in tests — both stamps use the same value).
  today = new Date().toISOString().slice(0, 10);

  // Current season.
  {
    const { data, error } = await svc
      .from("seasons")
      .select("id")
      .eq("is_current", true)
      .single();
    if (error || !data) throw new Error(`no current season: ${error?.message}`);
    seasonId = data.id as string;
  }

  // --- owner-b auth user (idempotent) ---
  let ownerBUserId: string | undefined;
  {
    const created = await svc.auth.admin.createUser({
      email: OWNER_B_EMAIL,
      password: OWNER_B_PASSWORD,
      email_confirm: true,
    });
    if (created.data?.user) {
      ownerBUserId = created.data.user.id;
    } else if (created.error && /already|registered|exists/i.test(created.error.message)) {
      // Fetch the existing user's id.
      const list = await svc.auth.admin.listUsers();
      ownerBUserId = list.data.users.find((u) => u.email === OWNER_B_EMAIL)?.id;
    } else if (created.error) {
      throw new Error(`createUser(owner-b) failed: ${created.error.message}`);
    }
    if (!ownerBUserId) throw new Error("could not resolve owner-b user id");
  }

  // --- business B (town narrowsburg, stamp code BBB, active, owned by owner-b) ---
  {
    const { data: town, error: townErr } = await svc
      .from("towns")
      .select("id")
      .eq("slug", "narrowsburg")
      .single();
    if (townErr || !town) throw new Error(`narrowsburg town missing: ${townErr?.message}`);

    const existing = await svc
      .from("businesses")
      .select("id")
      .eq("region_id", SEED.regionId)
      .eq("stamp_code", BUSINESS_B_STAMP_CODE)
      .maybeSingle();

    if (existing.data?.id) {
      businessBId = existing.data.id as string;
    } else {
      const { data, error } = await svc
        .from("businesses")
        .insert({
          region_id: SEED.regionId,
          town_id: town.id,
          owner_user_id: ownerBUserId,
          name: "The Otter",
          slug: "the-otter",
          category: "cafe",
          stamp_code: BUSINESS_B_STAMP_CODE,
          status: "active",
          approved_at: new Date().toISOString(),
          approved_by: SEED.adminUserId,
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(`insert business B failed: ${error?.message}`);
      businessBId = data.id as string;
    }
  }

  // --- business B current code ---
  {
    const existing = await svc
      .from("check_in_codes")
      .select("id")
      .eq("business_id", businessBId)
      .eq("status", "current")
      .maybeSingle();
    if (existing.data?.id) {
      codeBId = existing.data.id as string;
    } else {
      const { data, error } = await svc
        .from("check_in_codes")
        .insert({
          business_id: businessBId,
          value: "test-otter-code-v1",
          version: 1,
          status: "current",
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(`insert code B failed: ${error?.message}`);
      codeBId = data.id as string;
    }
  }

  codeAId = await getCurrentCodeId(SEED.businessId);

  // --- patron row (service-role; no auth_user_id needed for the owner-side proofs) ---
  {
    const existing = await svc
      .from("patrons")
      .select("id")
      .eq("display_name", "Boundary Test Patron")
      .maybeSingle();
    if (existing.data?.id) {
      patronId = existing.data.id as string;
    } else {
      const { data, error } = await svc
        .from("patrons")
        .insert({ display_name: "Boundary Test Patron" })
        .select("id")
        .single();
      if (error || !data) throw new Error(`insert patron failed: ${error?.message}`);
      patronId = data.id as string;
    }
  }

  // --- one stamp at A and one at B for the SAME patron (direct service-role insert) ---
  // Same local_date is fine: the daily-unique key is (patron, business, date),
  // so one stamp per business per day coexists.
  await svc.from("stamps").upsert(
    [
      {
        patron_id: patronId,
        business_id: SEED.businessId,
        season_id: seasonId,
        local_date: today,
        code_version_ref: codeAId,
        trust_valid: true,
      },
      {
        patron_id: patronId,
        business_id: businessBId,
        season_id: seasonId,
        local_date: today,
        code_version_ref: codeBId,
        trust_valid: true,
      },
    ],
    { onConflict: "patron_id,business_id,local_date", ignoreDuplicates: true },
  );
});

describe("Art. V privacy boundary (data-model §3 matrix)", () => {
  // Matrix row: stamps → owner = "own-biz rows only".
  it("owner A sees ONLY business A stamps, never business B's", async () => {
    const owner = await ownerClient(SEED.ownerEmail);
    const { data, error } = await owner.from("stamps").select("id, business_id");
    expect(error).toBeNull();
    const rows = data ?? [];
    // At least the seeded-A stamp is visible.
    expect(rows.length).toBeGreaterThanOrEqual(1);
    // Zero rows leak business B.
    expect(rows.filter((r) => r.business_id === businessBId)).toHaveLength(0);
    // Every visible row is business A.
    expect(rows.every((r) => r.business_id === SEED.businessId)).toBe(true);
  });

  // Matrix row: stamps → owner. Cross-business patron history is invisible:
  // even filtering by the patron id, only the business-A stamp returns.
  it("owner A filtering by patron_id sees only the business-A stamp", async () => {
    const owner = await ownerClient(SEED.ownerEmail);
    const { data, error } = await owner
      .from("stamps")
      .select("id, business_id")
      .eq("patron_id", patronId);
    expect(error).toBeNull();
    const rows = data ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.business_id).toBe(SEED.businessId);
  });

  // Matrix rows: check_in_codes / subscriptions / staff_entries → owner = own-biz only.
  it("owner A cannot read business B's codes, subscriptions, or staff_entries", async () => {
    const owner = await ownerClient(SEED.ownerEmail);

    const codes = await owner.from("check_in_codes").select("id").eq("business_id", businessBId);
    expect(codes.error).toBeNull();
    expect(codes.data ?? []).toHaveLength(0);

    const subs = await owner.from("subscriptions").select("id").eq("business_id", businessBId);
    expect(subs.error).toBeNull();
    expect(subs.data ?? []).toHaveLength(0);

    const staff = await owner.from("staff_entries").select("id").eq("business_id", businessBId);
    expect(staff.error).toBeNull();
    expect(staff.data ?? []).toHaveLength(0);
  });

  // Matrix rows: businesses → owner UPDATE own only; perks → owner INSERT own-biz only.
  it("owner A cannot UPDATE business B nor INSERT a perk for business B", async () => {
    const owner = await ownerClient(SEED.ownerEmail);

    const upd = await owner
      .from("businesses")
      .update({ owner_note: "hijacked" })
      .eq("id", businessBId)
      .select("id");
    // RLS makes the row invisible to the UPDATE → zero affected (no error).
    expect(upd.error).toBeNull();
    expect(upd.data ?? []).toHaveLength(0);

    const ins = await owner
      .from("perks")
      .insert({
        business_id: businessBId,
        name: "Sneaky Perk",
        description: "should be blocked by RLS",
        visit_threshold: 5,
        kind: "status_good",
        status: "draft",
      })
      .select("id");
    // WITH CHECK violation → error (or, defensively, zero rows).
    const blocked = ins.error !== null || (ins.data ?? []).length === 0;
    expect(blocked).toBe(true);
  });

  // Matrix rows: patrons → self only; stamps → patron own; check_in_codes → patron NONE.
  it("anon patron sees only own patron + stamps, and never any codes", async () => {
    const { client: patron, userId } = await anonPatronClient();

    // Create this anon patron's own row + an own stamp via service role.
    const { data: selfPatron, error: pErr } = await svc
      .from("patrons")
      .insert({ auth_user_id: userId, display_name: "Anon Self" })
      .select("id")
      .single();
    expect(pErr).toBeNull();
    const selfPatronId = selfPatron!.id as string;

    await svc.from("stamps").upsert(
      {
        patron_id: selfPatronId,
        business_id: SEED.businessId,
        season_id: seasonId,
        local_date: today,
        code_version_ref: codeAId,
        trust_valid: true,
      },
      { onConflict: "patron_id,business_id,local_date", ignoreDuplicates: true },
    );

    // patrons: only own row.
    const patrons = await patron.from("patrons").select("id");
    expect(patrons.error).toBeNull();
    expect(patrons.data ?? []).toHaveLength(1);
    expect(patrons.data![0]?.id).toBe(selfPatronId);

    // stamps: only own.
    const stamps = await patron.from("stamps").select("id, patron_id");
    expect(stamps.error).toBeNull();
    expect((stamps.data ?? []).every((r) => r.patron_id === selfPatronId)).toBe(true);
    // The boundary-test patron's stamps are NOT visible.
    expect((stamps.data ?? []).some((r) => r.patron_id === patronId)).toBe(false);

    // check_in_codes: no policy for patrons → zero rows.
    const codes = await patron.from("check_in_codes").select("id");
    expect(codes.error).toBeNull();
    expect(codes.data ?? []).toHaveLength(0);
  });

  // Art. II door check: DELETE on stamps is revoked; no INSERT policy exists.
  it("patron cannot DELETE or directly INSERT stamps (trust RPC is the only door)", async () => {
    const { client: patron, userId } = await anonPatronClient();
    const { data: self } = await svc
      .from("patrons")
      .insert({ auth_user_id: userId, display_name: "Anon Door" })
      .select("id")
      .single();
    const selfPatronId = self!.id as string;

    // DELETE is revoked at the grant level → error or zero affected.
    const del = await patron.from("stamps").delete().eq("patron_id", selfPatronId).select("id");
    const deleteBlocked = del.error !== null || (del.data ?? []).length === 0;
    expect(deleteBlocked).toBe(true);

    // Direct INSERT has no policy → error or zero rows.
    const ins = await patron
      .from("stamps")
      .insert({
        patron_id: selfPatronId,
        business_id: SEED.businessId,
        season_id: seasonId,
        local_date: today,
        code_version_ref: codeAId,
        trust_valid: true,
      })
      .select("id");
    const insertBlocked = ins.error !== null || (ins.data ?? []).length === 0;
    expect(insertBlocked).toBe(true);
  });

  // Matrix row: stamps → admin = SELECT all (>= 2 across both businesses).
  it("admin can read all stamps across businesses", async () => {
    const admin = await adminClient();
    const { data, error } = await admin.from("stamps").select("id, business_id");
    expect(error).toBeNull();
    const rows = data ?? [];
    expect(rows.length).toBeGreaterThanOrEqual(2);
    // Both businesses represented.
    expect(rows.some((r) => r.business_id === SEED.businessId)).toBe(true);
    expect(rows.some((r) => r.business_id === businessBId)).toBe(true);
  });
});

// ===========================================================================
// T053 — the owner dashboard surface (get_dashboard) honors the same boundary.
// The shared boundary-test patron has stamps at BOTH business A (The Heron) and
// business B (The Otter). Owner A's dashboard must contain zero references to
// business B's id/slug or that patron's other-business activity; owner B asking
// for business A's dashboard by id must be FORBIDDEN.
// ===========================================================================
function collectStrings(node: unknown, acc: string[] = []): string[] {
  if (typeof node === "string") acc.push(node);
  else if (Array.isArray(node)) node.forEach((n) => collectStrings(n, acc));
  else if (node && typeof node === "object") {
    Object.values(node).forEach((n) => collectStrings(n, acc));
  }
  return acc;
}

describe("Art. V dashboard boundary (T053, get_dashboard / SC-005)", () => {
  it("owner A's get_dashboard references zero business-B ids/slugs", async () => {
    const owner = await ownerClient(SEED.ownerEmail);
    const { data, error } = await owner.rpc("get_dashboard", { p_business_id: null });
    expect(error).toBeNull();
    expect(data).toBeTruthy();

    const strings = collectStrings(data);
    // business B id never appears anywhere in the payload.
    expect(strings).not.toContain(businessBId);
    // business B's slug ("the-otter") never appears.
    expect(strings.some((s) => s.includes("the-otter"))).toBe(false);

    // activity_feed only ever names this owner's own business activity; the
    // event labels are the only allowed strings — never a cross-business id.
    for (const e of data.activity_feed ?? []) {
      expect(["stamp", "redemption", "staff_stamp"]).toContain(e.event);
    }
  });

  it("owner B calling get_dashboard(p_business_id = A's id) → FORBIDDEN", async () => {
    const ownerB = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const signIn = await ownerB.auth.signInWithPassword({
      email: OWNER_B_EMAIL,
      password: OWNER_B_PASSWORD,
    });
    expect(signIn.error).toBeNull();

    const { error } = await ownerB.rpc("get_dashboard", { p_business_id: SEED.businessId });
    expect(error).not.toBeNull();
    expect(error!.message).toContain("FORBIDDEN");
  });
});
