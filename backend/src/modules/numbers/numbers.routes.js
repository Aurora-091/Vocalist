const express = require("express");
const asyncHandler = require("../../utils/asyncHandler");
const { requireAuth, requireOrg } = require("../../middleware/auth.middleware");
const { BadRequest, NotFound } = require("../../utils/errors");
const { toE164 } = require("../../utils/phone");
const { updateOnboardingStep } = require("../onboarding/onboarding.routes");

const router = express.Router();
router.use(requireAuth, requireOrg);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("phone_numbers")
      .select("id, e164, owner, byo, agent_id, status, created_at")
      .eq("org_id", req.auth.orgId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ numbers: data });
  })
);

router.post(
  "/byo",
  asyncHandler(async (req, res) => {
    const { e164, phone_number, agent_id, default_country } = req.body || {};
    const inputNumber = e164 || phone_number;
    if (!inputNumber) throw BadRequest("e164 or phone_number required");
    const normalized = toE164(inputNumber, default_country || "US");
    if (!normalized) throw BadRequest("invalid phone number");

    const { data, error } = await req.supabase
      .from("phone_numbers")
      .insert({
        org_id: req.auth.orgId,
        e164: normalized,
        owner: "tenant",
        byo: true,
        agent_id: agent_id || null,
      })
      .select("id, e164, owner, byo, agent_id")
      .maybeSingle();
    if (error) throw error;

    await updateOnboardingStep(req.supabase, req.auth.orgId, "get_number");

    res.status(201).json(data);
  })
);

router.post(
  "/provision",
  asyncHandler(async (req, res) => {
    const { e164, agent_id, default_country } = req.body || {};
    if (!e164) throw BadRequest("e164 required");
    const normalized = toE164(e164, default_country || "US");
    if (!normalized) throw BadRequest("invalid phone number");

    const { data, error } = await req.supabase
      .from("phone_numbers")
      .insert({
        org_id: req.auth.orgId,
        e164: normalized,
        owner: "aurora",
        byo: false,
        agent_id: agent_id || null,
        status: "active",
      })
      .select("id, e164, owner, byo, agent_id")
      .maybeSingle();
    if (error) throw error;

    await updateOnboardingStep(req.supabase, req.auth.orgId, "get_number");

    res.status(201).json(data);
  })
);

router.post(
  "/:id/bind/:agentId",
  asyncHandler(async (req, res) => {
    const { data: agent } = await req.supabase
      .from("agents")
      .select("id")
      .eq("id", req.params.agentId)
      .eq("org_id", req.auth.orgId)
      .maybeSingle();
    if (!agent) throw NotFound("agent not found");

    const { data, error } = await req.supabase
      .from("phone_numbers")
      .update({ agent_id: req.params.agentId })
      .eq("id", req.params.id)
      .eq("org_id", req.auth.orgId)
      .select("id, e164, agent_id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw NotFound("number not found");
    res.json(data);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { error } = await req.supabase
      .from("phone_numbers")
      .delete()
      .eq("id", req.params.id)
      .eq("org_id", req.auth.orgId);
    if (error) throw error;
    res.status(204).send();
  })
);

module.exports = router;
