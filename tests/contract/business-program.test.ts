// ===========================================================================
// business-program.test.ts — US1 contract tests (T016).
//
// Exercises the owner program RPCs against contracts/api.md §§3.2–3.4:
//   update_business_profile, publish_perk, update_perk, set_perk_active,
//   get_register_kit.
//
// RPC custom errors surface through PostgREST as { code: "P0001",
// message: "<ERROR_CODE>" } (a RAISE EXCEPTION carries the code string in
// `message`), so error assertions branch on `error.message` — the stable §7
// machine code — never on prose.
//
// Requires the running local stack with migrations + seed applied:
//   eval "$(supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
//   export API_URL ANON_KEY SERVICE_ROLE_KEY
//   npx vitest run tests/contract/business-program.test.ts
// ===========================================================================
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type SupabaseClient } from "@supabase/supabase-js";
import {
  SEED,
  serviceClient,
  ownerClient,
  anonPatronClient,
  ensureSeedAuthPasswords,
} from "../integration/helpers";

let svc: SupabaseClient;
let owner: SupabaseClient;
let seasonId: string;

// A second owner + business so the cross-owner FORBIDDEN path has a target.
const OWNER_B_EMAIL = `owner-bp-${crypto.randomUUID().slice(0, 8)}@test`;  // unique per run: repeated runs accumulate auth users
const OWNER_B_PASSWORD = "test-password-owner-bp";
let businessBId: string;

async function currentCodeId(businessId: string): Promise<string> {
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

  {
    const { data, error } = await svc.from("seasons").select("id").eq("is_current", true).single();
    if (error || !data) throw new Error(`no current season: ${error?.message}`);
    seasonId = data.id as string;
  }

  // Arrange a second owner + active business (Narrowsburg) so STAMP_CODE_TAKEN
  // can be exercised against a different business in the same region.
  const ownerBUserId = "00000000-0000-0000-0000-0000000000b2";
  await svc.auth.admin
    .createUser({
      user_id: ownerBUserId,
      email: OWNER_B_EMAIL,
      password: OWNER_B_PASSWORD,
      email_confirm: true,
    } as never)
    .catch(() => undefined);
  // Fallback for environments where user_id pinning is unsupported: look it up.
  let resolvedOwnerBId = ownerBUserId;
  {
    const { data } = await svc.auth.admin.listUsers();
    const u = data?.users?.find((x) => x.email === OWNER_B_EMAIL);
    if (u) resolvedOwnerBId = u.id;
  }

  const { data: town } = await svc.from("towns").select("id").eq("slug", "narrowsburg").single();
  const { data: bizB } = await svc
    .from("businesses")
    .upsert(
      {
        region_id: SEED.regionId,
        town_id: town!.id,
        owner_user_id: resolvedOwnerBId,
        name: "Owner B Cafe",
        slug: "owner-b-cafe",
        category: "cafe",
        hours: {},
        stamp_code: "OWB",
        status: "active",
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();
  businessBId = bizB!.id as string;
  await svc
    .from("check_in_codes")
    .upsert(
      { business_id: businessBId, value: "owner-b-code-v1", version: 1, status: "current" },
      { onConflict: "value" },
    );

  owner = await ownerClient(); // mira / The Heron
});

describe("update_business_profile (§3.2)", () => {
  it("happy path: partial update of name/hours/owner_note/stamp_code", async () => {
    const { data, error } = await owner.rpc("update_business_profile", {
      p_business_id: SEED.businessId,
      p_name: "The Heron (Riverside)",
      p_hours: "Wed-Sun 8-4",
      p_owner_note: "Save your fifth for a slow afternoon.",
      p_stamp_code: "HRN",
    });
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data.name).toBe("The Heron (Riverside)");
    expect(data.stamp_code).toBe("HRN");
  });

  it("STAMP_CODE_TAKEN when the code collides within the region", async () => {
    const { error } = await owner.rpc("update_business_profile", {
      p_business_id: SEED.businessId,
      p_stamp_code: "OWB", // already owned by Owner B Cafe, same region
    });
    expect(error).not.toBeNull();
    expect(error!.message).toBe("STAMP_CODE_TAKEN");
  });

  it("FORBIDDEN + zero-effect for a non-owner", async () => {
    const before = await svc
      .from("businesses")
      .select("name")
      .eq("id", businessBId)
      .single();
    // mira (owner of The Heron) tries to edit Owner B's business.
    const { error } = await owner.rpc("update_business_profile", {
      p_business_id: businessBId,
      p_name: "Hijacked",
    });
    expect(error).not.toBeNull();
    expect(error!.message).toBe("FORBIDDEN");
    const after = await svc.from("businesses").select("name").eq("id", businessBId).single();
    expect(after.data!.name).toBe(before.data!.name); // unchanged
  });
});

