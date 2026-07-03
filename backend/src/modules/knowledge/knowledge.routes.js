const express = require("express");
const asyncHandler = require("../../utils/asyncHandler");
const { requireAuth, requireOrg } = require("../../middleware/auth.middleware");
const { BadRequest, NotFound } = require("../../utils/errors");

const router = express.Router();
router.use(requireAuth, requireOrg);

async function syncAgentKnowledge(supabase, orgId, agentId) {
  // 1. Get all subscribed source mappings
  const { data: subRows } = await supabase
    .from("agent_knowledge")
    .select("source_id")
    .eq("agent_id", agentId)
    .eq("org_id", orgId);
  
  const sourceIds = subRows?.map(r => r.source_id) || [];
  
  let providerIds = [];
  if (sourceIds.length > 0) {
    const { data: mappings } = await supabase
      .from("knowledge_provider_mappings")
      .select("provider_knowledge_id")
      .eq("org_id", orgId)
      .in("knowledge_source_id", sourceIds);
    providerIds = mappings?.map(m => m.provider_knowledge_id) || [];
  }

  // 2. Get the agent from DB
  const { data: agent } = await supabase
    .from("agents")
    .select("provider_ref")
    .eq("id", agentId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (agent && agent.provider_ref) {
    const agentService = require("../agents/agent.service");
    // Call agentService.updateAgent with the updated knowledge base list
    await agentService.updateAgent(supabase, orgId, agentId, {
      knowledge_base_ids: providerIds
    });
  }
}

router.get(
  "/sources",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("knowledge_sources")
      .select("id, kind, title, uri, status, meta, created_at, updated_at")
      .eq("org_id", req.auth.orgId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ sources: data });
  })
);

router.post(
  "/sources",
  asyncHandler(async (req, res) => {
    const { kind, title, uri, storage_ref, meta = {} } = req.body || {};
    if (!kind || !title) throw BadRequest("kind and title are required");
    if (!["document", "website", "integration"].includes(kind)) {
      throw BadRequest("invalid kind");
    }

    // Prevent duplicate uploads by checking if it already exists
    let existingSource = null;
    if (kind === "website" && uri) {
      const { data } = await req.supabase
        .from("knowledge_sources")
        .select("id, kind, title, uri, status")
        .eq("org_id", req.auth.orgId)
        .eq("uri", uri)
        .maybeSingle();
      existingSource = data;
    } else if (kind === "document" && storage_ref) {
      const { data } = await req.supabase
        .from("knowledge_sources")
        .select("id, kind, title, uri, status")
        .eq("org_id", req.auth.orgId)
        .eq("storage_ref", storage_ref)
        .maybeSingle();
      existingSource = data;
    }

    if (existingSource) {
      return res.status(200).json(existingSource);
    }

    // Insert new source as processing
    const { data: source, error } = await req.supabase
      .from("knowledge_sources")
      .insert({
        org_id: req.auth.orgId,
        kind,
        title,
        uri,
        storage_ref,
        meta,
        status: "processing",
      })
      .select("id, kind, title, uri, status, storage_ref")
      .maybeSingle();
    if (error) throw error;

    const { updateOnboardingStep } = require("../onboarding/onboarding.routes");
    await updateOnboardingStep(req.supabase, req.auth.orgId, "add_knowledge");

    // Sync to ElevenLabs
    try {
      const { buildVoiceProvider } = require("../../providers/voice/factory");
      const providerInstance = buildVoiceProvider({ agent: { provider: "elevenlabs", org_id: req.auth.orgId } });
      const syncResult = await providerInstance.syncKnowledgeBase(source);
      
      // Store returned knowledge mapping ID
      await req.supabase
        .from("knowledge_provider_mappings")
        .insert({
          org_id: req.auth.orgId,
          knowledge_source_id: source.id,
          provider: "elevenlabs",
          provider_knowledge_id: syncResult.provider_knowledge_id
        });
      
      // Update status to ready
      const { data: updatedSource } = await req.supabase
        .from("knowledge_sources")
        .update({ status: "ready" })
        .eq("id", source.id)
        .select("id, kind, title, uri, status")
        .maybeSingle();

      res.status(201).json(updatedSource);
    } catch (err) {
      console.error("Failed to sync knowledge to ElevenLabs:", err.message);
      await req.supabase
        .from("knowledge_sources")
        .update({ status: "error", meta: { error: err.message } })
        .eq("id", source.id);
      res.status(201).json({ ...source, status: "error", meta: { error: err.message } });
    }
  })
);

router.post(
  "/sources/:id/resync",
  asyncHandler(async (req, res) => {
    const { error } = await req.supabase
      .from("knowledge_sources")
      .update({ status: "syncing", updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .eq("org_id", req.auth.orgId);
    if (error) throw error;
    res.json({ ok: true });
  })
);

router.delete(
  "/sources/:id",
  asyncHandler(async (req, res) => {
    // Delete mappings first
    await req.supabase
      .from("knowledge_provider_mappings")
      .delete()
      .eq("knowledge_source_id", req.params.id)
      .eq("org_id", req.auth.orgId);

    const { error } = await req.supabase
      .from("knowledge_sources")
      .delete()
      .eq("id", req.params.id)
      .eq("org_id", req.auth.orgId);
    if (error) throw error;
    res.status(204).send();
  })
);

router.get(
  "/agents/:agentId",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("agent_knowledge")
      .select("source_id, knowledge_sources(id, title, kind, status)")
      .eq("agent_id", req.params.agentId)
      .eq("org_id", req.auth.orgId);
    if (error) throw error;
    res.json({ subscriptions: data });
  })
);

router.post(
  "/agents/:agentId/subscribe",
  asyncHandler(async (req, res) => {
    const { source_id } = req.body || {};
    if (!source_id) throw BadRequest("source_id required");

    const { data: agent } = await req.supabase
      .from("agents")
      .select("id")
      .eq("id", req.params.agentId)
      .eq("org_id", req.auth.orgId)
      .maybeSingle();
    if (!agent) throw NotFound("agent not found");

    const { error } = await req.supabase
      .from("agent_knowledge")
      .insert({ agent_id: req.params.agentId, source_id, org_id: req.auth.orgId });
    if (error && error.code !== "23505") throw error;

    // Trigger sync to ElevenLabs
    await syncAgentKnowledge(req.supabase, req.auth.orgId, req.params.agentId);

    res.json({ ok: true });
  })
);

router.delete(
  "/agents/:agentId/subscribe/:sourceId",
  asyncHandler(async (req, res) => {
    const { error } = await req.supabase
      .from("agent_knowledge")
      .delete()
      .eq("agent_id", req.params.agentId)
      .eq("source_id", req.params.sourceId)
      .eq("org_id", req.auth.orgId);
    if (error) throw error;

    // Trigger sync to ElevenLabs
    await syncAgentKnowledge(req.supabase, req.auth.orgId, req.params.agentId);

    res.status(204).send();
  })
);

module.exports = router;
module.exports.syncAgentKnowledge = syncAgentKnowledge;
