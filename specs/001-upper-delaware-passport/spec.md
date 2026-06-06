# Feature Specification: Good Local — Season One, The Upper Delaware Passport (Holistic Project Specification)

**Feature Branch**: `001-upper-delaware-passport`

**Created**: 2026-06-06

**Status**: Draft

**Input**: User description: "Good Local season-one holistic project effort — the Upper Delaware Passport — specified from the full attestation chain: PR/FAQ (Draft v2), discovery artifacts 00–04 (adversarially verified bet, gates, and founder decisions), earnings model, vendored design system, and the ratified constitution. Standalone-first architecture; no payments processing, no shared currency, no computed discovery ranking in v1; the launch is pre-registered experiment A1."

## Authoritative Inputs — The Attestation Chain *(binding)*

This specification is derived from, and remains subordinate to, the project's attestation chain.
Where this document and an attestation conflict, the attestation governs and this spec must be
amended.

| Attestation | What it binds in this spec |
|---|---|
| `docs/prfaq-good-local.md` (Draft v2) | Product promises, pricing ($79 day-one, founding lock, $49 winter tier), passport mechanic (two loops), wallet-first/no-download posture, external FAQ commitments |
| `docs/discovery/00-discovery-brief.md` (v2, verified) | The bet, beachhead, all gate metrics/thresholds/dates, four-part kill condition, sample-adequacy rule, pre-gates (Mel ≥10 paying by Jun 20; vertical slice by ~Jun 18), trust-model voiding rule |
| `docs/discovery/01-research-synthesis.md` | Evidence base for every market number cited here (population, visits, business TAM, seasonality) |
| `docs/discovery/02-opportunity-map.md` | Mechanism selection (S2 two-loop passport now; S1 shared currency demoted; S5 DMO as 2027 channel) |
| `docs/discovery/03-assumption-tests.md` | A1–A14: what the product must instrument and what the season must answer (incl. A12 runway, A13 check-in trust, A14 perk economics) |
| `docs/discovery/04-verification-verdicts.md` | 7 verdicts + 5 gap closures + post-verification founder decisions ($79 day-one; standalone-first) — provenance for every "why" in this spec |
| `docs/earnings-model.md` | Commercial structure: ARPU blends, scenario gates, revenue lines (and the permanently excluded paid-placement line) |
| `design/README.md` + `design/SKILL.md` | Surfaces (patron mobile web ≤560px, wallet pass, dashboard ≤1320px, print kit), voice rules, visual foundations, accessibility floors |
| `.specify/memory/constitution.md` (v1.0.0) | Articles I–IX product integrity (trust, sacred check-in, experiment, standalone-first, privacy, no monetary value, seasonal honesty, canonical design, riverbank constraints) — non-negotiable |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A business sets up its own rewards program, same day (Priority: P1)

An independent business owner in the Upper Delaware region signs up, pays $79/month starting
immediately, creates their business profile, designs their first perk, prints their register QR
kit, and has a working rewards program the same day — even if no other business in the region has
joined. This is the standalone-first promise (founder decision, 04/provenance) and the revenue
engine; it must never depend on network density (Constitution Art. IV).

**Why this priority**: It is the paying product. Fifteen paying businesses completing this journey
by June 20 is the pre-registered launch pre-gate (the "Mel Test", 03/A2 — raised from signatures
to cash by the founder decision); everything else composes on top of it. Implemented alone, Good
Local is already a sellable single-business loyalty tool.

**Independent Test**: A brand-new owner can go from landing page to a live program (profile + one
published perk + printable QR kit + active billing) without assistance, with zero patrons and zero
other businesses in the system.

**Acceptance Scenarios**:

