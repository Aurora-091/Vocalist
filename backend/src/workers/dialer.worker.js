const { requireAdmin } = require("../config/supabase");
const logger = require("../config/logger");
const { transition, STATES } = require("../modules/campaigns/state-machine");
const { buildVoiceProvider } = require("../providers/voice/factory");
const billingService = require("../modules/billing/billing.service");
const { DEFAULT_PROJECTED_MINUTES } = require("../modules/billing/billing.constants");

const LEASE_SECONDS = 90;

async function loadIntegrationConfig(admin, orgId, providerName) {
  if (providerName !== "vapi" && providerName !== "retell") return {};
  const { data } = await admin
    .from("integrations")
    .select("config")
    .eq("org_id", orgId)
    .eq("type", "twilio")
    .maybeSingle();
  return data?.config || {};
}

async function dispatchOne(admin, { campaign, agent, target }) {
  const { data: contact, error: cErr } = await admin
    .from("contacts")
    .select("id, e164, deleted_at")
    .eq("id", target.contact_id)
    .maybeSingle();
  if (cErr) throw cErr;

  if (!contact || contact.deleted_at) {
    await transition(admin, {
      targetId: target.target_id,
      fromState: STATES.DIALING,
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
      targetId: target.target_id,
      fromState: STATES.DIALING,
      toState: STATES.SUPPRESSED,
      reason: "can_dial_false",
      orgId: campaign.org_id,
    });
    return { skipped: true, reason: "can_dial_false" };
  }

  // Spend guard: check if org has budget headroom before placing the call
  const overageRate = await billingService.getOrgOverageRate(campaign.org_id);
  const projectedCost = DEFAULT_PROJECTED_MINUTES * overageRate;

  const { data: canSpend, error: spendCheckErr } = await admin.rpc("can_spend", {
    p_org: campaign.org_id,
    p_amount_usd: projectedCost,
  });
  if (spendCheckErr) {
    logger.warn({ err: spendCheckErr.message, orgId: campaign.org_id }, "can_spend RPC error - allowing call");
  } else if (canSpend === false) {
    await transition(admin, {
      targetId: target.target_id,
      fromState: STATES.DIALING,
      toState: STATES.SUPPRESSED,
      reason: "budget_exceeded",
      orgId: campaign.org_id,
    });
    return { skipped: true, reason: "budget_exceeded" };
  }

  // Reserve projected spend so concurrent calls don't exceed budget
  const { error: reserveErr } = await admin.rpc("reserve_spend", {
    p_org: campaign.org_id,
    p_amount_usd: projectedCost,
  });
  if (reserveErr) {
    logger.warn({ err: reserveErr.message, orgId: campaign.org_id }, "reserve_spend RPC error - continuing");
  }

  const integrationConfig = await loadIntegrationConfig(admin, campaign.org_id, agent.provider);
  const provider = buildVoiceProvider({ agent, integrationConfig });

  let providerCall;
  try {
    providerCall = await provider.startCall({
      toE164: contact.e164,
      fromE164: agent.inbound_number,
      leaseToken: target.lease_token,
      metadata: { campaign_id: campaign.id, target_id: target.target_id },
    });
  } catch (err) {
    logger.error({ err: err.message, agentProvider: agent.provider }, "Provider startCall failed");

    // Release the reserved spend since the call never happened
    await admin.rpc("release_spend", {
      p_org: campaign.org_id,
      p_amount_usd: projectedCost,
    }).catch((e) => logger.warn({ err: e.message, orgId: campaign.org_id }, "release_spend failed"));

    await transition(admin, {
      targetId: target.target_id,
      fromState: STATES.DIALING,
      toState: STATES.FAILED,
      reason: `provider_error:${err.message.slice(0, 80)}`,
      orgId: campaign.org_id,
    });
    return { failed: true, reason: "provider_error" };
  }

  const { data: callRow, error: callErr } = await admin
    .from("calls")
    .insert({
      org_id: campaign.org_id,
      agent_id: agent.id,
      campaign_id: campaign.id,
      contact_id: contact.id,
      direction: "outbound",
      status: providerCall.status === "in_progress" ? "in_progress" : "queued",
      provider: agent.provider,
      provider_call_id: providerCall.provider_call_id,
    })
    .select("id")
    .single();
  if (callErr) {
    logger.error({ err: callErr.message }, "Failed to insert call row after dispatch");
    await admin.rpc("release_spend", {
      p_org: campaign.org_id,
      p_amount_usd: projectedCost,
    }).catch(() => {});
    return { failed: true, reason: "call_insert_failed" };
  }

  await admin
    .from("campaign_targets")
    .update({ last_call_id: callRow.id })
    .eq("id", target.target_id);

  return { ok: true, call_id: callRow.id, provider_call_id: providerCall.provider_call_id };
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

  const { data: agent, error: agentErr } = await admin
    .from("agents")
    .select("id, org_id, provider, provider_ref, voice_id, inbound_number, persona")
    .eq("id", campaign.agent_id)
    .maybeSingle();
  if (agentErr) throw agentErr;
  if (!agent) {
    logger.warn({ campaignId: campaign.id }, "Campaign references missing agent");
    return { available: 0, error: "agent_missing" };
  }

  const { data: leased, error } = await admin.rpc("claim_dial_targets", {
    p_campaign: campaign.id,
    p_limit: available,
    p_lease_seconds: LEASE_SECONDS,
  });
  if (error) throw error;

  const targets = leased || [];
  const results = [];
  for (const target of targets) {
    try {
      const r = await dispatchOne(admin, { campaign, agent, target });
      results.push(r);
    } catch (err) {
      logger.error({ err: err.message, targetId: target.target_id }, "Dispatch failed");
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
    if (c.window_start && new Date(c.window_start).getTime() > now.getTime()) continue;
    if (c.window_end && new Date(c.window_end).getTime() < now.getTime()) continue;
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

module.exports = { start, runOnce, tickCampaign, dispatchOne };
