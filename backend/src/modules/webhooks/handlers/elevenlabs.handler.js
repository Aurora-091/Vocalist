const { requireAdmin } = require("../../../config/supabase");
const logger = require("../../../config/logger");
const { transition, STATES } = require("../../campaigns/state-machine");
const { buildIdempotencyKey } = require("../../../utils/idempotency");
const { DEFAULT_COST_PER_MINUTE_USD } = require("../../billing/billing.constants");
const { canRetry, computeRetryAt } = require("../../../utils/scheduling");

const ELEVENLABS_TO_CALL_STATUS = {
  "conversation.started": "in_progress",
  "call.started": "in_progress",
  "conversation.ended": "completed",
  "call.completed": "completed",
  "call.failed": "failed",
};

const TARGET_STATE_FOR_CALL = {
  "conversation.started": STATES.IN_CALL,
  "call.started": STATES.IN_CALL,
  "conversation.ended": STATES.COMPLETED,
  "call.completed": STATES.COMPLETED,
  "call.failed": STATES.FAILED,
};

function deriveOutcome(data, eventType) {
  if (eventType === "call.failed") return "failed";
  const duration = data?.call_duration_secs || data?.duration_sec || 0;
  if (duration < 5) return "no_answer";
  const analysis = data?.analysis;
  if (analysis?.voicemail_detected || analysis?.outcome === "voicemail") return "voicemail";
  if (analysis?.outcome === "declined" || analysis?.outcome === "not_interested") return "declined";
  return "answered";
}

