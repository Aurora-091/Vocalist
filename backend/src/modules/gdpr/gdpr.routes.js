const express = require("express");
const asyncHandler = require("../../utils/asyncHandler");
const { requireAuth, requireOrg, requireRole } = require("../../middleware/auth.middleware");
const { BadRequest } = require("../../utils/errors");
const { toE164 } = require("../../utils/phone");

const router = express.Router();
router.use(requireAuth, requireOrg);

router.post(
  "/erase",
  requireRole("owner", "admin"),
  asyncHandler(async (req, res) => {
    const { phone, default_country, reason } = req.body || {};
    if (!phone) throw BadRequest("phone required");
    const e164 = toE164(phone, default_country || "US");

    await req.supabase.from("consent_events").insert({
      org_id: req.auth.orgId,
      e164,
      kind: "revoke",
      channel: "manual",
      evidence: {
        actor_user_id: req.auth.userId,
        ip: req.ip,
        user_agent: req.headers["user-agent"],
        reason: reason || "gdpr_erasure_request",
      },
    });

    const { error } = await req.supabase.rpc("gdpr_erase", {
      p_org: req.auth.orgId,
      p_e164: e164,
    });
    if (error) throw error;

    res.json({ ok: true, e164 });
  })
);

router.post(
  "/export",
  requireRole("owner", "admin"),
  asyncHandler(async (req, res) => {
    const { phone, default_country } = req.body || {};
    if (!phone) throw BadRequest("phone required");
    const e164 = toE164(phone, default_country || "US");

    const [contacts, consent, calls] = await Promise.all([
      req.supabase.from("contacts").select("*").eq("org_id", req.auth.orgId).eq("e164", e164),
      req.supabase
        .from("consent_events")
        .select("*")
        .eq("org_id", req.auth.orgId)
        .eq("e164", e164)
        .order("occurred_at", { ascending: false }),
      req.supabase
        .from("calls")
        .select("id, direction, status, started_at, ended_at, duration_sec, outcome")
        .eq("org_id", req.auth.orgId)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    res.json({
      e164,
      contacts: contacts.data || [],
      consent_events: consent.data || [],
      calls: calls.data || [],
    });
  })
);

module.exports = router;
