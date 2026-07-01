const logger = require("../../config/logger");
const env = require("../../config/env");
const { requireAdmin } = require("../../config/supabase");

const { vaultifyConfig } = require("../../utils/credential.helper");

function verifyInternalSecret(req, res, next) {
  const secret = req.headers["x-weeber-secret"];
  if (!env.WEEBER_INTERNAL_SECRET || secret !== env.WEEBER_INTERNAL_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

async function handleConnected(req, res) {
  const { org_id, shop_domain, access_token, scopes } = req.body;
  if (!org_id || !shop_domain || !access_token) {
    return res.status(400).json({ error: "Missing required fields: org_id, shop_domain, access_token" });
  }

  let safeConfig;
  try {
    safeConfig = await vaultifyConfig("shopify", { access_token, shop_domain, scopes: scopes || "" }, org_id);
    safeConfig.installed_at = new Date().toISOString();
  } catch (err) {
    logger.error({ err: err.message, org_id }, "Failed to vaultify Shopify connection token");
    return res.status(500).json({ error: "Vault integration failed" });
  }

  const admin = requireAdmin();
  const { error } = await admin.from("integrations").upsert(
    {
      org_id,
      type: "shopify",
      status: "active",
      config: safeConfig,
    },
    { onConflict: "org_id,type" }
  );

  if (error) {
    logger.error({ error }, "Failed to upsert Shopify integration");
    return res.status(500).json({ error: "Database error" });
  }

  logger.info({ org_id, shop_domain }, "Shopify integration connected via weebersh");
  res.status(200).json({ ok: true });
}

async function handleUninstalled(req, res) {
  const { org_id } = req.body;
  if (!org_id) {
    return res.status(400).json({ error: "Missing required field: org_id" });
  }

  const admin = requireAdmin();
  const { error } = await admin
    .from("integrations")
    .update({ status: "inactive" })
    .eq("type", "shopify")
    .eq("org_id", org_id);
  if (error) {
    logger.error({ error }, "Failed to mark Shopify integration inactive");
    return res.status(500).json({ error: "Database error" });
  }

  logger.info({ org_id, shop_domain }, "Shopify integration uninstalled");
  res.status(200).json({ ok: true });
}

async function handleDisconnect(req, res) {
  const admin = requireAdmin();
  const orgId = req.auth.orgId;
  const { error } = await admin
    .from("integrations")
    .delete()
    .eq("org_id", orgId)
    .eq("type", "shopify");

  if (error) {
    logger.error({ error }, "Shopify disconnect failed");
    return res.status(500).json({ error: error.message });
  }
  res.status(200).json({ ok: true });
}

module.exports = { verifyInternalSecret, handleConnected, handleUninstalled, handleDisconnect };
