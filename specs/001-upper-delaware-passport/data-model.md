# Phase 1 Data Model: Good Local — Season One, The Upper Delaware Passport

**Branch**: `001-upper-delaware-passport` | **Date**: 2026-06-06 | **Plan**: [plan.md](plan.md)
| **Research**: [research.md](research.md)

> Postgres 15 (Supabase). Constitution invariants are enforced in the schema, not application
> code: CHECK constraints (Art. II/VI), RLS policies (Art. V), versioned views (Art. I/III).
> Field tables and invariant notes — not full DDL. Short SQL only where a constraint or view
> definition *is* the point.

---

## 1. Entity-Relationship Overview

```
                          regions (1 row seeded — Upper Delaware)
                             │  owns
            ┌────────────────┼───────────────┬──────────────┐
          towns           seasons      regional_milestones  founding_picks
            │ (1..n per town)               │ defn              │ (curated, per town)
            │                               │                   │
        businesses ◄────────────────────────┼───────────────────┘
            │  (status, stamp_code)          │
   ┌────────┼─────────┬──────────────┐       │
 perks  check_in_codes subscriptions │       │
   │        │ (1 current)  (Stripe)   │       │
   │        │                         │       │
   │        │        staff_entries ───┤       │
   │        │            │            │       │
   │        ▼            ▼            ▼       ▼
   │   ┌─────────────────────────────────────────┐
   │   │ stamps  (patron × business FACT)         │  attribution =
   │   │   code_version_ref XOR staff_entry_ref   │  exactly one
   │   └─────────────────────────────────────────┘
   │        ▲                ▲
   │        │                │
 perk_redemptions      milestone_unlocks ── regional_milestones
   │   (patron×perk)        (patron × milestone)
   │
 PATRON  (outside the region tree — anonymous-first identity)
   ├── patron_devices        (1..n devices → 1 patron)
   ├── stamps                (owns; see fact table above)
   ├── steer_impressions     (patron × business × surface × day)
   ├── perk_redemptions
   ├── milestone_unlocks
   └── wallet_pass_instances (patron × platform)

  gate_thresholds (seeded) ──► gate_metric_snapshots (nightly pg_cron reads of the 6 views)
```

**Reading the diagram.** The region is the root of all *program* data (towns, seasons, businesses,
milestones, picks). The **patron sits outside that tree** — a patron is a network-wide identity,
not a child of any business. **Stamps are the join** between the two worlds: a stamp is a
patron×business fact carrying its attribution. Impressions, redemptions, milestone unlocks, and
wallet passes are all patron-side facts. Gate snapshots are derived artifacts, never inputs.

---

## 2. Tables

Conventions: all PKs are `uuid default gen_random_uuid()`. All tables carry `created_at
timestamptz not null default now()`. `local_date` columns are `date` computed in the region's
timezone (`America/New_York`) at write time. Enums are Postgres `enum` types unless noted.

### 2.1 `regions` — the program root (Art. XVI)

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| name | text | not null ("Upper Delaware") |
| slug | text | not null, unique |
| timezone | text | not null, default `America/New_York` |
| stamp_code_pattern | text | not null, default `^[A-Z]{3,4}$` (validation for business codes) |

**Relationships**: parent of towns, seasons, businesses, regional_milestones, founding_picks.
**Invariants**: exactly **one row in v1** (seeded). No code hard-codes its id; scoped tables FK to
it. No cross-region queries exist in v1 (see §7).

### 2.2 `towns` — unit of regional progress & curation

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| region_id | uuid | FK regions, not null |
| name | text | not null |
| slug | text | not null |
| display_order | int | not null, default 0 |

**Invariants**: `UNIQUE (region_id, slug)`. Town list is seeded admin data, not code (spec
assumption). Regional progress = distinct towns of a patron's stamped businesses.

### 2.3 `seasons` — date window scoping all counters (Art. VII)

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| region_id | uuid | FK regions, not null |
| name | text | not null ("Season One") |
| starts_on | date | not null |
| ends_on | date | not null (2026-10-31) |
| is_current | bool | not null, default false |

**Invariants**: `CHECK (ends_on >= starts_on)`. Partial unique index guarantees one current
season per region: `CREATE UNIQUE INDEX one_current_season ON seasons (region_id) WHERE
is_current;`. Season boundary is **config, not hard-coded dates** (spec edge case). Gate read
dates (Jun 20, Jul 31, Aug 15, Nov 1) live in `gate_thresholds`, not here.

