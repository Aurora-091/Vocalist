const express = require("express");
const { z } = require("zod");
const asyncHandler = require("../../utils/asyncHandler");
const { validate } = require("../../middleware/validation.middleware");
const { requireAuth, requireOrg, requireRole } = require("../../middleware/auth.middleware");
const { NotFound } = require("../../utils/errors");

const router = express.Router();
router.use(requireAuth, requireOrg);

const PLAYBOOK_KEYS = ["cart_recovery", "cod_confirm", "feedback"];

const upsertSchema = z.object({
  enabled: z.boolean().optional(),
  agent_id: z.string().uuid().nullish(),
  delay_minutes: z.number().int().min(0).max(10080).optional(),
  max_attempts: z.number().int().min(1).max(10).optional(),
  call_hours_start: z.number().int().min(0).max(23).optional(),
  call_hours_end: z.number().int().min(0).max(23).optional(),
  timezone: z.string().max(80).optional(),
  config: z.record(z.string(), z.any()).optional(),
});

// GET /v1/playbooks — list all playbooks for org (upserts defaults if missing)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const orgId = req.auth.orgId;
    const { data: existing, error } = await req.supabase
      .from("playbooks")
      .select("*")
      .eq("org_id", orgId);
    if (error) throw error;

    // Ensure all 3 canonical playbooks exist — insert missing ones
    const existingKeys = new Set((existing || []).map((p) => p.key));
    const missing = PLAYBOOK_KEYS.filter((k) => !existingKeys.has(k));
    if (missing.length > 0) {
      const inserts = missing.map((key) => ({
        org_id: orgId,
        key,
        enabled: false,
        delay_minutes: key === "feedback" ? 1440 : 30,
        max_attempts: 3,
        call_hours_start: 9,
        call_hours_end: 21,
        timezone: "Asia/Kolkata",
        config: {},
      }));
      const { data: inserted, error: insErr } = await req.supabase
        .from("playbooks")
        .insert(inserts)
        .select("*");
      if (insErr) throw insErr;
      const all = [...(existing || []), ...(inserted || [])];
      return res.json({ playbooks: all });
    }

    res.json({ playbooks: existing || [] });
  })
);

// PATCH /v1/playbooks/:key — update a specific playbook
router.patch(
  "/:key",
  requireRole("owner", "admin"),
  validate({
    params: z.object({ key: z.enum(["cart_recovery", "cod_confirm", "feedback"]) }),
    body: upsertSchema,
  }),
  asyncHandler(async (req, res) => {
    const orgId = req.auth.orgId;
    const { key } = req.params;

    // Upsert — create if missing
    const { data: existing } = await req.supabase
      .from("playbooks")
      .select("id")
      .eq("org_id", orgId)
      .eq("key", key)
      .maybeSingle();

    const payload = { ...req.body, org_id: orgId, key, updated_at: new Date().toISOString() };

    if (existing) {
      const { data, error } = await req.supabase
        .from("playbooks")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw error;
      return res.json({ playbook: data });
    }

    const { data, error } = await req.supabase
      .from("playbooks")
      .insert({ ...payload, enabled: req.body.enabled ?? false, delay_minutes: req.body.delay_minutes ?? 30, max_attempts: req.body.max_attempts ?? 3, call_hours_start: req.body.call_hours_start ?? 9, call_hours_end: req.body.call_hours_end ?? 21, timezone: req.body.timezone ?? "Asia/Kolkata", config: req.body.config ?? {} })
      .select("*")
      .single();
    if (error) throw error;
    res.status(201).json({ playbook: data });
  })
);

module.exports = router;
