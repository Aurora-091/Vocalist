const { requireAdmin } = require("../../../config/supabase");
const logger = require("../../../config/logger");
const { transition, STATES } = require("../../campaigns/state-machine");
const { buildIdempotencyKey } = require("../../../utils/idempotency");

const TARGET_STATE_FOR_CALL = {
  "call.ringing": STATES.RINGING,
  "call.started": STATES.IN_CALL,
  "call.completed": STATES.COMPLETED,
  "call.failed": STATES.FAILED,
  "call.voicemail": STATES.VOICEMAIL,
  "call.no_answer": STATES.FAILED,
  "call.busy": STATES.FAILED,
};

const EVENT_TO_CALL_STATUS = {
  "call.started": "in_progress",
  "call.ringing": "ringing",
  "call.completed": "completed",
  "call.failed": "failed",
  "call.no_answer": "no_answer",
  "call.busy": "busy",
  "call.voicemail": "voicemail",
};

function extractLeaseToken(payload, callPayload) {
  return (
    callPayload?.metadata?.lease_token ||
    payload?.metadata?.lease_token ||
    payload?.message?.metadata?.lease_token ||
    null
  );
}

async function handle(payload) {
  const admin = requireAdmin();
  const eventType = payload?.type || payload?.event;
  const callPayload = payload?.call || payload?.data || payload;
  const providerCallId = callPayload?.id || payload?.call_id;
  if (!eventType || !providerCallId) {
    return { skipped: true, reason: "missing_event_or_call_id" };
  }

  const { data: callRow, error: lookupErr } = await admin
    .from("calls")
    .select("id, org_id, campaign_id, contact_id, status")
    .eq("provider", "vapi")
    .eq("provider_call_id", providerCallId)
    .maybeSingle();
  if (lookupErr) throw lookupErr;
  if (!callRow) {
    logger.warn({ providerCallId }, "Vapi event for unknown call");
    return { skipped: true, reason: "unknown_call" };
  }

  const newStatus = EVENT_TO_CALL_STATUS[eventType];
  const update = {};
  if (newStatus) update.status = newStatus;
  if (eventType === "call.started" && callPayload?.started_at) {
    update.started_at = callPayload.started_at;
  }
  if (eventType === "call.completed" || eventType === "call.failed") {
    if (callPayload?.ended_at) update.ended_at = callPayload.ended_at;
    if (typeof callPayload?.duration_sec === "number") update.duration_sec = callPayload.duration_sec;
    if (typeof callPayload?.cost === "number") update.cost_usd = callPayload.cost;
    if (callPayload?.recording_url) update.recording_url = callPayload.recording_url;
    if (callPayload?.transcript) update.transcript = callPayload.transcript;
    if (callPayload?.outcome) update.outcome = callPayload.outcome;
  }

  if (Object.keys(update).length > 0) {
    const { error: upErr } = await admin.from("calls").update(update).eq("id", callRow.id);
    if (upErr) throw upErr;
  }

  await admin.from("call_events").insert({
    org_id: callRow.org_id,
    call_id: callRow.id,
    kind: eventType,
    payload,
  });

  if (callRow.campaign_id && TARGET_STATE_FOR_CALL[eventType]) {
    const { data: target } = await admin
      .from("campaign_targets")
      .select("id, state, lease_token")
      .eq("campaign_id", callRow.campaign_id)
      .eq("contact_id", callRow.contact_id)
      .maybeSingle();

    const headerLeaseToken = extractLeaseToken(payload, callPayload);

    if (!target) {
      logger.warn({ providerCallId }, "Target row not found for state transition");
    } else if (
      headerLeaseToken &&
      target.lease_token &&
      headerLeaseToken !== target.lease_token
    ) {
      logger.warn(
        { providerCallId, targetId: target.id },
        "Stale Vapi event ignored: lease_token mismatch"
      );
      return { skipped: true, reason: "stale_lease_token" };
    } else if (target.state !== TARGET_STATE_FOR_CALL[eventType]) {
      try {
        await transition(admin, {
          targetId: target.id,
          fromState: target.state,
          toState: TARGET_STATE_FOR_CALL[eventType],
          reason: `vapi_event:${eventType}`,
          callId: callRow.id,
          orgId: callRow.org_id,
        });
      } catch (e) {
        logger.warn({ err: e.message, eventType }, "State transition skipped");
      }
    }
  }

  if (eventType === "call.completed" && update.duration_sec) {
    const minutes = Math.ceil(update.duration_sec / 60);
    if (minutes > 0) {
      const idemKey = buildIdempotencyKey(["vapi", providerCallId, "minutes"]);
      const { error: ledgerErr } = await admin.from("usage_ledger").insert({
        org_id: callRow.org_id,
        kind: "voice_minutes",
        quantity: minutes,
        call_id: callRow.id,
        period: new Date().toISOString().slice(0, 10),
        idempotency_key: idemKey,
        cost_usd: update.cost_usd || null,
      });
      if (ledgerErr && ledgerErr.code !== "23505") throw ledgerErr;
    }
  }

  return { ok: true, call_id: callRow.id, status: update.status };
}

module.exports = { handle, extractLeaseToken };
