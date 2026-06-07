-- ============================================================
-- 0011_rpc_admin.sql — US7 admin RPCs (T055)
-- Contracts §4 (all admin verbs) + §7 codes. Every verb is a
-- SECURITY DEFINER RPC guarded by is_admin() (raises FORBIDDEN with
-- MESSAGE = the §7 machine code otherwise, errcode 'P0001', so
-- PostgREST surfaces it in error.message where clients branch).
--
-- Two new audit tables:
--   admin_actions  — generic admin-action ledger (approvals, declines, voids)
--   rotation_audit — manual/scheduled code rotations with actor + reason
--
-- Single-writer note (decline_business): the Stripe `subscriptions` table is
-- written ONLY by the stripe-webhook edge fn (R4). A decline therefore records
-- the *intent* (business → declined + an admin_actions row) and returns
-- subscription_cancelled = 'pending_stripe' (a truthy value per contract);
-- the actual Stripe cancel is an ops/edge concern, not an app-code write here.
-- ============================================================

-- ---------- Schema add: who voided a stamp (Art. II — accountable correction) ----------
alter table stamps add column if not exists voided_by uuid references auth.users(id);

-- ---------- Audit tables ----------
create table if not exists admin_actions (
  id                 uuid primary key default gen_random_uuid(),
  actor              uuid not null references auth.users(id),
  action             text not null,
  target_business_id uuid references businesses(id),
  target_stamp_id    uuid references stamps(id),
  reason             text,
  details            jsonb not null default '{}',
  created_at         timestamptz not null default now()
);
alter table admin_actions enable row level security;
create policy admin_actions_admin on admin_actions for all
  using (is_admin()) with check (is_admin());

create table if not exists rotation_audit (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id),
  actor       uuid references auth.users(id),
  reason      text,
  rotated_at  timestamptz not null default now()
);
alter table rotation_audit enable row level security;
create policy rotation_audit_admin on rotation_audit for all
  using (is_admin()) with check (is_admin());

-- ---------- search_path fix for the wrapped 0004 rotation helper ----------
-- rotate_business_code() (0004) calls gen_random_bytes(), which lives in the
-- `extensions` schema; its declared `search_path = public` can't resolve it at
-- runtime. Widen the function's search_path here (no edit to 0004 itself).
alter function rotate_business_code(uuid) set search_path = public, extensions;

-- ---------- helper: assert admin or FORBIDDEN ----------
create or replace function assert_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
end $$;

