const express = require("express");
const { z } = require("zod");
const asyncHandler = require("../../utils/asyncHandler");
const { validate } = require("../../middleware/validation.middleware");
const { requireAuth, requireOrg, requireRole } = require("../../middleware/auth.middleware");
const { webSessionLimiter } = require("../../middleware/rate-limit.middleware");
const { NotFound, BadRequest, UnprocessableEntity } = require("../../utils/errors");
const agentService = require("./agent.service");
const callService = require("../calls/call.service");
const { updateOnboardingStep } = require("../onboarding/onboarding.routes");

const router = express.Router();
router.use(requireAuth, requireOrg);

const createSchema = z.object({
  name: z.string().min(1).max(120),
  vertical: z.string().max(80).optional(),
  persona: z.record(z.string(), z.any()).optional(),
  voice_id: z.string().max(120).optional(),
  inbound_number: z.string().max(40).optional(),
  provider: z.enum(["vapi", "retell", "pipecat", "elevenlabs"]).default("elevenlabs"),
  languages: z.array(z.string()).optional(),
  business_hours: z.record(z.string(), z.any()).optional(),
  timezone: z.string().max(80).optional(),
  transfer_number: z.string().max(40).nullish().transform((v) => v || undefined),
  tools: z.array(z.any()).optional(),
  analysis_config: z.record(z.string(), z.any()).optional(),
  consent_required: z.boolean().optional(),
  prompt: z.string().optional(),
  model: z.string().optional(),
  hyper_parameters: z.record(z.string(), z.any()).optional(),
});

const updateSchema = createSchema.partial();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("agents")
      .select("*")
      .eq("org_id", req.auth.orgId)
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
      .eq("org_id", req.auth.orgId)
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

      await updateOnboardingStep(req.supabase, req.auth.orgId, "create_agent");

      res.status(201).json({ agent });
    } catch (err) {
      if (err.status === 422) {
        throw UnprocessableEntity(
          "ElevenLabs rejected the agent configuration",
          err.detail
        );
      }
      if (err.status >= 400 && err.status < 500) {
        throw BadRequest(`Provider error: ${err.message}`, err.detail);
      }
      throw err;
    }
  })
);

router.post(
  "/:id/test-call",
  requireRole("owner", "admin"),
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({
      to_number: z.string().min(4).optional(),
      to: z.string().min(4).optional(),
    }).refine((b) => b.to_number || b.to, { message: "to_number is required" }),
  }),
  asyncHandler(async (req, res) => {
    const toNumber = req.body.to_number || req.body.to;
    const { data: agent, error: agentErr } = await req.supabase
      .from("agents")
      .select("id, name, provider, provider_ref, inbound_number")
      .eq("id", req.params.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (agentErr) throw agentErr;
    if (!agent) throw NotFound("Agent not found");
    if (!agent.provider_ref || agent.provider_ref.startsWith("local_")) {
      throw BadRequest("Agent not provisioned. Save the agent first.");
    }

    if (agent.provider === "elevenlabs") {
      const twilioClient = require("../twilio/twilio.client");
      try {
        await twilioClient.getTenantClient(req.auth.orgId);
      } catch (err) {
        throw BadRequest("Complete Twilio setup before testing calls");
      }
    }

    const { data: call, error: callErr } = await req.supabase
      .from("calls")
      .insert({
        org_id: req.auth.orgId,
        agent_id: agent.id,
        direction: "outbound",
        provider: agent.provider,
        status: "queued",
        outcome: { test: true, requested_by: req.auth.userId, to: toNumber },
        from_number: agent.inbound_number,
        to_number: toNumber,
      })
      .select("id, status")
      .maybeSingle();
    if (callErr) throw callErr;

    try {
      const updatedCall = await callService.startOutboundCall(
        req.supabase,
        req.auth.orgId,
        call.id,
        agent.id,
        toNumber,
        null
      );

      await updateOnboardingStep(req.supabase, req.auth.orgId, "test_and_golive");

      res.json({ ok: true, call: updatedCall });
    } catch (err) {
      await req.supabase
        .from("calls")
        .update({ status: "failed", outcome: { test: true, error: err.message } })
        .eq("id", call.id);
      throw BadRequest(`Test call failed: ${err.message}`);
    }
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
      if (err.status === 422) {
        throw UnprocessableEntity(
          "ElevenLabs rejected the agent configuration",
          err.detail
        );
      }
      if (err.status >= 400 && err.status < 500) {
        throw BadRequest(`Provider error: ${err.message}`, err.detail);
      }
      throw err;
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
      throw err;
    }
  })
);

router.post(
  "/:id/sync",
  requireRole("owner", "admin"),
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    try {
      const agent = await agentService.syncAgent(req.supabase, req.auth.orgId, req.params.id);
      res.json({ agent });
    } catch (err) {
      throw err;
    }
  })
);

