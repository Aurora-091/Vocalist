const express = require("express");
const { requireAdmin } = require("../../config/supabase");
const { verifyInternalSecret } = require("./shopify.oauth");
const logger = require("../../config/logger");
const asyncHandler = require("../../utils/asyncHandler");
const { tryE164 } = require("../../utils/phone");

const router = express.Router();
router.use(express.json({ limit: "1mb" }));
router.use(verifyInternalSecret);

router.post(
  "/connected",
  asyncHandler(async (req, res) => {
    const { org_id, shop_domain, access_token, scopes } = req.body;
    if (!org_id || !shop_domain || !access_token) {
      return res.status(400).json({ error: "Missing required fields: org_id, shop_domain, access_token" });
    }

    const admin = requireAdmin();
    const { vaultifyConfig } = require("../../utils/credential.helper");
    let safeConfig;
    try {
      safeConfig = await vaultifyConfig("shopify", { access_token, shop_domain, scopes: scopes || "" }, org_id);
      safeConfig.installed_at = new Date().toISOString();
    } catch (err) {
      logger.error({ err: err.message, org_id }, "Failed to vaultify Shopify connection token in shopify.internal.routes.js");
      return res.status(500).json({ error: "Vault integration failed" });
    }

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
  })
);

router.post(
  "/uninstalled",
  asyncHandler(async (req, res) => {
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

    // Cancel all pending scheduled calls for this org
    if (org_id) {
      const { error: cancelErr } = await admin
        .from("scheduled_calls")
        .update({ status: "cancelled", cancelled_reason: "app_uninstalled" })
        .eq("org_id", org_id)
        .in("status", ["pending", "processing"]);
      if (cancelErr) {
        logger.error({ err: cancelErr }, "Failed to cancel pending calls on uninstall");
      }
    }

    logger.info({ org_id, shop_domain }, "Shopify integration uninstalled");
    res.status(200).json({ ok: true });
  })
);

router.post(
  "/checkouts/abandoned",
  asyncHandler(async (req, res) => {
    const { org_id, checkout_id, checkout_token, phone, email, customer_name, cart_total, cart_currency, cart_items, recovery_url, country_code } = req.body;

    if (!org_id || !checkout_id) {
      return res.status(400).json({ error: "Missing required fields: org_id, checkout_id" });
    }
    if (!phone) {
      return res.status(200).json({ ok: true, scheduled: false, reason: "no_phone" });
    }

    const cc = country_code || "IN";
    const e164 = tryE164(phone, cc);
    if (!e164) {
      logger.info({ checkout_id, phone, cc }, "Shopify abandoned checkout: invalid phone");
      return res.status(200).json({ ok: true, scheduled: false, reason: "invalid_phone" });
    }

    const admin = requireAdmin();

    // Dedupe by checkout_id
    const { data: existing } = await admin
      .from("scheduled_calls")
      .select("id, status")
      .eq("checkout_id", String(checkout_id))
      .eq("org_id", org_id)
      .in("status", ["pending", "processing", "dispatched"])
      .maybeSingle();

    if (existing) {
      return res.status(200).json({ ok: true, scheduled: false, reason: "already_scheduled", id: existing.id });
    }

    // Resolve playbook first, fallback to integration config
    const { data: playbook } = await admin
      .from("playbooks")
      .select("agent_id, delay_minutes, max_attempts, call_hours_start, call_hours_end, timezone, enabled")
      .eq("org_id", org_id)
      .eq("key", "cart_recovery")
      .maybeSingle();

    // Get integration config as fallback
    const { data: integration } = await admin
      .from("integrations")
      .select("agent_id, call_delay_minutes, config")
      .eq("org_id", org_id)
      .eq("type", "shopify")
      .eq("status", "active")
      .maybeSingle();

    if (playbook && !playbook.enabled) {
      return res.status(200).json({ ok: true, scheduled: false, reason: "playbook_disabled" });
    }

    const agentId = playbook?.agent_id || integration?.agent_id;
    if (!agentId) {
      return res.status(200).json({ ok: true, scheduled: false, reason: "no_agent" });
    }

    // Upsert contact
    await admin.from("contacts").upsert(
      { org_id, e164, email: email || null, name: customer_name || null, source: "shopify" },
      { onConflict: "org_id,e164", ignoreDuplicates: false }
    );

    const delayMinutes = playbook?.delay_minutes || integration?.call_delay_minutes || 30;
    const scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();

    const { data: inserted, error: insertErr } = await admin
      .from("scheduled_calls")
      .insert({
        org_id,
        agent_id: agentId,
        phone: e164,
        checkout_id: String(checkout_id),
        checkout_token: checkout_token || null,
        scheduled_at: scheduledAt,
        status: "pending",
        attempt: 1,
        playbook_key: "cart_recovery",
        metadata: {
          customer_name: customer_name || "Customer",
          cart_total: cart_total || null,
          cart_currency: cart_currency || "INR",
          cart_items: cart_items || null,
          recovery_url: recovery_url || null,
          email: email || null,
          country_code: cc,
          call_hours_start: playbook?.call_hours_start ?? 9,
          call_hours_end: playbook?.call_hours_end ?? 21,
          timezone: playbook?.timezone || "Asia/Kolkata",
        },
      })
      .select("id")
      .single();

    if (insertErr) {
      logger.error({ err: insertErr, checkout_id }, "Failed to schedule abandoned cart call");
      return res.status(500).json({ error: "Failed to schedule call" });
    }

    logger.info({ checkout_id, phone: e164, scheduled_at: scheduledAt }, "Scheduled cart recovery call via S2S");
    res.status(200).json({ ok: true, scheduled: true, id: inserted.id, scheduled_at: scheduledAt });
  })
);

