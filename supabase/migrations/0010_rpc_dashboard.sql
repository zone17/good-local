-- ============================================================
-- 0010_rpc_dashboard.sql — US6 owner's calm dashboard (T050).
-- Normative: contracts/api.md §3.7 (get_dashboard) + §3.8 (share_weekly_note),
-- §6 views; data-model §5. Constitution Art. V (owner-scoped, no cross-business
-- patron history), Art. XII (weekly note built by DETERMINISTIC SQL TEMPLATE
-- from real aggregates — no LLM in v1).
--
-- All numbers are computed for the CALLER'S OWN BUSINESS only. The owner-of-
-- business guard (admins pass) is the privacy boundary; the JSON walked by the
-- privacy test exposes only this business's ids and display names — never
-- another business's rows nor a patron's cross-business activity.
-- ============================================================

-- ---------- weekly_note_shares: idempotent co-owner share ledger (§3.8) ----------
create table if not exists weekly_note_shares (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id),
  email       text not null,
  week_of     date not null,
  sent_at     timestamptz not null default now(),
  unique (business_id, email, week_of)
);
alter table weekly_note_shares enable row level security;
-- Owners may read their own business's share rows (admins all). Writes happen
-- via share_weekly_note (SECURITY DEFINER), so no INSERT policy is needed.
drop policy if exists weekly_note_shares_owner on weekly_note_shares;
create policy weekly_note_shares_owner on weekly_note_shares
  for select
  using (business_id in (select my_business_ids()) or is_admin());

-- ---------- helper: resolve the caller's business (admins may pass explicit) ----------
create or replace function resolve_owner_business(p_business_id uuid)
returns uuid
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_business_id uuid := p_business_id;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if v_business_id is null then
    select id into v_business_id from businesses where owner_user_id = v_uid limit 1;
    if v_business_id is null then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    return v_business_id;
  end if;

  -- Explicit id: only the owner of that business (or an admin) may read it.
  if not is_admin() and not exists (
    select 1 from businesses where id = v_business_id and owner_user_id = v_uid
  ) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  return v_business_id;
end $$;

-- ---------- helper: a patron's display label (no cross-business info) ----------
-- Returns display_name when set, else a stable short token. Never reveals the
-- patron's activity anywhere else — just a name for this business's own feed.
create or replace function patron_display_label(p_patron_id uuid)
returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif(trim(p.display_name), ''),
    'Patron ' || substr(replace(p.id::text, '-', ''), 1, 4)
  )
  from patrons p where p.id = p_patron_id
$$;

