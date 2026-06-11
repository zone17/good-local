# Phase 1 Interface Contracts: Good Local — Season One, The Upper Delaware Passport

**Branch**: `001-upper-delaware-passport` | **Date**: 2026-06-06 | **Plan**: [../plan.md](../plan.md)

This is the public architecture of season one. Every capability the three surfaces (patron mobile
web, business dashboard, admin) use is a named domain verb here (Constitution Art. XIII — atomic
verb-first names). Nothing is UI-only (Art. XI — agent parity). Mutations are either **Postgres
RPCs** (deterministic, in-database, transactional) or **edge functions** (only where an external
secret/service is touched). Table/view definitions are normative in [../data-model.md](../data-model.md);
this file fixes the *interface* — names, request fields, response shapes, errors, risk tier,
idempotency.

---

## 1. Conventions

### 1.1 Auth contexts

Every verb declares the context(s) that may call it. Contexts are JWT-borne (Supabase Auth) and
enforced by RLS + RPC `SECURITY DEFINER` guards, never by the client.

| Context | JWT subject | How obtained | Notes |
|---|---|---|---|
| `anon-patron` | anonymous session | auto-created on first `/c/{slug}` scan (R3) | device-linked; durable identity for gates |
| `patron` | claimed patron | phone-OTP claim merges anon → patron (R3) | spans linked devices |
| `owner` | business owner | email + password (Supabase Auth) | RLS-scoped to owned business rows (Art. V) |
| `admin` | internal staff | email + password + `admin` role claim | the experiment apparatus (Art. III) |
| `service` | service-role JWT | edge functions / headless callers | bypasses RLS; used by webhooks and agents (Art. XI) |
| `webhook` | Stripe signature | `stripe-webhook` edge fn verifies sig, then acts as `service` | single writer of `subscriptions` (R4) |

**Agent parity (Art. XI):** every verb below is callable headlessly with a service or user JWT
through the same RPC/edge endpoint the UI calls. There is no capability that exists only inside a
screen. See §8.

### 1.2 Error envelope

All verbs return errors as a single machine-readable envelope. No prose-only failures.

```json
{ "error": { "code": "CODE_RETIRED", "message": "This code is out of date.", "details": { "business_slug": "the-laundry" } } }
```

- `code` — UPPER_SNAKE, stable, from the table in §7. Clients branch on `code`, never `message`.
- `message` — short, safe to log; **not** the user-facing copy (copy lives in design voice rules).
- `details?` — optional structured context for the client (e.g., retry-after, conflicting id).

Success responses return the verb's documented shape directly (no envelope wrapper).

### 1.3 Idempotency

- **RPCs that are naturally idempotent** (reads, set-state-to-X) need no key.
- **`record_check_in`** is idempotent per `(patron, business, day)` by the one-stamp-per-day rule
  (FR-015): a duplicate same-day call returns `DAILY_LIMIT`, never a second stamp.
- **Edge functions touching Stripe / pass issuance** accept an `idempotency_key` (UUID) and
  de-dupe on it; webhook events de-dupe on Stripe's `event.id` (R4 single-writer).
- **`record_impressions`** is server-side deduplicated per `patron × business × day` (R8); repeat
  calls in a day are no-ops for already-seen pairs.

### 1.4 RPC vs edge function — and why

Default is **RPC** (in-database, deterministic, RLS-aware, no extra runtime — Art. XII/XXVIII).
Edge functions are used **only where an external secret or service is involved**:

| Edge function | Why it must be an edge fn (external secret/service) |
|---|---|
| `stripe-webhook` | verifies Stripe signature; reads Stripe secret; single writer of `subscriptions` |
| `create_checkout_session` | calls Stripe API with secret key to mint a Checkout session |
| `claim-passport` (send link) | sends the one-time claim SMS/link via an external messaging provider |
| `issue_pass` / `update_pass` / `revoke_pass` | signs `.pkpass` / calls Google Wallet API with platform certs/service account (R5, behind A/B) |

Everything else — check-ins, perks, profile, curation, rotation, gate reads — is a Postgres RPC.

---

## 2. Patron capabilities

### 2.1 `record_check_in` — earn a stamp for this visit (RPC)

Purpose: validate a scanned code server-side and atomically record exactly one stamp with full
attribution (Art. II). The crossing-threshold stamp and perk-ready flag are written in one
transaction (Edge Case: atomic threshold).

