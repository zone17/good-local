# Phase 0 Research: Good Local Season One

> All NEEDS CLARIFICATION items from the plan's Technical Context, resolved. Format per
> speckit: Decision / Rationale / Alternatives considered. Constitution v1.0.0 references in
> parentheses.

## R1 — Backend platform

**Decision**: Supabase (managed Postgres 15 + Auth + Row-Level Security + Edge Functions +
pg_cron). No custom server process.

**Rationale**: The constitution's hardest invariants map directly onto Postgres primitives —
the privacy boundary (Art. V) becomes RLS policies tested as roles rather than application code
that every endpoint must remember; the check-in trust model (Art. II) becomes a single
transactional RPC with CHECK constraints making un-attributed stamps unrepresentable; gate
metrics (Art. III) become versioned SQL views, immutable except by reviewable migration. Zero
server processes to operate matches the A12 runway reality and Art. XXVIII (smallest architecture
that preserves options): the asset that must survive a platform change is a plain Postgres schema,
which is portable by construction. Built-in auth covers both identity models (owner email, patron
phone-OTP/anonymous) without a dependency. pg_cron covers code rotation without a job runner.

**Alternatives considered**: (a) Custom Hono/Express + Postgres + ORM — more dependencies, an
always-on process to host/monitor, and every Art. V guarantee re-implemented in middleware;
rejected on simplicity and enforcement-strength grounds. (b) Next.js full-stack on Vercel —
couples the patron bundle to a framework runtime and raises the 3G entry weight (Art. IX), API
routes give weaker invariant enforcement than RLS; rejected. (c) Firebase — document model fights
the relational gate metrics and SQL-view auditability; rejected.

## R2 — Rotating-code scheme for printed kits

**Decision**: Per-business random opaque codes stored in `check_in_codes` (value, version,
status: current → grace → retired). Printed QR encodes
`https://goodlocal.app/c/{business_slug}?k={code_value}`. pg_cron rotates on the business's
schedule (default weekly, 72h grace). Server-side `record_check_in` accepts only
current-or-grace values; retired values return a structured `CODE_RETIRED` error that also flags
the business for a reprint.

**Rationale**: Paper cannot compute — any time-derived (TOTP-style) scheme dies at the printer.
Stored versioned random codes give: deterministic validation (Art. II/XII), an honest audit trail
of which code version each stamp used, a rotation cadence matching the design's own register-kit
copy ("your code rotates every 7 days"), and a grace window so a same-week reprint never strands
a register. Fraud posture (04/G4): a leaked photo of a code works for at most rotation+grace, is
bounded by the 1/patron/business/day limit, and is visible in admin anomaly views.

**Alternatives considered**: Static per-business URL only — unbounded replay from one shared
photo, gates becomes gameable (rejected, violates Art. II); dynamic on-screen codes — requires
register hardware, contradicts the print-kit product (rejected); signed JWT in QR — same paper
problem once printed, revocation no easier than versioned rows (rejected as added complexity).

## R3 — Patron identity

**Decision**: Anonymous-first with phone claim. First scan creates a Supabase anonymous session +
`patrons` row (device-linked). Phone number is optional and additive: the staff path and
multi-device linking use phone OTP to claim/merge into one patron identity. No passwords for
patrons, ever.

**Rationale**: The 60-second first check-in (SC-002) cannot afford an account wall; anonymous
sessions make stamp #1 instant while preserving a durable identity for the gates (median
check-ins, 2nd-business rate are per-patron). Phone OTP is already required by the staff path
(FR-016), so it doubles as the recovery/merge mechanism without adding an auth method. Merging
two anonymous patrons on claim is an explicit, audited operation (Art. XIV corrections preserve
history).

**Alternatives considered**: Phone-first signup — adds a wall before the first stamp, kills the
register moment (rejected); email magic links — wrong medium at a riverside register (rejected);
device-only identity with no claim — breaks multi-device patrons and the staff path (rejected).

## R4 — Stripe subscription pattern

**Decision**: Stripe Checkout for signup ($79/mo price), Customer Portal for self-service,
`stripe-webhook` edge function as the single writer of the local `subscriptions` table
(status, plan, founding lock). Founding lock = `founding_rate: true` metadata + dedicated price
IDs; winter tier = subscription item swap to the $49 price within the Nov–Apr window, reversible
to the locked founding price. Suspension after dunning exhausts maps to business status
`suspended` (FR-004) via webhook.

**Rationale**: Card data never touches our systems (spec assumption; Art. XXVI); Stripe owns
retries/dunning; the local table is a projection updated only by verified webhook events
(deterministic single writer, Art. XII/XV). Price-ID-per-tier keeps the founding lock auditable
in Stripe itself, not just locally.

