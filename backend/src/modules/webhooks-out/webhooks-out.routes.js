const express = require("express");
const asyncHandler = require("../../utils/asyncHandler");
const { requireAuth, requireOrg } = require("../../middleware/auth.middleware");
const { BadRequest } = require("../../utils/errors");

const router = express.Router();
router.use(requireAuth, requireOrg);

const ALLOWED_EVENTS = [
  "call.completed",
  "call.failed",
  "call.voicemail",
  "campaign.completed",
  "consent.revoked",
];

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("webhook_endpoints")
      .select("id, url, events, status, created_at")
      .eq("org_id", req.auth.orgId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ endpoints: data, webhooks: data });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { url, events = ["call.completed"] } = req.body || {};
    if (!url || !/^https?:\/\//i.test(url)) throw BadRequest("valid URL required");
    const filtered = events.filter((e) => ALLOWED_EVENTS.includes(e));
    if (!filtered.length) throw BadRequest("at least one valid event required");

    const { data, error } = await req.supabase
      .from("webhook_endpoints")
      .insert({
        org_id: req.auth.orgId,
        url,
        events: filtered,
        secret_ref: `wh:${req.auth.orgId}:${Date.now()}`,
      })
      .select("id, url, events, status")
      .maybeSingle();
    if (error) throw error;
    res.status(201).json(data);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { error } = await req.supabase
      .from("webhook_endpoints")
      .delete()
      .eq("id", req.params.id)
      .eq("org_id", req.auth.orgId);
    if (error) throw error;
    res.status(204).send();
  })
);

module.exports = router;