Context: `anon-patron`, `patron`, `service`. Risk tier: **4** (sacred path; every gate reads it).
Idempotency: per `(patron, business, day)` — see §1.3.

| Field | Type | Required | Validation |
|---|---|---|---|
| `business_slug` | text | yes | exists; business status ∈ {active} |
| `code_value` | text | yes | matches a `current` or `grace` code for the business |
| `device_ref` | text | yes | opaque device id; links to patron session |

Response:
```json
{
  "stamp": { "id": "uuid", "business_slug": "the-laundry", "code_version": 7,
             "stamped_at": "2026-06-06T15:04:05Z", "attribution": "code_scan" },
  "perk_progress": { "perk_id": "uuid", "name": "Free coffee", "current": 4, "threshold": 6,
                     "ready": false },
  "regional_progress": { "towns_visited": 4, "towns_total": 12, "milestones_unlocked": ["uuid"] },
  "first_visit_flags": { "first_at_business": true, "first_in_town": true, "steered": true }
}
```
Errors: `CODE_RETIRED`, `CODE_INVALID`, `DAILY_LIMIT`, `BUSINESS_SUSPENDED`, `BUSINESS_NOT_FOUND`,
`UNAUTHENTICATED`.

Notes: `CODE_RETIRED` also flags the business for a reprint (R2) and the call is **excluded from
all gate metrics** (FR-018). `first_visit_flags.steered` is true iff a prior `steer_impression`
exists for this `patron × business` (R8 join).

### 2.2 `record_impressions` — log that businesses were surfaced (RPC)

Purpose: first-party capture of discovery/detail impressions so a later first visit attributes as
steered (Art. I gate input; R8). One batched call per screen render (3G budget).

Context: `anon-patron`, `patron`. Risk tier: **2**. Idempotency: per `patron × business × day`
(server dedup).

| Field | Type | Required | Validation |
|---|---|---|---|
| `business_ids` | uuid[] | yes | 1–100 ids; each exists in current region |
| `surface` | enum | yes | `discovery` \| `business_detail` |

Response: `{ "recorded": 7, "deduped": 3 }`. Errors: `UNAUTHENTICATED`, `VALIDATION`.

### 2.3 `claim_passport` — claim/merge into one identity by phone (edge fn) + `link_device` (RPC)

Purpose: phone-OTP claim turns an anonymous passport into a durable, multi-device patron identity,
merging two anon patrons history-preservingly (R3; Art. XIV). Sending the OTP/one-time link uses an
external messaging provider, so the *send* is an edge function; the *link* is an RPC.

`claim_passport(phone, otp)` — Context: `anon-patron`. Risk tier: **3**. Idempotency: per claim
flow (re-submitting a consumed OTP → `OTP_INVALID`).

| Field | Type | Required | Validation |
|---|---|---|---|
| `phone` | text (E.164) | yes | valid E.164 |
| `otp` | text | yes | 6 digits; matches issued, unexpired, unconsumed |

Response:
```json
{ "patron_id": "uuid", "merged_from": ["uuid"], "linked_devices": 2, "claimed": true }
```
Errors: `OTP_INVALID`, `OTP_EXPIRED`, `RATE_LIMITED`, `PHONE_INVALID`.

`link_device(device_ref)` — Context: `patron`. Risk tier: **2**. Adds another device to the
claimed identity. Response `{ "linked_devices": 3 }`. Errors: `UNAUTHENTICATED`, `DEVICE_ALREADY_LINKED`.

### 2.4 `get_my_passport` — passport home view (RPC, read)

Purpose: stamps grouped by business + per-business perk progress + season regional progress; no
decay, no streaks (Art. VII). Context: `anon-patron`, `patron`. Risk tier: **0**.

Response shape (view `my_passport`):
```json
{
  "patron": { "id": "uuid", "display_name": "River", "claimed": true },
  "businesses": [
    { "business_slug": "the-laundry", "stamp_code": "LDY", "name": "The Laundry", "town": "Narrowsburg",
      "stamp_count": 4, "stamp_dates": ["2026-06-01", "..."],
      "perks": [{ "perk_id": "uuid", "name": "Free coffee", "current": 4, "threshold": 6,
                  "ready": false }] }
  ],
  "region": { "towns_visited": 4, "towns_total": 12,
              "milestones": [{ "id": "uuid", "name": "Four Towns", "unlocked_at": "..." }] }
}
```
Errors: `UNAUTHENTICATED`.

