const express = require("express");
const { z } = require("zod");
const asyncHandler = require("../../utils/asyncHandler");
const { validate } = require("../../middleware/validation.middleware");
const { requireAuth, requireOrg, requireRole } = require("../../middleware/auth.middleware");
const { NotFound } = require("../../utils/errors");
const { buildProvider, listProviderNames } = require("./integration.service");

const { verifyInternalSecret, handleConnected, handleUninstalled, handleDisconnect } = require("./shopify.oauth");

const router = express.Router();

router.post("/shopify/connected", verifyInternalSecret, asyncHandler(handleConnected));
router.post("/shopify/uninstalled", verifyInternalSecret, asyncHandler(handleUninstalled));
router.delete("/shopify/disconnect", requireAuth, requireOrg, asyncHandler(handleDisconnect));

router.post("/shopify/webhooks/checkouts", verifyInternalSecret, asyncHandler(async (req, res) => {
  const { shop, topic, body } = req.body;
  if (!shop || !topic) return res.status(400).json({ error: "Missing shop or topic" });

  const admin = require("../../config/supabase").requireAdmin();
  const { data: integration } = await admin
    .from("integrations")
    .select("org_id, config")
    .eq("type", "shopify")
    .eq("config->>shop_domain", shop)
    .maybeSingle();

  if (!integration) {
    return res.status(404).json({ error: "Integration not found" });
  }

  const provider = buildProvider("shopify", integration.org_id, integration.config);
  await provider.webhook({ topic, body });
  
  res.json({ ok: true });
}));

router.use(requireAuth, requireOrg);

router.get("/shopify/install", asyncHandler(async (req, res) => {
  const shop = req.query.shop;
  if (!shop) return res.status(400).json({ error: "Missing shop parameter" });
  
  // Basic validation for myshopify.com domain
  const shopRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
  if (!shopRegex.test(shop)) {
    return res.status(400).json({ error: "Invalid shop domain. Must end with .myshopify.com" });
  }

  const env = require("../../config/env");
  const installUrl = new URL(env.WEEBERSH_INSTALL_URL);
  installUrl.searchParams.set("shop", shop);
  installUrl.searchParams.set("org_id", req.auth.orgId);
  
  res.json({ url: installUrl.toString() });
}));

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

const { vaultifyConfig } = require("../../utils/credential.helper");

router.put(
  "/",
  requireRole("owner", "admin"),
  validate({ body: upsertSchema }),
  asyncHandler(async (req, res) => {
    const safeConfig = await vaultifyConfig(req.body.type, req.body.config, req.auth.orgId);
    const { data, error } = await req.supabase
      .from("integrations")
      .upsert(
        {
          org_id: req.auth.orgId,
          type: req.body.type,
          config: safeConfig,
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
      .eq("org_id", req.auth.orgId)
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
      .eq("type", req.params.type)
      .eq("org_id", req.auth.orgId);
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
