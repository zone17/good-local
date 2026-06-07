-- ============================================================
-- 0003_views.sql — counters + gate-metric views
-- Normative source: data-model.md §5; spec FR-033/034; Art. I/III
-- Every view filters trust_valid AND voided_at IS NULL and joins
-- the current season — trust-invalid stamps are excluded everywhere.
-- Definitions change ONLY by reviewed migration (Art. III no-drift).
--
-- SECURITY (review P1-5): every view is `security_invoker = true` so a direct
-- PostgREST read runs under the CALLER's RLS (owner sees own-business rows,
-- patron sees own rows, anon sees nothing) instead of the view owner's
-- privileges. Trusted readers are unaffected: the SECURITY DEFINER RPCs run
-- as the table owner (RLS-exempt) and service_role has BYPASSRLS.
-- ============================================================

-- ---------- Building blocks ----------

-- Trust-valid, non-voided stamps in the current season.
create view valid_stamps with (security_invoker = true) as
select s.*
from stamps s
join seasons se on se.id = s.season_id and se.is_current
where s.trust_valid and s.voided_at is null;

-- Active patron = 2+ trust-valid check-ins across the network, current season.
create view active_patrons with (security_invoker = true) as
select patron_id, count(*) as checkins
from valid_stamps
group by patron_id
having count(*) >= 2;

-- ---------- Art. I: the canonical counter ----------
-- Verified regular = 2+ trust-valid stamps, same patron, same business, current season.
create view verified_regulars_per_business with (security_invoker = true) as
select business_id, count(*) as verified_regulars
from (
  select business_id, patron_id
  from valid_stamps
  group by business_id, patron_id
  having count(*) >= 2
) pairs
group by business_id;

-- ---------- Gate views (uniform shape: metric, value, n) ----------

-- G1: share of patrons who reach a 2nd distinct business within 21 days of first check-in.
create view gate_second_business_rate_21d with (security_invoker = true) as
with firsts as (
  select patron_id, min(created_at) as first_at
  from valid_stamps group by patron_id
),
reached as (
  select f.patron_id
  from firsts f
  join valid_stamps s on s.patron_id = f.patron_id
                     and s.created_at <= f.first_at + interval '21 days'
  group by f.patron_id
  having count(distinct s.business_id) >= 2
)
select 'second_business_rate_21d'::text as metric,
       case when count(f.*) = 0 then null
            else round(count(r.*)::numeric / count(f.*), 4) end as value,
       count(f.*)::int as n
from firsts f left join reached r on r.patron_id = f.patron_id;

-- G2: share of patron×business pairs with 2+ visits (depth / collection-toy detector).
create view gate_same_business_repeat_rate with (security_invoker = true) as
with pairs as (
  select patron_id, business_id, count(*) as visits
  from valid_stamps group by patron_id, business_id
)
select 'same_business_repeat_rate'::text as metric,
       case when count(*) = 0 then null
            else round(count(*) filter (where visits >= 2)::numeric / count(*), 4) end as value,
       count(*)::int as n
from pairs;

-- G3: median trust-valid check-ins among active patrons (depth floor ≥2).
create view gate_median_checkins_per_active with (security_invoker = true) as
select 'median_checkins_per_active'::text as metric,
       percentile_cont(0.5) within group (order by checkins)::numeric as value,
       count(*)::int as n
from active_patrons;

-- G4: among active patrons, share with ≥1 steered first visit
-- (impression strictly before their first valid stamp at that business).
create view gate_steered_first_visit_rate with (security_invoker = true) as
with first_visits as (
  select patron_id, business_id, min(local_date) as first_date
  from valid_stamps group by patron_id, business_id
),
steered_patrons as (
  select distinct fv.patron_id
  from first_visits fv
  join steer_impressions si
    on si.patron_id = fv.patron_id
   and si.business_id = fv.business_id
   and si.local_date < fv.first_date
  where fv.patron_id in (select patron_id from active_patrons)
)
select 'steered_first_visit_rate'::text as metric,
       case when (select count(*) from active_patrons) = 0 then null
            else round((select count(*) from steered_patrons)::numeric
                       / (select count(*) from active_patrons), 4) end as value,
       (select count(*) from active_patrons)::int as n;

-- G5: passport adds — patrons holding ≥1 wallet pass (installs sample floor).
create view gate_passport_adds with (security_invoker = true) as
select 'passport_adds'::text as metric,
       count(distinct patron_id)::numeric as value,
       count(distinct patron_id)::int as n
from wallet_pass_instances;

-- G6: patron signups per active (founding) business — 30–50 reference band.
create view gate_signups_per_business with (security_invoker = true) as
with biz as (select count(*) as c from businesses where status = 'active'),
     sign as (
       select count(*) as c from patrons p
       join seasons se on se.is_current
       where p.created_at::date between se.starts_on and se.ends_on
     )
select 'patron_signups_per_business'::text as metric,
       case when biz.c = 0 then null else round(sign.c::numeric / biz.c, 2) end as value,
       sign.c::int as n
from biz, sign;

-- G7: paying businesses (Jun 20 pre-gate read).
create view gate_paying_business_count with (security_invoker = true) as
select 'paying_business_count'::text as metric,
       count(*)::numeric as value,
       count(*)::int as n
from subscriptions where status = 'active';

-- G8: billing retention — share of ever-activated subscriptions still paying (Nov 1 read).
create view gate_billing_retention_rate with (security_invoker = true) as
with ever as (select count(*) as c from subscriptions),
     paying as (select count(*) as c from subscriptions where status = 'active')
select 'billing_retention_rate'::text as metric,
       case when ever.c = 0 then null else round(paying.c::numeric / ever.c, 4) end as value,
       ever.c::int as n
from ever, paying;

-- ---------- Union for the snapshot job + read_gate_metrics RPC ----------
create view gate_metrics_all with (security_invoker = true) as
  select * from gate_second_business_rate_21d
  union all select * from gate_same_business_repeat_rate
  union all select * from gate_median_checkins_per_active
  union all select * from gate_steered_first_visit_rate
  union all select * from gate_passport_adds
  union all select * from gate_signups_per_business
  union all select * from gate_paying_business_count
  union all select * from gate_billing_retention_rate;

-- ---------- Owner-side foundation (refined in US6 migration) ----------
-- 14-day visit pattern per business, RLS-scoped at query time via stamps policies.
create view owner_visit_pattern_14d with (security_invoker = true) as
select business_id, local_date, count(*) as stamps
from valid_stamps
where local_date >= (current_date - interval '13 days')::date
group by business_id, local_date;
