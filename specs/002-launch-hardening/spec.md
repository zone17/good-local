# Feature Specification: Launch Readiness Hardening

**Feature Branch**: `002-launch-hardening`

**Created**: 2026-06-11

**Status**: Draft

**Input**: User description: "Launch readiness hardening: remediate the P0/P1 findings from docs/audits/production-readiness-2026-06-11.md before the June 30 launch — durability and telemetry, legal and trust surface, check-in resilience, revenue path correctness, pipeline and perimeter."

**Attestation chain**: subordinate to `docs/audits/production-readiness-2026-06-11.md` (finding IDs cited per requirement), `docs/prfaq-good-local.md`, `.specify/memory/constitution.md` (Arts. II, III, V, IX), and D-032. Conflicts resolve toward the constitution, then the audit evidence.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The operator can detect and survive production failures (Priority: P1)

The solo operator is alerted when the product breaks (site down, errors spiking, scheduled jobs dead, payments failing) instead of learning from an angry business owner, and the database that holds the product's entire value (append-only stamp history, binding experiment snapshots) is provably recoverable.

**Why this priority**: Three audit P0/P1 clusters (DB-001, OBS-001..004) converge here. The season-one experiment's binding reads (Aug 15, Nov 1) are unrecoverable if snapshots silently stop; the constitution makes instrumentation launch-blocking (Art. III, D-007). Everything else in this spec assumes failures are visible and data survives.

**Independent Test**: Break each monitored thing on purpose (serve an error, pause a scheduled job, take the test environment offline) and confirm the operator receives an alert through the configured channel; perform one database restore drill to a scratch environment and document it.

**Acceptance Scenarios**:

1. **Given** the live site or its backend becomes unreachable, **When** 5 minutes pass, **Then** the operator receives an alert on their phone without anyone reporting it.
2. **Given** a patron's browser throws an unhandled error on any surface, **When** it happens in production, **Then** the event is captured with enough context to debug (surface, error, correlation id) and visible to the operator within minutes.
3. **Given** the nightly code-rotation or gate-snapshot job fails or stops running, **When** the next daily check runs, **Then** the operator is alerted the same day (never discovering a gap at a binding read date).
4. **Given** the operator needs yesterday's data back, **When** they follow the documented restore procedure, **Then** a restore completes successfully (drill performed at least once before launch and recorded).
5. **Given** a marketing visitor lands on any public page, **When** they browse, sign up, or submit interest, **Then** the funnel (visits → signups → checkout) is measurable by the operator.

---

### User Story 2 - Patrons and owners meet a legally complete, honest product (Priority: P2)

Every person who gives Good Local a phone number, an email, or $79/month can read what they are agreeing to, and every promise the product makes on screen or in print is one it actually keeps.

**Why this priority**: COMP-001 (P0), COMP-002/003/005, ERR-009, UX-003/020/027, COMP-007/008. A live consumer app collecting phone numbers with no privacy policy is legal exposure today, blocks SMS provider registration, and contradicts the brand's trust-first positioning. Honesty bugs (wallet promise, fake settings, "claim link sent") damage exactly the trust the product sells.

**Independent Test**: Walk every data-collection and promise surface (claim sheet, staff entry, signup, settings, register kit, landing) as a new user and verify: a reachable privacy policy and terms, consent language at every phone entry, and zero promises the product does not deliver.

**Acceptance Scenarios**:

1. **Given** any public page, **When** a visitor looks for them, **Then** privacy policy and terms pages exist, are linked from the footer, and describe actual practice (data collected, processors, retention, deletion contact, SMS terms, no sale of personal data).
2. **Given** a patron or staff member enters a phone number, **When** the input is shown, **Then** consent language for receiving a text is present, and consent is recorded with the claim.
3. **Given** an owner signs up for the paid plan, **When** they reach payment, **Then** they have acknowledged terms covering billing, cancellation, the founding-rate lock, and the no-cash-value nature of stamps.
4. **Given** SMS sending is not yet configured, **When** a patron requests a code, **Then** they see an honest "temporarily unavailable" message (never a false "we sent it"), and no live code or full phone number is written to logs.
5. **Given** the wallet pass feature is not yet shipped, **When** a patron sees any add-to-passport control or printed card, **Then** the wording promises only what happens today; the owner settings screen shows no controls that do nothing and no placeholder personal data.
6. **Given** a patron asks for their data to be deleted or exported, **When** the operator follows the documented procedure, **Then** personal identifiers are removed/exported without destroying the append-only audit history.

---

