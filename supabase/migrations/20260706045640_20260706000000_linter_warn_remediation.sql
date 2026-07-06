-- =============================================================================
-- DB Linter WARN Remediation — 2026-07-06
--
-- Fixes:
--   WARN auth_rls_initplan   — wrap auth.uid() / auth.jwt() calls in (select ...)
--                              so PostgreSQL evaluates them once per query, not per row
--   WARN multiple_permissive_policies — split site_settings FOR ALL into targeted DML policies
--   WARN duplicate_index     — drop idx_agents_org (duplicate of agents_org_id_idx)
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. user_notification_prefs — fix auth.uid() per-row evaluation
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS unp_select ON user_notification_prefs;
CREATE POLICY unp_select ON user_notification_prefs
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS unp_upsert ON user_notification_prefs;
CREATE POLICY unp_upsert ON user_notification_prefs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS unp_update ON user_notification_prefs;
CREATE POLICY unp_update ON user_notification_prefs
  FOR UPDATE TO authenticated
  USING  (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));


-- ---------------------------------------------------------------------------
-- 2. user_sessions — fix auth.uid() per-row evaluation
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS select_own_sessions ON public.user_sessions;
CREATE POLICY select_own_sessions ON public.user_sessions
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS insert_own_sessions ON public.user_sessions;
CREATE POLICY insert_own_sessions ON public.user_sessions
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS update_own_sessions ON public.user_sessions;
CREATE POLICY update_own_sessions ON public.user_sessions
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS delete_own_sessions ON public.user_sessions;
CREATE POLICY delete_own_sessions ON public.user_sessions
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);


-- ---------------------------------------------------------------------------
-- 3. integration_bridge_config — fix auth.jwt() per-row evaluation
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS bridge_select_own ON integration_bridge_config;
CREATE POLICY bridge_select_own ON integration_bridge_config
  FOR SELECT TO authenticated
  USING (org_id = (SELECT (auth.jwt()->'app_metadata'->>'org_id')::uuid));

DROP POLICY IF EXISTS bridge_insert_own ON integration_bridge_config;
CREATE POLICY bridge_insert_own ON integration_bridge_config
  FOR INSERT TO authenticated
  WITH CHECK (org_id = (SELECT (auth.jwt()->'app_metadata'->>'org_id')::uuid));

DROP POLICY IF EXISTS bridge_update_own ON integration_bridge_config;
CREATE POLICY bridge_update_own ON integration_bridge_config
  FOR UPDATE TO authenticated
  USING  (org_id = (SELECT (auth.jwt()->'app_metadata'->>'org_id')::uuid))
  WITH CHECK (org_id = (SELECT (auth.jwt()->'app_metadata'->>'org_id')::uuid));

DROP POLICY IF EXISTS bridge_delete_own ON integration_bridge_config;
CREATE POLICY bridge_delete_own ON integration_bridge_config
  FOR DELETE TO authenticated
  USING (org_id = (SELECT (auth.jwt()->'app_metadata'->>'org_id')::uuid));


-- ---------------------------------------------------------------------------
-- 4. oauth_tokens — fix auth.jwt() per-row evaluation
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS oauth_select_own ON oauth_tokens;
CREATE POLICY oauth_select_own ON oauth_tokens
  FOR SELECT TO authenticated
  USING (org_id = (SELECT (auth.jwt()->'app_metadata'->>'org_id')::uuid));

DROP POLICY IF EXISTS oauth_insert_own ON oauth_tokens;
CREATE POLICY oauth_insert_own ON oauth_tokens
  FOR INSERT TO authenticated
  WITH CHECK (org_id = (SELECT (auth.jwt()->'app_metadata'->>'org_id')::uuid));

DROP POLICY IF EXISTS oauth_update_own ON oauth_tokens;
CREATE POLICY oauth_update_own ON oauth_tokens
  FOR UPDATE TO authenticated
  USING  (org_id = (SELECT (auth.jwt()->'app_metadata'->>'org_id')::uuid))
  WITH CHECK (org_id = (SELECT (auth.jwt()->'app_metadata'->>'org_id')::uuid));

DROP POLICY IF EXISTS oauth_delete_own ON oauth_tokens;
CREATE POLICY oauth_delete_own ON oauth_tokens
  FOR DELETE TO authenticated
  USING (org_id = (SELECT (auth.jwt()->'app_metadata'->>'org_id')::uuid));


-- ---------------------------------------------------------------------------
-- 5. whatsapp_messages — fix auth.jwt() per-row evaluation
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS wa_select_own ON whatsapp_messages;
CREATE POLICY wa_select_own ON whatsapp_messages
  FOR SELECT TO authenticated
  USING (org_id = (SELECT (auth.jwt()->'app_metadata'->>'org_id')::uuid));

DROP POLICY IF EXISTS wa_insert_own ON whatsapp_messages;
CREATE POLICY wa_insert_own ON whatsapp_messages
  FOR INSERT TO authenticated
  WITH CHECK (org_id = (SELECT (auth.jwt()->'app_metadata'->>'org_id')::uuid));

