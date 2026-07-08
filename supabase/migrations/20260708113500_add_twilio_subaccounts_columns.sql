-- Migration: Add missing columns to twilio_subaccounts table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='twilio_subaccounts' AND column_name='account_type') THEN
    ALTER TABLE twilio_subaccounts ADD COLUMN account_type text DEFAULT 'aurora_managed';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='twilio_subaccounts' AND column_name='friendly_name') THEN
    ALTER TABLE twilio_subaccounts ADD COLUMN friendly_name text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='twilio_subaccounts' AND column_name='verified_at') THEN
    ALTER TABLE twilio_subaccounts ADD COLUMN verified_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='twilio_subaccounts' AND column_name='updated_at') THEN
    ALTER TABLE twilio_subaccounts ADD COLUMN updated_at timestamptz;
  END IF;
END $$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
