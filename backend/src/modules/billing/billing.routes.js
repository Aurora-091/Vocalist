const express = require("express");
const { z } = require("zod");
const Stripe = require("stripe");
const env = require("../../config/env");
const asyncHandler = require("../../utils/asyncHandler");
const { validate } = require("../../middleware/validation.middleware");
const { requireAuth, requireOrg, requireRole } = require("../../middleware/auth.middleware");
const { BadRequest, NotFound } = require("../../utils/errors");

const router = express.Router();
const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;

router.use(requireAuth, requireOrg);

router.get(
  "/subscription",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("subscriptions")
      .select("*")
      .eq("org_id", req.auth.orgId)
      .maybeSingle();
    if (error) throw error;
    res.json({ subscription: data });
  })
);

router.get(
  "/usage",
  validate({
    query: z.object({
      period_start: z.string().date().optional(),
      period_end: z.string().date().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const start =
      req.query.period_start ||
      new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const end =
      req.query.period_end || new Date().toISOString().slice(0, 10);

    const { data, error } = await req.supabase
      .from("usage_ledger")
      .select("kind, quantity, period")
      .gte("period", start)
      .lte("period", end);
    if (error) throw error;

    const totals = {};
    for (const row of data || []) {
      totals[row.kind] = (totals[row.kind] || 0) + Number(row.quantity);
    }
    res.json({ period_start: start, period_end: end, totals });
  })
);

router.post(
  "/checkout",
  requireRole("owner", "admin"),
  validate({
    body: z.object({
      price_id: z.string().min(1),
      success_url: z.string().url(),
      cancel_url: z.string().url(),
      included_minutes: z.number().int().min(0).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    if (!stripe) throw BadRequest("Stripe not configured");

    const { data: existing } = await req.supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("org_id", req.auth.orgId)
      .maybeSingle();

    let customerId = existing?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.auth.email || undefined,
        metadata: { org_id: req.auth.orgId },
      });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: req.body.price_id, quantity: 1 }],
      success_url: req.body.success_url,
      cancel_url: req.body.cancel_url,
      subscription_data: {
        metadata: {
          org_id: req.auth.orgId,
          plan_id: req.body.price_id,
          included_minutes: String(req.body.included_minutes || 0),
        },
      },
    });

    res.json({ url: session.url, session_id: session.id });
  })
);

router.post(
  "/portal",
  requireRole("owner", "admin"),
  validate({ body: z.object({ return_url: z.string().url() }) }),
  asyncHandler(async (req, res) => {
    if (!stripe) throw BadRequest("Stripe not configured");
    const { data: sub } = await req.supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("org_id", req.auth.orgId)
      .maybeSingle();
    if (!sub?.stripe_customer_id) throw NotFound("No Stripe customer for this org");
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: req.body.return_url,
    });
    res.json({ url: session.url });
  })
);

module.exports = router;
