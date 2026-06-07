# Season One — Operations Runbook

Operational procedures for the Upper Delaware Passport (Good Local season one).
Plain operational voice. Exact commands and SQL. Every binding threshold and
metric definition lives in a migration — operators read and rotate; they do not
change thresholds without a migration and constitutional review.

Conventions:

- SQL below is run as an admin role (e.g. from Supabase Studio SQL editor or
  `psql` against the project). Admin RPCs additionally require `is_admin()` to
  be true for the calling session — they raise `FORBIDDEN` otherwise.
- "Admin UI" means `/admin`. The same actions are always callable as RPCs.

---

## 1. Code rotation

Each active business has exactly one `current` check-in code. Rotation moves the
prior code through `current → grace → retired` so a freshly printed kit and the
old printed kit both work during the grace window, then only the new one does.

### How the nightly sweep works (migration 0004)

A `pg_cron` job `rotation-sweep` runs nightly at **09:10 UTC** (04:10 region
time during EDT) and calls `rotation_sweep()`, which:

1. Retires any `grace` code whose `grace_until` has passed
   (`status = 'retired'`).
2. Rotates every active business whose `current` code is older than its
   configured interval (default 7 days), by calling `rotate_business_code()`:
   prior `current` → `grace` (with `grace_until = now() + grace_hours`,
   default 72h), and mints a new `current` with a fresh random value.

Per-business cadence lives in `rotation_schedules (interval_days, grace_hours)`.
Inspect or confirm the job:

```sql
select jobname, schedule, active from cron.job where jobname = 'rotation-sweep';
select business_id, interval_days, grace_hours from rotation_schedules;
```

Inspect a business's code lifecycle:

```sql
select c.status, c.version, c.value, c.created_at, c.grace_until
from check_in_codes c
join businesses b on b.id = c.business_id
where b.slug = '<business-slug>'
order by c.version desc;
```

### Manual rotation (admin UI or RPC)

Rotate immediately — use when a kit is wet, torn, photographed, or otherwise
compromised. Admin UI: `/admin` → rotation. RPC:

```sql
-- Rotate now; reason is required (audited). Optional schedule update.
select rotate_code(
  '<business-uuid>'::uuid,
  'kit photographed and posted publicly',          -- p_reason (required)
  '{"interval_days": 7, "grace_hours": 72}'::jsonb -- p_schedule (optional)
);
```

`rotate_code` (migration 0011) wraps `rotate_business_code`, writes a
`rotation_audit` row (actor + reason), and raises a **reprint flag** so the
owner is prompted to reprint the kit. It returns `new_version`, `grace_until`,
and the effective schedule.

### The grace window

While the old code is in `grace` and `grace_until > now()`, scans of the old
printed code still earn a stamp (the check-in path accepts `current` OR
unexpired `grace`). This covers the gap between rotation and the owner replacing
the printed kit. Once `grace_until` passes, the nightly sweep retires it and old
scans return `CODE_RETIRED` (no stamp).

To shorten or lengthen the window for one business, set `grace_hours` on the
next rotation via the `p_schedule` argument above. To retire an old code
immediately (do not wait for the sweep):

```sql
update check_in_codes
   set status = 'retired'
 where business_id = '<business-uuid>'::uuid and status = 'grace';
```

### Replacing a wet / torn kit

1. Manual-rotate with a reason (above). A new `current` is minted and a reprint
   flag is raised.
2. Have the owner reprint the register kit from `/business` (the kit page renders
   the live `current` code as a scannable QR).
3. Confirm the reprint flag clears once the new kit is in place:

```sql
select business_id, flagged_at, cleared_at from reprint_flags
where business_id = '<business-uuid>'::uuid;
```

If only the print is damaged but the code is uncompromised, the owner can simply
reprint the current code — no rotation needed.

---

## 2. Business suspension / restore

Business billing status is **webhook-driven** and single-writer: only the
`stripe-webhook` edge function writes `subscriptions` and the billing-derived
`businesses.status`. Operators inspect; they do not hand-edit these to drive
billing state.

### Webhook-driven states (migration of state lives in `_shared/stripe-webhook-core.ts`)

| Stripe event | Subscription | Business status |
|---|---|---|
| `invoice.payment_failed` (in dunning) | `past_due` | unchanged (`active`) |
| `invoice.payment_failed` (dunning exhausted) | `suspended` | `suspended` |
| `customer.subscription.updated` → `active` after suspend | `active` | restored to `active` |
| `customer.subscription.deleted` | `canceled` | `closed` |

"Dunning exhausted" = `attempt_count >= 3` or an explicit
`dunning_exhausted` flag on the event.

### What suspension blocks

A `suspended` business cannot earn new check-ins. `record_check_in` and
`staff_check_in` return `BUSINESS_SUSPENDED` (migration 0006). Existing stamps
are **preserved** (FR-004) — suspension never deletes patron history. `pending`,
`closed`, and `declined` businesses are not check-in-able and are opaque to
patrons.

