const personaService = require("../../services/persona.service");
const { BadRequest, NotFound } = require("../../utils/errors");
const { buildVoiceProvider } = require("../../providers/voice/factory");

// Maximum persona history entries per tier
const HISTORY_CAP = { free: 5, starter: 10, pro: 20, enterprise: 50 };
const DEFAULT_HISTORY_CAP = 5;

function getHistoryCap(planTier) {
  return HISTORY_CAP[planTier] || DEFAULT_HISTORY_CAP;
}

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

    // Push current persona to history before overwriting
    const historyEntry = {
      persona: existing.persona || {},
      saved_at: new Date().toISOString(),
    };
    const currentHistory = Array.isArray(existing.persona_history) ? existing.persona_history : [];
    // Fetch org plan tier to determine history cap
    let planTier = "free";
    try {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("plan_tiers(tier_key)")
        .eq("org_id", existing.org_id)
        .in("status", ["active", "trialing"])
        .maybeSingle();
      planTier = sub?.plan_tiers?.tier_key || "free";
    } catch (_) {
      // non-fatal, fall back to free cap
    }
    const cap = getHistoryCap(planTier);
    const newHistory = [historyEntry, ...currentHistory].slice(0, cap);

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
        persona: mergedPersona,
        persona_history: newHistory
      })
      .eq("id", agentId)
      .select("*")
      .single();

    if (updateErr) throw updateErr;

    // 4. Sync to Voice Provider
    if (existing.provider_ref) {
      try {
        const systemPrompt = personaService.generateSystemPrompt(mergedPersona);
        const agentPayload = {
          ...updatedAgent,
          org_id: orgId,
          persona: mergedPersona,
          provider: existing.provider || "elevenlabs",
          voice_id
        };
        const voiceProvider = buildVoiceProvider({ agent: agentPayload });
        if (voiceProvider && typeof voiceProvider.updateAgent === "function") {
          await voiceProvider.updateAgent(existing.provider_ref, agentPayload, systemPrompt);
        }
      } catch (err) {
        const logger = require("../../config/logger");
        logger.error({ err: err.message, agentId }, "Failed to update agent on voice provider");
        await supabase
          .from("agents")
          .update({
            sync_status: "failed",
            sync_error: err.message
          })
          .eq("id", agentId);
      }
    }

    // 5. Upsert organization_agents registry
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

  async getHistory(supabase, orgId, agentId) {
    const { data, error } = await supabase
      .from("agents")
      .select("persona_history")
      .eq("id", agentId)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .single();
    if (error || !data) throw NotFound("Agent not found or access denied");
    return Array.isArray(data.persona_history) ? data.persona_history : [];
  }

  async restorePersona(supabase, orgId, agentId, historyIndex) {
    const { data: existing, error: fetchErr } = await supabase
      .from("agents")
      .select("*")
      .eq("id", agentId)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .single();
    if (fetchErr || !existing) throw NotFound("Agent not found or access denied");

    const history = Array.isArray(existing.persona_history) ? existing.persona_history : [];
    const entry = history[historyIndex];
    if (!entry) throw BadRequest("History entry not found");

    // Push current state to history before restoring
    const historyEntry = { persona: existing.persona || {}, saved_at: new Date().toISOString() };
    const newHistory = [historyEntry, ...history].slice(0, DEFAULT_HISTORY_CAP * 4);

    const { data: updated, error: updateErr } = await supabase
      .from("agents")
      .update({
        persona: entry.persona,
        persona_history: newHistory,
        sync_status: "synced",
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
      .update({ inbound_number: phone.e164, updated_at: new Date().toISOString() })
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

