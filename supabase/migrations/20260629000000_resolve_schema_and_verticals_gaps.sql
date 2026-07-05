-- Resolve Database Gaps and Verticals Migration
-- Date: 2026-06-29

-- 1. Ensure Extensions Schema and pgvector
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 2. Drop unused tables
DROP TABLE IF EXISTS public.inbound_rate_counters CASCADE;
DROP TABLE IF EXISTS public.spend_guards CASCADE;

-- 3. Hardening auth_org() function to fetch org_id from app_metadata in JWT claims
CREATE OR REPLACE FUNCTION public.auth_org()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'org_id', ''),
    NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', '')
  )::uuid
$$;

-- 4. Blocker: calls number tracking
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS from_number text;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS to_number text;

-- 5. Configurable variables on agent_presets and variable_values on agents
ALTER TABLE public.agent_presets ADD COLUMN IF NOT EXISTS configurable_variables jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS variable_values jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 6. Subscriptions additions (Dodo/Razorpay payment columns)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS dodo_customer_id text,
  ADD COLUMN IF NOT EXISTS dodo_subscription_id text,
  ADD COLUMN IF NOT EXISTS razorpay_customer_id text,
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id text;

-- 7. DPDP Compliance Tables (India clinic vertical)
CREATE TABLE IF NOT EXISTS public.consent_notices (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  purpose      text NOT NULL,
  notice_text  text NOT NULL,
  version      text NOT NULL DEFAULT '1.0',
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.consent_notices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS consent_notices_isolation ON public.consent_notices;
CREATE POLICY consent_notices_isolation ON public.consent_notices
  USING (org_id = auth_org())
  WITH CHECK (org_id = auth_org());

CREATE TABLE IF NOT EXISTS public.dpdp_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  contact_id   uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  request_type text NOT NULL CHECK (request_type IN ('access', 'correction', 'erasure', 'grievance')),
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'rejected')),
  details      jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dpdp_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dpdp_requests_isolation ON public.dpdp_requests;
CREATE POLICY dpdp_requests_isolation ON public.dpdp_requests
  USING (org_id = auth_org())
  WITH CHECK (org_id = auth_org());

-- 8. Alter default provider for agents
ALTER TABLE public.agents ALTER COLUMN provider SET DEFAULT 'elevenlabs';

-- 9. Pre-create monthly partition tables (October 2026 to December 2027)
DO $$
DECLARE
  v_start date;
  v_end date;
  v_suffix text;
  v_table text;
