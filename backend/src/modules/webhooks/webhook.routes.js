const express = require("express");
const Stripe = require("stripe");
const env = require("../../config/env");
const logger = require("../../config/logger");
const asyncHandler = require("../../utils/asyncHandler");
const { verifyVapiSignature, verifyTwilioSignature } = require("../../utils/signature");
const { logWebhookEvent, markProcessed } = require("./webhook.service");
const { webhookLimiter } = require("../../middleware/rate-limit.middleware");

const vapiHandler = require("./handlers/vapi.handler");
const stripeHandler = require("./handlers/stripe.handler");
const twilioHandler = require("./handlers/twilio.handler");

const router = express.Router();
router.use(webhookLimiter);

const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;

router.post(
  "/vapi",
  express.raw({ type: "application/json" }),
  asyncHandler(async (req, res) => {
    const raw = req.body;
    const rawString = raw instanceof Buffer ? raw.toString("utf8") : JSON.stringify(raw || {});
    const sigHeader = req.headers["x-vapi-signature"] || req.headers["x-signature"];
    const signatureOk = verifyVapiSignature(env.VAPI_WEBHOOK_SECRET, rawString, sigHeader);
    if (!signatureOk && env.NODE_ENV === "production") {
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
  "/stripe",
  express.raw({ type: "application/json" }),
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
    const signatureOk = verifyTwilioSignature(env.TWILIO_AUTH_TOKEN, url, req.body, sig);
    if (!signatureOk && env.NODE_ENV === "production") {
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

module.exports = router;
