# Quickstart Validation Results — Season One (T062)

**Run date**: 2026-06-06/07 · **Branch**: `001-upper-delaware-passport` · **Environment**: Supabase local stack (Docker), Vite dev server, Chromium · **Suite state at validation**: vitest 107/107 (×2 consecutive), Playwright 7/7 (chromium), CI gates (size, brand) passing.

| Scenario | Method | Result | Evidence |
|---|---|---|---|
| SC-001 Business onboarding <30 min unassisted | Integration + manual | **PASS** | `tests/integration/us1-onboarding.test.ts` (5-step path: pending → webhook checkout → approve → profile/perk/kit). Manual: signup form → Stripe handoff → pending screen verified in browser; owner sign-in (`OwnerSignIn`) → live dashboard/perk-builder/kit verified as mira on the seeded business. |
| SC-002 Check-in speed (first <60s, return <10s) | Playwright, timed | **PASS** | `tests/e2e/checkin.spec.ts` — full first-time flow 380ms–1.1s in test runs, orders of magnitude under the bars; manual browser scans of `/c/the-heron` confirmed stamp + wallet CTA. |
| SC-003 Trust attribution is total | Integration | **PASS** | `tests/integration/trust-model.test.ts` (5 cases): direct inserts unrepresentable (XOR CHECK + no RLS insert path), retired codes excluded from gates + reprint flag, staff path auditable, per-patron (not per-device) daily limit, voided stamps excluded from all views. |
| SC-004 Gates computable day one | Contract + integration | **PASS** | `tests/integration/gates.test.ts`: fresh seed → all 8 metrics return, `insufficient_sample` validity, never errors; snapshot idempotency per day; void → exclusion path (FR-018). |
| SC-005 Privacy boundary | Integration (RLS role matrix) | **PASS** | `tests/integration/rls-privacy.test.ts` (9 tests incl. the dashboard extension): owner A sees zero of business B's stamps/codes/subscriptions/staff entries; `get_dashboard` JSON-walk finds no cross-business references; cross-owner `get_dashboard`/`get_business_regulars` → FORBIDDEN. |
| SC-006 Steer attribution ≥95% | Playwright + contract | **PASS** | `tests/e2e/steer-attribution.spec.ts` (capture pipeline: 3 surfaced → 3 impression rows, correct patron linkage) + `record-check-in.test.ts` case 7 (prior impression → `steered: true`) + the `gate_steered_first_visit_rate` view. |
| SC-007 Dashboard 30-second read | Manual, browser | **PASS** | Verified as mira: weekly note ("1 regular came in last week, up 1." — plural-correct after fix), four headline stats with deltas, perk performance, activity feed, 14-day pattern — all above the fold at 1320px. |
| SC-008 Performance budget | CI gate | **PASS** | `.github/scripts/check-size.mjs`: check-in entry **50.5 KB** gz (≤60), main **123.1 KB** gz (≤130). Check-in entry uses plain fetch (no supabase-js); AdminApp and qrcode lazy-split. |
| SC-009 Brand compliance | CI gate + a11y | **PASS** | `scripts/check-brand.mjs`: 34 files, zero violations (emoji/ratings/hype/plurals). `tests/e2e/a11y.spec.ts`: axe AA zero serious/critical on all four surfaces; tap targets ≥44px (wallet CTA ≥64px). One design-component fix: `Stamp` gained `role="img"`. |
| SC-010 Experiment provability | Integration (seeded) | **PASS** | `gates.test.ts`: paying-business count visible against the June 20 pre-gate threshold (target 15 / kill 10 seeded from the brief); verdict-eligibility logic (`ELIGIBLE` / `INSUFFICIENT_SAMPLE`) exercised; Aug 15 / Nov 1 reads are durable snapshots. |

## Defects found and fixed during validation (the point of the exercise)

1. **Split-bundle identity fork** — scan and passport were two different anonymous patrons (separate auth storage). Fixed: shared `gl-auth` storage key + full-session persistence + refresh. (`docs/solutions/split-bundle-identity-fork.md`)
2. **Fabricated greeting** — "Welcome back, Maya" shown to real anonymous patrons. Fixed: honest greeting, no invented names (Art. I posture).
3. **"1 regulars came in"** — the deterministic SQL weekly-note template lacked singular handling. Fixed in `0010` with zero-case copy.
4. **Stamp showed derived initials ("TH") not the registered stamp code ("HRN")** — fixed at the RPC + UI.
5. **Regulars view had no backing verb** — exposed by mock removal; added `get_business_regulars` (contract §3.10, migration `0013`, contract tests).
6. **Owner/business resolution nondeterminism** when fixtures create multiple businesses per owner — fixed in both the RPC and the hook (oldest-first).
7. **Region-timezone date arithmetic in tests** (UTC "yesterday" = region "today" after 8pm EDT) — same class as the dashboard ISO-week fix; fixture made region-safe.
8. **Accumulated-state test rot** — fixed-email fixtures, `listUsers` page-1 lookups, shared-seed mutations; killed by per-run DB reset (`tests/setup/global-setup.ts`) + unique-per-run fixtures.

## Intentionally not validated here (per quickstart §5)

Real Stripe billing (test-mode/secrets only), platform wallet passes (A/B-deferred behind `PassIssuer`), SMS/email delivery (fail-closed dev affordances), production deployment, and the live gate readings themselves — those are season-one operational events (see `docs/runbooks/season-one-ops.md`).
