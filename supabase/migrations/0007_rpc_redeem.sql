-- ============================================================
-- 0007_rpc_redeem.sql — US3 perk redemption (T037).
-- Normative: contracts/api.md §3.6 + §7 codes; data-model §2.11.
-- Constitution Art. II (audit who/what/when), Art. VI (no money).
--
-- REDEMPTION RESET SEMANTICS (the load-bearing rule):
--   A patron's perk "progress" at a business is the count of their
--   trust-valid, non-voided stamps at that business in the current season
--   that were created STRICTLY AFTER the patron's most-recent redemption of
--   THAT perk. With no prior redemption, it is the full season stamp count.
--   Redeeming records a redemption row at now(); the very next progress read
--   therefore counts only stamps after it → resets to 0, and a subsequent
--   stamp shows 1 of threshold.
--
--   This file is the SINGLE source of that rule. It create-or-replaces
--   0006's checkin_progress so the 'current'/'ready' computation on the
--   check-in path matches redeem_perk exactly — perk_progress is consistent
--   everywhere (check-in confirmation, passport, dashboard, redeem result).
--
-- Errors raised with errcode 'P0001' and MESSAGE = the §7 code string, like
-- the rest of the RPC layer (the errors.js seam reads the code from message).
-- ============================================================

-- ---------- helper: a patron's progress count for one perk (since-last-redemption) ----------
-- Returns the count of trust-valid, non-voided stamps for the patron at the
-- perk's business, current season, created strictly after the latest redemption
-- of this perk by this patron (or all such stamps if never redeemed).
create or replace function perk_progress_count(
  p_patron_id uuid,
  p_perk_id   uuid
) returns int
language plpgsql stable security definer set search_path = public as $$
declare
  v_business_id uuid;
  v_last_redeem timestamptz;
  v_count int;
begin
  select business_id into v_business_id from perks where id = p_perk_id;
  if v_business_id is null then
    return 0;
  end if;

  select max(redeemed_at) into v_last_redeem
  from perk_redemptions
  where patron_id = p_patron_id and perk_id = p_perk_id;

  select count(*) into v_count
  from stamps s
  join seasons se on se.id = s.season_id and se.is_current
  where s.patron_id = p_patron_id
    and s.business_id = v_business_id
    and s.trust_valid and s.voided_at is null
    and (v_last_redeem is null or s.created_at > v_last_redeem);

  return coalesce(v_count, 0);
end $$;

