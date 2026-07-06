const express = require("express");
const { requireAdmin } = require("../../config/supabase");
const { verifyInternalSecret } = require("./shopify.oauth");
const logger = require("../../config/logger");
const asyncHandler = require("../../utils/asyncHandler");
const { tryE164 } = require("../../utils/phone");
const { clampToQuietHours } = require("../../utils/scheduling");

const router = express.Router();
router.use(express.json({ limit: "1mb" }));
router.use(verifyInternalSecret);

// ─── Helpers ────────────────────────────────────────────────────────────────

async function resolveOrgByShop(admin, shop) {
  const { data } = await admin
    .from("integrations")
    .select("org_id, config")
    .eq("type", "shopify")
    .eq("status", "active")
    .filter("config->>shop_domain", "eq", shop)
    .maybeSingle();
  return data;
}

function isCodGateway(gatewayNames) {
  if (!Array.isArray(gatewayNames)) return false;
  return gatewayNames.some((g) => /cash.on.delivery|cod/i.test(g));
}

// ─── 1. POST /connected ─────────────────────────────────────────────────────

router.post(
  "/connected",
  asyncHandler(async (req, res) => {
    const {
      org_id, shop, access_token, scopes,
      plan_name, currency, country_code, timezone,
      contact_email, shop_name, shop_domain,
      product_count, order_count_30d, checkout_count, customer_count,
    } = req.body;

    const resolvedShop = shop_domain || shop;
    if (!org_id || !resolvedShop || !access_token) {
      return res.status(400).json({ error: "Missing required fields: org_id, shop/shop_domain, access_token" });
    }

    const admin = requireAdmin();
    const { vaultifyConfig } = require("../../utils/credential.helper");

    let safeConfig;
    try {
      safeConfig = await vaultifyConfig("shopify", { access_token, shop_domain: resolvedShop, scopes: scopes || "" }, org_id);
    } catch (err) {
      logger.error({ err: err.message, org_id }, "Failed to vaultify Shopify token");
      return res.status(500).json({ error: "Vault integration failed" });
    }

    safeConfig.installed_at = new Date().toISOString();
    safeConfig.country_code = country_code || "IN";
    safeConfig.timezone = timezone || "Asia/Kolkata";
    safeConfig.currency = currency || "INR";
    safeConfig.plan_name = plan_name || null;
    safeConfig.contact_email = contact_email || null;
    safeConfig.shop_name = shop_name || null;
    safeConfig.stats = {
      product_count: product_count || 0,
      order_count_30d: order_count_30d || 0,
      checkout_count: checkout_count || 0,
      customer_count: customer_count || 0,
    };

    const { error } = await admin.from("integrations").upsert(
      { org_id, type: "shopify", status: "active", config: safeConfig },
      { onConflict: "org_id,type" }
    );

    if (error) {
      logger.error({ error }, "Failed to upsert Shopify integration");
      return res.status(500).json({ error: "Database error" });
    }

    logger.info({ org_id, shop: resolvedShop }, "Shopify integration connected");
    res.status(200).json({ ok: true });
  })
);

// ─── 2. POST /webhooks/checkouts ─────────────────────────────────────────────
// Handles both checkouts/create and checkouts/update (topic-aware per CONTRACT)

