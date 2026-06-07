// ============================================================
// stripe-webhook-core.ts — pure, Web-API-only webhook logic (T020).
//
// Single writer of `subscriptions` + business billing status (contracts §5,
// data-model §4). Uses ONLY Web APIs (globalThis.crypto.subtle) so it imports
// cleanly into both Deno (the edge runtime) and node/vitest. No Deno or Stripe
// SDK imports here — the thin index.ts wrapper owns the runtime + IO.
//
//   verifyStripeSignature(body, sigHeader, secret, toleranceSec) -> boolean
//   handleStripeEvent(event, db) -> { handled, deduped?, ... }
//
// `db` is any client exposing the supabase-js `.from(table)` query builder
// (the service-role client; it bypasses RLS — webhook acts as `service`).
// ============================================================

// Minimal structural type for the supabase-js query builder we use, so the
// core stays SDK-version agnostic and Deno-importable without type deps.
// Only the methods called directly off `from()` belong here — filters and
// terminators (.eq/.single/.maybeSingle) chain off these `any` returns, and
// listing them made the real SupabaseClient structurally unassignable (D-020
// typecheck gate).
export interface DbLike {
  from(table: string): {
    select: (cols?: any, opts?: any) => any;
    insert: (values: any) => any;
    update: (values: any) => any;
    upsert: (values: any, opts?: any) => any;
    delete: () => any;
  };
}

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, any> };
}

const enc = new TextEncoder();

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  if (clean.length === 0 || clean.length % 2 !== 0) return new Uint8Array();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) return new Uint8Array();
    out[i] = byte;
  }
  return out;
}

function bytesToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Constant-time-ish comparison of two equal-length hex strings.
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await globalThis.crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return bytesToHex(sig);
}

/**
 * Verify a Stripe-style signature header against the raw body.
 * Header form: `t=<unix_ts>,v1=<hex_hmac>[,v1=<hex_hmac>...]`.
 * The signed message is `${t}.${body}`. Returns true iff a v1 signature
 * matches and the timestamp is within toleranceSec (0 disables the window).
 */
export async function verifyStripeSignature(
  body: string,
  sigHeader: string | null,
  secret: string,
  toleranceSec = 300,
): Promise<boolean> {
  if (!sigHeader) return false;

  let t: string | undefined;
  const v1s: string[] = [];
  for (const part of sigHeader.split(",")) {
    const [k, v] = part.split("=");
    if (k === "t") t = v;
    else if (k === "v1" && v) v1s.push(v);
  }
  if (!t || v1s.length === 0) return false;

  if (toleranceSec > 0) {
    const ts = Number.parseInt(t, 10);
    if (Number.isNaN(ts)) return false;
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - ts) > toleranceSec) return false;
  }

  const expected = await hmacHex(secret, `${t}.${body}`);
  return v1s.some((candidate) => timingSafeEqualHex(candidate, expected));
}

// ---------- DB helpers (single-writer) ----------

/**
 * Claim an event id by INSERTING FIRST (review P2-7): the old SELECT-then-
 * INSERT-at-the-end left a window where two concurrent deliveries of the same
 * event both passed the check and double-applied side effects (the second
 * INSERT then threw an uncaught dup-key → 500 → another Stripe retry).
 * `ignoreDuplicates` upsert is INSERT ... ON CONFLICT DO NOTHING with the
 * inserted rows returned — zero rows back means someone else holds the claim.
 */