### 2.5 `get_discovery` — curated picks + true-regulars counters (RPC, read)

Purpose: season-one discovery — hand-curated founding picks per town + live verified-regulars
counters. **No ordering/ranking params accepted (Art. I).** Context: `anon-patron`, `patron`,
`service`. Risk tier: **0**.

| Field | Type | Required | Validation |
|---|---|---|---|
| `town` | text | no | filter to one town; omit = all towns in region |

Explicitly **no** `sort`, `rank`, `order`, `boost`, or `promoted` field exists — the contract
forbids it. Response:
```json
{
  "towns": [
    { "town": "Narrowsburg",
      "picks": [
        { "business_slug": "the-laundry", "name": "The Laundry", "category": "cafe",
          "owner_note": "Come for the…", "regulars_this_season": 12, "curation_label": "Founding Pick" },
        { "business_slug": "new-spot", "name": "New Spot", "regulars_this_season": 0,
          "regulars_empty": true }
      ] }
  ]
}
```
`regulars_empty: true` carries the honest empty state (FR-025); the client renders brand copy, never
a fabricated number. Errors: `REGION_NOT_FOUND`.

### 2.6 `get_business_detail` — single business view (RPC, read)

Purpose: owner note, the patron's own progress there, regulars counter, town/hours, directions.
Context: `anon-patron`, `patron`, `service`. Risk tier: **0**.

| Field | Type | Required | Validation |
|---|---|---|---|
| `business_slug` | text | yes | exists; status ∈ {active} |

Response:
```json
{ "business_slug": "the-laundry", "stamp_code": "LDY", "name": "The Laundry", "town": "Narrowsburg",
  "category": "cafe", "hours": "Wed–Sun 8–4", "owner_note": "…", "directions_url": "https://…",
  "regulars_this_season": 12, "regulars_empty": false,
  "my_progress": { "stamp_count": 4, "perks": [{ "perk_id": "uuid", "current": 4, "threshold": 6 }] } }
```
Errors: `BUSINESS_NOT_FOUND`.

### 2.7 `add_wallet_pass` — record a passport add for the installs gate (RPC) *(added 2026-06-07, D-020)*

Purpose: record that this patron added the passport (web passport today; platform pass behind the
R5 A/B), writing one `wallet_pass_instances` row per `patron × platform` so the `passport_adds`
gate metric (≥500 by Jul 31 sample floor — FR-033) counts it. An RPC, not an edge fn, so the lean
check-in entry can write it over plain fetch without importing supabase-js (T032/T035, SC-008).
Implemented in migration 0006; contracted retroactively when the arch audit found it undocumented.

Context: `anon-patron`, `patron`. Risk tier: **2** (gate input). Idempotency: per
`patron × platform` — a repeat call upserts (refreshes `last_updated_at`), never a second row.

| Field | Type | Required | Validation |
|---|---|---|---|
| `platform` | enum | yes | `apple` \| `google`; any other value coerces to `google` (web passport) |

Response: `{ "serial": "uuid-text", "platform": "google" }`. Errors: `UNAUTHENTICATED`.

---

## 3. Owner capabilities

Every owner read is **RLS-scoped to the owner's own business**; this contract documents the shape,
RLS enforces the boundary (Art. V). No owner verb can return another business's rows or any patron's
cross-business activity.

### 3.1 `create_checkout_session` — signup billing handoff (edge fn)

Purpose: mint a Stripe Checkout session for the $79/mo founding price (card data never touches us,
R4). External Stripe secret → edge function. Context: `owner` (or unauthenticated signup with email
captured). Risk tier: **3**. Idempotency: `idempotency_key`.

| Field | Type | Required | Validation |
|---|---|---|---|
| `business_name` | text | yes | non-empty |
| `owner_email` | text | yes | valid email |
| `town` | text | yes | in region town list |
| `idempotency_key` | uuid | yes | de-dupe session creation |

Response: `{ "checkout_url": "https://checkout.stripe.com/…", "business_id": "uuid" }`. The business
row is created `pending` (admin approval, FR-006); billing starts at $79 with `founding_rate=true`
recorded by the webhook on completion (R4). Errors: `STRIPE_ERROR`, `VALIDATION`, `DUPLICATE_PENDING`.

### 3.2 `update_business_profile` (RPC)

Purpose: edit profile — name, town, category, hours, owner note, unique 3–4 letter stamp code.
Context: `owner`. Risk tier: **2**. Idempotency: natural (set-state).

