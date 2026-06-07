# Quickstart — Phase-1 Validation Guide: Good Local Season One

> Local run + validation guide for the Upper Delaware Passport. This proves the
> Phase-1 design (the vertical slice) against Success Criteria SC-001…SC-010.
> Entity shapes are defined in [data-model.md](data-model.md); domain verbs and
> error codes in [contracts/api.md](contracts/api.md) — referenced, never
> duplicated here.

## 1. Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Node | 20+ | Vite frontend + edge function tooling |
| Supabase CLI | latest | local Postgres + Auth + RLS + pg_cron + edge functions |
| Stripe CLI | latest | webhook forwarding for the subscription lifecycle (R4) |
| Playwright browsers | bundled | timed E2E paths (SC-002, SC-006) |

```bash
node -v                       # expect v20.x or newer
supabase --version
stripe --version
npx playwright install        # chromium for E2E + Lighthouse runs
```

## 2. First run

### 2.1 Start the local stack

```bash
supabase start                # boots Postgres, Auth, Studio, edge runtime
supabase db reset             # applies supabase/migrations/* then supabase/seed/*
```

The seed (`supabase/seed/`) lands a verifiable baseline:

- one **region** (Upper Delaware) + **12 towns**
- **gate_thresholds** rows from the discovery brief (targets, kill floors, sample floors, gate dates)
- one demo **business** "The Heron" — status `active` (admin-approved), one
  published **perk**, and one **current** check-in code

Note the seeded current code value printed by the reset (also visible in Studio,
`check_in_codes` where `status='current'` for The Heron). Call it `<HERON_CODE>` below.

### 2.2 Wire environment (names only — no values in repo)

`app/.env.local`:

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Edge-function / server env (set via `supabase secrets set` or local `.env`):

```
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_FOUNDING_79
STRIPE_PRICE_WINTER_49
```

### 2.3 Run the frontend

```bash
cd app
npm install
npm run dev                   # http://localhost:5173
```

### 2.4 Forward Stripe webhooks

```bash
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
```

Copy the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET`, then restart functions.

### 2.5 Expected entry points

| URL | Surface |
|---|---|
| `http://localhost:5173/` | Patron app — passport, discover, me (≤560px lane) |
| `http://localhost:5173/c/the-heron?k=<HERON_CODE>` | Check-in entry (tiny `checkin.html` bundle, R7) |
| `http://localhost:5173/business` | Owner dashboard |
| `http://localhost:5173/admin` | Internal admin — approvals, picks, rotation, gates |

## 3. Validation scenarios (one per Success Criterion)

> Each scenario lists steps → expected outcome → how it's verified. RPCs and
> error codes referenced from [contracts/api.md](contracts/api.md).

### SC-001 — Business onboarding under 30 min, unassisted (manual script)

1. Visit `/business` signup; enter business details + owner identity.
2. Complete Stripe Checkout with test card `4242 4242 4242 4242`, any future
   expiry/CVC/ZIP. Webhook writes the `subscriptions` row at the founding $79 rate.
3. In `/admin` → approvals, approve the new business (decision recorded).
4. Back in `/business`, publish one perk (threshold 3–12, a valid perk kind).
5. Generate the register kit and confirm the print-ready page shows the current code.

**Expected**: profile + one published perk + printable kit + active billing, no assistance.
**Verified**: manual, timed under 30 min; billing row confirmed in Studio `subscriptions`.

### SC-002 — Check-in speed (Playwright, timed)

1. First-time: open `/c/the-heron?k=<HERON_CODE>`, create identity, earn stamp #1, see wallet offer.
2. Returning: same patron scans the next day → stamp #2.

**Expected**: first-time path < 60s including identity creation; returning < 10s.
**Verified**: `tests/e2e/checkin.spec.ts` asserts wall-clock budgets on a throttled context.

### SC-003 — Trust attribution is total (integration)

Attempt every stampless path; each must be blocked or auditable:

- direct `INSERT` into stamps without attribution → rejected by CHECK constraint.
- scan a retired code → `CODE_RETIRED`, no stamp, business flagged to reprint.
- second same-day scan → `DAILY_LIMIT`, no second stamp.
- `staff_check_in` (phone path) → stamp recorded, attributed to the staff session (auditable row).