-- ============================================================
-- §4.1 approve_business — pending → active (RPC)
-- ============================================================
create or replace function approve_business(p_business_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_biz record;
  v_now timestamptz := now();
begin
  perform assert_admin();

  select id, status into v_biz from businesses where id = p_business_id;
  if v_biz.id is null then
    raise exception 'BUSINESS_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_biz.status <> 'pending' then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  update businesses
     set status = 'active', approved_at = v_now, approved_by = auth.uid()
   where id = p_business_id;

  -- Give the newly-active business a current code + a default rotation schedule
  -- if it has none yet (so the register kit / check-in path works immediately).
  if not exists (select 1 from check_in_codes where business_id = p_business_id) then
    insert into check_in_codes (business_id, value, version, status)
    values (p_business_id, encode(extensions.gen_random_bytes(16), 'hex'), 1, 'current');
  end if;
  insert into rotation_schedules (business_id) values (p_business_id)
  on conflict (business_id) do nothing;

  insert into admin_actions (actor, action, target_business_id)
  values (auth.uid(), 'approve_business', p_business_id);

  return jsonb_build_object(
    'business_id', p_business_id,
    'status', 'active',
    'approved_by', auth.uid(),
    'approved_at', v_now
  );
end $$;

-- ============================================================
-- §4.1 decline_business — pending → declined (RPC)
-- ============================================================
create or replace function decline_business(p_business_id uuid, p_reason text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_biz record;
begin
  perform assert_admin();

  if p_reason is null or char_length(btrim(p_reason)) = 0 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'reason';
  end if;

  select id, status into v_biz from businesses where id = p_business_id;
  if v_biz.id is null then
    raise exception 'BUSINESS_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_biz.status <> 'pending' then
    raise exception 'INVALID_STATE' using errcode = 'P0001';
  end if;

  update businesses set status = 'declined' where id = p_business_id;

  -- Single-writer rule (R4): we do NOT write `subscriptions` here. Record intent;
  -- the Stripe cancel is performed by ops/the webhook path. We return
  -- subscription_cancelled = 'pending_stripe' (truthy) per the §4.1 contract.
  insert into admin_actions (actor, action, target_business_id, reason)
  values (auth.uid(), 'decline_business', p_business_id, p_reason);

  return jsonb_build_object(
    'business_id', p_business_id,
    'status', 'declined',
    'subscription_cancelled', 'pending_stripe'
  );
end $$;

-- ============================================================
-- §4.1 list_pending_businesses — pending queue + duplicate hints (RPC, read)
-- duplicate_hints surfaces other pending rows matching name+town.
-- ============================================================
create or replace function list_pending_businesses()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_rows jsonb;
begin
  perform assert_admin();

  select coalesce(jsonb_agg(row), '[]'::jsonb) into v_rows
  from (
    select jsonb_build_object(
      'business_id', b.id,
      'name', b.name,
      'slug', b.slug,
      'town', t.slug,
      'town_name', t.name,
      'category', b.category,
      'created_at', b.created_at,
      'duplicate_hints', coalesce((
        select jsonb_agg(jsonb_build_object(
          'business_id', d.id,
          'name', d.name,
          'match_on', 'name+town'
        ))
        from businesses d
        where d.id <> b.id
          and d.status = 'pending'
          and lower(d.name) = lower(b.name)
          and d.town_id = b.town_id
      ), '[]'::jsonb)
    ) as row
    from businesses b
    join towns t on t.id = b.town_id
    where b.status = 'pending'
    order by b.created_at asc
  ) s;

  return v_rows;
end $$;

-- ============================================================
-- §4.2 curate_founding_pick — set / unset / order picks per town (RPC)
-- Position uniqueness per town is enforced by re-numbering on order.
-- ============================================================
create or replace function curate_founding_pick(
  p_business_id uuid,
  p_town        text,
  p_action      text,
  p_position    int default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_town_id uuid;
  v_biz record;
  v_picks jsonb;
begin
  perform assert_admin();

  if p_action not in ('set', 'unset', 'order') then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'action';
  end if;

  select id into v_town_id from towns where slug = p_town;
  if v_town_id is null then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'town';
  end if;

  select id, status, town_id into v_biz from businesses where id = p_business_id;
  if v_biz.id is null then
    raise exception 'BUSINESS_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_biz.status <> 'active' then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'business_status';
  end if;

  if p_action = 'set' then
    insert into founding_picks (town_id, business_id, curated_by, display_order)
    values (v_town_id, p_business_id, auth.uid(),
            coalesce((select max(display_order) + 1 from founding_picks where town_id = v_town_id), 1))
    on conflict (town_id, business_id) do update set curated_by = auth.uid();

  elsif p_action = 'unset' then
    delete from founding_picks where town_id = v_town_id and business_id = p_business_id;

  elsif p_action = 'order' then
    if p_position is null or p_position < 1 then
      raise exception 'VALIDATION' using errcode = 'P0001', detail = 'position';
    end if;
    -- Set this pick's order; shift any colliding pick out of the way so the
    -- per-town position stays unique.
    update founding_picks set display_order = display_order + 1
     where town_id = v_town_id and display_order >= p_position
       and business_id <> p_business_id;
    update founding_picks set display_order = p_position, curated_by = auth.uid()
     where town_id = v_town_id and business_id = p_business_id;
    if not found then
      raise exception 'BUSINESS_NOT_FOUND' using errcode = 'P0001';
    end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'business_id', business_id,
           'position', display_order,
           'curated_by', curated_by
         ) order by display_order), '[]'::jsonb)
    into v_picks
  from founding_picks where town_id = v_town_id;

  return jsonb_build_object('town', p_town, 'picks', v_picks);
end $$;