1. **Given** a new visitor on the business signup page, **When** they provide business details, owner identity, and a valid payment card, **Then** their subscription starts at $79/month (founding rate recorded), their account is created pending admin approval, and they can immediately begin program setup.
2. **Given** an approved business with a complete profile (name, town, category, hours, 3–4 letter stamp code), **When** the owner publishes a perk (name, one-line description, visit threshold 3–12, perk kind: status good / off-peak treat / small discount), **Then** the perk is live and visible to any patron who checks in at that business.
3. **Given** a business with a published perk, **When** the owner generates their register kit, **Then** they receive a print-ready page containing their current check-in code and plain-language patron instructions.
4. **Given** the perk builder is open, **When** the owner selects a perk kind, **Then** perk-design guidance is displayed (low-marginal-cost, visit-shaped, off-peak, status goods — never peak-day discounts; 04/G2 cannibalization finding).
5. **Given** an active business after October 31, **When** the owner switches to the winter tier, **Then** billing changes to $49/month and the program remains fully functional, with the founding $79 rate preserved for return to the full tier.
6. **Given** a business whose payment fails repeatedly, **When** the grace period lapses, **Then** the program is suspended (no new check-ins accepted; existing patron stamps preserved) and the owner is notified how to restore it.

---

### User Story 2 - A patron checks in and earns a stamp (Priority: P2)

A patron at a participating register scans the QR (or taps the link) and — with no app download —
joins the Upper Delaware Passport, earns a round cancellation stamp for this visit, sees their
progress toward this business's perk, and is offered their passport for Apple/Google Wallet.
Patrons who don't scan can give the register their phone number and staff logs the visit. This is
THE moment the product exists for: it must feel like a small reward and be fast enough for a busy
register line.

**Why this priority**: Every gate metric (experiment A1, 00/brief) is computed from check-ins.
Without trustworthy, delightful check-ins there is no experiment, no dashboard value, and no
renewal case. The check-in is constitutionally sacred (Art. II).

**Independent Test**: With one seeded business, a first-time patron on a phone can scan the
printed code, create their passport identity, receive stamp #1, and add the wallet pass — in under
a minute, on a weak cellular connection.

**Acceptance Scenarios**:

1. **Given** a first-time patron scanning a business's current QR code, **When** they confirm joining, **Then** a passport identity is created, one stamp for that business is recorded with date and business stamp code, and perk progress ("You're N visits from {perk}") is shown.
2. **Given** a returning patron scanning a current code, **When** the check-in is validated, **Then** exactly one stamp is added and their cumulative progress at that business and across the region updates.
3. **Given** a patron who already checked in at this business today, **When** they scan again, **Then** no second stamp is granted and the patron sees a plain, friendly explanation (one stamp per business per day).
4. **Given** a scan of a retired (rotated-out) code, **When** validation fails, **Then** the patron is told the code is out of date, the check-in is not counted toward any gate metric, and the business is flagged to reprint its kit.
5. **Given** a successful check-in, **When** the patron accepts the wallet offer, **Then** an Upper Delaware Passport pass is added to their phone's wallet showing current stamps and next perk, and the passport-add is counted (installs gate).
6. **Given** a patron who prefers not to scan, **When** staff enters the patron's phone number from the business's register screen, **Then** a stamp is recorded attributed to that staff entry (auditable), and the patron receives a one-time link to claim their passport.
7. **Given** any check-in, **When** it is recorded, **Then** it is attributable to either a validated current code or an auditable staff entry — there is no third path.

---

### User Story 3 - Perk progress and redemption at the register (Priority: P3)

A patron whose stamps reach a perk's threshold sees the perk as ready; at the register, staff
verifies and records the redemption in one step. Each business funds only the perks it offers
(02/mechanism; Art. VI).

**Why this priority**: Perks close the loyalty loop and produce the redemption-rate evidence
owners renew on (the Nov 1 retention gate). Depends on US1 + US2.

**Acceptance Scenarios**:

1. **Given** a patron one visit below a threshold, **When** they earn the next stamp at that business, **Then** the perk is marked ready on their passport and on the business's activity feed.
2. **Given** a patron with a ready perk, **When** staff confirms redemption on the business surface, **Then** the redemption is recorded (who, what, when), the perk resets per its rules, and the patron's passport reflects it.
3. **Given** an owner who edits a perk's threshold, **When** patrons have existing stamps, **Then** existing stamps carry over and the new threshold applies prospectively (no patron loses progress).
4. **Given** a perk being deactivated, **When** patrons had partial progress, **Then** their stamps remain (stamps belong to the patron-business pair, not the perk).

