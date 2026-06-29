const express = require("express");
const Stripe = require("stripe");
const crypto = require("crypto");
const env = require("../../config/env");
const logger = require("../../config/logger");
const asyncHandler = require("../../utils/asyncHandler");
const { verifyVapiSignature, verifyTwilioSignature, verifyHmacSha256 } = require("../../utils/signature");
const { logWebhookEvent, markProcessed } = require("./webhook.service");
const { webhookLimiter } = require("../../middleware/rate-limit.middleware");

const vapiHandler = require("./handlers/vapi.handler");
const stripeHandler = require("./handlers/stripe.handler");
const twilioHandler = require("./handlers/twilio.handler");
const elevenlabsHandler = require("./handlers/elevenlabs.handler");

const router = express.Router();
router.use(webhookLimiter);

const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" }) : null;

router.post(
  "/vapi",
  express.raw({ type: "application/json", limit: "2mb" }),
  asyncHandler(async (req, res) => {
    const raw = req.body;
    const rawString = raw instanceof Buffer ? raw.toString("utf8") : JSON.stringify(raw || {});
    const sigHeader = req.headers["x-vapi-signature"] || req.headers["x-signature"];
    if (!env.VAPI_WEBHOOK_SECRET) {
      logger.error("VAPI_WEBHOOK_SECRET not configured — refusing webhook");
      return res.status(503).json({ error: { code: "webhook_not_configured" } });
    }
    const signatureOk = verifyVapiSignature(env.VAPI_WEBHOOK_SECRET, rawString, sigHeader);
    if (!signatureOk) {
      logger.warn("Invalid Vapi signature");
      return res.status(401).json({ error: { code: "invalid_signature" } });
    }

    let payload;
    try {
      payload = JSON.parse(rawString);
    } catch {
      return res.status(400).json({ error: { code: "invalid_json" } });
    }

    const externalId =
      payload?.id || payload?.event_id || payload?.call?.id || `vapi-${Date.now()}-${Math.random()}`;

    const logged = await logWebhookEvent({
      source: "vapi",
      externalId,
      signatureOk,
      payload,
    });
    if (logged.duplicate) return res.json({ duplicate: true });

    try {
      const result = await vapiHandler.handle(payload);
      await markProcessed(logged);
      res.json({ received: true, ...result });
    } catch (err) {
      logger.error({ err: err.message }, "Vapi handler failed");
      res.status(500).json({ error: { code: "handler_failed" } });
    }
  })
);

router.post(
  "/elevenlabs",
  express.raw({ type: "application/json", limit: "2mb" }),
  asyncHandler(async (req, res) => {
    const raw = req.body;
    const rawString = raw instanceof Buffer ? raw.toString("utf8") : JSON.stringify(raw || {});
    const sigHeader = req.headers["elevenlabs-signature"] || req.headers["x-signature"];
    const webhookSecret = env.ELEVENLABS_WEBHOOK_SECRET;

    if (!webhookSecret) {
      logger.error("ELEVENLABS_WEBHOOK_SECRET not configured — refusing webhook");
      return res.status(503).json({ error: { code: "webhook_not_configured" } });
    }
    const signatureOk = verifyHmacSha256(webhookSecret, rawString, sigHeader);
    if (!signatureOk) {
      logger.warn("Invalid ElevenLabs signature");
      return res.status(401).json({ error: { code: "invalid_signature" } });
    }

    let payload;
    try {
      payload = JSON.parse(rawString);
    } catch {
      return res.status(400).json({ error: { code: "invalid_json" } });
    }

    const data = payload.data || payload;
    const externalId = payload.event_id || data?.conversation_id || `elevenlabs-${Date.now()}-${Math.random()}`;

    const logged = await logWebhookEvent({
      source: "elevenlabs",
      externalId,
      signatureOk,
      payload,
    });
    if (logged.duplicate) return res.json({ duplicate: true });

    try {
      const result = await elevenlabsHandler.handle(payload);
      await markProcessed(logged);
      res.json({ received: true, ...result });
    } catch (err) {
      logger.error({ err: err.message }, "ElevenLabs handler failed");
      res.status(500).json({ error: { code: "handler_failed" } });
    }
  })
);

router.post(
  "/stripe",
  express.raw({ type: "application/json", limit: "2mb" }),
  asyncHandler(async (req, res) => {
    if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
      return res.status(503).json({ error: { code: "stripe_not_configured" } });
    }
    const sig = req.headers["stripe-signature"];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      logger.warn({ err: err.message }, "Invalid Stripe signature");
      return res.status(401).json({ error: { code: "invalid_signature" } });
    }

    const logged = await logWebhookEvent({
      source: "stripe",
      externalId: event.id,
      signatureOk: true,
      payload: event,
    });
    if (logged.duplicate) return res.json({ duplicate: true });

    try {
      const result = await stripeHandler.handle(event);
      await markProcessed(logged);
      res.json({ received: true, ...result });
    } catch (err) {
      logger.error({ err: err.message }, "Stripe handler failed");
      res.status(500).json({ error: { code: "handler_failed" } });
    }
  })
);