### Restore

Restoration is automatic: when Stripe sends `customer.subscription.updated` with
`status = active` and the business was `suspended`, the webhook sets the business
back to `active`. The operator's job is to confirm payment recovered in Stripe;
the local state follows.

### Manual inspection

```sql
-- A business's billing + status snapshot.
select b.slug, b.status as business_status,
       s.status as subscription_status, s.plan, s.winter_tier,
       s.founding_rate, s.stripe_subscription_id
from businesses b
left join subscriptions s on s.business_id = b.id
where b.slug = '<business-slug>';

-- Everything currently suspended.
select b.slug, s.status, s.stripe_subscription_id
from businesses b join subscriptions s on s.business_id = b.id
where b.status = 'suspended';

-- Webhook idempotency: confirm an event was processed (no double-apply).
select * from processed_stripe_events where event_id = '<evt_...>';
```

If local state looks wrong relative to Stripe, the fix is to re-deliver the
authoritative Stripe event (Stripe dashboard → resend webhook) so the
single-writer path reconciles. Do not patch `subscriptions`/`businesses.status`
by hand.

---

## 3. THE GATE READS (June 20 / July 31 / Aug 15 / Nov 1)

The launch is pre-registered experiment A1 (D-007, Constitution Art. III). The
gate metrics, their thresholds, and their read dates are **binding** and live in
migrations. Reading them is an operational act; changing them is a constitutional
amendment.

### Who runs it

An admin runs `read_gate_metrics()` (admin UI `/admin` → gate dashboard, or the
RPC). It is guarded by `is_admin()` and returns one row per pre-registered
metric.

```sql
select read_gate_metrics();
```

### Where snapshots live

A nightly `pg_cron` job `gate-metric-snapshot` runs at **09:20 UTC** (after the
rotation sweep) and calls `snapshot_gate_metrics()` (migration 0012), inserting
one durable row per metric per day into `gate_metric_snapshots`. The binding
Aug 15 / Nov 1 reads are taken from these snapshot rows, not from an ad-hoc live
query (Art. XV). Crucially, `snapshot_gate_metrics()` selects from the same
`gate_metrics_evaluated()` function that `read_gate_metrics()` returns, so the
live admin read and the durable snapshot can never drift.

```sql
-- The snapshot used for a binding read on a given date.
select metric, value, n, validity, taken_at
from gate_metric_snapshots
where taken_on = date '2026-08-15'
order by metric;

-- Confirm one snapshot per metric per day exists for a date.
select metric, count(*) from gate_metric_snapshots
where taken_on = date '2026-08-15' group by metric;
```

If a snapshot for the read date is missing (the job did not run), run it
manually — it is idempotent (at most one row per metric per day):

```sql
select snapshot_gate_metrics();  -- returns count inserted; second call same day = 0
```

### The read dates

| Date | Read |
|---|---|
| June 20 | Paying-business count against its pre-gate (early signal). |
| July 31 | Sample floor — whether metrics have crossed their `sample_floor_n`. |
| Aug 15 | Verdict-eligibility read (kill condition). Taken from the snapshot. |
| Nov 1 | Retention read — computable from billing history. |

### validity and verdict_eligibility

Each metric row carries both (computed in `gate_metrics_evaluated()`,
migration 0011):

- **validity** —
  - `insufficient_sample` when `n < sample_floor_n` for the metric.
  - `valid` otherwise.
  - `trust_invalid` is reserved: the §5 views already exclude voided /
    trust-invalid stamps (FR-018), so a reading flips to `trust_invalid` only if
    a future breach-flag table marks the window contaminated. None exists yet, so
    no reading is currently computed as `trust_invalid`.
- **verdict_eligibility** — whether the metric may *score the bet* yet:
  - `INSUFFICIENT_SAMPLE` while `n < sample_floor_n`, OR while the metric's
    pre-registered `read_on` date is more than 7 days away.
  - `ELIGIBLE` only when valid AND within the read window (`read_on` is null, or
    `current_date >= read_on - 7`). The 7-day pre-window lets ops dry-run the
    binding read a week early without declaring a verdict before the registered
    date.

### The INCONCLUSIVE rule (sample floor)

A metric whose `n` has not reached its `sample_floor_n` is **never** read as a
pass or a fail — it is `insufficient_sample` / `INSUFFICIENT_SAMPLE`. The gate
verdict for that metric is INCONCLUSIVE until the floor is met. This is by
design: a small sample cannot kill or pass the bet. On a fresh seed, every
metric returns `INSUFFICIENT_SAMPLE` and `read_gate_metrics()` never errors
(SC-004).

### Constitutional constraint (Art. III)

