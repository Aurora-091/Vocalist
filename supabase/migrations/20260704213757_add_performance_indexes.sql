-- Index for live calls dashboard (filters by org_id + status)
CREATE INDEX IF NOT EXISTS idx_calls_org_status ON calls (org_id, status);

-- Index for contacts cursor-based pagination (org_id + created_at DESC)
CREATE INDEX IF NOT EXISTS idx_contacts_org_created_at ON contacts (org_id, created_at DESC) WHERE deleted_at IS NULL;

-- Index for waitlist lookups by email (used by edge function time-bounded check)
CREATE INDEX IF NOT EXISTS idx_waitlist_email_created ON waitlist (email, created_at DESC);
