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
      .select("kind, quantity, period, cost_usd")
      .gte("period", start)
      .lte("period", end);
    if (error) throw error;

    const totals = {};
    const costs = {};
    for (const row of data || []) {
      totals[row.kind] = (totals[row.kind] || 0) + Number(row.quantity);
      costs[row.kind] = (costs[row.kind] || 0) + Number(row.cost_usd || 0);
    }
    res.json({ period_start: start, period_end: end, totals, costs });
  })
);

router.get(
  "/plans",
  asyncHandler(async (req, res) => {
    const { data, error } = await req.supabase
      .from("plan_tiers")
      .select("id, key, label, monthly_usd, included_minutes, included_numbers, overage_rate_usd, features, stripe_base_price_id, stripe_overage_price_id")
      .eq("enabled", true)
      .order("monthly_usd", { ascending: true });
    if (error) throw error;
    res.json({ plans: data || [] });
  })
);

router.post(
  "/checkout",
  requireRole("owner", "admin"),
  validate({
    body: z.object({
      plan_key: z.string().min(1),
      success_url: z.string().url(),
      cancel_url: z.string().url(),
    }),
  }),
  asyncHandler(async (req, res) => {
    if (!stripe) throw BadRequest("Stripe not configured");

    const { data: tier } = await req.supabase
      .from("plan_tiers")
      .select("id, key, label, included_minutes, stripe_base_price_id, stripe_overage_price_id")
      .eq("key", req.body.plan_key)
      .eq("enabled", true)
      .maybeSingle();
    if (!tier) throw NotFound("Plan not found");
    if (!tier.stripe_base_price_id) throw BadRequest("Plan has no Stripe price configured");

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

    const lineItems = [{ price: tier.stripe_base_price_id, quantity: 1 }];
    if (tier.stripe_overage_price_id) {
      lineItems.push({ price: tier.stripe_overage_price_id });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: lineItems,
      success_url: req.body.success_url,
      cancel_url: req.body.cancel_url,
      subscription_data: {
        metadata: {
          org_id: req.auth.orgId,
          plan_tier_key: tier.key,
          included_minutes: String(tier.included_minutes || 0),
        },
      },
    });

    res.json({ url: session.url, session_id: session.id });
  })
);

router.post(
  "/change-plan",
  requireRole("owner", "admin"),
  validate({
    body: z.object({ plan_key: z.string().min(1) }),
  }),
  asyncHandler(async (req, res) => {
    if (!stripe) throw BadRequest("Stripe not configured");

    const { data: sub } = await req.supabase
      .from("subscriptions")
      .select("stripe_subscription_id, stripe_customer_id, plan_tier_key")
      .eq("org_id", req.auth.orgId)
      .maybeSingle();
    if (!sub?.stripe_subscription_id) throw NotFound("No active subscription");

    const { data: tier } = await req.supabase
      .from("plan_tiers")
      .select("id, key, label, included_minutes, stripe_base_price_id, stripe_overage_price_id")
      .eq("key", req.body.plan_key)
      .eq("enabled", true)
      .maybeSingle();
    if (!tier) throw NotFound("Plan not found");
    if (!tier.stripe_base_price_id) throw BadRequest("Plan has no Stripe price configured");

    const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
    const alreadyOnPlan = stripeSub.items.data.some((i) => i.price.id === tier.stripe_base_price_id);

    if (!alreadyOnPlan) {
      const existingItems = stripeSub.items?.data || [];
      if (existingItems.length === 0) throw BadRequest("Stripe subscription has no line items");
      const items = [{ id: existingItems[0].id, price: tier.stripe_base_price_id }];
      if (tier.stripe_overage_price_id && existingItems[1]) {
        items.push({ id: existingItems[1].id, price: tier.stripe_overage_price_id });
      }
      await stripe.subscriptions.update(sub.stripe_subscription_id, {
        items,
        proration_behavior: "create_prorations",
        metadata: {
          org_id: req.auth.orgId,
          plan_tier_key: tier.key,
          included_minutes: String(tier.included_minutes || 0),
        },
      });
    }

    await req.supabase
      .from("subscriptions")
      .update({ plan_tier_key: tier.key, updated_at: new Date().toISOString() })
      .eq("org_id", req.auth.orgId);

    res.json({ ok: true, plan_key: tier.key });
  })
);

router.post(
  "/cancel",
  requireRole("owner", "admin"),
  asyncHandler(async (req, res) => {
    if (!stripe) throw BadRequest("Stripe not configured");

    const { data: sub } = await req.supabase
      .from("subscriptions")
      .select("stripe_subscription_id")
      .eq("org_id", req.auth.orgId)
      .maybeSingle();
    if (!sub?.stripe_subscription_id) throw NotFound("No active subscription");

    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    await req.supabase
      .from("subscriptions")
      .update({ status: "cancel_at_period_end", updated_at: new Date().toISOString() })
      .eq("org_id", req.auth.orgId);

    res.json({ ok: true });
  })
);

router.post(
  "/reactivate",
  requireRole("owner", "admin"),
  asyncHandler(async (req, res) => {
    if (!stripe) throw BadRequest("Stripe not configured");

    const { data: sub } = await req.supabase
      .from("subscriptions")
      .select("stripe_subscription_id")
      .eq("org_id", req.auth.orgId)
      .maybeSingle();
    if (!sub?.stripe_subscription_id) throw NotFound("No subscription to reactivate");

    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: false,
    });

    await req.supabase
      .from("subscriptions")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("org_id", req.auth.orgId);

    res.json({ ok: true });
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
