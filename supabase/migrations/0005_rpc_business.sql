-- ============================================================
-- 0005_rpc_business.sql — US1 owner program RPCs (T018)
-- Contracts §§3.2–3.4. SECURITY DEFINER with explicit owner checks:
-- the caller must own the target business (admins pass). Custom errors
-- are raised with MESSAGE = the §7 machine code string so PostgREST
-- surfaces them in `error.message`, where clients branch on the code.
--
-- Also: processed_stripe_events — the webhook dedup ledger (T020).
-- ============================================================

-- ---------- Webhook dedup ledger (single-writer, R4 / §5) ----------
create table if not exists processed_stripe_events (
  event_id     text primary key,
  processed_at timestamptz not null default now()
);
alter table processed_stripe_events enable row level security;
-- Only the service role (webhook) touches this; no policies for app roles.

-- ---------- Helper: assert the caller owns p_business_id (admins pass) ----------
create or replace function assert_owns_business(p_business_id uuid)
returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if is_admin() then
    return;
  end if;
  if not exists (
    select 1 from businesses
    where id = p_business_id and owner_user_id = auth.uid()
  ) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
end $$;

-- ---------- §3.2 update_business_profile ----------
-- Partial update (all value params nullable). Town is supplied as a slug.
-- p_business_id nullable: when omitted, resolves to the caller's single
-- owned business (keeps the api.js seam, which infers from RLS, working).
create or replace function update_business_profile(
  p_business_id uuid    default null,
  p_name        text    default null,
  p_town_slug   text    default null,
  p_category    text    default null,
  p_hours       text    default null,
  p_owner_note  text    default null,
  p_stamp_code  text    default null
)
returns businesses
language plpgsql security definer set search_path = public as $$
declare
  v_business_id uuid := p_business_id;
  v_region_id   uuid;
  v_town_id     uuid;
  v_row         businesses;
begin
  if v_business_id is null then
    select id into v_business_id from businesses where owner_user_id = auth.uid() limit 1;
    if v_business_id is null then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
  end if;

  perform assert_owns_business(v_business_id);

  select region_id into v_region_id from businesses where id = v_business_id;

  -- Validate + resolve town slug if provided.
  if p_town_slug is not null then
    select id into v_town_id from towns
     where slug = p_town_slug and region_id = v_region_id;
    if v_town_id is null then
      raise exception 'VALIDATION' using errcode = 'P0001', detail = 'town';
    end if;
  end if;

  -- Field-level validation (mirrors the schema CHECKs but with §7 codes).
  if p_hours is not null and char_length(p_hours) > 120 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'hours';
  end if;
  if p_owner_note is not null and char_length(p_owner_note) > 280 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'owner_note';
  end if;
  if p_stamp_code is not null and p_stamp_code !~ '^[A-Z]{3,4}$' then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'stamp_code';
  end if;

  -- Stamp code uniqueness within region (FR-008) — surfaced as a clear code.
  if p_stamp_code is not null and exists (
    select 1 from businesses
    where region_id = v_region_id and stamp_code = p_stamp_code and id <> v_business_id
  ) then
    raise exception 'STAMP_CODE_TAKEN' using errcode = 'P0001';
  end if;

  update businesses set
    name       = coalesce(p_name, name),
    town_id    = coalesce(v_town_id, town_id),
    category   = coalesce(p_category, category),
    hours      = case when p_hours is null then hours
                      else jsonb_build_object('text', p_hours) end,
    owner_note = coalesce(p_owner_note, owner_note),
    stamp_code = coalesce(p_stamp_code, stamp_code)
  where id = v_business_id
  returning * into v_row;

  return v_row;
end $$;

-- ---------- §3.3 publish_perk ----------
create or replace function publish_perk(
  p_business_id uuid,
  p_name        text,
  p_description text,
  p_threshold   int,
  p_kind        text
)
returns perks
language plpgsql security definer set search_path = public as $$
declare v_row perks;
begin
  perform assert_owns_business(p_business_id);

  if p_name is null or char_length(p_name) = 0 or char_length(p_name) > 60 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'name';
  end if;
  if p_description is null or char_length(p_description) = 0 or char_length(p_description) > 120 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'description';
  end if;
  if p_threshold is null or p_threshold < 3 or p_threshold > 12 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'threshold';
  end if;
  if p_kind not in ('status_good', 'off_peak_treat', 'small_discount') then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'kind';
  end if;

  insert into perks (business_id, name, description, visit_threshold, kind, status)
  values (p_business_id, p_name, p_description, p_threshold, p_kind::perk_kind, 'active')
  returning * into v_row;

  return v_row;
