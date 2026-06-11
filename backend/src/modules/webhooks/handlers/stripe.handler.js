const { requireAdmin } = require("../../../config/supabase");
const logger = require("../../../config/logger");

async function handle(event) {
  const admin = requireAdmin();
  const type = event?.type;
  const obj = event?.data?.object;
  if (!type || !obj) return { skipped: true };

  switch (type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const orgId = obj.metadata?.org_id;
      if (!orgId) {
        logger.warn({ subId: obj.id }, "Stripe subscription missing org_id metadata");
        return { skipped: true };
      }
      const periodStart = obj.current_period_start
        ? new Date(obj.current_period_start * 1000).toISOString()
        : null;
      const periodEnd = obj.current_period_end
        ? new Date(obj.current_period_end * 1000).toISOString()
        : null;
      const planTierKey = obj.metadata?.plan_tier_key || null;
      const includedMinutes = parseInt(obj.metadata?.included_minutes || "0", 10) || 0;

      // Find the metered/overage usage item if present
      const usageItem = obj.items?.data?.find((i) => i.price?.recurring?.usage_type === "metered");
      const stripeUsageItemId = usageItem?.id || null;

      const { error } = await admin.from("subscriptions").upsert({
        org_id: orgId,
        stripe_customer_id: obj.customer,
        stripe_subscription_id: obj.id,
        plan_id: obj.items?.data?.[0]?.price?.id || "unknown",
        plan_tier_key: planTierKey,
        included_minutes: includedMinutes,
        status: obj.status,
        period_start: periodStart,
        period_end: periodEnd,
        stripe_usage_item_id: stripeUsageItemId,
        // Reset overage counter at the start of each new period
        last_reported_overage_minutes: 0,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      return { ok: true, org_id: orgId, status: obj.status };
    }

    case "customer.subscription.deleted": {
      const { error } = await admin
        .from("subscriptions")
        .update({ status: "canceled", updated_at: new Date().toISOString() })
        .eq("stripe_subscription_id", obj.id);
      if (error) throw error;
      return { ok: true };
    }

    case "invoice.payment_succeeded": {
      const subId = obj.subscription;
      if (!subId) return { skipped: true };

      const { data: subRow } = await admin
        .from("subscriptions")
        .select("org_id, status")
        .eq("stripe_subscription_id", subId)
        .maybeSingle();

      if (subRow?.org_id && subRow.status === "past_due") {
        // Reactivate if previously past_due
        await admin
          .from("subscriptions")
          .update({ status: "active", updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", subId);

        // Re-activate suspended Aurora-managed Twilio sub-account
        await admin
          .from("twilio_subaccounts")
          .update({ status: "active", updated_at: new Date().toISOString() })
          .eq("org_id", subRow.org_id)
          .eq("account_type", "aurora_managed")
          .eq("status", "suspended");

        logger.info({ orgId: subRow.org_id }, "Payment succeeded - reactivated account");
      }
      return { ok: true };
    }

    case "invoice.payment_failed": {
      const sub = obj.subscription;
      if (!sub) return { skipped: true };
      const { data: subRow } = await admin
        .from("subscriptions")
        .select("org_id")
        .eq("stripe_subscription_id", sub)
        .maybeSingle();
      if (subRow?.org_id) {
        await admin
          .from("campaigns")
          .update({ status: "paused", updated_at: new Date().toISOString() })
          .eq("org_id", subRow.org_id)
          .eq("status", "running");

        // Suspend Aurora-managed sub-account on payment failure (not BYO - it's their own account)
        await admin
          .from("twilio_subaccounts")
          .update({ status: "suspended", updated_at: new Date().toISOString() })
          .eq("org_id", subRow.org_id)
          .eq("account_type", "aurora_managed");

        logger.warn({ orgId: subRow.org_id }, "Payment failed - paused campaigns and suspended sub-account");
      }
      return { ok: true };
    }

    default:
      return { ignored: true, type };
  }
}

module.exports = { handle };
