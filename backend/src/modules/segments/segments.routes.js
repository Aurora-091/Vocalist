const express = require("express");
const { z } = require("zod");
const asyncHandler = require("../../utils/asyncHandler");
const { requireAuth, requireOrg, requireRole } = require("../../middleware/auth.middleware");
const { validate } = require("../../middleware/validation.middleware");
const { BadRequest } = require("../../utils/errors");

const router = express.Router();
router.use(requireAuth, requireOrg);

const filterSchema = z.object({
  tags: z.array(z.string().max(80)).optional(),
  source: z.string().max(80).optional(),
}).strict();

const createSchema = z.object({
  name: z.string().min(1).max(120),
  filter: filterSchema.optional(),
});

const previewSchema = z.object({
  filter: filterSchema.optional(),
  segment_id: z.string().uuid().optional(),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("segments")
      .select("id, name, filter, created_at")
      .eq("org_id", req.auth.orgId)
      .order("name");
    if (error) throw error;
    res.json({ segments: data });
  })
);

router.post(
  "/",
  requireRole("owner", "admin"),
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const { name, filter = {} } = req.body || {};
    const { data, error } = await req.supabase
      .from("segments")
      .insert({ org_id: req.auth.orgId, name, filter })
      .select("id, name, filter")
      .maybeSingle();
    if (error) throw error;
    res.status(201).json(data);
  })
);

router.delete(
  "/:id",
  requireRole("owner", "admin"),
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const { error } = await req.supabase
      .from("segments")
      .delete()
      .eq("id", req.params.id)
      .eq("org_id", req.auth.orgId);
    if (error) throw error;
    res.status(204).send();
  })
);

router.post(
  "/preview",
  validate({ body: previewSchema }),
  asyncHandler(async (req, res) => {
    const { filter = {}, segment_id } = req.body || {};
    let activeFilter = filter;

    if (segment_id) {
      const { data: seg } = await req.supabase
        .from("segments")
        .select("filter")
        .eq("id", segment_id)
        .eq("org_id", req.auth.orgId)
        .maybeSingle();
      if (seg) activeFilter = seg.filter;
    }

    let q = req.supabase
      .from("contacts")
      .select("id, e164, consent_status", { count: "exact" })
      .eq("org_id", req.auth.orgId)
      .is("deleted_at", null);

    if (Array.isArray(activeFilter.tags) && activeFilter.tags.length) {
      q = q.contains("tags", activeFilter.tags);
    }
    if (activeFilter.source) {
      q = q.eq("source", activeFilter.source);
    }

    const { data, count, error } = await q.limit(2000);
    if (error) throw error;

    let granted = 0;
    let none = 0;
    let revoked = 0;
    const e164s = (data || []).map((c) => c.e164);
    for (const row of data || []) {
      if (row.consent_status === "granted") granted += 1;
      else if (row.consent_status === "revoked") revoked += 1;
      else none += 1;
    }

    let dnc = 0;
    if (e164s.length) {
      const { count: dncCount } = await req.supabase
        .from("dnc_list")
        .select("e164", { count: "exact", head: true })
        .eq("org_id", req.auth.orgId)
        .in("e164", e164s);
      dnc = dncCount || 0;
    }

    const dialable = Math.max(0, granted - dnc);
    const suppressed = (count || 0) - dialable;

    res.json({
      total: count || 0,
      granted,
      none,
      revoked,
      dnc,
      dialable,
      suppressed,
    });
  })
);

module.exports = router;
