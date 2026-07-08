/*
  # Restore spend_guards + inbound_rate_counters

  Migration 20260629000000_resolve_schema_and_verticals_gaps.sql dropped both
  tables as "unused", but the SECURITY DEFINER guard RPCs — can_spend(),
  reserve_spend(), release_spend(), commit_spend(), check_inbound_rate() —
  still read/write them, so every call errored with 42P01 at runtime
  (verified live 2026-07-08). That silently bypassed the outbound spend cap
  (dialer fails open) and hard-broke the inbound admission gate
  (webhook handler fails closed) — Non-Negotiables #9/#11/#12.

  Definitions are copied verbatim from:
    - 20260604090200_aurora_phase0_spend_guards.sql
    - 20260604090300_aurora_phase0_inbound_admission.sql
  The functions themselves were never dropped and are not redefined here.
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
  action_kind     text NOT NULL DEFAULT 'pause' CHECK (action_kind IN ('pause','block','warn_only')),
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
-- 2. inbound_rate_counters
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