router.post(
  "/checkouts/updated",
  asyncHandler(async (req, res) => {
    const { org_id, checkout_id, checkout_token, phone, cart_total, cart_items, country_code } = req.body;

    if (!org_id || !checkout_id) {
      return res.status(400).json({ error: "Missing required fields: org_id, checkout_id" });
    }

    const admin = requireAdmin();

    // Find existing pending scheduled call for this checkout
    const { data: existing } = await admin
      .from("scheduled_calls")
      .select("id, metadata")
      .eq("checkout_id", String(checkout_id))
      .eq("org_id", org_id)
      .eq("status", "pending")
      .maybeSingle();

    if (!existing) {
      return res.status(200).json({ ok: true, updated: false, reason: "no_pending_call" });
    }

    const updates = { metadata: { ...existing.metadata } };
    if (cart_total != null) updates.metadata.cart_total = cart_total;
    if (cart_items != null) updates.metadata.cart_items = cart_items;
    if (checkout_token) updates.checkout_token = checkout_token;

    if (phone) {
      const cc = country_code || existing.metadata?.country_code || "IN";
      const e164 = tryE164(phone, cc);
      if (e164) updates.phone = e164;
    }

    const { error } = await admin
      .from("scheduled_calls")
      .update(updates)
      .eq("id", existing.id);

    if (error) {
      logger.error({ err: error, checkout_id }, "Failed to update scheduled call");
      return res.status(500).json({ error: "Update failed" });
    }

    res.status(200).json({ ok: true, updated: true, id: existing.id });
  })
);

