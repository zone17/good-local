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
export interface DbLike {
  from(table: string): {
    select: (cols: string, opts?: unknown) => any;
    insert: (values: unknown) => any;
    update: (values: unknown) => any;
    upsert: (values: unknown, opts?: unknown) => any;
    delete: () => any;
    eq: (col: string, val: unknown) => any;
    maybeSingle: () => any;
    single: () => any;
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

async function alreadyProcessed(db: DbLike, eventId: string): Promise<boolean> {
  const { data } = await db
    .from("processed_stripe_events")
    .select("event_id")
    .eq("event_id", eventId)
    .maybeSingle();
  return !!data;
}

async function markProcessed(db: DbLike, eventId: string): Promise<void> {
  await db.from("processed_stripe_events").insert({ event_id: eventId });
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
  if (await alreadyProcessed(db, event.id)) {
    return { handled: true, deduped: true, type: event.type };
  }

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
      // Unhandled event types are acknowledged (200) but recorded as processed
      // so Stripe does not retry them indefinitely.
      break;
  }

  await markProcessed(db, event.id);
  return { handled: true, type: event.type };
}