### 2.4 `businesses` — the standalone program unit

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| region_id | uuid | FK regions, not null |
| town_id | uuid | FK towns, not null |
| owner_user_id | uuid | FK auth.users, not null (owner email identity) |
| name | text | not null |
| slug | text | not null, unique (used in `/c/{slug}` URLs) |
| category | text | not null |
| hours | jsonb | not null, default `'{}'` |
| owner_note | text | nullable |
| stamp_code | text | not null — 3–4 uppercase letters |
| status | enum | not null, default `pending` (pending/active/suspended/closed) |
| approved_at | timestamptz | nullable |
| approved_by | uuid | FK auth.users, nullable (admin) |

**Relationships**: 1→n perks, check_in_codes, staff_entries; 1→1 subscription; referenced by
stamps, founding_picks, steer_impressions.
**Invariants**:
- `CHECK (stamp_code ~ '^[A-Z]{3,4}$')` (FR-008).
- `UNIQUE (region_id, stamp_code)` — stamp code unique **per region** (FR-008).
- Program setup proceeds while `status = pending`; patron-facing surfaces hide non-`active`
  businesses (FR-006). See §4 status state machine.

### 2.5 `subscriptions` — billing projection (single-writer = Stripe webhook, R4)

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| business_id | uuid | FK businesses, not null, unique (1 per business) |
| stripe_customer_id | text | not null |
| stripe_subscription_id | text | not null, unique |
| plan | enum | not null (`founding_79`, `winter_49`) |
| founding_rate | bool | not null, default true (founding-rate lock, FR-002) |
| founding_price_id | text | not null (the locked $79 Stripe price to return to) |
| status | enum | not null (trialing/active/past_due/suspended/canceled) |
| winter_tier | bool | not null, default false (windowed Nov–Apr, FR-003) |
| current_period_end | timestamptz | nullable |

**Invariants**: **Only the `stripe-webhook` edge function writes this table** (Art. XII/XV
single writer; app code never mutates it). No price/amount column is stored beyond Stripe price
IDs — dollar amounts live in Stripe (Art. VI keeps cash logic out of the product schema).
`founding_rate` is set true at signup and never flipped to false. See §4 subscription states.

### 2.6 `perks` — business-funded reward (Art. VI: NO monetary columns)

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| business_id | uuid | FK businesses, not null |
| name | text | not null |
| description | text | not null — one line, patron-facing |
| visit_threshold | int | not null — **3–12** |
| kind | enum | not null (`status_good`, `off_peak_treat`, `small_discount`) |
| status | enum | not null, default `draft` (draft/active/inactive) |

**Relationships**: 1→n perk_redemptions; n per business (FR-010).
**Invariants**:
- `CHECK (visit_threshold BETWEEN 3 AND 12)` (FR-009).
- **No `price`, `value`, `amount`, or `currency` column exists** — only descriptive text +
  threshold + kind enum (Art. VI made structurally unrepresentable; see §3).
- Deactivation never touches stamps; threshold edits apply prospectively (FR-011 — enforced in
  app logic since stamps belong to the patron×business pair, not the perk). See §4 perk states.

### 2.7 `check_in_codes` — rotating printed code (R2)

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| business_id | uuid | FK businesses, not null |
| value | text | not null — opaque random token in the QR (`?k=`) |
| version | int | not null — monotonic per business |
| status | enum | not null (`current`, `grace`, `retired`) |
| rotated_at | timestamptz | nullable |
| grace_until | timestamptz | nullable (default rotation + 72h) |

**Relationships**: referenced by `stamps.code_version_ref` (scan attribution).
**Invariants**:
- **One current code per business**: `CREATE UNIQUE INDEX one_current_code ON check_in_codes
  (business_id) WHERE status = 'current';`.
- `UNIQUE (business_id, version)`; `value` globally unique.
- Rotation by pg_cron, default weekly, configurable (FR-013). Retired-code scans are rejected
  with `CODE_RETIRED` and flag the business to reprint. See §4 code lifecycle.

### 2.8 `patrons` (+ `patron_devices`) — network-wide identity (R3)

`patrons`

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| auth_user_id | uuid | FK auth.users, unique nullable (anonymous or claimed) |
| display_name | text | nullable |
| phone | text | nullable, unique — set on claim/staff path (E.164) |
| email | text | nullable |
| claimed_at | timestamptz | nullable (anonymous → claimed transition) |
| merged_into | uuid | FK patrons, nullable (merge target; see §4) |

