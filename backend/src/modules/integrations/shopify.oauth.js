const logger = require("../../config/logger");
const env = require("../../config/env");
const { requireAdmin } = require("../../config/supabase");

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

  const admin = requireAdmin();
  const { error } = await admin.from("integrations").upsert(
    {
      org_id,
      type: "shopify",
      status: "active",
      config: {
        shop_domain,
        access_token,
        scopes: scopes || "",
        installed_at: new Date().toISOString(),
      },
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
  const { org_id, shop_domain } = req.body;
  if (!org_id && !shop_domain) {
    return res.status(400).json({ error: "Missing org_id or shop_domain" });
  }

  const admin = requireAdmin();
  let query = admin.from("integrations").update({ status: "inactive" }).eq("type", "shopify");

  if (org_id) {
    query = query.eq("org_id", org_id);
  } else {
    query = query.filter("config->>shop_domain", "eq", shop_domain);
  }

  const { error } = await query;
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