async function claimEvent(db: DbLike, eventId: string): Promise<boolean> {
  const { data, error } = await db
    .from("processed_stripe_events")
    .upsert({ event_id: eventId }, { onConflict: "event_id", ignoreDuplicates: true })
    .select("event_id");
  if (error) throw new Error(`claimEvent ${eventId}: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

/** Release a claim after a side-effect failure so the Stripe retry re-applies. */
async function releaseEvent(db: DbLike, eventId: string): Promise<void> {
  await db.from("processed_stripe_events").delete().eq("event_id", eventId);
}

async function findSubscription(db: DbLike, stripeSubscriptionId: string): Promise<any | null> {
  const { data } = await db
    .from("subscriptions")
    .select("*")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();
  return data ?? null;
}

async function setBusinessStatus(db: DbLike, businessId: string, status: string): Promise<void> {
  await db.from("businesses").update({ status }).eq("id", businessId);
}

// ---------- Event handling (contracts §5, data-model §4) ----------

/**
 * Apply a verified Stripe event to local state. Idempotent on `event.id`:
 * a replayed event is a no-op (returns { handled:true, deduped:true }).
 * The caller (index.ts) is responsible for signature verification first.
 */
export async function handleStripeEvent(
  event: StripeEvent,
  db: DbLike,
): Promise<{ handled: boolean; deduped?: boolean; type: string }> {
  // Claim before any side effect; a concurrent duplicate delivery loses the
  // claim and no-ops. On side-effect failure the claim is released so the
  // Stripe retry (non-2xx → redeliver) applies the event cleanly.
  if (!(await claimEvent(db, event.id))) {
    return { handled: true, deduped: true, type: event.type };
  }

  try {
    await applyStripeEvent(event, db);
  } catch (err) {
    await releaseEvent(db, event.id);
    throw err;
  }
  return { handled: true, type: event.type };
}

/** The actual side effects, applied exactly once per claimed event id. */
async function applyStripeEvent(event: StripeEvent, db: DbLike): Promise<void> {
  const obj = event.data.object ?? {};

  switch (event.type) {
    case "checkout.session.completed": {
      const businessId: string | undefined = obj.metadata?.business_id;
      const customerId: string = obj.customer;
      const subscriptionId: string = obj.subscription;
      const foundingPriceId: string =
        obj.metadata?.founding_price_id ?? "price_founding_local";

      if (businessId) {
        // Upsert by stripe_subscription_id — single source of truth (R4).
        const existing = await findSubscription(db, subscriptionId);
        if (existing) {
          await db
            .from("subscriptions")
            .update({ status: "active", plan: "founding_79" })
            .eq("stripe_subscription_id", subscriptionId);
        } else {
          await db.from("subscriptions").insert({
            business_id: businessId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            plan: "founding_79",
            founding_rate: true,
            founding_price_id: foundingPriceId,
            status: "active",
            winter_tier: false,
          });
        }
        // Business becomes eligible to go active on admin approval; if it was
        // already approved/active this is a no-op upstream. We do not force it
        // active here (approval is the admin gate, FR-006).
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscriptionId: string = obj.id;
      const status: string = obj.status; // active | past_due | canceled | ...
      const sub = await findSubscription(db, subscriptionId);
      if (sub) {
        const plan = obj.metadata?.plan === "winter" ? "winter_49" : sub.plan;
        const winterTier = obj.metadata?.plan === "winter" ? true : sub.winter_tier;
        await db
          .from("subscriptions")
          .update({ status, plan, winter_tier: winterTier })
          .eq("stripe_subscription_id", subscriptionId);

        // Restore: a previously suspended business returns to active on a
        // successful payment (status active). data-model §4.
        if (status === "active" && sub.status === "suspended") {
          await setBusinessStatus(db, sub.business_id, "active");
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscriptionId: string = obj.id;
      const sub = await findSubscription(db, subscriptionId);
      if (sub) {
        await db
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("stripe_subscription_id", subscriptionId);
        // Business → closed; patron stamps preserved (§5).
        await setBusinessStatus(db, sub.business_id, "closed");
      }
      break;
    }

    case "invoice.payment_failed": {
      const subscriptionId: string = obj.subscription;
      const sub = await findSubscription(db, subscriptionId);
      if (sub) {
        const exhausted =
          obj.metadata?.dunning_exhausted === "true" ||
          obj.metadata?.dunning_exhausted === true ||
          (typeof obj.attempt_count === "number" && obj.attempt_count >= 3);

        if (exhausted) {
          // Dunning exhausted → suspend (no new check-ins; stamps preserved, FR-004).
          await db
            .from("subscriptions")
            .update({ status: "suspended" })
            .eq("stripe_subscription_id", subscriptionId);
          await setBusinessStatus(db, sub.business_id, "suspended");
        } else {
          // Still in dunning grace.
          await db
            .from("subscriptions")
            .update({ status: "past_due" })
            .eq("stripe_subscription_id", subscriptionId);
        }
      }
      break;
    }

    default:
      // Unhandled event types are acknowledged (200) and keep their claim row
      // so Stripe does not retry them indefinitely.
      break;
  }
}
