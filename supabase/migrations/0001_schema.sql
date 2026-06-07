-- ============================================================
-- 0001_schema.sql — Good Local season one: all tables
-- Normative source: specs/001-upper-delaware-passport/data-model.md §2, §3, §6
-- Constitution: Art. II (XOR attribution, daily UNIQUE, no-delete),
--               Art. VI (no monetary columns), Art. XVI (region scoping)
-- ============================================================

-- ---------- Enums ----------
create type business_status     as enum ('pending', 'active', 'suspended', 'closed', 'declined');
create type subscription_plan   as enum ('founding_79', 'winter_49');
create type subscription_status as enum ('trialing', 'active', 'past_due', 'suspended', 'canceled');
create type perk_kind           as enum ('status_good', 'off_peak_treat', 'small_discount');
create type perk_status         as enum ('draft', 'active', 'inactive');
create type code_status         as enum ('current', 'grace', 'retired');
create type impression_surface  as enum ('discovery_list', 'business_detail');
create type milestone_kind      as enum ('towns_visited');
create type wallet_platform     as enum ('apple', 'google');
create type snapshot_validity   as enum ('valid', 'insufficient_sample', 'trust_invalid');

-- ---------- 2.1 regions — the program root (Art. XVI) ----------
create table regions (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  slug                text not null unique,
  timezone            text not null default 'America/New_York',
  stamp_code_pattern  text not null default '^[A-Z]{3,4}$',
  created_at          timestamptz not null default now()
);

-- ---------- 2.2 towns ----------
create table towns (
  id            uuid primary key default gen_random_uuid(),
  region_id     uuid not null references regions(id),
  name          text not null,
  slug          text not null,
  display_order int  not null default 0,
  created_at    timestamptz not null default now(),
  unique (region_id, slug)
);

-- ---------- 2.3 seasons (Art. VII — config, not constants) ----------
create table seasons (
  id         uuid primary key default gen_random_uuid(),
  region_id  uuid not null references regions(id),
  name       text not null,
  starts_on  date not null,
  ends_on    date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create unique index one_current_season on seasons (region_id) where is_current;

-- ---------- 2.4 businesses — the standalone program unit ----------
create table businesses (
  id            uuid primary key default gen_random_uuid(),
  region_id     uuid not null references regions(id),
  town_id       uuid not null references towns(id),
  owner_user_id uuid not null references auth.users(id),
  name          text not null,
  slug          text not null unique,
  category      text not null,
  hours         jsonb not null default '{}',
  owner_note    text,
  stamp_code    text not null check (stamp_code ~ '^[A-Z]{3,4}$'),
  status        business_status not null default 'pending',
  approved_at   timestamptz,
  approved_by   uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  unique (region_id, stamp_code)
);

-- ---------- 2.5 subscriptions — Stripe projection (single writer = webhook, R4) ----------
-- Art. VI note: no dollar amounts stored; Stripe price IDs only.
create table subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  business_id            uuid not null unique references businesses(id),
  stripe_customer_id     text not null,
  stripe_subscription_id text not null unique,
  plan                   subscription_plan not null,
  founding_rate          boolean not null default true,
  founding_price_id      text not null,
  status                 subscription_status not null,
  winter_tier            boolean not null default false,
  current_period_end     timestamptz,
  created_at             timestamptz not null default now()
);

-- ---------- 2.6 perks (Art. VI — descriptive text + threshold + kind ONLY) ----------
create table perks (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references businesses(id),
  name            text not null check (char_length(name) <= 60),
  description     text not null check (char_length(description) <= 120),
  visit_threshold int  not null check (visit_threshold between 3 and 12),
  kind            perk_kind not null,
  status          perk_status not null default 'draft',
  created_at      timestamptz not null default now()
);

-- ---------- 2.7 check_in_codes — rotating printed code (R2) ----------
create table check_in_codes (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id),
  value       text not null unique,
  version     int  not null,
  status      code_status not null default 'current',
  rotated_at  timestamptz,
  grace_until timestamptz,
  created_at  timestamptz not null default now(),
  unique (business_id, version)
);
create unique index one_current_code on check_in_codes (business_id) where status = 'current';

-- ---------- 2.8 patrons + patron_devices (R3 — outside the region tree) ----------
create table patrons (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id),
  display_name text,
  phone        text unique,
  email        text,
  claimed_at   timestamptz,
  merged_into  uuid references patrons(id),
  created_at   timestamptz not null default now()
);