router.post(
  "/webhooks/checkouts",
  asyncHandler(async (req, res) => {
    const { shop, topic, body } = req.body;
    if (!shop || !body) {
      return res.status(400).json({ error: "Missing shop or body" });
    }

    const admin = requireAdmin();
    const integration = await resolveOrgByShop(admin, shop);
    if (!integration) {
      return res.status(200).json({ ok: true, handled: false, reason: "shop_not_found" });
    }

    const orgId = integration.org_id;
    const cc = integration.config?.country_code || "IN";
    const checkoutToken = body.token;
    const checkoutId = String(body.id || checkoutToken);

    const phone = body.phone || body.billing_address?.phone;
    if (!phone) {
      return res.status(200).json({ ok: true, scheduled: false, reason: "no_phone" });
    }

    const e164 = tryE164(phone, cc);
    if (!e164) {
      logger.info({ checkoutId, phone, cc }, "Checkout: invalid phone");
      return res.status(200).json({ ok: true, scheduled: false, reason: "invalid_phone" });
    }

    // checkouts/update: refresh metadata on existing pending row
    if (topic === "checkouts/update") {
      const { data: existing } = await admin
        .from("scheduled_calls")
        .select("id, metadata")
        .eq("org_id", orgId)
        .eq("checkout_token", checkoutToken)
        .eq("status", "pending")
        .maybeSingle();

      if (existing) {
        const updates = { metadata: { ...existing.metadata } };
        if (body.total_price != null) updates.metadata.cart_total = body.total_price;
        if (body.line_items) updates.metadata.cart_items = body.line_items.map((i) => i.title).join(", ");
        updates.phone = e164;
        // Reset scheduled_at — customer is still editing
        const { data: playbook } = await admin
          .from("playbooks")
          .select("delay_minutes, call_hours_start, call_hours_end, timezone")
          .eq("org_id", orgId)
          .eq("key", "cart_recovery")
          .maybeSingle();
        const { data: integ } = await admin
          .from("integrations")
          .select("call_delay_minutes")
          .eq("org_id", orgId)
          .eq("type", "shopify")
          .maybeSingle();
        const delayMinutes = playbook?.delay_minutes || integ?.call_delay_minutes || 30;
        const rawAt = new Date(Date.now() + delayMinutes * 60 * 1000);
        const clampedAt = clampToQuietHours(rawAt, {
          startHour: playbook?.call_hours_start || 9,
          endHour: playbook?.call_hours_end || 21,
          timezone: playbook?.timezone || integration.config?.timezone || "Asia/Kolkata",
        });
        updates.scheduled_at = clampedAt.toISOString();

        await admin.from("scheduled_calls").update(updates).eq("id", existing.id);
        return res.status(200).json({ ok: true, updated: true, id: existing.id });
      }
      // No existing row — fall through to create
    }

    // Idempotency: dedupe by checkout_token
    if (checkoutToken) {
      const { data: dup } = await admin
        .from("scheduled_calls")
        .select("id")
        .eq("org_id", orgId)
        .eq("checkout_token", checkoutToken)
        .in("status", ["pending", "processing", "dispatched"])
        .maybeSingle();
      if (dup) {
        return res.status(200).json({ ok: true, scheduled: false, reason: "already_scheduled", id: dup.id });
      }
    }

    // Resolve playbook, fallback to integration config
    const { data: playbook } = await admin
      .from("playbooks")
      .select("agent_id, delay_minutes, max_attempts, call_hours_start, call_hours_end, timezone, enabled")
      .eq("org_id", orgId)
      .eq("key", "cart_recovery")
      .maybeSingle();

    if (playbook && !playbook.enabled) {
      return res.status(200).json({ ok: true, scheduled: false, reason: "playbook_disabled" });
    }

    const { data: integ } = await admin
      .from("integrations")
      .select("agent_id, call_delay_minutes")
      .eq("org_id", orgId)
      .eq("type", "shopify")
      .eq("status", "active")
      .maybeSingle();

    const agentId = playbook?.agent_id || integ?.agent_id;
    if (!agentId) {
      return res.status(200).json({ ok: true, scheduled: false, reason: "no_agent" });
    }

    // Upsert contact
    const customerName = [body.billing_address?.first_name, body.billing_address?.last_name].filter(Boolean).join(" ") || "Customer";
    await admin.from("contacts").upsert(
      { org_id: orgId, e164, email: body.email || null, name: customerName, source: "shopify" },
      { onConflict: "org_id,e164", ignoreDuplicates: false }
    );

    const delayMinutes = playbook?.delay_minutes || integ?.call_delay_minutes || 30;
    const rawScheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000);
    const clampedAt = clampToQuietHours(rawScheduledAt, {
      startHour: playbook?.call_hours_start || 9,
      endHour: playbook?.call_hours_end || 21,
      timezone: playbook?.timezone || integration.config?.timezone || "Asia/Kolkata",
    });
    const scheduledAt = clampedAt.toISOString();

    const { data: inserted, error: insertErr } = await admin
      .from("scheduled_calls")
      .insert({
        org_id: orgId,
        agent_id: agentId,
        phone: e164,
        checkout_id: checkoutId,
        checkout_token: checkoutToken || null,
        scheduled_at: scheduledAt,
        status: "pending",
        attempt: 1,
        playbook_key: "cart_recovery",
        metadata: {
          customer_name: customerName,
          cart_total: body.total_price || null,
          cart_currency: integration.config?.currency || "INR",
          cart_items: (body.line_items || []).map((i) => i.title).join(", "),
          recovery_url: body.abandoned_checkout_url || null,
          email: body.email || null,
          country_code: cc,
        },
      })
      .select("id")
      .single();

    if (insertErr) {
      logger.error({ err: insertErr, checkoutToken }, "Failed to schedule cart recovery call");
      return res.status(500).json({ error: "Failed to schedule call" });
    }

    logger.info({ checkoutToken, phone: e164, scheduled_at: scheduledAt }, "Scheduled cart recovery");
    res.status(200).json({ ok: true, scheduled: true, id: inserted.id, scheduled_at: scheduledAt });
  })
);

