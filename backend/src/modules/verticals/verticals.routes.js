const express = require("express");
const asyncHandler = require("../../utils/asyncHandler");
const { requireAuth, requireOrg } = require("../../middleware/auth.middleware");
const { BadRequest } = require("../../utils/errors");

const router = express.Router();

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("vertical_configs")
      .select("id, key, label, config, enabled")
      .eq("enabled", true)
      .order("label");
    if (error) throw error;
    res.json({ verticals: data });
  })
);

router.post(
  "/select",
  requireOrg,
  asyncHandler(async (req, res) => {
    const { vertical_config_id } = req.body || {};
    if (!vertical_config_id) throw BadRequest("vertical_config_id is required");

    const { data: vc, error: vcErr } = await req.supabase
      .from("vertical_configs")
      .select("id")
      .eq("id", vertical_config_id)
      .maybeSingle();
    if (vcErr) throw vcErr;
    if (!vc) throw BadRequest("vertical not found");

    const { error: orgErr } = await req.supabase
      .from("orgs")
      .update({ vertical_config_id })
      .eq("id", req.auth.orgId);
    if (orgErr) throw orgErr;

    await req.supabase
      .from("onboarding_state")
      .update({ steps: { pick_vertical: true }, updated_at: new Date().toISOString() })
      .eq("org_id", req.auth.orgId);

    res.json({ ok: true });
  })
);

module.exports = router;
