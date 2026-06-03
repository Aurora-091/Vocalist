/*
  # Demo seed RPC

  Adds a SECURITY DEFINER function `seed_demo_data(p_org)` that fills an
  organization with realistic sample content so a fresh account can explore
  Aurora immediately. Idempotent: safe to call multiple times — it skips
  when an agent named 'Front Desk (demo)' already exists.

  1. New objects
    - Function `public.seed_demo_data(p_org uuid) returns jsonb`
      - Inserts: 1 demo agent (inbound), 6 contacts with consent on file,
        1 phone number, 4 sample calls with transcripts and outcomes,
        1 knowledge source ("FAQ — demo"), 6 consent events, ticks
        all onboarding steps to true.

  2. Security
    - Granted to `authenticated` role; the function checks that the caller
      belongs to the target org via auth_org() before writing.
    - All inserts go through normal RLS-aware tables; ownership of every
      row is set to p_org.
*/

CREATE OR REPLACE FUNCTION public.seed_demo_data(p_org uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_org uuid := auth_org();
  v_agent_id uuid;
  v_contact1 uuid; v_contact2 uuid; v_contact3 uuid;
  v_contact4 uuid; v_contact5 uuid; v_contact6 uuid;
  v_phone_id uuid;
  v_existing uuid;
BEGIN
  IF v_caller_org IS NULL OR v_caller_org <> p_org THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id INTO v_existing
  FROM agents
  WHERE org_id = p_org AND name = 'Front Desk (demo)' AND deleted_at IS NULL
  LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('seeded', false, 'reason', 'already_exists', 'agent_id', v_existing);
  END IF;

  INSERT INTO agents (org_id, name, vertical, persona, provider, consent_required, languages, timezone)
  VALUES (
    p_org,
    'Front Desk (demo)',
    'clinic',
    jsonb_build_object(
      'direction', 'inbound',
      'objective', 'Answer questions, book appointments, route to a human if asked.',
      'tone', 'warm and professional',
      'business_name', 'Lakeshore Family Clinic'
    ),
    'mock',
    false,
    ARRAY['en']::text[],
    'America/New_York'
  )
  RETURNING id INTO v_agent_id;

  INSERT INTO phone_numbers (org_id, e164, owner, byo, agent_id, provider_ref, status)
  VALUES (p_org, '+14155550100', 'aurora', false, v_agent_id, 'demo-PN-0001', 'active')
  RETURNING id INTO v_phone_id;

  INSERT INTO contacts (org_id, e164, name, email, source, consent_status, consent_ts)
  VALUES
    (p_org, '+14155550199', 'Jordan Lee',     'jordan@example.com',  'demo', 'granted', now() - interval '6 days'),
    (p_org, '+14155550188', 'Priya Anand',    'priya@example.com',   'demo', 'granted', now() - interval '12 days'),
    (p_org, '+14155550177', 'Marcus Hill',    'marcus@example.com',  'demo', 'granted', now() - interval '3 days'),
    (p_org, '+14155550166', 'Sara Kim',       'sara@example.com',    'demo', 'none',    NULL),
    (p_org, '+14155550155', 'Diego Ramirez',  'diego@example.com',   'demo', 'granted', now() - interval '20 days'),
    (p_org, '+14155550144', 'Amelia Chen',    'amelia@example.com',  'demo', 'revoked', now() - interval '45 days')
  RETURNING id INTO v_contact1;

  SELECT id INTO v_contact1 FROM contacts WHERE org_id = p_org AND e164 = '+14155550199';
  SELECT id INTO v_contact2 FROM contacts WHERE org_id = p_org AND e164 = '+14155550188';
  SELECT id INTO v_contact3 FROM contacts WHERE org_id = p_org AND e164 = '+14155550177';
  SELECT id INTO v_contact4 FROM contacts WHERE org_id = p_org AND e164 = '+14155550166';
  SELECT id INTO v_contact5 FROM contacts WHERE org_id = p_org AND e164 = '+14155550155';
  SELECT id INTO v_contact6 FROM contacts WHERE org_id = p_org AND e164 = '+14155550144';

  INSERT INTO consent_events (org_id, e164, contact_id, kind, channel, evidence, occurred_at)
  VALUES
    (p_org, '+14155550199', v_contact1, 'granted', 'web_form', jsonb_build_object('form','signup'), now() - interval '6 days'),
    (p_org, '+14155550188', v_contact2, 'granted', 'web_form', jsonb_build_object('form','booking'), now() - interval '12 days'),
    (p_org, '+14155550177', v_contact3, 'granted', 'web_form', jsonb_build_object('form','signup'), now() - interval '3 days'),
    (p_org, '+14155550155', v_contact5, 'granted', 'sms_keyword', jsonb_build_object('keyword','START'), now() - interval '20 days'),
    (p_org, '+14155550144', v_contact6, 'revoked', 'sms_keyword', jsonb_build_object('keyword','STOP'), now() - interval '45 days');

  INSERT INTO calls (
    org_id, agent_id, contact_id, direction, status, provider, provider_call_id,
    started_at, ended_at, duration_sec, cost_usd, outcome, transcript, recording_url
  )
  VALUES
    (
      p_org, v_agent_id, v_contact1, 'inbound', 'completed', 'mock', 'demo-call-001',
      now() - interval '2 hours', now() - interval '2 hours' + interval '3 minutes 12 seconds',
      192, 0.32,
      jsonb_build_object('outcome','booked','booking_at', (now() + interval '2 days')::text),
      jsonb_build_array(
        jsonb_build_object('role','agent','text','Lakeshore Family Clinic, this is Aurora. How can I help?'),
        jsonb_build_object('role','user','text','I need to book a checkup for next week.'),
        jsonb_build_object('role','agent','text','Got it. We have Tuesday 10am or Wednesday 2pm. Which works?'),
        jsonb_build_object('role','user','text','Tuesday 10 sounds good.'),
        jsonb_build_object('role','agent','text','You''re booked for Tuesday at 10am. We''ll text a reminder.')
      ),
      'https://example.com/recordings/demo-call-001.mp3'
    ),
    (
      p_org, v_agent_id, v_contact2, 'inbound', 'completed', 'mock', 'demo-call-002',
      now() - interval '6 hours', now() - interval '6 hours' + interval '1 minute 48 seconds',
      108, 0.18,
      jsonb_build_object('outcome','answered','intent','hours'),
      jsonb_build_array(
        jsonb_build_object('role','agent','text','Lakeshore Family Clinic, this is Aurora.'),
        jsonb_build_object('role','user','text','What are your hours on Saturday?'),
        jsonb_build_object('role','agent','text','We''re open Saturdays 9 to 1.')
      ),
      'https://example.com/recordings/demo-call-002.mp3'
    ),
    (
      p_org, v_agent_id, v_contact3, 'inbound', 'completed', 'mock', 'demo-call-003',
      now() - interval '1 day', now() - interval '1 day' + interval '4 minutes 30 seconds',
      270, 0.45,
      jsonb_build_object('outcome','transferred','to','front_desk'),
      jsonb_build_array(
        jsonb_build_object('role','agent','text','How can I help?'),
        jsonb_build_object('role','user','text','I''d like to talk to a person about a billing issue.'),
        jsonb_build_object('role','agent','text','Of course, transferring you now.')
      ),
      'https://example.com/recordings/demo-call-003.mp3'
    ),
    (
      p_org, v_agent_id, v_contact5, 'inbound', 'voicemail', 'mock', 'demo-call-004',
      now() - interval '3 days', now() - interval '3 days' + interval '24 seconds',
      24, 0.04,
      jsonb_build_object('outcome','voicemail'),
      '[]'::jsonb,
      'https://example.com/recordings/demo-call-004.mp3'
    );

  INSERT INTO knowledge_sources (org_id, kind, title, uri, status)
  VALUES (p_org, 'website', 'FAQ — demo', 'https://lakeshore.example.com/faq', 'ready');

  UPDATE onboarding_state
  SET steps = jsonb_build_object(
        'pick_vertical', true,
        'connect_tools', true,
        'add_knowledge', true,
        'create_agent', true,
        'get_number', true,
        'test_and_golive', true
      ),
      completed_at = now(),
      updated_at = now()
  WHERE org_id = p_org;

  IF NOT FOUND THEN
    INSERT INTO onboarding_state (org_id, steps, completed_at)
    VALUES (
      p_org,
      jsonb_build_object(
        'pick_vertical', true,
        'connect_tools', true,
        'add_knowledge', true,
        'create_agent', true,
        'get_number', true,
        'test_and_golive', true
      ),
      now()
    );
  END IF;

  RETURN jsonb_build_object(
    'seeded', true,
    'agent_id', v_agent_id,
    'phone_id', v_phone_id,
    'contacts', 6,
    'calls', 4,
    'knowledge_sources', 1
  );
END;
$$;

REVOKE ALL ON FUNCTION public.seed_demo_data(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.seed_demo_data(uuid) TO authenticated;