-- ============================================================
-- §4.3 rotate_code — manual rotation + schedule writer (RPC)
-- Wraps rotate_business_code() (0004). Records a rotation_audit row.
-- ============================================================
create or replace function rotate_code(
  p_business_id uuid,
  p_reason      text,
  p_schedule    jsonb default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_biz record;
  v_new int;
  v_grace timestamptz;
  v_interval int;
  v_grace_hours int;
begin
  perform assert_admin();

  if p_reason is null or char_length(btrim(p_reason)) = 0 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'reason';
  end if;

  select id, status into v_biz from businesses where id = p_business_id;
  if v_biz.id is null then
    raise exception 'BUSINESS_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_biz.status <> 'active' then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'business_status';
  end if;

  -- Optional schedule update (config write).
  if p_schedule is not null then
    v_interval := coalesce((p_schedule ->> 'interval_days')::int, 7);
    v_grace_hours := coalesce((p_schedule ->> 'grace_hours')::int, 72);
    if v_interval < 1 or v_interval > 90 then
      raise exception 'VALIDATION' using errcode = 'P0001', detail = 'interval_days';
    end if;
    if v_grace_hours < 0 or v_grace_hours > 720 then
      raise exception 'VALIDATION' using errcode = 'P0001', detail = 'grace_hours';
    end if;
    insert into rotation_schedules (business_id, interval_days, grace_hours)
    values (p_business_id, v_interval, v_grace_hours)
    on conflict (business_id)
      do update set interval_days = excluded.interval_days, grace_hours = excluded.grace_hours;
  end if;

  -- Rotate: prior current → grace, mint a new current (0004 helper).
  select new_version, grace_until into v_new, v_grace
  from rotate_business_code(p_business_id);

  -- Prompt a reprint (R2) and record the manual rotation.
  insert into reprint_flags (business_id, flagged_at, cleared_at)
  values (p_business_id, now(), null)
  on conflict (business_id) do update set flagged_at = now(), cleared_at = null;

  insert into rotation_audit (business_id, actor, reason)
  values (p_business_id, auth.uid(), p_reason);

  select interval_days, grace_hours into v_interval, v_grace_hours
  from rotation_schedules where business_id = p_business_id;

  return jsonb_build_object(
    'business_id', p_business_id,
    'new_version', v_new,
    'grace_until', v_grace,
    'reprint_prompted', true,
    'schedule', jsonb_build_object(
      'interval_days', coalesce(v_interval, 7),
      'grace_hours', coalesce(v_grace_hours, 72)
    )
  );
end $$;

-- ============================================================
-- §4.4 read_gate_metrics — pre-registered gate readings (RPC, read)
--
-- Shared logic: gate_metrics_evaluated() computes the joined gate_metrics_all ×
-- gate_thresholds result with validity + verdict_eligibility. Both
-- read_gate_metrics() (admin RPC) and snapshot_gate_metrics() (0012) call it.
--
-- validity:
--   'insufficient_sample' when n < coalesce(sample_floor_n, 0) for stamp-derived
--      metrics (n compared to the seeded sample_floor_n). passport_adds uses its
--      own floor (its sample_floor_n) the same way.
--   'valid' otherwise.
--   'trust_invalid' is reserved: every §5 view already excludes trust-invalid /
--      voided stamps (FR-018), so a reading can only flip to 'trust_invalid' if a
--      future trust-model-breach flag table marks the window contaminated. When
--      such a table exists, OR its presence into the validity CASE below; until
--      then no reading is computed as trust_invalid. (verdict TRUST_MODEL_VOID
--      mirrors it.)
--
-- verdict_eligibility:
--   ELIGIBLE only when valid AND within the pre-read window: read_on IS NULL
--      (continuously readable) OR current_date >= read_on - 7. The 7-day window
--      lets ops dry-run the binding read a week early without declaring a verdict
--      against a metric whose pre-registered read date hasn't arrived; before
--      that window a valid metric is still INSUFFICIENT_SAMPLE-equivalent for
--      *verdict* purposes (not yet eligible to score the bet — Art. III).
-- ============================================================
create or replace function gate_metrics_evaluated()
returns table (
  metric text,
  value numeric,
  n int,
  threshold jsonb,
  kill_floor numeric,
  sample_floor int,
  read_on date,
  validity text,
  valid boolean,
  verdict_eligibility text
)
language sql stable security definer set search_path = public as $$
  select
    g.metric,
    g.value,
    g.n,
    jsonb_strip_nulls(jsonb_build_object(
      'target', t.target,
      'kill', t.kill_floor,
      'sample_floor', t.sample_floor_n
    )) as threshold,
    t.kill_floor,
    t.sample_floor_n as sample_floor,
    t.read_on,
    -- validity (see header). 'trust_invalid' reserved for a future breach flag.
    case
      when g.n < coalesce(t.sample_floor_n, 0) then 'insufficient_sample'
      else 'valid'
    end as validity,
    (g.n >= coalesce(t.sample_floor_n, 0)) as valid,
    case
      when g.n < coalesce(t.sample_floor_n, 0) then 'INSUFFICIENT_SAMPLE'
      when t.read_on is null or current_date >= t.read_on - 7 then 'ELIGIBLE'
      else 'INSUFFICIENT_SAMPLE'
    end as verdict_eligibility
  from gate_metrics_all g
  join gate_thresholds t on t.metric = g.metric
$$;

create or replace function read_gate_metrics()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_rows jsonb;
begin
  perform assert_admin();

  select coalesce(jsonb_agg(jsonb_build_object(
           'metric', metric,
           'value', value,
           'n', n,
           'threshold', threshold,
           'kill_floor', kill_floor,
           'sample_floor', sample_floor,
           'read_on', read_on,
           'validity', validity,
           'valid', valid,
           'verdict_eligibility', verdict_eligibility
         )), '[]'::jsonb)
    into v_rows
  from gate_metrics_evaluated();

  return v_rows;
end $$;

-- ============================================================
-- §4.5 list_staff_entry_audit — staff-path audit (RPC, read)
-- staff_session = staff_entries.id; flagged_anomaly = >1 staff entry for the
-- same (business, patron_phone, local_date) — a cheap repeat-abuse heuristic.
-- ============================================================
create or replace function list_staff_entry_audit(
  p_business_id uuid default null,
  p_since timestamptz default null
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_rows jsonb;
begin
  perform assert_admin();

  select coalesce(jsonb_agg(jsonb_build_object(
           'stamp_id', s.id,
           'business_id', se.business_id,
           'staff_session', se.id,
           'patron_ref', s.patron_id,
           'at', se.created_at,
           'flagged_anomaly', (
             select count(*) > 1 from staff_entries x
             where x.business_id = se.business_id
               and x.patron_phone = se.patron_phone
               and x.local_date = se.local_date
           )
         ) order by se.created_at desc), '[]'::jsonb)
    into v_rows
  from staff_entries se
  join stamps s on s.staff_entry_ref = se.id
  where (p_business_id is null or se.business_id = p_business_id)
    and (p_since is null or se.created_at >= p_since);

  return v_rows;
end $$;

-- ============================================================
-- §4.6 void_stamp — Tier-3 history-preserving correction (RPC)
-- Status flip only (Art. II/XIV — never a delete). Idempotent.
-- ============================================================
create or replace function void_stamp(p_stamp_id uuid, p_reason text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_stamp record;
  v_now timestamptz := now();
begin
  perform assert_admin();

  if p_reason is null or char_length(btrim(p_reason)) = 0 then
    raise exception 'VALIDATION' using errcode = 'P0001', detail = 'reason';
  end if;

  select id, voided_at, voided_by, void_reason into v_stamp
  from stamps where id = p_stamp_id;
  if v_stamp.id is null then
    raise exception 'STAMP_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Idempotent: already-void stamp is returned unchanged.
  if v_stamp.voided_at is not null then
    return jsonb_build_object(
      'stamp_id', v_stamp.id,
      'status', 'void',
      'voided_by', v_stamp.voided_by,
      'voided_at', v_stamp.voided_at,
      'reason', v_stamp.void_reason
    );
  end if;

  update stamps
     set voided_at = v_now, void_reason = p_reason,
         voided_by = auth.uid(), trust_valid = false
   where id = p_stamp_id;

  insert into admin_actions (actor, action, target_stamp_id, reason)
  values (auth.uid(), 'void_stamp', p_stamp_id, p_reason);

  return jsonb_build_object(
    'stamp_id', p_stamp_id,
    'status', 'void',
    'voided_by', auth.uid(),
    'voided_at', v_now,
    'reason', p_reason
  );
end $$;
