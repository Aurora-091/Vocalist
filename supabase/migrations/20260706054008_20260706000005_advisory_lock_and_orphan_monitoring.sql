-- T-3: Subaccount provisioning concurrency lock
-- Called by backend before the SELECT-then-CREATE pattern in getOrCreateSubaccount().
-- pg_advisory_xact_lock holds until the end of the current transaction, so the
-- check-then-create is atomic per org_id. hashtext maps the string key to bigint.
CREATE OR REPLACE FUNCTION public.request_advisory_lock(lock_key text)
RETURNS void
LANGUAGE sql
AS $$
  SELECT pg_advisory_xact_lock(abs(hashtext(lock_key)));
$$;

REVOKE EXECUTE ON FUNCTION public.request_advisory_lock(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.request_advisory_lock(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.request_advisory_lock(text) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.request_advisory_lock(text) TO service_role;

-- A-4: Auth orphan detection
-- Detects rows in auth.users that have no matching row in public.users.
-- Orphans occur when the on-auth-user-created trigger fails (e.g. during outages).
-- Scheduled daily by pg_cron; output captured in pg_cron.job_run_details.
CREATE OR REPLACE FUNCTION public.check_auth_orphans()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  orphan_count int;
  orphan_rec   RECORD;
BEGIN
  SELECT count(*) INTO orphan_count
  FROM auth.users au
  LEFT JOIN public.users pu ON pu.id = au.id
  WHERE pu.id IS NULL;

  IF orphan_count = 0 THEN
    RAISE NOTICE 'check_auth_orphans: no orphans found';
    RETURN;
  END IF;

  RAISE WARNING 'check_auth_orphans: % auth.users row(s) have no public.users profile', orphan_count;

  -- Log each orphan so the pg_cron job_run_details captures them
  FOR orphan_rec IN
    SELECT au.id, au.email, au.created_at
    FROM auth.users au
    LEFT JOIN public.users pu ON pu.id = au.id
    WHERE pu.id IS NULL
    ORDER BY au.created_at DESC
    LIMIT 100
  LOOP
    RAISE WARNING 'orphan: id=% email=% created_at=%',
      orphan_rec.id, orphan_rec.email, orphan_rec.created_at;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_auth_orphans() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_auth_orphans() FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_auth_orphans() FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.check_auth_orphans() TO service_role;

-- Schedule daily at 04:00 UTC (quiet hour, after partition jobs)
SELECT cron.schedule(
  'aurora_auth_orphan_check',
  '0 4 * * *',
  'SELECT public.check_auth_orphans();'
);