end $$;

-- ---------- §3.3 update_perk (threshold edits apply prospectively, FR-011) ----------
-- Returns the perk row plus applies_prospectively as json (extra field).
create or replace function update_perk(
  p_perk_id     uuid,
  p_name        text default null,
  p_description text default null,
  p_threshold   int  default null,
  p_kind        text default null
)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_business_id uuid;
  v_row perks;
begin
  select business_id into v_business_id from perks where id = p_perk_id;
  if v_business_id is null then
    raise exception 'PERK_NOT_FOUND' using errcode = 'P0001';
  end if;
  perform assert_owns_business(v_business_id);

  if p_name is not null and (char_length(p_name) = 0 or char_length(p_name) > 60) then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'name';
  end if;
  if p_description is not null and (char_length(p_description) = 0 or char_length(p_description) > 120) then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'description';
  end if;
  if p_threshold is not null and (p_threshold < 3 or p_threshold > 12) then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'threshold';
  end if;
  if p_kind is not null and p_kind not in ('status_good', 'off_peak_treat', 'small_discount') then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'kind';
  end if;

  -- FR-011: threshold edits never touch existing stamps (stamps belong to the
  -- patron×business pair, not the perk) — the update is purely prospective.
  update perks set
    name            = coalesce(p_name, name),
    description     = coalesce(p_description, description),
    visit_threshold = coalesce(p_threshold, visit_threshold),
    kind            = coalesce(p_kind::perk_kind, kind)
  where id = p_perk_id
  returning * into v_row;

  return json_build_object(
    'id', v_row.id,
    'business_id', v_row.business_id,
    'name', v_row.name,
    'description', v_row.description,
    'visit_threshold', v_row.visit_threshold,
    'kind', v_row.kind,
    'status', v_row.status,
    'created_at', v_row.created_at,
    'applies_prospectively', true
  );
end $$;

-- ---------- §3.3 set_perk_active (deactivation never destroys stamps, FR-010) ----------
create or replace function set_perk_active(
  p_perk_id uuid,
  p_active  boolean
)
returns perks
language plpgsql security definer set search_path = public as $$
declare
  v_business_id uuid;
  v_row perks;
begin
  select business_id into v_business_id from perks where id = p_perk_id;
  if v_business_id is null then
    raise exception 'PERK_NOT_FOUND' using errcode = 'P0001';
  end if;
  perform assert_owns_business(v_business_id);

  update perks set status = (case when p_active then 'active' else 'inactive' end)::perk_status
  where id = p_perk_id
  returning * into v_row;

  return v_row;
end $$;

-- ---------- §3.4 get_register_kit ----------
create or replace function get_register_kit(p_business_id uuid default null)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_business_id uuid := p_business_id;
  v_slug   text;
  v_code   check_in_codes;
  v_interval int;
  v_reprint boolean;
begin
  if v_business_id is null then
    select id into v_business_id from businesses where owner_user_id = auth.uid() limit 1;
    if v_business_id is null then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
  end if;
  perform assert_owns_business(v_business_id);

  select slug into v_slug from businesses where id = v_business_id;

  select * into v_code from check_in_codes
   where business_id = v_business_id and status = 'current'
   limit 1;

  select coalesce(rs.interval_days, 7) into v_interval
  from rotation_schedules rs where rs.business_id = v_business_id;
  if v_interval is null then v_interval := 7; end if;

  v_reprint := exists (
    select 1 from reprint_flags
    where business_id = v_business_id and cleared_at is null
  );

  return json_build_object(
    'business_slug', v_slug,
    'code_value', v_code.value,
    'code_version', v_code.version,
    'qr_url', 'https://goodlocal.app/c/' || v_slug || '?k=' || v_code.value,
    'rotates_at', v_code.created_at + make_interval(days => v_interval),
    'instructions', 'Scan to join. No app needed — adds to your wallet.',
    'reprint_needed', v_reprint
  );
end $$;

-- ---------- Grants: callable by authenticated owners/admins ----------
grant execute on function update_business_profile(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function publish_perk(uuid, text, text, int, text) to authenticated;
grant execute on function update_perk(uuid, text, text, int, text) to authenticated;
grant execute on function set_perk_active(uuid, boolean) to authenticated;
grant execute on function get_register_kit(uuid) to authenticated;