async function handle(payload) {
  const admin = requireAdmin();
  const eventType = payload?.type || payload?.event;
  const data = payload?.data || payload;

  const conversationId = data?.conversation_id || payload?.conversation_id;
  const providerCallId = data?.call_sid || payload?.call_sid || conversationId;

  if (!eventType || !providerCallId) {
    return { skipped: true, reason: "missing_event_type_or_call_id" };
  }

  // Find the call row by provider_call_id, conversation_id, or local call ID (if passed in metadata)
  const clientData = data?.conversation_initiation_client_data || {};
  const metaCallId = clientData.call_id || payload?.metadata?.call_id;
  const scheduledCallId = clientData.scheduled_call_id || payload?.metadata?.scheduled_call_id;
  
  let callRow = null;
  if (metaCallId) {
    const { data: row } = await admin
      .from("calls")
      .select("id, org_id, campaign_id, contact_id, status")
      .eq("id", metaCallId)
      .maybeSingle();
    callRow = row;
  }

  if (!callRow) {
    const { data: row, error: lookupErr } = await admin
      .from("calls")
      .select("id, org_id, campaign_id, contact_id, status")
      .or(`provider_call_id.eq.${providerCallId},conversation_id.eq.${conversationId}`)
      .maybeSingle();
    
    if (lookupErr) throw lookupErr;
    callRow = row;
  }

  if (!callRow) {
    logger.warn({ providerCallId, conversationId }, "ElevenLabs event for unknown call");
    return { skipped: true, reason: "unknown_call" };
  }

  const newStatus = ELEVENLABS_TO_CALL_STATUS[eventType];
  const update = {};
  if (newStatus) update.status = newStatus;
  
  // Set conversation_id if present
  if (conversationId) {
    update.conversation_id = conversationId;
    update.transcript_id = conversationId; // Map transcript_id to conversation_id
  }

  if ((eventType === "conversation.started" || eventType === "call.started") && !callRow.started_at) {
    update.started_at = new Date().toISOString();
  }

  if (eventType === "conversation.ended" || eventType === "call.completed" || eventType === "call.failed" || eventType === "transcript.available") {
    update.ended_at = new Date().toISOString();
    
    const duration = data?.call_duration_secs || data?.duration_sec;
    if (typeof duration === "number") {
      update.duration_sec = duration;
      update.cost_usd = parseFloat(((duration / 60) * DEFAULT_COST_PER_MINUTE_USD).toFixed(4));
    }

    if (conversationId) {
      update.recording_url = `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/audio`;
    }

    if (data?.transcript) {
      update.transcript = data.transcript;
    }

    if (data?.analysis) {
      update.outcome = data.analysis;
    }
  }

  if (Object.keys(update).length > 0) {
    const { error: upErr } = await admin.from("calls").update(update).eq("id", callRow.id);
    if (upErr) throw upErr;
  }

  // Log events
  await admin.from("call_events").insert({
    org_id: callRow.org_id,
    call_id: callRow.id,
    kind: `elevenlabs.${eventType}`,
    payload,
  });

  // Handle campaign state transitions
  if (callRow.campaign_id && TARGET_STATE_FOR_CALL[eventType]) {
    const { data: target } = await admin
      .from("campaign_targets")
      .select("id, state")
      .eq("campaign_id", callRow.campaign_id)
      .eq("contact_id", callRow.contact_id)
      .maybeSingle();

    if (target && target.state !== TARGET_STATE_FOR_CALL[eventType]) {
      try {
        await transition(admin, {
          targetId: target.id,
          fromState: target.state,
          toState: TARGET_STATE_FOR_CALL[eventType],
          reason: `elevenlabs_event:${eventType}`,
          callId: callRow.id,
          orgId: callRow.org_id,
        });
      } catch (e) {
        logger.error({ err: e.message, eventType, targetId: target.id }, "Campaign state transition FAILED - writing to DLQ");
        await admin.from("webhook_dlq").insert({
          org_id: callRow.org_id,
          source: "elevenlabs",
          event_type: `campaign_transition:${eventType}`,
          payload: { target_id: target.id, from_state: target.state, to_state: TARGET_STATE_FOR_CALL[eventType], call_id: callRow.id },
          error_message: e.message,
          retry_count: 0,
          next_retry_at: new Date(Date.now() + 60_000).toISOString(),
        }).catch((dlqErr) => {
          logger.error({ err: dlqErr.message }, "Failed to write to DLQ");
        });
      }
    }
  }

  // Handle usage ledger recording
  if ((eventType === "conversation.ended" || eventType === "call.completed") && update.duration_sec) {
    const minutes = Math.ceil((update.duration_sec || 0) / 60);
    if (minutes > 0) {
      const idemKey = buildIdempotencyKey(["elevenlabs", providerCallId, "minutes"]);
      const { error: ledgerErr } = await admin.from("usage_ledger").insert({
        org_id: callRow.org_id,
        kind: "voice_minutes",
        quantity: minutes,
        call_id: callRow.id,
        period: new Date().toISOString().slice(0, 10),
        idempotency_key: idemKey,
      });
      if (ledgerErr && ledgerErr.code !== "23505") throw ledgerErr;
    }
  }

  // Handle knowledge updates
  if (eventType === "knowledge.updated") {
    const providerKnowledgeId = data?.knowledge_id || data?.id;
    if (providerKnowledgeId) {
      const { data: mapping } = await admin
        .from("knowledge_provider_mappings")
        .select("knowledge_source_id")
        .eq("provider_knowledge_id", providerKnowledgeId)
        .maybeSingle();

      if (mapping) {
        await admin
          .from("knowledge_sources")
          .update({ status: "ready", updated_at: new Date().toISOString() })
          .eq("id", mapping.knowledge_source_id);
      }
    }
  }

  // Handle scheduled_call status + retry ladder
  if (scheduledCallId && (eventType === "conversation.ended" || eventType === "call.completed" || eventType === "call.failed")) {
    const outcome = deriveOutcome(data, eventType);

    const { data: scRow } = await admin
      .from("scheduled_calls")
      .select("id, attempt, org_id, agent_id, phone, metadata, playbook_key")
      .eq("id", scheduledCallId)
      .maybeSingle();

    if (scRow) {
      const scUpdate = { outcome, status: "completed" };

      if ((outcome === "no_answer" || outcome === "voicemail") && canRetry(scRow.attempt)) {
        const retryAt = computeRetryAt(new Date(), scRow.attempt);
        await admin.from("scheduled_calls").insert({
          org_id: scRow.org_id,
          agent_id: scRow.agent_id,
          phone: scRow.phone,
          checkout_id: scRow.metadata?.checkout_id || null,
          checkout_token: scRow.metadata?.checkout_token || null,
          order_id: scRow.metadata?.order_id || null,
          scheduled_at: retryAt.toISOString(),
          status: "pending",
          attempt: scRow.attempt + 1,
          playbook_key: scRow.playbook_key,
          metadata: { ...scRow.metadata, retry_of: scRow.id },
        });
        logger.info({ scheduled_call_id: scRow.id, attempt: scRow.attempt + 1, retry_at: retryAt }, "Retry scheduled");
      }

      await admin.from("scheduled_calls").update(scUpdate).eq("id", scRow.id);
    }
  }

  return { ok: true, call_id: callRow.id, status: update.status };
}

module.exports = { handle };
