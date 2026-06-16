-- 1. Add hangup_by column to calls table
ALTER TABLE calls ADD COLUMN IF NOT EXISTS hangup_by text;

-- 2. Add renews_at and monthly_cost columns to phone_numbers
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS purchased_at timestamptz;
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS renews_at timestamptz;
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS monthly_cost numeric(8,2);
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS telephony_provider text DEFAULT 'twilio';

-- 3. Expand category check constraint to include 'telephony'
ALTER TABLE integration_catalog DROP CONSTRAINT IF EXISTS integration_catalog_category_check;
ALTER TABLE integration_catalog ADD CONSTRAINT integration_catalog_category_check
  CHECK (category IN ('ecommerce','messaging','calendar','spreadsheet','crm','ehr','automation','telephony'));

-- 4. Seed telephony providers into integration_catalog
INSERT INTO integration_catalog (provider_key, name, description, icon_key, category, auth_type, verticals, scopes, setup_instructions, tier_required, sort_order) VALUES
(
  'twilio',
  'Twilio',
  'Industry-leading cloud communications. Make and receive calls, SMS, and more with global reach.',
  'cloud',
  'telephony',
  'api_key',
  ARRAY['ecommerce', 'retail', 'clinic', 'services'],
  ARRAY['voice:call', 'voice:receive', 'sms:send'],
  '[{"step": 1, "text": "Sign up at twilio.com and get your Account SID"}, {"step": 2, "text": "Copy your Auth Token from the Twilio Console"}, {"step": 3, "text": "Enter both credentials below to connect"}]'::jsonb,
  'starter',
  1
),
(
  'plivo',
  'Plivo',
  'High-quality voice and SMS APIs with competitive pricing. Great for high-volume outbound campaigns.',
  'cloud',
  'telephony',
  'api_key',
  ARRAY['ecommerce', 'retail', 'clinic', 'services'],
  ARRAY['voice:call', 'voice:receive', 'sms:send'],
  '[{"step": 1, "text": "Sign up at plivo.com and navigate to your dashboard"}, {"step": 2, "text": "Copy your Auth ID and Auth Token"}, {"step": 3, "text": "Enter both credentials below to connect"}]'::jsonb,
  'starter',
  2
),
(
  'exotel',
  'Exotel',
  'India-focused cloud telephony platform. Reliable local numbers with IVR and call routing built in.',
  'cloud',
  'telephony',
  'api_key',
  ARRAY['ecommerce', 'retail', 'clinic', 'services'],
  ARRAY['voice:call', 'voice:receive'],
  '[{"step": 1, "text": "Log into your Exotel dashboard"}, {"step": 2, "text": "Navigate to Settings > API and copy your API Key and Token"}, {"step": 3, "text": "Enter your subdomain and credentials below"}]'::jsonb,
  'starter',
  3
),
(
  'vobiz',
  'Vobiz',
  'Cost-effective telephony for Indian markets. Supports bulk calling, IVR, and local number provisioning.',
  'cloud',
  'telephony',
  'api_key',
  ARRAY['ecommerce', 'retail', 'clinic', 'services'],
  ARRAY['voice:call', 'voice:receive'],
  '[{"step": 1, "text": "Log into your Vobiz portal"}, {"step": 2, "text": "Go to API Settings and generate an API key"}, {"step": 3, "text": "Enter your API key and secret below"}]'::jsonb,
  'starter',
  4
)
ON CONFLICT (provider_key) DO NOTHING;