`patron_devices`

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| patron_id | uuid | FK patrons, not null |
| device_token | text | not null, unique |
| last_seen_at | timestamptz | not null, default now() |

**Invariants**: patron is **outside the region tree**. Anonymous-first: first scan creates a row
with `auth_user_id` = anonymous session, no phone (FR-005). Multiple devices link to one patron
(rate limit is per-patron, not per-device — spec edge case). **Merge preserves both histories**:
loser row gets `merged_into = winner.id`; its stamps/impressions/redemptions are re-pointed; the
loser row is never deleted (Art. XIV). All patron-fact queries follow `merged_into` to the canonical
row.

### 2.9 `stamps` — the sacred check-in fact (Art. II — see §3)

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| patron_id | uuid | FK patrons, not null |
| business_id | uuid | FK businesses, not null |
| season_id | uuid | FK seasons, not null |
| local_date | date | not null (region tz) |
| created_at | timestamptz | not null, default now() |
| code_version_ref | uuid | FK check_in_codes, nullable |
| staff_entry_ref | uuid | FK staff_entries, nullable |
| trust_valid | bool | not null, default true |
| voided_at | timestamptz | nullable |
| void_reason | text | nullable |

**Invariants** (the heart of Art. II):
- **Exactly one attribution** (XOR), enforced by CHECK:
  ```sql
  CONSTRAINT one_attribution CHECK (
    (code_version_ref IS NOT NULL AND staff_entry_ref IS NULL) OR
    (code_version_ref IS NULL     AND staff_entry_ref IS NOT NULL)
  )
  ```
  There is **no third path** (FR-017). A stamp with neither (or both) cannot exist.
- **1/day rate limit**: `UNIQUE (patron_id, business_id, local_date)` (FR-015). The crossing
  stamp + perk-ready computation are in one transaction (atomicity, spec edge case).
- **Never deleted** — voiding is a status flip via `voided_at` / `void_reason` (Art. II/XIV).
- `trust_valid = false` for stamps that fail the trust model; every gate view filters
  `trust_valid AND voided_at IS NULL` (FR-018).

### 2.10 `staff_entries` — auditable staff check-in path (FR-016)

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| business_id | uuid | FK businesses, not null |
| staff_user_id | uuid | FK auth.users, not null (entering staff session) |
| patron_phone | text | not null (E.164) |
| local_date | date | not null |
| claim_token | text | unique nullable (one-time passport claim link) |

**Invariants**: each entry is attributed to the staff session and is auditable (admin anomaly
view). Rate-limited per business per day (spec edge case — phone-path abuse). Referenced by exactly
the stamps it attributes via `stamps.staff_entry_ref`.

### 2.11 `perk_redemptions` — recorded redemption (FR-023)

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| patron_id | uuid | FK patrons, not null |
| perk_id | uuid | FK perks, not null |
| business_id | uuid | FK businesses, not null |
| verified_by | uuid | FK auth.users, not null (staff verifying at register) |
| redeemed_at | timestamptz | not null, default now() |

**Invariants**: records who/what/when (FR-023). No monetary column (Art. VI). Redemption requires
the patron's trust-valid stamp count at the business ≥ perk threshold (checked in the
`redeem_perk` RPC transaction).

### 2.12 `founding_picks` — admin curation (Art. I; no algorithm)

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| town_id | uuid | FK towns, not null |
| business_id | uuid | FK businesses, not null |
| curated_by | uuid | FK auth.users, not null (admin; shown internally only) |
| display_order | int | not null, default 0 |

**Invariants**: `UNIQUE (town_id, business_id)`. Discovery ordering = these rows + true counters
only — **no computed ranking, ratings, or paid placement table exists anywhere** (FR-024, Art. I,
permanent per FR-036).

### 2.13 `steer_impressions` — steer attribution capture (R8, FR-026)

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| patron_id | uuid | FK patrons, not null |
| business_id | uuid | FK businesses, not null |
| surface | enum | not null (`discovery_list`, `business_detail`) |
| local_date | date | not null |

**Invariants**: deduplicated **per patron × business × day** server-side: `UNIQUE (patron_id,
business_id, local_date)`. Steered-first-visit = an impression strictly **before** the patron's
first trust-valid stamp at that business (join in §5 view). First-party only — same identity as
stamps (≥95% fidelity, SC-006).

