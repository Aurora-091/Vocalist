/*
  # Aurora v1: Notifications, Webhooks-Out, Usage Alerts, Plan Tiers

  1. New Tables
    - `notifications` - in-app feed + email dispatch queue
    - `webhook_endpoints` - tenant-configured outbound webhooks (HMAC signed)
    - `usage_alerts` - one-shot 80%/100% alert dedup per period
    - `plan_tiers` - Starter/Growth/Pro tier configuration

  2. Modified Tables
    - `subscriptions`: add `included_numbers int`, `overage_rate_usd numeric(12,4)`

  3. New Enum
    - `notification_kind`: missed_call | voicemail | campaign_done | billing | integration_broken
*/

DO $$ BEGIN
  CREATE TYPE notification_kind AS ENUM ('missed_call','voicemail','campaign_done','billing','integration_broken');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  kind       notification_kind NOT NULL,
  payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_org_created_idx ON notifications (org_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_select ON notifications;
CREATE POLICY notifications_select ON notifications FOR SELECT TO authenticated USING (org_id = auth_org());
DROP POLICY IF EXISTS notifications_update ON notifications;
CREATE POLICY notifications_update ON notifications FOR UPDATE TO authenticated USING (org_id = auth_org()) WITH CHECK (org_id = auth_org());

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  url        text NOT NULL,
  events     text[] NOT NULL DEFAULT '{call.completed}',
  secret_ref text,
  status     text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhook_endpoints_org_idx ON webhook_endpoints (org_id);

ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS webhook_endpoints_select ON webhook_endpoints;
CREATE POLICY webhook_endpoints_select ON webhook_endpoints FOR SELECT TO authenticated USING (org_id = auth_org());
DROP POLICY IF EXISTS webhook_endpoints_insert ON webhook_endpoints;
CREATE POLICY webhook_endpoints_insert ON webhook_endpoints FOR INSERT TO authenticated WITH CHECK (org_id = auth_org());
DROP POLICY IF EXISTS webhook_endpoints_update ON webhook_endpoints;
CREATE POLICY webhook_endpoints_update ON webhook_endpoints FOR UPDATE TO authenticated USING (org_id = auth_org()) WITH CHECK (org_id = auth_org());
DROP POLICY IF EXISTS webhook_endpoints_delete ON webhook_endpoints;
CREATE POLICY webhook_endpoints_delete ON webhook_endpoints FOR DELETE TO authenticated USING (org_id = auth_org());

-- Usage alerts: one-shot dedup
CREATE TABLE IF NOT EXISTS usage_alerts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  period     date NOT NULL,
  threshold  int NOT NULL,
  sent_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, period, threshold)
);

CREATE INDEX IF NOT EXISTS usage_alerts_org_idx ON usage_alerts (org_id);

ALTER TABLE usage_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS usage_alerts_select ON usage_alerts;
CREATE POLICY usage_alerts_select ON usage_alerts FOR SELECT TO authenticated USING (org_id = auth_org());

-- subscriptions extensions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='subscriptions' AND column_name='included_numbers') THEN
    ALTER TABLE subscriptions ADD COLUMN included_numbers int NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='subscriptions' AND column_name='overage_rate_usd') THEN
    ALTER TABLE subscriptions ADD COLUMN overage_rate_usd numeric(12,4) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='subscriptions' AND column_name='stripe_usage_item_id') THEN
    ALTER TABLE subscriptions ADD COLUMN stripe_usage_item_id text;
  END IF;
END $$;

-- Plan tiers config (placeholder values, NOT pricing source of truth — Stripe is upstream)
CREATE TABLE IF NOT EXISTS plan_tiers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key               text NOT NULL UNIQUE,
  label             text NOT NULL,
  monthly_usd       numeric(12,2) NOT NULL,
  included_minutes  int NOT NULL,
  included_numbers  int NOT NULL,
  overage_rate_usd  numeric(12,4) NOT NULL,
  features          jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled           boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE plan_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plan_tiers_read_all ON plan_tiers;
CREATE POLICY plan_tiers_read_all ON plan_tiers FOR SELECT TO authenticated USING (true);

INSERT INTO plan_tiers (key, label, monthly_usd, included_minutes, included_numbers, overage_rate_usd, features) VALUES
  ('starter', 'Starter', 49, 300, 1, 0.18,
    '{"agents_max":1,"campaigns":true,"webhooks_out":false,"whitelabel":false}'::jsonb),
  ('growth', 'Growth', 149, 1200, 3, 0.15,
    '{"agents_max":null,"campaigns":true,"webhooks_out":false,"whitelabel":false,"knowledge":true}'::jsonb),
  ('pro', 'Pro', 399, 4000, 10, 0.12,
    '{"agents_max":null,"campaigns":true,"webhooks_out":true,"whitelabel":true,"priority":true}'::jsonb)
ON CONFLICT (key) DO NOTHING;