| Field | Type | Required | Validation |
|---|---|---|---|
| `name` | text | no | non-empty |
| `town` | text | no | in region town list |
| `category` | enum | no | known category |
| `hours` | text | no | ≤120 chars |
| `owner_note` | text | no | ≤280 chars; voice rules (no emoji) |
| `stamp_code` | text | no | 3–4 letters, unique per business (FR-008) |

Response: the updated `business` row. Errors: `STAMP_CODE_TAKEN`, `VALIDATION`, `FORBIDDEN`.

### 3.3 Perk lifecycle: `publish_perk` / `update_perk` / `set_perk_active` (RPC)

Purpose: standalone perk management (FR-009/010/011). Context: `owner`. Risk tier: **2**.

`publish_perk`:

| Field | Type | Required | Validation |
|---|---|---|---|
| `name` | text | yes | non-empty, ≤60 chars |
| `description` | text | yes | one line, ≤120 chars; voice rules |
| `threshold` | int | yes | 3–12 (FR-009) |
| `kind` | enum | yes | `status_good` \| `off_peak_treat` \| `small_discount` |

Response: the created `perk`. The perk-design guidance (A14, never peak-day discounts) is
surfaced in the flow but is UI copy, not part of the response.

`update_perk(perk_id, …same fields…)` — threshold edits preserve existing stamp counts and apply
prospectively (FR-011); the response includes `applies_prospectively: true`.

`set_perk_active(perk_id, active: bool)` — deactivation never destroys patron stamps (FR-010);
stamps belong to the patron-business pair, not the perk (Edge Case). Response: updated `perk`.

Errors (all three): `PERK_NOT_FOUND`, `VALIDATION`, `FORBIDDEN`.

### 3.4 `get_register_kit` — current code + print payload (RPC, read)

Purpose: print-ready kit with the business's current code value and patron instructions (FR-012).
Context: `owner`. Risk tier: **1**.

Response:
```json
{ "business_slug": "the-laundry", "code_value": "opaque-current", "code_version": 7,
  "qr_url": "https://goodlocal.app/c/the-laundry?k=opaque-current",
  "rotates_at": "2026-06-13T00:00:00Z", "instructions": "Scan to join…",
  "reprint_needed": false }
```
`reprint_needed: true` when a rotation has occurred and the kit is stale (R2). Errors: `FORBIDDEN`.

### 3.5 `staff_check_in` — auditable phone-number check-in (RPC)

Purpose: the no-scan path — staff records a visit by patron phone; attributed to the staff session,
auditable, rate-limited; patron gets a one-time claim link (FR-016/017). Context: `owner` (staff
session). Risk tier: **4** (alternate attribution path; gate input). Idempotency: per
`(patron-phone, business, day)`.

| Field | Type | Required | Validation |
|---|---|---|---|
| `phone` | text (E.164) | yes | valid E.164 |
| `perk_acknowledged` | bool | no | optional UI ack |

Response:
```json
{ "stamp": { "id": "uuid", "attribution": "staff_entry", "staff_session": "uuid",
             "stamped_at": "…" },
  "perk_progress": { "perk_id": "uuid", "current": 3, "threshold": 6, "ready": false },
  "claim_link_sent": true }
```
Errors: `DAILY_LIMIT`, `STAFF_RATE_LIMITED`, `BUSINESS_SUSPENDED`, `PHONE_INVALID`, `FORBIDDEN`.
Sending the claim link is delegated to the `claim-passport` edge fn (external messaging).

### 3.6 `redeem_perk` — record a redemption at the register (RPC)

Purpose: staff verifies a ready perk and records the redemption (who/what/when) in one action
(FR-023). Context: `owner`. Risk tier: **3**. Idempotency: a perk already redeemed in its current
cycle returns `PERK_NOT_READY`.

| Field | Type | Required | Validation |
|---|---|---|---|
| `patron_ref` | uuid | yes | a patron with progress at this business |
| `perk_id` | uuid | yes | active perk owned by this business; patron is ready |

Response:
```json
{ "redemption": { "id": "uuid", "patron_ref": "uuid", "perk_id": "uuid",
                  "redeemed_at": "…", "verifying_staff": "uuid" },
  "perk_progress": { "current": 0, "threshold": 6, "ready": false } }
```
Errors: `PERK_NOT_READY`, `PERK_NOT_FOUND`, `FORBIDDEN`.