### 2.14 `regional_milestones` (+ `milestone_unlocks`) — season achievements

`regional_milestones` (definition)

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| region_id | uuid | FK regions, not null |
| season_id | uuid | FK seasons, not null |
| name | text | not null ("4 of 12 towns") |
| kind | enum | not null (`towns_visited`) |
| threshold | int | not null |

`milestone_unlocks` (per-patron fact)

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| patron_id | uuid | FK patrons, not null |
| milestone_id | uuid | FK regional_milestones, not null |
| unlocked_at | timestamptz | not null, default now() |

**Invariants**: `UNIQUE (patron_id, milestone_id)`. Season-scoped (Art. VII). Unlocks never decay
or reset within a season (FR-022).

### 2.15 `wallet_pass_instances` — issued wallet pass (R5, FR-020)

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| patron_id | uuid | FK patrons, not null |
| platform | enum | not null (`apple`, `google`) |
| serial | text | not null, unique |
| last_updated_at | timestamptz | not null, default now() |

**Invariants**: `UNIQUE (patron_id, platform)`. Written by the `PassIssuer` adapter. The
passport-add (first instance for a patron) is the installs-gate event. Web passport is the
complete fallback — a patron with zero rows here has the full experience.

### 2.16 `gate_thresholds` + `gate_metric_snapshots` — experiment apparatus (R6, Art. III)

`gate_thresholds` (seeded from the discovery brief; immutable except by migration)

| Field | Type | Constraints |
|---|---|---|
| metric | text | PK (`second_business_rate_21d`, etc.) |
| target | numeric | nullable (e.g., 0.40) |
| kill_floor | numeric | nullable (e.g., 0.20) |
| sample_floor_n | int | nullable (200 actives) |
| read_on | date | nullable (Jun 20 / Jul 31 / Aug 15 / Nov 1) |

`gate_metric_snapshots` (nightly pg_cron write — durable evidence)

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| metric | text | not null FK gate_thresholds |
| value | numeric | nullable |
| n | int | not null |
| validity | enum | not null (`valid`, `insufficient_sample`, `trust_invalid`) |
| taken_at | timestamptz | not null, default now() |

**Invariants**: thresholds change only by reviewed migration (Art. III no-drift). Snapshots are
append-only durable artifacts; the Aug 15 / Nov 1 reads are snapshots, not ad-hoc queries (Art.
XV). Every snapshot is computed from a §5 view that already excludes trust-invalid stamps.

---

## 3. Constitutional Constraints Made Unrepresentable

### Art. II — the check-in is sacred

| Guarantee | Mechanism |
|---|---|
| Exactly one attribution path | `stamps.one_attribution` CHECK (code XOR staff) — shown in §2.9 |
| One stamp / patron / business / day | `UNIQUE (patron_id, business_id, local_date)` |
| Stamps are never deleted | no DELETE path; `voided_at` + `void_reason` status columns only |
| Gates read only verifiable stamps | `trust_valid` flag; every §5 view filters it |

The XOR CHECK and the daily UNIQUE together make an un-attributed stamp, a double-attributed
stamp, and a second-same-day stamp **all unrepresentable** — the database refuses them.

### Art. V — privacy boundary as RLS (policy matrix)

Roles: **anon-patron** (anonymous session), **auth-patron** (claimed), **owner** (business
owner_user_id), **admin**. `—` = no access.

| Table | anon-patron | auth-patron | owner | admin |
|---|---|---|---|---|
| businesses | SELECT (active only) | SELECT (active only) | SELECT/UPDATE own | SELECT/UPDATE all |
| perks | SELECT (active only) | SELECT (active only) | SELECT/INSERT/UPDATE own biz | SELECT all |
| check_in_codes | — | — | SELECT own biz | SELECT/UPDATE all |
| patrons | SELECT/UPDATE self | SELECT/UPDATE self | — | SELECT all |
| patron_devices | SELECT/INSERT self | SELECT/INSERT self | — | SELECT all |
| stamps | SELECT own (via RPC) | SELECT own | **own-biz rows only** | SELECT all |
| staff_entries | — | — | SELECT/INSERT own biz | SELECT all |
| perk_redemptions | SELECT own | SELECT own | own-biz rows only | SELECT all |
| steer_impressions | INSERT self (RPC) | INSERT self (RPC) | — | SELECT all |
| milestone_unlocks | SELECT own | SELECT own | — | SELECT all |
| wallet_pass_instances | SELECT/UPDATE own | SELECT/UPDATE own | — | SELECT all |
| founding_picks | SELECT | SELECT | SELECT | SELECT/INSERT/UPDATE |
| subscriptions | — | — | SELECT own | SELECT all |
| gate_* | — | — | — | SELECT |

