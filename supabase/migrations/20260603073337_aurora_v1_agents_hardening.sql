/*
  # Aurora v1: Agents Hardening + Force-Outbound-Consent

  1. Modified Tables
    - `agents`: add `languages text[]`, `business_hours jsonb`, `timezone`, `transfer_number`,
       `consent_required boolean`

  2. New Trigger
    - `force_outbound_consent` - any agent whose persona.direction is outbound|both has
      consent_required=true forced; cannot be flipped back to false. Hard DB invariant.

  3. Notes
    - Backs Scope §I non-negotiable #1 (no outbound dial without can_dial())
    - The no-code UI shows the flag as locked-on for outbound agents
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='agents' AND column_name='languages') THEN
    ALTER TABLE agents ADD COLUMN languages text[] NOT NULL DEFAULT '{en}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='agents' AND column_name='business_hours') THEN
    ALTER TABLE agents ADD COLUMN business_hours jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='agents' AND column_name='timezone') THEN
    ALTER TABLE agents ADD COLUMN timezone text NOT NULL DEFAULT 'UTC';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='agents' AND column_name='transfer_number') THEN
    ALTER TABLE agents ADD COLUMN transfer_number text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='agents' AND column_name='consent_required') THEN
    ALTER TABLE agents ADD COLUMN consent_required boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION force_outbound_consent() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.persona ->> 'direction') IN ('outbound','both') THEN
    NEW.consent_required := true;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.consent_required = true AND NEW.consent_required = false THEN
    RAISE EXCEPTION 'consent_required cannot be unset on agent %', NEW.id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS agents_force_consent ON agents;
CREATE TRIGGER agents_force_consent
  BEFORE INSERT OR UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION force_outbound_consent();