---

### User Story 4 - Passport home and regional progress (Priority: P4)

A patron opens their passport and sees stamps grouped by business, perk progress at each, and
season-cumulative regional progress (towns visited, region milestones) — no time decay, no streaks
(04/P3 verdict; Art. VII). Visits are weekly-ish; the passport celebrates accumulation, never
punishes absence.

**Why this priority**: The identity-and-belonging layer that makes the beachhead (weekenders,
00/brief) care. Depends on US2.

**Acceptance Scenarios**:

1. **Given** a patron with stamps at multiple businesses, **When** they open passport home, **Then** stamps render grouped per business with counts, dates, perk progress, and a region card (e.g., "4 of 12 Upper Delaware towns").
2. **Given** a patron's first check-in in a town new to them, **When** the stamp is recorded, **Then** the town counts toward regional progress and any region milestone unlocks are surfaced.
3. **Given** a patron inactive for any period, **When** they return, **Then** nothing has decayed — all stamps, perk progress, and milestones are exactly as earned.

---

### User Story 5 - Discovery: founding picks and verified-regulars counters (Priority: P5)

A patron browses participating businesses ranked for trust without algorithms: hand-curated
founding picks per town plus a live per-business "verified regulars this season" counter
(04/G1 cold-start policy). No star ratings, no paid placement, ever (Art. I). When the app
surfaces a business to a patron who later checks in there for the first time, that steer is
attributed (the steered-first-visit gate).

**Why this priority**: Discovery is the network layer that compounds on the standalone core — and
the steer attribution it generates is a launch-blocking gate input. Depends on US2.

**Acceptance Scenarios**:

1. **Given** the discovery list in season one, **When** a patron browses, **Then** businesses appear with founding-pick curation labels and true regulars counters — and no computed ranking, ratings, or paid ordering exists anywhere.
2. **Given** a business with zero regulars yet, **When** it appears in discovery, **Then** the empty state is honest ("Nobody's been a regular here yet. Be the first.") — never a fabricated number.
3. **Given** a patron is shown a business in discovery or business detail, **When** that patron later checks in there for the first time, **Then** the first visit is attributed as steered (impression → first-visit linkage) for gate computation.
4. **Given** a business detail view, **When** a patron opens it, **Then** they see the owner's note, their own progress at that business, the regulars counter, town, and hours — and can get directions.

---

### User Story 6 - The owner's calm dashboard (Priority: P6)

An owner glances at their dashboard between customers and understands, in plain language, whether
the program is working: a weekly note in person-to-person voice, repeat-visit rate, verified
regulars count, new patrons, perk performance with redemption rates, a recent activity feed, and a
14-day visit pattern. Aggregates for their own establishment only — never any patron's
cross-business history (Art. V).

**Why this priority**: This is what $79/month buys beyond the stamps (the price defense vs $25–69
stamp-card incumbents, 04/P1); it drives the ≥60% November retention gate. Depends on US2/US3 data.

**Acceptance Scenarios**:

1. **Given** a week of check-in activity, **When** the owner opens the dashboard, **Then** they see a plain-language weekly note (e.g., "28 regulars came in last week, up 6") with the four headline numbers and deltas.
2. **Given** active perks, **When** redemptions occur, **Then** perk performance shows redemptions against eligible patrons with a plain-language read on what's working.
3. **Given** any dashboard view, **When** an owner inspects a patron entry, **Then** they can see that patron's relationship with THEIR business only (visits, since-date) and never which other businesses the patron visits.
4. **Given** the activity feed, **When** stamps or redemptions occur today, **Then** they appear promptly with time, patron display name, and event type.

---

### User Story 7 - Admin: onboarding, curation, trust, and the gate dashboard (Priority: P7)

The internal team approves businesses, curates founding picks per town, manages check-in code
rotation, and reads the pre-registered experiment gates against their thresholds — because the
launch IS experiment A1 and its kill condition is read on August 15 (Art. III).

