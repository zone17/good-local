-- ============================================================
-- seed.sql — Upper Delaware region, 12 towns, season one,
-- gate thresholds (discovery brief — Art. III binding), demo data
-- ============================================================

-- Region (exactly one in v1 — Art. XVI)
insert into regions (id, name, slug, timezone)
values ('00000000-0000-0000-0000-000000000001'::uuid, 'Upper Delaware', 'upper-delaware', 'America/New_York')
on conflict do nothing;

-- The 12 towns (admin data, not code)
with r as (select id from regions where slug = 'upper-delaware')
insert into towns (region_id, name, slug, display_order)
select r.id, t.name, t.slug, t.ord from r, (values
  ('Narrowsburg', 'narrowsburg', 1),
  ('Barryville', 'barryville', 2),
  ('Callicoon', 'callicoon', 3),
  ('Eldred', 'eldred', 4),
  ('Jeffersonville', 'jeffersonville', 5),
  ('Livingston Manor', 'livingston-manor', 6),
  ('Bethel', 'bethel', 7),
  ('Cochecton', 'cochecton', 8),
  ('Honesdale', 'honesdale', 9),
  ('Hawley', 'hawley', 10),
  ('Milford', 'milford', 11),
  ('Shohola', 'shohola', 12)
) as t(name, slug, ord)
on conflict do nothing;

-- Season One: launch → Oct 31, 2026 (config, not constants — Art. VII)
with r as (select id from regions where slug = 'upper-delaware')
insert into seasons (region_id, name, starts_on, ends_on, is_current)
select r.id, 'Season One', date '2026-06-30', date '2026-10-31', true from r
on conflict do nothing;

-- Regional milestones (towns visited)
with r as (select id from regions where slug = 'upper-delaware'),
     s as (select id from seasons where is_current)
insert into regional_milestones (region_id, season_id, name, kind, threshold)
select r.id, s.id, m.name, 'towns_visited', m.t from r, s, (values
  ('Four Towns', 4), ('Eight Towns', 8), ('All Twelve', 12)
) as m(name, t)
on conflict do nothing;

-- Gate thresholds — verbatim from docs/discovery/00-discovery-brief.md (Art. III:
-- changes ONLY by reviewed migration)
insert into gate_thresholds (metric, target, kill_floor, sample_floor_n, read_on) values
  ('second_business_rate_21d',    0.40, 0.20, 200,  date '2026-08-15'),
  ('same_business_repeat_rate',   null, 0.15, 200,  date '2026-08-15'),
  ('median_checkins_per_active',  null, 2.0,  200,  date '2026-08-15'),
  ('steered_first_visit_rate',    0.25, 0.10, 200,  date '2026-08-15'),
  ('passport_adds',               null, null, 500,  date '2026-07-31'),
  ('patron_signups_per_business', 30,   null, null, null),
  ('paying_business_count',       15,   10,   null, date '2026-06-20'),
  ('billing_retention_rate',      0.60, 0.40, null, date '2026-11-01')
on conflict do nothing;

-- ---------- Demo data (local/dev only — quickstart S2) ----------
-- Owner + admin auth users (local stack only). Rows are written GoTrue-valid
-- (instance_id, confirmed timestamps, empty token columns, identities) so the
-- admin API can load them and tests can set passwords via ensureSeedAuthPasswords().
insert into auth.users (
  instance_id, id, email, raw_app_meta_data, raw_user_meta_data, aud, role,
  email_confirmed_at, confirmation_token, recovery_token,
  email_change_token_new, email_change, is_sso_user, is_anonymous,
  created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000'::uuid,
   '00000000-0000-0000-0000-0000000000a1'::uuid, 'mira@theheron.test',
   '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated',
   now(), '', '', '', '', false, false, now(), now()),
  ('00000000-0000-0000-0000-000000000000'::uuid,
   '00000000-0000-0000-0000-0000000000ad'::uuid, 'admin@goodlocal.test',
   '{"provider":"email","providers":["email"],"role":"admin"}', '{}', 'authenticated', 'authenticated',
   now(), '', '', '', '', false, false, now(), now())
on conflict do nothing;

-- Email identities (GoTrue requires an identity row per email user).
insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-0000000000a1',
   '00000000-0000-0000-0000-0000000000a1'::uuid,
   '{"sub":"00000000-0000-0000-0000-0000000000a1","email":"mira@theheron.test","email_verified":true,"phone_verified":false}',
   'email', now(), now(), now()),
  ('00000000-0000-0000-0000-0000000000ad',
   '00000000-0000-0000-0000-0000000000ad'::uuid,
   '{"sub":"00000000-0000-0000-0000-0000000000ad","email":"admin@goodlocal.test","email_verified":true,"phone_verified":false}',
   'email', now(), now(), now())
on conflict do nothing;

-- The Heron — approved demo business with one active perk and a current code
with r as (select id from regions where slug = 'upper-delaware'),
     t as (select id from towns where slug = 'narrowsburg')
insert into businesses (id, region_id, town_id, owner_user_id, name, slug, category,
                        hours, owner_note, stamp_code, status, approved_at, approved_by)
select '00000000-0000-0000-0000-0000000000b1'::uuid, r.id, t.id,
       '00000000-0000-0000-0000-0000000000a1'::uuid,
       'The Heron', 'the-heron', 'restaurant',
       '{"text":"Wed-Sun 8-4"}',
       'Save your fifth for a slow afternoon. We''ll set up by the window.',
       'HRN', 'active', now(), '00000000-0000-0000-0000-0000000000ad'::uuid
from r, t
on conflict do nothing;

insert into perks (business_id, name, description, visit_threshold, kind, status)
values ('00000000-0000-0000-0000-0000000000b1'::uuid,
        'The Regular''s Pour', 'Two more visits, on the house', 5, 'status_good', 'active')
on conflict do nothing;

insert into check_in_codes (business_id, value, version, status)
values ('00000000-0000-0000-0000-0000000000b1'::uuid, 'demo-heron-code-v1', 1, 'current')
on conflict do nothing;

insert into rotation_schedules (business_id) values ('00000000-0000-0000-0000-0000000000b1'::uuid)
on conflict do nothing;