**Expected**: 100% of stamps trace to a validated code scan or an auditable staff entry; no third path.
**Verified**: `tests/integration/trust-model.test.ts` against Supabase local.

### SC-004 — Gates computable on day one (contract)

1. On a fresh seed, call `read_gate_metrics()` as the admin role.

**Expected**: every pre-registered metric returns with value, n, threshold set, and a validity flag
of `INSUFFICIENT_SAMPLE` (never an error) before installs/n floors are met.
**Verified**: `tests/contract/gate-metrics.test.ts` asserts all metrics present, none throw.

### SC-005 — Privacy boundary (RLS role-matrix, integration)

1. Seed stamps for one patron at business A and business B (owned by different owners).
2. Authenticated as owner A, query patron stamps scoped to business B.

**Expected**: zero rows. Repeat the query against every owner-facing view — none reveal a patron's
activity at another business.
**Verified**: `tests/integration/rls-role-matrix.test.ts` runs as patron/owner/admin roles;
enumerates every owner view and asserts cross-business reads return empty.

### SC-006 — Steer attribution ≥95% (Playwright)

1. As a patron, view a business in discovery (records a steer impression).
2. Check in there for the first time.
3. Call `read_gate_metrics()` and inspect the steered-first-visit metric.

**Expected**: the first visit is attributed as steered; across the scripted impression→visit set,
attribution fidelity is ≥95%.
**Verified**: `tests/e2e/steer-attribution.spec.ts` drives the set and asserts the ratio.

### SC-007 — Dashboard 30-second read (manual, tablet)

1. Open `/business` at viewport 1024×768.

**Expected**: the plain-language weekly note plus the four headline stats are visible above the fold,
no scrolling — an owner answers "is this working?" in under 30s.
**Verified**: manual on tablet viewport; screenshot attached to the gate review.

### SC-008 — Performance budget (CI)

1. CI builds and measures gzipped bundle size of each entry.
2. Lighthouse runs the check-in entry under a 3G profile.

**Expected**: check-in entry ≤ 60KB gzipped; main SPA ≤ 130KB gzipped (R7); check-in page
interactive < 3s on 3G-class.
**Verified**: CI size-limit step (hard fail over budget) + Lighthouse 3G run on `/c/`.

```bash
cd app
npm run build
npx size-limit               # enforces the two entry budgets
```

### SC-009 — Brand compliance (grep-based content checks)

```bash
# no emoji codepoints in app source or design copy strings
rg -nP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{FE0F}]' app/src design || echo "OK: no emoji"
# no rating UI
rg -ni 'star.?rating|\brating\b' app/src && echo "REVIEW" || echo "OK: no rating UI"
```

**Expected**: no emoji, no star-rating UI, no streak/paid-placement affordances anywhere.
**Verified**: grep checks above (CI) + a voice spot-check list (plain person-to-person language,
no all-caps beyond eyebrows, correct singular/plural).

### SC-010 — Experiment provability (seeded scenario, fake clock)

1. Seed a scenario set; advance the fake clock to **June 20** and read the paying-business count
   against the pre-gate.
2. Advance to **Aug 15**; the nightly snapshot must produce a verdict-eligibility
   (valid / invalid / inconclusive) from captured data alone.

**Expected**: June 20 paying count is visible against its pre-gate; Aug 15 snapshot yields a
definitive verdict-eligibility; Nov 1 retention is computable from billing history.
**Verified**: seeded scenario + `gate_metric_snapshots` rows; contract assertion on snapshot verdict.

## 4. Resetting

```bash
supabase db reset            # drops, re-applies migrations, re-seeds from scratch
```

Re-note the freshly seeded `<HERON_CODE>` (rotation may issue a new current value).

## 5. Intentionally NOT validated here

- **Wallet pass issuance** — sits behind the `PassIssuer` A/B adapter (R5); the web passport is the
  complete fallback and is what these scenarios exercise.
- **Stripe live mode** — all billing checks use Stripe test mode + the `4242` test card.
- **Multi-region** — v1 ships exactly one region (Upper Delaware); no multi-region path is exercised.
