-- ============================================================
-- 0012_snapshots.sql — nightly gate-metric snapshot writer (T056, R6)
-- The Aug 15 / Nov 1 reads are snapshot rows, not ad-hoc queries (Art. XV):
-- a pg_cron job runs snapshot_gate_metrics() nightly, inserting one durable
-- row per metric per day into gate_metric_snapshots.
--
-- Shared logic: snapshot_gate_metrics() selects from gate_metrics_evaluated()
-- (defined in 0011) — the SAME SQL read_gate_metrics() returns — so the durable
-- snapshot and the live admin read can never drift.
--
-- Idempotency: at most one snapshot per metric per calendar day. Enforced by a
-- unique index on (metric, (taken_at::date)); the function inserts only metrics
-- not yet snapshotted today, so a second same-day call is a no-op.
-- ============================================================

-- One snapshot per metric per day. `taken_at::date` is not IMMUTABLE (it depends
-- on the session TimeZone), so it can't index directly. A STORED generated column
-- pins the date at UTC (IMMUTABLE) and the unique index sits on that.
alter table gate_metric_snapshots
  add column if not exists taken_on date
  generated always as ((taken_at at time zone 'UTC')::date) stored;

create unique index if not exists gate_metric_snapshots_one_per_day
  on gate_metric_snapshots (metric, taken_on);

-- Snapshot writer: insert today's reading for every gate metric, skipping any
-- metric already snapshotted today (per-day idempotency).
create or replace function snapshot_gate_metrics()
returns int
language plpgsql security definer set search_path = public as $$
declare v_inserted int;
begin
  insert into gate_metric_snapshots (metric, value, n, validity, taken_at)
  select e.metric, e.value, e.n,
         e.validity::snapshot_validity,
         now()
  from gate_metrics_evaluated() e
  where not exists (
    select 1 from gate_metric_snapshots gs
    where gs.metric = e.metric and gs.taken_at::date = current_date
  );
  get diagnostics v_inserted = row_count;
  return v_inserted;
end $$;

-- Nightly snapshot at 09:20 UTC (after the 09:10 rotation sweep). Aug 15 / Nov 1
-- gate reads are read from the snapshot rows this job writes (R6).
select cron.schedule('gate-metric-snapshot', '20 9 * * *', $$select public.snapshot_gate_metrics()$$);