**Alternatives considered**: Stripe Elements custom flow — more surface, no benefit at this
scale (rejected); invoicing/ACH — wrong for $79 self-serve (rejected); local plan state mutated
by app code — two writers, drift risk (rejected).

## R5 — Wallet-pass issuance (behind the A/B)

**Decision**: Define a thin `PassIssuer` interface now (issue, update, revoke; per-platform
serials in `wallet_pass_instances`); implement after the pre-launch landing A/B (04/P7) decides
issuance priority. Candidate implementations researched: **Apple** — .pkpass signing requires an
Apple Developer account + Pass Type ID certificate; sign in an edge function or via a managed
API (PassKit/PassSlot-class services, ~$30–50/mo tier) to avoid certificate plumbing at launch.
**Google** — Wallet API with a service account; REST-only, simpler than Apple. The web passport
ships first either way and is the complete fallback (FR-020).

**Rationale**: The A/B is the attested decision gate — building either platform deeply before it
reads is premature (Art. XXVIII). The adapter keeps launch unblocked: check-ins, stamps, and all
gates function with the web passport alone; pass issuance upgrades the experience without
schema change.

**Alternatives considered**: Commit to Apple-first now — contradicts the open A/B in the
attestations (rejected); skip wallet entirely for season one — surrenders the lock-screen
surfacing that serves A1's "nudge back" loop; keep optional, not absent (rejected).

## R6 — Gate metrics as deterministic SQL

**Decision**: Each gate metric is one versioned SQL view over base events, joined against a
seeded `gate_thresholds` table; an admin RPC `read_gate_metrics()` returns metric, value, n,
threshold set, validity flag (trust-model compliance + sample floors), and verdict-eligibility
(e.g., `INSUFFICIENT_SAMPLE` before 500 installs / n≥200). Nightly pg_cron writes
`gate_metric_snapshots` rows for the historical record; the Aug 15 and Nov 1 reads are snapshots,
not ad-hoc queries.

**Rationale**: Art. III demands thresholds that can't drift and readings that label their own
validity; views-in-migrations make every definition change a reviewed diff, and snapshots make
the kill-condition read reproducible evidence (Art. XV durable artifacts). Definitions implement
the spec's exact terms: active patron = 2+ trust-valid check-ins in-season; verified regular =
2+ at one business; steered = first check-in at a business with a prior impression by the same
patron.

**Alternatives considered**: Application-side analytics (Amplitude/PostHog) — third-party data
custody for gate truth, definitions drift from SQL of record, new dependency (rejected for gates;
may complement later for product analytics); dashboard-tool-defined metrics — same drift problem
(rejected).

## R7 — 3G performance budget mechanics

**Decision**: A second Vite entry `checkin.html` serving the `/c/{slug}` flow with only: token
parse, `record_check_in` call, stamp confirmation (Stamp + ProgressMeter components), wallet/
claim CTAs. Budget enforced in CI: ≤60KB gzipped JS for the check-in entry, ≤130KB for the main
SPA. Fonts: subset woff2 of the three families, `font-display: swap`, system-font fallback
acceptable on the check-in entry if the subset misses the budget.

**Rationale**: SC-008 makes the register moment the binding constraint; the main SPA can afford
React + supabase-js, but the scan landing must not pay for the dashboard. Vite multi-entry is
zero-new-dependency (Art. XXVIII). CI size gate makes the budget a hard check (Art. XXXI),
not a hope.

**Alternatives considered**: SSR/edge-render the landing — new runtime + complexity for a page
that is mostly one RPC (rejected); a service-worker PWA shell — caching helps repeat visits but
not the critical first scan, and adds update-bug surface (deferred, not rejected).

## R8 — Steer-impression capture

**Decision**: First-party `steer_impressions` table written via a single batched RPC
(`record_impressions(business_ids[], surface)`) fired from discovery and business-detail views,
deduplicated per patron×business×day server-side. Steered-first-visit attribution is a join in
the R6 views (impression strictly before first check-in, same patron).

**Rationale**: SC-006 needs ≥95% attribution fidelity under our own definition — that requires
first-party capture with the same identity used for stamps, not a third-party pixel. One batched
call per screen render keeps the 3G budget honest; per-day dedup bounds row growth at season-one
scale trivially.

**Alternatives considered**: Analytics SDK events — identity mismatch with patron rows breaks
the join to check-ins (rejected); logging impressions client-side only on click — misses the
"surfaced but visited later organically" cases the gate definition requires (rejected).