### 3.7 `get_dashboard` — weekly aggregates view (RPC, read)

Purpose: the calm dashboard — weekly note, four headline numbers + deltas, perk performance,
activity feed, 14-day pattern (FR-028). Aggregates for the owner's business only (Art. V).
Context: `owner`. Risk tier: **1**.

Response shape (view `owner_dashboard`):
```json
{
  "weekly_note": "28 regulars came in last week, up 6.",
  "headline": { "repeat_visit_rate": 0.42, "verified_regulars": 28, "new_patrons": 9,
                "redemptions": 5,
                "deltas": { "verified_regulars": 6, "new_patrons": 1 } },
  "perk_performance": [{ "perk_id": "uuid", "name": "Free coffee", "redemptions": 5,
                         "eligible": 12, "read": "Steady." }],
  "activity_feed": [{ "at": "…", "patron_display": "River", "event": "stamp" }],
  "visit_pattern_14d": [{ "date": "2026-05-24", "stamps": 7 }]
}
```
`patron_display` is a display name only; **no cross-business history is reachable** (FR-029,
SC-005). Errors: `FORBIDDEN`.

### 3.8 `share_weekly_note` — email the weekly note to a co-owner (RPC)

Purpose: read-only share to one co-owner email; no additional roles in v1 (FR-030). Context:
`owner`. Risk tier: **2**. Idempotency: per email per week.

| Field | Type | Required | Validation |
|---|---|---|---|
| `email` | text | yes | valid email |

Response: `{ "sent": true, "week_of": "2026-05-24" }`. Errors: `VALIDATION`, `FORBIDDEN`.

### 3.10 `get_business_regulars` — owner's regulars list (RPC, read) *(added 2026-06-06, T064)*

Purpose: the Regulars view — every patron with stamps at the owner's business, with visit count,
first/last visit, and a simple trend. Art. V holds: rows are the owner's business only; nothing
reveals a patron's activity elsewhere. Added when the mock seam was removed and the screen proved
to have no backing verb. Context: `owner` (own business), `admin`. Risk tier: **1**.

| Field | Type | Required | Validation |
|---|---|---|---|
| `business_id` | uuid | no | defaults to the caller's business; admin may pass any |

Response: `[{ "patron_ref": "uuid", "display_name": "River" | null, "visits": 7,
"since": "2026-06-01", "last_visit": "2026-06-14", "trend": "new"|"up"|"steady" }]`
(`display_name` is null for anonymous patrons — the client renders the honest fallback, never an
invented name.) Errors: `FORBIDDEN`.

### 3.9 `switch_winter_tier` / `revert_founding_rate` (edge fn: `update-subscription-plan`)

Purpose: move to the $49 winter tier (Nov–Apr window) and revert to the locked founding rate
(FR-003). Both verbs are carried by the single `update-subscription-plan` edge function (the
Stripe subscription-item swap requires the Stripe secret — §1.4); the resulting state is reflected
by the webhook (R4 single writer). *(Wording aligned to the implementation 2026-06-07, D-020 —
the original "RPC → edge" phrasing described a split that was never needed: there is no local
intent to record beyond what the webhook writes back.)*

`switch_winter_tier` — Context: `owner`. Risk tier: **3**. Idempotency: no-op if already winter.

Response: `{ "plan": "winter", "monthly": 49, "founding_rate_preserved": true }`. Errors:
`OUTSIDE_WINTER_WINDOW`, `STRIPE_ERROR`, `FORBIDDEN`.

`revert_founding_rate` — Context: `owner`. Risk tier: **3**. Response:
`{ "plan": "founding", "monthly": 79 }`. Errors: `STRIPE_ERROR`, `FORBIDDEN`.

---

## 4. Admin capabilities

The experiment apparatus (Art. III). Context: `admin` (or `service` for headless reads). All admin
mutations are recorded with the acting admin.

### 4.1 `approve_business` / `decline_business` (RPC)

Purpose: gate signups before patrons see them; declines cancel the subscription and notify
(FR-032, US7). Duplicate hints surface likely same-establishment rows (Edge Case). Context:
`admin`. Risk tier: **3**.

`approve_business`:

| Field | Type | Required | Validation |
|---|---|---|---|
| `business_id` | uuid | yes | status = `pending` |

Response: `{ "business_id": "uuid", "status": "active", "approved_by": "uuid", "approved_at": "…" }`.

`decline_business`:

