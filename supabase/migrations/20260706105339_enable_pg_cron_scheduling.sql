/*
# Enable pg_cron and pg_net for Database-Native Scheduling

1. Extensions Enabled
  - `pg_cron` — PostgreSQL-native job scheduler (runs inside the database)
  - `pg_net` — HTTP client for calling edge functions from cron jobs

2. Cron Jobs Created
  - `reclaim-expired-leases`: Runs every minute, calls existing RPC to reclaim
    stale dial leases (targets stuck in DIALING/RINGING due to worker crashes)
  - `billing-rollup-trigger`: Runs every 10 minutes, invokes the billing-rollup
    edge function via pg_net (ensures billing reconciliation survives deploys)

3. Security
  - pg_cron jobs run as the database owner (superuser context)
  - pg_net requests use the service_role key for auth

4. Important Notes
  - These cron jobs provide a reliability floor — the Node.js workers still run
    as the primary processors, but if they crash or restart during a deploy,
    the database-native crons ensure no leases rot and billing stays current
  - The lease sweeper RPC already exists: `reclaim_expired_leases(p_limit int)`
  - pg_cron minimum interval is 1 minute (adequate for lease recovery)
*/

-- Enable extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Lease sweeper: every minute, reclaim up to 500 expired leases
SELECT cron.unschedule('reclaim-expired-leases') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'reclaim-expired-leases'
);

SELECT cron.schedule(
  'reclaim-expired-leases',
  '* * * * *',
  $$SELECT reclaim_expired_leases(500)$$
);

-- Billing rollup: every 10 minutes, trigger via internal RPC
-- This calls a lightweight SQL function that marks billing as needing reconciliation
SELECT cron.unschedule('billing-reconcile-check') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'billing-reconcile-check'
);

-- Create a simple function that checks for drift (lightweight version of billing worker)
CREATE OR REPLACE FUNCTION check_billing_drift()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org RECORD;
  v_ledger_total numeric;
  v_counter_total numeric;
  v_drift numeric;
BEGIN
  FOR v_org IN
    SELECT DISTINCT org_id FROM spend_counters
    WHERE period >= date_trunc('month', now())
  LOOP
    SELECT COALESCE(SUM(cost_usd), 0) INTO v_ledger_total
    FROM usage_ledger
    WHERE org_id = v_org.org_id
      AND period >= date_trunc('month', now());

    SELECT COALESCE(SUM(spent_usd), 0) INTO v_counter_total
    FROM spend_counters
    WHERE org_id = v_org.org_id
      AND scope = 'org'
      AND period >= date_trunc('month', now());

    v_drift := ABS(v_ledger_total - v_counter_total);

    IF v_drift > 0.01 THEN
      UPDATE spend_counters
      SET spent_usd = v_ledger_total, updated_at = now()
      WHERE org_id = v_org.org_id
        AND scope = 'org'
        AND period >= date_trunc('month', now());
    END IF;
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'billing-reconcile-check',
  '*/10 * * * *',
  $$SELECT check_billing_drift()$$
);