DROP POLICY IF EXISTS wa_update_own ON whatsapp_messages;
CREATE POLICY wa_update_own ON whatsapp_messages
  FOR UPDATE TO authenticated
  USING  (org_id = (SELECT (auth.jwt()->'app_metadata'->>'org_id')::uuid))
  WITH CHECK (org_id = (SELECT (auth.jwt()->'app_metadata'->>'org_id')::uuid));

DROP POLICY IF EXISTS wa_delete_own ON whatsapp_messages;
CREATE POLICY wa_delete_own ON whatsapp_messages
  FOR DELETE TO authenticated
  USING (org_id = (SELECT (auth.jwt()->'app_metadata'->>'org_id')::uuid));


-- ---------------------------------------------------------------------------
-- 6. agent_active_skills — fix auth.uid() per-row evaluation
--    Note: policies compare org_id = auth.uid() — preserved as original intent
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS select_own_active_skills ON agent_active_skills;
CREATE POLICY select_own_active_skills ON agent_active_skills
  FOR SELECT TO authenticated
  USING (org_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS insert_own_active_skills ON agent_active_skills;
CREATE POLICY insert_own_active_skills ON agent_active_skills
  FOR INSERT TO authenticated
  WITH CHECK (org_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS update_own_active_skills ON agent_active_skills;
CREATE POLICY update_own_active_skills ON agent_active_skills
  FOR UPDATE TO authenticated
  USING  (org_id = (SELECT auth.uid()))
  WITH CHECK (org_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS delete_own_active_skills ON agent_active_skills;
CREATE POLICY delete_own_active_skills ON agent_active_skills
  FOR DELETE TO authenticated
  USING (org_id = (SELECT auth.uid()));


-- ---------------------------------------------------------------------------
-- 7. scheduled_calls — fix auth.uid() inside subquery per-row evaluation
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS select_own_scheduled_calls ON scheduled_calls;
CREATE POLICY select_own_scheduled_calls ON scheduled_calls
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT org_id FROM users WHERE id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS insert_own_scheduled_calls ON scheduled_calls;
CREATE POLICY insert_own_scheduled_calls ON scheduled_calls
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (
    SELECT org_id FROM users WHERE id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS update_own_scheduled_calls ON scheduled_calls;
CREATE POLICY update_own_scheduled_calls ON scheduled_calls
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT org_id FROM users WHERE id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS delete_own_scheduled_calls ON scheduled_calls;
CREATE POLICY delete_own_scheduled_calls ON scheduled_calls
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT org_id FROM users WHERE id = (SELECT auth.uid())
  ));


-- ---------------------------------------------------------------------------
-- 8. enterprise_inquiries — fix auth.uid() inside EXISTS subquery per-row evaluation
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS admin_select_enterprise_inquiries ON enterprise_inquiries;
CREATE POLICY admin_select_enterprise_inquiries ON enterprise_inquiries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE public.users.id = (SELECT auth.uid())
        AND public.users.platform_role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS admin_update_enterprise_inquiries ON enterprise_inquiries;
CREATE POLICY admin_update_enterprise_inquiries ON enterprise_inquiries
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE public.users.id = (SELECT auth.uid())
        AND public.users.platform_role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE public.users.id = (SELECT auth.uid())
        AND public.users.platform_role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS admin_delete_enterprise_inquiries ON enterprise_inquiries;
CREATE POLICY admin_delete_enterprise_inquiries ON enterprise_inquiries
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE public.users.id = (SELECT auth.uid())
        AND public.users.platform_role IN ('super_admin', 'admin')
    )
  );


-- ---------------------------------------------------------------------------
-- 9. site_settings — fix multiple_permissive_policies + initplan
--    Drop the FOR ALL policy; replace with targeted INSERT/UPDATE/DELETE.
--    Keep site_settings_public_read (FOR SELECT USING (true)) as the sole SELECT policy.
--    Auth check uses (select auth.role()) to avoid per-row evaluation.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS site_settings_admin_write ON public.site_settings;

CREATE POLICY site_settings_admin_insert ON public.site_settings
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.role()) = 'authenticated');

CREATE POLICY site_settings_admin_update ON public.site_settings
  FOR UPDATE TO authenticated
  USING  ((SELECT auth.role()) = 'authenticated')
  WITH CHECK ((SELECT auth.role()) = 'authenticated');

CREATE POLICY site_settings_admin_delete ON public.site_settings
  FOR DELETE TO authenticated
  USING ((SELECT auth.role()) = 'authenticated');


-- ---------------------------------------------------------------------------
-- 10. Drop duplicate index on agents.org_id
--     agents_org_id_idx (auto-created by the migrate_db migration) is identical
--     to idx_agents_org (created in elevenlabs_migration). Keep the earlier one.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_agents_org;
