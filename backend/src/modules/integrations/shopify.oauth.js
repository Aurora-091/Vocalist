const logger = require("../../config/logger");
const { requireAdmin } = require("../../config/supabase");

async function handleInstall(req, res) {
  const { shop, org_id } = req.query;
  if (!shop) {
    return res.status(400).json({ error: "Missing shop parameter" });
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const scopes = "read_orders,read_customers,read_checkouts,read_products,write_checkouts";
  const redirectUri = `${process.env.BACKEND_URL}/v1/integrations/shopify/callback`;
  const state = org_id || "";

  const authorizeUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
  res.redirect(authorizeUrl);
}

async function handleCallback(req, res) {
  const { code, shop, state } = req.query;
  if (!code || !shop) {
    return res.status(400).json({ error: "Missing code or shop parameter" });
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  try {
    const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    if (!response.ok) {
      throw new Error(`Shopify access token request failed: ${response.status}`);
    }

    const data = await response.json();
    const { access_token, scope } = data;

    const admin = requireAdmin();
    const orgId = state;
    if (orgId) {
      await admin.from("integrations").upsert(
        {
          org_id: orgId,
          type: "shopify",
          status: "active",
          config: {
            shop_domain: shop,
            access_token,
            scopes: scope,
            installed_at: new Date().toISOString(),
          },
        },
        { onConflict: "org_id,type" }
      );
    }

    res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}/integrations?status=success`);
  } catch (err) {
    logger.error({ err }, "Shopify OAuth callback failed");
    res.status(500).json({ error: err.message });
  }
}

async function handleDisconnect(req, res) {
  const admin = requireAdmin();
  const orgId = req.auth.orgId;
  try {
    const { error } = await admin
      .from("integrations")
      .delete()
      .eq("org_id", orgId)
      .eq("type", "shopify");

    if (error) throw error;
    res.status(200).json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Shopify disconnect failed");
    res.status(500).json({ error: err.message });
  }
}

module.exports = { handleInstall, handleCallback, handleDisconnect };
