// ===========================================================================
// us1-onboarding.test.ts — US1 end-to-end DB-level path (T025).
//
// Drives the full SC-001 flow WITHOUT a live Stripe, exercising the real
// server pieces at the seams the production system uses:
//   1. service role creates owner + pending business (as create-checkout-session
//      would have, via its core) — here using the edge core's helpers/inserts.
//   2. T020 handleStripeEvent(checkout.session.completed) creates the active
//      founding subscription (single writer).
//   3. admin approval (US7 RPC not yet present) → service-role status flip to
//      active, with a comment marking the deviation.
//   4. owner (RLS-scoped) updates profile, publishes a perk, and reads a
//      printable register kit.
// Final SC-001 invariant: business active, subscription active + founding_rate,
// perk active, kit carries the current code.
//
//   eval "$(supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
//   export API_URL ANON_KEY SERVICE_ROLE_KEY
//   npx vitest run tests/integration/us1-onboarding.test.ts
// ===========================================================================
import { beforeAll, describe, expect, it } from "vitest";
import { type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { serviceClient, SEED, ensureSeedAuthPasswords } from "./helpers";
import { handleStripeEvent } from "../../supabase/functions/_shared/stripe-webhook-core";

let svc: SupabaseClient;

const OWNER_EMAIL = `us1-flow-owner-${crypto.randomUUID().slice(0, 8)}@test`;  // unique per run: repeated runs accumulate auth users
const OWNER_PASSWORD = "test-us1-flow";
let ownerUserId: string;
let businessId: string;
const SUB_ID = "sub_us1_flow";
const CUST_ID = "cus_us1_flow";

beforeAll(async () => {
  svc = serviceClient();
  await ensureSeedAuthPasswords();

  // ---- Step 1: signup handoff (as the checkout edge fn does) ----
  await svc.auth.admin
    .createUser({ email: OWNER_EMAIL, password: OWNER_PASSWORD, email_confirm: true })
    .catch(() => undefined);
  {
    const { data } = await svc.auth.admin.listUsers();
    ownerUserId = data!.users.find((u) => u.email === OWNER_EMAIL)!.id;
  }

  const { data: town } = await svc.from("towns").select("id").eq("slug", "bethel").single();
  const { data: biz } = await svc
    .from("businesses")
    .upsert(
      {
        region_id: SEED.regionId,
        town_id: town!.id,
        owner_user_id: ownerUserId,
        name: "Flow Diner",
        slug: "flow-diner",
        category: "uncategorized",
        hours: {},
        stamp_code: "FLW",
        status: "pending",
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();
  businessId = biz!.id as string;

  await svc
    .from("check_in_codes")
    .upsert(
      { business_id: businessId, value: "flow-diner-code-v1", version: 1, status: "current" },
      { onConflict: "value" },
    );
  await svc.from("rotation_schedules").upsert({ business_id: businessId });

  // Clean any prior subscription / processed events for a deterministic rerun.
  await svc.from("subscriptions").delete().eq("business_id", businessId);
  await svc.from("processed_stripe_events").delete().eq("event_id", "evt_us1_flow");
});

describe("US1 onboarding — SC-001 full path", () => {
  it("1. business begins pending", async () => {
    const { data } = await svc.from("businesses").select("status").eq("id", businessId).single();
    expect(data!.status).toBe("pending");
  });

  it("2. webhook checkout.session.completed creates an active founding subscription", async () => {
    await handleStripeEvent(
      {
        id: "evt_us1_flow",
        type: "checkout.session.completed",
        data: {
          object: {
            customer: CUST_ID,
            subscription: SUB_ID,
            metadata: { business_id: businessId },
          },
        },
      },
      svc,
    );
    const { data } = await svc
      .from("subscriptions")
      .select("*")
      .eq("business_id", businessId)
      .single();
    expect(data!.status).toBe("active");
    expect(data!.plan).toBe("founding_79");
    expect(data!.founding_rate).toBe(true);
  });

  it("3. admin approval activates the business", async () => {
    // DEVIATION: approve_business RPC is US7 (T055). Until then, the admin gate
    // is simulated by a service-role status flip to active, mirroring the
    // approve_business contract result (FR-006).
    await svc
      .from("businesses")
      .update({ status: "active", approved_at: new Date().toISOString(), approved_by: SEED.adminUserId })
      .eq("id", businessId);
    const { data } = await svc.from("businesses").select("status").eq("id", businessId).single();
    expect(data!.status).toBe("active");
  });

  it("4. owner updates profile, publishes a perk, reads a printable kit", async () => {
    // Sign in as the new owner via password on a fresh anon-key client.
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.SUPABASE_URL ?? process.env.API_URL!;
    const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.ANON_KEY!;
    const ownerClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: signInErr } = await ownerClient.auth.signInWithPassword({
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
    });
    expect(signInErr).toBeNull();

    // profile update
    const prof = await ownerClient.rpc("update_business_profile", {
      p_business_id: businessId,
      p_name: "Flow Diner & Counter",
      p_owner_note: "Pie's better on a Tuesday.",
      p_category: "restaurant",
    });
    expect(prof.error).toBeNull();
    expect(prof.data.name).toBe("Flow Diner & Counter");

    // publish a perk
    const perk = await ownerClient.rpc("publish_perk", {
      p_business_id: businessId,
      p_name: "The Counter Seat",
      p_description: "Your sixth slice, on us",
      p_threshold: 6,
      p_kind: "status_good",
    });
    expect(perk.error).toBeNull();
    expect(perk.data.status).toBe("active");

    // register kit
    const kit = await ownerClient.rpc("get_register_kit", { p_business_id: businessId });
    expect(kit.error).toBeNull();
    expect(kit.data.code_value).toBe("flow-diner-code-v1");
    expect(kit.data.qr_url).toContain("flow-diner");
  });

  it("5. SC-001 invariant: active business, active founding subscription, active perk, kit has current code", async () => {
    const biz = await svc.from("businesses").select("status").eq("id", businessId).single();
    expect(biz.data!.status).toBe("active");

    const sub = await svc
      .from("subscriptions")
      .select("status, founding_rate")
      .eq("business_id", businessId)
      .single();
    expect(sub.data!.status).toBe("active");
    expect(sub.data!.founding_rate).toBe(true);

    const perks = await svc
      .from("perks")
      .select("status")
      .eq("business_id", businessId)
      .eq("status", "active");
    expect((perks.data ?? []).length).toBeGreaterThanOrEqual(1);

    const code = await svc
      .from("check_in_codes")
      .select("value")
      .eq("business_id", businessId)
      .eq("status", "current")
      .single();
    expect(code.data!.value).toBe("flow-diner-code-v1");
  });
});
