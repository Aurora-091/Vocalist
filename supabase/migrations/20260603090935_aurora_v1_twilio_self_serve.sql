/*
  # Twilio v1: subaccount, numbers, search cache

  Hardens the existing `twilio_subaccounts` table and `phone_numbers` table
  with the columns needed for self-serve subaccount lifecycle, number
  purchase, and BYO. Adds a per-tenant search cache so the buy-a-number UI
  survives refresh without spamming the Twilio API.

  1. Modified tables
    - `twilio_subaccounts`
      - `auth_token_ref text` — pointer to vault entry holding subaccount auth token
      - `region text default 'us1'`
      - `last_synced_at timestamptz` — operations watermark
      - `error_count int default 0`
      - Primary key remains `org_id`
    - `phone_numbers`
      - `provider text default 'twilio'` — voice provider for this number
      - `voice_url text`, `status_callback_url text`
      - `purchased_at timestamptz`, `monthly_cost_usd numeric(10,4)`
      - `capabilities jsonb default '{}'::jsonb`
      - `subaccount_org_id uuid` — soft FK to twilio_subaccounts(org_id)

  2. New tables
    - `phone_number_search_cache` — cached Twilio AvailablePhoneNumbers results
      keyed by org + country + area code; TTL via expires_at

  3. Security
    - All new columns inherit existing RLS on parent tables.
    - `phone_number_search_cache` has RLS on; only org members can read their cache.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='twilio_subaccounts' AND column_name='auth_token_ref') THEN
    ALTER TABLE twilio_subaccounts ADD COLUMN auth_token_ref text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='twilio_subaccounts' AND column_name='region') THEN
    ALTER TABLE twilio_subaccounts ADD COLUMN region text DEFAULT 'us1';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='twilio_subaccounts' AND column_name='last_synced_at') THEN
    ALTER TABLE twilio_subaccounts ADD COLUMN last_synced_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='twilio_subaccounts' AND column_name='error_count') THEN
    ALTER TABLE twilio_subaccounts ADD COLUMN error_count int DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='phone_numbers' AND column_name='provider') THEN
    ALTER TABLE phone_numbers ADD COLUMN provider text DEFAULT 'twilio';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='phone_numbers' AND column_name='voice_url') THEN
    ALTER TABLE phone_numbers ADD COLUMN voice_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='phone_numbers' AND column_name='status_callback_url') THEN
    ALTER TABLE phone_numbers ADD COLUMN status_callback_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='phone_numbers' AND column_name='purchased_at') THEN
    ALTER TABLE phone_numbers ADD COLUMN purchased_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='phone_numbers' AND column_name='monthly_cost_usd') THEN
    ALTER TABLE phone_numbers ADD COLUMN monthly_cost_usd numeric(10,4);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='phone_numbers' AND column_name='capabilities') THEN
    ALTER TABLE phone_numbers ADD COLUMN capabilities jsonb DEFAULT '{}'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='phone_numbers' AND column_name='subaccount_org_id') THEN
    ALTER TABLE phone_numbers ADD COLUMN subaccount_org_id uuid;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS phone_number_search_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  country text NOT NULL,
  area_code text,
  kind text NOT NULL DEFAULT 'local',
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS phone_number_search_cache_org_lookup_idx
  ON phone_number_search_cache (org_id, country, area_code, kind, expires_at DESC);

ALTER TABLE phone_number_search_cache ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='phone_number_search_cache' AND policyname='Org members can read own search cache'
  ) THEN
    CREATE POLICY "Org members can read own search cache"
      ON phone_number_search_cache FOR SELECT
      TO authenticated
      USING (org_id = auth_org());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='phone_number_search_cache' AND policyname='Org members can write own search cache'
  ) THEN
    CREATE POLICY "Org members can write own search cache"
      ON phone_number_search_cache FOR INSERT
      TO authenticated
      WITH CHECK (org_id = auth_org());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='phone_number_search_cache' AND policyname='Org members can delete own search cache'
  ) THEN
    CREATE POLICY "Org members can delete own search cache"
      ON phone_number_search_cache FOR DELETE
      TO authenticated
      USING (org_id = auth_org());
  END IF;
END $$;
