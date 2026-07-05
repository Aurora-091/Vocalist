-- Supabase DB Linter Security Remediation — 2026-07-05
-- Fixes three categories of warnings from the Supabase database linter:
--   1. SECURITY DEFINER functions callable by anon/authenticated via PostgREST RPC
--   2. Partition tables with RLS enabled but no explicit policies
--   3. ensure_monthly_partitions() updated to create policies on future partitions

-- ===========================================================================
-- 1. LOCK DOWN SECURITY DEFINER FUNCTIONS
-- ===========================================================================

-- vault_read / vault_store: called exclusively by backend via service_role.
-- The prior migration (20260704000001) only revoked from 'public'; named roles
-- anon and authenticated are separate in Supabase and need explicit revocation.
REVOKE EXECUTE ON FUNCTION public.vault_read(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.vault_store(text, text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.vault_read(text) TO service_role;
GRANT  EXECUTE ON FUNCTION public.vault_store(text, text) TO service_role;

-- enforce_max_sessions: trigger function, invoked internally by the trigger
-- mechanism only. Direct RPC calls by any role are never needed.
REVOKE EXECUTE ON FUNCTION public.enforce_max_sessions() FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.enforce_max_sessions() TO service_role;

-- ensure_monthly_partitions: DBA / cron utility.
-- Never needs to be called by application roles.
REVOKE EXECUTE ON FUNCTION public.ensure_monthly_partitions(integer) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.ensure_monthly_partitions(integer) TO service_role;

-- auth_org: used directly by every RLS policy expression via USING/WITH CHECK.
-- PostgreSQL evaluates policy expressions as the session role, so 'authenticated'
-- MUST retain EXECUTE. Only revoke from 'anon' which has no JWT to read anyway.
REVOKE EXECUTE ON FUNCTION public.auth_org() FROM anon;
-- GRANT to authenticated is kept (no change needed — just documenting the intent):
-- GRANT EXECUTE ON FUNCTION public.auth_org() TO authenticated;


-- ===========================================================================
-- 2. EXPLICIT RLS POLICIES ON ALL EXISTING PARTITION TABLES
-- ===========================================================================
-- PostgreSQL policy inheritance from parent→partition is correct at the engine
-- level, but Supabase's linter does not account for it and flags each partition
-- individually. Adding explicit policies silences the linter and provides
-- defense-in-depth.
--
-- Policy mirrors the parent table definitions from 20260602185531_migrate_db.sql:
--   call_events:     USING (org_id = auth_org()) WITH CHECK (org_id = auth_org())
--   usage_ledger:    SELECT USING / INSERT WITH CHECK (org_id = auth_org())
--   webhook_events:  SELECT USING / INSERT WITH CHECK (org_id = auth_org() OR org_id IS NULL)

DO $$
DECLARE
  r   record;
  tbl text;
BEGIN
  -- call_events partitions
  FOR r IN
    SELECT c.relname AS child
    FROM   pg_inherits i
    JOIN   pg_class    c ON c.oid = i.inhrelid
    JOIN   pg_class    p ON p.oid = i.inhparent
    WHERE  p.relname = 'call_events'
  LOOP
    tbl := r.child;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl AND policyname = 'call_events_isolation'
    ) THEN
      EXECUTE format(
        'CREATE POLICY call_events_isolation ON public.%I USING (org_id = auth_org()) WITH CHECK (org_id = auth_org())',
        tbl
      );
    END IF;
  END LOOP;

  -- usage_ledger partitions
  FOR r IN
    SELECT c.relname AS child
    FROM   pg_inherits i
    JOIN   pg_class    c ON c.oid = i.inhrelid
    JOIN   pg_class    p ON p.oid = i.inhparent
    WHERE  p.relname = 'usage_ledger'
  LOOP
    tbl := r.child;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl AND policyname = 'usage_ledger_read'
    ) THEN
      EXECUTE format(
        'CREATE POLICY usage_ledger_read ON public.%I FOR SELECT USING (org_id = auth_org())',
        tbl
      );
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl AND policyname = 'usage_ledger_insert'
    ) THEN
      EXECUTE format(
        'CREATE POLICY usage_ledger_insert ON public.%I FOR INSERT WITH CHECK (org_id = auth_org())',
        tbl
      );
    END IF;
  END LOOP;

  -- webhook_events partitions
  FOR r IN
    SELECT c.relname AS child
    FROM   pg_inherits i
    JOIN   pg_class    c ON c.oid = i.inhrelid
    JOIN   pg_class    p ON p.oid = i.inhparent
    WHERE  p.relname = 'webhook_events'
  LOOP
    tbl := r.child;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl AND policyname = 'webhook_events_read'
    ) THEN
      EXECUTE format(
        'CREATE POLICY webhook_events_read ON public.%I FOR SELECT USING (org_id = auth_org())',
        tbl
      );
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl AND policyname = 'webhook_events_insert'
    ) THEN
      EXECUTE format(
        'CREATE POLICY webhook_events_insert ON public.%I FOR INSERT WITH CHECK (org_id = auth_org() OR org_id IS NULL)',
        tbl
      );
    END IF;
  END LOOP;