| Field | Type | Required | Validation |
|---|---|---|---|
| `business_id` | uuid | yes | status = `pending` |
| `reason` | text | yes | recorded |

Response: `{ "business_id": "uuid", "status": "declined", "subscription_cancelled": true }`.
Errors: `BUSINESS_NOT_FOUND`, `INVALID_STATE`, `FORBIDDEN`.

#### `list_pending_businesses` — the pending queue + duplicate hints (RPC, read) *(promoted to a full contract entry 2026-06-07, D-020)*

Purpose: the approvals queue these two verbs act on; surfaces likely same-establishment duplicates
before both go live (Edge Case: duplicate signup). Context: `admin`. Risk tier: **1**. No params.

Response (oldest pending first):
```json
[
  { "business_id": "uuid", "name": "The Laundry", "slug": "the-laundry",
    "town": "narrowsburg", "town_name": "Narrowsburg", "category": "cafe",
    "created_at": "2026-06-07T12:00:00Z",
    "duplicate_hints": [{ "business_id": "uuid", "name": "The Laundry", "match_on": "name+town" }] }
]
```
`duplicate_hints` lists other **pending** rows matching on `name+town` (case-insensitive); empty
array when none. Errors: `FORBIDDEN`.

### 4.2 `curate_founding_pick` — set/unset/order picks per town (RPC)

Purpose: hand-curated discovery placement per town with explicit ordering; the only ordering that
exists anywhere (Art. I). Context: `admin`. Risk tier: **2**. Idempotency: natural (set-state).

| Field | Type | Required | Validation |
|---|---|---|---|
| `business_id` | uuid | yes | active business in the town |
| `town` | text | yes | in region |
| `action` | enum | yes | `set` \| `unset` \| `order` |
| `position` | int | when `action=order` | ≥1, unique per town |

Response: `{ "town": "Narrowsburg", "picks": [{ "business_id": "uuid", "position": 1,
"curated_by": "uuid" }] }`. Errors: `BUSINESS_NOT_FOUND`, `VALIDATION`, `FORBIDDEN`.

### 4.3 `rotate_code` + rotation schedule config (RPC)

Purpose: rotate a business's check-in code (new `current`, prior → `grace` → `retired`) and prompt
a reprint; also read/set the rotation schedule (FR-013, R2). pg_cron fires the scheduled rotations;
this RPC is the manual/headless verb and the schedule writer. Context: `admin`. Risk tier: **3**.

| Field | Type | Required | Validation |
|---|---|---|---|
| `business_id` | uuid | yes | active business |
| `reason` | text | yes | recorded (manual rotations are audited) |
| `schedule` | object | no | `{ interval_days: 7, grace_hours: 72 }` to update config |

Response:
```json
{ "business_id": "uuid", "new_version": 8, "grace_until": "…", "reprint_prompted": true,
  "schedule": { "interval_days": 7, "grace_hours": 72 } }
```
Errors: `BUSINESS_NOT_FOUND`, `VALIDATION`, `FORBIDDEN`.

### 4.4 `read_gate_metrics` — the pre-registered gate readings (RPC, read)

Purpose: every gate metric against its threshold, with validity + verdict-eligibility (Art. III;
R6). Context: `admin`, `service`. Risk tier: **1**. No params (reads the seeded thresholds + views).

Response: an array, one row per metric:
```json
[
  { "metric": "second_business_rate_21d", "value": 0.31, "n": 180,
    "threshold": { "target": 0.40, "kill": 0.20 }, "kill_floor": 0.20, "sample_floor": null,
    "valid": true, "verdict_eligibility": "ELIGIBLE" },
  { "metric": "passport_adds", "value": 412, "n": 412,
    "threshold": { "sample_floor": 500 }, "kill_floor": null, "sample_floor": 500,
    "valid": true, "verdict_eligibility": "INSUFFICIENT_SAMPLE" }
]
```
Metrics covered (FR-033/034): `second_business_rate_21d` (≥40% target / <20% kill),
`same_business_repeat_rate` (≥15% kill floor), `median_checkins_per_active` (≥2 kill floor),
`steered_first_visit_rate` (≥25% target / <10% kill, among 2+-check-in actives),
`passport_adds` (≥500 by Jul 31 sample floor), `patron_signups_per_business` (30–50 reference band),
`paying_business_count` (Jun 20 pre-gate), `billing_retention_rate` (≥60% Nov 1).
`verdict_eligibility` ∈ {`ELIGIBLE`, `INSUFFICIENT_SAMPLE`, `TRUST_MODEL_VOID`} — a reading is
`valid` only when derived from trust-model-compliant check-ins (FR-018). Errors: `FORBIDDEN`.