**Owner reads only rows where `business_id ∈ (their businesses)`** — never another business's
stamp, redemption, or staff entry. **Patrons read only their own rows.** Owner-facing aggregates
(repeat rate, regulars count) come **only from owner-scoped views** (§5 `verified_regulars_per_business`
filtered by RLS) — never from raw cross-business patron history. This is the structural answer to
SC-005: no owner surface *can* reveal a patron's activity at another business.

### Art. VI — no monetary value

No `price` / `value` / `amount` / `currency` column exists on `stamps` or `perks`. A perk is
**descriptive text + threshold + kind enum** only. Dollar amounts exist solely in Stripe (referenced
by price ID on `subscriptions`), never in stamp/perk logic. Cash value is structurally absent.

### Art. I — counters derive from views only

Counters are never stored as mutable columns; they are computed. The canonical per-business count:

```sql
CREATE VIEW verified_regulars_per_business AS
SELECT s.business_id, count(DISTINCT s.patron_id) AS verified_regulars
FROM stamps s
JOIN seasons se ON se.id = s.season_id AND se.is_current
WHERE s.trust_valid AND s.voided_at IS NULL
GROUP BY s.business_id, s.patron_id
HAVING count(*) >= 2;   -- 2+ trust-valid stamps, same patron, same business, current season
```