// ─── 3. POST /orders/create ──────────────────────────────────────────────────

router.post(
  "/orders/create",
  asyncHandler(async (req, res) => {
    const {
      shop, order_id, order_number, checkout_token,
      email, phone, total_price, currency, financial_status,
      payment_gateway_names, customer_name,
      shipping_address, line_items, created_at,
    } = req.body;

    if (!shop || !order_id) {
      return res.status(400).json({ error: "Missing shop or order_id" });
    }

    const admin = requireAdmin();
    const integration = await resolveOrgByShop(admin, shop);
    if (!integration) {
      return res.status(200).json({ ok: true, handled: false, reason: "shop_not_found" });
    }

    const orgId = integration.org_id;
    const cc = integration.config?.country_code || "IN";

    // Idempotency: already processed this order?
    const { data: existingOrder } = await admin
      .from("scheduled_calls")
      .select("id")
      .eq("org_id", orgId)
      .eq("order_id", String(order_id))
      .eq("playbook_key", "cod_confirm")
      .maybeSingle();

    // (a) Cancel pending recovery calls matching checkout_token OR phone
    const cancelledIds = [];
    if (checkout_token) {
      const { data: cancelled } = await admin
        .from("scheduled_calls")
        .update({ status: "cancelled", cancelled_reason: "converted", order_id: String(order_id) })
        .eq("org_id", orgId)
        .eq("checkout_token", checkout_token)
        .in("status", ["pending", "processing"])
        .select("id");
      if (cancelled?.length) cancelledIds.push(...cancelled.map((r) => r.id));
    }

    const resolvedPhone = phone || shipping_address?.phone;
    const e164 = resolvedPhone ? tryE164(resolvedPhone, cc) : null;

    if (e164 && !cancelledIds.length) {
      const { data: phoneCancelled } = await admin
        .from("scheduled_calls")
        .update({ status: "cancelled", cancelled_reason: "converted", order_id: String(order_id) })
        .eq("org_id", orgId)
        .eq("phone", e164)
        .eq("playbook_key", "cart_recovery")
        .in("status", ["pending", "processing"])
        .select("id");
      if (phoneCancelled?.length) cancelledIds.push(...phoneCancelled.map((r) => r.id));
    }

    if (cancelledIds.length) {
      logger.info({ order_id, cancelled: cancelledIds.length }, "Cancelled recovery calls on conversion");
    }

    // (b) Attribution: completed/dispatched call to same checkout_token or phone in last 72h
    const lookbackAt = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    let attributedCallId = null;

    if (checkout_token) {
      const { data: attr } = await admin
        .from("scheduled_calls")
        .select("id")
        .eq("org_id", orgId)
        .eq("checkout_token", checkout_token)
        .in("status", ["dispatched", "completed", "cancelled"])
        .gte("dispatched_at", lookbackAt)
        .limit(1)
        .maybeSingle();
      if (attr) attributedCallId = attr.id;
    }

    if (!attributedCallId && e164) {
      const { data: attr } = await admin
        .from("scheduled_calls")
        .select("id")
        .eq("org_id", orgId)
        .eq("phone", e164)
        .eq("playbook_key", "cart_recovery")
        .in("status", ["dispatched", "completed"])
        .gte("dispatched_at", lookbackAt)
        .limit(1)
        .maybeSingle();
      if (attr) attributedCallId = attr.id;
    }

    if (attributedCallId && total_price) {
      await admin
        .from("scheduled_calls")
        .update({
          outcome: "recovered",
          recovered_order_id: String(order_id),
          recovered_value: parseFloat(total_price),
          recovered_currency: currency || "INR",
        })
        .eq("id", attributedCallId);
      logger.info({ order_id, call_id: attributedCallId, value: total_price }, "Revenue attributed");
    }

    // (c) COD confirmation: schedule if gateway is COD or financial_status is pending per playbook
    const isCOD = isCodGateway(payment_gateway_names) || financial_status === "pending";

    if (isCOD && e164 && !existingOrder) {
      const { data: codPlaybook } = await admin
        .from("playbooks")
        .select("agent_id, delay_minutes, enabled, call_hours_start, call_hours_end, timezone")
        .eq("org_id", orgId)
        .eq("key", "cod_confirm")
        .maybeSingle();

      const { data: integ } = await admin
        .from("integrations")
        .select("agent_id, config")
        .eq("org_id", orgId)
        .eq("type", "shopify")
        .eq("status", "active")
        .maybeSingle();

      const codAgentId = codPlaybook?.agent_id || integ?.agent_id;
      const codEnabled = codPlaybook ? codPlaybook.enabled !== false : true;

      if (codAgentId && codEnabled) {
        const delayMinutes = codPlaybook?.delay_minutes || integ?.config?.cod_delay_minutes || 5;
        const rawCodAt = new Date(Date.now() + delayMinutes * 60 * 1000);
        const clampedCodAt = clampToQuietHours(rawCodAt, {
          startHour: codPlaybook?.call_hours_start || 9,
          endHour: codPlaybook?.call_hours_end || 21,
          timezone: codPlaybook?.timezone || integration.config?.timezone || "Asia/Kolkata",
        });
        const scheduledAt = clampedCodAt.toISOString();

        await admin.from("scheduled_calls").insert({
          org_id: orgId,
          agent_id: codAgentId,
          phone: e164,
          order_id: String(order_id),
          scheduled_at: scheduledAt,
          status: "pending",
          attempt: 1,
          playbook_key: "cod_confirm",
          metadata: {
            customer_name: customer_name || "Customer",
            order_number: order_number || null,
            order_total: total_price || null,
            currency: currency || "INR",
            line_items: line_items || [],
            email: email || null,
            country_code: cc,
          },
        });
        logger.info({ order_id, phone: e164 }, "Scheduled COD confirmation call");
      }
    }

    res.status(200).json({ ok: true });
  })
);

