-- Add unsubscribed flag and referred_by to waitlist
ALTER TABLE waitlist
  ADD COLUMN IF NOT EXISTS unsubscribed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES waitlist(id) ON DELETE SET NULL;

-- Index for fast unsubscribe token lookups (we use the UUID id as the token)
CREATE INDEX IF NOT EXISTS waitlist_id_idx ON waitlist(id);

-- RLS: allow anyone to update only their own unsubscribed status (via anon token = their id)
-- We use a Supabase RPC to do this securely server-side, so no extra policy needed here.

COMMENT ON COLUMN waitlist.unsubscribed IS 'Set to true when user clicks unsubscribe link';
COMMENT ON COLUMN waitlist.referred_by IS 'ID of the waitlist entry that referred this person';
