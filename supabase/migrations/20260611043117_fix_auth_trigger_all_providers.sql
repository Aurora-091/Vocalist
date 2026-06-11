-- Extend the OAuth user trigger to also handle email/password signups
-- as a safety net (the backend auth.service.js handles the primary flow,
-- but this catches edge cases where auth.users gets a row without matching public.users)
CREATE OR REPLACE FUNCTION public.handle_new_oauth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
  user_name text;
  provider_name text;
BEGIN
  provider_name := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');

  -- Skip if user already exists in public.users (backend already provisioned them)
  IF EXISTS (SELECT 1 FROM public.users WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Skip if org_id is already set (backend auth.service.js set it)
  IF (NEW.raw_app_meta_data->>'org_id') IS NOT NULL AND (NEW.raw_app_meta_data->>'org_id') != '' THEN
    RETURN NEW;
  END IF;

  -- Auto-provision for OAuth providers (Google, etc.) and as safety net for email
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'org_name',
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

  -- Set org_id in app_metadata so JWT includes it
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('org_id', new_org_id::text, 'role', 'owner')
  WHERE id = NEW.id;

  -- Initialize onboarding state
  INSERT INTO public.onboarding_state (org_id, steps)
  VALUES (new_org_id, '{"pick_vertical":false,"connect_tools":false,"add_knowledge":false,"create_agent":false,"get_number":false,"test_and_golive":false}')
  ON CONFLICT (org_id) DO NOTHING;

  RETURN NEW;
END;
$$;
