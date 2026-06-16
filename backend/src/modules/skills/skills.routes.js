const express = require("express");
const { z } = require("zod");
const asyncHandler = require("../../utils/asyncHandler");
const { validate } = require("../../middleware/validation.middleware");
const { requireAuth, requireOrg, requireRole } = require("../../middleware/auth.middleware");
const { NotFound } = require("../../utils/errors");

const router = express.Router();
router.use(requireAuth, requireOrg);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("agent_skills")
      .select("*")
      .eq("enabled", true)
      .order("category")
      .order("name");
    if (error) throw error;
    res.json({ skills: data || [] });
  })
);

router.get(
  "/:skillId",
  validate({ params: z.object({ skillId: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("agent_skills")
      .select("*")
      .eq("id", req.params.skillId)
      .eq("enabled", true)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw NotFound("Skill not found");
    res.json({ skill: data });
  })
);

module.exports = router;
