const { requireAdmin } = require("../config/supabase");
const logger = require("../config/logger");
const Stripe = require("stripe");
const env = require("../config/env");
const { ALERT_THRESHOLDS } = require("../modules/billing/billing.constants");

const DRIFT_THRESHOLD_USD = 0.01;

async function reconcileSpendCounters(admin, periodStart) {
  const { data: counters, error: cErr } = await admin
    .from("spend_counters")
    .select("org_id, scope, scope_id, spent_usd")
    .gte("period", periodStart);
  if (cErr || !counters?.length) return 0;

  let corrections = 0;
  const orgIds = [...new Set(counters.map((c) => c.org_id))];

  for (const orgId of orgIds) {
    const { data: ledgerRows } = await admin
      .from("usage_ledger")
      .select("cost_usd")
      .eq("org_id", orgId)
      .gte("period", periodStart);

    const ledgerTotal = (ledgerRows || []).reduce((s, r) => s + (Number(r.cost_usd) || 0), 0);
    const orgCounters = counters.filter((c) => c.org_id === orgId && c.scope === "org");
    const counterTotal = orgCounters.reduce((s, c) => s + (Number(c.spent_usd) || 0), 0);
    const drift = Math.abs(ledgerTotal - counterTotal);

    if (drift > DRIFT_THRESHOLD_USD) {
      logger.warn(
        { orgId, ledgerTotal, counterTotal, drift },
        "Spend counter drift detected — correcting"
      );
      for (const counter of orgCounters) {
        await admin
          .from("spend_counters")
          .update({ spent_usd: ledgerTotal, updated_at: new Date().toISOString() })
          .eq("org_id", counter.org_id)
          .eq("scope", counter.scope)
          .eq("scope_id", counter.scope_id)
          .eq("period", periodStart);
      }
      corrections++;
    }
  }
  return corrections;
}

async function runOnce() {
  const admin = requireAdmin();
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  const { data: ledgerRows, error } = await admin
    .from("usage_ledger")
    .select("org_id, kind, quantity")
    .eq("kind", "voice_minutes")
    .gte("period", periodStart)
    .lte("period", today);
  if (error) throw error;

  const usageByOrg = {};
  for (const row of ledgerRows || []) {
    usageByOrg[row.org_id] = (usageByOrg[row.org_id] || 0) + Number(row.quantity);
  }

  const orgIds = Object.keys(usageByOrg);
  if (orgIds.length === 0) return { orgs_seen: 0, period: today };

  const { data: subs } = await admin
    .from("subscriptions")
    .select("org_id, included_minutes, stripe_usage_item_id, last_reported_overage_minutes")
    .in("org_id", orgIds);

  const subByOrg = {};
  for (const s of subs || []) subByOrg[s.org_id] = s;

  const month = today.slice(0, 7);
  let alertsFired = 0;

  for (const orgId of orgIds) {
    const used = usageByOrg[orgId] || 0;
    const sub = subByOrg[orgId];
    const included = Number(sub?.included_minutes) || 0;
    if (included === 0) continue;

    const pct = Math.floor((used / included) * 100);

    for (const threshold of ALERT_THRESHOLDS) {
      if (pct < threshold) continue;

      const { error: alertErr } = await admin.from("usage_alerts").insert({
        org_id: orgId,
        kind: "voice_minutes",
        threshold_pct: threshold,
        period: month,
      });

      if (alertErr && alertErr.code === "23505") continue;
      if (alertErr) {
        logger.warn({ err: alertErr.message, orgId, threshold }, "Failed to insert usage_alert");
        continue;
      }

      alertsFired++;
      const msg = threshold >= 100
        ? `You have used 100% of your included minutes (${used}/${included}) for this month.`
        : `You have used ${threshold}% of your included voice minutes (${used}/${included}).`;

      await admin.from("notifications").insert({
        org_id: orgId,
        kind: "usage_alert",
        title: threshold >= 100 ? "Minute limit reached" : `${threshold}% of minutes used`,
        body: msg,
        metadata: { threshold_pct: threshold, used_minutes: used, included_minutes: included, period: month },
      }).catch((e) => logger.warn({ err: e.message, orgId }, "Failed to insert usage notification"));
    }

    if (sub?.stripe_usage_item_id && env.STRIPE_SECRET_KEY) {
      const overage = Math.max(0, used - included);
      const lastReported = Number(sub.last_reported_overage_minutes) || 0;
      if (overage > lastReported) {
        const stripe = new Stripe(env.STRIPE_SECRET_KEY);
        try {
          await stripe.subscriptionItems.createUsageRecord(sub.stripe_usage_item_id, {
            quantity: overage,
            timestamp: Math.floor(Date.now() / 1000),
            action: "set",
          });
          await admin
            .from("subscriptions")
            .update({ last_reported_overage_minutes: overage })
            .eq("org_id", orgId);
        } catch (e) {
          logger.warn({ err: e.message, orgId }, "Failed to report overage to Stripe");
        }
      }
    }
  }

  let driftCorrections = 0;
  try {
    driftCorrections = await reconcileSpendCounters(admin, periodStart);
  } catch (e) {
    logger.warn({ err: e.message }, "Spend counter reconciliation failed");
  }

  return { orgs_seen: orgIds.length, period: today, alerts_fired: alertsFired, drift_corrections: driftCorrections };
}

function start({ intervalMs = 600_000 } = {}) {
  let stopped = false;
  async function loop() {
    while (!stopped) {
      try {
        await runOnce();
      } catch (err) {
        logger.error({ err: err.message }, "Billing rollup error");
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  loop();
  return () => { stopped = true; };
}

module.exports = { start, runOnce };