Thresholds (`gate_thresholds`: `target`, `kill_floor`, `sample_floor_n`,
`read_on`) are seeded from the discovery brief and **change only by migration**.
Do not `UPDATE gate_thresholds` operationally. A threshold change is a
pre-registration change and requires a reviewable migration plus constitutional
sign-off. Operators read the gates; they do not move the goalposts.

---

## 4. Staff-entry anomaly review

The phone/staff attribution path (`staff_check_in`) is the second of the two
sanctioned attribution paths (Art. II). Every staff entry is auditable. Review
periodically and after any owner report of abuse.

```sql
-- All staff entries (optionally scoped to one business and/or since a time).
select list_staff_entry_audit(
  '<business-uuid>'::uuid,           -- p_business_id (null = all)
  '2026-06-01T00:00:00Z'::timestamptz -- p_since (null = all time)
);
```

Each row carries `stamp_id`, `business_id`, `staff_session`, `patron_ref`, `at`,
and `flagged_anomaly`. `flagged_anomaly` is true when more than one staff entry
exists for the same `(business, patron_phone, local_date)` — a cheap
repeat-abuse heuristic.

What to look for:

- `flagged_anomaly = true` rows: the same phone stamped multiple times in a day
  via staff entry, which the rotating-code path would have blocked by the daily
  limit. Investigate the business and, if warranted, void the surplus stamps
  (section 5).
- Bursts of staff entries from one `staff_session` in a short window.
- Staff entries concentrated at a business that should be using the QR path —
  may indicate a broken/missing kit (cross-check reprint flags, section 1).

---

## 5. `void_stamp` correction (Tier 3, history-preserving)

Voiding is the only correction for an improperly earned stamp. It is a **status
flip, never a delete** (Art. II / Art. XIV). Voided stamps stay in the table,
are excluded from all gate metrics and progress counts (FR-018), and record who
voided them and why.

```sql
-- Reason is required; the action is audited. Idempotent (re-voiding is a no-op).
select void_stamp(
  '<stamp-uuid>'::uuid,
  'duplicate staff entry — see staff audit 2026-06-12'  -- p_reason (required)
);
```

`void_stamp` (migration 0011) sets `voided_at`, `void_reason`, `voided_by`, and
`trust_valid = false`, and writes an `admin_actions` row. To find candidate
stamps, use the staff audit (section 4) or:

```sql
select id, patron_id, business_id, created_at, trust_valid, voided_at, void_reason
from stamps
where business_id = '<business-uuid>'::uuid
order by created_at desc;
```

Never `delete from stamps`. History must be reconstructable for the experiment
(Art. III) and the trust audit (Art. II).

---

## 6. Patron claim / merge support cases

Patrons start as an **anonymous** session (instant stamp #1, no account wall,
R3). Claiming a phone via OTP promotes and merges identities so a patron's
history survives across devices. Merge is history-preserving (Art. XIV): no
stamps are deleted; the loser patron is pointed at the winner via `merged_into`,
and readers follow `coalesce(merged_into, id)` to the canonical id.

Flow:

1. `claim-passport` edge fn, `{ phone }` → mints a 6-digit OTP (10-min expiry),
   delivers via Twilio if configured, else returns `dev_otp` only under the
   fail-closed dev path (`EXPOSE_DEV_OTP=1` in a non-production env).
2. `{ phone, otp }` → proxies to the `claim_passport` RPC under the **caller's**
   JWT so the merge attaches to the right anon/auth identity.

Merge rule (`claim_passport`, migration 0006): the **oldest** patron already
holding the phone is the canonical winner; the caller's current patron merges
into it (or vice versa) via `merged_into`. Devices re-point to the winner.

Common support cases:

- **"My stamps disappeared after I got a new phone."** They created a fresh
  anonymous identity on the new device. Have them claim the same phone number —
  `claim_passport` merges the new anon identity into their canonical patron and
  the history reappears. Verify:

  ```sql
  select id, phone, auth_user_id, merged_into, created_at
  from patrons where phone = '<E.164-phone>'
  order by created_at asc;   -- oldest = canonical winner
  ```

- **"OTP says invalid / expired."** OTPs are single-use and expire in 10
  minutes. Confirm and have them request a fresh one:

  ```sql
  select phone, code, created_at, expires_at, consumed_at
  from otp_codes where phone = '<E.164-phone>'
  order by created_at desc limit 5;
  ```

  `consumed_at not null` → already used; `expires_at <= now()` → expired.

- **"I have two passports."** Two anonymous identities never merged. Resolve by
  having them claim the same phone on each device, which merges them. To audit
  the canonical mapping use the `patrons` query above and confirm both rows
  resolve (via `merged_into`) to one canonical id.

- **Device linking** (`link_device`) attaches another device token to the
  current patron without a phone claim. `DEVICE_ALREADY_LINKED` means that token
  is already attached — no action needed.

Do not hand-edit `patrons.merged_into` or delete patron rows; always drive merges
through `claim_passport` so the history-preserving invariant holds.
