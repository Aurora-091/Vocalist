const { requireAdmin } = require("../../config/supabase");
const { buildIdempotencyKey } = require("../../utils/idempotency");

class BillingService {
  async processCallCompletion(supabase, { org_id, call_id, duration_seconds, provider_cost }) {
    if (!duration_seconds || duration_seconds <= 0) return { ok: true, note: "No duration to bill" };

    const minutes = Math.ceil(duration_seconds / 60);
    const period = new Date().toISOString().slice(0, 10);
    const idempotency_key = buildIdempotencyKey([call_id, "voice_minutes"]);
    const costUsd = await this.calculateCostUsd(org_id, minutes, provider_cost);

    const { error } = await supabase.from("usage_ledger").insert({
      org_id,
      kind: "voice_minutes",
      quantity: minutes,
      call_id,
      period,
      idempotency_key,
      cost_usd: costUsd,
    });

    if (error && error.code === "23505") return { ok: true, note: "Already billed" };
    if (error) throw error;

    return { ok: true, minutes, cost_usd: costUsd };
  }

  async calculateCostUsd(orgId, minutes, providerCost) {
    if (providerCost && providerCost > 0) return Number(providerCost);

    const admin = requireAdmin();
    const { data: sub } = await admin
      .from("subscriptions")
      .select("included_minutes, plan_tier_key")
      .eq("org_id", orgId)
      .maybeSingle();

    if (!sub || !sub.plan_tier_key) return 0;

    const { data: tier } = await admin
      .from("plan_tiers")
      .select("overage_rate_usd, included_minutes")
      .eq("key", sub.plan_tier_key)
      .maybeSingle();

    if (!tier) return 0;

    const periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10);

    const { data: usedRows } = await admin
      .from("usage_ledger")
      .select("quantity")
      .eq("org_id", orgId)
      .eq("kind", "voice_minutes")
      .gte("period", periodStart);

    const totalUsed = (usedRows || []).reduce((sum, r) => sum + Number(r.quantity), 0);
    const included = Number(tier.included_minutes) || 0;
    const overageMinutes =
      Math.max(0, totalUsed + minutes - included) - Math.max(0, totalUsed - included);

    if (overageMinutes <= 0) return 0;
    return Number((overageMinutes * Number(tier.overage_rate_usd)).toFixed(4));
  }

  async getOrgOverageRate(orgId) {
    const admin = requireAdmin();
    const { data: sub } = await admin
      .from("subscriptions")
      .select("plan_tier_key")
      .eq("org_id", orgId)
      .maybeSingle();

    if (!sub?.plan_tier_key) return 0.18;

    const { data: tier } = await admin
      .from("plan_tiers")
      .select("overage_rate_usd")
      .eq("key", sub.plan_tier_key)
      .maybeSingle();

    return Number(tier?.overage_rate_usd) || 0.18;
  }
}

module.exports = new BillingService();
