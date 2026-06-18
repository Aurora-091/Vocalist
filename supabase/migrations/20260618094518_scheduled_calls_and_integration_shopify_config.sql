-- scheduled_calls: delayed outbound call queue for cart recovery, order confirmation, etc.
CREATE TABLE IF NOT EXISTS scheduled_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  agent_id UUID NOT NULL REFERENCES agents(id),
  phone TEXT NOT NULL,
  checkout_id TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB,
  dispatched_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_calls_due
  ON scheduled_calls (status, scheduled_at)
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_calls_checkout_id
  ON scheduled_calls (checkout_id)
  WHERE checkout_id IS NOT NULL;

ALTER TABLE scheduled_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_scheduled_calls" ON scheduled_calls FOR SELECT
  TO authenticated USING (org_id IN (
    SELECT org_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "insert_own_scheduled_calls" ON scheduled_calls FOR INSERT
  TO authenticated WITH CHECK (org_id IN (
    SELECT org_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "update_own_scheduled_calls" ON scheduled_calls FOR UPDATE
  TO authenticated USING (org_id IN (
    SELECT org_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "delete_own_scheduled_calls" ON scheduled_calls FOR DELETE
  TO authenticated USING (org_id IN (
    SELECT org_id FROM users WHERE id = auth.uid()
  ));

-- Add Shopify-specific config columns to integrations table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'integrations' AND column_name = 'agent_id') THEN
    ALTER TABLE integrations ADD COLUMN agent_id UUID REFERENCES agents(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'integrations' AND column_name = 'call_delay_minutes') THEN
    ALTER TABLE integrations ADD COLUMN call_delay_minutes INTEGER DEFAULT 30;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'integrations' AND column_name = 'max_attempts') THEN
    ALTER TABLE integrations ADD COLUMN max_attempts INTEGER DEFAULT 2;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'integrations' AND column_name = 'call_hours_start') THEN
    ALTER TABLE integrations ADD COLUMN call_hours_start INTEGER DEFAULT 9;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'integrations' AND column_name = 'call_hours_end') THEN
    ALTER TABLE integrations ADD COLUMN call_hours_end INTEGER DEFAULT 20;
  END IF;
END
$$;