router.post(
  "/twilio",
  express.urlencoded({ extended: false }),
  asyncHandler(async (req, res) => {
    const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    const sig = req.headers["x-twilio-signature"];
    if (!env.TWILIO_AUTH_TOKEN) {
      logger.error("TWILIO_AUTH_TOKEN not configured — refusing webhook");
      return res.status(503).json({ error: { code: "webhook_not_configured" } });
    }
    const signatureOk = verifyTwilioSignature(env.TWILIO_AUTH_TOKEN, url, req.body, sig);
    if (!signatureOk) {
      return res.status(401).json({ error: { code: "invalid_signature" } });
    }

    const externalId = req.body.CallSid + ":" + (req.body.CallStatus || "evt");
    const logged = await logWebhookEvent({
      source: "twilio",
      externalId,
      signatureOk,
      payload: req.body,
    });
    if (logged.duplicate) return res.type("text/xml").send("<Response/>");

    try {
      await twilioHandler.handle(req.body);
      await markProcessed(logged);
      res.type("text/xml").send("<Response/>");
    } catch (err) {
      logger.error({ err: err.message }, "Twilio handler failed");
      res.status(500).type("text/xml").send("<Response/>");
    }
  })
);

router.post(
  "/twilio/voice",
  express.urlencoded({ extended: false }),
  asyncHandler(async (req, res) => {
    const crypto = require("crypto");
    const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    const sig = req.headers["x-twilio-signature"];
    if (!env.TWILIO_AUTH_TOKEN) {
      logger.error("TWILIO_AUTH_TOKEN not configured — refusing voice webhook");
      return res.status(503).type("text/xml").send("<Response/>");
    }
    const signatureOk = verifyTwilioSignature(env.TWILIO_AUTH_TOKEN, url, req.body, sig);
    if (!signatureOk) {
      return res.status(401).type("text/xml").send("<Response/>");
    }

    const called = req.body.Called || req.body.To;
    const caller = req.body.From;
    const { requireAdmin } = require("../../config/supabase");
    const admin = requireAdmin();

    if (!called) {
      return res.type("text/xml").send(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">Invalid call parameters.</Say><Hangup/></Response>`
      );
    }

    // 1. Resolve org_id and bound agent_id
    const { data: number, error: numErr } = await admin
      .from("phone_numbers")
      .select("org_id, agent_id, agents:agent_id(name, persona, provider)")
      .eq("e164", called)
      .maybeSingle();

    if (numErr || !number || !number.agent_id) {
      logger.warn({ called, caller }, "Inbound call to unassigned/unknown number");
      return res.type("text/xml").send(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">The number you dialed is not associated with an active agent.</Say><Hangup/></Response>`
      );
    }

    const now = new Date().toISOString();

    // 2. Check Inbound Rate Limit
    const { data: rateStatus, error: rateErr } = await admin.rpc("check_inbound_rate", {
      p_org: number.org_id,
      p_from_e164: caller || "",
      p_to_e164: called,
      p_now: now
    });
    if (rateErr) throw rateErr;

    if (rateStatus === "blocked_rate") {
      logger.warn({ called, caller, orgId: number.org_id }, "Inbound call blocked by rate limit");
      await admin.from("call_events").insert({
        org_id: number.org_id,
        kind: "blocked_rate",
        payload: { called, caller, now }
      });
      return res.type("text/xml").send(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">We are experiencing a high volume of calls. Please try again later.</Say><Hangup/></Response>`
      );
    }

    // 3. Check Spend Guard
    const { data: allowedToSpend, error: spendErr } = await admin.rpc("can_spend", {
      p_org: number.org_id,
      p_scope: "agent",
      p_scope_id: number.agent_id,
      p_projected_usd: 0.15,
      p_now: now
    });
    if (spendErr) throw spendErr;

    if (!allowedToSpend) {
      logger.warn({ called, caller, orgId: number.org_id }, "Inbound call blocked by spend guard");
      await admin.from("call_events").insert({
        org_id: number.org_id,
        kind: "blocked_spend",
        payload: { called, caller, now }
      });
      return res.type("text/xml").send(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">The service limit has been reached. Please try again later.</Say><Hangup/></Response>`
      );
    }

    // 4. Create Call Record & Log event
    const callId = crypto.randomUUID();
    const { error: callErr } = await admin.from("calls").insert({
      id: callId,
      org_id: number.org_id,
      agent_id: number.agent_id,
      direction: "inbound",
      status: "ringing",
      provider: number.agents?.provider || "mock",
      provider_call_id: req.body.CallSid,
      started_at: now,
      from_number: req.body.From,
      to_number: req.body.To,
    });
    if (callErr) throw callErr;

    await admin.from("call_events").insert({
      org_id: number.org_id,
      call_id: callId,
      kind: "twilio.ringing",
      payload: req.body
    });

    const agentName =
      number.agents?.persona?.business_name ||
      number.agents?.name ||
      null;

    const greeting = agentName
      ? `Thanks for calling ${agentName}. This call may be recorded for quality and training.`
      : "Thanks for calling. This call may be recorded for quality and training.";

    res
      .type("text/xml")
      .send(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">${escapeXml(
          greeting
        )}</Say><Connect><Stream url="wss://${req.get("host")}/v1/twilio/stream/${callId}" /></Connect><Say voice="alice">Thank you for calling. Goodbye.</Say><Hangup/></Response>`
      );
  })
);

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const shopifyRawBodyMiddleware = express.raw({ type: "application/json", limit: "2mb" });

function verifyShopifyHmac(req, res, next) {
  const hmacHeader = req.headers["x-shopify-hmac-sha256"];
  if (!hmacHeader) {
    logger.warn("Missing Shopify HMAC header");
    return res.status(403).json({ error: "Forbidden" });
  }

  const rawBody = req.body;
  if (!Buffer.isBuffer(rawBody)) {
    logger.warn("Shopify raw body is not a Buffer");
    return res.status(403).json({ error: "Forbidden" });
  }

  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!secret) {
    logger.error("SHOPIFY_CLIENT_SECRET not configured");
    return res.status(503).json({ error: "Webhook secret not configured" });
  }

  const calculated = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("base64");

  const a = Buffer.from(calculated, "utf8");
  const b = Buffer.from(hmacHeader, "utf8");

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    logger.warn("Invalid Shopify HMAC signature");
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
}

router.post(
  "/shopify/orders",
  shopifyRawBodyMiddleware,
  verifyShopifyHmac,
  asyncHandler(async (req, res) => {
    const shop = req.headers["x-shopify-shop-domain"];
    const topic = req.headers["x-shopify-topic"];
    
    let payload;
    try {
      payload = JSON.parse(req.body.toString("utf8"));
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }

    logger.info({ shop, topic, id: payload.id }, "Shopify orders webhook received");
    res.status(200).json({ ok: true });
  })
);

router.post(
  "/shopify/checkouts",
  shopifyRawBodyMiddleware,
  verifyShopifyHmac,
  asyncHandler(async (req, res) => {
    const shop = req.headers["x-shopify-shop-domain"];
    const topic = req.headers["x-shopify-topic"];

    let payload;
    try {
      payload = JSON.parse(req.body.toString("utf8"));
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }

    logger.info({ shop, topic, id: payload.id }, "Shopify checkouts webhook received");

    const { requireAdmin } = require("../../config/supabase");
    const admin = requireAdmin();

    const { data: integration } = await admin
      .from("integrations")
      .select("org_id, config")
      .eq("type", "shopify")
      .eq("config->>shop_domain", shop)
      .maybeSingle();

    if (integration) {
      const ShopifyProvider = require("../integrations/providers/shopify.provider");
      const provider = new ShopifyProvider(integration.org_id, integration.config);
      await provider._handleCheckoutEvent(payload);
    } else {
      logger.warn({ shop }, "Shopify checkout webhook: no integration found for shop");
    }

    res.status(200).json({ ok: true });
  })
);

router.post(
  "/shopify/customers",
  shopifyRawBodyMiddleware,
  verifyShopifyHmac,
  asyncHandler(async (req, res) => {
    const shop = req.headers["x-shopify-shop-domain"];
    const topic = req.headers["x-shopify-topic"];
    
    let payload;
    try {
      payload = JSON.parse(req.body.toString("utf8"));
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }

    logger.info({ shop, topic, id: payload.id }, "Shopify customers webhook received");
    res.status(200).json({ ok: true });
  })
);

router.post(
  "/shopify/lifecycle",
  shopifyRawBodyMiddleware,
  verifyShopifyHmac,
  asyncHandler(async (req, res) => {
    const shop = req.headers["x-shopify-shop-domain"];
    const topic = req.headers["x-shopify-topic"];
    
    let payload;
    try {
      payload = JSON.parse(req.body.toString("utf8"));
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }

    logger.info({ shop, topic }, "Shopify lifecycle webhook received");

    if (topic === "app/uninstalled") {
      const { requireAdmin } = require("../../config/supabase");
      const admin = requireAdmin();
      const { error } = await admin
        .from("integrations")
        .update({ status: "inactive" })
        .eq("type", "shopify")
        .eq("config->>shop_domain", shop);

      if (error) {
        logger.error({ err: error, shop }, "Failed to deactivate shopify integration on app/uninstalled");
        throw error;
      }
      logger.info({ shop }, "Shopify integration marked inactive due to app/uninstalled");
    }

    res.status(200).json({ ok: true });
  })
);

router.post(
  "/shopify/gdpr",
  shopifyRawBodyMiddleware,
  verifyShopifyHmac,
  asyncHandler(async (req, res) => {
    const shop = req.headers["x-shopify-shop-domain"];
    const topic = req.headers["x-shopify-topic"];
    logger.info({ shop, topic }, "Shopify GDPR webhook received");
    res.status(200).json({ ok: true });
  })
);

module.exports = router;
