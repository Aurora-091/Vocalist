-- 1. Add channel enum and column to calls table
DO $$ BEGIN
  CREATE TYPE conversation_channel AS ENUM ('voice', 'sms', 'chat', 'email', 'whatsapp');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE calls ADD COLUMN IF NOT EXISTS channel conversation_channel NOT NULL DEFAULT 'voice';

-- 2. Add phone_number_status enum and migrate status column
DO $$ BEGIN
  CREATE TYPE phone_number_status AS ENUM (
    'active', 'assigned', 'unassigned',
    'pending_purchase', 'pending_release', 'released', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add new typed status column alongside existing text status
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS lifecycle_status phone_number_status NOT NULL DEFAULT 'unassigned';

-- Backfill: any row with agent_id set is 'assigned', otherwise 'unassigned'
UPDATE phone_numbers SET lifecycle_status = 'assigned' WHERE agent_id IS NOT NULL;
UPDATE phone_numbers SET lifecycle_status = 'active' WHERE status = 'active' AND agent_id IS NULL;