**Why this priority**: Without the gate dashboard the company cannot honestly score its own bet;
without approval/curation the trust posture fails. Depends on data from all prior stories.

**Acceptance Scenarios**:

1. **Given** a new business signup, **When** an admin reviews it, **Then** they can approve (program goes live) or decline (subscription cancelled, owner notified) with the decision recorded.
2. **Given** the founding-picks curation view, **When** an admin assigns picks per town, **Then** discovery reflects the curation immediately and shows who curated it internally.
3. **Given** the gate-metrics dashboard, **When** an admin opens it, **Then** all pre-registered metrics display against their thresholds: 2nd-business rate within 21 days (≥40% target / <20% kill), same-business repeat rate (≥15% kill floor), median check-ins per active (≥2 kill floor), steered-first-visit rate among actives (≥25% target / <10% kill), passport adds (≥500 by July 31 sample floor), patron signups per founding business (30–50 reference band), paying-business count (June 20 pre-gate read), and business billing/retention status (≥60% paying Nov 1) — each labeled valid only while the trust model holds.
4. **Given** code rotation is due for a business, **When** the schedule fires, **Then** a new code becomes current, the prior code enters its grace window then retires, and the business is prompted to print a fresh kit.

---

### Edge Cases

- **Stale printed kit**: a business hasn't reprinted after rotation + grace — patron scans must fail safely with guidance, never count toward gates, and nag the business until reprinted.
- **Same patron, multiple devices**: stamps belong to the passport identity; the per-day rate limit applies per patron per business, not per device, once devices are linked to one passport.
- **Phone-number path abuse**: staff-entered check-ins are rate-limited per business per day, attributed to the staff session, and visible in an admin audit view; anomalous volumes are flagged.
- **Billing lapse mid-season**: program suspends for new check-ins; patron stamps and perk progress are preserved and resume intact on reinstatement.
- **Perk edited or business closes**: patron stamps are never destroyed; perks specific to a closed business end; regional progress and milestones are unaffected.
- **Threshold reached exactly at rate-limit boundary**: the stamp that crosses a threshold and the perk-ready event must be atomic — no state where the stamp exists but eligibility doesn't.
- **Wallet platform unavailable** (unsupported phone/declined): the web passport is the full experience; wallet is an enhancement, never a requirement.
- **Weak connectivity at the register**: the check-in confirmation must be small and fast; if confirmation can't render, the stamp must still be durably recorded server-side once received.
- **Season boundary**: season-one counters (regulars "this season", regional progress) are season-scoped by configuration, not hard-coded dates.
- **Duplicate business signup** (same establishment twice): admin approval surfaces likely duplicates for resolution before both go live.

## Requirements *(mandatory)*

### Functional Requirements

**Accounts, identity & billing** *(sources: PR/FAQ v2 pricing; 04 founder decisions; earnings model §1–2)*

- **FR-001**: System MUST let a business owner self-serve sign up with business details, owner identity, and a payment card, starting a $79/month subscription immediately at signup.
- **FR-002**: System MUST record the founding rate on each founding subscription and honor it for the life of the account ("founding-rate lock").
- **FR-003**: System MUST offer an optional winter tier at $49/month selectable for the November–April window, reversible to the locked founding rate.
- **FR-004**: System MUST suspend a program after failed payment beyond a grace period, preserving all patron data, and restore it on successful payment.
- **FR-005**: System MUST let a patron create a passport identity with minimal friction (no app download; reachable from a register scan or the web), and link multiple devices to one passport identity.
- **FR-006**: System MUST gate newly signed-up businesses behind internal approval before they appear to patrons, while allowing program setup to proceed during review.

**Business program (standalone-first)** *(sources: 04 founder decision 2; Art. IV; design/business kit)*

