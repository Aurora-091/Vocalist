const express = require("express");
const { z } = require("zod");
const asyncHandler = require("../../utils/asyncHandler");
const { validate } = require("../../middleware/validation.middleware");
const { requireAuth, requireOrg, requireRole } = require("../../middleware/auth.middleware");
const { NotFound, BadRequest } = require("../../utils/errors");
const { STATES } = require("./state-machine");

const router = express.Router();
router.use(requireAuth, requireOrg);

const createSchema = z.object({
  name: z.string().min(1).max(160),
  agent_id: z.string().uuid(),
  window_start: z.string().datetime().optional(),
  window_end: z.string().datetime().optional(),
  calling_tz: z.string().min(2).max(64).default("America/New_York"),
  concurrency: z.number().int().min(1).max(100).default(5),
  max_retries: z.number().int().min(0).max(10).default(2),
});

const updateSchema = createSchema.partial().extend({
  status: z.enum(["draft", "scheduled", "running", "paused", "completed", "canceled"]).optional(),
});

const addTargetsSchema = z.object({
  contact_ids: z.array(z.string().uuid()).min(1).max(5000),
});

const STATUS_TRANSITIONS = {
  draft: ["scheduled", "running", "canceled"],
  scheduled: ["running", "paused", "canceled"],
  running: ["paused", "completed", "canceled"],
  paused: ["running", "canceled", "completed"],
  completed: [],
  canceled: [],
};

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ campaigns: data || [] });
  })
);

router.get(
  "/:id",
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("campaigns")
      .select("*")
      .eq("id", req.params.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw NotFound("Campaign not found");
    res.json({ campaign: data });
  })
);

router.post(
  "/",
  requireRole("owner", "admin"),
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("campaigns")
      .insert({ org_id: req.auth.orgId, status: "draft", ...req.body })
      .select("*")
      .single();
    if (error) throw error;
    res.status(201).json({ campaign: data });
  })
);

router.patch(
  "/:id",
  requireRole("owner", "admin"),
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: updateSchema,
  }),
  asyncHandler(async (req, res) => {
    if (req.body.status) {
      const { data: existing } = await req.supabase
        .from("campaigns")
        .select("status")
        .eq("id", req.params.id)
        .maybeSingle();
      if (!existing) throw NotFound("Campaign not found");
      const allowed = STATUS_TRANSITIONS[existing.status] || [];
      if (!allowed.includes(req.body.status)) {
        throw BadRequest(`Cannot transition campaign from ${existing.status} to ${req.body.status}`);
      }
    }
    const { data, error } = await req.supabase
      .from("campaigns")
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw NotFound("Campaign not found");
    res.json({ campaign: data });
  })
);

router.post(
  "/:id/targets",
  requireRole("owner", "admin"),
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: addTargetsSchema,
  }),
  asyncHandler(async (req, res) => {
    const rows = req.body.contact_ids.map((cid) => ({
      org_id: req.auth.orgId,
      campaign_id: req.params.id,
      contact_id: cid,
      state: STATES.QUEUED,
    }));
    const { data, error } = await req.supabase
      .from("campaign_targets")
      .upsert(rows, { onConflict: "campaign_id,contact_id", ignoreDuplicates: true })
      .select("id, contact_id, state");
    if (error) throw error;
    res.status(201).json({ added: data?.length || 0 });
  })
);

router.get(
  "/:id/targets",
  validate({
    params: z.object({ id: z.string().uuid() }),
    query: z.object({
      state: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(500).default(100),
      cursor: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    let q = req.supabase
      .from("campaign_targets")
      .select("id, state, attempts, next_attempt_at, last_call_id, created_at, contact_id")
      .eq("campaign_id", req.params.id)
      .order("created_at", { ascending: false })
      .limit(req.query.limit);
    if (req.query.state) q = q.eq("state", req.query.state);
    if (req.query.cursor) q = q.lt("created_at", req.query.cursor);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ targets: data || [] });
  })
);

router.get(
  "/:id/stats",
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("campaign_targets")
      .select("state")
      .eq("campaign_id", req.params.id);
    if (error) throw error;
    const counts = {};
    for (const r of data || []) counts[r.state] = (counts[r.state] || 0) + 1;
    res.json({ campaign_id: req.params.id, by_state: counts, total: data?.length || 0 });
  })
);

module.exports = router;
