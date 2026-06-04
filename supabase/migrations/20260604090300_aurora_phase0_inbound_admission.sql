/*
  # Aurora Phase 0: inbound_rate_counters + check_inbound_rate()

  Implements Scope §J (Inbound admission flow) and §I.11 (non-negotiable:
  "Inbound passes our admission gate first; no native CAI number binding,
  ever"). Critique #1 fix.

  Why: native CAI number binding answers the call BEFORE any of our guards
  run — that's a free bypass of can_spend() and a trivial cost-bomb /
  DoS vector. We own the DID and the front door. This migration provides
  the sliding-window counters and the gate RPC; the Express handler
  ships in PR 1.5.

  1. New Tables
    - `inbound_rate_counters` — 60-second bucket counters keyed by
      (org_id, bucket_key, window_start). Two dimensions matter:
        * 'from:<e164>' — single caller hammering us
        * 'to:<e164>'   — botnet/cost-bomb against a single Aurora DID
      Both buckets are evaluated on every inbound call.

  2. New Function
    - `check_inbound_rate(org, from_e164, to_e164, now, per_from?, per_to?)`
       returns 'admit' | 'blocked_rate'.
       Atomic UPSERT-and-read for both buckets in one transaction.

  3. Cleanup
    - A `cleanup_inbound_rate_counters()` housekeeping function removes
      rows older than 24 hours. Wire it into pg_cron in a Phase-2 PR
      (or call it from the lease-sweeper worker for now).

  4. Notes
    - Per-tenant threshold overrides live in `spend_guards.action_config`
      JSONB (keys `inbound_per_from`, `inbound_per_to`). The default
      thresholds passed to the function below are conservative (5/from,
      30/to per 60s) and tenant-tunable.
    - RLS: tenants can SELECT their own counters (for debugging /
      visibility). Inserts/updates happen exclusively via the RPC under
      the service role.
*/

------------------------------------------------------------------------
-- 1. inbound_rate_counters
------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inbound_rate_counters (
  org_id       uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  bucket_key   text NOT NULL,                          -- 'from:+1...' | 'to:+1...'
  window_start timestamptz NOT NULL,                   -- minute-aligned
  call_count   integer NOT NULL DEFAULT 0 CHECK (call_count >= 0),
  PRIMARY KEY (org_id, bucket_key, window_start)
);

CREATE INDEX IF NOT EXISTS inbound_rate_counters_gc_idx
  ON inbound_rate_counters (window_start);

ALTER TABLE inbound_rate_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inbound_rate_counters_select ON inbound_rate_counters;
CREATE POLICY inbound_rate_counters_select ON inbound_rate_counters FOR SELECT TO authenticated
  USING (org_id = auth_org());

------------------------------------------------------------------------
-- 2. check_inbound_rate()
------------------------------------------------------------------------
-- Increments both the from-key and to-key buckets atomically and returns
-- 'admit' if neither exceeds its threshold, else 'blocked_rate'.
-- The increment happens BEFORE the threshold comparison so a burst that
-- crosses the limit on the call that crosses it is correctly rejected.
CREATE OR REPLACE FUNCTION check_inbound_rate(
  p_org        uuid,
  p_from_e164  text,
  p_to_e164    text,
  p_now        timestamptz,
  p_per_from   integer DEFAULT 5,        -- caller velocity, per 60s
  p_per_to     integer DEFAULT 30        -- DID velocity, per 60s
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_window     timestamptz := date_trunc('minute', p_now);
  v_from_count integer;
  v_to_count   integer;
BEGIN
  IF p_org IS NULL OR p_from_e164 IS NULL OR p_to_e164 IS NULL THEN
    RAISE EXCEPTION 'check_inbound_rate: org, from_e164, to_e164 are required';
  END IF;

  -- From-key bucket
  INSERT INTO inbound_rate_counters (org_id, bucket_key, window_start, call_count)
    VALUES (p_org, 'from:' || p_from_e164, v_window, 1)
    ON CONFLICT (org_id, bucket_key, window_start)
      DO UPDATE SET call_count = inbound_rate_counters.call_count + 1
    RETURNING call_count INTO v_from_count;

  -- To-key bucket
  INSERT INTO inbound_rate_counters (org_id, bucket_key, window_start, call_count)
    VALUES (p_org, 'to:' || p_to_e164, v_window, 1)
    ON CONFLICT (org_id, bucket_key, window_start)
      DO UPDATE SET call_count = inbound_rate_counters.call_count + 1
    RETURNING call_count INTO v_to_count;

  IF v_from_count > p_per_from OR v_to_count > p_per_to THEN
    RETURN 'blocked_rate';
  END IF;
  RETURN 'admit';
END $$;

------------------------------------------------------------------------
-- 3. cleanup
------------------------------------------------------------------------
-- Deletes buckets older than 24 hours. Wire to pg_cron in a later PR;
-- in the meantime any worker can call this periodically.
CREATE OR REPLACE FUNCTION cleanup_inbound_rate_counters(p_now timestamptz DEFAULT now())
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM inbound_rate_counters
   WHERE window_start < (p_now - INTERVAL '24 hours');
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END $$;
