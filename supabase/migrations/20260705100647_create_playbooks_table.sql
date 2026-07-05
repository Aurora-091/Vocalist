/*
# Create playbooks table

## Summary
Playbooks define multi-flow call configurations for Shopify integrations.
Each playbook belongs to an org and configures a specific call flow
(cart_recovery, cod_confirm, feedback) with its own agent, timing, and retry settings.

## New Tables
- `playbooks`
  - `id` (uuid, primary key)
  - `org_id` (uuid, foreign key to orgs, not null)
  - `key` (text, not null) — flow identifier: cart_recovery, cod_confirm, feedback
  - `agent_id` (uuid, foreign key to agents)
  - `enabled` (boolean, default true)
  - `delay_minutes` (integer, default 30) — delay before first call
  - `max_attempts` (integer, default 3) — max retry attempts
  - `call_hours_start` (integer, default 9) — start of calling window (hour)
  - `call_hours_end` (integer, default 21) — end of calling window (hour)
  - `timezone` (text, default 'Asia/Kolkata')
  - `config` (jsonb, default '{}') — additional flow-specific config
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

## Security
- RLS enabled with org-scoped policies using auth_org() (project convention)
- Single policy for all operations scoped to org

## Constraints
- Unique constraint on (org_id, key) to prevent duplicate playbooks per org

## Important Notes
1. This table is managed by the backend; frontend access is through API endpoints.
2. The `key` column uses text (not enum) for flexibility in adding new flows.
3. Uses auth_org() for RLS consistent with agents, integrations, etc.
*/

CREATE TABLE IF NOT EXISTS playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  key text NOT NULL,
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  enabled boolean NOT NULL DEFAULT true,
  delay_minutes integer NOT NULL DEFAULT 30,
  max_attempts integer NOT NULL DEFAULT 3,
  call_hours_start integer NOT NULL DEFAULT 9,
  call_hours_end integer NOT NULL DEFAULT 21,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  config jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT playbooks_org_key_unique UNIQUE (org_id, key)
);

ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "playbooks_isolation" ON playbooks;
CREATE POLICY "playbooks_isolation" ON playbooks
  FOR ALL
  TO authenticated
  USING (org_id = auth_org())
  WITH CHECK (org_id = auth_org());

CREATE INDEX IF NOT EXISTS idx_playbooks_org_id ON playbooks (org_id);
CREATE INDEX IF NOT EXISTS idx_playbooks_org_key ON playbooks (org_id, key);
