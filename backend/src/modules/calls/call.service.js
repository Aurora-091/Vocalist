const { buildVoiceProvider } = require("../../providers/voice/factory");
const logger = require("../../config/logger");

class CallService {
  async startOutboundCall(supabase, orgId, callId, agentId, toE164, leaseToken, campaignId = null, dynamicVars = null) {
    const { data: agent, error: agentErr } = await supabase
      .from("agents")
      .select("*")
      .eq("id", agentId)
      .eq("org_id", orgId)
      .single();

    if (agentErr || !agent) throw new Error("Agent not found");
    if (!agent.provider_ref) throw new Error("Agent missing provider_ref, cannot place call");

    const { data: intRow } = await supabase
      .from("integrations")
      .select("config")
      .eq("org_id", orgId)
      .eq("type", "twilio")
      .maybeSingle();
    const integrationConfig = intRow?.config || {};
    const providerInstance = buildVoiceProvider({ agent, integrationConfig });

    const callResult = await providerInstance.startCall({
      toE164,
      fromE164: agent.inbound_number,
      leaseToken,
      metadata: { call_id: callId, agent_id: agentId, campaign_id: campaignId },
      providerRef: agent.provider_ref,
      dynamicVars,
    });

    const { data: updatedCall, error: updateErr } = await supabase
      .from("calls")
      .update({
        provider_call_id: callResult.provider_call_id,
        status: callResult.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", callId)
      .select("*")
      .single();

    if (updateErr) throw updateErr;
    return updatedCall;
  }

  async syncCallState(supabase, providerCallId, updates) {
    const payload = { updated_at: new Date().toISOString() };

    if (updates.status) payload.status = updates.status;
    if (updates.duration_sec !== undefined) payload.duration_sec = updates.duration_sec;
    if (updates.recordingUrl) payload.recording_url = updates.recordingUrl;
    if (updates.transcript) payload.transcript = updates.transcript;
    if (updates.startedAt) payload.started_at = updates.startedAt;
    if (updates.endedAt) payload.ended_at = updates.endedAt;
    if (updates.cost_usd !== undefined) payload.cost_usd = updates.cost_usd;

    const { data, error } = await supabase
      .from("calls")
      .update(payload)
      .eq("provider_call_id", providerCallId)
      .select("*")
      .single();

    if (error) {
      logger.error({ err: error.message, providerCallId }, "Failed to sync call state");
      throw error;
    }
    return data;
  }
}

module.exports = new CallService();
