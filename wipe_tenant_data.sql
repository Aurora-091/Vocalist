-- ==========================================================================
-- DATA WIPE SCRIPT  (tenant data only, preserves static/seed tables)
-- Run via: supabase db execute --file wipe_tenant_data.sql
-- OR paste directly into the Supabase SQL Editor as a superuser/service_role.
-- ==========================================================================

-- 1. Temporarily disable append-only triggers so we can truncate
--    (these tables have block_mutation() triggers that reject DELETE/UPDATE).
ALTER TABLE consent_events       DISABLE TRIGGER ALL;
ALTER TABLE dialer_transitions   DISABLE TRIGGER ALL;
ALTER TABLE webhook_events       DISABLE TRIGGER ALL;
ALTER TABLE usage_ledger         DISABLE TRIGGER ALL;

-- 2. Truncate all tenant tables in safe dependency order (leaves to roots).
--    RESTART IDENTITY resets sequences. CASCADE covers partitions.
TRUNCATE TABLE
  -- Append-only / event tables first
  dialer_transitions,
  consent_events,
  webhook_events,    -- partitioned; CASCADE hits all partition children
  usage_ledger,      -- partitioned; CASCADE hits all partition children
  call_events,       -- partitioned

  -- Call + campaign data
  calls,
  campaign_targets,
  campaigns,
  scheduled_calls,
  broadcasts,

  -- Comms
  whatsapp_messages,

  -- Contacts & consent
  dnc_list,
  contacts,
  segments,

  -- Phone & Twilio
  phone_numbers,
  phone_number_search_cache,
  twilio_subaccounts,
  inbound_rate_counters,
  spend_counters,
  spend_guards,
  usage_alerts,

  -- Knowledge
  knowledge_chunks,
  knowledge_provider_mappings,
  knowledge_sources,
  agent_knowledge,

  -- Agents & organization linking
  agent_active_skills,
  organization_agents,
  agents,

  -- Integrations & OAuth
  integration_bridge_config,
  oauth_tokens,
  shopify_connections,
  shopify_cache,

  -- Notifications & sessions
  notifications,
  user_notification_prefs,
  user_sessions,
  audit_log,

  -- Onboarding & billing
  onboarding_state,
  subscriptions,

  -- Webhook endpoints & DLQ
  webhook_endpoints,
  webhook_dlq,

  -- Consent / DPDP
  consent_notices,
  dpdp_requests,

  -- Users (public profile rows; auth.users deleted separately below)
  users,

  -- Orgs (root; most tables cascade from here already)
  orgs

RESTART IDENTITY CASCADE;

-- 3. Re-enable append-only triggers
ALTER TABLE consent_events       ENABLE TRIGGER ALL;
ALTER TABLE dialer_transitions   ENABLE TRIGGER ALL;
ALTER TABLE webhook_events       ENABLE TRIGGER ALL;
ALTER TABLE usage_ledger         ENABLE TRIGGER ALL;

-- 4. Delete all Supabase auth users (requires service_role / superuser).
--    This removes the auth.users rows; public.users was already truncated above.
DELETE FROM auth.users;

-- Done. Static/seed tables kept intact:
--   plan_tiers, voice_catalog, agent_presets, integration_catalog,
--   agent_skills (skill catalog), vertical_configs, site_settings,
--   platform_settings, tracking_profiles, waitlist, enterprise_inquiries.