router.get(
  "/:id/system-prompt",
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    try {
      const systemPrompt = await agentService.getSystemPrompt(req.supabase, req.auth.orgId, req.params.id);
      res.json({ system_prompt: systemPrompt });
    } catch (err) {
      throw err;
    }
  })
);

router.post(
  "/:id/clone",
  requireRole("owner", "admin"),
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    try {
      const agent = await agentService.cloneAgent(req.supabase, req.auth.orgId, req.params.id);
      res.status(201).json({ agent });
    } catch (err) {
      throw err;
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
      throw err;
    }
  })
);

// --- Skills per agent ---

router.get(
  "/:id/skills",
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("agent_active_skills")
      .select("*, skill:agent_skills(*)")
      .eq("agent_id", req.params.id)
      .eq("org_id", req.auth.orgId);
    if (error) throw error;
    res.json({ skills: data || [] });
  })
);

router.put(
  "/:id/skills",
  requireRole("owner", "admin"),
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({
      skills: z.array(z.object({
        skill_id: z.string().uuid(),
        enabled: z.boolean().default(true),
        config: z.record(z.string(), z.any()).optional(),
      })),
    }),
  }),
  asyncHandler(async (req, res) => {
    const agentId = req.params.id;
    const orgId = req.auth.orgId;

    const { error: delErr } = await req.supabase
      .from("agent_active_skills")
      .delete()
      .eq("agent_id", agentId)
      .eq("org_id", orgId);
    if (delErr) throw delErr;

    if (req.body.skills.length > 0) {
      const rows = req.body.skills.map((s) => ({
        agent_id: agentId,
        skill_id: s.skill_id,
        org_id: orgId,
        enabled: s.enabled,
        config: s.config || {},
      }));
      const { error: insErr } = await req.supabase
        .from("agent_active_skills")
        .insert(rows);
      if (insErr) throw insErr;
    }

    const { data } = await req.supabase
      .from("agent_active_skills")
      .select("*, skill:agent_skills(*)")
      .eq("agent_id", agentId);

    res.json({ skills: data || [] });
  })
);

router.post(
  "/:id/skills/:skillId/toggle",
  requireRole("owner", "admin"),
  validate({
    params: z.object({ id: z.string().uuid(), skillId: z.string().uuid() }),
    body: z.object({ enabled: z.boolean() }),
  }),
  asyncHandler(async (req, res) => {
    const { id: agentId, skillId } = req.params;
    const orgId = req.auth.orgId;

    if (req.body.enabled) {
      const { error } = await req.supabase
        .from("agent_active_skills")
        .upsert({
          agent_id: agentId,
          skill_id: skillId,
          org_id: orgId,
          enabled: true,
        }, { onConflict: "agent_id,skill_id" });
      if (error) throw error;
    } else {
      const { error } = await req.supabase
        .from("agent_active_skills")
        .delete()
        .eq("agent_id", agentId)
        .eq("skill_id", skillId)
        .eq("org_id", orgId);
      if (error) throw error;
    }

    res.json({ ok: true });
  })
);

// ─── Web Test Call Session ───────────────────────────────────────────────────

router.post(
  "/:id/web-session",
  webSessionLimiter,
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const { data: agent, error: agentErr } = await req.supabase
      .from("agents")
      .select("id, name, provider, provider_ref, org_id")
      .eq("id", req.params.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (agentErr) throw agentErr;
    if (!agent) throw NotFound("Agent not found");
    if (!agent.provider_ref || agent.provider_ref.startsWith("local_")) {
      throw BadRequest("Agent not provisioned with ElevenLabs. Save the agent first.");
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw BadRequest("ElevenLabs API key not configured");
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agent.provider_ref}`,
      { method: "GET", headers: { "xi-api-key": apiKey } }
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw BadRequest(`ElevenLabs signed URL failed: ${response.status}`, detail);
    }

    const { signed_url } = await response.json();

    // Pre-create a calls row so the ElevenLabs webhook can link the conversation
    // back to this session and so the test flag is queryable from the start.
    const { data: callRow, error: callErr } = await req.supabase
      .from("calls")
      .insert({
        org_id: agent.org_id,
        agent_id: agent.id,
        direction: "outbound",
        provider: "elevenlabs",
        channel: "web_test",
        status: "queued",
        outcome: { test: true },
      })
      .select("id")
      .single();

    if (callErr) throw callErr;

    res.json({ signed_url, agent_id: agent.provider_ref, call_id: callRow.id });
  })
);

// ─── Persona History ────────────────────────────────────────────────────────

router.get(
  "/:id/history",
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const history = await agentService.getHistory(req.supabase, req.auth.orgId, req.params.id);
    res.json({ history });
  })
);

router.post(
  "/:id/restore",
  requireRole("owner", "admin"),
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({ index: z.number().int().min(0) }),
  }),
  asyncHandler(async (req, res) => {
    const agent = await agentService.restorePersona(req.supabase, req.auth.orgId, req.params.id, req.body.index);
    res.json({ agent });
  })
);

module.exports = router;

