const { Router } = require("express");
const { requireAuth } = require("../../middleware/auth.middleware");
const { requireSuperAdmin } = require("../../middleware/admin.middleware");
const adminService = require("./admin.service");
const { sendBroadcastEmail, resolveRecipients, buildBroadcastHtml } = require("../../services/email.service");
const asyncHandler = require("../../utils/asyncHandler");
const logger = require("../../config/logger");

const router = Router();

router.use(requireAuth);
router.use(requireSuperAdmin);

router.get("/me", (_req, res) => {
  res.json({ platform_role: "super_admin" });
});

router.get("/stats", asyncHandler(async (_req, res) => {
  const stats = await adminService.getStats();
  res.json(stats);
}));

router.get("/recent-signups", asyncHandler(async (_req, res) => {
  const data = await adminService.getRecentSignups();
  res.json(data);
}));

router.get("/recent-errors", asyncHandler(async (_req, res) => {
  const data = await adminService.getRecentErrors();
  res.json(data);
}));

router.get("/users", asyncHandler(async (req, res) => {
  const { page = 1, limit = 25, q = "" } = req.query;
  const result = await adminService.listUsers({ page: +page, limit: +limit, q });
  res.json(result);
}));

router.get("/users/:id", asyncHandler(async (req, res) => {
  const data = await adminService.getUserDetail(req.params.id);
  res.json(data);
}));

router.patch("/users/:id", asyncHandler(async (req, res) => {
  const data = await adminService.updateUser(req.params.id, req.body);
  res.json(data);
}));

router.get("/waitlist", asyncHandler(async (req, res) => {
  const { page = 1, limit = 25, q = "", status = "" } = req.query;
  const result = await adminService.listWaitlist({ page: +page, limit: +limit, q, status });
  res.json(result);
}));

router.patch("/waitlist/:id", asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["pending", "approved", "rejected"].includes(status)) {
    return res.status(400).json({ error: { code: "validation_error", message: "Invalid status" } });
  }
  const data = await adminService.updateWaitlistStatus(req.params.id, status);
  res.json(data);
}));

router.post("/waitlist/bulk", asyncHandler(async (req, res) => {
  const { ids, status } = req.body;
  if (!Array.isArray(ids) || !ids.length || !["approved", "rejected"].includes(status)) {
    return res.status(400).json({ error: { code: "validation_error", message: "Invalid request" } });
  }
  const data = await adminService.bulkUpdateWaitlist(ids, status);
  res.json({ updated: data.length });
}));

router.get("/agents", asyncHandler(async (req, res) => {
  const { page = 1, limit = 25, q = "" } = req.query;
  const result = await adminService.listAgents({ page: +page, limit: +limit, q });
  res.json(result);
}));

router.get("/agents/:id", asyncHandler(async (req, res) => {
  const data = await adminService.getAgentDetail(req.params.id);
  res.json(data);
}));

// POST /v1/admin/agents/resync — re-push all ElevenLabs agents with fresh payload
router.post("/agents/resync", asyncHandler(async (req, res) => {
  const { requireAdmin } = require("../../config/supabase");
  const personaService = require("../../services/persona.service");
  const { buildVoiceProvider } = require("../../providers/voice/factory");

  const admin = requireAdmin();
  const { org_id } = req.body; // optional: scope to one org

  let query = admin
    .from("agents")
    .select("*")
    .eq("provider", "elevenlabs")
    .is("deleted_at", null);

  if (org_id) query = query.eq("org_id", org_id);

  const { data: agents, error } = await query;
  if (error) throw error;

  const results = { synced: 0, skipped: 0, failed: 0, errors: [] };

  for (const agent of agents || []) {
    if (!agent.provider_ref) {
      results.skipped++;
      continue;
    }
    try {
      const systemPrompt = personaService.generateSystemPrompt(agent.persona || {});
      const voiceProvider = buildVoiceProvider({ agent });
      await voiceProvider.updateAgent(agent.provider_ref, agent, systemPrompt);
      await admin
        .from("agents")
        .update({ sync_status: "synced", sync_error: null, last_synced_at: new Date().toISOString() })
        .eq("id", agent.id);
      results.synced++;
    } catch (err) {
      logger.error({ agentId: agent.id, orgId: agent.org_id, err: err.message }, "resync: failed to push agent");
      await admin
        .from("agents")
        .update({ sync_status: "error", sync_error: err.message })
        .eq("id", agent.id);
      results.failed++;
      results.errors.push({ agent_id: agent.id, org_id: agent.org_id, error: err.message });
    }
  }

  logger.info({ ...results, scope: org_id || "all" }, "Admin agents resync complete");
  res.json({ ok: true, ...results });
}));

router.get("/billing", asyncHandler(async (req, res) => {
  const { page = 1, limit = 25 } = req.query;
  const result = await adminService.listBilling({ page: +page, limit: +limit });
  res.json(result);
}));

router.get("/logs", asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, severity = "" } = req.query;
  const result = await adminService.listLogs({ page: +page, limit: +limit, severity });
  res.json(result);
}));

router.get("/settings", asyncHandler(async (_req, res) => {
  const data = await adminService.getSettings();
  res.json(data);
}));

router.patch("/settings", asyncHandler(async (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: { code: "validation_error", message: "Key required" } });
  const data = await adminService.updateSetting(key, value, req.auth.userId);
  res.json(data);
}));

// ─── Broadcasts ──────────────────────────────────────────────────────────────

const VALID_TEMPLATES = ["waitlist_update", "product_update", "custom"];
const VALID_RECIPIENTS = ["waitlist_pending", "waitlist_approved", "waitlist_all", "users_all"];

router.get("/broadcasts", asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const result = await adminService.listBroadcasts({ page: +page, limit: +limit });
  res.json(result);
}));

router.post("/broadcasts", asyncHandler(async (req, res) => {
  const { template, subject, variables, recipient_type, preview_only } = req.body;

  if (!VALID_TEMPLATES.includes(template)) {
    return res.status(400).json({ error: { code: "validation_error", message: "Invalid template" } });
  }
  if (!subject || typeof subject !== "string") {
    return res.status(400).json({ error: { code: "validation_error", message: "Subject required" } });
  }
  if (!VALID_RECIPIENTS.includes(recipient_type)) {
    return res.status(400).json({ error: { code: "validation_error", message: "Invalid recipient_type" } });
  }

  const recipients = await resolveRecipients(recipient_type);

  if (preview_only) {
    const sample = recipients[0] || { name: "Test User", email: "test@example.com", id: "preview" };
    const sample_html = buildBroadcastHtml(sample.name, sample.id, template, variables || {});
    return res.json({ count: recipients.length, sample_email: sample.email, sample_html });
  }

  // Batch send in groups of 50 with 200ms delay between batches
  let sent = 0;
  const batchSize = 50;
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    await Promise.allSettled(
      batch.map((r) => sendBroadcastEmail(r.email, r.name, template, subject, variables || {}, r.id))
    );
    sent += batch.length;
    if (i + batchSize < recipients.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  const record = await adminService.logBroadcast({
    template,
    subject,
    variables: variables || {},
    recipient_type,
    recipient_count: sent,
    sent_by: req.auth.userId,
  });

  logger.info({ broadcastId: record.id, recipient_count: sent, template }, "Broadcast sent");
  res.json({ id: record.id, recipient_count: sent, status: "sent" });
}));

module.exports = router;
