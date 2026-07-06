-- Drop zombie tables: exist in live DB but have zero application code references.
-- audit_log, consent_notices, dpdp_requests were superseded by consent_events,
-- gdpr_requests, and the append-only audit ledger pattern but never removed.
-- CASCADE drops all dependent objects: indexes, policies, FK constraints automatically.

DROP TABLE IF EXISTS public.audit_log CASCADE;
DROP TABLE IF EXISTS public.consent_notices CASCADE;
DROP TABLE IF EXISTS public.dpdp_requests CASCADE;
