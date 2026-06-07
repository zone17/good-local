-- ============================================================
-- 0014_autonomous_conninfo.sql — hosted-safe conninfo for the dblink
-- autonomous-commit helpers (deploy hardening, D-023).
--
-- WHY: flag_reprint_autonomous + otp_attempt_autonomous open a fresh dblink
-- connection that commits independently of the transaction the surrounding
-- RPC then rolls back (reprint nag survives CODE_RETIRED; OTP attempt counter
-- survives OTP_INVALID — the P1-3 brute-force lockout). They resolved the
-- target conninfo from `current_setting('app.reprint_conninfo')`, falling back
-- to the LOCAL `host=db … postgres/postgres` default.
--
-- On hosted Supabase that GUC cannot be persisted as a connection default:
-- `ALTER DATABASE/ROLE … SET app.reprint_conninfo` requires superuser, which
-- the managed `postgres` role is not. PostgREST/edge connections would
-- therefore fall back to the local default and FAIL — and otp_attempt_autonomous
-- is deliberately fail-closed (no exception swallow), so a wrong OTP digit would
-- surface a raw dblink error instead of OTP_INVALID, breaking the claim flow and
-- disabling the lockout.
--
-- FIX: resolve the conninfo from a one-row `app_config` table that ANY role can
-- be granted to read — no superuser needed. Resolution order is:
--   1. app_config('reprint_conninfo')   — set once at deploy (hosted)
--   2. current_setting('app.reprint_conninfo')  — session override (tests/ops)
--   3. the local `host=db … postgres/postgres` default  — local stack + CI
-- Local and CI leave the table empty, so they keep using the local default and
-- every existing test passes unchanged. Hosted inserts the row at deploy time,
-- so the password lives in a service-role-only table row, never in this file.
-- ============================================================

create table if not exists app_config (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);
-- Service-role / function-owner only. No app-role policies → unreachable via
-- PostgREST for anon/authenticated; the SECURITY DEFINER helpers below read it
-- as the function owner regardless.
alter table app_config enable row level security;
revoke all on app_config from anon, authenticated;

-- Single resolver so both helpers agree (SECURITY DEFINER → reads app_config
-- as the owner; the table grant is irrelevant to these callers).
create or replace function resolve_autonomous_conninfo()
returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v text;
begin
  select value into v from app_config where key = 'reprint_conninfo';
  if v is not null and v <> '' then
    return v;
  end if;
  v := current_setting('app.reprint_conninfo', true);
  if v is not null and v <> '' then
    return v;
  end if;
  -- Local stack default (container hostname `db`, password-auth pg_hba rule —
  -- satisfies the non-superuser dblink guard).
  return 'host=db port=5432 dbname=' || current_database()
         || ' user=postgres password=postgres';
end $$;
revoke execute on function resolve_autonomous_conninfo() from public, anon, authenticated;

-- Re-point both helpers at the resolver (bodies otherwise unchanged from 0006).
create or replace function flag_reprint_autonomous(p_business_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_conninfo text := resolve_autonomous_conninfo();
begin
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

create or replace function otp_attempt_autonomous(p_otp_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_conninfo text := resolve_autonomous_conninfo();
begin
  -- Deliberately NO exception swallow: if the autonomous write cannot happen the
  -- claim fails closed rather than leaving the OTP endpoint brute-forceable.
  perform dblink_exec(
    v_conninfo,
    format('update public.otp_codes set attempts = attempts + 1 where id = %L', p_otp_id)
  );
end $$;
