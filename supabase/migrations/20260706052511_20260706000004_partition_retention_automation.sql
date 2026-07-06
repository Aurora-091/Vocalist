-- Automate partition retention via pg_cron.
-- Retention policy:
--   call_events:    12 months  (operational history)
--   webhook_events:  6 months  (event replay window)
--   usage_ledger:   INDEFINITE (billing/legal records — never dropped)
--
-- Scheduled on the 28th monthly at 03:00 UTC — 3 days after ensure_monthly_partitions
-- runs on the 25th, so new forward partitions always exist before old ones are pruned.

CREATE OR REPLACE FUNCTION public.drop_old_partitions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r          RECORD;
  part_name  TEXT;
  part_start TIMESTAMPTZ;
  cutoff_12m TIMESTAMPTZ := now() - INTERVAL '12 months';
  cutoff_6m  TIMESTAMPTZ := now() - INTERVAL '6 months';
  dropped    INT := 0;
BEGIN
  -- call_events: drop partitions whose upper range bound is older than 12 months
  FOR r IN
    SELECT
      c.relname                                          AS partition_name,
      (pg_get_expr(c.relpartbound, c.oid)::text)         AS bound_expr
    FROM pg_inherits i
    JOIN pg_class p ON p.oid = i.inhparent
    JOIN pg_class c ON c.oid = i.inhrelid
    WHERE p.relname = 'call_events'
      AND p.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  LOOP
    -- Extract upper bound timestamp from partition expression: FOR VALUES FROM (...) TO (...)
    BEGIN
      part_start := (
        regexp_match(r.bound_expr, "TO \('([^']+)'")
      )[1]::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;

    IF part_start <= cutoff_12m THEN
      part_name := r.partition_name;
      RAISE NOTICE 'Dropping call_events partition: % (upper bound %)', part_name, part_start;
      EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', part_name);
      dropped := dropped + 1;
    END IF;
  END LOOP;

  -- webhook_events: drop partitions whose upper range bound is older than 6 months
  FOR r IN
    SELECT
      c.relname                                          AS partition_name,
      (pg_get_expr(c.relpartbound, c.oid)::text)         AS bound_expr
    FROM pg_inherits i
    JOIN pg_class p ON p.oid = i.inhparent
    JOIN pg_class c ON c.oid = i.inhrelid
    WHERE p.relname = 'webhook_events'
      AND p.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  LOOP
    BEGIN
      part_start := (
        regexp_match(r.bound_expr, "TO \('([^']+)'")
      )[1]::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;

    IF part_start <= cutoff_6m THEN
      part_name := r.partition_name;
      RAISE NOTICE 'Dropping webhook_events partition: % (upper bound %)', part_name, part_start;
      EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', part_name);
      dropped := dropped + 1;
    END IF;
  END LOOP;

  -- usage_ledger: intentionally skipped — billing records retained indefinitely

  RAISE NOTICE 'drop_old_partitions complete: % partition(s) dropped', dropped;
END;
$$;

-- Lock down execution: only service_role (pg_cron runs as superuser/service_role)
REVOKE EXECUTE ON FUNCTION public.drop_old_partitions() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.drop_old_partitions() FROM anon;
REVOKE EXECUTE ON FUNCTION public.drop_old_partitions() FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.drop_old_partitions() TO service_role;

-- Schedule: 03:00 UTC on the 28th of every month
-- Runs 3 days after aurora_partition_rotation (25th) ensures forward partitions exist
SELECT cron.schedule(
  'aurora_partition_retention',
  '0 3 28 * *',
  'SELECT public.drop_old_partitions();'
);
