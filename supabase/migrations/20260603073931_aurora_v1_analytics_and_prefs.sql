/*
  # Aurora v1: User notification prefs + analytics RPCs + onboarding bootstrap

  1. New Tables
    - `user_notification_prefs` - per-user channel/event toggles

  2. New Functions
    - `analytics_overview(p_from, p_to)` - dashboard overview metrics
    - `analytics_outcomes(p_from, p_to)` - outcomes breakdown by type
    - `analytics_optouts(p_from, p_to)` - daily opt-out rate
    - `analytics_usage(p_period)` - usage vs included minutes
    - `bootstrap_onboarding(p_org)` - idempotent init of onboarding_state

  3. Notes
    - All analytics RPCs filter by auth_org() so RLS-safe
*/

CREATE TABLE IF NOT EXISTS user_notification_prefs (
  user_id    uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  org_id     uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  email      jsonb NOT NULL DEFAULT '{"missed_call":true,"voicemail":true,"campaign_done":true,"billing":true,"integration_broken":true}'::jsonb,
  in_app     jsonb NOT NULL DEFAULT '{"missed_call":true,"voicemail":true,"campaign_done":true,"billing":true,"integration_broken":true}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_notification_prefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS unp_select ON user_notification_prefs;
CREATE POLICY unp_select ON user_notification_prefs FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS unp_upsert ON user_notification_prefs;
CREATE POLICY unp_upsert ON user_notification_prefs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS unp_update ON user_notification_prefs;
CREATE POLICY unp_update ON user_notification_prefs FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Onboarding bootstrap
CREATE OR REPLACE FUNCTION bootstrap_onboarding(p_org uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO onboarding_state (org_id, steps)
  VALUES (p_org, '{"pick_vertical":false,"connect_tools":false,"add_knowledge":false,"create_agent":false,"get_number":false,"test_and_golive":false}'::jsonb)
  ON CONFLICT (org_id) DO NOTHING;
END $$;

-- analytics_overview
CREATE OR REPLACE FUNCTION analytics_overview(p_from timestamptz, p_to timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_org uuid := auth_org();
  v_calls_total int;
  v_completed int;
  v_voicemail int;
  v_avg_duration numeric;
  v_optouts int;
  v_minutes numeric;
  v_carts_recovered numeric;
  v_bookings int;
BEGIN
  IF v_org IS NULL THEN RETURN '{}'::jsonb; END IF;

  SELECT COUNT(*) INTO v_calls_total
    FROM calls WHERE org_id = v_org AND created_at >= p_from AND created_at < p_to;
  SELECT COUNT(*) INTO v_completed
    FROM calls WHERE org_id = v_org AND status = 'completed' AND created_at >= p_from AND created_at < p_to;
  SELECT COUNT(*) INTO v_voicemail
    FROM calls WHERE org_id = v_org AND status = 'voicemail' AND created_at >= p_from AND created_at < p_to;
  SELECT COALESCE(AVG(duration_sec),0) INTO v_avg_duration
    FROM calls WHERE org_id = v_org AND duration_sec IS NOT NULL AND created_at >= p_from AND created_at < p_to;
  SELECT COUNT(*) INTO v_optouts
    FROM consent_events WHERE org_id = v_org AND kind = 'revoke' AND occurred_at >= p_from AND occurred_at < p_to;
  SELECT COALESCE(SUM(quantity),0) INTO v_minutes
    FROM usage_ledger WHERE org_id = v_org AND kind IN ('voice_minutes','overage_minutes')
      AND occurred_at >= p_from AND occurred_at < p_to;
  SELECT COALESCE(SUM((outcome->>'recovered_value')::numeric),0) INTO v_carts_recovered
    FROM calls WHERE org_id = v_org AND outcome ? 'recovered_value' AND created_at >= p_from AND created_at < p_to;
  SELECT COUNT(*) INTO v_bookings
    FROM calls WHERE org_id = v_org AND (outcome->>'booked')::boolean = true
      AND created_at >= p_from AND created_at < p_to;

  RETURN jsonb_build_object(
    'calls_total', v_calls_total,
    'calls_completed', v_completed,
    'calls_voicemail', v_voicemail,
    'avg_duration_sec', v_avg_duration,
    'opt_outs', v_optouts,
    'minutes_used', v_minutes,
    'carts_recovered_value', v_carts_recovered,
    'bookings', v_bookings
  );
END $$;

-- analytics_outcomes
CREATE OR REPLACE FUNCTION analytics_outcomes(p_from timestamptz, p_to timestamptz)
RETURNS TABLE (outcome_type text, count bigint) LANGUAGE plpgsql STABLE AS $$
DECLARE v_org uuid := auth_org();
BEGIN
  IF v_org IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT key::text, COUNT(*)::bigint
      FROM calls c, jsonb_each_text(c.outcome) AS j(key, value)
     WHERE c.org_id = v_org
       AND c.created_at >= p_from AND c.created_at < p_to
       AND j.value::text IN ('true','"true"')
     GROUP BY key;
END $$;

-- analytics_optouts (daily series)
CREATE OR REPLACE FUNCTION analytics_optouts(p_from timestamptz, p_to timestamptz)
RETURNS TABLE (day date, opt_outs bigint) LANGUAGE plpgsql STABLE AS $$
DECLARE v_org uuid := auth_org();
BEGIN
  IF v_org IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT (occurred_at AT TIME ZONE 'UTC')::date AS day, COUNT(*)::bigint
      FROM consent_events
     WHERE org_id = v_org AND kind = 'revoke'
       AND occurred_at >= p_from AND occurred_at < p_to
     GROUP BY 1
     ORDER BY 1;
END $$;

-- analytics_usage
CREATE OR REPLACE FUNCTION analytics_usage(p_period date)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_org uuid := auth_org();
  v_used numeric;
  v_included int;
  v_overage numeric;
  v_rate numeric;
BEGIN
  IF v_org IS NULL THEN RETURN '{}'::jsonb; END IF;
  SELECT COALESCE(SUM(quantity),0) INTO v_used
    FROM usage_ledger
   WHERE org_id = v_org AND kind IN ('voice_minutes','overage_minutes')
     AND date_trunc('month', occurred_at)::date = date_trunc('month', p_period)::date;
  SELECT included_minutes, overage_rate_usd INTO v_included, v_rate
    FROM subscriptions WHERE org_id = v_org;
  v_included := COALESCE(v_included, 0);
  v_rate     := COALESCE(v_rate, 0);
  v_overage  := GREATEST(0, v_used - v_included);
  RETURN jsonb_build_object(
    'period', p_period,
    'used_minutes', v_used,
    'included_minutes', v_included,
    'overage_minutes', v_overage,
    'overage_cost_usd', v_overage * v_rate,
    'pct_used', CASE WHEN v_included = 0 THEN 0 ELSE (v_used / v_included) * 100 END
  );
END $$;
