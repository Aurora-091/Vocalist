const personaService = require("../../services/persona.service");
const VapiProvider = require("../../services/providers/vapi.provider");
const RetellProvider = require("../../services/providers/retell.provider");
const PipecatProvider = require("../../services/providers/pipecat.provider");

class AgentService {
  getProviderInstance(providerName, orgId) {
    switch (providerName) {
      case "vapi":
        return new VapiProvider({ orgId });
      case "retell":
        return new RetellProvider({ orgId });
      case "pipecat":
        return new PipecatProvider({ orgId });
      default:
        // Default to vapi as per requirements
        return new VapiProvider({ orgId });
    }
  }

  async createAgent(supabase, orgId, agentData) {
    const { provider = "vapi", persona = {} } = agentData;
    
    // 1. Generate system prompt
    const systemPrompt = personaService.generateSystemPrompt(persona);

    // 2. Setup Provider
    const providerInstance = this.getProviderInstance(provider, orgId);

    // 3. Create Assistant in Provider
    const { provider_ref, provider_meta } = await providerInstance.createAgent(agentData, systemPrompt);

    // 4. Save to Database
    const { data: agent, error } = await supabase
      .from("agents")
      .insert({
        org_id: orgId,
        ...agentData,
        provider,
        provider_ref,
        provider_meta,
        persona
      })
      .select("*")
      .single();

    if (error) throw error;
    return agent;
  }

  async updateAgent(supabase, orgId, agentId, updateData) {
    // 1. Get existing agent
    const { data: existing, error: fetchErr } = await supabase
      .from("agents")
      .select("*")
      .eq("id", agentId)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .single();
    
    if (fetchErr || !existing) throw new Error("Agent not found or access denied");

    const newPersona = updateData.persona || existing.persona;
    const systemPrompt = personaService.generateSystemPrompt(newPersona);
    
    const mergedAgent = { ...existing, ...updateData };

    // 2. Update Provider Assistant
    const providerInstance = this.getProviderInstance(mergedAgent.provider, orgId);
    let newProviderMeta = existing.provider_meta;
    
    if (mergedAgent.provider_ref) {
      const updateResult = await providerInstance.updateAgent(mergedAgent, systemPrompt);
      if (updateResult && updateResult.provider_meta) {
        newProviderMeta = updateResult.provider_meta;
      }
    }

    // 3. Update Database
    const { data: updatedAgent, error: updateErr } = await supabase
      .from("agents")
      .update({
        ...updateData,
        provider_meta: newProviderMeta,
        updated_at: new Date().toISOString()
      })
      .eq("id", agentId)
      .select("*")
      .single();

    if (updateErr) throw updateErr;
    return updatedAgent;
  }

  async deleteAgent(supabase, orgId, agentId) {
    // 1. Get existing agent
    const { data: existing, error: fetchErr } = await supabase
      .from("agents")
      .select("*")
      .eq("id", agentId)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .single();
    
    if (fetchErr || !existing) throw new Error("Agent not found or access denied");

    // 2. Delete Provider Assistant
    if (existing.provider_ref) {
      const providerInstance = this.getProviderInstance(existing.provider, orgId);
      await providerInstance.deleteAgent(existing.provider_ref);
    }

    // 3. Soft Delete in Database
    const { error: updateErr } = await supabase
      .from("agents")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", agentId);

    if (updateErr) throw updateErr;
    return true;
  }

  async assignNumber(supabase, orgId, agentId, phoneNumberId) {
    // 1. Get existing agent
    const { data: agent, error: agentErr } = await supabase
      .from("agents")
      .select("*")
      .eq("id", agentId)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .single();

    if (agentErr || !agent) throw new Error("Agent not found");

    // 2. Verify phone number belongs to org
    const { data: phone, error: phoneErr } = await supabase
      .from("phone_numbers")
      .select("*")
      .eq("id", phoneNumberId)
      .eq("org_id", orgId)
      .single();

    if (phoneErr || !phone) throw new Error("Phone number not found or does not belong to organization");

    // 3. Update Vapi Assistant (or equivalent provider)
    const providerInstance = this.getProviderInstance(agent.provider, orgId);
    await providerInstance.assignPhoneNumber({
      provider_ref: agent.provider_ref,
      phone_number: phone.number
    });

    // 4. Save relationship (both on agent and phone_number)
    await supabase.from("phone_numbers").update({ agent_id: agentId }).eq("id", phoneNumberId);
    const { data: updatedAgent, error: updateErr } = await supabase
      .from("agents")
      .update({ inbound_number: phone.number, updated_at: new Date().toISOString() })
      .eq("id", agentId)
      .select("*")
      .single();

    if (updateErr) throw updateErr;
    return updatedAgent;
  }
}

module.exports = new AgentService();