### User Story 3 - A patron on weak signal can always finish or safely retry a check-in (Priority: P3)

A river visitor with one bar of rural cellular scans the register QR and either gets their stamp, or gets a clear message with a working "try again" — never an infinite spinner, a white screen, or a passport that looks emptied.

**Why this priority**: ERR-001 (P0), ERR-002/003/004/005. The check-in moment is the product's sacred path (US2 of spec 001: under a minute on weak signal); today it can hang forever, dead-end, or render a 12-stamp regular's passport as brand new — the worst possible trust failure for a loyalty product.

**Independent Test**: Throttle/sever the network at each step of a check-in and passport load; verify every failure produces a branded message with a retry that works, and that a deploy made mid-session never strands an open tab on a blank page.

**Acceptance Scenarios**:

1. **Given** any unexpected rendering failure anywhere in the app, **When** it occurs, **Then** the patron sees a branded "something went wrong, reload" screen — never a blank page.
2. **Given** a new version deploys while a patron has the app open, **When** their session requests now-missing assets, **Then** the app recovers automatically (at most one self-reload) instead of breaking.
3. **Given** a check-in request stalls on weak signal, **When** a bounded wait passes, **Then** the patron sees an error state with a "try again" control that retries without re-scanning the QR, and retrying never produces a duplicate stamp.
4. **Given** a returning patron's passport fails to load, **When** the screen renders, **Then** it says their stamps are safe and offers retry — it never shows the brand-new empty state.
5. **Given** a patron mistypes or exhausts their text-code attempts, **When** they are rate-limited or locked out, **Then** the message says to wait and request a fresh code (never "try again" advice that deepens the lockout), and a resend control exists.

---

### User Story 4 - A business owner can pay, recover, and trust the billing surface (Priority: P4)

An owner can sign up and pay without a transient failure stranding them, always sees the true state of their application and plan, and every success message on a money or messaging flow reflects something that actually happened.

**Why this priority**: ERR-010/011/012 (silent false-success on revenue and messaging flows), API-001/002, UX-016/017/018, TEST-001. These are live bugs on the path that produces the June 20 gate evidence (10+ paying founding businesses) and the $79/mo relationship the whole model rests on.

**Independent Test**: Drive the signup → payment → approval → plan-switch → weekly-note journey including induced failures (payment abort, network drop, retry) and verify every outcome message is true, every dead end has a recovery path, and the billing flows have automated test coverage.

**Acceptance Scenarios**:

1. **Given** a payment step fails or is abandoned mid-signup, **When** the owner retries, **Then** the retry succeeds (no orphaned half-signup blocking them) and an abandoned payment returns them to a clear "pick up where you left off" state.
2. **Given** an owner has paid and awaits approval, **When** they return to their dashboard, **Then** they see an explicit "in review" state with what to expect and what they can do now — never a live-looking empty dashboard.
3. **Given** an owner switches to the winter plan, **When** the underlying billing change fails, **Then** they see a failure message (never a success while billing continues at the old rate).
4. **Given** an owner shares their weekly note with a co-owner, **When** the product says "sent", **Then** an email was actually delivered.
5. **Given** an owner forgets their password, **When** they use the recovery flow, **Then** they regain access without contacting support.
6. **Given** any distinguishable failure on these flows, **When** it is shown to the owner, **Then** the message is the specific one designed for that failure (the error-code contract reaches the screen), not a generic fallback or raw internals.

---

### User Story 5 - A release cannot silently degrade production (Priority: P5)

Code that fails checks cannot reach the live product; database changes deploy in lockstep with the application; known classes of vulnerability and leaked credentials are caught automatically; and the delivery perimeter (headers, caching, abuse limits) protects users by default.

**Why this priority**: CICD-001/002/003, SEC-001/002, PERF-001/002/015, INFRA-002. Today the deploy path ships in parallel with CI rather than after it, schema deploys are manual with a known footgun, and a public repo handling payments has zero security automation. This story converts the audit's one-time fixes into standing guarantees.

**Independent Test**: Open a deliberately failing change and confirm it cannot merge/deploy; land a database change and confirm it deploys with the app without manual steps; introduce a known-vulnerable dependency or a secret-shaped string and confirm automation flags it; verify response headers and abuse limits from the live site.

**Acceptance Scenarios**:

