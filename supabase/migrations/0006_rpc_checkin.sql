-- ============================================================
-- 0006_rpc_checkin.sql — the sacred path (US2, T028).
-- Normative: contracts/api.md §§2.1–2.4, 3.5; data-model §2.7–2.10, §3–§5;
-- research R2/R3/R7/R8. Constitution Art. II (one transaction, XOR attribution,
-- daily UNIQUE, no-delete), Art. XIV (merge preserves history).
--
-- Every error is raised with errcode 'P0001' and the MESSAGE set to the exact
-- contract error-code string (e.g. 'CODE_RETIRED'); the seam (errors.js) reads
-- the code from the message. RPCs are SECURITY DEFINER with a pinned search_path
-- so they may write stamps despite RLS having no insert policy (the trust model
-- is the only door — 0002_rls.sql).
-- ============================================================

-- dblink lets the CODE_RETIRED reprint flag survive the transaction rollback the
-- raise triggers (the stamp must NOT persist, but the reprint nag must — R2).
create extension if not exists dblink;

-- ---------- otp_codes — service-role-only (no RLS policies for app roles) ----------
-- claim_passport verifies against this; the claim-passport edge fn inserts rows.
create table otp_codes (
  id          uuid primary key default gen_random_uuid(),
  phone       text not null,
  code        text not null,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index otp_codes_phone on otp_codes (phone, created_at desc);
-- RLS on, with NO policies for anon/authenticated → unreachable except service role.
alter table otp_codes enable row level security;

-- ---------- helper: write a reprint flag in its OWN transaction (R2) ----------
-- Called right before raising CODE_RETIRED so the nag persists even though the
-- raise rolls the check-in transaction back. dblink opens a fresh connection
-- that commits independently. Local stack creds; in prod use the pooled DSN.
create or replace function flag_reprint_autonomous(p_business_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_conninfo text;
begin
  -- Conninfo for the self-connection. Default targets the Supabase local DB over
  -- its container hostname (`db`), which hits a password-auth pg_hba rule so the
  -- non-superuser dblink guard is satisfied. Override in prod via:
  --   ALTER DATABASE postgres SET app.reprint_conninfo = '...';
  v_conninfo := current_setting('app.reprint_conninfo', true);
  if v_conninfo is null or v_conninfo = '' then
    v_conninfo := 'host=db port=5432 dbname=' || current_database()
                  || ' user=postgres password=postgres';
  end if;

  perform dblink_exec(
    v_conninfo,
    format(
      'insert into public.reprint_flags (business_id, flagged_at, cleared_at)
       values (%L, now(), null)
       on conflict (business_id) do update set flagged_at = now(), cleared_at = null',
      p_business_id
    )
  );
exception when others then
  -- Never let the nag-write failure mask the CODE_RETIRED signal to the patron.
  null;
end $$;

-- ---------- helper: region-local "today" for the current season's region ----------
create or replace function current_local_date() returns date
language sql stable security definer set search_path = public as $$
  select (now() at time zone r.timezone)::date
  from seasons se
  join regions r on r.id = se.region_id
  where se.is_current
  limit 1
$$;

-- ---------- helper: resolve-or-create the patron for auth.uid(); touch device ----------
-- Returns the canonical patron id (follows merged_into). Inserts patron + device
-- on first touch; updates device last_seen on return.
create or replace function resolve_patron(p_device_ref text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_patron uuid;
  v_canonical uuid;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  select id, coalesce(merged_into, id) into v_patron, v_canonical
  from patrons where auth_user_id = v_uid;

  if v_patron is null then
    insert into patrons (auth_user_id) values (v_uid)
    returning id into v_patron;
    v_canonical := v_patron;
  end if;

  if p_device_ref is not null and length(p_device_ref) > 0 then
    insert into patron_devices (patron_id, device_token)
    values (v_canonical, p_device_ref)
    on conflict (device_token)
      do update set last_seen_at = now()
      where patron_devices.patron_id = v_canonical;
  end if;

  return v_canonical;
end $$;

-- ---------- internal: build the progress payload shared by both check-in paths ----------
-- Computes perk_progress, regional_progress (+ milestone unlocks), and
-- first_visit_flags for a freshly-inserted stamp. Returns jsonb fragments.
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
    select count(*) into v_current
    from stamps
    where patron_id = p_patron_id and business_id = p_business_id
      and trust_valid and voided_at is null;
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
-- record_check_in — contract §2.1 (RPC). Single transaction.
-- ============================================================
create or replace function record_check_in(
  p_business_slug text,
  p_code_value text,
  p_device_ref text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_biz record;
  v_code record;
  v_patron uuid;
  v_season uuid;
  v_local_date date;
  v_stamp record;
  v_progress jsonb;
begin
  -- Resolve business by slug.
  select id, status, name, stamp_code into v_biz from businesses where slug = p_business_slug;
  if v_biz.id is null then
    raise exception 'BUSINESS_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_biz.status = 'suspended' then
    raise exception 'BUSINESS_SUSPENDED' using errcode = 'P0001';
  end if;
  -- pending / closed / declined are not check-in-able; opaque to patrons.
  if v_biz.status <> 'active' then
    raise exception 'BUSINESS_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Resolve code by value for this business.
  select id, status, version, grace_until into v_code
  from check_in_codes
  where business_id = v_biz.id and value = p_code_value;

  if v_code.id is null then
    raise exception 'CODE_INVALID' using errcode = 'P0001';
  end if;

  -- current → ok; grace (within window) → ok; otherwise retired/expired-grace.
  if v_code.status = 'current'
     or (v_code.status = 'grace' and v_code.grace_until is not null and v_code.grace_until > now()) then
    null; -- acceptable
  else
    -- Retired (or grace expired): flag for reprint and refuse. Excluded from gates.
    -- The flag is written autonomously so it survives the rollback the raise
    -- triggers (no stamp persists, but the reprint nag does — R2, FR-018).
    perform flag_reprint_autonomous(v_biz.id);
    raise exception 'CODE_RETIRED' using errcode = 'P0001';
  end if;

  -- Resolve-or-create patron + touch device.
  v_patron := resolve_patron(p_device_ref);

  -- Current season (required).
  select id into v_season from seasons where is_current limit 1;
  if v_season is null then
    raise exception 'REGION_NOT_FOUND' using errcode = 'P0001';
  end if;

  v_local_date := current_local_date();

  -- Insert the stamp (code attribution). Daily UNIQUE violation → DAILY_LIMIT.
  begin
    insert into stamps (patron_id, business_id, season_id, local_date, code_version_ref)
    values (v_patron, v_biz.id, v_season, v_local_date, v_code.id)
    returning id, created_at into v_stamp;
  exception when unique_violation then
    raise exception 'DAILY_LIMIT' using errcode = 'P0001';
  end;

  v_progress := checkin_progress(v_patron, v_biz.id, v_season, v_local_date);

  return jsonb_build_object(
    'stamp', jsonb_build_object(
      'id', v_stamp.id,
      'business_slug', p_business_slug,
      'stamp_code', v_biz.stamp_code,
      'code_version', v_code.version,
      'stamped_at', v_stamp.created_at,
      'attribution', 'code_scan'
    ),
    'perk_progress', v_progress -> 'perk_progress',
    'regional_progress', v_progress -> 'regional_progress',
    'first_visit_flags', v_progress -> 'first_visit_flags'
  );
end $$;

-- ============================================================
-- staff_check_in — contract §3.5 (RPC). Owner/staff context.
-- ============================================================
create or replace function staff_check_in(
  p_business_id uuid,
  p_phone text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_biz record;
  v_local_date date;
  v_season uuid;
  v_count int;
  v_patron uuid;
  v_entry record;
  v_stamp record;
  v_progress jsonb;
  v_claim_token text;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  select id, status, owner_user_id into v_biz from businesses where id = p_business_id;
  if v_biz.id is null then
    raise exception 'BUSINESS_NOT_FOUND' using errcode = 'P0001';
  end if;
  -- Only the owner of this business (or an admin) may staff-enter.
  if v_biz.owner_user_id <> v_uid and not is_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if v_biz.status = 'suspended' then
    raise exception 'BUSINESS_SUSPENDED' using errcode = 'P0001';
  end if;
  if v_biz.status <> 'active' then
    raise exception 'BUSINESS_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- E.164 validation.
  if p_phone !~ '^\+[1-9]\d{1,14}$' then
    raise exception 'PHONE_INVALID' using errcode = 'P0001';
  end if;

  v_local_date := current_local_date();

  -- Rate limit: >= 30 staff entries today for this business → STAFF_RATE_LIMITED.
  select count(*) into v_count
  from staff_entries
  where business_id = p_business_id and local_date = v_local_date;
  if v_count >= 30 then
    raise exception 'STAFF_RATE_LIMITED' using errcode = 'P0001';
  end if;

  select id into v_season from seasons where is_current limit 1;
  if v_season is null then
    raise exception 'REGION_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Find-or-create patron by phone (no auth user). Follow merges.
  select coalesce(merged_into, id) into v_patron from patrons where phone = p_phone;
  if v_patron is null then
    insert into patrons (phone) values (p_phone) returning id into v_patron;
  end if;

  -- Mint a claim token only when the patron is unclaimed (no auth user yet).
  v_claim_token := null;
  if exists (select 1 from patrons where id = v_patron and auth_user_id is null) then
    v_claim_token := encode(extensions.gen_random_bytes(12), 'hex');
  end if;

  insert into staff_entries (business_id, staff_user_id, patron_phone, local_date, claim_token)
  values (p_business_id, v_uid, p_phone, v_local_date, v_claim_token)
  returning id into v_entry;

  -- Insert the stamp (staff attribution). Daily UNIQUE → DAILY_LIMIT.
  begin
    insert into stamps (patron_id, business_id, season_id, local_date, staff_entry_ref)
    values (v_patron, p_business_id, v_season, v_local_date, v_entry.id)
    returning id, created_at into v_stamp;
  exception when unique_violation then
    raise exception 'DAILY_LIMIT' using errcode = 'P0001';
  end;

  v_progress := checkin_progress(v_patron, p_business_id, v_season, v_local_date);

  return jsonb_build_object(
    'stamp', jsonb_build_object(
      'id', v_stamp.id,
      'attribution', 'staff_entry',
      'staff_session', v_entry.id,
      'stamped_at', v_stamp.created_at
    ),
    'perk_progress', v_progress -> 'perk_progress',
    'claim_link_sent', v_claim_token is not null
  );
end $$;

-- ============================================================
-- link_device — contract §2.3 (RPC).
-- ============================================================
create or replace function link_device(p_device_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_patron uuid;
  v_count int;
begin
  v_patron := resolve_patron(null);

  begin
    insert into patron_devices (patron_id, device_token)
    values (v_patron, p_device_token);
  exception when unique_violation then
    raise exception 'DEVICE_ALREADY_LINKED' using errcode = 'P0001';
  end;

  select count(*) into v_count from patron_devices where patron_id = v_patron;
  return jsonb_build_object('linked_devices', v_count);
end $$;

-- ============================================================
-- record_impressions — contract §2.2 (RPC).
-- NOTE (US5/T046): this is implemented here because the check-in flow + the
-- steer e2e need it. T046 must NOT redefine it — reuse this definition.
-- ============================================================
create or replace function record_impressions(
  p_business_ids uuid[],
  p_surface text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_patron uuid;
  v_local_date date;
  v_surface impression_surface;
  v_recorded int := 0;
  v_total int;
  bid uuid;
begin
  v_patron := resolve_patron(null);
  v_local_date := current_local_date();

  -- Map contract surface enum to the schema enum.
  v_surface := case p_surface
    when 'discovery' then 'discovery_list'::impression_surface
    when 'discovery_list' then 'discovery_list'::impression_surface
    when 'business_detail' then 'business_detail'::impression_surface
    else null
  end;
  if v_surface is null then
    raise exception 'VALIDATION' using errcode = 'P0001';
  end if;

  v_total := coalesce(array_length(p_business_ids, 1), 0);

  foreach bid in array coalesce(p_business_ids, '{}'::uuid[]) loop
    insert into steer_impressions (patron_id, business_id, surface, local_date)
    values (v_patron, bid, v_surface, v_local_date)
    on conflict (patron_id, business_id, local_date) do nothing;
    if found then
      v_recorded := v_recorded + 1;
    end if;
  end loop;

  return jsonb_build_object('recorded', v_recorded, 'deduped', v_total - v_recorded);
end $$;

-- ============================================================
-- claim_passport — contract §2.3 (RPC). Merge per R3 / Art. XIV.
-- ============================================================
create or replace function claim_passport(p_phone text, p_otp text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_otp record;
  v_current uuid;          -- the caller's current patron (may be null)
  v_phone_holder uuid;     -- oldest patron already holding this phone
  v_winner uuid;
  v_loser uuid;
  v_merged uuid[] := '{}';
  v_devices int;
  dup record;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  -- Verify the OTP (unconsumed, unexpired). Most-recent matching row.
  select id, expires_at, consumed_at into v_otp
  from otp_codes
  where phone = p_phone and code = p_otp
  order by created_at desc
  limit 1;

  if v_otp.id is null or v_otp.consumed_at is not null then
    raise exception 'OTP_INVALID' using errcode = 'P0001';
  end if;
  if v_otp.expires_at <= now() then
    raise exception 'OTP_EXPIRED' using errcode = 'P0001';
  end if;
  update otp_codes set consumed_at = now() where id = v_otp.id;

  -- Caller's current patron (resolve-or-create; follows merges).
  select coalesce(merged_into, id) into v_current from patrons where auth_user_id = v_uid;
  if v_current is null then
    insert into patrons (auth_user_id) values (v_uid) returning id into v_current;
  end if;

  -- Oldest patron already holding this phone (follow merges to canonical).
  select coalesce(merged_into, id) into v_phone_holder
  from patrons
  where phone = p_phone
  order by created_at asc
  limit 1;

  if v_phone_holder is null or v_phone_holder = v_current then
    -- No prior phone patron (or it IS the caller): just claim this identity.
    v_winner := v_current;
    update patrons
       set phone = coalesce(phone, p_phone),
           claimed_at = coalesce(claimed_at, now())
     where id = v_winner;
  else
    -- Merge: winner = oldest phone holder; loser = caller's current patron.
    v_winner := v_phone_holder;
    v_loser := v_current;

    -- Re-point loser facts to winner, voiding daily-unique conflicts on stamps
    -- (history preserved — Art. XIV; never delete, never violate the unique key).
    for dup in
      select l.id as loser_stamp
      from stamps l
      join stamps w
        on w.patron_id = v_winner
       and w.business_id = l.business_id
       and w.local_date = l.local_date
      where l.patron_id = v_loser
    loop
      update stamps
         set trust_valid = false, voided_at = now(), void_reason = 'merge-duplicate'
       where id = dup.loser_stamp;
    end loop;

    -- Re-point the remaining (non-conflicting) loser stamps to the winner.
    update stamps set patron_id = v_winner
     where patron_id = v_loser
       and not exists (
         select 1 from stamps w
         where w.patron_id = v_winner
           and w.business_id = stamps.business_id
           and w.local_date = stamps.local_date
           and w.id <> stamps.id
       );

    -- Re-point other patron facts (best-effort; ignore unique collisions).
    update steer_impressions set patron_id = v_winner where patron_id = v_loser
      and not exists (
        select 1 from steer_impressions x
        where x.patron_id = v_winner and x.business_id = steer_impressions.business_id
          and x.local_date = steer_impressions.local_date and x.id <> steer_impressions.id
      );
    update perk_redemptions set patron_id = v_winner where patron_id = v_loser;
    update milestone_unlocks set patron_id = v_winner where patron_id = v_loser
      and not exists (
        select 1 from milestone_unlocks x
        where x.patron_id = v_winner and x.milestone_id = milestone_unlocks.milestone_id
          and x.id <> milestone_unlocks.id
      );
    update patron_devices set patron_id = v_winner where patron_id = v_loser
      and not exists (
        select 1 from patron_devices x
        where x.patron_id = v_winner and x.device_token = patron_devices.device_token
          and x.id <> patron_devices.id
      );

    -- Preserve the loser row; mark it merged.
    update patrons set merged_into = v_winner where id = v_loser;
    v_merged := array_append(v_merged, v_loser);

    -- The winner keeps the phone; adopt the caller's auth_user_id only if the
    -- winner has none (merging an authed patron into a phone-only patron).
    update patrons
       set claimed_at = coalesce(claimed_at, now()),
           auth_user_id = coalesce(auth_user_id, v_uid)
     where id = v_winner;
  end if;

  select count(*) into v_devices from patron_devices where patron_id = v_winner;

  return jsonb_build_object(
    'patron_id', v_winner,
    'merged_from', to_jsonb(v_merged),
    'linked_devices', v_devices,
    'claimed', true
  );
end $$;

-- ============================================================
-- get_my_passport — contract §2.4 (RPC, read).
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
  if v_patron is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  select id, region_id into v_season, v_region from seasons where is_current limit 1;
  select count(*) into v_towns_total from towns where region_id = v_region;

  select * into v_patron_row from patrons where id = v_patron;

  -- Businesses grouped from this patron's valid stamps.
  select coalesce(jsonb_agg(b_obj order by b_obj->>'name'), '[]'::jsonb) into v_businesses
  from (
    select jsonb_build_object(
      'business_slug', b.slug,
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

-- ============================================================
-- add_wallet_pass — record a passport "add" so the installs gate counts it.
-- The web passport (R5/FR-020) writes this even pre-native-pass; one row per
-- (patron, platform). Lets the lean check-in entry avoid importing pass.js
-- (and supabase-js) just to write one row (T032/T035).
-- ============================================================
create or replace function add_wallet_pass(p_platform text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_patron uuid := current_patron_id();
  v_plat wallet_platform;
  v_serial text;
begin
  if v_patron is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;
  v_plat := case lower(coalesce(p_platform, 'google'))
    when 'apple' then 'apple'::wallet_platform
    else 'google'::wallet_platform
  end;
  v_serial := gen_random_uuid()::text;

  insert into wallet_pass_instances (patron_id, platform, serial)
  values (v_patron, v_plat, v_serial)
  on conflict (patron_id, platform)
    do update set last_updated_at = now()
  returning serial into v_serial;

  return jsonb_build_object('serial', v_serial, 'platform', v_plat);
end $$;

-- ---------- Grants: callable by the patron/owner JWT roles ----------
grant execute on function record_check_in(text, text, text) to anon, authenticated;
grant execute on function staff_check_in(uuid, text)        to authenticated;
grant execute on function link_device(text)                 to anon, authenticated;
grant execute on function record_impressions(uuid[], text)  to anon, authenticated;
grant execute on function claim_passport(text, text)        to anon, authenticated;
grant execute on function get_my_passport()                 to anon, authenticated;
grant execute on function current_local_date()              to anon, authenticated;
grant execute on function add_wallet_pass(text)             to anon, authenticated;
grant execute on function current_patron_id()               to anon, authenticated;
