/*
  # Aurora v1: Telephony — Twilio subaccounts + phone_numbers

  1. New Tables
    - `twilio_subaccounts` - 1:1 with org for Aurora-managed path (per-tenant isolation + billing)
    - `phone_numbers` - every number, Aurora-managed or BYO; bound to an agent

  2. New Enum
    - `number_owner`: aurora | tenant

  3. Notes
    - secret_ref points at Vault; never store raw Twilio auth tokens
    - Backfills agents.inbound_number into phone_numbers (BYO assumed)
*/

DO $$ BEGIN
  CREATE TYPE number_owner AS ENUM ('aurora','tenant');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS twilio_subaccounts (
  org_id         uuid PRIMARY KEY REFERENCES orgs(id) ON DELETE CASCADE,
  subaccount_sid text NOT NULL,
  secret_ref     text NOT NULL,
  status         text NOT NULL DEFAULT 'active',
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE twilio_subaccounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS twilio_subaccounts_select ON twilio_subaccounts;
CREATE POLICY twilio_subaccounts_select ON twilio_subaccounts FOR SELECT TO authenticated USING (org_id = auth_org());

CREATE TABLE IF NOT EXISTS phone_numbers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  e164         text NOT NULL,
  owner        number_owner NOT NULL,
  byo          boolean NOT NULL DEFAULT false,
  agent_id     uuid REFERENCES agents(id) ON DELETE SET NULL,
  provider_ref text,
  status       text NOT NULL DEFAULT 'active',
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, e164)
);

CREATE INDEX IF NOT EXISTS phone_numbers_org_idx ON phone_numbers (org_id);
CREATE INDEX IF NOT EXISTS phone_numbers_agent_idx ON phone_numbers (agent_id);

ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS phone_numbers_select ON phone_numbers;
CREATE POLICY phone_numbers_select ON phone_numbers FOR SELECT TO authenticated USING (org_id = auth_org());
DROP POLICY IF EXISTS phone_numbers_insert ON phone_numbers;
CREATE POLICY phone_numbers_insert ON phone_numbers FOR INSERT TO authenticated WITH CHECK (org_id = auth_org());
DROP POLICY IF EXISTS phone_numbers_update ON phone_numbers;
CREATE POLICY phone_numbers_update ON phone_numbers FOR UPDATE TO authenticated USING (org_id = auth_org()) WITH CHECK (org_id = auth_org());
DROP POLICY IF EXISTS phone_numbers_delete ON phone_numbers;
CREATE POLICY phone_numbers_delete ON phone_numbers FOR DELETE TO authenticated USING (org_id = auth_org());

-- Backfill agents.inbound_number into phone_numbers (BYO)
INSERT INTO phone_numbers (org_id, e164, owner, byo, agent_id)
SELECT org_id, inbound_number, 'tenant'::number_owner, true, id
  FROM agents
 WHERE inbound_number IS NOT NULL
ON CONFLICT (org_id, e164) DO NOTHING;
