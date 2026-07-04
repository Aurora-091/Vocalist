-- ============================================================
-- ITEM 2: Stale Sandbox Phone Numbers Diagnostic Query
-- Run this in the Supabase SQL Editor (service_role / superuser).
--
-- Finds phone_numbers rows where:
--   1. e164 matches sandbox pattern: +1<areacode>555XXXX or +1800555XXXX
--   2. The org's twilio_subaccounts row has subaccount_sid NOT starting
--      with 'ACsandbox' (i.e. real credentials now, but number is fake)
--
-- These numbers will 404 on Twilio the next time an outbound call is attempted.
-- ============================================================

SELECT
  pn.id              AS phone_number_id,
  pn.e164,
  pn.org_id,
  pn.agent_id,
  pn.provider_sid,
  pn.status,
  pn.created_at      AS number_created_at,
  ts.subaccount_sid,
  ts.account_type,
  ts.status          AS subaccount_status,
  a.name             AS agent_name,
  o.name             AS org_name
FROM phone_numbers pn
JOIN twilio_subaccounts ts ON ts.org_id = pn.org_id
LEFT JOIN agents a ON a.id = pn.agent_id AND a.deleted_at IS NULL
LEFT JOIN orgs o ON o.id = pn.org_id
WHERE
  -- Sandbox number pattern: +1{3-digit-areacode}555{4-digits}
  -- or tollfree: +1800555{4-digits}
  (
    pn.e164 ~ '^\+1[0-9]{3}555[0-9]{4}$'   -- any area code + 555 prefix
    OR
    pn.e164 ~ '^\+1800555[0-9]{4}$'          -- tollfree sandbox
  )
  -- But the org now has a REAL (non-sandbox) Twilio subaccount
  AND ts.subaccount_sid NOT LIKE 'ACsandbox%'
ORDER BY pn.org_id, pn.created_at;
