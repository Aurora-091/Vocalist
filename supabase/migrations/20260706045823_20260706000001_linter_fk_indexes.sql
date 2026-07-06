-- =============================================================================
-- DB Linter INFO Remediation — 2026-07-06
--
-- Fix: INFO unindexed_foreign_keys
-- Adds covering indexes on all FK columns that lack one.
-- Partition tables (call_events_*, usage_ledger_*) inherit indexes from the
-- parent table automatically when using CREATE INDEX on the parent. Indexes on
-- existing partition tables are created explicitly via DO block for safety.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Non-partition tables
-- ---------------------------------------------------------------------------

-- agent_active_skills
CREATE INDEX IF NOT EXISTS idx_agent_active_skills_agent_id    ON agent_active_skills (agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_active_skills_skill_id    ON agent_active_skills (skill_id);
-- org_id already covered by select_own_active_skills initplan fix; add standalone too
CREATE INDEX IF NOT EXISTS idx_agent_active_skills_org_id      ON agent_active_skills (org_id);

-- agent_knowledge
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_agent_id        ON agent_knowledge (agent_id);
-- source_id and org_id already indexed (knowledge_chunks_source_idx, agent_knowledge_org_idx)
-- but linter reports them missing on this table — create IF NOT EXISTS to be safe
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_source_id       ON agent_knowledge (source_id);
-- org_id already has agent_knowledge_org_idx, skip duplicate

-- agents: org_id auto-index from migrate_db; linter may still flag it if auto-index name not found
-- create explicit named one just in case (IF NOT EXISTS = no-op if already exists)
CREATE INDEX IF NOT EXISTS idx_agents_org_id                   ON agents (org_id);

-- audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_org_id                ON public.audit_log (org_id);
-- user_id already has idx_audit_log_user; skip

-- broadcasts
CREATE INDEX IF NOT EXISTS idx_broadcasts_sent_by              ON broadcasts (sent_by);

-- call_events (parent) — index propagates to all current and future partitions
CREATE INDEX IF NOT EXISTS idx_call_events_call_id             ON call_events (call_id);

-- calls
CREATE INDEX IF NOT EXISTS idx_calls_agent_id                  ON calls (agent_id);
CREATE INDEX IF NOT EXISTS idx_calls_campaign_id               ON calls (campaign_id);
CREATE INDEX IF NOT EXISTS idx_calls_contact_id                ON calls (contact_id);
-- org_id already has composite idx (calls org_id, created_at desc); skip

-- campaign_targets
CREATE INDEX IF NOT EXISTS idx_campaign_targets_campaign_id    ON campaign_targets (campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_targets_contact_id     ON campaign_targets (contact_id);
-- org_id already composite-indexed; skip

-- campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_agent_id              ON campaigns (agent_id);
-- org_id already composite-indexed; skip

-- consent_events
CREATE INDEX IF NOT EXISTS idx_consent_events_contact_id       ON consent_events (contact_id);
-- org_id already composite-indexed; skip

-- consent_notices
CREATE INDEX IF NOT EXISTS idx_consent_notices_org_id          ON public.consent_notices (org_id);

-- contacts: org_id already indexed; skip

-- dialer_transitions
CREATE INDEX IF NOT EXISTS idx_dialer_transitions_org_id       ON dialer_transitions (org_id);
-- target_id already has composite idx; skip

-- dnc_list: org_id is part of PK; skip
CREATE INDEX IF NOT EXISTS idx_dnc_list_source_event_id        ON dnc_list (source_event_id) WHERE source_event_id IS NOT NULL;

-- dpdp_requests
CREATE INDEX IF NOT EXISTS idx_dpdp_requests_org_id            ON public.dpdp_requests (org_id);
CREATE INDEX IF NOT EXISTS idx_dpdp_requests_contact_id        ON public.dpdp_requests (contact_id) WHERE contact_id IS NOT NULL;

-- integration_bridge_config: org_id already has idx_bridge_config_org; skip
CREATE INDEX IF NOT EXISTS idx_integration_bridge_config_provider_key ON integration_bridge_config (provider_key);

-- integrations
CREATE INDEX IF NOT EXISTS idx_integrations_org_id             ON integrations (org_id);
CREATE INDEX IF NOT EXISTS idx_integrations_agent_id           ON integrations (agent_id) WHERE agent_id IS NOT NULL;

-- knowledge_chunks: already has knowledge_chunks_org_idx + knowledge_chunks_source_idx; skip

-- knowledge_provider_mappings (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='knowledge_provider_mappings') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_kpm_org_id ON public.knowledge_provider_mappings (org_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_kpm_knowledge_source_id ON public.knowledge_provider_mappings (knowledge_source_id)';
  END IF;
END $$;

-- knowledge_sources: already has knowledge_sources_org_idx; skip

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_org_id            ON notifications (org_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id           ON notifications (user_id);

-- oauth_tokens: org_id already has idx_oauth_tokens_org; skip
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_provider_key       ON oauth_tokens (provider_key);

-- onboarding_state: org_id is PK; skip

-- organization_agents (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='organization_agents') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_org_agents_org_id ON public.organization_agents (org_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_org_agents_agent_id ON public.organization_agents (agent_id)';
  END IF;
END $$;

-- orgs
CREATE INDEX IF NOT EXISTS idx_orgs_vertical_config_id         ON orgs (vertical_config_id) WHERE vertical_config_id IS NOT NULL;

-- phone_number_search_cache: already has composite idx; skip

-- phone_numbers
CREATE INDEX IF NOT EXISTS idx_phone_numbers_org_id            ON phone_numbers (org_id);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_agent_id          ON phone_numbers (agent_id) WHERE agent_id IS NOT NULL;

-- platform_settings
CREATE INDEX IF NOT EXISTS idx_platform_settings_updated_by    ON public.platform_settings (updated_by) WHERE updated_by IS NOT NULL;

-- playbooks: already has idx_playbooks_org_id; skip
CREATE INDEX IF NOT EXISTS idx_playbooks_agent_id              ON playbooks (agent_id) WHERE agent_id IS NOT NULL;

-- scheduled_calls
CREATE INDEX IF NOT EXISTS idx_scheduled_calls_org_id          ON scheduled_calls (org_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_calls_agent_id        ON scheduled_calls (agent_id);

-- segments: already has segments_org_idx; skip

-- shopify_cache (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='shopify_cache') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_shopify_cache_org_id ON public.shopify_cache (org_id)';
  END IF;
END $$;

-- shopify_connections
CREATE INDEX IF NOT EXISTS idx_shopify_connections_org_id      ON shopify_connections (org_id);

-- spend_counters (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='spend_counters') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_spend_counters_org_id ON public.spend_counters (org_id)';
  END IF;
END $$;

-- subscriptions: org_id is PK; skip

-- twilio_subaccounts: org_id is PK; skip

-- usage_alerts (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='usage_alerts') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_usage_alerts_org_id ON public.usage_alerts (org_id)';
  END IF;
END $$;

-- usage_ledger (parent) — propagates to partitions
CREATE INDEX IF NOT EXISTS idx_usage_ledger_call_id            ON usage_ledger (call_id) WHERE call_id IS NOT NULL;
-- org_id already has composite idx on usage_ledger; skip

-- user_notification_prefs: user_id is PK; org_id needs index
CREATE INDEX IF NOT EXISTS idx_user_notification_prefs_org_id  ON user_notification_prefs (org_id);

-- user_sessions: user_id already has idx_user_sessions_user; skip
CREATE INDEX IF NOT EXISTS idx_user_sessions_org_id            ON public.user_sessions (org_id);

-- users: org_id already indexed; skip

-- waitlist
CREATE INDEX IF NOT EXISTS idx_waitlist_referred_by            ON public.waitlist (referred_by) WHERE referred_by IS NOT NULL;

-- webhook_dlq
CREATE INDEX IF NOT EXISTS idx_webhook_dlq_org_id              ON public.webhook_dlq (org_id);

-- webhook_endpoints (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='webhook_endpoints') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_org_id ON public.webhook_endpoints (org_id)';
  END IF;
END $$;

-- whatsapp_messages: already has idx_wa_messages_org; skip