-- ============================================================
-- checkin_progress — REPLACES the 0006 definition so 'current' follows the
-- since-last-redemption rule (0006 counted ALL stamps, which would never reset
-- after a redemption). Signature + return shape are unchanged so record_check_in
-- and staff_check_in keep working untouched.
-- ============================================================
create or replace function checkin_progress(
  p_patron_id uuid,
  p_business_id uuid,
  p_season_id uuid,
  p_local_date date
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_region uuid;
  v_town uuid;
  v_perk record;
  v_current int;
  v_perk_json jsonb;
  v_towns_visited int;
  v_towns_total int;
  v_unlocked uuid[] := '{}';
  m record;
  v_first_at_business boolean;
  v_first_in_town boolean;
  v_steered boolean;
begin
  select region_id, town_id into v_region, v_town
  from businesses where id = p_business_id;

  -- Perk: lowest-threshold active perk of the business (the "primary" perk).
  select id, name, visit_threshold into v_perk
  from perks
  where business_id = p_business_id and status = 'active'
  order by visit_threshold asc, created_at asc
  limit 1;

  if v_perk.id is not null then
    -- since-last-redemption count (0007 rule) — resets after a redemption.
    v_current := perk_progress_count(p_patron_id, v_perk.id);
    v_perk_json := jsonb_build_object(
      'perk_id', v_perk.id,
      'name', v_perk.name,
      'current', v_current,
      'threshold', v_perk.visit_threshold,
      'ready', v_current >= v_perk.visit_threshold
    );
  else
    v_perk_json := null;
  end if;

  -- Regional progress: distinct towns visited (trust-valid, this season).
  select count(distinct b.town_id) into v_towns_visited
  from stamps s
  join businesses b on b.id = s.business_id
  where s.patron_id = p_patron_id and s.season_id = p_season_id
    and s.trust_valid and s.voided_at is null;

  select count(*) into v_towns_total from towns where region_id = v_region;

  -- Milestone unlocks: insert any towns_visited thresholds newly crossed.
  for m in
    select id from regional_milestones
    where region_id = v_region and season_id = p_season_id
      and kind = 'towns_visited' and threshold <= v_towns_visited
  loop
    insert into milestone_unlocks (patron_id, milestone_id)
    values (p_patron_id, m.id)
    on conflict (patron_id, milestone_id) do nothing;
    if found then
      v_unlocked := array_append(v_unlocked, m.id);
    end if;
  end loop;

  -- First-visit flags. The crossing stamp already exists, so count = 1 means first.
  select count(*) = 1 into v_first_at_business
  from stamps
  where patron_id = p_patron_id and business_id = p_business_id
    and trust_valid and voided_at is null;

  select count(distinct b.id) = 0 into v_first_in_town
  from stamps s
  join businesses b on b.id = s.business_id
  where s.patron_id = p_patron_id and b.town_id = v_town
    and s.business_id <> p_business_id
    and s.trust_valid and s.voided_at is null;

  select exists(
    select 1 from steer_impressions
    where patron_id = p_patron_id and business_id = p_business_id
      and local_date < p_local_date
  ) into v_steered;

  return jsonb_build_object(
    'perk_progress', v_perk_json,
    'regional_progress', jsonb_build_object(
      'towns_visited', v_towns_visited,
      'towns_total', v_towns_total,
      'milestones_unlocked', to_jsonb(v_unlocked)
    ),
    'first_visit_flags', jsonb_build_object(
      'first_at_business', coalesce(v_first_at_business, true),
      'first_in_town', coalesce(v_first_in_town, true),
      'steered', coalesce(v_steered, false)
    )
  );
end $$;

-- ============================================================
-- redeem_perk — contract §3.6 (RPC). Owner/staff context.
-- ============================================================
create or replace function redeem_perk(
  p_patron_ref uuid,
  p_perk_id    uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_perk record;
  v_current int;
  v_redemption record;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  -- Resolve the perk + its business; PERK_NOT_FOUND if missing.
  select id, business_id, visit_threshold, status into v_perk
  from perks where id = p_perk_id;
  if v_perk.id is null then
    raise exception 'PERK_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Owner-of-this-perk's-business check (admins pass). A different owner must
  -- not be able to probe another business's perk → PERK_NOT_FOUND (don't leak
  -- existence across the privacy boundary).
  if not is_admin() and not exists (
    select 1 from businesses
    where id = v_perk.business_id and owner_user_id = v_uid
  ) then
    raise exception 'PERK_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Perk must be active.
  if v_perk.status <> 'active' then
    raise exception 'PERK_NOT_READY' using errcode = 'P0001';
  end if;

  -- Serialize redemptions per (patron, perk) — without this, two concurrent
  -- redeems both pass the threshold read and double-redeem (review P2-6 TOCTOU;
  -- perk_redemptions has no natural unique key because repeat redemptions
  -- across cycles are legitimate). Released at commit/rollback.
  perform pg_advisory_xact_lock(
    hashtextextended(p_patron_ref::text || ':' || p_perk_id::text, 0)
  );

  -- Progress since the patron's last redemption of this perk must meet threshold.
  v_current := perk_progress_count(p_patron_ref, p_perk_id);
  if v_current < v_perk.visit_threshold then
    raise exception 'PERK_NOT_READY' using errcode = 'P0001';
  end if;

  -- Record the redemption (who/what/when) — verified_by = the staff/owner uid.
  insert into perk_redemptions (patron_id, perk_id, business_id, verified_by)
  values (p_patron_ref, p_perk_id, v_perk.business_id, v_uid)
  returning id, patron_id, perk_id, redeemed_at, verified_by into v_redemption;

  -- Progress resets: the new redemption is now the latest, so the count of
  -- stamps strictly after it is 0 (until the next visit).
  return jsonb_build_object(
    'redemption', jsonb_build_object(
      'id', v_redemption.id,
      'patron_ref', v_redemption.patron_id,
      'perk_id', v_redemption.perk_id,
      'redeemed_at', v_redemption.redeemed_at,
      'verifying_staff', v_redemption.verified_by
    ),
    'perk_progress', jsonb_build_object(
      'current', perk_progress_count(p_patron_ref, p_perk_id),
      'threshold', v_perk.visit_threshold,
      'ready', false
    )
  );
end $$;

-- ---------- Grants ----------
-- perk_progress_count takes an arbitrary patron_id — direct app-role execution
-- would let any authenticated user probe another patron's progress integer
-- (review P3-14). It is an INTERNAL helper: the SECURITY DEFINER RPCs
-- (redeem_perk, checkin_progress, get_business_detail) call it as the function
-- owner regardless of grants; only service_role (tests/ops) may call it directly.
revoke execute on function perk_progress_count(uuid, uuid) from public, anon, authenticated;
grant  execute on function perk_progress_count(uuid, uuid) to service_role;
grant  execute on function redeem_perk(uuid, uuid)         to authenticated;
