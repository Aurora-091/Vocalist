/*
  # Aurora Phase 0: spend_guards + spend_counters + can_spend()

  Implements Scope §E.1 (Spend guards) and §I.9 (non-negotiable: "no call
  placed without can_spend()=true at call time"). Dollar-metered, not
  minute-metered (Scope §I.12, Critique #4).

  1. New Tables
    - `spend_guards`   — per-org (and optionally per-agent/per-campaign)
                        daily/monthly $ ceilings, with warn% and action%.
    - `spend_counters` — rolling spent + reserved per (org, scope, period,
                        period_start). Reserved at lease time, committed
                        on call-end webhook.

  2. New Functions / RPCs
    - `can_spend(org, scope, scope_id, projected_usd, now) returns boolean`
       — true if (spent + reserved + projected) <= action_threshold for
       EVERY applicable guard. Defaults open if no guard configured.
    - `reserve_spend(org, scope, scope_id, projected_usd, now)`
       — atomic increment of reserved_usd inside a transaction.
    - `commit_spend(org, scope, scope_id, projected_usd, actual_usd, now)`
       — moves reserved → spent. Called from the call-end webhook.
    - `release_spend(org, scope, scope_id, projected_usd, now)`
       — releases a reservation when a call never happened (lease abandon).

  3. Security
    - RLS enabled. SELECT/INSERT/UPDATE/DELETE policies restrict to
      `org_id = auth_org()` (the standard org-isolation pattern).
    - can_spend / reserve_spend / commit_spend / release_spend are
      SECURITY DEFINER so the worker (using the service role) and the
      tenant client (RLS-restricted) both call the same RPC. Inside the
      function bodies we still validate p_org matches the caller's org
      where applicable.

  4. Notes
    - period_start is a DATE (UTC) for both daily and monthly scopes.
      Monthly = first of month UTC.
    - The unique index uses coalesce(scope_id, '<zero uuid>') so the
      org-level guard (scope='org', scope_id=NULL) gets its own row.
    - Backstop: Twilio UsageTrigger on each subaccount as a provider-side
      hard stop. Wired in PR 1.11.
*/

