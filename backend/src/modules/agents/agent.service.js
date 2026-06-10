const personaService = require("../../services/persona.service");
const { buildVoiceProvider } = require("../../providers/voice/factory");

class AgentService {
  async getIntegrationConfig(supabase, orgId) {
    const { data: intRow } = await supabase
      .from("integrations")
      .select("config")
      .eq("org_id", orgId)
      .eq("type", "twilio")
      .maybeSingle();
    return intRow?.config || {};
  }

  async createAgent(supabase, orgId, agentData) {
    const { provider = "elevenlabs", persona = {}, name } = agentData;
    if (!name) throw new Error("Agent name is required");

    // 0. Search for duplicate agent in the organization
    const { data: existingAgents, error: checkErr } = await supabase
      .from("agents")
      .select("*")
      .eq("org_id", orgId)
      .is("deleted_at", null);
    
    if (checkErr) throw checkErr;
    
    const duplicate = existingAgents.find(
      (a) => a.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      // Return existing agent. Do not create new provider agent.
      return duplicate;
    }
    
    // 1. Generate system prompt
    const systemPrompt = personaService.generateSystemPrompt(persona);

    // 2. Setup Provider
    const integrationConfig = await this.getIntegrationConfig(supabase, orgId);
    const providerInstance = buildVoiceProvider({
      agent: { provider, org_id: orgId, ...agentData },
      integrationConfig
    });

    // 3. Create Assistant in Provider
    const { provider_ref, provider_meta } = await providerInstance.createAgent(
      agentData,
      systemPrompt
    );

    // Get voice and config IDs from returned meta if available
    const voice_id = agentData.voice_id || provider_meta?.conversation_config?.tts?.voice_id || null;
    const conversation_config_id = provider_meta?.conversation_config_id || null;

    // 4. Save to Database
    const { data: agent, error } = await supabase
      .from("agents")
      .insert({
        org_id: orgId,
        ...agentData,
        provider,
        provider_ref,
        provider_agent_id: provider_ref,
        voice_id,
        conversation_config_id,
        sync_status: "synced",
        last_synced_at: new Date().toISOString(),
        persona
      })
      .select("*")
      .single();

    if (error) throw error;

    // 5. Register in organization_agents registry
    await supabase.from("organization_agents").insert({
      org_id: orgId,
      agent_id: agent.id,
      provider,
      provider_agent_id: provider_ref,
      voice_id,
      conversation_config_id,
      sync_status: "synced"
    });

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
    const integrationConfig = await this.getIntegrationConfig(supabase, orgId);
    const providerInstance = buildVoiceProvider({ agent: mergedAgent, integrationConfig });
    let newProviderMeta = existing.provider_meta;
    let syncStatus = "synced";
    
    if (mergedAgent.provider_ref) {
      try {
        const updateResult = await providerInstance.updateAgent(mergedAgent.provider_ref, mergedAgent, systemPrompt);
        if (updateResult && updateResult.provider_meta) {
          newProviderMeta = updateResult.provider_meta;
        }
      } catch (err) {
        console.error("Provider update failed, setting sync_status=failed:", err.message);
        syncStatus = "failed";
      }
    }

    const voice_id = mergedAgent.voice_id || newProviderMeta?.conversation_config?.tts?.voice_id || null;
    const conversation_config_id = newProviderMeta?.conversation_config_id || mergedAgent.conversation_config_id || null;

    // 3. Update Database
    const { data: updatedAgent, error: updateErr } = await supabase
      .from("agents")
      .update({
        ...updateData,
        provider_meta: newProviderMeta,
        voice_id,
        conversation_config_id,
        sync_status: syncStatus,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", agentId)
      .select("*")
      .single();

    if (updateErr) throw updateErr;

    // 4. Upsert organization_agents registry
    await supabase
      .from("organization_agents")
      .upsert({
        org_id: orgId,
        agent_id: agentId,
        provider: mergedAgent.provider,
        provider_agent_id: mergedAgent.provider_ref,
        voice_id,
        conversation_config_id,
        sync_status: syncStatus,
        updated_at: new Date().toISOString()
      }, { onConflict: "org_id,agent_id" });

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
      try {
        const integrationConfig = await this.getIntegrationConfig(supabase, orgId);
        const providerInstance = buildVoiceProvider({ agent: existing, integrationConfig });
        await providerInstance.deleteAgent(existing.provider_ref);
      } catch (err) {
        console.error("Provider delete failed:", err.message);
      }
    }

    // 3. Delete from organization_agents registry
    await supabase
      .from("organization_agents")
      .delete()
      .eq("agent_id", agentId)
      .eq("org_id", orgId);

    // 4. Soft Delete in Database
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

    // 3. Update Provider Phone Number
    const integrationConfig = await this.getIntegrationConfig(supabase, orgId);
    const providerInstance = buildVoiceProvider({ agent, integrationConfig });
    await providerInstance.assignPhoneNumber({
      provider_ref: agent.provider_ref,
      phone_number: phone.number
    });

    // 4. Save relationship (both on agent, phone_number, and organization_agents)
    await supabase.from("phone_numbers").update({ agent_id: agentId }).eq("id", phoneNumberId);
    
    const { data: updatedAgent, error: updateErr } = await supabase
      .from("agents")
      .update({ inbound_number: phone.number, updated_at: new Date().toISOString() })
      .eq("id", agentId)
      .select("*")
      .single();

    if (updateErr) throw updateErr;

    // Update phone_number_id in registry
    await supabase
      .from("organization_agents")
      .update({ phone_number_id: phoneNumberId, updated_at: new Date().toISOString() })
      .eq("agent_id", agentId)
      .eq("org_id", orgId);

    return updatedAgent;
  }
}

module.exports = new AgentService();
