const { requireAdmin } = require("../../config/supabase");
const logger = require("../../config/logger");

async function logWebhookEvent({ source, externalId, signatureOk, payload, orgId }) {
  const admin = requireAdmin();
  const { data, error } = await admin
    .from("webhook_events")
    .insert({
      org_id: orgId || null,
      source,
      external_id: externalId,
      signature_ok: signatureOk,
      payload,
    })
    .select("id, received_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      logger.info({ source, externalId }, "Duplicate webhook ignored");
      return { duplicate: true, id: null };
    }
    throw error;
  }
  return { duplicate: false, ...data };
}

async function markProcessed({ id, receivedAt }) {
  const admin = requireAdmin();
  const { error } = await admin
    .from("webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("received_at", receivedAt);
  if (error) {
    if (error.code === "P0001") {
      logger.warn({ id, code: error.code, message: error.message }, "markProcessed raised exception");
      return;
    }
    throw error;
  }
}

module.exports = { logWebhookEvent, markProcessed };
