CREATE TABLE IF NOT EXISTS public.waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  source text DEFAULT 'website',
  referral_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT waitlist_email_unique UNIQUE (email)
);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (public signup form)
CREATE POLICY "anyone_can_join_waitlist" ON public.waitlist
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Only service role can read waitlist entries
CREATE POLICY "service_role_reads_waitlist" ON public.waitlist
  FOR SELECT TO service_role
  USING (true);
