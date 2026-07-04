-- DPDP (Digital Personal Data Protection Act, 2023) enhancements to consent_events.
-- Adds columns required for DPDP compliance auditing without breaking existing
-- append-only immutability triggers or RLS policies.
-- All new columns are nullable to preserve backward compatibility with existing insert paths.

ALTER TABLE consent_events ADD COLUMN IF NOT EXISTS purpose TEXT;
ALTER TABLE consent_events ADD COLUMN IF NOT EXISTS legal_basis TEXT;
ALTER TABLE consent_events ADD COLUMN IF NOT EXISTS retention_days INTEGER;
ALTER TABLE consent_events ADD COLUMN IF NOT EXISTS data_principal_name TEXT;

-- Constrain legal_basis to DPDP-recognised values
ALTER TABLE consent_events
  ADD CONSTRAINT chk_consent_legal_basis
  CHECK (legal_basis IS NULL OR legal_basis IN (
    'consent', 'legitimate_interest', 'contract', 'legal_obligation', 'vital_interest', 'public_interest'
  ));

-- Index for DPDP audit queries (e.g. "show all consent events with purpose X for org Y")
CREATE INDEX IF NOT EXISTS idx_consent_events_purpose
  ON consent_events (org_id, purpose) WHERE purpose IS NOT NULL;

-- Column documentation
COMMENT ON COLUMN consent_events.purpose IS 'DPDP data processing purpose declaration (e.g. marketing, appointment_reminders, cart_recovery)';
COMMENT ON COLUMN consent_events.legal_basis IS 'Legal basis for processing under DPDP: consent, legitimate_interest, contract, legal_obligation, vital_interest, public_interest';
COMMENT ON COLUMN consent_events.retention_days IS 'Data retention period in days as declared to the data principal at time of consent';
COMMENT ON COLUMN consent_events.data_principal_name IS 'Name of the data principal (individual) for DPDP compliance audit trail';