// ─── 4. POST /orders/fulfilled ───────────────────────────────────────────────

router.post(
  "/orders/fulfilled",
  asyncHandler(async (req, res) => {
    const { shop, order_id, order_number, phone, email, customer_name, line_items, fulfilled_at } = req.body;

    if (!shop || !order_id) {
      return res.status(400).json({ error: "Missing shop or order_id" });
    }

    const admin = requireAdmin();
    const integration = await resolveOrgByShop(admin, shop);
    if (!integration) {
      return res.status(200).json({ ok: true, handled: false, reason: "shop_not_found" });
    }

    const orgId = integration.org_id;
    const cc = integration.config?.country_code || "IN";
    const resolvedPhone = phone;
    const e164 = resolvedPhone ? tryE164(resolvedPhone, cc) : null;

    if (!e164) {
      return res.status(200).json({ ok: true, scheduled: false, reason: "no_phone" });
    }

    // Idempotency: already scheduled feedback for this order?
    const { data: existing } = await admin
      .from("scheduled_calls")
      .select("id")
      .eq("org_id", orgId)
      .eq("order_id", String(order_id))
      .eq("playbook_key", "feedback")
      .maybeSingle();

    if (existing) {
      return res.status(200).json({ ok: true, scheduled: false, reason: "already_scheduled" });
    }

    // Resolve feedback playbook
    const { data: fbPlaybook } = await admin
      .from("playbooks")
      .select("agent_id, delay_minutes, enabled, config, call_hours_start, call_hours_end, timezone")
      .eq("org_id", orgId)
      .eq("key", "feedback")
      .maybeSingle();

    if (fbPlaybook && !fbPlaybook.enabled) {
      return res.status(200).json({ ok: true, scheduled: false, reason: "playbook_disabled" });
    }

    const { data: integ } = await admin
      .from("integrations")
      .select("agent_id")
      .eq("org_id", orgId)
      .eq("type", "shopify")
      .eq("status", "active")
      .maybeSingle();

    const feedbackAgentId = fbPlaybook?.agent_id || integ?.agent_id;
    if (!feedbackAgentId) {
      return res.status(200).json({ ok: true, scheduled: false, reason: "no_agent" });
    }

    // Delay: playbook delay_minutes (designed as delay_days * 1440 in config), default 2 days
    const delayDays = fbPlaybook?.config?.delay_days || 2;
    const delayMinutes = fbPlaybook?.delay_minutes || delayDays * 1440;
    const rawFbAt = new Date(Date.now() + delayMinutes * 60 * 1000);
    const clampedFbAt = clampToQuietHours(rawFbAt, {
      startHour: fbPlaybook?.call_hours_start || 9,
      endHour: fbPlaybook?.call_hours_end || 21,
      timezone: fbPlaybook?.timezone || integration.config?.timezone || "Asia/Kolkata",
    });
    const scheduledAt = clampedFbAt.toISOString();

    await admin.from("scheduled_calls").insert({
      org_id: orgId,
      agent_id: feedbackAgentId,
      phone: e164,
      order_id: String(order_id),
      scheduled_at: scheduledAt,
      status: "pending",
      attempt: 1,
      playbook_key: "feedback",
      metadata: {
        customer_name: customer_name || "Customer",
        order_number: order_number || null,
        line_items: line_items || [],
        email: email || null,
        fulfilled_at: fulfilled_at || new Date().toISOString(),
        country_code: cc,
      },
    });

    logger.info({ order_id, phone: e164, scheduled_at: scheduledAt }, "Scheduled feedback call");
    res.status(200).json({ ok: true, scheduled: true, scheduled_at: scheduledAt });
  })
);

