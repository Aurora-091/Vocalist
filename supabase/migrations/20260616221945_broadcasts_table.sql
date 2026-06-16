CREATE TABLE broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template text NOT NULL,
  subject text NOT NULL,
  variables jsonb NOT NULL DEFAULT '{}',
  recipient_type text NOT NULL,
  recipient_count integer NOT NULL DEFAULT 0,
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_by uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'sent'
);

ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_broadcasts_sent_at ON broadcasts (sent_at DESC);

-- Only super admins access this table via service role, so no RLS policies needed for end users.
-- Access is gated at the API layer by requireSuperAdmin middleware.