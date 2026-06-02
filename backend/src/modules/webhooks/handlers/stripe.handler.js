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
      const planId = obj.items?.data?.[0]?.price?.id || obj.metadata?.plan_id || "unknown";
      const includedMinutes = parseInt(obj.metadata?.included_minutes || "0", 10) || 0;

      const { error } = await admin.from("subscriptions").upsert({
        org_id: orgId,
        stripe_customer_id: obj.customer,
        stripe_subscription_id: obj.id,
        plan_id: planId,
        included_minutes: includedMinutes,
        status: obj.status,
        period_start: periodStart,
        period_end: periodEnd,
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
        logger.warn({ orgId: subRow.org_id }, "Payment failed - paused running campaigns");
      }
      return { ok: true };
    }

    default:
      return { ignored: true, type };
  }
}

module.exports = { handle };