// ─── 5. POST /webhooks/customers ─────────────────────────────────────────────

router.post(
  "/webhooks/customers",
  asyncHandler(async (req, res) => {
    const { shop, topic, body } = req.body;
    if (!shop || !body) {
      return res.status(400).json({ error: "Missing shop or body" });
    }

    const admin = requireAdmin();
    const integration = await resolveOrgByShop(admin, shop);
    if (!integration) {
      return res.status(200).json({ ok: true, handled: false, reason: "shop_not_found" });
    }

    const orgId = integration.org_id;
    const cc = integration.config?.country_code || "IN";
    const customer = body;

    if (!customer.phone) {
      return res.status(200).json({ ok: true, handled: false, reason: "no_phone" });
    }

    const e164 = tryE164(customer.phone, cc);
    if (!e164) {
      return res.status(200).json({ ok: true, handled: false, reason: "invalid_phone" });
    }

    const consentStatus = customer.marketing_consent?.state === "subscribed" ? "granted" : "none";

    await admin.from("contacts").upsert(
      {
        org_id: orgId,
        e164,
        name: [customer.first_name, customer.last_name].filter(Boolean).join(" ") || null,
        email: customer.email || null,
        crm_ref: `shopify_${customer.id}`,
        source: "shopify",
        consent_status: consentStatus,
        fields: { shopify_id: customer.id, tags: customer.tags, orders_count: customer.orders_count },
      },
      { onConflict: "org_id,e164", ignoreDuplicates: false }
    );

    logger.info({ orgId, customer_id: customer.id, topic }, "Customer upserted from webhook");
    res.status(200).json({ ok: true });
  })
);

// ─── 6. POST /uninstalled ────────────────────────────────────────────────────

