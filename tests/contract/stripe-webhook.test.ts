// ===========================================================================
// stripe-webhook.test.ts — US1 contract tests (T017).
//
// Tests the PURE webhook core (supabase/functions/_shared/stripe-webhook-core.ts)
// directly — it uses only Web APIs (crypto.subtle), so it imports cleanly into
// the node/vitest runtime. The single-writer table behavior (contracts §5) and
// business status transitions (data-model §4) are asserted against the real
// local DB via the service-role client.
//
// Signatures are constructed exactly as Stripe signs them: HMAC-SHA256 over
// `${t}.${payload}` with the webhook secret, header `t=<ts>,v1=<hex>`.
//
// Requires the running local stack:
//   eval "$(supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
//   export API_URL ANON_KEY SERVICE_ROLE_KEY
//   npx vitest run tests/contract/stripe-webhook.test.ts
// ===========================================================================
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type SupabaseClient } from "@supabase/supabase-js";
import { createHmac, randomUUID } from "node:crypto";
import { serviceClient, SEED, ensureSeedAuthPasswords } from "../integration/helpers";
import {
  verifyStripeSignature,
  handleStripeEvent,
} from "../../supabase/functions/_shared/stripe-webhook-core";

const SECRET = "whsec_local_test";

let svc: SupabaseClient;
let businessId: string;
let ownerUserId: string;
const CUSTOMER_ID = "cus_test_us1";
const SUBSCRIPTION_ID = "sub_test_us1";

// Build a Stripe-style signed header for a payload body + secret.
function signed(body: string, secret = SECRET, ts = Math.floor(Date.now() / 1000)): string {
  const sig = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  return `t=${ts},v1=${sig}`;
}

function event(type: string, dataObject: Record<string, unknown>, id = "evt_" + randomUUID()) {
  return {
    id,
    type,
    data: { object: dataObject },
  };
}

