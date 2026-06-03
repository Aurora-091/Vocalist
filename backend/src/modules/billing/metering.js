const { buildIdempotencyKey } = require("../../utils/idempotency");

async function recordVoiceMinutes(supabase, { orgId, callId, durationSec, providerCallId }) {
  if (!durationSec || durationSec <= 0) return { skipped: true };
  const minutes = Math.ceil(durationSec / 60);
  const period = new Date().toISOString().slice(0, 10);
  const idempotency_key = buildIdempotencyKey([providerCallId || callId, "voice_minutes"]);

  const { error } = await supabase.from("usage_ledger").insert({
    org_id: orgId,
    kind: "voice_minutes",
    quantity: minutes,
    call_id: callId,
    period,
    idempotency_key,
  });

  if (error && error.code !== "23505") throw error;
  return { recorded: !error, minutes };
}

async function recordCampaignCall(supabase, { orgId, callId, providerCallId }) {
  const idempotency_key = buildIdempotencyKey([providerCallId || callId, "campaign_call"]);
  const { error } = await supabase.from("usage_ledger").insert({
    org_id: orgId,
    kind: "campaign_call",
    quantity: 1,
    call_id: callId,
    period: new Date().toISOString().slice(0, 10),
    idempotency_key,
  });
  if (error && error.code !== "23505") throw error;
  return { recorded: !error };
}

module.exports = { recordVoiceMinutes, recordCampaignCall };
