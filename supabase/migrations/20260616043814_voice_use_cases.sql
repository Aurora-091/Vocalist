ALTER TABLE voice_catalog
  ADD COLUMN IF NOT EXISTS use_cases text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE voice_catalog
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS voice_catalog_use_cases_idx
  ON voice_catalog USING gin (use_cases);