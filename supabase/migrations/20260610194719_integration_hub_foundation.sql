-- Phase A: Integration Hub Foundation
-- Extend integration_type enum with new provider values
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'whatsapp';
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'google_sheets';
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'zoho_crm';
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'freshsales';
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'pipedrive';
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'salesforce';
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'cliniko';
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'jane_app';
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'drchrono';
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'hubspot';
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'google_cal';

-- Integration Catalog: global read-only registry of available providers
CREATE TABLE IF NOT EXISTS integration_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  icon_key text NOT NULL,
  category text NOT NULL CHECK (category IN ('ecommerce','messaging','calendar','spreadsheet','crm','ehr','automation')),
  auth_type text NOT NULL CHECK (auth_type IN ('api_key','oauth2','webhook')),
  verticals text[] NOT NULL DEFAULT '{}',
  scopes text[] DEFAULT '{}',
  setup_url text,
  docs_url text,
  setup_instructions jsonb DEFAULT '[]',
  tier_required text DEFAULT 'starter',
  enabled boolean DEFAULT true,
  sort_order int DEFAULT 100,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE integration_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog_read_all" ON integration_catalog FOR SELECT TO authenticated USING (true);

-- Integration Bridge Config: org-specific integration settings for the agent bridge
CREATE TABLE IF NOT EXISTS integration_bridge_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  provider_key text NOT NULL REFERENCES integration_catalog(provider_key),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','error','disconnected')),
  config jsonb DEFAULT '{}',
  secret_ref text,
  scopes_granted text[] DEFAULT '{}',
  last_health_check timestamptz,
  error_message text,
  connected_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, provider_key)
);

ALTER TABLE integration_bridge_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bridge_select_own" ON integration_bridge_config FOR SELECT
  TO authenticated USING (org_id = (auth.jwt()->'app_metadata'->>'org_id')::uuid);
CREATE POLICY "bridge_insert_own" ON integration_bridge_config FOR INSERT
  TO authenticated WITH CHECK (org_id = (auth.jwt()->'app_metadata'->>'org_id')::uuid);
CREATE POLICY "bridge_update_own" ON integration_bridge_config FOR UPDATE
  TO authenticated USING (org_id = (auth.jwt()->'app_metadata'->>'org_id')::uuid)
  WITH CHECK (org_id = (auth.jwt()->'app_metadata'->>'org_id')::uuid);
CREATE POLICY "bridge_delete_own" ON integration_bridge_config FOR DELETE
  TO authenticated USING (org_id = (auth.jwt()->'app_metadata'->>'org_id')::uuid);

-- OAuth Tokens: store refresh/access tokens for OAuth2 integrations
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  provider_key text NOT NULL REFERENCES integration_catalog(provider_key),
  access_token text NOT NULL,
  refresh_token text,
  token_type text DEFAULT 'Bearer',
  expires_at timestamptz,
  scopes text[] DEFAULT '{}',
  raw_response jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, provider_key)
);

ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "oauth_select_own" ON oauth_tokens FOR SELECT
  TO authenticated USING (org_id = (auth.jwt()->'app_metadata'->>'org_id')::uuid);
CREATE POLICY "oauth_insert_own" ON oauth_tokens FOR INSERT
  TO authenticated WITH CHECK (org_id = (auth.jwt()->'app_metadata'->>'org_id')::uuid);
CREATE POLICY "oauth_update_own" ON oauth_tokens FOR UPDATE
  TO authenticated USING (org_id = (auth.jwt()->'app_metadata'->>'org_id')::uuid)
  WITH CHECK (org_id = (auth.jwt()->'app_metadata'->>'org_id')::uuid);
CREATE POLICY "oauth_delete_own" ON oauth_tokens FOR DELETE
  TO authenticated USING (org_id = (auth.jwt()->'app_metadata'->>'org_id')::uuid);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_bridge_config_org ON integration_bridge_config(org_id);
CREATE INDEX IF NOT EXISTS idx_bridge_config_provider ON integration_bridge_config(provider_key);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_org ON oauth_tokens(org_id);
CREATE INDEX IF NOT EXISTS idx_catalog_category ON integration_catalog(category);
CREATE INDEX IF NOT EXISTS idx_catalog_verticals ON integration_catalog USING gin(verticals);
