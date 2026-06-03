const express = require("express");
const { z } = require("zod");
const asyncHandler = require("../../utils/asyncHandler");
const { validate } = require("../../middleware/validation.middleware");
const { requireAuth, requireOrg, requireRole } = require("../../middleware/auth.middleware");
const { NotFound, BadRequest } = require("../../utils/errors");
const agentService = require("./agent.service");

const router = express.Router();
router.use(requireAuth, requireOrg);

const createSchema = z.object({
  name: z.string().min(1).max(120),
  vertical: z.string().max(80).optional(),
  persona: z.record(z.string(), z.any()).optional(),
  voice_id: z.string().max(120).optional(),
  inbound_number: z.string().max(40).optional(),
  provider: z.enum(["vapi", "retell", "pipecat"]).default("vapi"),
  languages: z.array(z.string()).optional(),
  business_hours: z.record(z.string(), z.any()).optional(),
  timezone: z.string().max(80).optional(),
  transfer_number: z.string().max(40).optional(),
});

const updateSchema = createSchema.partial();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("agents")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ agents: data || [] });
  })
);

router.get(
  "/:id",
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("agents")
      .select("*")
      .eq("id", req.params.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw NotFound("Agent not found");
    res.json({ agent: data });
  })
);

router.post(
  "/",
  requireRole("owner", "admin"),
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    try {
      const agent = await agentService.createAgent(req.supabase, req.auth.orgId, req.body);
      
      await req.supabase
        .from("onboarding_state")
        .update({ steps: { create_agent: true }, updated_at: new Date().toISOString() })
        .eq("org_id", req.auth.orgId);
        
      res.status(201).json({ agent });
    } catch (err) {
      throw new Error("Failed to create agent: " + err.message);
    }
  })
);

router.post(
  "/:id/test-call",
  requireRole("owner", "admin"),
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({ to: z.string().min(4) }),
  }),
  asyncHandler(async (req, res) => {
    const { data: agent, error: agentErr } = await req.supabase
      .from("agents")
      .select("id, name, provider")
      .eq("id", req.params.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (agentErr) throw agentErr;
    if (!agent) throw NotFound("Agent not found");

    const { data: call, error: callErr } = await req.supabase
      .from("calls")
      .insert({
        org_id: req.auth.orgId,
        agent_id: agent.id,
        direction: "outbound",
        provider: agent.provider,
        status: "queued",
        outcome: { test: true, requested_by: req.auth.userId, to: req.body.to },
      })
      .select("id, status")
      .maybeSingle();
    if (callErr) throw callErr;

    await req.supabase
      .from("onboarding_state")
      .update({ steps: { test_and_golive: true }, updated_at: new Date().toISOString() })
      .eq("org_id", req.auth.orgId);

    res.json({ ok: true, call });
  })
);

router.patch(
  "/:id",
  requireRole("owner", "admin"),
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: updateSchema,
  }),
  asyncHandler(async (req, res) => {
    try {
      const agent = await agentService.updateAgent(req.supabase, req.auth.orgId, req.params.id, req.body);
      res.json({ agent });
    } catch (err) {
      if (err.message.includes("not found")) throw NotFound(err.message);
      throw new Error("Failed to update agent: " + err.message);
    }
  })
);

router.delete(
  "/:id",
  requireRole("owner", "admin"),
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    try {
      await agentService.deleteAgent(req.supabase, req.auth.orgId, req.params.id);
      res.status(204).end();
    } catch (err) {
      if (err.message.includes("not found")) throw NotFound(err.message);
      throw new Error("Failed to delete agent: " + err.message);
    }
  })
);

router.post(
  "/:id/assign-number",
  requireRole("owner", "admin"),
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({ phone_number_id: z.string().uuid() })
  }),
  asyncHandler(async (req, res) => {
    try {
      const agent = await agentService.assignNumber(req.supabase, req.auth.orgId, req.params.id, req.body.phone_number_id);
      res.json({ agent });
    } catch (err) {
      throw new Error("Failed to assign number: " + err.message);
    }
  })
);

module.exports = router;

