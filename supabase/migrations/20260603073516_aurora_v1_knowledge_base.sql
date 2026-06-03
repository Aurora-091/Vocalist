/*
  # Aurora v1: Knowledge Base (pgvector RAG)

  1. New Tables
    - `knowledge_sources` - one upload, crawled site, or integration pull (org-wide library)
    - `knowledge_chunks` - chunked + embedded text with vector(1536) embedding
    - `agent_knowledge` - join: agents subscribe to sources

  2. New Enums
    - `knowledge_kind`: document | website | integration
    - `knowledge_status`: processing | ready | error | syncing

  3. Security
    - RLS on all knowledge tables (org-scoped)
    - Retrieval filter: org_id AND agent's subscribed sources

  4. Notes
    - pgvector extension enabled; ivfflat cosine index on chunks
*/

CREATE EXTENSION IF NOT EXISTS vector;

DO $$ BEGIN
  CREATE TYPE knowledge_kind AS ENUM ('document','website','integration');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE knowledge_status AS ENUM ('processing','ready','error','syncing');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS knowledge_sources (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  kind        knowledge_kind NOT NULL,
  title       text NOT NULL,
  uri         text,
  storage_ref text,
  status      knowledge_status NOT NULL DEFAULT 'processing',
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS knowledge_sources_org_idx ON knowledge_sources (org_id);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  source_id  uuid NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  ordinal    int NOT NULL,
  content    text NOT NULL,
  embedding  vector(1536),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS knowledge_chunks_org_idx ON knowledge_chunks (org_id);
CREATE INDEX IF NOT EXISTS knowledge_chunks_source_idx ON knowledge_chunks (source_id);
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx ON knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE TABLE IF NOT EXISTS agent_knowledge (
  agent_id   uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  source_id  uuid NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  org_id     uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  PRIMARY KEY (agent_id, source_id)
);

CREATE INDEX IF NOT EXISTS agent_knowledge_org_idx ON agent_knowledge (org_id);

ALTER TABLE knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_knowledge   ENABLE ROW LEVEL SECURITY;

-- knowledge_sources policies
DROP POLICY IF EXISTS knowledge_sources_select ON knowledge_sources;
CREATE POLICY knowledge_sources_select ON knowledge_sources FOR SELECT TO authenticated USING (org_id = auth_org());
DROP POLICY IF EXISTS knowledge_sources_insert ON knowledge_sources;
CREATE POLICY knowledge_sources_insert ON knowledge_sources FOR INSERT TO authenticated WITH CHECK (org_id = auth_org());
DROP POLICY IF EXISTS knowledge_sources_update ON knowledge_sources;
CREATE POLICY knowledge_sources_update ON knowledge_sources FOR UPDATE TO authenticated USING (org_id = auth_org()) WITH CHECK (org_id = auth_org());
DROP POLICY IF EXISTS knowledge_sources_delete ON knowledge_sources;
CREATE POLICY knowledge_sources_delete ON knowledge_sources FOR DELETE TO authenticated USING (org_id = auth_org());

-- knowledge_chunks: read only for tenants (writes are service-role)
DROP POLICY IF EXISTS knowledge_chunks_select ON knowledge_chunks;
CREATE POLICY knowledge_chunks_select ON knowledge_chunks FOR SELECT TO authenticated USING (org_id = auth_org());

-- agent_knowledge policies
DROP POLICY IF EXISTS agent_knowledge_select ON agent_knowledge;
CREATE POLICY agent_knowledge_select ON agent_knowledge FOR SELECT TO authenticated USING (org_id = auth_org());
DROP POLICY IF EXISTS agent_knowledge_insert ON agent_knowledge;
CREATE POLICY agent_knowledge_insert ON agent_knowledge FOR INSERT TO authenticated WITH CHECK (org_id = auth_org());
DROP POLICY IF EXISTS agent_knowledge_delete ON agent_knowledge;
CREATE POLICY agent_knowledge_delete ON agent_knowledge FOR DELETE TO authenticated USING (org_id = auth_org());