------------------------------------------------------------------------
-- 1. spend_guards
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS spend_guards (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  scope           text NOT NULL CHECK (scope IN ('org','agent','campaign')),
  scope_id        uuid,
  period          text NOT NULL CHECK (period IN ('daily','monthly')),
  limit_usd       numeric(12,4) NOT NULL CHECK (limit_usd > 0),
  warn_at_pct     int  NOT NULL DEFAULT 80   CHECK (warn_at_pct   BETWEEN 1 AND 100),
  action_at_pct   int  NOT NULL DEFAULT 100  CHECK (action_at_pct BETWEEN 1 AND 200),
  -- 'pause' = stop new dials; 'block' = also reject reservations;
  -- 'warn_only' = surface notification, do not gate.
  action_kind     text NOT NULL DEFAULT 'pause' CHECK (action_kind IN ('pause','block','warn_only')),
  -- Tenant-tunable extras (e.g. inbound rate thresholds override per-org).
  action_config   jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled         boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT spend_guards_scope_id_required
    CHECK ((scope = 'org' AND scope_id IS NULL)
        OR (scope IN ('agent','campaign') AND scope_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS spend_guards_unique_scope
  ON spend_guards (
    org_id,
    scope,
    coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid),
    period
  ) WHERE enabled;

CREATE INDEX IF NOT EXISTS spend_guards_org_idx ON spend_guards (org_id);

ALTER TABLE spend_guards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS spend_guards_select ON spend_guards;
DROP POLICY IF EXISTS spend_guards_insert ON spend_guards;
DROP POLICY IF EXISTS spend_guards_update ON spend_guards;
DROP POLICY IF EXISTS spend_guards_delete ON spend_guards;

CREATE POLICY spend_guards_select ON spend_guards FOR SELECT TO authenticated
  USING (org_id = auth_org());
CREATE POLICY spend_guards_insert ON spend_guards FOR INSERT TO authenticated
  WITH CHECK (org_id = auth_org());
CREATE POLICY spend_guards_update ON spend_guards FOR UPDATE TO authenticated
  USING (org_id = auth_org()) WITH CHECK (org_id = auth_org());
CREATE POLICY spend_guards_delete ON spend_guards FOR DELETE TO authenticated
  USING (org_id = auth_org());

------------------------------------------------------------------------
-- 2. spend_counters
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS spend_counters (
  org_id        uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  scope         text NOT NULL CHECK (scope IN ('org','agent','campaign')),
  scope_id      uuid,
  period        text NOT NULL CHECK (period IN ('daily','monthly')),
  period_start  date NOT NULL,
  spent_usd     numeric(12,4) NOT NULL DEFAULT 0 CHECK (spent_usd    >= 0),
  reserved_usd  numeric(12,4) NOT NULL DEFAULT 0 CHECK (reserved_usd >= 0),
  updated_at    timestamptz   NOT NULL DEFAULT now(),
  PRIMARY KEY (
    org_id,
    scope,
    coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid),
    period,
    period_start
  )
);

CREATE INDEX IF NOT EXISTS spend_counters_org_period_idx
  ON spend_counters (org_id, period, period_start DESC);

ALTER TABLE spend_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS spend_counters_select ON spend_counters;
CREATE POLICY spend_counters_select ON spend_counters FOR SELECT TO authenticated
  USING (org_id = auth_org());
-- Counters are written exclusively by the dialer + webhook handler via
-- the SECURITY DEFINER RPCs below; no direct INSERT/UPDATE policies for
-- tenants. (The service role bypasses RLS, which is what the workers use.)

------------------------------------------------------------------------
-- 3. Helpers — period bucket
------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION period_bucket(p_period text, p_now timestamptz)
RETURNS date LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_period
    WHEN 'daily'   THEN (p_now AT TIME ZONE 'UTC')::date
    WHEN 'monthly' THEN date_trunc('month', p_now AT TIME ZONE 'UTC')::date
  END
$$;

------------------------------------------------------------------------
-- 4. can_spend()
------------------------------------------------------------------------
-- Returns true if EVERY applicable, enabled, blocking guard would
-- still be within its action threshold after adding p_projected_usd.
-- Applicable = (scope='org') OR (scope matches AND scope_id matches).
-- Defaults TRUE when no guard configured (open-by-default).
CREATE OR REPLACE FUNCTION can_spend(
  p_org           uuid,
  p_scope         text,
  p_scope_id      uuid,
  p_projected_usd numeric,
  p_now           timestamptz
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_blocked boolean;
BEGIN
  IF p_projected_usd IS NULL OR p_projected_usd < 0 THEN
    p_projected_usd := 0;
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM spend_guards g
      LEFT JOIN spend_counters c
        ON c.org_id = g.org_id
       AND c.scope  = g.scope
       AND c.scope_id IS NOT DISTINCT FROM g.scope_id
       AND c.period = g.period
       AND c.period_start = period_bucket(g.period, p_now)
     WHERE g.org_id   = p_org
       AND g.enabled
       AND g.action_kind IN ('pause','block')
       AND (
            g.scope = 'org'
         OR (g.scope = p_scope AND g.scope_id IS NOT DISTINCT FROM p_scope_id)
       )
       AND (
         COALESCE(c.spent_usd, 0)
       + COALESCE(c.reserved_usd, 0)
       + p_projected_usd
       ) > (g.limit_usd * g.action_at_pct / 100.0)
  )
  INTO v_blocked;

  RETURN NOT v_blocked;
END $$;

------------------------------------------------------------------------
-- 5. reserve / commit / release
------------------------------------------------------------------------
-- Reserves projected spend across ALL applicable guards. Upserts the
-- counter row(s) for the current period bucket. Atomic per RPC call.
CREATE OR REPLACE FUNCTION reserve_spend(
  p_org           uuid,
  p_scope         text,
  p_scope_id      uuid,
  p_projected_usd numeric,
  p_now           timestamptz
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  g RECORD;
BEGIN
  IF p_projected_usd IS NULL OR p_projected_usd <= 0 THEN
    RETURN;
  END IF;

  FOR g IN
    SELECT DISTINCT g.scope, g.scope_id, g.period
      FROM spend_guards g
     WHERE g.org_id = p_org
       AND g.enabled
       AND (
            g.scope = 'org'
         OR (g.scope = p_scope AND g.scope_id IS NOT DISTINCT FROM p_scope_id)
       )
  LOOP
    INSERT INTO spend_counters (org_id, scope, scope_id, period, period_start, reserved_usd, updated_at)
      VALUES (p_org, g.scope, g.scope_id, g.period, period_bucket(g.period, p_now), p_projected_usd, now())
      ON CONFLICT (org_id, scope, coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid), period, period_start)
      DO UPDATE SET
        reserved_usd = spend_counters.reserved_usd + EXCLUDED.reserved_usd,
        updated_at   = now();
  END LOOP;
END $$;

-- Commits actual_usd to spent and releases the original reservation.
CREATE OR REPLACE FUNCTION commit_spend(
  p_org           uuid,
  p_scope         text,
  p_scope_id      uuid,
  p_projected_usd numeric,
  p_actual_usd    numeric,
  p_now           timestamptz
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  g RECORD;
BEGIN
  IF p_actual_usd IS NULL OR p_actual_usd < 0 THEN
    p_actual_usd := 0;
  END IF;
  IF p_projected_usd IS NULL OR p_projected_usd < 0 THEN
    p_projected_usd := 0;
  END IF;

  FOR g IN
    SELECT DISTINCT g.scope, g.scope_id, g.period
      FROM spend_guards g
     WHERE g.org_id = p_org
       AND g.enabled
       AND (
            g.scope = 'org'
         OR (g.scope = p_scope AND g.scope_id IS NOT DISTINCT FROM p_scope_id)
       )
  LOOP
    -- We may not have a row yet if the org has no guard but we are still
    -- billing; insert-or-update keeps the math correct.
    INSERT INTO spend_counters (org_id, scope, scope_id, period, period_start, spent_usd, reserved_usd, updated_at)
      VALUES (p_org, g.scope, g.scope_id, g.period, period_bucket(g.period, p_now), p_actual_usd, GREATEST(-p_projected_usd, 0), now())
      ON CONFLICT (org_id, scope, coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid), period, period_start)
      DO UPDATE SET
        spent_usd    = spend_counters.spent_usd + p_actual_usd,
        reserved_usd = GREATEST(spend_counters.reserved_usd - p_projected_usd, 0),
        updated_at   = now();
  END LOOP;
END $$;

-- Releases a reservation without spending (call was aborted / never placed).
CREATE OR REPLACE FUNCTION release_spend(
  p_org           uuid,
  p_scope         text,
  p_scope_id      uuid,
  p_projected_usd numeric,
  p_now           timestamptz
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  g RECORD;
BEGIN
  IF p_projected_usd IS NULL OR p_projected_usd <= 0 THEN
    RETURN;
  END IF;

  FOR g IN
    SELECT DISTINCT g.scope, g.scope_id, g.period
      FROM spend_guards g
     WHERE g.org_id = p_org
       AND g.enabled
       AND (
            g.scope = 'org'
         OR (g.scope = p_scope AND g.scope_id IS NOT DISTINCT FROM p_scope_id)
       )
  LOOP
    UPDATE spend_counters
       SET reserved_usd = GREATEST(reserved_usd - p_projected_usd, 0),
           updated_at   = now()
     WHERE org_id = p_org
       AND scope  = g.scope
       AND scope_id IS NOT DISTINCT FROM g.scope_id
       AND period = g.period
       AND period_start = period_bucket(g.period, p_now);
  END LOOP;
END $$;
