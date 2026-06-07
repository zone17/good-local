// ============================================================
// create-checkout-session/index.ts — Deno edge wrapper (T019).
//
// Thin runtime shell: parses the JSON body, wires the service-role supabase
// client + real fetch + env secrets, calls the pure core, and maps the result
// (or a CheckoutError) to the §1.2 response/envelope. All logic lives in core.ts.
// ============================================================
// @ts-nocheck — Deno runtime; types resolved at deploy, not in the vitest tsconfig.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCheckout, CheckoutError } from "./core.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return json({ error: { code: "VALIDATION", message: "POST only" } }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: { code: "VALIDATION", message: "invalid json" } }, 400);
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const result = await buildCheckout(body as never, {
      db,
      fetchImpl: fetch,
      env: {
        STRIPE_SECRET_KEY: Deno.env.get("STRIPE_SECRET_KEY") ?? "sk_test_local",
        SITE_URL: Deno.env.get("SITE_URL") ?? undefined,
        STRIPE_PRICE_FOUNDING: Deno.env.get("STRIPE_PRICE_FOUNDING") ?? undefined,
      },
    });
    return json(result, 200);
  } catch (err) {
    if (err instanceof CheckoutError) {
      const status = err.code === "STRIPE_ERROR" ? 502 : err.code === "DUPLICATE_PENDING" ? 409 : 422;
      return json({ error: { code: err.code, message: err.message } }, status);
    }
    return json({ error: { code: "VALIDATION", message: String(err) } }, 500);
  }
});

function json(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
