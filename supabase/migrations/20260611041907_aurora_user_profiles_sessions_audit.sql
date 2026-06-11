-- User profile extensions
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS theme_preference text DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS locale text DEFAULT 'en';

-- Active sessions tracking
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  device_info text,
  ip_address text,
  last_active_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON public.user_sessions(user_id) WHERE revoked_at IS NULL;

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_sessions" ON public.user_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_sessions" ON public.user_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_sessions" ON public.user_sessions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "delete_own_sessions" ON public.user_sessions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Audit log table
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  metadata jsonb DEFAULT '{}',
  ip_address text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_org ON public.audit_log(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON public.audit_log(user_id, created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_org_audit" ON public.audit_log
  FOR SELECT TO authenticated USING (org_id = (
    SELECT nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id','')::uuid
  ));
CREATE POLICY "insert_org_audit" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (org_id = (
    SELECT nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id','')::uuid
  ));

-- Webhook dead letter queue for failed events
CREATE TABLE IF NOT EXISTS public.webhook_dlq (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.orgs(id) ON DELETE CASCADE,
  source text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  error_message text,
  retry_count int DEFAULT 0,
  next_retry_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_dlq_pending ON public.webhook_dlq(next_retry_at)
  WHERE resolved_at IS NULL;

ALTER TABLE public.webhook_dlq ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_org_dlq" ON public.webhook_dlq
  FOR SELECT TO authenticated USING (org_id = (
    SELECT nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id','')::uuid
  ));
CREATE POLICY "insert_org_dlq" ON public.webhook_dlq
  FOR INSERT TO authenticated WITH CHECK (org_id = (
    SELECT nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id','')::uuid
  ));
CREATE POLICY "update_org_dlq" ON public.webhook_dlq
  FOR UPDATE TO authenticated USING (org_id = (
    SELECT nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id','')::uuid
  ));
CREATE POLICY "delete_org_dlq" ON public.webhook_dlq
  FOR DELETE TO authenticated USING (org_id = (
    SELECT nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id','')::uuid
  ));

-- Function to handle Google OAuth user provisioning
CREATE OR REPLACE FUNCTION public.handle_new_oauth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
  user_name text;
BEGIN
  -- Only trigger for OAuth signups (not email/password which go through backend)
  IF NEW.raw_app_meta_data->>'provider' = 'google' THEN
    -- Check if user already exists (returning login)
    IF EXISTS (SELECT 1 FROM public.users WHERE id = NEW.id) THEN
      RETURN NEW;
    END IF;

    -- Extract name from OAuth metadata
    user_name := COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    );

    -- Create org
    INSERT INTO public.orgs (id, name, plan_id)
    VALUES (gen_random_uuid(), user_name || '''s Organization', 'starter')
    RETURNING id INTO new_org_id;

    -- Create user record
    INSERT INTO public.users (id, org_id, email, role, display_name, avatar_url)
    VALUES (
      NEW.id,
      new_org_id,
      NEW.email,
      'owner',
      user_name,
      NEW.raw_user_meta_data->>'avatar_url'
    );

    -- Set org_id in app_metadata
    UPDATE auth.users
    SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('org_id', new_org_id::text, 'role', 'owner')
    WHERE id = NEW.id;

    -- Initialize onboarding state
    INSERT INTO public.onboarding_state (org_id, steps)
    VALUES (new_org_id, '{"pick_vertical":false,"connect_tools":false,"add_knowledge":false,"create_agent":false,"get_number":false,"test_and_golive":false}')
    ON CONFLICT (org_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for new OAuth users
DROP TRIGGER IF EXISTS on_auth_user_created_oauth ON auth.users;
CREATE TRIGGER on_auth_user_created_oauth
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_oauth_user();
