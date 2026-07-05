-- Database Security Hardening Migration
-- Date: 2026-06-27

-- 1. Enable RLS on existing dynamic partition tables
ALTER TABLE IF EXISTS public.call_events_2026_06 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.call_events_2026_07 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.call_events_2026_08 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.call_events_2026_09 ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.usage_ledger_2026_06 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.usage_ledger_2026_07 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.usage_ledger_2026_08 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.usage_ledger_2026_09 ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.webhook_events_2026_06 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.webhook_events_2026_07 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.webhook_events_2026_08 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.webhook_events_2026_09 ENABLE ROW LEVEL SECURITY;

-- 2. Redefine ensure_monthly_partitions to automatically enable RLS on future partitions and set search_path
CREATE OR REPLACE FUNCTION public.ensure_monthly_partitions(p_months_ahead integer DEFAULT 3)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now date := date_trunc('month', current_date)::date;
  v_start date;
  v_end date;
  v_suffix text;
  v_created int := 0;
  v_table text;
BEGIN
  FOR i IN 0 .. p_months_ahead LOOP
    v_start  := (v_now + (i || ' month')::interval)::date;
    v_end    := (v_now + ((i + 1) || ' month')::interval)::date;
    v_suffix := to_char(v_start, 'YYYY_MM');

    FOREACH v_table IN ARRAY ARRAY['call_events', 'webhook_events', 'usage_ledger'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_class
         WHERE relname = v_table || '_' || v_suffix
      ) THEN
        EXECUTE format(
          'create table %I partition of %I for values from (%L) to (%L)',
          v_table || '_' || v_suffix, v_table, v_start, v_end
        );
        EXECUTE format(
          'alter table %I enable row level security',
          v_table || '_' || v_suffix
        );
        v_created := v_created + 1;
      END IF;
    END LOOP;
  END LOOP;
  RETURN v_created;
END;
$$;

-- 3. Recreate public.v_rls_coverage view using security_invoker = true
DROP VIEW IF EXISTS public.v_rls_coverage CASCADE;
CREATE VIEW public.v_rls_coverage WITH (security_invoker = true) AS
  SELECT
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    coalesce(
      (select count(*) from pg_policies p
        where p.schemaname = 'public' and p.tablename = c.relname),
      0
    ) as policy_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname IN (
      'orgs','users','agents','integrations','contacts','campaigns',
      'campaign_targets','calls','call_events','consent_events','dnc_list',
      'dialer_transitions','webhook_events','subscriptions','usage_ledger'
    );

GRANT SELECT ON public.v_rls_coverage TO anon, authenticated, service_role;

-- 4. Redefine enforce_max_sessions trigger function to fix the ended_at column bug and secure the search_path
CREATE OR REPLACE FUNCTION public.enforce_max_sessions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (SELECT count(*) FROM public.user_sessions WHERE user_id = NEW.user_id AND revoked_at IS NULL) >= 20 THEN
    DELETE FROM public.user_sessions 
    WHERE id = (
      SELECT id FROM public.user_sessions 
      WHERE user_id = NEW.user_id AND revoked_at IS NULL 
      ORDER BY created_at ASC LIMIT 1
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Harden search_path on all other mutable search path functions
ALTER FUNCTION public.reclaim_expired_leases(integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.claim_dial_targets(uuid, integer, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.gdpr_hash_e164(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.block_mutation() SET search_path = public, pg_temp;
ALTER FUNCTION public.apply_consent_event() SET search_path = public, pg_temp;
ALTER FUNCTION public.can_dial(uuid, text, timestamp with time zone, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.gdpr_erase(uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.auth_org() SET search_path = public, pg_temp;
ALTER FUNCTION public.force_outbound_consent() SET search_path = public, pg_temp;
ALTER FUNCTION public.bootstrap_onboarding(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.analytics_overview(timestamp with time zone, timestamp with time zone) SET search_path = public, pg_temp;
ALTER FUNCTION public.analytics_outcomes(timestamp with time zone, timestamp with time zone) SET search_path = public, pg_temp;
ALTER FUNCTION public.analytics_optouts(timestamp with time zone, timestamp with time zone) SET search_path = public, pg_temp;
ALTER FUNCTION public.analytics_usage(date) SET search_path = public, pg_temp;
ALTER FUNCTION public.period_bucket(text, timestamp with time zone) SET search_path = public, pg_temp;
ALTER FUNCTION public.increment_referrals_count() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_enterprise_inquiries_updated_at() SET search_path = public, pg_temp;

-- 6. Restrict RPC permissions for the 8 sensitive SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.can_spend(uuid, text, uuid, numeric, timestamp with time zone) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_spend(uuid, text, uuid, numeric, timestamp with time zone) TO service_role;

REVOKE EXECUTE ON FUNCTION public.check_inbound_rate(uuid, text, text, timestamp with time zone, integer, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_inbound_rate(uuid, text, text, timestamp with time zone, integer, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_inbound_rate_counters(timestamp with time zone) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_inbound_rate_counters(timestamp with time zone) TO service_role;

REVOKE EXECUTE ON FUNCTION public.commit_spend(uuid, text, uuid, numeric, numeric, timestamp with time zone) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_spend(uuid, text, uuid, numeric, numeric, timestamp with time zone) TO service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_oauth_user() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_oauth_user() TO service_role;

REVOKE EXECUTE ON FUNCTION public.release_spend(uuid, text, uuid, numeric, timestamp with time zone) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_spend(uuid, text, uuid, numeric, timestamp with time zone) TO service_role;

REVOKE EXECUTE ON FUNCTION public.reserve_spend(uuid, text, uuid, numeric, timestamp with time zone) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_spend(uuid, text, uuid, numeric, timestamp with time zone) TO service_role;

REVOKE EXECUTE ON FUNCTION public.seed_demo_data(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_demo_data(uuid) TO service_role;

-- 7. Move vector extension to dedicated extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION vector SET SCHEMA extensions;

-- 8. Tighten waitlist permissive RLS policy
DROP POLICY IF EXISTS "anyone_can_join_waitlist" ON public.waitlist;
CREATE POLICY "anyone_can_join_waitlist" ON public.waitlist
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL 
    AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    AND length(name) >= 1
    AND length(name) <= 80
  );

-- 9. Add RLS policy to broadcasts table
DROP POLICY IF EXISTS "service_role_access_only" ON public.broadcasts;
CREATE POLICY "service_role_access_only" ON public.broadcasts
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