- **FR-007**: System MUST provide every business a fully functional standalone rewards program — profile, perks, check-in codes, redemption, dashboard — that works with zero other businesses participating.
- **FR-008**: System MUST support a business profile with name, town, category, hours, owner's note, and a unique 3–4 letter stamp code per business.
- **FR-009**: System MUST provide a perk builder with name, one-line patron-facing description, visit threshold (3–12), and perk kind (status good / off-peak treat / small discount), surfacing perk-design guidance in the flow (A14).
- **FR-010**: System MUST allow multiple perks per business with active/inactive states; deactivation never destroys patron stamps.
- **FR-011**: Perk threshold edits MUST preserve existing patron stamp counts and apply prospectively.
- **FR-012**: System MUST generate a print-ready register kit per business containing its current check-in code and patron instructions.

**Check-in & trust model** *(sources: 04/G4; 03/A13; Art. II — every gate depends on this)*

- **FR-013**: Check-in codes MUST rotate on a configurable schedule (default: weekly) with a configurable grace window; scans of retired codes MUST be rejected with patron guidance and a reprint prompt to the business.
- **FR-014**: Every check-in MUST be validated server-side against the business's current (or in-grace) code at the moment of scan.
- **FR-015**: System MUST enforce one stamp per patron per business per day, communicated plainly when triggered.
- **FR-016**: System MUST support staff-entered phone-number check-ins from the business surface, each attributed to the entering staff session, auditable, rate-limited, and delivering the patron a one-time passport claim link.
- **FR-017**: Every recorded stamp MUST be attributable to exactly one of: a validated code scan, or an auditable staff entry.
- **FR-018**: Check-ins failing validation MUST be excluded from all gate metrics and dashboards (gates read from unverifiable check-ins are void).

**Patron passport** *(sources: PR/FAQ v2 mechanic; 04/P1 two loops; 04/P3 no streaks; design/patron kit)*

- **FR-019**: A successful check-in MUST show the patron, within one screen: the stamp earned (with business stamp code and date), progress toward that business's perk in plain language, and the wallet-add offer.
- **FR-020**: System MUST offer an Upper Delaware Passport wallet pass (Apple/Google) carrying current stamp count and next perk, updating after each check-in; the web passport MUST be a complete fallback.
- **FR-021**: Passport home MUST show stamps grouped by business (count, dates), perk progress per business, and season-cumulative regional progress (towns visited, milestones).
- **FR-022**: There MUST be no time-decay or streak mechanics anywhere; progress only accumulates within a season.
- **FR-023**: When stamps reach a perk threshold, the perk MUST become redeemable; staff MUST be able to verify and record redemption in a single action; redemptions are recorded with patron, perk, and time.

**Discovery & steer attribution** *(sources: Art. I; 04/G1 cold-start; 00/brief steered gate)*

- **FR-024**: Season-one discovery MUST present hand-curated founding picks per town and a live per-business "verified regulars this season" counter — and MUST NOT include computed rankings, star ratings, or any paid placement.
- **FR-025**: Empty discovery states MUST be honest (no fabricated counts) using the brand's empty-state copy.
- **FR-026**: System MUST record discovery/business-detail impressions per patron such that a patron's first check-in at a previously-surfaced business is attributable as a steered first visit.
- **FR-027**: Business detail MUST show the owner's note, the patron's own progress there, the regulars counter, hours/town, and directions access.

**Owner dashboard & privacy** *(sources: Art. V; PR/FAQ privacy promise; design/business kit; 04/P1 price defense)*

- **FR-028**: The dashboard MUST present: a plain-language weekly note, repeat-visit rate, verified regulars count, new patrons, perk performance (redemptions vs eligible), a recent activity feed, and a 14-day visit pattern.
- **FR-029**: Owners MUST see only aggregates and their-business-only patron relationships; no surface may reveal a patron's activity at any other business.
- **FR-030**: The weekly note MUST be shareable to a co-owner by email (read-only; no additional roles in v1).
- **FR-031**: All patron-facing and owner-facing copy MUST follow the brand voice rules: plain person-to-person language, no emoji, no all-caps beyond eyebrows, correct singular/plural forms.

**Admin & experiment gates** *(sources: Art. III; 00/brief gates; 03/A-series; this is the experiment apparatus)*

