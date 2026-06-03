/*
  # Aurora v1: Verticals, Onboarding, Branding

  1. New Tables / Columns
    - `vertical_configs` (global, NOT org-scoped) - one row per vertical (Shopify, Clinic, future)
    - `orgs.vertical_config_id` - FK to vertical_configs (nullable until picked)
    - `orgs.branding` jsonb - whitelabel logo + brand color
    - `onboarding_state` - one row per org, drives the dashboard checklist

  2. New Enums
    - `onboarding_step`: pick_vertical, connect_tools, add_knowledge, create_agent, get_number, test_and_golive

  3. Security
    - RLS enabled on `onboarding_state` (org-scoped)
    - `vertical_configs` is global config: SELECT to all authenticated, no tenant writes
    - Verticals seeded for shopify + clinic

  4. Notes
    - vertical_configs.config jsonb holds: glossary, recommended_integrations[], recommended_template_ids[],
      knowledge_prompts[], default_contact_fields[]
    - Verticals are CONFIG, never hardcoded - adding a vertical = inserting a row
*/

-- Enums
DO $$ BEGIN
  CREATE TYPE onboarding_step AS ENUM ('pick_vertical','connect_tools','add_knowledge','create_agent','get_number','test_and_golive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- vertical_configs: global, read-only to tenants
CREATE TABLE IF NOT EXISTS vertical_configs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text NOT NULL UNIQUE,
  label      text NOT NULL,
  config     jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled    boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vertical_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vertical_configs_read_all ON vertical_configs;
CREATE POLICY vertical_configs_read_all ON vertical_configs
  FOR SELECT TO authenticated USING (true);

-- Seed Shopify + Clinic
INSERT INTO vertical_configs (key, label, config, enabled) VALUES
  ('shopify', 'Online Store',
    '{"glossary":{"contact":"Customer","campaign":"Outreach"},
      "recommended_integrations":["shopify","stripe","calcom"],
      "recommended_templates":["cart_recovery","order_support","promo_blast"],
      "knowledge_prompts":["Shipping & Returns Policy","FAQ","Sizing Guide"],
      "default_contact_fields":["last_order_id","total_spend","first_purchase_at"]}'::jsonb, true),
  ('clinic', 'Clinic / Practice',
    '{"glossary":{"contact":"Patient","campaign":"Recall"},
      "recommended_integrations":["calcom","google_cal","outlook_cal"],
      "recommended_templates":["appointment_booking","reminder","no_show_recovery"],
      "knowledge_prompts":["Services & Hours","Insurance accepted","Provider bios"],
      "default_contact_fields":["provider","next_appt_at","insurance"]}'::jsonb, true)
ON CONFLICT (key) DO NOTHING;

-- orgs additions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='orgs' AND column_name='vertical_config_id') THEN
    ALTER TABLE orgs ADD COLUMN vertical_config_id uuid REFERENCES vertical_configs(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='orgs' AND column_name='branding') THEN
    ALTER TABLE orgs ADD COLUMN branding jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- onboarding_state
CREATE TABLE IF NOT EXISTS onboarding_state (
  org_id       uuid PRIMARY KEY REFERENCES orgs(id) ON DELETE CASCADE,
  steps        jsonb NOT NULL DEFAULT '{}'::jsonb,
  dismissed    boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE onboarding_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS onboarding_state_select ON onboarding_state;
CREATE POLICY onboarding_state_select ON onboarding_state
  FOR SELECT TO authenticated USING (org_id = auth_org());

DROP POLICY IF EXISTS onboarding_state_insert ON onboarding_state;
CREATE POLICY onboarding_state_insert ON onboarding_state
  FOR INSERT TO authenticated WITH CHECK (org_id = auth_org());

DROP POLICY IF EXISTS onboarding_state_update ON onboarding_state;
CREATE POLICY onboarding_state_update ON onboarding_state
  FOR UPDATE TO authenticated USING (org_id = auth_org()) WITH CHECK (org_id = auth_org());
