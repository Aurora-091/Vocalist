const crypto = require("crypto");
const { requireAdmin } = require("../config/supabase");
const logger = require("../config/logger");
const { transition, STATES } = require("../modules/campaigns/state-machine");

const LEASE_DURATION_MS = 60_000;

async function leaseDueTargets(admin, { orgId, campaignId, limit }) {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + LEASE_DURATION_MS).toISOString();
  const leaseToken = crypto.randomUUID();

  const { data: candidates, error } = await admin
    .from("campaign_targets")
    .select("id, contact_id, state, attempts")
    .eq("org_id", orgId)
    .eq("campaign_id", campaignId)
    .in("state", [STATES.QUEUED, STATES.RETRY_WAIT])
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
    .or(`lease_expires_at.is.null,lease_expires_at.lte.${now}`)
    .limit(limit);

  if (error) throw error;
  if (!candidates || candidates.length === 0) return [];

  const ids = candidates.map((c) => c.id);
  const { data: leased, error: leaseErr } = await admin
    .from("campaign_targets")
    .update({ lease_token: leaseToken, lease_expires_at: expiresAt })
    .in("id", ids)
    .or(`lease_expires_at.is.null,lease_expires_at.lte.${now}`)
    .select("id, contact_id, state, attempts, lease_token");

  if (leaseErr) throw leaseErr;
  return (leased || []).filter((r) => r.lease_token === leaseToken);
}

async function dispatchOne(admin, { campaign, target }) {
  const { data: contact, error: cErr } = await admin
    .from("contacts")
    .select("id, e164, deleted_at")
    .eq("id", target.contact_id)
    .maybeSingle();
  if (cErr) throw cErr;
  if (!contact || contact.deleted_at) {
    await transition(admin, {
      targetId: target.id,
      fromState: target.state,
      toState: STATES.DO_NOT_CALL,
      reason: "contact_missing",
      orgId: campaign.org_id,
    });
    return { skipped: true, reason: "contact_missing" };
  }

  const { data: gateOk, error: gateErr } = await admin.rpc("can_dial", {
    p_org: campaign.org_id,
    p_e164: contact.e164,
    p_now: new Date().toISOString(),
    p_tz: campaign.calling_tz || "America/New_York",
  });
  if (gateErr) throw gateErr;

  if (!gateOk) {
    await transition(admin, {
      targetId: target.id,
      fromState: target.state,
      toState: STATES.SUPPRESSED,
      reason: "can_dial_false",
      orgId: campaign.org_id,
    });
    return { skipped: true, reason: "can_dial_false" };
  }

  const providerCallId = `mock-${crypto.randomUUID()}`;
  const { data: callRow, error: callErr } = await admin
    .from("calls")
    .insert({
      org_id: campaign.org_id,
      agent_id: campaign.agent_id,
      campaign_id: campaign.id,
      contact_id: contact.id,
      direction: "outbound",
      status: "queued",
      provider: "vapi",
      provider_call_id: providerCallId,
    })
    .select("id")
    .single();
  if (callErr) throw callErr;

  const transitioned = await transition(admin, {
    targetId: target.id,
    fromState: target.state,
    toState: STATES.DIALING,
    reason: "dispatched",
    callId: callRow.id,
    orgId: campaign.org_id,
  });

  if (!transitioned.ok) {
    return { skipped: true, reason: "concurrent_state_change" };
  }

  await admin
    .from("campaign_targets")
    .update({ attempts: (target.attempts || 0) + 1 })
    .eq("id", target.id);

  return { ok: true, call_id: callRow.id, provider_call_id: providerCallId };
}

async function tickCampaign(campaign) {
  const admin = requireAdmin();
  const slots = campaign.concurrency || 5;

  const { count } = await admin
    .from("campaign_targets")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaign.id)
    .in("state", [STATES.DIALING, STATES.RINGING, STATES.IN_CALL]);

  const available = Math.max(0, slots - (count || 0));
  if (available === 0) return { available: 0 };

  const targets = await leaseDueTargets(admin, {
    orgId: campaign.org_id,
    campaignId: campaign.id,
    limit: available,
  });

  const results = [];
  for (const target of targets) {
    try {
      const r = await dispatchOne(admin, { campaign, target });
      results.push(r);
    } catch (err) {
      logger.error({ err: err.message, targetId: target.id }, "Dispatch failed");
    }
  }
  return { dispatched: results.length, results };
}

async function runOnce() {
  const admin = requireAdmin();
  const { data: campaigns, error } = await admin
    .from("campaigns")
    .select("id, org_id, agent_id, calling_tz, concurrency, max_retries, status, window_start, window_end")
    .eq("status", "running");
  if (error) throw error;

  const now = new Date();
  for (const c of campaigns || []) {
    if (c.window_start && new Date(c.window_start) > now) continue;
    if (c.window_end && new Date(c.window_end) < now) continue;
    try {
      await tickCampaign(c);
    } catch (err) {
      logger.error({ err: err.message, campaignId: c.id }, "Campaign tick failed");
    }
  }
}

function start({ intervalMs = 5000 } = {}) {
  let stopped = false;
  async function loop() {
    while (!stopped) {
      try {
        await runOnce();
      } catch (err) {
        logger.error({ err: err.message }, "Dialer tick error");
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  loop();
  return () => { stopped = true; };
}

module.exports = { start, runOnce, tickCampaign, dispatchOne, leaseDueTargets };
