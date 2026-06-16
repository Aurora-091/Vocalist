-- Add platform_role column to users table for internal admin access
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS platform_role text DEFAULT NULL;

ALTER TABLE public.users
  ADD CONSTRAINT users_platform_role_check
  CHECK (platform_role IS NULL OR platform_role IN ('super_admin', 'admin', 'support', 'finance', 'developer'));

CREATE INDEX IF NOT EXISTS idx_users_platform_role ON public.users(platform_role) WHERE platform_role IS NOT NULL;

-- Add status column to waitlist table
ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.waitlist
  ADD CONSTRAINT waitlist_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_waitlist_status ON public.waitlist(status);

-- Platform settings table (key-value store for feature flags / platform config)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT 'false'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Only service_role can access platform_settings
CREATE POLICY "service_role_all_platform_settings" ON public.platform_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed initial settings
INSERT INTO public.platform_settings (key, value) VALUES
  ('maintenance_mode', 'false'::jsonb),
  ('signup_enabled', 'true'::jsonb),
  ('waitlist_enabled', 'true'::jsonb),
  ('beta_features', 'false'::jsonb),
  ('experimental_features', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;