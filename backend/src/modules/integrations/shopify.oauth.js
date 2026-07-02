const logger = require("../../config/logger");
const env = require("../../config/env");
const { requireAdmin, anonClient } = require("../../config/supabase");

const { vaultifyConfig } = require("../../utils/credential.helper");

function verifyInternalSecret(req, res, next) {
  const secret = req.headers["x-weeber-secret"];
  if (!env.WEEBER_INTERNAL_SECRET || secret !== env.WEEBER_INTERNAL_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

async function handleConnected(req, res) {
  const { org_id, shop_domain, access_token, scopes, contact_email, shop_name } = req.body;
  if (!shop_domain || !access_token) {
    return res.status(400).json({ error: "Missing required fields: shop_domain, access_token" });
  }

  const admin = requireAdmin();
  let targetOrgId = org_id;

  if (!targetOrgId) {
    // Try to find if integration already exists for this shop
    const { data: existingInt } = await admin
      .from("integrations")
      .select("org_id")
      .eq("type", "shopify")
      .eq("config->>shop_domain", shop_domain)
      .maybeSingle();

    if (existingInt) {
      targetOrgId = existingInt.org_id;
    } else {
      // Auto-provision user and org
      const email = contact_email || `admin@${shop_domain}`;
      const { data: existingUser } = await admin
        .from("users")
        .select("id, org_id")
        .eq("email", email)
        .maybeSingle();

      if (existingUser) {
        targetOrgId = existingUser.org_id;
      } else {
        const { data: orgRow, error: orgErr } = await admin
          .from("orgs")
          .insert({ name: "", plan_id: "starter" })
          .select("id")
          .single();

        if (orgErr) {
          logger.error({ err: orgErr, shop_domain }, "Failed to auto-provision org");
          return res.status(500).json({ error: "Failed to create organization" });
        }
        targetOrgId = orgRow.id;

        const password = require("crypto").randomBytes(16).toString("hex");
        const { data: created, error: signErr } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          app_metadata: { org_id: targetOrgId, role: "owner" },
        });

        if (signErr) {
          logger.error({ err: signErr, email }, "Failed to auto-provision user");
          await admin.from("orgs").delete().eq("id", targetOrgId).catch(() => {});
          return res.status(500).json({ error: "Failed to create user account" });
        }

        const { error: linkErr } = await admin
          .from("users")
          .insert({
            id: created.user.id,
            org_id: targetOrgId,
            email,
            role: "owner",
            display_name: shop_name || email.split("@")[0],
          });

        if (linkErr) {
          logger.error({ err: linkErr, email }, "Failed to link auto-provisioned user");
        }

        try {
          await admin.from("onboarding_state").insert({
            org_id: targetOrgId,
            steps: { pick_vertical: false, connect_tools: false, add_knowledge: false, create_agent: false, get_number: false, test_and_golive: false },
          });
        } catch (e) {}

        await anonClient.auth.resetPasswordForEmail(email, {
          redirectTo: `${env.FRONTEND_URL}/reset-password`,
        }).catch(e => logger.error({ err: e, email }, "Failed to generate recovery link"));
      }
    }
  }

  let safeConfig;
  try {
    safeConfig = await vaultifyConfig("shopify", { access_token, shop_domain, scopes: scopes || "" }, targetOrgId);
    safeConfig.installed_at = new Date().toISOString();
  } catch (err) {
    logger.error({ err: err.message, org_id: targetOrgId }, "Failed to vaultify Shopify connection token");
    return res.status(500).json({ error: "Vault integration failed" });
  }

  const { error } = await admin.from("integrations").upsert(
    {
      org_id: targetOrgId,
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

  logger.info({ org_id: targetOrgId, shop_domain }, "Shopify integration connected via weebersh");
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

  logger.info({ org_id, shop_domain: req.body.shop_domain }, "Shopify integration uninstalled");
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