describe("publish_perk (§3.3)", () => {
  it("happy path: returns the created perk", async () => {
    const { data, error } = await owner.rpc("publish_perk", {
      p_business_id: SEED.businessId,
      p_name: "Test Pour",
      p_description: "Two more visits, on the house",
      p_threshold: 6,
      p_kind: "status_good",
    });
    expect(error).toBeNull();
    expect(data.id).toBeTruthy();
    expect(data.visit_threshold).toBe(6);
    expect(data.status).toBe("active");
  });

  it("VALIDATION on threshold below 3", async () => {
    const { error } = await owner.rpc("publish_perk", {
      p_business_id: SEED.businessId,
      p_name: "Too Low",
      p_description: "x",
      p_threshold: 2,
      p_kind: "status_good",
    });
    expect(error).not.toBeNull();
    expect(error!.message).toBe("VALIDATION");
  });

  it("VALIDATION on threshold above 12", async () => {
    const { error } = await owner.rpc("publish_perk", {
      p_business_id: SEED.businessId,
      p_name: "Too High",
      p_description: "x",
      p_threshold: 13,
      p_kind: "status_good",
    });
    expect(error).not.toBeNull();
    expect(error!.message).toBe("VALIDATION");
  });

  it("VALIDATION when description exceeds 120 chars", async () => {
    const { error } = await owner.rpc("publish_perk", {
      p_business_id: SEED.businessId,
      p_name: "Long Desc",
      p_description: "x".repeat(121),
      p_threshold: 5,
      p_kind: "status_good",
    });
    expect(error).not.toBeNull();
    expect(error!.message).toBe("VALIDATION");
  });
});

describe("update_perk (§3.3)", () => {
  it("threshold edit returns applies_prospectively true", async () => {
    const created = await owner.rpc("publish_perk", {
      p_business_id: SEED.businessId,
      p_name: "Editable",
      p_description: "edit me",
      p_threshold: 5,
      p_kind: "small_discount",
    });
    const perkId = created.data.id as string;

    const { data, error } = await owner.rpc("update_perk", {
      p_perk_id: perkId,
      p_threshold: 8,
    });
    expect(error).toBeNull();
    expect(data.visit_threshold).toBe(8);
    expect(data.applies_prospectively).toBe(true);
  });
});

describe("set_perk_active (§3.3)", () => {
  it("deactivation leaves existing stamps untouched", async () => {
    // Arrange: a perk + a patron with one stamp at The Heron (service role).
    const created = await owner.rpc("publish_perk", {
      p_business_id: SEED.businessId,
      p_name: "Keep Stamps",
      p_description: "stamps survive",
      p_threshold: 4,
      p_kind: "status_good",
    });
    const perkId = created.data.id as string;

    const { userId } = await anonPatronClient();
    const { data: patron } = await svc
      .from("patrons")
      .insert({ auth_user_id: userId })
      .select("id")
      .single();
    const codeId = await currentCodeId(SEED.businessId);
    const stampDate = "2026-07-01";
    await svc.from("stamps").insert({
      patron_id: patron!.id,
      business_id: SEED.businessId,
      season_id: seasonId,
      local_date: stampDate,
      code_version_ref: codeId,
    });

    const before = await svc
      .from("stamps")
      .select("id", { count: "exact", head: true })
      .eq("business_id", SEED.businessId);

    const { data, error } = await owner.rpc("set_perk_active", {
      p_perk_id: perkId,
      p_active: false,
    });
    expect(error).toBeNull();
    expect(data.status).toBe("inactive");

    const after = await svc
      .from("stamps")
      .select("id", { count: "exact", head: true })
      .eq("business_id", SEED.businessId);
    expect(after.count).toBe(before.count); // no stamps destroyed
  });
});

describe("get_register_kit (§3.4)", () => {
  beforeEach(async () => {
    // Clear any reprint flag so the default-state assertion is deterministic.
    await svc.from("reprint_flags").delete().eq("business_id", SEED.businessId);
  });

  it("returns the current code value, well-formed qr_url, reprint_needed false", async () => {
    const codeId = await currentCodeId(SEED.businessId);
    const { data: code } = await svc
      .from("check_in_codes")
      .select("value")
      .eq("id", codeId)
      .single();

    const { data, error } = await owner.rpc("get_register_kit", {
      p_business_id: SEED.businessId,
    });
    expect(error).toBeNull();
    expect(data.business_slug).toBe(SEED.businessSlug);
    expect(data.code_value).toBe(code!.value);
    expect(data.qr_url).toBe(
      `https://goodlocal.app/c/${SEED.businessSlug}?k=${code!.value}`,
    );
    expect(data.reprint_needed).toBe(false);
  });

  it("reprint_needed true after a reprint flag is raised", async () => {
    await svc.from("reprint_flags").insert({ business_id: SEED.businessId });
    const { data, error } = await owner.rpc("get_register_kit", {
      p_business_id: SEED.businessId,
    });
    expect(error).toBeNull();
    expect(data.reprint_needed).toBe(true);
    await svc.from("reprint_flags").delete().eq("business_id", SEED.businessId);
  });
});
