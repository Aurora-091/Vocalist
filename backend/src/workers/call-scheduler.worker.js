const { requireAdmin } = require("../config/supabase");
const logger = require("../config/logger");
const callService = require("../modules/calls/call.service");
const { buildVoiceProvider } = require("../providers/voice/factory");

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const BATCH_SIZE = 10;

async function processDueCalls() {
  const admin = requireAdmin();
  const now = new Date().toISOString();

  const { data: dueCalls, error } = await admin
    .from("scheduled_calls")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_at", now)
    .limit(BATCH_SIZE);

  if (error) {
    logger.error({ err: error.message }, "[CallScheduler] Failed to query due calls");
    return;
  }

  if (!dueCalls || dueCalls.length === 0) return;

  logger.info({ count: dueCalls.length }, "[CallScheduler] Processing due calls");

  for (const call of dueCalls) {
    const { error: claimErr } = await admin
      .from("scheduled_calls")
      .update({ status: "processing" })
      .eq("id", call.id)
      .eq("status", "pending");

    if (claimErr) {
      logger.warn({ callId: call.id, err: claimErr.message }, "[CallScheduler] Failed to claim call");
      continue;
    }

    try {
      const { data: agent } = await admin
        .from("agents")
        .select("id, org_id, provider, provider_ref, voice_id, inbound_number, persona")
        .eq("id", call.agent_id)
        .maybeSingle();

      if (!agent || !agent.provider_ref) {
        throw new Error(`Agent ${call.agent_id} not found or missing provider_ref`);
      }

      const { data: intRow } = await admin
        .from("integrations")
        .select("config")
        .eq("org_id", call.org_id)
        .eq("type", "twilio")
        .maybeSingle();

      const integrationConfig = intRow?.config || {};
      const provider = buildVoiceProvider({ agent, integrationConfig });

      const callId = crypto.randomUUID();
      await admin.from("calls").insert({
        id: callId,
        org_id: call.org_id,
        agent_id: call.agent_id,
        direction: "outbound",
        status: "queued",
        provider: agent.provider,
        metadata: call.metadata,
      });

      const providerCall = await provider.startCall({
        toE164: call.phone,
        fromE164: agent.inbound_number,
        metadata: {
          scheduled_call_id: call.id,
          ...call.metadata,
        },
        providerRef: agent.provider_ref,
        dynamicVars: {
          customer_name: call.metadata?.customer_name,
          cart_total: call.metadata?.cart_total,
          cart_items: call.metadata?.cart_items,
          recovery_url: call.metadata?.recovery_url,
        },
      });

      await admin
        .from("calls")
        .update({
          provider_call_id: providerCall.provider_call_id,
          status: providerCall.status === "in_progress" ? "in_progress" : "queued",
        })
        .eq("id", callId);

      await admin
        .from("scheduled_calls")
        .update({ status: "dispatched", dispatched_at: new Date().toISOString() })
        .eq("id", call.id);

      logger.info({ callId: call.id, phone: call.phone }, "[CallScheduler] Call dispatched");
    } catch (err) {
      logger.error({ callId: call.id, err: err.message }, "[CallScheduler] Call dispatch failed");
      await admin
        .from("scheduled_calls")
        .update({ status: "failed", error: err.message })
        .eq("id", call.id);
    }
  }
}

const crypto = require("crypto");

function start({ intervalMs = POLL_INTERVAL_MS } = {}) {
  let stopped = false;
  async function loop() {
    while (!stopped) {
      try {
        await processDueCalls();
      } catch (err) {
        logger.error({ err: err.message }, "[CallScheduler] Tick error");
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  loop();
  logger.info({ intervalMs }, "[CallScheduler] Worker started");
  return () => { stopped = true; };
}

module.exports = { start, processDueCalls };