### 4.5 `list_staff_entry_audit` — staff-path audit (RPC, read)

Purpose: every staff-entered check-in for anomaly review (Edge Case: phone-path abuse). Context:
`admin`. Risk tier: **1**.

| Field | Type | Required | Validation |
|---|---|---|---|
| `business_id` | uuid | no | filter to one business |
| `since` | timestamptz | no | window start |

Response: `[{ "stamp_id": "uuid", "business_id": "uuid", "staff_session": "uuid",
"patron_ref": "uuid", "at": "…", "flagged_anomaly": false }]`. Errors: `FORBIDDEN`.

### 4.6 `void_stamp` — Tier-3 history-preserving correction (RPC)

Purpose: void a stamp without deleting it (status flip, never a delete — Art. II/XIV). Context:
`admin`. Risk tier: **3**. Idempotency: voiding an already-void stamp is a no-op.

| Field | Type | Required | Validation |
|---|---|---|---|
| `stamp_id` | uuid | yes | exists |
| `reason` | text | yes | recorded with the void |

Response: `{ "stamp_id": "uuid", "status": "void", "voided_by": "uuid", "voided_at": "…",
"reason": "…" }`. Voided stamps are excluded from gates and counters but remain in history.
Errors: `STAMP_NOT_FOUND`, `FORBIDDEN`.

---

## 5. Webhook contracts — `stripe-webhook` (edge fn)

Single writer of the `subscriptions` table and of business billing status (R4; Art. XII/XV). The
function verifies the Stripe signature, de-dupes on `event.id`, then writes. No app-code path may
write `subscriptions`. Context: `webhook` → acts as `service`. Risk tier: **4**.

| Stripe event | Resulting state write (single writer) |
|---|---|
| `checkout.session.completed` | create/activate `subscriptions` row; `plan=founding`, `founding_rate=true`, `monthly=79`; business eligible to go `active` on admin approval |
| `customer.subscription.updated` | update `plan` (founding↔winter), `status`, item/price; reflect `switch_winter_tier`/`revert_founding_rate` swaps |
| `customer.subscription.deleted` | mark subscription `cancelled`; business → `closed` (patron stamps preserved) |
| `invoice.payment_failed` | enter dunning; on grace exhaustion → business `suspended` (no new check-ins; stamps preserved — FR-004) |

On successful payment after suspension, `customer.subscription.updated` restores business to
`active`. Response to Stripe: `200 {received:true}` after a successful write; non-2xx triggers
Stripe retry (idempotent via `event.id`).

---

## 6. Views consumed read-only

Names + shapes only; definitions are normative in [../data-model.md](../data-model.md). These are
read through the RPCs above (RLS-scoped); listed here so the contract surface is complete.

| View | Consumed by | Shape (key columns) | Boundary |
|---|---|---|---|
| `owner_dashboard` | `get_dashboard` | weekly_note, headline metrics + deltas, perk_performance[], activity_feed[], visit_pattern_14d[] | RLS: owner's business only (Art. V) |
| `verified_regulars` | `get_discovery`, `get_business_detail` | business_id, town, regulars_this_season (2+ trust-valid stamps in-season), regulars_empty | public per-business counter; no patron identities |
| `my_passport` | `get_my_passport` | patron, businesses[] (stamps, dates, perks), region progress | RLS: the patron's own rows |
| gate metric views (per metric, R6) | `read_gate_metrics` | metric, value, n, threshold, validity, verdict_eligibility | admin/service only |
| `staff_entry_audit` | `list_staff_entry_audit` | stamp_id, business_id, staff_session, patron_ref, at, flagged_anomaly | admin only |
| `founding_picks` | `get_discovery` | town, business_id, position, curation_label, curated_by | curated_by internal-only |

---

## 7. Structured error code table

Every code used above, with HTTP-ish semantics. User-facing copy is **not** here — it lives in the
design voice rules; clients map `code` → copy. ("Copy pointer" names the design surface that owns it.)