router.post(
  "/uninstalled",
  asyncHandler(async (req, res) => {
    const { shop } = req.body;
    if (!shop) {
      return res.status(400).json({ error: "Missing shop" });
    }

    const admin = requireAdmin();
    const integration = await resolveOrgByShop(admin, shop);

    // Mark integration inactive
    await admin
      .from("integrations")
      .update({ status: "inactive" })
      .eq("type", "shopify")
      .filter("config->>shop_domain", "eq", shop);

    if (integration) {
      const orgId = integration.org_id;

      // Cancel ALL pending shopify-playbook scheduled calls
      const { error: cancelErr } = await admin
        .from("scheduled_calls")
        .update({ status: "cancelled", cancelled_reason: "app_uninstalled" })
        .eq("org_id", orgId)
        .in("status", ["pending", "processing"]);
      if (cancelErr) {
        logger.error({ err: cancelErr }, "Failed to cancel calls on uninstall");
      }

      // Purge stored access token from config
      const scrubbed = { ...(integration.config || {}), access_token: null };
      await admin
        .from("integrations")
        .update({ config: scrubbed })
        .eq("org_id", orgId)
        .eq("type", "shopify");
    }

    logger.info({ shop }, "Shopify app uninstalled");
    res.status(200).json({ ok: true });
  })
);

// ─── 7. POST /customers/redact ───────────────────────────────────────────────

router.post(
  "/customers/redact",
  asyncHandler(async (req, res) => {
    const { shop, customer } = req.body;
    if (!shop) {
      return res.status(400).json({ error: "Missing shop" });
    }

    const admin = requireAdmin();
    const integration = await resolveOrgByShop(admin, shop);
    if (!integration) {
      return res.status(200).json({ ok: true });
    }

    const orgId = integration.org_id;

    if (customer?.phone) {
      const cc = integration.config?.country_code || "IN";
      const e164 = tryE164(customer.phone, cc);
      if (e164) {
        await admin.from("contacts").delete().eq("org_id", orgId).eq("e164", e164);
        // Anonymize call metadata referencing this phone
        await admin
          .from("scheduled_calls")
          .update({ phone: "REDACTED", metadata: {} })
          .eq("org_id", orgId)
          .eq("phone", e164);
      }
    }

    if (customer?.email) {
      await admin.from("contacts").delete().eq("org_id", orgId).eq("email", customer.email);
    }

    logger.info({ shop, customer_id: customer?.id }, "Customer data redacted");
    res.status(200).json({ ok: true });
  })
);

// ─── 7b. POST /shop/redact ───────────────────────────────────────────────────

router.post(
  "/shop/redact",
  asyncHandler(async (req, res) => {
    const { shop } = req.body;
    if (!shop) {
      return res.status(400).json({ error: "Missing shop" });
    }

    const admin = requireAdmin();
    const integration = await resolveOrgByShop(admin, shop);
    if (!integration) {
      return res.status(200).json({ ok: true });
    }

    const orgId = integration.org_id;

    // Delete all contacts sourced from this Shopify store
    await admin.from("contacts").delete().eq("org_id", orgId).eq("source", "shopify");

    // Anonymize scheduled_calls metadata
    await admin
      .from("scheduled_calls")
      .update({ metadata: {}, phone: "REDACTED" })
      .eq("org_id", orgId)
      .in("playbook_key", ["cart_recovery", "cod_confirm", "feedback"]);

    // Remove integration record
    await admin.from("integrations").delete().eq("org_id", orgId).eq("type", "shopify");

    logger.info({ shop }, "Shop data redacted");
    res.status(200).json({ ok: true });
  })
);

// ─── Status (internal health/debug) ─────────────────────────────────────────

router.get(
  "/status",
  asyncHandler(async (req, res) => {
    const org_id = req.query.org_id;
    if (!org_id) return res.status(400).json({ error: "org_id required" });

    const admin = requireAdmin();
    const { data: integ } = await admin
      .from("integrations")
      .select("id, status, config, agent_id, call_delay_minutes, created_at")
      .eq("org_id", org_id)
      .eq("type", "shopify")
      .maybeSingle();

    if (!integ) {
      return res.status(200).json({ connected: false });
    }

    res.status(200).json({
      connected: integ.status === "active",
      status: integ.status,
      shop_domain: integ.config?.shop_domain,
      agent_id: integ.agent_id,
      call_delay_minutes: integ.call_delay_minutes,
      connected_at: integ.config?.installed_at || integ.created_at,
    });
  })
);

module.exports = router;
