/*
  # Aurora v1: Contacts Tags & Segments

  1. Modified Tables
    - `contacts`: add `tags text[]` (GIN indexed) and `fields jsonb` for vertical-specific data

  2. New Tables
    - `segments` - saved audience filter for the campaign builder

  3. Security
    - RLS on segments (org-scoped)
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='contacts' AND column_name='tags') THEN
    ALTER TABLE contacts ADD COLUMN tags text[] NOT NULL DEFAULT '{}'::text[];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='contacts' AND column_name='fields') THEN
    ALTER TABLE contacts ADD COLUMN fields jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS contacts_tags_gin ON contacts USING gin (tags);

CREATE TABLE IF NOT EXISTS segments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name       text NOT NULL,
  filter     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);

CREATE INDEX IF NOT EXISTS segments_org_idx ON segments (org_id);

ALTER TABLE segments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS segments_select ON segments;
CREATE POLICY segments_select ON segments FOR SELECT TO authenticated USING (org_id = auth_org());

DROP POLICY IF EXISTS segments_insert ON segments;
CREATE POLICY segments_insert ON segments FOR INSERT TO authenticated WITH CHECK (org_id = auth_org());

DROP POLICY IF EXISTS segments_update ON segments;
CREATE POLICY segments_update ON segments FOR UPDATE TO authenticated USING (org_id = auth_org()) WITH CHECK (org_id = auth_org());

DROP POLICY IF EXISTS segments_delete ON segments;
CREATE POLICY segments_delete ON segments FOR DELETE TO authenticated USING (org_id = auth_org());
