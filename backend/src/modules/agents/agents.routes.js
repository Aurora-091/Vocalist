const express = require("express");
const { z } = require("zod");
const asyncHandler = require("../../utils/asyncHandler");
const { validate } = require("../../middleware/validation.middleware");
const { requireAuth, requireOrg, requireRole } = require("../../middleware/auth.middleware");
const { NotFound } = require("../../utils/errors");

const router = express.Router();
router.use(requireAuth, requireOrg);

const createSchema = z.object({
  name: z.string().min(1).max(120),
  vertical: z.string().max(80).optional(),
  persona: z.record(z.string(), z.any()).optional(),
  voice_id: z.string().max(120).optional(),
  inbound_number: z.string().max(40).optional(),
  provider: z.enum(["vapi", "retell", "pipecat"]).default("vapi"),
  provider_ref: z.string().max(120).optional(),
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
    const { data, error } = await req.supabase
      .from("agents")
      .insert({
        org_id: req.auth.orgId,
        ...req.body,
        persona: req.body.persona || {},
      })
      .select("*")
      .single();
    if (error) throw error;
    res.status(201).json({ agent: data });
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
    const { data, error } = await req.supabase
      .from("agents")
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .is("deleted_at", null)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw NotFound("Agent not found");
    res.json({ agent: data });
  })
);

router.delete(
  "/:id",
  requireRole("owner", "admin"),
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const { error } = await req.supabase
      .from("agents")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", req.params.id);
    if (error) throw error;
    res.status(204).end();
  })
);

module.exports = router;
