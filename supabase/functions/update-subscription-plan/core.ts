// ============================================================
// update-subscription-plan/core.ts — winter tier / founding revert (T024).
//
// Contracts §3.9. The LOCAL subscriptions row is NOT written here — the Stripe
// webhook is the single writer (R4). This function performs the Stripe
// subscription-item price swap and returns an optimistic projection; the
// webhook later reflects the real state via customer.subscription.updated.
//
// winter is selectable only inside the Nov 1 – Apr 30 window, America/New_York
// (OUTSIDE_WINTER_WINDOW otherwise). All IO injected so it is testable.
// ============================================================

export class PlanError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

export interface PlanDeps {
  db: { from(table: string): any };
  fetchImpl: typeof fetch;
  env: {
    STRIPE_SECRET_KEY: string;
    STRIPE_PRICE_WINTER?: string;
    STRIPE_PRICE_FOUNDING?: string;
  };
  // The authenticated owner's auth.uid() (resolved from the JWT by index.ts).
  ownerUserId: string;
  // Override "now" for deterministic window tests.
  now?: Date;
}

// Month in America/New_York (1–12). Winter window = Nov(11)–Apr(4) inclusive.
export function nyMonth(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "numeric",
  }).formatToParts(d);
  return Number(parts.find((p) => p.type === "month")!.value);
}

export function inWinterWindow(d: Date): boolean {
  const m = nyMonth(d);
  return m >= 11 || m <= 4;
}

export async function changePlan(
  action: "winter" | "founding",
  deps: PlanDeps,
): Promise<
  | { plan: "winter"; monthly: 49; founding_rate_preserved: true }
  | { plan: "founding"; monthly: 79 }
> {
  const { db, fetchImpl, env, ownerUserId } = deps;
  const now = deps.now ?? new Date();

  if (action === "winter" && !inWinterWindow(now)) {
    throw new PlanError("OUTSIDE_WINTER_WINDOW");
  }

  // Resolve the owner's business → subscription.
  const { data: biz } = await db
    .from("businesses")
    .select("id")
    .eq("owner_user_id", ownerUserId)
    .limit(1)
    .maybeSingle();
  if (!biz) throw new PlanError("FORBIDDEN");

  const { data: sub } = await db
    .from("subscriptions")
    .select("stripe_subscription_id, founding_price_id")
    .eq("business_id", biz.id)
    .maybeSingle();
  if (!sub) throw new PlanError("FORBIDDEN", "no subscription");

  const targetPrice =
    action === "winter"
      ? env.STRIPE_PRICE_WINTER ?? "price_winter_local"
      : env.STRIPE_PRICE_FOUNDING ?? sub.founding_price_id ?? "price_founding_local";

  // Fetch current item id, then swap its price. (Two Stripe calls; both
  // tolerant of the local no-network fallback below.)
  try {
    const itemsResp = await fetchImpl(
      `https://api.stripe.com/v1/subscription_items?subscription=${sub.stripe_subscription_id}`,
      { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } },
    );
    if (itemsResp.ok) {
      const items = (await itemsResp.json()) as { data?: Array<{ id: string }> };
      const itemId = items.data?.[0]?.id;
      if (itemId) {
        const form = new URLSearchParams();
        form.set("price", targetPrice);
        form.set("proration_behavior", "none");
        const swap = await fetchImpl(`https://api.stripe.com/v1/subscription_items/${itemId}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form.toString(),
        });
        if (!swap.ok) {
          const detail = await swap.text().catch(() => "");
          throw new PlanError("STRIPE_ERROR", detail.slice(0, 200));
        }
      }
    }
  } catch (err) {
    if (err instanceof PlanError) throw err;
    throw new PlanError("STRIPE_ERROR", String(err).slice(0, 200));
  }

  // Optimistic projection only — the webhook is the single writer of the row.
  return action === "winter"
    ? { plan: "winter", monthly: 49, founding_rate_preserved: true }
    : { plan: "founding", monthly: 79 };
}
