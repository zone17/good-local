// ============================================================
// stripe-webhook/index.ts — Deno edge wrapper (T020).
//
// Reads the RAW body (signature is over the exact bytes), verifies the Stripe
// signature with the shared pure core, loads the service-role supabase client,
// and delegates to handleStripeEvent — the single writer of `subscriptions`
// and business billing status (contracts §5, R4). All logic lives in
// ../_shared/stripe-webhook-core.ts (Web-API-only, also imported by the
// vitest contract test).
// ============================================================
// @ts-nocheck — Deno runtime; types resolved at deploy, not in the vitest tsconfig.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  verifyStripeSignature,
  handleStripeEvent,
} from "../_shared/stripe-webhook-core.ts";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("POST only", { status: 405 });
  }

  // FAIL CLOSED (review P1-4): an unset secret must reject every event, never
  // fall back to a committed literal anyone can sign with
  // (docs/solutions/fail-closed-dev-affordances.md). Local dev sets
  // STRIPE_WEBHOOK_SECRET explicitly (supabase functions serve --env-file).
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set — rejecting event");
    return new Response(
      JSON.stringify({ error: { code: "STRIPE_ERROR", message: "webhook not configured" } }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
  const sigHeader = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  const ok = await verifyStripeSignature(rawBody, sigHeader, secret, 300);
  if (!ok) {
    // No writes on a bad signature.
    return new Response(JSON.stringify({ error: { code: "FORBIDDEN", message: "bad signature" } }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    await handleStripeEvent(event, db);
  } catch (err) {
    // Non-2xx → Stripe retries; the event.id dedup keeps the retry idempotent.
    // Log before responding: a persistently failing endpoint silently diverges
    // billing state from Stripe with no trail (audit OBS-007).
    console.error(JSON.stringify({
      fn: "stripe-webhook",
      event: "handler_failed",
      stripe_event_id: (event as { id?: string })?.id ?? null,
      stripe_event_type: (event as { type?: string })?.type ?? null,
      message: String(err),
    }));
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
