const express = require("express");
const { z } = require("zod");
const asyncHandler = require("../../utils/asyncHandler");
const { validate } = require("../../middleware/validation.middleware");
const { requireAuth, requireOrg } = require("../../middleware/auth.middleware");
const { expensiveOpsLimiter } = require("../../middleware/rate-limit.middleware");
const { toE164, tryE164 } = require("../../utils/phone");
const { NotFound, Conflict } = require("../../utils/errors");
const {
  createContactSchema,
  updateContactSchema,
  bulkCreateSchema,
  listSchema,
} = require("./contacts.validator");

const router = express.Router();
router.use(requireAuth, requireOrg);

router.get(
  "/",
  validate({ query: listSchema }),
  asyncHandler(async (req, res) => {
    const { limit, cursor, consent_status, q } = req.query;
    let query = req.supabase
      .from("contacts")
      .select("id, e164, name, email, source, consent_status, consent_ts, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit + 1);

    if (consent_status) query = query.eq("consent_status", consent_status);
    if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,e164.ilike.%${q}%`);
    if (cursor) query = query.lt("created_at", cursor);

    const { data, error } = await query;
    if (error) throw error;
    const items = (data || []).slice(0, limit);
    const next_cursor = data && data.length > limit ? data[limit - 1].created_at : null;
    res.json({ contacts: items, next_cursor });
  })
);

router.get(
  "/:id",
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("contacts")
      .select("*")
      .eq("id", req.params.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw NotFound("Contact not found");
    res.json({ contact: data });
  })
);

router.post(
  "/",
  validate({ body: createContactSchema }),
  asyncHandler(async (req, res) => {
    const e164 = toE164(req.body.phone, req.body.default_country || "US");
    const { data, error } = await req.supabase
      .from("contacts")
      .insert({
        org_id: req.auth.orgId,
        e164,
        name: req.body.name,
        email: req.body.email,
        source: req.body.source,
        crm_ref: req.body.crm_ref,
      })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") throw Conflict("Contact already exists for this phone number");
      throw error;
    }
    res.status(201).json({ contact: data });
  })
);

router.post(
  "/bulk",
  validate({ body: bulkCreateSchema }),
  asyncHandler(async (req, res) => {
    const country = req.body.default_country || "US";
    const rows = [];
    const skipped = [];
    for (const c of req.body.contacts) {
      const e164 = tryE164(c.phone, country);
      if (!e164) {
        skipped.push({ phone: c.phone, reason: "invalid_phone" });
        continue;
      }
      rows.push({
        org_id: req.auth.orgId,
        e164,
        name: c.name,
        email: c.email,
        source: req.body.source,
        crm_ref: c.crm_ref,
      });
    }

    if (rows.length === 0) {
      return res.status(207).json({ inserted: 0, skipped });
    }

    const { data, error } = await req.supabase
      .from("contacts")
      .upsert(rows, { onConflict: "org_id,e164", ignoreDuplicates: true })
      .select("id, e164");
    if (error) throw error;

    res.status(207).json({ inserted: data?.length || 0, skipped });
  })
);

router.patch(
  "/:id",
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: updateContactSchema,
  }),
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("contacts")
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .is("deleted_at", null)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw NotFound("Contact not found");
    res.json({ contact: data });
  })
);

router.delete(
  "/:id",
  validate({ params: z.object({ id: z.string().uuid() }) }),
  asyncHandler(async (req, res) => {
    const { error } = await req.supabase
      .from("contacts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", req.params.id);
    if (error) throw error;
    res.status(204).end();
  })
);

const dncSchema = z.object({
  phones: z.array(z.string().min(5)).min(1).max(5000),
  default_country: z.string().min(2).max(4).default("US"),
});

router.post(
  "/dnc-upload",
  expensiveOpsLimiter,
  validate({ body: dncSchema }),
  asyncHandler(async (req, res) => {
    const country = req.body.default_country || "US";
    const rows = [];
    let invalid = 0;

    for (const phone of req.body.phones) {
      const e164 = tryE164(phone, country);
      if (!e164) {
        invalid++;
        continue;
      }
      rows.push({
        org_id: req.auth.orgId,
        e164,
        consent_status: "dnc",
        source: "dnc_upload",
      });
    }

    if (rows.length === 0) {
      return res.json({ updated: 0, created: 0, invalid, total_blocked: 0 });
    }

    const { data, error } = await req.supabase
      .from("contacts")
      .upsert(rows, { onConflict: "org_id,e164" })
      .select("id");
    if (error) throw error;

    const total = data?.length || 0;
    res.json({ total_blocked: total, invalid });
  })
);

module.exports = router;