- **FR-032**: Admins MUST be able to approve/decline businesses (with duplicate detection), curate founding picks per town, and manage code rotation.
- **FR-033**: System MUST capture, from day one, events sufficient to compute: 2nd-business check-in rate within 21 days of first check-in; same-business repeat-visit rate; median check-ins per active patron; steered-first-visit rate among active (2+ check-in) patrons; passport-add counts; patron signups per founding business; paying-business count; and business billing/retention status.
- **FR-034**: An internal gate dashboard MUST display each metric against its pre-registered threshold (targets, kill floors, the July 31 ≥500-installs sample floor, n≥200 actives requirement, the June 20 paying-business pre-gate, the August 15 kill read, and the November 1 retention read), with each reading labeled valid only when derived from trust-model-compliant check-ins.
- **FR-035**: The data model MUST scope businesses, towns, picks, seasons, and milestones to a region; v1 ships exactly one region (Upper Delaware) without hard-coding the single-region assumption permanently.

**Out of scope for v1 (explicit)** *(sources: PR/FAQ v2 "NOT doing"; Art. I/VI permanence)*

- **FR-036**: System MUST NOT include: patron payments or purchases; shared currency or cross-business stamp redemption; network-funded credits; computed/algorithmic discovery ranking; native mobile apps; POS integrations; multi-region rollout; reservations/ordering/delivery; or paid placement (the last is permanent, not just v1).

### Key Entities

- **Region**: a geographic program (v1: Upper Delaware); owns towns, seasons, milestones, founding picks.
- **Town**: a named place within a region; unit of regional progress and curation.
- **Season**: a configured date window scoping counters (regulars "this season", regional progress).
- **Business**: an approved establishment — profile, town, category, hours, owner's note, unique stamp code, status (pending/active/suspended/closed).
- **Subscription**: a business's billing state — plan (founding $79 / winter $49), founding-rate lock, status, history.
- **Perk**: a business-funded reward — name, description, visit threshold, kind, active state; belongs to exactly one business.
- **Patron**: a passport identity — display name, contact (phone and/or email), linked devices; owns stamps, milestones, impressions.
- **Stamp (Check-in)**: one verified visit — patron, business, date/time, attribution (code scan with code version | staff entry with staff session), trust validity.
- **CheckInCode**: a business's rotating code — value/version, current/grace/retired state, rotation schedule.
- **StaffEntry**: an auditable staff-performed check-in record — staff session, patron phone reference, time.
- **PerkRedemption**: a recorded redemption — patron, perk, business, verifying staff, time.
- **FoundingPick**: an admin-curated discovery placement — business, town, curator, ordering.
- **SteerImpression**: a record that a business was surfaced to a patron — patron, business, surface, time; joins to first check-ins for gate attribution.
- **RegionalMilestone**: a season-scoped achievement definition (e.g., towns visited) and per-patron unlock records.
- **WalletPassInstance**: an issued wallet pass — patron, platform, serial, last-updated.
- **GateMetricSnapshot**: a computed reading of the gate metrics with thresholds and validity flags at a point in time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new business completes signup → approved → live program (profile, one published perk, printed kit, active billing) with under 30 minutes of owner effort, unassisted.
- **SC-002**: A first-time patron at a register completes scan → passport created → stamp earned → wallet offer in under 60 seconds on a typical rural cellular connection; returning-patron check-ins complete in under 10 seconds.
- **SC-003**: 100% of recorded stamps are attributable to a validated current/grace code scan or an auditable staff entry; zero stamps exist outside the trust model.
- **SC-004**: All gate metrics are computable from day-one production data with no backfill, and the internal gate dashboard displays them against the pre-registered thresholds (June 20 pre-gate; July 31 ≥500-installs sample floor; Aug 15 kill read with n≥200 actives; Nov 1 retention read) at any time.
- **SC-005**: No owner-facing surface can display any patron's activity at another business — verified by privacy review of every owner view.
- **SC-006**: A patron who is shown a business and later first-visits it is counted as steered ≥95% of the time in end-to-end tests of the attribution path.
- **SC-007**: An owner can answer "is this working?" from the dashboard in under 30 seconds — weekly note + four headline numbers visible without scrolling on a tablet.
- **SC-008**: Patron-facing pages remain usable in direct sunlight and on slow connections: AA contrast throughout and initial check-in page payload small enough to load in under 3 seconds on a 3G-class connection.
- **SC-009**: Zero emoji, star ratings, streak mechanics, or paid-placement affordances anywhere in the product — verified by content review against the brand rules.
- **SC-010**: By the gate dates, the system itself can prove the launch experiment: paying founding-business count visible against the June 20 pre-gate; the Aug 15 kill-condition read produces a definitive valid/invalid/inconclusive verdict from captured data alone; the Nov 1 retention read is computable from billing history.