beforeAll(async () => {
  svc = serviceClient();
  await ensureSeedAuthPasswords();

  // Arrange a fresh pending business owned by a fresh owner (as the checkout
  // edge fn would have created it). Idempotent across reruns.
  // Unique per run (accumulated auth users break fixed-email find-or-create,
  // and listUsers only returns page 1 — read the id from the create response).
  const email = `pending-owner-${crypto.randomUUID().slice(0, 8)}@test`;
  const created = await svc.auth.admin.createUser({
    email, password: "test-pending", email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw new Error(`could not create pending owner: ${created.error?.message}`);
  }
  ownerUserId = created.data.user.id;

  const { data: town } = await svc.from("towns").select("id").eq("slug", "callicoon").single();
  const { data: biz } = await svc
    .from("businesses")
    .upsert(
      {
        region_id: SEED.regionId,
        town_id: town!.id,
        owner_user_id: ownerUserId,
        name: "Pending Spot",
        slug: "pending-spot",
        category: "cafe",
        hours: {},
        stamp_code: "PSP",
        status: "pending",
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();
  businessId = biz!.id as string;
});

beforeEach(async () => {
  // Reset to a clean pending state with no subscription / processed events.
  await svc.from("subscriptions").delete().eq("business_id", businessId);
  await svc.from("processed_stripe_events").delete().neq("event_id", "");
  await svc.from("businesses").update({ status: "pending" }).eq("id", businessId);
});

async function biz() {
  const { data } = await svc.from("businesses").select("status").eq("id", businessId).single();
  return data!.status as string;
}
async function sub() {
  const { data } = await svc
    .from("subscriptions")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();
  return data;
}

describe("verifyStripeSignature", () => {
  it("accepts a correctly signed payload", async () => {
    const body = JSON.stringify(event("ping", {}));
    expect(await verifyStripeSignature(body, signed(body), SECRET, 300)).toBe(true);
  });

  it("rejects a bad signature", async () => {
    const body = JSON.stringify(event("ping", {}));
    expect(await verifyStripeSignature(body, "t=1,v1=deadbeef", SECRET, 300)).toBe(false);
  });
});

describe("bad signature → no writes", () => {
  it("a tampered body never reaches the DB", async () => {
    const body = JSON.stringify(
      event("checkout.session.completed", {
        customer: CUSTOMER_ID,
        subscription: SUBSCRIPTION_ID,
        metadata: { business_id: businessId },
      }),
    );
    const bad = "t=1,v1=000000";
    const ok = await verifyStripeSignature(body, bad, SECRET, 300);
    expect(ok).toBe(false);
    // Handler must not run when verification fails.
    expect(await sub()).toBeNull();
  });
});

describe("checkout.session.completed (§5)", () => {
  it("creates a founding subscription row, active", async () => {
    const ev = event("checkout.session.completed", {
      customer: CUSTOMER_ID,
      subscription: SUBSCRIPTION_ID,
      metadata: { business_id: businessId },
    });
    await handleStripeEvent(ev, svc);

    const row = await sub();
    expect(row).toBeTruthy();
    expect(row!.plan).toBe("founding_79");
    expect(row!.founding_rate).toBe(true);
    expect(row!.status).toBe("active");
    expect(row!.stripe_subscription_id).toBe(SUBSCRIPTION_ID);
  });

  it("dedupes on event.id (same event twice → one row)", async () => {
    const ev = event("checkout.session.completed", {
      customer: CUSTOMER_ID,
      subscription: SUBSCRIPTION_ID,
      metadata: { business_id: businessId },
    });
    await handleStripeEvent(ev, svc);
    await handleStripeEvent(ev, svc); // replay

    const { count } = await svc
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId);
    expect(count).toBe(1);
  });
});

describe("invoice.payment_failed → suspended (§5, data-model §4)", () => {
  beforeEach(async () => {
    await handleStripeEvent(
      event("checkout.session.completed", {
        customer: CUSTOMER_ID,
        subscription: SUBSCRIPTION_ID,
        metadata: { business_id: businessId },
      }),
      svc,
    );
    await svc.from("businesses").update({ status: "active" }).eq("id", businessId);
  });

  it("suspends the business when dunning is exhausted (attempt_count >= 3)", async () => {
    await handleStripeEvent(
      event("invoice.payment_failed", {
        customer: CUSTOMER_ID,
        subscription: SUBSCRIPTION_ID,
        attempt_count: 3,
      }),
      svc,
    );
    expect(await biz()).toBe("suspended");
    expect((await sub())!.status).toBe("suspended");
  });

  it("suspends via the dunning_exhausted metadata flag", async () => {
    await handleStripeEvent(
      event("invoice.payment_failed", {
        customer: CUSTOMER_ID,
        subscription: SUBSCRIPTION_ID,
        attempt_count: 1,
        metadata: { dunning_exhausted: "true" },
      }),
      svc,
    );
    expect(await biz()).toBe("suspended");
  });
});

describe("customer.subscription.updated → restore (§5)", () => {
  it("active after suspension brings the business back to active", async () => {
    await handleStripeEvent(
      event("checkout.session.completed", {
        customer: CUSTOMER_ID,
        subscription: SUBSCRIPTION_ID,
        metadata: { business_id: businessId },
      }),
      svc,
    );
    await handleStripeEvent(
      event("invoice.payment_failed", {
        customer: CUSTOMER_ID,
        subscription: SUBSCRIPTION_ID,
        attempt_count: 3,
      }),
      svc,
    );
    expect(await biz()).toBe("suspended");

    await handleStripeEvent(
      event("customer.subscription.updated", {
        id: SUBSCRIPTION_ID,
        customer: CUSTOMER_ID,
        status: "active",
      }),
      svc,
    );
    expect(await biz()).toBe("active");
    expect((await sub())!.status).toBe("active");
  });
});

describe("customer.subscription.deleted → canceled + closed (§5)", () => {
  it("cancels the subscription and closes the business", async () => {
    await handleStripeEvent(
      event("checkout.session.completed", {
        customer: CUSTOMER_ID,
        subscription: SUBSCRIPTION_ID,
        metadata: { business_id: businessId },
      }),
      svc,
    );
    await svc.from("businesses").update({ status: "active" }).eq("id", businessId);

    await handleStripeEvent(
      event("customer.subscription.deleted", {
        id: SUBSCRIPTION_ID,
        customer: CUSTOMER_ID,
        status: "canceled",
      }),
      svc,
    );
    expect((await sub())!.status).toBe("canceled");
    expect(await biz()).toBe("closed");
  });
});
