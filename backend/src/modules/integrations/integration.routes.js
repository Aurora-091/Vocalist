const express = require("express");
const { z } = require("zod");
const asyncHandler = require("../../utils/asyncHandler");
const { validate } = require("../../middleware/validation.middleware");
const { requireAuth, requireOrg, requireRole } = require("../../middleware/auth.middleware");
const { NotFound } = require("../../utils/errors");
const { buildProvider, listProviderNames } = require("./integration.service");

const { handleDisconnect } = require("./shopify.oauth");

const router = express.Router();

router.delete("/shopify/disconnect", requireAuth, requireOrg, asyncHandler(handleDisconnect));

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
  type: z.enum([
    "shopify", "hubspot", "pipedrive", "freshsales", "cliniko", "jane_app",
    "calcom", "google_cal", "google_sheets", "whatsapp",
    "zoho_crm", "salesforce", "drchrono",
    "twilio", "plivo", "exotel", "vobiz",
    "outlook_cal", "zapier",
  ]),
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

router.post(
  "/shopify/sync-contacts",
  requireRole("owner", "admin"),
  asyncHandler(async (req, res) => {
    const { data: row, error } = await req.supabase
      .from("integrations")
      .select("type, config, status")
      .eq("type", "shopify")
      .eq("org_id", req.auth.orgId)
      .maybeSingle();
    if (error) throw error;
    if (!row || row.status !== "active") throw NotFound("Shopify integration not connected");
    const provider = buildProvider("shopify", req.auth.orgId, row.config);
    const result = await provider.syncContacts();
    res.json(result);
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

// ─── Playbooks CRUD ──────────────────────────────────────────────────────────

const PLAYBOOK_KEYS = ["cart_recovery", "cod_confirm", "feedback"];

const playbookSchema = z.object({
  enabled: z.boolean().optional(),
  agent_id: z.string().uuid().nullable().optional(),
  delay_minutes: z.number().int().min(1).max(43200).optional(),
  max_attempts: z.number().int().min(1).max(5).optional(),
  call_hours_start: z.number().int().min(0).max(23).optional(),
  call_hours_end: z.number().int().min(1).max(24).optional(),
  timezone: z.string().max(80).optional(),
  config: z.record(z.string(), z.any()).optional(),
});

router.get(
  "/playbooks",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("playbooks")
      .select("*")
      .order("key", { ascending: true });
    if (error) throw error;
    res.json({ playbooks: data || [] });
  })
);

router.put(
  "/playbooks/:key",
  requireRole("owner", "admin"),
  validate({
    params: z.object({ key: z.enum(PLAYBOOK_KEYS) }),
    body: playbookSchema,
  }),
  asyncHandler(async (req, res) => {
    const { key } = req.params;
    const orgId = req.auth.orgId;
    const payload = { org_id: orgId, key, ...req.body };

    const { data, error } = await req.supabase
      .from("playbooks")
      .upsert(payload, { onConflict: "org_id,key" })
      .select("*")
      .single();
    if (error) throw error;
    res.json({ playbook: data });
  })
);

module.exports = router;
