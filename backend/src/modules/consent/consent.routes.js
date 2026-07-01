const express = require("express");
const { z } = require("zod");
const asyncHandler = require("../../utils/asyncHandler");
const { validate } = require("../../middleware/validation.middleware");
const { requireAuth, requireOrg } = require("../../middleware/auth.middleware");
const { toE164 } = require("../../utils/phone");
const { evaluateGate } = require("./consent-gate");

const router = express.Router();
router.use(requireAuth, requireOrg);

const recordSchema = z.object({
  phone: z.string().min(4),
  default_country: z.string().length(2).optional(),
  kind: z.enum(["grant", "revoke", "import_attest", "expiry"]),
  channel: z.enum(["voice", "sms", "web_form", "shopify_optin", "manual"]),
  evidence: z.record(z.string(), z.any()).optional(),
  occurred_at: z.string().datetime().optional(),
  // DPDP compliance fields (optional)
  purpose: z.string().max(120).optional(),
  legal_basis: z.enum(["consent", "legitimate_interest", "contract", "legal_obligation", "vital_interest", "public_interest"]).optional(),
  retention_days: z.number().int().min(1).max(3650).optional(),
  data_principal_name: z.string().max(200).optional(),
});

const checkSchema = z.object({
  phone: z.string().min(4),
  default_country: z.string().length(2).optional(),
  tz: z.string().min(2).max(64).optional(),
});

router.get(
  "/events",
  validate({
    query: z.object({
      phone: z.string().optional(),
      default_country: z.string().length(2).optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    }),
  }),
  asyncHandler(async (req, res) => {
    let q = req.supabase
      .from("consent_events")
      .select("id, e164, kind, channel, evidence, occurred_at")
      .eq("org_id", req.auth.orgId)
      .order("occurred_at", { ascending: false })
      .limit(req.query.limit);

    if (req.query.phone) {
      q = q.eq("e164", toE164(req.query.phone, req.query.default_country || "US"));
    }
    const { data, error } = await q;
    if (error) throw error;
    res.json({ events: data || [] });
  })
);

router.post(
  "/events",
  validate({ body: recordSchema }),
  asyncHandler(async (req, res) => {
    const e164 = toE164(req.body.phone, req.body.default_country || "US");

    const { data: contact } = await req.supabase
      .from("contacts")
      .select("id")
      .eq("org_id", req.auth.orgId)
      .eq("e164", e164)
      .maybeSingle();

    const insertRow = {
      org_id: req.auth.orgId,
      e164,
      contact_id: contact?.id || null,
      kind: req.body.kind,
      channel: req.body.channel,
      evidence: req.body.evidence || {},
    };
    if (req.body.occurred_at) insertRow.occurred_at = req.body.occurred_at;
    // DPDP compliance fields
    if (req.body.purpose) insertRow.purpose = req.body.purpose;
    if (req.body.legal_basis) insertRow.legal_basis = req.body.legal_basis;
    if (req.body.retention_days) insertRow.retention_days = req.body.retention_days;
    if (req.body.data_principal_name) insertRow.data_principal_name = req.body.data_principal_name;

    const { data, error } = await req.supabase
      .from("consent_events")
      .insert(insertRow)
      .select("*")
      .single();
    if (error) throw error;
    res.status(201).json({ event: data });
  })
);

router.post(
  "/check",
  validate({ body: checkSchema }),
  asyncHandler(async (req, res) => {
    const e164 = toE164(req.body.phone, req.body.default_country || "US");
    const result = await evaluateGate(req.supabase, {
      orgId: req.auth.orgId,
      e164,
      tz: req.body.tz || "America/New_York",
    });
    res.json({ e164, ...result });
  })
);

router.get(
  "/dnc",
  validate({
    query: z.object({
      limit: z.coerce.number().int().min(1).max(200).default(50),
      cursor: z.string().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    let q = req.supabase
      .from("dnc_list")
      .select("e164, reason, added_at")
      .eq("org_id", req.auth.orgId)
      .order("added_at", { ascending: false })
      .limit(req.query.limit);
    if (req.query.cursor) q = q.lt("added_at", req.query.cursor);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ entries: data || [] });
  })
);

router.post(
  "/dnc",
  validate({
    body: z.object({
      phone: z.string().min(4),
      default_country: z.string().length(2).optional(),
      reason: z.string().min(1).max(120).default("manual_optout"),
    }),
  }),
  asyncHandler(async (req, res) => {
    const e164 = toE164(req.body.phone, req.body.default_country || "US");
    const { data, error } = await req.supabase
      .from("dnc_list")
      .upsert(
        { org_id: req.auth.orgId, e164, reason: req.body.reason },
        { onConflict: "org_id,e164" }
      )
      .select("*")
      .single();
    if (error) throw error;
    res.status(201).json({ entry: data });
  })
);

module.exports = router;