router.post(
  "/orders/created",
  asyncHandler(async (req, res) => {
    const { org_id, order_id, checkout_token, phone, email, total_price, currency, payment_method, country_code } = req.body;

    if (!org_id || !order_id) {
      return res.status(400).json({ error: "Missing required fields: org_id, order_id" });
    }

    const admin = requireAdmin();

    // Cancel pending calls linked to this checkout (conversion happened)
    if (checkout_token) {
      const { data: cancelled } = await admin
        .from("scheduled_calls")
        .update({ status: "cancelled", cancelled_reason: "converted", order_id: String(order_id) })
        .eq("org_id", org_id)
        .eq("checkout_token", checkout_token)
        .in("status", ["pending", "processing"])
        .select("id, dispatched_at");

      if (cancelled?.length) {
        logger.info({ order_id, cancelled: cancelled.length }, "Cancelled pending calls on conversion");
      }

      // Revenue attribution: find any dispatched/completed call for this checkout within 72h
      const lookbackAt = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
      const { data: attributable } = await admin
        .from("scheduled_calls")
        .select("id")
        .eq("org_id", org_id)
        .eq("checkout_token", checkout_token)
        .in("status", ["dispatched", "completed", "cancelled"])
        .gte("dispatched_at", lookbackAt)
        .limit(1)
        .maybeSingle();

      if (attributable && total_price) {
        await admin
          .from("scheduled_calls")
          .update({
            outcome: "converted",
            recovered_order_id: String(order_id),
            recovered_value: parseFloat(total_price),
            recovered_currency: currency || "INR",
          })
          .eq("id", attributable.id);
        logger.info({ order_id, call_id: attributable.id, value: total_price }, "Revenue attributed");
      }
    }

    // COD confirmation flow: if payment method is COD, schedule a confirmation call
    const isCOD = payment_method === "cod" || payment_method === "cash_on_delivery";
    if (isCOD && phone) {
      const cc = country_code || "IN";
      const e164 = tryE164(phone, cc);

      if (e164) {
        // Idempotency: check if a COD call already exists for this order_id
        const { data: existingCOD } = await admin
          .from("scheduled_calls")
          .select("id")
          .eq("org_id", org_id)
          .eq("order_id", String(order_id))
          .maybeSingle();

        if (!existingCOD) {
          const { data: integration } = await admin
            .from("integrations")
            .select("agent_id, call_delay_minutes, config")
            .eq("org_id", org_id)
            .eq("type", "shopify")
            .eq("status", "active")
            .maybeSingle();

          if (integration?.agent_id) {
            const delayMinutes = integration.config?.cod_delay_minutes || 5;
            const scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();

            await admin.from("scheduled_calls").insert({
              org_id,
              agent_id: integration.agent_id,
              phone: e164,
              order_id: String(order_id),
              scheduled_at: scheduledAt,
              status: "pending",
              attempt: 1,
              playbook_key: "cod_confirm",
              metadata: {
                customer_name: req.body.customer_name || "Customer",
                order_total: total_price,
                currency: currency || "INR",
                email: email || null,
                country_code: cc,
                flow: "cod_confirm",
              },
            });

            logger.info({ order_id, phone: e164 }, "Scheduled COD confirmation call");
          }
        }
      }
    }

    res.status(200).json({ ok: true });
  })
);

router.post(
  "/orders/fulfilled",
  asyncHandler(async (req, res) => {
    const { org_id, order_id, phone, email, tracking_number, tracking_url, country_code } = req.body;

    if (!org_id || !order_id) {
      return res.status(400).json({ error: "Missing required fields: org_id, order_id" });
    }

    // Fulfillment call (feedback/review collection) can be scheduled here
    // For now, acknowledge receipt — playbook scheduling will handle this in V5
    logger.info({ org_id, order_id }, "Order fulfilled event received");
    res.status(200).json({ ok: true, note: "fulfillment_acknowledged" });
  })
);

router.post(
  "/orders/cancelled",
  asyncHandler(async (req, res) => {
    const { org_id, order_id } = req.body;

    if (!org_id || !order_id) {
      return res.status(400).json({ error: "Missing required fields: org_id, order_id" });
    }

    const admin = requireAdmin();

    // Cancel any pending COD confirmation calls for this order
    const { data: cancelled } = await admin
      .from("scheduled_calls")
      .update({ status: "cancelled", cancelled_reason: "order_cancelled" })
      .eq("org_id", org_id)
      .eq("order_id", String(order_id))
      .in("status", ["pending", "processing"])
      .select("id");

    logger.info({ order_id, cancelled: cancelled?.length || 0 }, "Cancelled calls for cancelled order");
    res.status(200).json({ ok: true, cancelled: cancelled?.length || 0 });
  })
);

router.get(
  "/status",
  asyncHandler(async (req, res) => {
    const org_id = req.query.org_id;
    if (!org_id) return res.status(400).json({ error: "org_id required" });

    const admin = requireAdmin();
    const { data: integration } = await admin
      .from("integrations")
      .select("id, status, config, agent_id, call_delay_minutes, created_at")
      .eq("org_id", org_id)
      .eq("type", "shopify")
      .maybeSingle();

    if (!integration) {
      return res.status(200).json({ connected: false });
    }

    res.status(200).json({
      connected: integration.status === "active",
      status: integration.status,
      shop_domain: integration.config?.shop_domain,
      agent_id: integration.agent_id,
      call_delay_minutes: integration.call_delay_minutes,
      connected_at: integration.config?.installed_at || integration.created_at,
    });
  })
);

module.exports = router;