BEGIN
  FOR i IN 0..14 LOOP
    v_start := ('2026-10-01'::date + (i || ' month')::interval)::date;
    v_end   := ('2026-10-01'::date + ((i + 1) || ' month')::interval)::date;
    v_suffix := to_char(v_start, 'YYYY_MM');
    
    FOREACH v_table IN ARRAY ARRAY['call_events', 'webhook_events', 'usage_ledger'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_class
         WHERE relname = v_table || '_' || v_suffix
      ) THEN
        EXECUTE format(
          'CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES FROM (%L) TO (%L)',
          v_table || '_' || v_suffix, v_table, v_start, v_end
        );
        EXECUTE format(
          'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
          v_table || '_' || v_suffix
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;


-- 11. Seed Verticals config (Insurance and Real Estate)
INSERT INTO public.vertical_configs (key, label, config, enabled) VALUES
  ('insurance', 'Insurance Agency',
    '{"glossary":{"contact":"Lead","campaign":"Campaign"},
      "recommended_integrations":["calcom","hubspot","salesforce"],
      "recommended_templates":["quote_followup","renewal_notice","policy_update"],
      "knowledge_prompts":["Policies Offered","FAQ","Claims Process"],
      "default_contact_fields":["policy_type","renewal_date","lead_status"]}'::jsonb, true),
  ('real_estate', 'Real Estate Brokerage',
    '{"glossary":{"contact":"Client","campaign":"Nurture"},
      "recommended_integrations":["calcom","followupboss","zillow"],
      "recommended_templates":["lead_qualification","viewing_followup","market_update"],
      "knowledge_prompts":["Current Listings","FAQ","Buying/Selling Process"],
      "default_contact_fields":["budget","property_interest","client_type"]}'::jsonb, true)
ON CONFLICT (key) DO UPDATE
SET config = EXCLUDED.config, label = EXCLUDED.label, enabled = EXCLUDED.enabled;

-- 12. Seed presets for Insurance and Real Estate
INSERT INTO public.agent_presets (vertical_key, preset_key, name, description, direction, persona, tools, voice_id, voice_name, languages, consent_required, sort_order, analysis_config, configurable_variables) VALUES
  ('insurance', 'insurance_quote_followup', 'Quote Follow-up', 'Follows up on recent insurance quote requests to answer questions and encourage binding the policy.', 'outbound',
    '{"objective": "Follow up on recent quote requests to answer questions and encourage binding the policy.",
      "tone": "warm, professional, advisory",
      "system_prompt": "You are a warm, professional insurance assistant calling from {{business_name}}. You are following up on a quote request from {{customer_name}}.\n\nRules:\n- Welcome the customer and state your name/business\n- Mention the policy quote type: {{policy_type}}\n- Ask if they had any questions on the quote details\n- Emphasize the benefits of {{insurance_benefit}} configured for them\n- Gently guide them to schedule a call with a licensed agent if they want to proceed\n\nContext:\n- Customer: {{customer_name}}\n- Quote Type: {{policy_type}}\n- Monthly Premium: ${{quote_monthly_premium}}",
      "first_message": "Hello {{customer_name}}, this is {{agent_name}} from {{business_name}}. I noticed you recently requested a quote for {{policy_type}} insurance and wanted to see if you had any questions on the details. Do you have a quick moment?",
      "guardrails": ["Never guarantee coverage or specific rates", "Comply with DNC requests instantly", "Never share other clients data"]
    }'::jsonb, '[]'::jsonb, 'EXAVITQu4vr4xnSDxMaL', 'Bella', ARRAY['en'], true, 1,
    '{"data_collection": [
       {"identifier": "interested_in_binding", "data_type": "boolean", "description": "Did the customer express interest in binding the policy?"},
       {"identifier": "licensed_agent_requested", "data_type": "boolean", "description": "Did they request a call back from a licensed agent?"}
     ],
     "evaluation_criteria": [
       {"identifier": "policy_details_addressed", "description": "The agent verified policy type and offered clarification on details"}
     ]}'::jsonb,
     '[{"identifier": "policy_type", "data_type": "string", "description": "Type of insurance policy (auto, home, life)"},
       {"identifier": "insurance_benefit", "data_type": "string", "description": "Key benefit to emphasize (e.g. accident forgiveness, low premiums)"}]'::jsonb),

  ('insurance', 'insurance_renewal_notice', 'Renewal Notice', 'Reminds existing clients of upcoming policy renewals, highlights any changes, and confirms auto-renewal or handles payment update.', 'outbound',
    '{"objective": "Remind clients of upcoming policy renewal and confirm auto-renewal or update billing.",
      "tone": "professional, reassuring, helpful",
      "system_prompt": "You are a helpful insurance representative calling from {{business_name}} to remind {{customer_name}} about their upcoming policy renewal.\n\nRules:\n- State your name and the insurance agency clearly\n- Inform them that their policy (Type: {{policy_type}}) is renewing on {{renewal_date}}\n- Ask if they would like to keep the current coverage and confirm auto-renewal\n- If they need to make updates, schedule a call with their account manager\n\nContext:\n- Client: {{customer_name}}\n- Policy: {{policy_type}}\n- Renewal Date: {{renewal_date}}\n- Premium change: {{premium_change_status}}",
      "first_message": "Hi {{customer_name}}, this is {{agent_name}} from {{business_name}}. I''m calling to let you know that your {{policy_type}} policy is coming up for renewal on {{renewal_date}}. I wanted to confirm everything looks good to proceed with renewal?",
      "guardrails": ["Never modify policy limits directly on the call", "Respect opt-out requests instantly"]
    }'::jsonb, '[]'::jsonb, 'ErXwobaYiN019PkySvjV', 'Antoni', ARRAY['en'], true, 2,
    '{"data_collection": [
       {"identifier": "renewal_confirmed", "data_type": "boolean", "description": "Did the customer confirm renewal?"},
       {"identifier": "wants_coverage_changes", "data_type": "boolean", "description": "Did they request changes to their coverage limits?"}
     ],
     "evaluation_criteria": [
       {"identifier": "renewal_verified", "description": "The agent confirmed renewal date and policy type"}
     ]}'::jsonb,
     '[{"identifier": "policy_type", "data_type": "string", "description": "Type of insurance policy (auto, home, life)"},
       {"identifier": "renewal_date", "data_type": "string", "description": "Upcoming policy renewal date"}]'::jsonb),

  ('real_estate', 'real_estate_lead_qualification', 'Lead Qualification', 'Qualifies incoming buyer/renter leads, asking about budget, property type, and timing.', 'outbound',
    '{"objective": "Qualify incoming real estate leads by gathering budget, location, and timing criteria.",
      "tone": "personable, enthusiastic, professional",
      "system_prompt": "You are a real estate assistant calling from {{business_name}} to qualify {{customer_name}} as a prospective buyer or renter.\n\nRules:\n- Identify yourself and the brokerage\n- Ask if they are looking to buy or rent\n- Inquire about their preferred neighborhoods in {{target_city}}\n- Ask about their budget: {{budget_range}}\n- Check their desired timeline to move\n- Offer to connect them with a local agent specializing in {{property_interest}}\n\nContext:\n- Customer: {{customer_name}}\n- Budget: {{budget_range}}\n- Preferred City: {{target_city}}",
      "first_message": "Hi {{customer_name}}, this is {{agent_name}} from {{business_name}}. I saw you were looking at some properties in {{target_city}} and wanted to see if you are looking to buy or rent. Do you have a moment to chat?",
      "guardrails": ["Do not quote mortgage rates or legal conditions", "End call immediately if they ask to be removed"]
    }'::jsonb, '[]'::jsonb, 'EXAVITQu4vr4xnSDxMaL', 'Bella', ARRAY['en'], true, 1,
    '{"data_collection": [
       {"identifier": "buyer_or_renter", "data_type": "string", "description": "Is the lead looking to buy, rent, or sell?"},
       {"identifier": "qualified_lead", "data_type": "boolean", "description": "Does the client have a clear timeline and budget?"}
     ],
     "evaluation_criteria": [
       {"identifier": "budget_gathered", "description": "The agent successfully gathered the client''s budget and timeline"}
     ]}'::jsonb,
     '[{"identifier": "target_city", "data_type": "string", "description": "The primary city/area of interest"},
       {"identifier": "budget_range", "data_type": "string", "description": "Default budget range to mention"}]'::jsonb),

  ('real_estate', 'real_estate_viewing_feedback', 'Viewing Feedback', 'Calls clients who recently toured a property to gather feedback and check if they want to make an offer.', 'outbound',
    '{"objective": "Follow up on recent property viewings to gather client feedback and interest level.",
      "tone": "conversational, interested, polite",
      "system_prompt": "You are calling from {{business_name}} to follow up with {{customer_name}} regarding their recent viewing of the property at {{property_address}}.\n\nRules:\n- Identify yourself and the brokerage\n- Ask what they thought of the property at {{property_address}}\n- Inquire if the size, layout, and price met their expectations\n- Ask if they are interested in making an offer or viewing other listings\n\nContext:\n- Client: {{customer_name}}\n- Property: {{property_address}}",
      "first_message": "Hello {{customer_name}}, this is {{agent_name}} from {{business_name}}. I''m calling to follow up on your tour of {{property_address}} yesterday. What did you think of the home?",
      "guardrails": ["Never guess or fabricate property facts", "Respect DNC demands instantly"]
    }'::jsonb, '[]'::jsonb, 'ErXwobaYiN019PkySvjV', 'Antoni', ARRAY['en'], true, 2,
    '{"data_collection": [
       {"identifier": "liked_property", "data_type": "boolean", "description": "Did the customer like the toured property?"},
       {"identifier": "wants_to_make_offer", "data_type": "boolean", "description": "Did they show interest in making an offer?"}
     ],
     "evaluation_criteria": [
       {"identifier": "feedback_collected", "description": "The agent asked specific questions about the layout, price, and interest"}
     ]}'::jsonb,
     '[{"identifier": "property_address", "data_type": "string", "description": "Address of the toured property"}]'::jsonb)
ON CONFLICT (preset_key) DO UPDATE
SET vertical_key = EXCLUDED.vertical_key,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    direction = EXCLUDED.direction,
    persona = EXCLUDED.persona,
    tools = EXCLUDED.tools,
    voice_id = EXCLUDED.voice_id,
    voice_name = EXCLUDED.voice_name,
    languages = EXCLUDED.languages,
    consent_required = EXCLUDED.consent_required,
    sort_order = EXCLUDED.sort_order,
    analysis_config = EXCLUDED.analysis_config,
    configurable_variables = EXCLUDED.configurable_variables;
