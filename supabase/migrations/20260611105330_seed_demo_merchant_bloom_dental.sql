DO $$
DECLARE
  v_org_id uuid;
  v_agent_id uuid;
  v_campaign_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM orgs WHERE name = 'Bloom Dental (Demo)' LIMIT 1;

  IF v_org_id IS NULL THEN
    INSERT INTO orgs (name, plan_id)
    VALUES ('Bloom Dental (Demo)', 'growth')
    RETURNING id INTO v_org_id;

    INSERT INTO agents (
      org_id, name, vertical, provider, persona
    ) VALUES (
      v_org_id,
      'Bloom Dental Receptionist',
      'healthcare',
      'elevenlabs',
      jsonb_build_object(
        'identity', jsonb_build_object(
          'name', 'Aurora',
          'role', 'virtual receptionist',
          'company', 'Bloom Dental'
        ),
        'tone', jsonb_build_object(
          'style', 'warm and professional',
          'energy', 'calm',
          'pace', 'moderate',
          'language', 'English'
        ),
        'goals', jsonb_build_array(
          'Confirm upcoming dental appointments',
          'Offer to reschedule if the patient cannot make it',
          'Answer basic questions about office hours and location'
        ),
        'guardrails', jsonb_build_array(
          'Never provide medical advice',
          'Do not discuss billing or insurance details',
          'Always offer to connect with a human staff member',
          'Respect opt-out requests immediately'
        ),
        'opening_message', 'Good afternoon, this is Aurora calling on behalf of Bloom Dental. Am I speaking with the right person?'
      )
    ) RETURNING id INTO v_agent_id;

    INSERT INTO phone_numbers (org_id, agent_id, e164, owner, byo, provider, status)
    VALUES (v_org_id, v_agent_id, '+15551234567', 'aurora', false, 'sandbox', 'active');

    INSERT INTO contacts (org_id, e164, name, email, source, consent_status, consent_ts) VALUES
      (v_org_id, '+15559876001', 'Sarah Mitchell', 'sarah.m@example.com', 'upload', 'granted', now()),
      (v_org_id, '+15559876002', 'James Rodriguez', 'james.r@example.com', 'upload', 'granted', now()),
      (v_org_id, '+15559876003', 'Emily Chen', 'emily.c@example.com', 'upload', 'granted', now()),
      (v_org_id, '+15559876004', 'Michael Thompson', 'michael.t@example.com', 'upload', 'granted', now()),
      (v_org_id, '+15559876005', 'Priya Patel', 'priya.p@example.com', 'upload', 'granted', now());

    INSERT INTO campaigns (org_id, agent_id, name, status, window_start, window_end, concurrency)
    VALUES (
      v_org_id, v_agent_id,
      'Weekly Appointment Confirmations',
      'completed',
      now() - interval '3 hours',
      now() - interval '1 hour',
      2
    ) RETURNING id INTO v_campaign_id;

    INSERT INTO calls (org_id, agent_id, campaign_id, direction, status, provider, started_at, ended_at, duration_sec, cost_usd, outcome) VALUES
      (v_org_id, v_agent_id, v_campaign_id, 'outbound', 'completed', 'elevenlabs', now() - interval '2 hours', now() - interval '2 hours' + interval '47 seconds', 47, 0.08, '{"type":"rescheduled","detail":"Moved to Friday 9am"}'::jsonb),
      (v_org_id, v_agent_id, v_campaign_id, 'outbound', 'completed', 'elevenlabs', now() - interval '90 minutes', now() - interval '90 minutes' + interval '32 seconds', 32, 0.05, '{"type":"confirmed"}'::jsonb),
      (v_org_id, v_agent_id, v_campaign_id, 'outbound', 'completed', 'elevenlabs', now() - interval '1 hour', now() - interval '1 hour' + interval '61 seconds', 61, 0.10, '{"type":"confirmed"}'::jsonb),
      (v_org_id, v_agent_id, v_campaign_id, 'outbound', 'completed', 'elevenlabs', now() - interval '45 minutes', now() - interval '45 minutes' + interval '18 seconds', 18, 0.03, '{"type":"voicemail"}'::jsonb),
      (v_org_id, v_agent_id, v_campaign_id, 'outbound', 'completed', 'elevenlabs', now() - interval '30 minutes', now() - interval '30 minutes' + interval '55 seconds', 55, 0.09, '{"type":"confirmed"}'::jsonb);

  END IF;
END $$;
