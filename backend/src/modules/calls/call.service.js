const { buildVoiceProvider } = require("../../providers/voice/factory");

class CallService {
  /**
   * Starts an outbound call utilizing the agent's voice provider.
   */
  async startOutboundCall(supabase, orgId, callId, agentId, toE164, leaseToken, campaignId = null) {
    // 1. Get Agent
    const { data: agent, error: agentErr } = await supabase
      .from("agents")
      .select("*")
      .eq("id", agentId)
      .eq("org_id", orgId)
      .single();

    if (agentErr || !agent) throw new Error("Agent not found");
    if (!agent.provider_ref) throw new Error("Agent missing provider_ref, cannot place call");

    // 2. Setup Provider
    const { data: intRow } = await supabase
      .from("integrations")
      .select("config")
      .eq("org_id", orgId)
      .eq("type", "twilio")
      .maybeSingle();
    const integrationConfig = intRow?.config || {};
    const providerInstance = buildVoiceProvider({ agent, integrationConfig });

    // 3. Initiate Call
    const metadata = {
      call_id: callId,
      agent_id: agentId,
      campaign_id: campaignId
    };

    const callResult = await providerInstance.startCall({
      toE164,
      fromE164: agent.inbound_number, // Outbound caller ID
      leaseToken,
      metadata,
      providerRef: agent.provider_ref
    });

    // 4. Update Database
    const { data: updatedCall, error: updateErr } = await supabase
      .from("calls")
      .update({
        provider_call_id: callResult.provider_call_id,
        status: callResult.status, // "queued" | "ringing" | "in_progress"
        updated_at: new Date().toISOString()
      })
      .eq("id", callId)
      .select("*")
      .single();

    if (updateErr) throw updateErr;
    return updatedCall;
  }

  /**
   * Synchronizes call state from a webhook or manual sync request.
   */
  async syncCallState(supabase, providerCallId, updates) {
    // Expected updates: status, duration, recordingUrl, transcript, endedAt
    
    // Convert duration to duration_seconds if present
    const payload = {
      updated_at: new Date().toISOString()
    };

    if (updates.status) payload.status = updates.status;
    if (updates.durationSeconds !== undefined) payload.duration = updates.durationSeconds;
    if (updates.recordingUrl) payload.recording_url = updates.recordingUrl;
    if (updates.transcript) payload.transcript = updates.transcript;
    if (updates.startedAt) payload.started_at = updates.startedAt;
    if (updates.endedAt) payload.ended_at = updates.endedAt;
    if (updates.cost) payload.cost = updates.cost;

    const { data, error } = await supabase
      .from("calls")
      .update(payload)
      .eq("provider_call_id", providerCallId)
      .select("*")
      .single();

    if (error) {
      console.error("Failed to sync call state:", error);
      throw error;
    }
    return data;
  }
}

module.exports = new CallService();
