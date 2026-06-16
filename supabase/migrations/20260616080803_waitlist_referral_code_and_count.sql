-- Add referral_code (short hash) and referrals_count to waitlist
ALTER TABLE waitlist
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referrals_count integer NOT NULL DEFAULT 0;

-- Index for fast lookup by code
CREATE INDEX IF NOT EXISTS waitlist_referral_code_idx ON waitlist(referral_code);

-- Backfill existing rows with a code derived from their UUID
UPDATE waitlist
SET referral_code = 'weeber-' || substr(replace(id::text, '-', ''), 1, 7)
WHERE referral_code IS NULL;

-- Trigger: increment referrals_count on referrer when a new row references them
CREATE OR REPLACE FUNCTION increment_referrals_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.referred_by IS NOT NULL THEN
    UPDATE waitlist SET referrals_count = referrals_count + 1 WHERE id = NEW.referred_by;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_increment_referrals ON waitlist;
CREATE TRIGGER trg_increment_referrals
  AFTER INSERT ON waitlist
  FOR EACH ROW EXECUTE FUNCTION increment_referrals_count();