END $$;


-- ===========================================================================
-- 3. UPDATE ensure_monthly_partitions TO CREATE POLICIES ON FUTURE PARTITIONS
-- ===========================================================================
-- The prior version (20260627000000) enabled RLS on new partitions but did not
-- create policies. Every new partition would immediately re-trigger the linter
-- warning. This version creates all three policy sets at partition creation time.

CREATE OR REPLACE FUNCTION public.ensure_monthly_partitions(p_months_ahead integer DEFAULT 3)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now    date := date_trunc('month', current_date)::date;
  v_start  date;
  v_end    date;
  v_suffix text;
  v_created int := 0;
  v_table  text;
BEGIN
  FOR i IN 0 .. p_months_ahead LOOP
    v_start  := (v_now + (i || ' month')::interval)::date;
    v_end    := (v_now + ((i + 1) || ' month')::interval)::date;
    v_suffix := to_char(v_start, 'YYYY_MM');

    FOREACH v_table IN ARRAY ARRAY['call_events', 'webhook_events', 'usage_ledger'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_class WHERE relname = v_table || '_' || v_suffix
      ) THEN
        EXECUTE format(
          'CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES FROM (%L) TO (%L)',
          v_table || '_' || v_suffix, v_table, v_start, v_end
        );
        EXECUTE format(
          'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
          v_table || '_' || v_suffix
        );

        -- Create policies matching the parent table definitions
        IF v_table = 'call_events' THEN
          EXECUTE format(
            'CREATE POLICY call_events_isolation ON public.%I USING (org_id = auth_org()) WITH CHECK (org_id = auth_org())',
            v_table || '_' || v_suffix
          );
        ELSIF v_table = 'usage_ledger' THEN
          EXECUTE format(
            'CREATE POLICY usage_ledger_read ON public.%I FOR SELECT USING (org_id = auth_org())',
            v_table || '_' || v_suffix
          );
          EXECUTE format(
            'CREATE POLICY usage_ledger_insert ON public.%I FOR INSERT WITH CHECK (org_id = auth_org())',
            v_table || '_' || v_suffix
          );
        ELSIF v_table = 'webhook_events' THEN
          EXECUTE format(
            'CREATE POLICY webhook_events_read ON public.%I FOR SELECT USING (org_id = auth_org())',
            v_table || '_' || v_suffix
          );
          EXECUTE format(
            'CREATE POLICY webhook_events_insert ON public.%I FOR INSERT WITH CHECK (org_id = auth_org() OR org_id IS NULL)',
            v_table || '_' || v_suffix
          );
        END IF;

        v_created := v_created + 1;
      END IF;
    END LOOP;
  END LOOP;
  RETURN v_created;
END;
$$;

-- NOTE: Leaked Password Protection (auth.leaked_password_protection) cannot be
-- enabled via SQL migration. Enable it manually in the Supabase Dashboard:
--   Authentication > Providers > Email > "Leaked Password Protection" toggle.

NOTIFY pgrst, 'reload schema';