Discovery shows this real aggregate or the honest empty state ("Nobody's been a regular here
yet.") — never a fabricated number (FR-025, Art. I).

---

## 4. State Transitions

**Business status** (FR-006, FR-004)
```
 pending ──approve──► active ──suspend(billing)──► suspended ──reinstate──► active
    │                   │                                                      │
 decline             close                                                 close
    ▼                   ▼                                                      ▼
 (sub canceled)      closed ◄──────────────────────────────────────────── closed
```
`suspended` blocks new check-ins; existing stamps preserved and resume on reinstate. `closed` ends
its perks; patron stamps and regional progress are never destroyed (spec edge case).

**check_in_code lifecycle** (FR-013, one current enforced by partial unique index §2.7)
```
 current ──rotate──► grace ──(grace_until passes)──► retired
    ▲                                                    │
    └────────── new code becomes current ───────────────┘
 scan of retired → CODE_RETIRED error + reprint flag (not counted to any gate)
```

**Perk** (FR-010)
```
 draft ──publish──► active ⇄ inactive
                      (deactivate never destroys stamps; threshold edits apply prospectively)
```

**Subscription** (R4, FR-001/003/004)
```
 (none) ──checkout──► active ──payment fail──► past_due ──dunning exhausted──► suspended
                         ▲                                                        │
                         └──────────────── successful payment ─────────────────────┘
 winter_tier flag toggled within Nov–Apr window (plan winter_49 ⇄ founding_79); founding_rate
 lock preserved across toggles — return is always to the locked founding price.
```

**Patron claim / merge** (R3, FR-005)
```
 anonymous ──phone OTP claim──► claimed
 merge: loser.merged_into = winner.id; loser facts re-pointed to winner; BOTH histories preserved;
 no row deleted (Art. XIV).
```

---

## 5. Gate-Metric Views (Art. III, R6)

**Definitions used by every view** (spec assumptions, exact):
- **Active patron** = a patron with **2+ trust-valid check-ins across the network** in the current
  season.
- **Verified regular** = a patron with **2+ trust-valid stamps at one business** in the current
  season.
- Every view filters `trust_valid AND voided_at IS NULL` and joins the current season —
  trust-invalid and voided stamps are **excluded everywhere** (FR-018).

| View | Plain-English definition | Key SQL shape |
|---|---|---|
| `second_business_rate_21d` | Share of patrons who check in at a 2nd distinct business within 21 days of their first check-in. Target ≥40% / kill <20%. | per patron: `min(created_at)` first; `count(DISTINCT business_id) FILTER (where created_at <= first + interval '21 days') >= 2`; numerator/denominator over valid stamps |
| `same_business_repeat_rate` | Share of patron×business pairs with 2+ visits (repeat). Kill floor ≥15%. | `count(*) FILTER (HAVING per-pair count >= 2) / count(DISTINCT (patron,business))` over valid stamps |
| `median_checkins_per_active` | Median trust-valid check-ins among active patrons. Kill floor ≥2. | `percentile_cont(0.5) WITHIN GROUP (ORDER BY cnt)` where `cnt` is per-active-patron valid stamp count |
| `steered_first_visit_rate` | Among active patrons, share whose first visit to a business had a prior impression (steered). Target ≥25% / kill <10%. | join `steer_impressions` to each patron's first valid stamp per business: `impression.local_date < first_stamp.local_date`; restrict denominator to active patrons |
| `passport_adds_count` | Count of patrons with ≥1 wallet_pass_instance. Sample floor ≥500 by Jul 31. | `count(DISTINCT patron_id) FROM wallet_pass_instances` |
| `signups_per_founding_business` | Patron signups divided by count of founding (active) businesses. Reference band 30–50. | `count(patrons created in-season) / count(businesses WHERE status='active')` |

Plus **`paying_business_count`** read directly from `subscriptions WHERE status = 'active'` (Jun 20
pre-gate; Nov 1 ≥60% retention read) — not a stamp-derived view but part of the gate set
(FR-033/034).

`read_gate_metrics()` (admin RPC) joins each view to `gate_thresholds` and returns metric, value,
n, threshold set, validity (`valid` / `insufficient_sample` / `trust_invalid`), and verdict
eligibility. Nightly pg_cron writes `gate_metric_snapshots` for the durable Aug 15 / Nov 1 record.

---

## 6. Validation Rules (from FRs)

| Rule | Source | Enforcement |
|---|---|---|
| Perk visit threshold 3–12 | FR-009 | `CHECK (visit_threshold BETWEEN 3 AND 12)` |
| Stamp code 3–4 uppercase letters | FR-008 | `CHECK (stamp_code ~ '^[A-Z]{3,4}$')` |
| Stamp code unique per region | FR-008 | `UNIQUE (region_id, stamp_code)` |
| One stamp / patron / business / day | FR-015 | `UNIQUE (patron_id, business_id, local_date)` |
| Stamp attribution: code XOR staff | FR-017 | `one_attribution` CHECK |
| One current code per business | FR-013 | partial unique index `WHERE status='current'` |
| One current season per region | edge case | partial unique index `WHERE is_current` |
| Season dates are config | FR-035 / assumption | `seasons` rows, not constants |
| Impression dedup per patron×biz×day | R8 / FR-026 | `UNIQUE (patron_id, business_id, local_date)` |
| Rotation cadence + grace configurable | FR-013 | pg_cron schedule + `grace_until`, default weekly/72h |
| Patron phone unique (E.164) | FR-005/016 | `UNIQUE (phone)` on patrons |
| Wallet pass one per patron×platform | FR-020 | `UNIQUE (patron_id, platform)` |
| Perk threshold edits prospective | FR-011 | app logic — stamps belong to patron×business, not perk |

---

## 7. Region Scoping (Art. XVI)

**Carry `region_id` directly** (top-level region children): `towns`, `seasons`, `businesses`,
`regional_milestones`. These are the program-structure tables that a future region #2 would
duplicate.

**Inherit region via parent** (no `region_id` column — would be redundant): `perks`,
`check_in_codes`, `subscriptions`, `staff_entries` (via `business_id` → business.region_id);
`founding_picks` (via `town_id` → town.region_id); `stamps`, `perk_redemptions`,
`steer_impressions`, `milestone_unlocks` (via their business/milestone parent).

**Patron-side tables carry no region** at all — `patrons`, `patron_devices`,
`wallet_pass_instances` are network-wide identity, deliberately outside the region tree (a single
patron could one day passport across regions).

**v1 reality**: exactly **one region row seeded** (Upper Delaware). **No cross-region queries
exist in v1** — there is no routing, sharding, or multi-region join code. The single-region
assumption is *data*, not code: scoped tables FK to `regions` so a second seeded region needs no
schema change (FR-035 — single-region assumption not hard-coded permanently).

---

*Post-Phase-1 Constitution re-check: PASS — no new dependencies or surfaces; Art. I/II/V/VI
invariants are structural (CHECK/UNIQUE/RLS/views), not application-enforced.*
