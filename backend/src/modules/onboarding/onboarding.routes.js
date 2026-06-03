const express = require("express");
const asyncHandler = require("../../utils/asyncHandler");
const { requireAuth, requireOrg } = require("../../middleware/auth.middleware");
const { requireAdmin } = require("../../config/supabase");

const router = express.Router();

router.use(requireAuth, requireOrg);

const STEP_KEYS = [
  "pick_vertical",
  "connect_tools",
  "add_knowledge",
  "create_agent",
  "get_number",
  "test_and_golive",
];

async function ensureBootstrap(orgId) {
  try {
    requireAdmin().rpc("bootstrap_onboarding", { p_org: orgId }).then(() => {});
  } catch {
    // service role missing in dev; tenant call will create on first patch
  }
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    let { data, error } = await req.supabase
      .from("onboarding_state")
      .select("steps, dismissed, completed_at, updated_at")
      .eq("org_id", req.auth.orgId)
      .maybeSingle();
    if (error) throw error;

    if (!data) {
      const seed = STEP_KEYS.reduce((acc, k) => ({ ...acc, [k]: false }), {});
      const { data: ins, error: insErr } = await req.supabase
        .from("onboarding_state")
        .insert({ org_id: req.auth.orgId, steps: seed })
        .select("steps, dismissed, completed_at, updated_at")
        .maybeSingle();
      if (insErr) throw insErr;
      data = ins;
    }

    res.json({
      steps: data.steps,
      dismissed: data.dismissed,
      completed_at: data.completed_at,
      updated_at: data.updated_at,
    });
  })
);

router.post(
  "/seed-demo",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase.rpc("seed_demo_data", {
      p_org: req.auth.orgId,
    });
    if (error) throw error;
    res.json(data || { seeded: false });
  })
);

router.patch(
  "/",
  asyncHandler(async (req, res) => {
    const { steps = {}, dismissed } = req.body || {};
    const update = { updated_at: new Date().toISOString() };

    if (typeof dismissed === "boolean") update.dismissed = dismissed;

    const { data: row } = await req.supabase
      .from("onboarding_state")
      .select("steps")
      .eq("org_id", req.auth.orgId)
      .maybeSingle();

    const merged = { ...(row?.steps || {}), ...steps };
    update.steps = merged;

    const allDone = STEP_KEYS.every((k) => merged[k] === true);
    if (allDone) update.completed_at = new Date().toISOString();

    const { data, error } = await req.supabase
      .from("onboarding_state")
      .upsert({ org_id: req.auth.orgId, ...update })
      .select("steps, dismissed, completed_at")
      .maybeSingle();
    if (error) throw error;
    res.json(data);
  })
);

module.exports = router;
module.exports.ensureBootstrap = ensureBootstrap;
