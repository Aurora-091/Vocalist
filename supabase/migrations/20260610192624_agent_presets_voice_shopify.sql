/*
  # Agent Presets, Voice Catalog, Shopify Integration

  1. agent_presets - global templates per vertical (read-only to tenants)
  2. voice_catalog - cached ElevenLabs voice directory
  3. shopify_connections - org-scoped Shopify API key references
  4. shopify_cache - read-through cache for Shopify API responses
*/

-- agent_presets: global, not org-scoped
CREATE TABLE IF NOT EXISTS agent_presets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical_key     text NOT NULL,
  preset_key       text NOT NULL UNIQUE,
  name             text NOT NULL,
  description      text NOT NULL DEFAULT '',
  direction        text NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound','outbound','both')),
  persona          jsonb NOT NULL DEFAULT '{}'::jsonb,
  tools            jsonb NOT NULL DEFAULT '[]'::jsonb,
  voice_id         text,
  voice_name       text,
  languages        text[] NOT NULL DEFAULT ARRAY['en']::text[],
  consent_required boolean NOT NULL DEFAULT false,
  sort_order       int NOT NULL DEFAULT 0,
  enabled          boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE agent_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_presets_read_all ON agent_presets
  FOR SELECT TO authenticated USING (true);

-- voice_catalog: cached voice directory from ElevenLabs
CREATE TABLE IF NOT EXISTS voice_catalog (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_id        text NOT NULL UNIQUE,
  name            text NOT NULL,
  gender          text,
  accent          text,
  language_codes  text[] NOT NULL DEFAULT ARRAY['en']::text[],
  category        text NOT NULL DEFAULT 'premade',
  preview_url     text,
  description     text,
  tags            text[] NOT NULL DEFAULT '{}'::text[],
  cached_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE voice_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY voice_catalog_read_all ON voice_catalog
  FOR SELECT TO authenticated USING (true);

-- shopify_connections: org-scoped
CREATE TABLE IF NOT EXISTS shopify_connections (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  shop_domain   text NOT NULL,
  api_key_ref   text,
  scopes        text[] NOT NULL DEFAULT ARRAY['read_orders','read_customers','read_checkouts']::text[],
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','error')),
  last_sync_at  timestamptz,
  cache_ttl_sec int NOT NULL DEFAULT 300,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shopify_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY shopify_connections_select ON shopify_connections
  FOR SELECT TO authenticated USING (org_id = auth_org());
CREATE POLICY shopify_connections_insert ON shopify_connections
  FOR INSERT TO authenticated WITH CHECK (org_id = auth_org());
CREATE POLICY shopify_connections_update ON shopify_connections
  FOR UPDATE TO authenticated USING (org_id = auth_org()) WITH CHECK (org_id = auth_org());
CREATE POLICY shopify_connections_delete ON shopify_connections
  FOR DELETE TO authenticated USING (org_id = auth_org());

-- shopify_cache: org-scoped read-through cache
CREATE TABLE IF NOT EXISTS shopify_cache (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  cache_key   text NOT NULL,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, cache_key)
);

ALTER TABLE shopify_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY shopify_cache_select ON shopify_cache
  FOR SELECT TO authenticated USING (org_id = auth_org());
CREATE POLICY shopify_cache_insert ON shopify_cache
  FOR INSERT TO authenticated WITH CHECK (org_id = auth_org());
CREATE POLICY shopify_cache_update ON shopify_cache
  FOR UPDATE TO authenticated USING (org_id = auth_org()) WITH CHECK (org_id = auth_org());
CREATE POLICY shopify_cache_delete ON shopify_cache
  FOR DELETE TO authenticated USING (org_id = auth_org());

CREATE INDEX IF NOT EXISTS idx_shopify_cache_lookup ON shopify_cache(org_id, cache_key, expires_at);
CREATE INDEX IF NOT EXISTS idx_agent_presets_vertical ON agent_presets(vertical_key, enabled, sort_order);

-- Seed voice catalog with popular ElevenLabs voices
INSERT INTO voice_catalog (voice_id, name, gender, accent, language_codes, category, preview_url, description, tags) VALUES
  ('21m00Tcm4TlvDq8ikWAM', 'Rachel', 'female', 'American', ARRAY['en'], 'premade', 'https://storage.googleapis.com/eleven-public-prod/premade/voices/21m00Tcm4TlvDq8ikWAM/df6788f9-5c96-47c6-92df-1f68f5e8e1ad.mp3', 'Warm and professional, ideal for customer service', ARRAY['warm','professional','service']),
  ('EXAVITQu4vr4xnSDxMaL', 'Bella', 'female', 'American', ARRAY['en'], 'premade', 'https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/6851ec9e-5725-4e76-a8db-834af19d0045.mp3', 'Soft and friendly, great for empathetic conversations', ARRAY['soft','friendly','empathetic']),
  ('ErXwobaYiN019PkySvjV', 'Antoni', 'male', 'American', ARRAY['en'], 'premade', 'https://storage.googleapis.com/eleven-public-prod/premade/voices/ErXwobaYiN019PkySvjV/38d8e2ff-dd9e-4fcc-b1a8-e06b82f8a6a4.mp3', 'Clear and authoritative male voice', ARRAY['clear','authoritative','professional']),
  ('VR6AewLTigWG4xSOukaG', 'Arnold', 'male', 'American', ARRAY['en'], 'premade', 'https://storage.googleapis.com/eleven-public-prod/premade/voices/VR6AewLTigWG4xSOukaG/66444350-3fa2-4e65-ad14-c7790cad8a24.mp3', 'Deep and confident, great for sales outreach', ARRAY['deep','confident','sales']),
  ('pNInz6obpgDQGcFmaJgB', 'Adam', 'male', 'American', ARRAY['en'], 'premade', 'https://storage.googleapis.com/eleven-public-prod/premade/voices/pNInz6obpgDQGcFmaJgB/d6c1af75-45f0-473a-9dcc-5a48c34f7a5a.mp3', 'Natural and conversational male voice', ARRAY['natural','conversational','warm']),
  ('jBpfuIE2acCO8z3wKNLl', 'Gigi', 'female', 'American', ARRAY['en','es'], 'premade', 'https://storage.googleapis.com/eleven-public-prod/premade/voices/jBpfuIE2acCO8z3wKNLl/afc5a61c-42d5-4760-9c84-d04e0e9887de.mp3', 'Youthful and energetic, bilingual English/Spanish', ARRAY['youthful','energetic','bilingual']),
  ('onwK4e9ZLuTAKqWW03F9', 'Daniel', 'male', 'British', ARRAY['en'], 'premade', 'https://storage.googleapis.com/eleven-public-prod/premade/voices/onwK4e9ZLuTAKqWW03F9/214c6e97-8b20-4e4f-8d5e-6f0ed5b1f26e.mp3', 'British accent, polished and articulate', ARRAY['british','polished','articulate']),
  ('XB0fDUnXU5powFXDhCwa', 'Charlotte', 'female', 'British', ARRAY['en'], 'premade', 'https://storage.googleapis.com/eleven-public-prod/premade/voices/XB0fDUnXU5powFXDhCwa/e3b67e27-6e56-4d4f-ba3f-a9f6bde5d9ac.mp3', 'Elegant British female, ideal for premium brands', ARRAY['elegant','british','premium']),
  ('TX3LPaxmHKxFdv7VOQHJ', 'Liam', 'male', 'American', ARRAY['en','es','fr'], 'premade', 'https://storage.googleapis.com/eleven-public-prod/premade/voices/TX3LPaxmHKxFdv7VOQHJ/e7e73e37-6e5e-4e49-b4f4-c4f4d4e4f4a4.mp3', 'Versatile multilingual male voice', ARRAY['versatile','multilingual','neutral']),
  ('XrExE9yKIg1WjnnlVkGX', 'Matilda', 'female', 'Australian', ARRAY['en'], 'premade', 'https://storage.googleapis.com/eleven-public-prod/premade/voices/XrExE9yKIg1WjnnlVkGX/b79b1d8e-8c6e-4e3b-9c54-ef2b8e1a5b7c.mp3', 'Warm Australian accent, approachable', ARRAY['australian','warm','approachable']),
  ('nPczCjzI2devNBz1zQrb', 'Brian', 'male', 'American', ARRAY['en'], 'premade', 'https://storage.googleapis.com/eleven-public-prod/premade/voices/nPczCjzI2devNBz1zQrb/c9f7e3d4-5a2b-4b1c-8d9e-f6a5b4c3d2e1.mp3', 'Deep narrator voice, trustworthy', ARRAY['deep','narrator','trustworthy']),
  ('SAz9YHcvj6GT2YYXdXww', 'River', 'nonbinary', 'American', ARRAY['en'], 'premade', 'https://storage.googleapis.com/eleven-public-prod/premade/voices/SAz9YHcvj6GT2YYXdXww/a7b8c9d0-1e2f-3a4b-5c6d-7e8f9a0b1c2d.mp3', 'Gender-neutral, modern and calm', ARRAY['neutral','modern','calm'])
ON CONFLICT (voice_id) DO NOTHING;
