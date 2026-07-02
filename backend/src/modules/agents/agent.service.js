const personaService = require("../../services/persona.service");
const crypto = require("crypto");
const { BadRequest, NotFound } = require("../../utils/errors");
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

  async resolveSkills(supabase, agentId) {
    const { data: activeSkills } = await supabase
      .from("agent_active_skills")
      .select("config, skill:agent_skills(tool_definition, prompt_module)")
      .eq("agent_id", agentId)
      .eq("enabled", true);

    if (!activeSkills || activeSkills.length === 0) return { tools: [], promptModules: [] };

    const tools = [];
    const promptModules = [];

    for (const row of activeSkills) {
      if (!row.skill) continue;
      if (row.skill.prompt_module) promptModules.push(row.skill.prompt_module);
      const defs = row.skill.tool_definition;
      if (Array.isArray(defs)) tools.push(...defs);
    }

    return { tools, promptModules };
  }

  async createAgent(supabase, orgId, agentData) {
    const { provider = "elevenlabs", persona = {}, name } = agentData;
    if (!name) throw BadRequest("Agent name is required");

    // 0. Search for duplicate agent in the organization
    const { data: existingAgents, error: checkErr } = await supabase
      .from("agents")
      .select("id, name")
      .eq("org_id", orgId)
      .is("deleted_at", null);
    
    if (checkErr) throw checkErr;
    
    const duplicate = existingAgents.find(
      (a) => a.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      throw BadRequest("An agent with this name already exists in the organization");
    }
    
    // Destructure properties to only save database columns directly
    const { prompt, model, hyper_parameters, tools, ...dbAgentData } = agentData;

    // Merge prompt, model, hyper-parameters into persona
    const localPersona = {
      ...persona,
      prompt: prompt || persona.prompt || persona.system_prompt || "",
      model: model || persona.model || "gemini-2.5-flash",
      hyper_parameters: hyper_parameters || persona.hyper_parameters || {}
    };

    const voice_id = agentData.voice_id || "21m00Tcm4TlvDq8ikWAM";
    let provider_ref = agentData.provider_ref;

    // Call Voice Provider to provision agent if not provided
    if (!provider_ref) {
      const systemPrompt = personaService.generateSystemPrompt(localPersona);
      const agentPayload = { ...dbAgentData, org_id: orgId, persona: localPersona, provider, voice_id };
      const voiceProvider = buildVoiceProvider({ agent: agentPayload });
      
      try {
        const createRes = await voiceProvider.createAgent(agentPayload, systemPrompt);
        provider_ref = createRes.provider_ref;
      } catch (err) {
        throw BadRequest("Failed to provision agent on voice provider: " + err.message);
      }
    }

    // 4. Save to Database
    const { data: agent, error } = await supabase
      .from("agents")
      .insert({
        ...dbAgentData,
        org_id: orgId,
        provider,
        provider_ref,
        provider_agent_id: provider_ref,
        voice_id,
        sync_status: "synced",
        last_synced_at: new Date().toISOString(),
        persona: localPersona
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
    
    if (fetchErr || !existing) throw NotFound("Agent not found or access denied");

    const { prompt, model, hyper_parameters, tools, persona = {}, ...dbUpdateData } = updateData;

    const mergedPersona = {
      ...(existing.persona || {}),
      ...persona,
    };
    if (prompt !== undefined) mergedPersona.prompt = prompt;
    if (model !== undefined) mergedPersona.model = model;
    if (hyper_parameters !== undefined) mergedPersona.hyper_parameters = hyper_parameters;

    const voice_id = dbUpdateData.voice_id || existing.voice_id || null;

    // 3. Update Database
    const { data: updatedAgent, error: updateErr } = await supabase
      .from("agents")
      .update({
        ...dbUpdateData,
        voice_id,
        sync_status: "synced",
        sync_error: null,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        persona: mergedPersona
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
        provider: existing.provider || "elevenlabs",
        provider_agent_id: existing.provider_ref,
        voice_id,
        sync_status: "synced",
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
    
    if (fetchErr || !existing) throw NotFound("Agent not found or access denied");

    // 2. Delete from organization_agents registry
    await supabase
      .from("organization_agents")
      .delete()
      .eq("agent_id", agentId)
      .eq("org_id", orgId);

    // 3. Clear agent_id mapping from phone_numbers table
    await supabase
      .from("phone_numbers")
      .update({ agent_id: null })
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

  async syncAgent(supabase, orgId, agentId) {
    const { data: existing, error: fetchErr } = await supabase
      .from("agents")
      .select("*")
      .eq("id", agentId)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .single();
    if (fetchErr || !existing) throw NotFound("Agent not found or access denied");

    const { data: updated, error: updateErr } = await supabase
      .from("agents")
      .update({
        sync_status: "synced",
        sync_error: null,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", agentId)
      .select("*")
      .single();
    if (updateErr) throw updateErr;
    return updated;
  }

  async cloneAgent(supabase, orgId, agentId) {
    const { data: existing, error: fetchErr } = await supabase
      .from("agents")
      .select("*")
      .eq("id", agentId)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .single();
    if (fetchErr || !existing) throw NotFound("Agent not found or access denied");

    const cloneData = {
      name: `${existing.name} (Copy)`,
      vertical: existing.vertical,
      persona: existing.persona,
      voice_id: existing.voice_id,
      languages: existing.languages,
      provider: existing.provider,
      timezone: existing.timezone,
      transfer_number: existing.transfer_number,
      consent_required: existing.consent_required,
    };

    return this.createAgent(supabase, orgId, cloneData);
  }

  async getSystemPrompt(supabase, orgId, agentId) {
    const { data: existing, error: fetchErr } = await supabase
      .from("agents")
      .select("persona")
      .eq("id", agentId)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .single();
    if (fetchErr || !existing) throw NotFound("Agent not found or access denied");
    return personaService.generateSystemPrompt(existing.persona || {});
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

    if (agentErr || !agent) throw NotFound("Agent not found");

    // 2. Verify phone number belongs to org
    const { data: phone, error: phoneErr } = await supabase
      .from("phone_numbers")
      .select("*")
      .eq("id", phoneNumberId)
      .eq("org_id", orgId)
      .single();

    if (phoneErr || !phone) throw NotFound("Phone number not found or does not belong to organization");

    // 3. Save relationship (both on agent, phone_number, and organization_agents)
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

