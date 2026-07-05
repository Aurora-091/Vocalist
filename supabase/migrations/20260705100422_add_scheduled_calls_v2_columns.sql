/*
# Add V2 columns to scheduled_calls table

## Summary
Extends the scheduled_calls table with columns needed for production-grade Shopify integration:
- Conversion cancellation and revenue attribution
- COD confirmation flow support
- Retry ladder tracking
- Playbook routing

## New Columns
- `checkout_token` (text) — Shopify checkout token for linking orders to checkouts
- `order_id` (text) — Shopify order ID for COD idempotency and order-linked calls
- `attempt` (integer, default 1) — Current attempt number for retry ladder
- `outcome` (text) — Call outcome: converted, no_answer, voicemail, declined, failed
- `recovered_order_id` (text) — Order ID attributed to this call's recovery
- `recovered_value` (numeric) — Revenue value attributed to this call
- `recovered_currency` (text, default 'INR') — Currency of recovered value
- `cancelled_reason` (text) — Why the call was cancelled (converted, app_uninstalled, order_cancelled, max_attempts)
- `playbook_key` (text) — Which playbook flow this call belongs to (cart_recovery, cod_confirm, feedback)

## Indexes
- Index on checkout_token for order→checkout lookup during conversion cancel
- Index on order_id for COD idempotency checks
- Index on (org_id, status, scheduled_at) for scheduler polling

## Important Notes
1. All new columns are nullable to preserve backward compatibility with existing rows.
2. No data is modified or deleted — purely additive.
3. The cancelled_reason column documents WHY a call was cancelled, complementing the status='cancelled' state.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_calls' AND column_name = 'checkout_token') THEN
    ALTER TABLE scheduled_calls ADD COLUMN checkout_token text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_calls' AND column_name = 'order_id') THEN
    ALTER TABLE scheduled_calls ADD COLUMN order_id text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_calls' AND column_name = 'attempt') THEN
    ALTER TABLE scheduled_calls ADD COLUMN attempt integer NOT NULL DEFAULT 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_calls' AND column_name = 'outcome') THEN
    ALTER TABLE scheduled_calls ADD COLUMN outcome text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_calls' AND column_name = 'recovered_order_id') THEN
    ALTER TABLE scheduled_calls ADD COLUMN recovered_order_id text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_calls' AND column_name = 'recovered_value') THEN
    ALTER TABLE scheduled_calls ADD COLUMN recovered_value numeric;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_calls' AND column_name = 'recovered_currency') THEN
    ALTER TABLE scheduled_calls ADD COLUMN recovered_currency text DEFAULT 'INR';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_calls' AND column_name = 'cancelled_reason') THEN
    ALTER TABLE scheduled_calls ADD COLUMN cancelled_reason text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_calls' AND column_name = 'playbook_key') THEN
    ALTER TABLE scheduled_calls ADD COLUMN playbook_key text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_scheduled_calls_checkout_token
  ON scheduled_calls (checkout_token) WHERE checkout_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scheduled_calls_order_id
  ON scheduled_calls (order_id) WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scheduled_calls_org_status_scheduled
  ON scheduled_calls (org_id, status, scheduled_at);
