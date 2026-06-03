const express = require("express");
const asyncHandler = require("../../utils/asyncHandler");
const { requireAuth, requireOrg } = require("../../middleware/auth.middleware");

const router = express.Router();
router.use(requireAuth, requireOrg);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const { data, error } = await req.supabase
      .from("notifications")
      .select("id, kind, payload, read_at, created_at")
      .eq("org_id", req.auth.orgId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    res.json({ notifications: data });
  })
);

router.post(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const { error } = await req.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .eq("org_id", req.auth.orgId);
    if (error) throw error;
    res.json({ ok: true });
  })
);

router.post(
  "/read-all",
  asyncHandler(async (req, res) => {
    const { error } = await req.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("org_id", req.auth.orgId)
      .is("read_at", null);
    if (error) throw error;
    res.json({ ok: true });
  })
);

module.exports = router;