create table patron_devices (
  id           uuid primary key default gen_random_uuid(),
  patron_id    uuid not null references patrons(id),
  device_token text not null unique,
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

-- ---------- 2.10 staff_entries (declared before stamps for the FK) ----------
create table staff_entries (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id),
  staff_user_id uuid not null references auth.users(id),
  patron_phone  text not null,
  local_date    date not null,
  claim_token   text unique,
  created_at    timestamptz not null default now()
);

-- ---------- 2.9 stamps — the sacred check-in fact (Art. II) ----------
create table stamps (
  id               uuid primary key default gen_random_uuid(),
  patron_id        uuid not null references patrons(id),
  business_id      uuid not null references businesses(id),
  season_id        uuid not null references seasons(id),
  local_date       date not null,
  created_at       timestamptz not null default now(),
  code_version_ref uuid references check_in_codes(id),
  staff_entry_ref  uuid references staff_entries(id),
  trust_valid      boolean not null default true,
  voided_at        timestamptz,
  void_reason      text,
  -- Art. II: exactly one attribution path — no third path exists (FR-017).
  constraint one_attribution check (
    (code_version_ref is not null and staff_entry_ref is null) or
    (code_version_ref is null     and staff_entry_ref is not null)
  ),
  -- FR-015: one stamp per patron per business per day.
  unique (patron_id, business_id, local_date)
);
create index stamps_business_season on stamps (business_id, season_id) where trust_valid and voided_at is null;
create index stamps_patron_season   on stamps (patron_id, season_id)   where trust_valid and voided_at is null;

-- ---------- 2.11 perk_redemptions (FR-023; Art. VI: no monetary column) ----------
create table perk_redemptions (
  id          uuid primary key default gen_random_uuid(),
  patron_id   uuid not null references patrons(id),
  perk_id     uuid not null references perks(id),
  business_id uuid not null references businesses(id),
  verified_by uuid not null references auth.users(id),
  redeemed_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

-- ---------- 2.12 founding_picks (Art. I — the only ordering that exists) ----------
create table founding_picks (
  id            uuid primary key default gen_random_uuid(),
  town_id       uuid not null references towns(id),
  business_id   uuid not null references businesses(id),
  curated_by    uuid not null references auth.users(id),
  display_order int  not null default 0,
  created_at    timestamptz not null default now(),
  unique (town_id, business_id)
);

-- ---------- 2.13 steer_impressions (R8 — first-party, deduped daily) ----------
create table steer_impressions (
  id          uuid primary key default gen_random_uuid(),
  patron_id   uuid not null references patrons(id),
  business_id uuid not null references businesses(id),
  surface     impression_surface not null,
  local_date  date not null,
  created_at  timestamptz not null default now(),
  unique (patron_id, business_id, local_date)
);

-- ---------- 2.14 regional_milestones + milestone_unlocks ----------
create table regional_milestones (
  id         uuid primary key default gen_random_uuid(),
  region_id  uuid not null references regions(id),
  season_id  uuid not null references seasons(id),
  name       text not null,
  kind       milestone_kind not null,
  threshold  int not null,
  created_at timestamptz not null default now()
);

create table milestone_unlocks (
  id           uuid primary key default gen_random_uuid(),
  patron_id    uuid not null references patrons(id),
  milestone_id uuid not null references regional_milestones(id),
  unlocked_at  timestamptz not null default now(),
  unique (patron_id, milestone_id)
);

-- ---------- 2.15 wallet_pass_instances (R5; installs-gate event) ----------
create table wallet_pass_instances (
  id              uuid primary key default gen_random_uuid(),
  patron_id       uuid not null references patrons(id),
  platform        wallet_platform not null,
  serial          text not null unique,
  last_updated_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (patron_id, platform)
);

-- ---------- 2.16 gate_thresholds + gate_metric_snapshots (Art. III) ----------
-- Thresholds are seeded from the discovery brief; changes ONLY by reviewed migration.
create table gate_thresholds (
  metric         text primary key,
  target         numeric,
  kill_floor     numeric,
  sample_floor_n int,
  read_on        date
);

create table gate_metric_snapshots (
  id        uuid primary key default gen_random_uuid(),
  metric    text not null references gate_thresholds(metric),
  value     numeric,
  n         int not null,
  validity  snapshot_validity not null,
  taken_at  timestamptz not null default now()
);

-- ---------- Rotation schedule config (FR-013 — config, not code) ----------
create table rotation_schedules (
  business_id   uuid primary key references businesses(id),
  interval_days int not null default 7  check (interval_days between 1 and 90),
  grace_hours   int not null default 72 check (grace_hours between 0 and 720)
);

-- ---------- Reprint flags (R2 — retired-code scans nag the business) ----------
create table reprint_flags (
  business_id uuid primary key references businesses(id),
  flagged_at  timestamptz not null default now(),
  cleared_at  timestamptz
);
