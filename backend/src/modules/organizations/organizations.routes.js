const express = require("express");
const { z } = require("zod");
const asyncHandler = require("../../utils/asyncHandler");
const { validate } = require("../../middleware/validation.middleware");
const { requireAuth, requireOrg, requireRole } = require("../../middleware/auth.middleware");
const { NotFound } = require("../../utils/errors");

const router = express.Router();

const updateOrgSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  plan_id: z.string().min(1).max(40).optional(),
});

router.use(requireAuth, requireOrg);

router.get(
  "/current",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("orgs")
      .select("id, name, plan_id, created_at")
      .eq("id", req.auth.orgId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw NotFound("Organization not found");
    res.json({ org: data });
  })
);

router.patch(
  "/current",
  requireRole("owner", "admin"),
  validate({ body: updateOrgSchema }),
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("orgs")
      .update(req.body)
      .eq("id", req.auth.orgId)
      .select("id, name, plan_id, created_at")
      .single();
    if (error) throw error;
    res.json({ org: data });
  })
);

module.exports = router;
