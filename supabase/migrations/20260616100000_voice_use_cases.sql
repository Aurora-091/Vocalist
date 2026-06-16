/*
  # Voice catalog: business use-case categorization + featured flag

  1. Adds `use_cases text[]` — customer-facing business use cases
     (customer_support, sales, appointment_booking, receptionist,
     collections, conversational). Populated by the `voice-sync` edge
     function. When empty, the UI derives categories on the fly, so this
     is an optional override and safe to ship before any sync runs.
  2. Adds `featured boolean` — surfaces a "Popular voices" row.
  3. Adds a GIN index on use_cases for fast category filtering at scale.

  RLS is already enabled on voice_catalog (read-all for authenticated),
  so no policy changes are needed.
*/

ALTER TABLE voice_catalog
  ADD COLUMN IF NOT EXISTS use_cases text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE voice_catalog
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS voice_catalog_use_cases_idx
  ON voice_catalog USING gin (use_cases);