| Code | HTTP-ish | Meaning | Copy pointer |
|---|---|---|---|
| `CODE_RETIRED` | 409 | scanned code is rotated-out; not counted; business flagged for reprint | patron check-in: stale-code |
| `CODE_INVALID` | 422 | code value matches no current/grace code | patron check-in: bad-code |
| `DAILY_LIMIT` | 409 | one stamp per patron per business per day already used | patron check-in: already-today |
| `BUSINESS_SUSPENDED` | 423 | business billing suspended; no new check-ins | patron check-in: paused |
| `BUSINESS_NOT_FOUND` | 404 | no business for slug/id | generic not-found |
| `REGION_NOT_FOUND` | 404 | region missing/misconfigured | generic not-found |
| `OTP_INVALID` | 422 | OTP wrong or already consumed | claim: bad-code |
| `OTP_EXPIRED` | 410 | OTP window elapsed | claim: expired |
| `PHONE_INVALID` | 422 | phone not valid E.164 | claim/staff: bad-phone |
| `DEVICE_ALREADY_LINKED` | 409 | device already on this identity | (silent / no copy) |
| `STAMP_CODE_TAKEN` | 409 | stamp code not unique for business | owner profile: code-taken |
| `PERK_NOT_FOUND` | 404 | no such perk for this business | owner: perk-missing |
| `PERK_NOT_READY` | 409 | patron not at threshold / already redeemed this cycle | owner redeem: not-ready |
| `STAFF_RATE_LIMITED` | 429 | staff-entry per-business-per-day limit hit | owner staff: rate |
| `RATE_LIMITED` | 429 | generic rate limit (OTP sends, etc.) | generic too-many |
| `OUTSIDE_WINTER_WINDOW` | 409 | winter tier not selectable outside Nov–Apr | owner billing: winter-window |
| `STRIPE_ERROR` | 502 | upstream Stripe failure | owner billing: try-again |
| `INVALID_STATE` | 409 | state transition not allowed (e.g., approve non-pending) | admin: bad-state |
| `DUPLICATE_PENDING` | 409 | a pending signup for this establishment exists | signup: duplicate |
| `STAMP_NOT_FOUND` | 404 | no such stamp to void | admin: not-found |
| `VALIDATION` | 422 | a request field failed validation (`details` lists fields) | inline field copy |
| `UNAUTHENTICATED` | 401 | no/invalid session for required context | sign-in / re-scan |
| `FORBIDDEN` | 403 | authenticated but wrong context / out-of-RLS-scope | generic forbidden |
| `SMS_UNAVAILABLE` | 503 | no SMS provider configured (503) or provider send failed (502); the OTP send path never reports `sent: true` unless a message was actually dispatched (or the dev affordance is active) | claim: texting-unavailable |

---

## 8. Agent-parity note (Art. XI)

Every verb in §§2–5 is callable headlessly: a `service`-role JWT (or the appropriate user JWT)
invokes the identical RPC / edge endpoint the UI uses — there is no capability that lives only
inside a screen, and no screen performs an unnamed mutation. Concretely:

- **Patron flows** (`record_check_in`, `record_impressions`, `claim_passport`, `link_device`,
  reads) run with an anon/claimed patron JWT — usable by tests, the check-in QR landing, or an
  external agent.
- **Owner flows** run with an owner JWT under the same RLS scope a human owner has — an agent
  cannot exceed the privacy boundary.
- **Admin flows** (approvals, curation, rotation, `read_gate_metrics`, `void_stamp`) run with an
  admin/service JWT — the gate dashboard is just a renderer over `read_gate_metrics`; the kill-read
  is reproducible headlessly.
- **Webhooks** are already headless by construction (Stripe → edge fn, single writer).

This guarantees the launch experiment (Art. III) and every operation can be exercised, audited, and
automated without the UI.

---

**Verb count: 29** — patron 8 (`record_check_in`, `record_impressions`, `claim_passport`,
`link_device`, `get_my_passport`, `get_discovery`, `get_business_detail`, `add_wallet_pass`);
owner 12 (`create_checkout_session`, `update_business_profile`, `publish_perk`, `update_perk`,
`set_perk_active`, `get_register_kit`, `staff_check_in`, `redeem_perk`, `get_dashboard`,
`share_weekly_note`, `get_business_regulars`, `switch_winter_tier`/`revert_founding_rate` counted as the tier pair);
admin 8 (`approve_business`/`decline_business`, `list_pending_businesses`, `curate_founding_pick`,
`rotate_code`, `read_gate_metrics`, `list_staff_entry_audit`, `void_stamp`); webhook 1
(`stripe-webhook`).
