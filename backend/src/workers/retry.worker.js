const { requireAdmin } = require("../config/supabase");
const logger = require("../config/logger");
const { transition, STATES } = require("../modules/campaigns/state-machine");

const BASE_BACKOFF_SEC = 60;

async function runOnce() {
  const admin = requireAdmin();
  const { data: failed, error } = await admin
    .from("campaign_targets")
    .select("id, org_id, campaign_id, state, attempts, updated_at")
    .in("state", [STATES.FAILED, STATES.VOICEMAIL])
    .limit(200);
  if (error) throw error;

  for (const t of failed || []) {
    const { data: campaign } = await admin
      .from("campaigns")
      .select("max_retries, status")
      .eq("id", t.campaign_id)
      .maybeSingle();
    if (!campaign || campaign.status !== "running") continue;

    if (t.attempts >= campaign.max_retries) {
      await transition(admin, {
        targetId: t.id,
        fromState: t.state,
        toState: STATES.COMPLETED,
        reason: "max_retries_reached",
        orgId: t.org_id,
      });
      continue;
    }

    const backoffSec = BASE_BACKOFF_SEC * Math.pow(2, t.attempts);
    const nextAttempt = new Date(Date.now() + backoffSec * 1000).toISOString();

    const result = await transition(admin, {
      targetId: t.id,
      fromState: t.state,
      toState: STATES.RETRY_WAIT,
      reason: `retry_in_${backoffSec}s`,
      orgId: t.org_id,
    });
    if (result.ok) {
      await admin
        .from("campaign_targets")
        .update({ next_attempt_at: nextAttempt })
        .eq("id", t.id);
    }
  }
}

function start({ intervalMs = 30_000 } = {}) {
  let stopped = false;
  async function loop() {
    while (!stopped) {
      try {
        await runOnce();
      } catch (err) {
        logger.error({ err: err.message }, "Retry worker error");
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  loop();
  return () => { stopped = true; };
}

module.exports = { start, runOnce };
