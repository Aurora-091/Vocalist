-- Add Stripe Billing Columns
-- Date: 2026-06-29

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_tier_key text,
  ADD COLUMN IF NOT EXISTS stripe_usage_item_id text,
  ADD COLUMN IF NOT EXISTS last_reported_overage_minutes integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.subscriptions.plan_tier_key IS 'Pricing tier key (e.g. starter|growth|scale)';
COMMENT ON COLUMN public.subscriptions.stripe_usage_item_id IS 'Stripe subscription item ID for metered usage billing';
COMMENT ON COLUMN public.subscriptions.last_reported_overage_minutes IS 'Idempotency check: total overage minutes reported in the billing cycle';
