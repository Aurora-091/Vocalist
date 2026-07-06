-- Fix agent_active_skills: all 4 RLS policies compare org_id = auth.uid()
-- org_id references orgs(id) — a tenant UUID from the orgs table
-- auth.uid() returns the authenticated user's UUID from auth.users
-- These are different ID spaces and will never match, blocking all access
-- Fix: replace auth.uid() with auth_org() which reads org_id from JWT app_metadata

DROP POLICY IF EXISTS select_own_active_skills ON public.agent_active_skills;
CREATE POLICY select_own_active_skills ON public.agent_active_skills
  FOR SELECT TO authenticated
  USING (org_id = (SELECT auth_org()));

DROP POLICY IF EXISTS insert_own_active_skills ON public.agent_active_skills;
CREATE POLICY insert_own_active_skills ON public.agent_active_skills
  FOR INSERT TO authenticated
  WITH CHECK (org_id = (SELECT auth_org()));

DROP POLICY IF EXISTS update_own_active_skills ON public.agent_active_skills;
CREATE POLICY update_own_active_skills ON public.agent_active_skills
  FOR UPDATE TO authenticated
  USING  (org_id = (SELECT auth_org()))
  WITH CHECK (org_id = (SELECT auth_org()));

DROP POLICY IF EXISTS delete_own_active_skills ON public.agent_active_skills;
CREATE POLICY delete_own_active_skills ON public.agent_active_skills
  FOR DELETE TO authenticated
  USING (org_id = (SELECT auth_org()));