-- ============================================================
-- get_dashboard — contract §3.7 (RPC, read). Owner-scoped aggregates only.
-- ============================================================
create or replace function get_dashboard(p_business_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_business_id uuid;
  v_season uuid;
  v_week_start date;       -- Monday of the current ISO week (region-local)
  v_prev_start date;
  v_today date;

  v_repeat_rate numeric;
  v_verified_regulars int;
  v_verified_regulars_prev int;
  v_new_patrons int;
  v_new_patrons_prev int;
  v_redemptions int;
  v_redemptions_prev int;

  v_weekly_note text;
  v_delta_regulars int;
  v_delta_phrase text;

  v_perk_perf jsonb;
  v_activity jsonb;
  v_pattern jsonb;
  v_ready jsonb;
  v_tz text;
begin
  v_business_id := resolve_owner_business(p_business_id);

  select id into v_season from seasons where is_current limit 1;
  -- Region timezone for date-bucketing timestamps (redeemed_at) consistently
  -- with current_local_date() — avoids a UTC-vs-region off-by-one at the week
  -- boundary.
  select r.timezone into v_tz
  from seasons se join regions r on r.id = se.region_id
  where se.is_current limit 1;
  v_tz := coalesce(v_tz, 'America/New_York');

  v_today := current_local_date();
  if v_today is null then v_today := current_date; end if;
  -- ISO week: Monday start. date_trunc('week') is Monday-based.
  v_week_start := date_trunc('week', v_today)::date;
  v_prev_start := (v_week_start - interval '7 days')::date;

  -- ---- headline: repeat-visit rate (share of this biz's patron pairs with 2+) ----
  with pairs as (
    select s.patron_id, count(*) as visits
    from stamps s
    join seasons se on se.id = s.season_id and se.is_current
    where s.business_id = v_business_id and s.trust_valid and s.voided_at is null
    group by s.patron_id
  )
  select case when count(*) = 0 then 0
              else round(count(*) filter (where visits >= 2)::numeric / count(*), 4) end
  into v_repeat_rate
  from pairs;

  -- ---- verified regulars (2+ valid stamps this season at this business) ----
  select count(*) into v_verified_regulars from (
    select s.patron_id
    from stamps s
    join seasons se on se.id = s.season_id and se.is_current
    where s.business_id = v_business_id and s.trust_valid and s.voided_at is null
    group by s.patron_id
    having count(*) >= 2
  ) r;

  -- Prior-week comparison: verified regulars as of the end of the prior week.
  select count(*) into v_verified_regulars_prev from (
    select s.patron_id
    from stamps s
    join seasons se on se.id = s.season_id and se.is_current
    where s.business_id = v_business_id and s.trust_valid and s.voided_at is null
      and s.local_date < v_week_start
    group by s.patron_id
    having count(*) >= 2
  ) r;

  -- ---- new patrons: first-ever valid stamp at this business in the current week ----
  with firsts as (
    select s.patron_id, min(s.local_date) as first_date
    from stamps s
    where s.business_id = v_business_id and s.trust_valid and s.voided_at is null
    group by s.patron_id
  )
  select
    count(*) filter (where first_date >= v_week_start and first_date <= v_today),
    count(*) filter (where first_date >= v_prev_start and first_date < v_week_start)
  into v_new_patrons, v_new_patrons_prev
  from firsts;

  -- ---- redemptions this week / prior week at this business (region-local date) ----
  select
    count(*) filter (where (r.redeemed_at at time zone v_tz)::date >= v_week_start
                       and (r.redeemed_at at time zone v_tz)::date <= v_today),
    count(*) filter (where (r.redeemed_at at time zone v_tz)::date >= v_prev_start
                       and (r.redeemed_at at time zone v_tz)::date < v_week_start)
  into v_redemptions, v_redemptions_prev
  from perk_redemptions r
  where r.business_id = v_business_id;

  v_delta_regulars := v_verified_regulars - v_verified_regulars_prev;

  -- ---- weekly note: DETERMINISTIC SQL TEMPLATE (Art. XII, no LLM) ----
  v_delta_phrase := case
    when v_delta_regulars > 0 then 'up ' || v_delta_regulars
    when v_delta_regulars < 0 then 'down ' || abs(v_delta_regulars)
    else 'steady'
  end;
  v_weekly_note := format(
    '%s regulars came in last week, %s.',
    v_verified_regulars, v_delta_phrase
  );

  -- ---- perk performance: redemptions this season vs eligible (ready now) ----
  select coalesce(jsonb_agg(jsonb_build_object(
    'perk_id', p.id,
    'name', p.name,
    'redemptions', coalesce(rc.c, 0),
    'eligible', coalesce(el.c, 0),
    'read', case
      when coalesce(rc.c, 0) = 0 and coalesce(el.c, 0) = 0 then 'No takers yet.'
      when coalesce(rc.c, 0) >= coalesce(el.c, 0) and coalesce(rc.c,0) > 0 then 'Earning out.'
      else 'Steady.'
    end
  ) order by p.visit_threshold), '[]'::jsonb)
  into v_perk_perf
  from perks p
  left join (
    select perk_id, count(*) as c
    from perk_redemptions
    where business_id = v_business_id
    group by perk_id
  ) rc on rc.perk_id = p.id
  left join lateral (
    -- eligible = patrons with progress (since last redemption) >= threshold now.
    select count(*) as c from (
      select s.patron_id
      from stamps s
      join seasons se on se.id = s.season_id and se.is_current
      where s.business_id = v_business_id and s.trust_valid and s.voided_at is null
      group by s.patron_id
      having perk_progress_count(s.patron_id, p.id) >= p.visit_threshold
    ) e
  ) el on true
  where p.business_id = v_business_id and p.status = 'active';

  -- ---- activity feed: last 20 stamps + redemptions, desc, with display names ----
  select coalesce(jsonb_agg(row order by row->>'at' desc), '[]'::jsonb)
  into v_activity
  from (
    select jsonb_build_object(
      'at', a.at,
      'patron_display', patron_display_label(a.patron_id),
      'event', a.event
    ) as row
    from (
      select s.created_at as at, s.patron_id,
             case when s.staff_entry_ref is not null then 'staff_stamp' else 'stamp' end as event
      from stamps s
      where s.business_id = v_business_id and s.voided_at is null
      union all
      select r.redeemed_at as at, r.patron_id, 'redemption' as event
      from perk_redemptions r
      where r.business_id = v_business_id
      order by at desc
      limit 20
    ) a
  ) feed;

  -- ---- 14-day visit pattern, zero-filled ----
  select coalesce(jsonb_agg(jsonb_build_object('date', d.day, 'stamps', coalesce(c.c, 0)) order by d.day), '[]'::jsonb)
  into v_pattern
  from (
    select (v_today - g)::date as day
    from generate_series(0, 13) g
  ) d
  left join (
    select s.local_date, count(*) as c
    from stamps s
    where s.business_id = v_business_id and s.trust_valid and s.voided_at is null
      and s.local_date >= (v_today - 13)
    group by s.local_date
  ) c on c.local_date = d.day;

  -- ---- ready_redemptions: patrons at/above threshold for an active perk (T038) ----
  select coalesce(jsonb_agg(jsonb_build_object(
    'patron_ref', rr.patron_id,
    'patron_display', patron_display_label(rr.patron_id),
    'perk_id', rr.perk_id,
    'perk_name', rr.perk_name
  )), '[]'::jsonb)
  into v_ready
  from (
    select distinct s.patron_id, p.id as perk_id, p.name as perk_name
    from perks p
    join stamps s on s.business_id = v_business_id
                 and s.trust_valid and s.voided_at is null
    join seasons se on se.id = s.season_id and se.is_current
    where p.business_id = v_business_id and p.status = 'active'
      and perk_progress_count(s.patron_id, p.id) >= p.visit_threshold
  ) rr;

  return jsonb_build_object(
    'weekly_note', v_weekly_note,
    'headline', jsonb_build_object(
      'repeat_visit_rate', v_repeat_rate,
      'verified_regulars', v_verified_regulars,
      'new_patrons', v_new_patrons,
      'redemptions', v_redemptions,
      'deltas', jsonb_build_object(
        'verified_regulars', v_delta_regulars,
        'new_patrons', v_new_patrons - v_new_patrons_prev,
        'redemptions', v_redemptions - v_redemptions_prev
      )
    ),
    'perk_performance', v_perk_perf,
    'activity_feed', v_activity,
    'visit_pattern_14d', v_pattern,
    'ready_redemptions', v_ready
  );
end $$;

-- ============================================================
-- share_weekly_note — contract §3.8 (RPC). Idempotent per email per week.
-- Records the share intent; the actual email delivery is the share-weekly-note
-- edge fn (T051, external messaging). Returns { sent, week_of }.
-- ============================================================
create or replace function share_weekly_note(p_email text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_business_id uuid;
  v_week_of date;
  v_today date;
begin
  v_business_id := resolve_owner_business(null);

  if p_email is null or p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'email';
  end if;

  v_today := current_local_date();
  if v_today is null then v_today := current_date; end if;
  v_week_of := date_trunc('week', v_today)::date;

  -- Idempotent per (business, email, week): a second call same week is a no-op
  -- insert but still reports sent:true with the same week_of (no duplicate row).
  insert into weekly_note_shares (business_id, email, week_of)
  values (v_business_id, p_email, v_week_of)
  on conflict (business_id, email, week_of) do nothing;

  return jsonb_build_object('sent', true, 'week_of', v_week_of);
end $$;

-- ---------- Grants ----------
grant execute on function resolve_owner_business(uuid) to authenticated;
grant execute on function patron_display_label(uuid)   to authenticated;
grant execute on function get_dashboard(uuid)           to authenticated;
grant execute on function share_weekly_note(text)       to authenticated;
