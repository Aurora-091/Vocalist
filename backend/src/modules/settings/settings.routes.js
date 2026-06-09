const express = require("express");
const asyncHandler = require("../../utils/asyncHandler");
const { requireAuth, requireOrg, requireRole } = require("../../middleware/auth.middleware");

const router = express.Router();
router.use(requireAuth, requireOrg);

router.get(
  "/org",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("orgs")
      .select("id, name, plan_id, vertical_config_id, branding, created_at")
      .eq("id", req.auth.orgId)
      .maybeSingle();
    if (error) throw error;
    res.json({ org: data });
  })
);

router.patch(
  "/org",
  requireRole("owner", "admin"),
  asyncHandler(async (req, res) => {
    const { name, branding } = req.body || {};
    const update = {};
    if (typeof name === "string") update.name = name;
    if (branding && typeof branding === "object") update.branding = branding;
    const { data, error } = await req.supabase
      .from("orgs")
      .update(update)
      .eq("id", req.auth.orgId)
      .select("id, name, branding")
      .maybeSingle();
    if (error) throw error;
    res.json(data);
  })
);

router.get(
  "/notification-prefs",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("user_notification_prefs")
      .select("email, in_app, updated_at")
      .eq("user_id", req.auth.userId)
      .maybeSingle();
    if (error) throw error;

    const email = data?.email || {};
    const in_app = data?.in_app || {};

    res.json({
      email,
      in_app,
      updated_at: data?.updated_at,
      prefs: {
        usage_alerts: email.billing !== false,
        failed_calls: email.missed_call !== false,
        campaign_completed: email.campaign_done !== false,
      }
    });
  })
);

router.put(
  "/notification-prefs",
  asyncHandler(async (req, res) => {
    const { usage_alerts, failed_calls, campaign_completed } = req.body || {};

    const email = {
      billing: usage_alerts !== false,
      missed_call: failed_calls !== false,
      campaign_done: campaign_completed !== false,
      voicemail: true,
      integration_broken: true,
    };
    const in_app = {
      billing: usage_alerts !== false,
      missed_call: failed_calls !== false,
      campaign_done: campaign_completed !== false,
      voicemail: true,
      integration_broken: true,
    };

    const { data, error } = await req.supabase
      .from("user_notification_prefs")
      .upsert({
        user_id: req.auth.userId,
        org_id: req.auth.orgId,
        email,
        in_app,
        updated_at: new Date().toISOString(),
      })
      .select("email, in_app")
      .maybeSingle();
    if (error) throw error;

    res.json({
      email: data.email,
      in_app: data.in_app,
      prefs: {
        usage_alerts: data.email.billing,
        failed_calls: data.email.missed_call,
        campaign_completed: data.email.campaign_done,
      }
    });
  })
);

router.get(
  "/plan-tiers",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("plan_tiers")
      .select("id, key, label, monthly_usd, included_minutes, included_numbers, overage_rate_usd, features")
      .eq("enabled", true)
      .order("monthly_usd");
    if (error) throw error;
    res.json({ tiers: data });
  })
);

module.exports = router;
