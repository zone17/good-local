-- ============================================================
-- 0015_passport_empty_for_new_patron.sql — get_my_passport returns an empty
-- passport for a brand-new authenticated patron (deploy fix, D-024).
--
-- WHY: a first-time visitor opens the passport home BEFORE ever scanning. The
-- anonymous session exists (auth.uid() is set), but the `patrons` row is only
-- created on first check-in (resolve_patron) — so current_patron_id() returns
-- null and get_my_passport raised UNAUTHENTICATED, leaving the home stuck (the
-- client renders the error state identically to "Loading…"). The empty-state
-- copy ("Welcome to the river — scan a QR") is designed for exactly this user,
-- so the home MUST render for a never-scanned session.
--
-- FIX: distinguish the two null cases —
--   auth.uid() IS NULL            → no session at all → UNAUTHENTICATED (unchanged)
--   auth.uid() set, no patron row → return an empty passport (zero stamps,
--                                   region progress 0 of N, no milestones).
-- The patron row still materializes lazily on the first real check-in; this
-- read never writes (stays a pure read RPC). Contract §2.4 refined: the
-- response shape is identical, just zero-valued.
-- ============================================================

create or replace function get_my_passport()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_patron uuid := current_patron_id();
  v_region uuid;
  v_season uuid;
  v_businesses jsonb;
  v_region_json jsonb;
  v_towns_total int;
  v_towns_visited int;
  v_patron_row record;
begin
  -- No session at all → UNAUTHENTICATED. A valid session with no patron row
  -- yet (never scanned) → fall through to the empty passport below.
  if v_patron is null and auth.uid() is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  select id, region_id into v_season, v_region from seasons where is_current limit 1;
  select count(*) into v_towns_total from towns where region_id = v_region;

  -- Brand-new authenticated patron, no row yet → honest empty passport.
  if v_patron is null then
    return jsonb_build_object(
      'patron', jsonb_build_object('id', null, 'display_name', null, 'claimed', false),
      'businesses', '[]'::jsonb,
      'region', jsonb_build_object(
        'towns_visited', 0,
        'towns_total', coalesce(v_towns_total, 0),
        'milestones', '[]'::jsonb
      )
    );
  end if;

  select * into v_patron_row from patrons where id = v_patron;

  -- Businesses grouped from this patron's valid stamps.
  select coalesce(jsonb_agg(b_obj order by b_obj->>'name'), '[]'::jsonb) into v_businesses
  from (
    select jsonb_build_object(
      'business_slug', b.slug,
      'stamp_code', b.stamp_code,
      'name', b.name,
      'town', t.name,
      'stamp_count', cnt.c,
      'stamp_dates', cnt.dates,
      'perks', coalesce(pk.perks, '[]'::jsonb)
    ) as b_obj
    from (
      select s.business_id, count(*) as c,
             jsonb_agg(s.local_date order by s.local_date) as dates
      from stamps s
      where s.patron_id = v_patron and s.season_id = v_season
        and s.trust_valid and s.voided_at is null
      group by s.business_id
    ) cnt
    join businesses b on b.id = cnt.business_id
    join towns t on t.id = b.town_id
    left join lateral (
      -- Unchanged from 0006: lifetime stamp count for the passport-home perk
      -- display. (This migration's only behavioral change is the empty-state
      -- branch above; the perk calc is preserved verbatim to avoid scope creep
      -- and contract-test drift.)
      select jsonb_agg(jsonb_build_object(
        'perk_id', p.id,
        'name', p.name,
        'current', cnt.c,
        'threshold', p.visit_threshold,
        'ready', cnt.c >= p.visit_threshold
      ) order by p.visit_threshold) as perks
      from perks p
      where p.business_id = b.id and p.status = 'active'
    ) pk on true
  ) grouped;

  -- Region progress + unlocked milestones with unlocked_at.
  select count(distinct b.town_id) into v_towns_visited
  from stamps s join businesses b on b.id = s.business_id
  where s.patron_id = v_patron and s.season_id = v_season
    and s.trust_valid and s.voided_at is null;

  v_region_json := jsonb_build_object(
    'towns_visited', coalesce(v_towns_visited, 0),
    'towns_total', v_towns_total,
    'milestones', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', rm.id, 'name', rm.name, 'unlocked_at', mu.unlocked_at
      ) order by rm.threshold)
      from milestone_unlocks mu
      join regional_milestones rm on rm.id = mu.milestone_id
      where mu.patron_id = v_patron
    ), '[]'::jsonb)
  );

  return jsonb_build_object(
    'patron', jsonb_build_object(
      'id', v_patron,
      'display_name', v_patron_row.display_name,
      'claimed', v_patron_row.claimed_at is not null
    ),
    'businesses', v_businesses,
    'region', v_region_json
  );
end $$;