1. **Given** a change with failing checks, **When** someone attempts to land it, **Then** the platform refuses (protection is server-side, not a local convention).
2. **Given** a change containing database migrations, **When** it lands, **Then** schema and application deploy together and the API layer recognizes new structures immediately.
3. **Given** a dependency with a known critical vulnerability or a committed secret-shaped string, **When** checks run, **Then** the problem is flagged before merge; previously exposed credentials have been rotated.
4. **Given** any page load, **When** responses are inspected, **Then** content-security and anti-framing protections are present, and static assets are cached so repeat visits on slow connections don't re-download unchanged files.
5. **Given** text-message sending becomes enabled, **When** an abuser scripts code requests across many phone numbers, **Then** per-source and global limits cap the spend; the limits exist before sending is switched on.
6. **Given** rising visit volume at a popular business, **When** check-ins and dashboards are used, **Then** the hot lookups remain fast (the known unindexed paths are indexed).

---

### Edge Cases

- SMS provider is enabled before the consent language ships → sequencing constraint: FR-010/FR-024 MUST land first (this is the audit's "activates the moment Twilio lands" trap).
- Live payment keys are set before terms exist → sequencing constraint: FR-011 lands before Stripe live cutover.
- A retry after a *successful-but-unacknowledged* check-in or payment must be idempotent (no duplicate stamp, no double charge).
- A deploy occurs during an in-flight check-in → recovery must not lose the already-committed stamp.
- The deadman alert channel itself fails (alert fatigue or mis-routing) → weekly manual verification step in the runbook backstops it.
- A patron requests deletion while holding redeemed perks → anonymize identifiers, preserve the audit rows (Art. II compatibility).
- Restore drill must not touch production data (scratch environment only).

## Requirements *(mandatory)*

### Functional Requirements

**Durability & telemetry (US1)**
- **FR-001**: The production database MUST have verified automated backups with point-in-time recovery, a documented restore procedure, and one completed restore drill before launch. *(DB-001, INFRA-003)*
- **FR-002**: Unhandled errors on any user surface and in server-side functions MUST be captured centrally with surface, release, and correlation context, with no personal data in the events. *(OBS-001, SEC-003)*
- **FR-003**: The operator MUST be alerted within 5 minutes when the public site or its backend stops answering. *(OBS-003)*
- **FR-004**: A daily automated check MUST verify the scheduled rotation and gate-snapshot jobs ran successfully and alert the operator on any failure or staleness. *(OBS-002, DB-004)*
- **FR-005**: Public-surface traffic and the signup funnel (visit → signup start → payment complete) MUST be measurable without tracking that requires a consent banner. *(OBS-004)*

**Legal & trust surface (US2)**
- **FR-006**: Privacy policy and terms pages MUST exist, be linked from every public footer and every data-collection point, and accurately describe collection, processors, retention, deletion contact, and SMS terms. *(COMP-001, COMP-002)*
- **FR-007**: Both phone-entry points MUST present text-message consent language, and consent MUST be recorded with timestamp and source. *(COMP-003)*
- **FR-008**: Owner signup MUST include terms acknowledgment before payment. *(COMP-002)*
- **FR-009**: When no SMS provider is configured, code requests MUST return an honest unavailable state; logs MUST never contain a live code or unmasked phone number. *(ERR-009, COMP-004)*
- **FR-010**: Expired/consumed verification codes MUST be purged on a schedule; a documented retention policy MUST cover all personal-data fields. *(DB-002, COMP-006)*
- **FR-011**: All product promises MUST match delivered behavior: passport-add wording (on-screen and printed kit), staff "claim link" messaging, owner settings showing only functional controls with no placeholder data, and same-day-setup wording aligned to the approval reality. *(UX-003, COMP-008, UX-027/COMP-007, UX-020)*
- **FR-012**: A documented procedure MUST exist to export or anonymize a person's identifiers on request without destroying append-only audit history. *(COMP-005)*

**Check-in resilience (US3)**
- **FR-013**: Every surface MUST be wrapped in a recovery boundary showing a branded retry/reload state; asset-missing failures after a deploy MUST self-recover at most once automatically. *(ERR-001, ERR-002)*
- **FR-014**: All check-in path requests MUST have a bounded wait and a user-visible retry that is safe against duplicates. *(ERR-003, ERR-004)*
- **FR-015**: A failed passport load MUST be visually and verbally distinct from an empty passport and MUST offer retry. *(ERR-005)*
- **FR-016**: Rate-limited or locked-out code attempts MUST show wait guidance and a resend control (with cooldown), never advice to retry immediately. *(ERR-008, UX-006)*

**Revenue path correctness (US4)**
- **FR-017**: Signup MUST be idempotent across failures: a failed or abandoned payment leaves no orphaned application; retry resumes or recreates cleanly; duplicate submissions with the same idempotency reference return the original outcome. *(ERR-010, API-002, UX-018, ERR-022)*
- **FR-018**: A paid-but-unapproved owner MUST see an explicit in-review state on every return visit until approved. *(UX-016)*
- **FR-019**: Plan changes MUST report success only when the billing change actually occurred. *(ERR-011)*
- **FR-020**: The weekly-note share MUST deliver the email it claims to send. *(ERR-012, API-003)*
- **FR-021**: Owners and admins MUST have a self-service password recovery flow. *(UX-017)*
- **FR-022**: Every contracted error code MUST reach the user interface so each distinguishable failure shows its designed message; raw internal messages MUST never render. *(API-001, ERR-014)*
- **FR-023**: The payment-related server functions MUST have automated test coverage including failure paths. *(TEST-001, TEST-002)*

**Pipeline & perimeter (US5)**
- **FR-024**: Before SMS sending is enabled, code-request abuse limits MUST exist per source and globally, with the public form similarly protected against scripted submissions. *(SEC-002, API-004, SEC-004)*
- **FR-025**: The default branch MUST be protected so changes land only through passing checks; production deploys MUST follow CI, not race it. *(CICD-001)*
- **FR-026**: Database and server-function changes MUST deploy automatically and in order with the application, including the API schema reload step. *(CICD-002)*
- **FR-027**: Dependency vulnerability scanning, static analysis, and secret detection MUST run automatically on every change; the previously exposed credentials MUST be rotated. *(CICD-003, INFRA-002, INFRA-006)*
- **FR-028**: Responses MUST carry content-security, anti-framing, content-type, and referrer protections; hashed static assets MUST be cached immutably. *(SEC-001, PERF-015)*
- **FR-029**: The known unindexed hot lookups (perk progress, staff rate-limit, device resolution) MUST be indexed. *(PERF-001/002/003/004, DB-007)*

### Key Entities

- **Consent record**: who agreed to receive texts, when, and at which surface (patron claim vs staff entry); attached to the patron identity.
- **Signup idempotency reference**: links a signup attempt to its outcome so retries resume rather than duplicate; carries the recovery state for abandoned payments.
- **Alert**: a routed notification (site down, job stale, error spike) with the condition, time, and acknowledgment trail in the operator's channel.
- **Retention rule**: per data-class lifetime (verification codes, staff-entered phones, leads) and the action at expiry (purge vs anonymize).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Operator learns of a full-site outage within 5 minutes, and of a dead scheduled job within 24 hours — verified by induced-failure drills, not assumption.
- **SC-002**: One database restore drill completed and documented before launch day; recovery point objective stated in the runbook.
- **SC-003**: 100% of phone-collection and payment surfaces display consent/terms; the SMS provider's campaign registration is accepted on first submission.
- **SC-004**: Zero user-visible states that report success for an action that did not happen (verified by walking the winter-switch, weekly-note, claim-link, and wallet-add flows).
- **SC-005**: Under a simulated 60-second network stall, a check-in attempt resolves to a retryable message in ≤15 seconds, and a subsequent retry succeeds without a duplicate stamp.
- **SC-006**: A deliberately failing change cannot reach production (verified by attempting one).
- **SC-007**: Every distinguishable failure on signup, redemption, staff check-in, and plan-change shows its specific designed message (spot-check of at least 8 contract error codes end to end).
- **SC-008**: Repeat visits on a slow connection re-download zero unchanged static assets (verified by cache headers on hashed assets).
- **SC-009**: All ~45 unique P1 findings from the 2026-06-11 audit are closed or explicitly deferred with rationale recorded in the audit document.

## Assumptions

- The hosted database will be on a paid tier with backups/PITR available (FR-001 verifies; if already adequate, the drill still happens).
- Privacy policy and terms content is drafted in-house from actual practice for season one; formal counsel review remains the separate pre-existing track (COMP-009) and is not blocked by this feature.
- The wallet-pass *feature* itself stays deferred; this feature only aligns the promises (real pass issuance is a future spec).
- Free-tier third-party services (error tracking, uptime, analytics) are acceptable for season-one volume; no consent banner is required because chosen analytics are cookieless.
- A full staging environment (INFRA-001) is deliberately out of scope here — it is Wave 3 in the audit roadmap; preview deploys remain build-checks only.
- P2/P3 audit findings are out of scope unless they ride along trivially with a P1 fix; they remain tracked in the audit backlog.
- Credential rotation (Stripe test key, Cloudflare tokens) is an operator action recorded in the runbook; this spec requires it as a gate (FR-027) but cannot perform it.
