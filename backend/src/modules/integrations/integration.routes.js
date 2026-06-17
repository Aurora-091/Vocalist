const express = require("express");
const { z } = require("zod");
const asyncHandler = require("../../utils/asyncHandler");
const { validate } = require("../../middleware/validation.middleware");
const { requireAuth, requireOrg, requireRole } = require("../../middleware/auth.middleware");
const { NotFound } = require("../../utils/errors");
const { buildProvider, listProviderNames } = require("./integration.service");

const { handleInstall, handleCallback, handleDisconnect } = require("./shopify.oauth");

const router = express.Router();

router.get("/shopify/install", asyncHandler(handleInstall));
router.get("/shopify/callback", asyncHandler(handleCallback));
router.delete("/shopify/disconnect", requireAuth, requireOrg, asyncHandler(handleDisconnect));

router.use(requireAuth, requireOrg);

const upsertSchema = z.object({
  type: z.enum(["shopify", "calcom", "google_cal", "outlook_cal", "crm", "zapier", "twilio"]),
  config: z.record(z.string(), z.any()).default({}),
  secret_ref: z.string().optional(),
  status: z.enum(["active", "disabled"]).default("active"),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("integrations")
      .select("id, type, status, config, created_at")
      .order("created_at", { ascending: true });
    if (error) throw error;
    const safe = (data || []).map((row) => ({
      ...row,
      config: scrubSecrets(row.config),
    }));
    res.json({ integrations: safe, available: listProviderNames() });
  })
);

router.put(
  "/",
  requireRole("owner", "admin"),
  validate({ body: upsertSchema }),
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("integrations")
      .upsert(
        {
          org_id: req.auth.orgId,
          type: req.body.type,
          config: req.body.config,
          secret_ref: req.body.secret_ref,
          status: req.body.status,
        },
        { onConflict: "org_id,type" }
      )
      .select("*")
      .single();
    if (error) throw error;
    res.json({ integration: { ...data, config: scrubSecrets(data.config) } });
  })
);

router.post(
  "/:type/test",
  requireRole("owner", "admin"),
  validate({ params: z.object({ type: z.string() }) }),
  asyncHandler(async (req, res) => {
    const { data: row, error } = await req.supabase
      .from("integrations")
      .select("type, config")
      .eq("type", req.params.type)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw NotFound("Integration not configured");
    const provider = buildProvider(req.params.type, req.auth.orgId, row.config);
    const result = await provider.testConnection();
    res.json({ result });
  })
);

router.delete(
  "/:type",
  requireRole("owner", "admin"),
  validate({ params: z.object({ type: z.string() }) }),
  asyncHandler(async (req, res) => {
    const { error } = await req.supabase
      .from("integrations")
      .delete()
      .eq("type", req.params.type);
    if (error) throw error;
    res.status(204).end();
  })
);

function scrubSecrets(config) {
  if (!config || typeof config !== "object") return config;
  const out = {};
  for (const [k, v] of Object.entries(config)) {
    if (/(token|secret|key|password)/i.test(k)) out[k] = "[REDACTED]";
    else out[k] = v;
  }
  return out;
}

module.exports = router;