## Future Scope — Explicitly Gated *(the holistic horizon; NOT in the v1 build)*

These are project-level intentions from the attestation chain, recorded here so the holistic
effort is visible and the data model can anticipate them — each is gated and MUST NOT be built
before its gate opens:

| Future capability | Gate that must open first | Source |
|---|---|---|
| In-app payments (patron purchases earn stamps automatically) | Season-one gates pass (Aug 15 + Nov 1); Phase-2 funding (A12) | PR/FAQ v2; earnings model §1 |
| Shared currency / network-funded credit | A real liability holder designed (inKind-style / DMO pool) + legal review + Constitution Art. VI amendment | 02/S-analysis; 04/P5 |
| Computed verified-regulars discovery ranking | Sufficient honest season data (replaces curated picks only when the numbers carry it) | 04/G1; Art. I |
| DMO/SCVA funded channel | Season-one data → ~Nov 2026 grant application, awarded ~Jan 2027; letter-of-support meeting only in 2026 | 04/P4 |
| Winter program (winter perks, hibernation UX) | Oct 31 season boundary; informed by A11 winter-activity reading | PR/FAQ v2; 03/A11 |
| Region #2 | A second local champion recruited + playbook documented (the "second Mel" deliverable) | 04/G3; earnings model §5 |
| Native iOS/Android apps | Wallet-pass + web evidence shows a native gap worth its cost | PR/FAQ v2; 04/P7 |

## Assumptions

- **Patron identity is lightweight**: phone number (for the staff path and recovery) and/or device-bound web identity; no passwords required of patrons. Owners use standard email-based authentication.
- **A managed card-payment provider** handles business subscriptions (charging, retries, dunning); the product never stores card numbers itself.
- **Wallet passes** are issued for both major phone platforms; where a device supports neither, the web passport is the complete experience. The wallet-vs-home-screen issuance A/B (04/P7) is resolved during the pre-launch landing test; this spec is valid under either outcome.
- **Rotation default** is weekly with a short grace window, per the printed-kit reality; the schedule is configuration, not code.
- **"Verified regular"** = a patron with 2 or more trust-valid stamps at that business within the current season (consistent across patron counters, owner dashboards, and gate metrics).
- **"Active patron"** (for gates) = 2+ trust-valid check-ins across the network within the season.
- **Season one** runs launch → October 31, 2026 for in-product seasonal counters; gate read dates (June 20, July 31, August 15, November 1) are fixed calendar dates from the discovery brief.
- **Launch date** is a target gated on build readiness (vertical slice demoable ~June 18, else July 15) — a process gate from the brief, not a product requirement.
- **English only** for v1; copy follows design/README.md voice rules.
- **The single region** ships fully configured (towns list for the Upper Delaware) via admin data, not code.
- **Existing assets**: the vendored design system (`design/`) and the frontend vertical slice (`app/` — both surfaces on a swappable mock data layer) are the starting points for the plan phase; this spec remains implementation-agnostic.
- **Legal posture** (from the verified brief; Art. VI): stamps are closed-loop, no cash value, business-funded perks only; nothing in v1 may introduce monetary value into stamps.
- **A12 (runway)** is an organizational gate — ~11 months to material revenue must be funded and the number written down — tracked in the discovery artifacts, not implemented in product.
