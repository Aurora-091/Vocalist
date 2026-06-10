-- Supabase Migration: ElevenLabs Conversational AI Architecture Support

DO $$ BEGIN
  ALTER TYPE webhook_source ADD VALUE IF NOT EXISTS 'elevenlabs';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. Alter agents and calls tables to support ElevenLabs
ALTER TABLE agents ADD COLUMN IF NOT EXISTS provider_agent_id text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS conversation_config_id text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS sync_status text CHECK (sync_status IN ('pending', 'synced', 'failed')) DEFAULT 'pending';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

ALTER TABLE calls ADD COLUMN IF NOT EXISTS conversation_id text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS transcript_id text;

-- 2. Create indexes on agents table
CREATE INDEX IF NOT EXISTS idx_agents_org ON agents (org_id);
CREATE INDEX IF NOT EXISTS idx_agents_provider ON agents (provider);
CREATE INDEX IF NOT EXISTS idx_agents_provider_agent ON agents (provider_agent_id);

-- 3. Add constraints to agents table
-- Note: UNIQUE(org_id, lower(name)) and UNIQUE(org_id, provider_agent_id)
-- We use unique indexes to support lower(name) in postgresql
CREATE UNIQUE INDEX IF NOT EXISTS uniq_idx_agents_org_lower_name ON agents (org_id, lower(name)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_idx_agents_org_provider_agent ON agents (org_id, provider_agent_id) WHERE deleted_at IS NULL AND provider_agent_id IS NOT NULL;

-- 4. Create organization_agents registry table
CREATE TABLE IF NOT EXISTS organization_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'elevenlabs',
  provider_agent_id text,
  voice_id text,
  phone_number_id text,
  conversation_config_id text,
  sync_status text CHECK (sync_status IN ('pending', 'synced', 'failed')) DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for organization_agents
CREATE INDEX IF NOT EXISTS idx_organization_agents_org ON organization_agents (org_id);
CREATE INDEX IF NOT EXISTS idx_organization_agents_agent ON organization_agents (agent_id);
CREATE INDEX IF NOT EXISTS idx_organization_agents_provider ON organization_agents (provider);

-- Unique constraints for organization_agents
CREATE UNIQUE INDEX IF NOT EXISTS uniq_idx_organization_agents_org_agent ON organization_agents (org_id, agent_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_idx_organization_agents_org_provider_agent ON organization_agents (org_id, provider_agent_id) WHERE provider_agent_id IS NOT NULL;

-- Enable RLS on organization_agents
ALTER TABLE organization_agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_agents_isolation ON organization_agents;
CREATE POLICY organization_agents_isolation ON organization_agents
  USING (org_id = auth_org())
  WITH CHECK (org_id = auth_org());

-- 5. Create knowledge_provider_mappings table
CREATE TABLE IF NOT EXISTS knowledge_provider_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  knowledge_source_id uuid NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_knowledge_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for knowledge_provider_mappings
CREATE INDEX IF NOT EXISTS idx_knowledge_provider_mappings_org ON knowledge_provider_mappings (org_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_provider_mappings_source ON knowledge_provider_mappings (knowledge_source_id);

-- Unique constraints for knowledge_provider_mappings
CREATE UNIQUE INDEX IF NOT EXISTS uniq_idx_knowledge_provider_mappings_org_source ON knowledge_provider_mappings (org_id, knowledge_source_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_idx_knowledge_provider_mappings_org_provider_knowledge ON knowledge_provider_mappings (org_id, provider_knowledge_id);

-- Enable RLS on knowledge_provider_mappings
ALTER TABLE knowledge_provider_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS knowledge_provider_mappings_isolation ON knowledge_provider_mappings;
CREATE POLICY knowledge_provider_mappings_isolation ON knowledge_provider_mappings
  USING (org_id = auth_org())
  WITH CHECK (org_id = auth_org());
