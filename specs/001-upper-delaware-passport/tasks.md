# Tasks: Good Local — Season One, The Upper Delaware Passport

**Input**: Design documents from `/specs/001-upper-delaware-passport/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R8), data-model.md, contracts/api.md, quickstart.md — all complete

**Tests**: INCLUDED — contract tests precede implementation per Constitution Art. XIX; trust-model, privacy (RLS), and gate tests are launch-blocking per Articles II/III/V.

**Organization**: Grouped by user story (US1–US7 from spec.md). US1 is the Mel-gate path; the **June 18 vertical-slice pre-gate maps to the end of Phase 4 (US2)**.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on incomplete tasks)
- **[Story]**: US1–US7 for story phases; none for Setup/Foundational/Polish
- Exact file paths in every description

## Path Conventions

Per plan.md structure: `app/` (frontend, two Vite entries), `supabase/` (migrations, functions, seed), `tests/` (contract, integration, e2e), `design/` (consume-only).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: project initialization per plan structure

- [x] T001 Initialize Supabase project scaffolding: `supabase/config.toml`, empty `supabase/migrations/`, `supabase/functions/`, `supabase/seed/` (supabase CLI init, local stack boots)
- [x] T002 [P] Test scaffolding: Vitest config `vitest.config.ts`, dirs `tests/contract/`, `tests/integration/`, `tests/unit/`; Playwright config `playwright.config.ts` + `tests/e2e/`
- [x] T003 [P] CI pipeline `.github/workflows/ci.yml`: install, lint, vitest, playwright (smoke), and size-limit gates (check-in entry ≤60KB gz, main ≤130KB gz — R7, enforced failing)
- [x] T004 [P] Frontend platform prep in `app/`: add `@supabase/supabase-js`, create `app/.env.example` (SUPABASE_URL, SUPABASE_ANON_KEY, STRIPE_PUBLISHABLE_KEY names only), add second Vite entry `app/checkin.html` in `app/vite.config.js` (R7)
- [x] T005 [P] Auth session module `app/src/lib/auth.ts`: anon-patron bootstrap on first load, owner email sign-in, admin role detection (contexts per contracts §1.1)
- [x] T006 [P] Error envelope + machine codes module `app/src/lib/errors.ts` from contracts §7 (clients branch on `code`, never message)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: schema, policies, views, seeds, and the API seam — nothing story-specific can land before these

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T007 Migration `supabase/migrations/0001_schema.sql`: all tables per data-model §2 — regions, towns, seasons, businesses, subscriptions, perks, check_in_codes, patrons + patron_devices, stamps (XOR attribution CHECK + UNIQUE(patron,business,local_date) per §3 Art. II), staff_entries, perk_redemptions, founding_picks, steer_impressions, regional_milestones + milestone_unlocks, wallet_pass_instances, gate_thresholds + gate_metric_snapshots; validation rules per §6
- [x] T008 Migration `supabase/migrations/0002_rls.sql`: enable RLS everywhere + the full policy matrix per data-model §3 Art. V (owner-scoped, patron-own-rows, admin, service)
- [x] T009 [P] Migration `supabase/migrations/0003_views.sql`: `verified_regulars_per_business`, the 6 gate-metric views, owner dashboard aggregate views per data-model §5 (all excluding trust-invalid stamps)
- [x] T010 [P] Seed `supabase/seed/seed.sql`: Upper Delaware region, 12 towns, season-one window, `gate_thresholds` rows from the discovery brief, demo business "The Heron" (approved, one perk, one current code) per quickstart
- [x] T011 Integration test harness `tests/integration/helpers.ts`: role-context clients (anon-patron / claimed patron / owner / admin / service JWTs) against Supabase local
- [x] T012 [P] RLS role-matrix privacy test `tests/integration/rls-privacy.test.ts` (Art. V / SC-005): as owner A, every read path for patron activity at business B returns zero rows — enumerated per data-model matrix; written now, extended in US6
- [x] T013 Typed API client `app/src/lib/api.ts`: request/response types + call stubs for all 27 verbs from contracts/api.md, same data shapes as `app/src/data.js` so screens swap seam-only
- [x] T014 [P] Migration `supabase/migrations/0004_rotation.sql`: rotation function (current→grace→retired, one-current partial unique index) + pg_cron schedule per business (default weekly, 72h grace — R2)
- [x] T015 [P] Correlation/trace helper `app/src/lib/trace.ts` + structured client log conventions (Art. XV/XXIX-light)

**Checkpoint**: schema + policies + views + seam ready — user stories can start (US1 and US2 in parallel if staffed)

---

## Phase 3: User Story 1 — Business sets up its own rewards program, same day (Priority: P1) 🎯 Mel-gate path

**Goal**: signup → $79 billing live → profile → perk published → printable kit, standalone (zero other participants)

**Independent Test**: brand-new owner goes landing → live program unassisted with empty network (SC-001; quickstart S1)

### Tests for User Story 1 (write first, must fail)

- [x] T016 [P] [US1] Contract tests for `update_business_profile`, `publish_perk`, `update_perk`, `set_perk_active`, `get_register_kit` in `tests/contract/business-program.test.ts`
- [x] T017 [P] [US1] Contract test for `stripe-webhook` event handling (checkout.session.completed, subscription.updated/deleted, invoice.payment_failed → dunning → suspended) in `tests/contract/stripe-webhook.test.ts`

### Implementation for User Story 1

- [x] T018 [US1] Migration `supabase/migrations/0005_rpc_business.sql`: RPCs `update_business_profile`, `publish_perk`, `update_perk`, `set_perk_active` (threshold edits preserve stamps — FR-011), `get_register_kit`
- [x] T019 [P] [US1] Edge function `supabase/functions/create-checkout-session/index.ts`: Stripe Checkout session for $79 founding price (idempotency_key; founding metadata — R4)
- [x] T020 [US1] Edge function `supabase/functions/stripe-webhook/index.ts`: signature verification; single writer of `subscriptions`; business status transitions incl. suspension/restore (FR-004)
- [x] T021 [P] [US1] Owner signup flow UI `app/src/business/Signup.tsx`: business details + owner identity → checkout redirect → pending-approval state (design components only)
- [x] T022 [US1] Wire BusinessApp profile/settings + perk builder to `api.ts` (replace mock reads/writes) in `app/src/business/BusinessApp.jsx` (perk-design guidance text per FR-009)
- [x] T023 [US1] Register-kit print page `app/src/business/RegisterKit.tsx` + print stylesheet: current code QR + patron instructions (US Letter, kraft styling per design)
- [x] T024 [US1] Winter tier: edge function `supabase/functions/update-subscription-plan/index.ts` (`switch_winter_tier`/`revert_founding_rate`, Nov–Apr window guard) + settings UI wiring in `app/src/business/BusinessApp.jsx`
- [x] T025 [US1] Integration test `tests/integration/us1-onboarding.test.ts`: full SC-001 path with Stripe test mode (signup → webhook → admin-approve via seed helper → publish perk → kit payload)

**Checkpoint**: US1 fully functional — a paying business with a live standalone program (patron side still mock)

---

## Phase 4: User Story 2 — Patron checks in and earns a stamp (Priority: P2) 🚦 June 18 vertical-slice gate

**Goal**: scan → passport identity → validated stamp → perk progress → wallet/claim offer; trust model complete

**Independent Test**: seeded business; first-time patron completes scan→stamp→wallet offer <60s on 3G; all invalid paths rejected (SC-002/003; quickstart S2/S3)

### Tests for User Story 2 (write first, must fail)

- [x] T026 [P] [US2] Contract tests for `record_check_in` — success shape, `CODE_RETIRED`, `CODE_INVALID`, `DAILY_LIMIT`, `BUSINESS_SUSPENDED`, atomic threshold-crossing — in `tests/contract/record-check-in.test.ts`
- [x] T027 [P] [US2] Contract tests for `claim_passport` + `link_device` (anon→claimed merge preserves history) in `tests/contract/identity.test.ts`

### Implementation for User Story 2

- [x] T028 [US2] Migration `supabase/migrations/0006_rpc_checkin.sql`: `record_check_in` single-transaction RPC (token current/grace validation, daily UNIQUE, attribution write, perk-ready atomicity, steered flag join, first-visit flags) + `link_device` + `staff_check_in` (auditable, rate-limited — FR-016)
- [x] T029 [US2] Edge function `supabase/functions/claim-passport/index.ts`: phone OTP claim link (staff path FR-016 + multi-device merge R3), merge as audited operation
- [x] T030 [P] [US2] Check-in entry UI `app/src/checkin/` (own bundle via `app/checkin.html`): scan-landing → stamped confirmation (Stamp + ProgressMeter from design) → wallet/claim CTAs; durable-server-record-even-if-UI-fails behavior (Edge Case)
- [x] T031 [US2] Staff check-in UI on business surface `app/src/business/StaffCheckIn.tsx` (phone entry → stamp + one-time claim link)
- [x] T032 [US2] `PassIssuer` adapter `app/src/lib/pass.ts`: interface (issue/update/revoke) + web-passport default + platform impl stub behind A/B flag (R5); `wallet_pass_instances` write on add
- [x] T033 [US2] Trust-model integration tests `tests/integration/trust-model.test.ts` (SC-003): direct stamp insert blocked by CHECK; retired-code check-in absent from all gate views; staff entry produces auditable row; rate-limit enforced per patron not per device
- [x] T034 [US2] Playwright timed e2e `tests/e2e/checkin.spec.ts` (SC-002): first-time <60s, returning <10s, throttled network profile
- [x] T035 [US2] Enforce check-in entry size budget in CI (size-limit wiring for `checkin.html` bundle; build fails >60KB gz — SC-008)

**Checkpoint**: 🚦 **June 18 vertical slice** — scan → stamp → wallet demoable end-to-end; launch date holds or slides per the brief

---

## Phase 5: User Story 3 — Perk progress and redemption at the register (Priority: P3)

**Goal**: threshold reached → perk ready → staff verifies and records redemption in one action

**Independent Test**: patron at threshold redeems at register; records who/what/when; carry-over rules hold (quickstart S3 redemption arm)

### Tests for User Story 3 (write first, must fail)

- [x] T036 [P] [US3] Contract test for `redeem_perk` (ready-only, reset rules, audit fields) in `tests/contract/redeem-perk.test.ts`

### Implementation for User Story 3

- [x] T037 [US3] Migration `supabase/migrations/0007_rpc_redeem.sql`: `redeem_perk` RPC + perk-ready surfacing in activity feed source view
- [x] T038 [US3] Redemption UI on business surface (activity feed action + single-confirm) wiring in `app/src/business/BusinessApp.jsx`
- [x] T039 [US3] Patron perk-ready states (passport + check-in confirmation variants) wiring in `app/src/patron/PatronApp.jsx`
- [x] T040 [US3] Integration test `tests/integration/perk-lifecycle.test.ts`: threshold edit carry-over (FR-011), deactivation preserves stamps (FR-010), atomic ready-at-threshold (Edge Case)

**Checkpoint**: loyalty loop closed — earn → ready → redeem → recorded

---

## Phase 6: User Story 4 — Passport home and regional progress (Priority: P4)

**Goal**: stamps grouped by business + season-cumulative regional progress; zero decay

**Independent Test**: multi-business patron sees grouped stamps, "N of 12 towns", milestone unlocks; absence changes nothing (quickstart S4-adjacent)

### Tests for User Story 4 (write first, must fail)

- [x] T041 [P] [US4] Contract test for `get_my_passport` (grouped shape, regional progress, milestone unlocks) in `tests/contract/get-my-passport.test.ts`

### Implementation for User Story 4

- [x] T042 [US4] Migration `supabase/migrations/0008_rpc_passport.sql`: `get_my_passport` RPC + town-first-visit milestone unlock logic (in `record_check_in` transaction or trigger — keep atomic)
- [x] T043 [US4] Wire PatronApp passport home to `api.ts` (stamps grouped, perk progress, region card) in `app/src/patron/PatronApp.jsx`
- [x] T044 [P] [US4] No-decay invariant test `tests/integration/no-decay.test.ts`: clock-advanced patron returns with identical stamps/milestones (Art. VII)

**Checkpoint**: the identity layer is live

---

## Phase 7: User Story 5 — Discovery: founding picks and verified-regulars counters (Priority: P5)

**Goal**: curated discovery + true counters + steer-impression capture feeding the steered gate

**Independent Test**: discovery shows picks + real counters, honest empty state; surfaced→first-visit attributes as steered (SC-006; quickstart S6)

### Tests for User Story 5 (write first, must fail)

- [x] T045 [P] [US5] Contract tests for `get_discovery` (no ordering params exist — Art. I), `get_business_detail`, `record_impressions` (batch + dedup) in `tests/contract/discovery.test.ts`

### Implementation for User Story 5

- [x] T046 [US5] Migration `supabase/migrations/0009_rpc_discovery.sql`: `get_discovery` (picks + counters from views only), `get_business_detail`, `record_impressions` with per-day server dedup (R8)
- [x] T047 [US5] Wire Discover + BusinessDetail + impression batching (one call per render) in `app/src/patron/PatronApp.jsx`; honest empty-state copy per design
- [x] T048 [US5] Steer-attribution e2e `tests/e2e/steer-attribution.spec.ts` (SC-006): scripted surface→visit set asserts ≥95% attribution

**Checkpoint**: the network layer compounds; the steered gate has data

---

## Phase 8: User Story 6 — The owner's calm dashboard (Priority: P6)

**Goal**: weekly note + 4 headline stats + perk performance + activity + visit pattern; aggregates only

**Independent Test**: seeded week of activity renders the note + stats above the fold on tablet; owner sees zero cross-business data (SC-005/007; quickstart S5/S7)

### Tests for User Story 6 (write first, must fail)

- [x] T049 [P] [US6] Contract tests for `get_dashboard` + `share_weekly_note` in `tests/contract/dashboard.test.ts`

### Implementation for User Story 6

- [x] T050 [US6] Migration `supabase/migrations/0010_rpc_dashboard.sql`: `get_dashboard` RPC over owner-scoped aggregate views; weekly note composed by deterministic template from real aggregates (Art. XII — no LLM in v1)
- [x] T051 [US6] Edge function `supabase/functions/share-weekly-note/index.ts`: read-only weekly note email to co-owner (FR-030)
- [x] T052 [US6] Wire BusinessApp dashboard (note, stats with deltas, perk performance, activity feed, 14-day pattern from real data) in `app/src/business/BusinessApp.jsx`
- [x] T053 [US6] Extend `tests/integration/rls-privacy.test.ts` to every dashboard view/RPC (completes SC-005 enumeration)

**Checkpoint**: the $79 value surface is real

---

## Phase 9: User Story 7 — Admin: onboarding, curation, trust, gate dashboard (Priority: P7)

**Goal**: approvals, picks curation, rotation control, and the pre-registered experiment readings

**Independent Test**: fresh seed → all gates return values with INSUFFICIENT_SAMPLE validity; clock-advanced seed → verdict-eligibility (SC-004/010; quickstart S4/S10)

### Tests for User Story 7 (write first, must fail)

- [x] T054 [P] [US7] Contract tests for `approve_business`/`decline_business` (duplicate hints), `curate_founding_pick`, `rotate_code`, `read_gate_metrics` (shape incl. validity + verdict-eligibility), `void_stamp` (history-preserving), `list_staff_entry_audit` in `tests/contract/admin.test.ts`

### Implementation for User Story 7

- [x] T055 [US7] Migration `supabase/migrations/0011_rpc_admin.sql`: all admin RPCs above (void = status flip + reason, never delete — Art. II/XIV)
- [x] T056 [P] [US7] Migration `supabase/migrations/0012_snapshots.sql`: nightly pg_cron `gate_metric_snapshots` writer; Aug 15 / Nov 1 reads are snapshot rows (R6)
- [x] T057 [US7] Admin surface `app/src/admin/`: approvals queue (duplicate hints), picks curation per town, rotation panel, gate dashboard vs thresholds with validity labels, staff-entry audit view
- [x] T058 [US7] Gates integration test `tests/integration/gates.test.ts`: fresh-seed → INSUFFICIENT_SAMPLE everywhere, never errors (SC-004); seeded clock-advanced scenario → June 20 paying count + Aug 15 verdict-eligibility (SC-010)

**Checkpoint**: the experiment apparatus is complete — the company can score its own bet

---

## Phase 10: Polish & Cross-Cutting Concerns

- [ ] T059 [P] Brand-compliance CI check `scripts/check-brand.mjs`: no emoji codepoints in `app/src` + copy strings, no rating affordances, singular/plural helper used (SC-009)
- [ ] T060 [P] Accessibility e2e `tests/e2e/a11y.spec.ts`: axe AA pass + tap-target floors on all three surfaces (Art. IX)
- [ ] T061 [P] Docs: sync `app/README.md` (env, entries, api seam), ops runbook `docs/runbooks/season-one-ops.md` (rotation, suspension/restore, gate-read procedure, reprint flow)
- [ ] T062 Full quickstart validation pass; record outcomes in `specs/001-upper-delaware-passport/quickstart-results.md`
- [ ] T063 [P] Update `DECISIONS.md` with implementation-time decisions; capture non-obvious learnings in `docs/solutions/` (Art. XXV)
- [ ] T064 Remove the mock seam `app/src/data.js` once all screens are wired; delete dead code (Art. XXVIII)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)** → none
- **Foundational (P2)** → Setup; **blocks all stories** (schema/RLS/views/seam)
- **US1 (P3)** → Foundational only
- **US2 (P4)** → Foundational; consumes US1's business+code seed but is testable against the seeded demo business independently
- **US3 (P5)** → US2 (stamps must exist)
- **US4 (P6)** → US2
- **US5 (P7)** → US2 (counters need stamps); impressions independent
- **US6 (P8)** → US2+US3 data
- **US7 (P9)** → views from Foundational; full value after US2–US5 produce data
- **Polish (P10)** → all desired stories

### Within Each Story

Contract tests (fail first) → migrations/RPCs → edge functions → UI wiring → integration/e2e

### Parallel Opportunities

- Setup: T002–T006 all [P] after T001
- Foundational: T009/T010 [P] after T007–T008; T012/T014/T015 [P] after harness
- **US1 ∥ US2** after Foundational (different migrations/functions/UI files) — the two launch-critical stories in parallel
- Within stories: all contract-test tasks [P]; T019∥T021, T030 ∥ T029
- US3–US7 can interleave once US2 lands; US7's T054/T056 [P] early

## Parallel Example: launch-critical pair after Foundational

```bash
# Track A (US1):  T016,T017 → T018 → T019∥T020∥T021 → T022 → T023 → T024 → T025
# Track B (US2):  T026,T027 → T028 → T029∥T030 → T031∥T032 → T033 → T034 → T035
```

## Implementation Strategy

**Launch-critical MVP = Phases 1–4 (Setup, Foundational, US1, US2)** — a paying business with a live program plus the trusted check-in loop; this is exactly the June 18 vertical-slice gate. Stop, validate via quickstart S1–S3, demo. Then US3→US7 in priority order, each independently validated; Polish closes with the full quickstart pass. Commit after each task group; every checkpoint is a safe pause point (Art. XIV resumability).
