const express = require("express");
const asyncHandler = require("../../utils/asyncHandler");
const { requireAuth, requireOrg } = require("../../middleware/auth.middleware");
const { BadRequest, NotFound } = require("../../utils/errors");

const router = express.Router();
router.use(requireAuth, requireOrg);

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

    const { data, error } = await req.supabase
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
      .select("id, kind, title, uri, status")
      .maybeSingle();
    if (error) throw error;

    await req.supabase
      .from("onboarding_state")
      .update({ steps: { add_knowledge: true }, updated_at: new Date().toISOString() })
      .eq("org_id", req.auth.orgId);

    res.status(201).json(data);
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
    res.status(204).send();
  })
);

module.exports = router;
