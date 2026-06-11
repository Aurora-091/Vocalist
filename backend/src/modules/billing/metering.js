const { buildIdempotencyKey } = require("../../utils/idempotency");
const billingService = require("./billing.service");

async function recordVoiceMinutes(supabase, { orgId, callId, durationSec, providerCallId }) {
  if (!durationSec || durationSec <= 0) return { skipped: true };
  const minutes = Math.ceil(durationSec / 60);
  const period = new Date().toISOString().slice(0, 10);
  const idempotency_key = buildIdempotencyKey([providerCallId || callId, "voice_minutes"]);
  const cost_usd = await billingService.calculateCostUsd(orgId, minutes, null);

  const { error } = await supabase.from("usage_ledger").insert({
    org_id: orgId,
    kind: "voice_minutes",
    quantity: minutes,
    call_id: callId,
    period,
    idempotency_key,
    cost_usd,
  });

  if (error && error.code !== "23505") throw error;
  return { recorded: !error, minutes, cost_usd };
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

async function recordPhoneNumberCost(supabase, { orgId, phoneNumberId, monthlyCostUsd }) {
  if (!monthlyCostUsd || monthlyCostUsd <= 0) return { skipped: true };
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7); // YYYY-MM — used only in idempotency key
  const idempotency_key = buildIdempotencyKey([phoneNumberId, "phone_number", month]);

  const { error } = await supabase.from("usage_ledger").insert({
    org_id: orgId,
    kind: "phone_number",
    quantity: 1,
    period: today,
    idempotency_key,
    cost_usd: monthlyCostUsd,
  });
  if (error && error.code !== "23505") throw error;
  return { recorded: !error, cost_usd: monthlyCostUsd };
}

module.exports = { recordVoiceMinutes, recordCampaignCall, recordPhoneNumberCost };
