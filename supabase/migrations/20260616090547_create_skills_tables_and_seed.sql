-- Skills catalog: reusable tool + prompt modules
CREATE TABLE agent_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  tool_definition jsonb NOT NULL DEFAULT '[]'::jsonb,
  prompt_module text NOT NULL DEFAULT '',
  config_schema jsonb DEFAULT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE agent_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_skills_public" ON agent_skills FOR SELECT
  TO authenticated USING (enabled = true);

-- Junction: which skills are active on which agent
CREATE TABLE agent_active_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES agent_skills(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  config jsonb DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_id, skill_id)
);

ALTER TABLE agent_active_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_active_skills" ON agent_active_skills FOR SELECT
  TO authenticated USING (org_id = auth.uid());
CREATE POLICY "insert_own_active_skills" ON agent_active_skills FOR INSERT
  TO authenticated WITH CHECK (org_id = auth.uid());
CREATE POLICY "update_own_active_skills" ON agent_active_skills FOR UPDATE
  TO authenticated USING (org_id = auth.uid()) WITH CHECK (org_id = auth.uid());
CREATE POLICY "delete_own_active_skills" ON agent_active_skills FOR DELETE
  TO authenticated USING (org_id = auth.uid());

-- Seed 8 composable skills
INSERT INTO agent_skills (slug, name, description, category, tool_definition, prompt_module) VALUES

('end_call', 'End Call', 'Allows the agent to hang up when the conversation is complete or the customer requests it.', 'system',
  '[{"type": "system", "name": "end_call", "description": "End the current call gracefully"}]'::jsonb,
  'When the conversation is complete, all goals are met, or the customer clearly wants to end the call, use the end_call tool. Always say goodbye before ending.'),

('transfer_to_human', 'Transfer to Human', 'Transfers the call to a human agent when the AI cannot handle the request.', 'system',
  '[{"type": "system", "name": "transfer_to_number", "description": "Transfer call to a human agent", "parameters": [{"identifier": "phone_number", "data_type": "string", "description": "Phone number to transfer to"}]}]'::jsonb,
  'If the customer explicitly requests a human, or if you cannot resolve their issue after 2 attempts, transfer them to a human agent. Always inform them before transferring.'),

('voicemail_detection', 'Voicemail Detection', 'Detects voicemail greetings and leaves a message or hangs up.', 'system',
  '[{"type": "system", "name": "voicemail_detection", "description": "Detect if call reached voicemail"}]'::jsonb,
  'If voicemail is detected, leave a brief message with: your name, the business name, reason for calling, and a callback number. Keep it under 20 seconds.'),

('language_detection', 'Language Detection', 'Detects the callers language and switches accordingly.', 'system',
  '[{"type": "system", "name": "language_detection", "description": "Detect caller language and adapt"}]'::jsonb,
  'If the caller speaks a language other than your configured language, attempt to detect it and switch if you are able to. If you cannot speak their language, politely explain and offer to transfer.'),

('sms_followup', 'SMS Follow-Up', 'Sends an SMS after the call with relevant links, confirmations, or next steps.', 'integration',
  '[{"name": "send_sms", "description": "Send an SMS to the caller with follow-up information", "method": "POST", "url": "{{base_url}}/v1/sms/send", "authentication": {"type": "bearer", "bearer_token": "{{org_token}}"}, "body_parameters": [{"identifier": "to", "data_type": "string", "description": "Phone number to send SMS to"}, {"identifier": "message", "data_type": "string", "description": "SMS message content, max 160 chars"}]}]'::jsonb,
  'When offering to send details via SMS (links, confirmations, promo codes), use the send_sms tool. Keep messages under 160 characters. Always ask permission before sending.'),

('calendar_booking', 'Calendar Booking', 'Books, reschedules, or cancels appointments in the connected calendar.', 'integration',
  '[{"name": "check_availability", "description": "Check available time slots for appointments", "method": "GET", "url": "{{calendar_proxy_url}}/availability?date={{date}}", "authentication": {"type": "bearer", "bearer_token": "{{org_token}}"}}, {"name": "book_appointment", "description": "Book an appointment slot", "method": "POST", "url": "{{calendar_proxy_url}}/appointments", "authentication": {"type": "bearer", "bearer_token": "{{org_token}}"}, "body_parameters": [{"identifier": "datetime", "data_type": "string", "description": "ISO datetime for the appointment"}, {"identifier": "patient_name", "data_type": "string", "description": "Name of the person"}, {"identifier": "type", "data_type": "string", "description": "Appointment type"}]}]'::jsonb,
  'When booking appointments: 1) Check availability first, 2) Offer 2-3 specific time options, 3) Confirm the chosen slot with the caller before booking, 4) Read back the confirmed date and time.'),

('order_lookup', 'Order Lookup', 'Fetches order details from the connected e-commerce platform.', 'integration',
  '[{"name": "lookup_order", "description": "Look up order by order number or customer email", "method": "GET", "url": "{{shopify_proxy_url}}/orders/search?q={{query}}", "authentication": {"type": "bearer", "bearer_token": "{{org_token}}"}}]'::jsonb,
  'When looking up orders: always verify customer identity first (email or phone on file). Only share order details after verification. Provide status, tracking number, and estimated delivery.'),

('dnc_compliance', 'DNC Compliance', 'Handles do-not-call requests by flagging contacts and ending calls.', 'compliance',
  '[{"name": "flag_dnc", "description": "Flag this contact as do-not-call", "method": "POST", "url": "{{base_url}}/v1/contacts/dnc", "authentication": {"type": "bearer", "bearer_token": "{{org_token}}"}, "body_parameters": [{"identifier": "phone", "data_type": "string", "description": "Phone number to add to DNC list"}, {"identifier": "reason", "data_type": "string", "description": "Reason for DNC request"}]}]'::jsonb,
  'If the caller says any variation of "stop calling", "remove me", "do not call", or "unsubscribe": 1) Immediately stop your pitch, 2) Confirm you will remove them, 3) Use the flag_dnc tool, 4) Thank them and end the call. This takes priority over all other goals.');
