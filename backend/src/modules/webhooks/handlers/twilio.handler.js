const { requireAdmin } = require("../../../config/supabase");
const logger = require("../../../config/logger");

const TWILIO_TO_CALL_STATUS = {
  queued: "queued",
  ringing: "ringing",
  "in-progress": "in_progress",
  completed: "completed",
  busy: "busy",
  "no-answer": "no_answer",
  failed: "failed",
  canceled: "canceled",
};

async function handle(params) {
  const admin = requireAdmin();
  const callSid = params.CallSid;
  const status = TWILIO_TO_CALL_STATUS[params.CallStatus];
  if (!callSid) return { skipped: true };

  const { data: callRow } = await admin
    .from("calls")
    .select("id, org_id")
    .eq("provider_call_id", callSid)
    .maybeSingle();

  if (!callRow) {
    logger.warn({ callSid }, "Twilio webhook for unknown call");
    return { skipped: true };
  }

  const update = {};
  if (status) update.status = status;
  if (params.CallDuration) update.duration_sec = parseInt(params.CallDuration, 10);
  if (params.RecordingUrl) update.recording_url = params.RecordingUrl;

  if (Object.keys(update).length > 0) {
    await admin.from("calls").update(update).eq("id", callRow.id);
  }

  await admin.from("call_events").insert({
    org_id: callRow.org_id,
    call_id: callRow.id,
    kind: `twilio.${params.CallStatus || "event"}`,
    payload: params,
  });

  return { ok: true, call_id: callRow.id };
}

module.exports = { handle };
