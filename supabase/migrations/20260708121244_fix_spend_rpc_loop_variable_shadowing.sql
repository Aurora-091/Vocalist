/*
  # Fix loop-variable shadowing in reserve_spend / release_spend / commit_spend

  All three declare `g RECORD` and also alias spend_guards AS g in the FOR
  query, so PL/pgSQL resolves `g.scope` to the not-yet-assigned record and
  every call fails with `55000: record "g" is not assigned yet` (found while
  verifying the 20260708174500 table restore — these functions have never
  successfully executed their loop). Bodies are otherwise unchanged: the loop
  record is renamed to v_guard and the table alias to sg.
*/

CREATE OR REPLACE FUNCTION public.reserve_spend(p_org uuid, p_scope text, p_scope_id uuid, p_projected_usd numeric, p_now timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_guard RECORD;
BEGIN
  IF p_projected_usd IS NULL OR p_projected_usd <= 0 THEN
    RETURN;
  END IF;

  FOR v_guard IN
    SELECT DISTINCT sg.scope, sg.scope_id, sg.period
      FROM spend_guards sg
     WHERE sg.org_id = p_org
       AND sg.enabled
       AND (
            sg.scope = 'org'
         OR (sg.scope = p_scope AND sg.scope_id IS NOT DISTINCT FROM p_scope_id)
       )
  LOOP
    INSERT INTO spend_counters (org_id, scope, scope_id, period, period_start, reserved_usd, updated_at)
      VALUES (p_org, v_guard.scope, v_guard.scope_id, v_guard.period, period_bucket(v_guard.period, p_now), p_projected_usd, now())
      ON CONFLICT (org_id, scope, coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid), period, period_start)
      DO UPDATE SET
        reserved_usd = spend_counters.reserved_usd + EXCLUDED.reserved_usd,
        updated_at   = now();
  END LOOP;
END $function$;

CREATE OR REPLACE FUNCTION public.release_spend(p_org uuid, p_scope text, p_scope_id uuid, p_projected_usd numeric, p_now timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_guard RECORD;
BEGIN
  IF p_projected_usd IS NULL OR p_projected_usd <= 0 THEN
    RETURN;
  END IF;

  FOR v_guard IN
    SELECT DISTINCT sg.scope, sg.scope_id, sg.period
      FROM spend_guards sg
     WHERE sg.org_id = p_org
       AND sg.enabled
       AND (
            sg.scope = 'org'
         OR (sg.scope = p_scope AND sg.scope_id IS NOT DISTINCT FROM p_scope_id)
       )
  LOOP
    UPDATE spend_counters
       SET reserved_usd = GREATEST(reserved_usd - p_projected_usd, 0),
           updated_at   = now()
     WHERE org_id = p_org
       AND scope  = v_guard.scope
       AND scope_id IS NOT DISTINCT FROM v_guard.scope_id
       AND period = v_guard.period
       AND period_start = period_bucket(v_guard.period, p_now);
  END LOOP;
END $function$;

CREATE OR REPLACE FUNCTION public.commit_spend(p_org uuid, p_scope text, p_scope_id uuid, p_projected_usd numeric, p_actual_usd numeric, p_now timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_guard RECORD;
BEGIN
  IF p_actual_usd IS NULL OR p_actual_usd < 0 THEN
    p_actual_usd := 0;
  END IF;
  IF p_projected_usd IS NULL OR p_projected_usd < 0 THEN
    p_projected_usd := 0;
  END IF;

  FOR v_guard IN
    SELECT DISTINCT sg.scope, sg.scope_id, sg.period
      FROM spend_guards sg
     WHERE sg.org_id = p_org
       AND sg.enabled
       AND (
            sg.scope = 'org'
         OR (sg.scope = p_scope AND sg.scope_id IS NOT DISTINCT FROM p_scope_id)
       )
  LOOP
    -- We may not have a row yet if the org has no guard but we are still
    -- billing; insert-or-update keeps the math correct.
    INSERT INTO spend_counters (org_id, scope, scope_id, period, period_start, spent_usd, reserved_usd, updated_at)
      VALUES (p_org, v_guard.scope, v_guard.scope_id, v_guard.period, period_bucket(v_guard.period, p_now), p_actual_usd, GREATEST(-p_projected_usd, 0), now())
      ON CONFLICT (org_id, scope, coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid), period, period_start)
      DO UPDATE SET
        spent_usd    = spend_counters.spent_usd + p_actual_usd,
        reserved_usd = GREATEST(spend_counters.reserved_usd - p_projected_usd, 0),
        updated_at   = now();
  END LOOP;
END $function$;
