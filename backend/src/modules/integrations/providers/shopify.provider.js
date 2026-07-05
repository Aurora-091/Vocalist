const { IntegrationProvider } = require("./interface");
const { requireAdmin } = require("../../../config/supabase");
const logger = require("../../../config/logger");
const { tryE164 } = require("../../../utils/phone");

const API_VERSION = "2025-01";

class ShopifyProvider extends IntegrationProvider {
  static get type() { return "shopify"; }

  get baseUrl() {
    return `https://${this.config.shop_domain}/admin/api/${API_VERSION}`;
  }

  get headers() {
    return {
      "X-Shopify-Access-Token": this.config.access_token,
      "Content-Type": "application/json",
    };
  }

  async testConnection() {
    if (!this.config.shop_domain || !this.config.access_token) {
      return { ok: false, reason: "missing_credentials" };
    }
    try {
      const res = await fetch(`${this.baseUrl}/shop.json`, { headers: this.headers });
      if (!res.ok) {
        return { ok: false, reason: `shopify_api_${res.status}` };
      }
      const data = await res.json();
      return { ok: true, shop_name: data.shop?.name };
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  }

  async syncContacts({ limit = 250, since_id } = {}) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (since_id) params.set("since_id", since_id);

    const res = await fetch(
      `${this.baseUrl}/customers.json?${params}`,
      { headers: this.headers }
    );
    if (!res.ok) {
      throw new Error(`Shopify customers fetch failed: ${res.status}`);
    }

    const { customers } = await res.json();
    if (!customers || customers.length === 0) {
      return { synced: 0, note: "No customers found" };
    }

    const admin = requireAdmin();
    const cc = this.config.country_code || "IN";
    const contacts = customers
      .map((c) => {
        if (!c.phone) return null;
        const e164 = tryE164(c.phone, cc);
        if (!e164) return null;
        return {
          org_id: this.orgId,
          e164,
          name: [c.first_name, c.last_name].filter(Boolean).join(" ") || null,
          email: c.email || null,
          crm_ref: `shopify_${c.id}`,
          source: "shopify",
          consent_status: c.marketing_consent?.state === "subscribed" ? "granted" : "none",
          fields: { shopify_id: c.id, tags: c.tags, orders_count: c.orders_count },
        };
      })
      .filter(Boolean);

    if (contacts.length === 0) {
      return { synced: 0, note: "No customers with phone numbers" };
    }

    const { error } = await admin
      .from("contacts")
      .upsert(contacts, { onConflict: "org_id,e164", ignoreDuplicates: false });

    if (error) {
      logger.error({ err: error }, "Shopify contact sync upsert failed");
      throw new Error(`Contact sync failed: ${error.message}`);
    }

    return { synced: contacts.length, last_id: customers[customers.length - 1].id };
  }

  async lookupOrder(orderId) {
    const res = await fetch(
      `${this.baseUrl}/orders/${orderId}.json`,
      { headers: this.headers }
    );
    if (!res.ok) {
      if (res.status === 404) return { found: false };
      throw new Error(`Shopify order lookup failed: ${res.status}`);
    }
    const { order } = await res.json();
    return {
      found: true,
      id: order.id,
      name: order.name,
      email: order.email,
      phone: order.phone,
      total_price: order.total_price,
      currency: order.currency,
      financial_status: order.financial_status,
      fulfillment_status: order.fulfillment_status,
      created_at: order.created_at,
      line_items: (order.line_items || []).map((li) => ({
        title: li.title,
        quantity: li.quantity,
        price: li.price,
        variant_title: li.variant_title,
      })),
      shipping_address: order.shipping_address
        ? {
            city: order.shipping_address.city,
            province: order.shipping_address.province,
            country: order.shipping_address.country,
          }
        : null,
    };
  }

  async lookupAbandonedCheckouts({ limit = 10 } = {}) {
    const res = await fetch(
      `${this.baseUrl}/checkouts.json?limit=${limit}&status=open`,
      { headers: this.headers }
    );
    if (!res.ok) {
      throw new Error(`Shopify checkouts fetch failed: ${res.status}`);
    }
    const { checkouts } = await res.json();
    return (checkouts || []).map((c) => ({
      id: c.id,
      email: c.email,
      phone: c.phone || c.billing_address?.phone,
      total_price: c.total_price,
      currency: c.currency,
      created_at: c.created_at,
      abandoned_url: c.abandoned_checkout_url,
      line_items: (c.line_items || []).map((li) => ({
        title: li.title,
        quantity: li.quantity,
        price: li.price,
      })),
    }));
  }

  async applyDiscountCode(priceRuleId, { code, usage_limit = 1 }) {
    const res = await fetch(
      `${this.baseUrl}/price_rules/${priceRuleId}/discount_codes.json`,
      {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          discount_code: { code, usage_count: 0 },
        }),
      }
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Shopify discount creation failed: ${res.status} ${body}`);
    }
    const { discount_code } = await res.json();
    return {
      id: discount_code.id,
      code: discount_code.code,
      price_rule_id: priceRuleId,
    };
  }

  async cancelOrder(orderId, { reason = "customer", restock = true } = {}) {
    const res = await fetch(
      `${this.baseUrl}/orders/${orderId}/cancel.json`,
      {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({ reason, restock }),
      }
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Shopify order cancel failed: ${res.status} ${body}`);
    }
    const { order } = await res.json();
    return {
      id: order.id,
      name: order.name,
      cancelled_at: order.cancelled_at,
      cancel_reason: order.cancel_reason,
    };
  }

  async webhook(payload) {
    const topic = payload?.topic || payload?.headers?.["x-shopify-topic"] || "unknown";

    switch (topic) {
      case "orders/create":
      case "orders/updated":
        return this._handleOrderEvent(payload);
      case "customers/create":
      case "customers/update":
        return this._handleCustomerEvent(payload);
      case "checkouts/create":
      case "checkouts/update":
        return this._handleCheckoutEvent(payload);
      default:
        logger.info({ topic, org_id: this.orgId }, "Unhandled Shopify webhook topic");
        return { received: true, topic, handled: false };
    }
  }

  async _handleOrderEvent(payload) {
    const order = payload.body || payload;
    logger.info({ order_id: order.id, org_id: this.orgId }, "Shopify order event");
    return { received: true, topic: "order", order_id: order.id, handled: true };
  }

  async _handleCustomerEvent(payload) {
    const customer = payload.body || payload;
    if (customer.phone) {
      const cc = this.config.country_code || "IN";
      const e164 = tryE164(customer.phone, cc);
      if (e164) {
        const admin = requireAdmin();
        await admin.from("contacts").upsert(
          {
            org_id: this.orgId,
            e164,
            name: [customer.first_name, customer.last_name].filter(Boolean).join(" ") || null,
            email: customer.email || null,
            crm_ref: `shopify_${customer.id}`,
            source: "shopify",
            fields: { shopify_id: customer.id, tags: customer.tags },
          },
          { onConflict: "org_id,e164" }
        );
      }
    }
    return { received: true, topic: "customer", customer_id: customer.id, handled: true };
  }

  async _handleCheckoutEvent(payload) {
    const checkout = payload.body || payload;
    const checkoutId = String(checkout.id);
    const admin = requireAdmin();
    const cc = this.config.country_code || "IN";

    const phone = checkout.phone || checkout.billing_address?.phone;
    const email = checkout.email;
    const customerName = [
      checkout.billing_address?.first_name,
      checkout.billing_address?.last_name,
    ].filter(Boolean).join(" ") || "Customer";
    const cartTotal = checkout.total_price;
    const cartItems = (checkout.line_items || []).map((i) => i.title).join(", ");
    const abandonedUrl = checkout.abandoned_checkout_url;

    if (!phone) {
      logger.info({ checkout_id: checkoutId, org_id: this.orgId }, "Shopify checkout: no phone, skipping");
      return { received: true, topic: "checkout", checkout_id: checkoutId, handled: false, reason: "no_phone" };
    }

    const e164 = tryE164(phone, cc);
    if (!e164) {
      logger.info({ checkout_id: checkoutId, phone, cc }, "Shopify checkout: invalid phone");
      return { received: true, topic: "checkout", checkout_id: checkoutId, handled: false, reason: "invalid_phone" };
    }

    const { data: existing } = await admin
      .from("scheduled_calls")
      .select("id")
      .eq("checkout_id", checkoutId)
      .eq("org_id", this.orgId)
      .in("status", ["pending", "processing", "dispatched"])
      .maybeSingle();

    if (existing) {
      logger.info({ checkout_id: checkoutId }, "Shopify checkout already scheduled");
      return { received: true, topic: "checkout", checkout_id: checkoutId, handled: false, reason: "duplicate" };
    }

    const { data: integration } = await admin
      .from("integrations")
      .select("agent_id, call_delay_minutes")
      .eq("org_id", this.orgId)
      .eq("type", "shopify")
      .maybeSingle();

    const agentId = integration?.agent_id;
    const delayMinutes = integration?.call_delay_minutes || 30;

    if (!agentId) {
      logger.warn({ org_id: this.orgId }, "Shopify checkout: no agent configured for org");
      return { received: true, topic: "checkout", checkout_id: checkoutId, handled: false, reason: "no_agent" };
    }

    await admin.from("contacts").upsert(
      { org_id: this.orgId, e164, email, name: customerName, source: "shopify" },
      { onConflict: "org_id,e164", ignoreDuplicates: false }
    );

    const scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
    const { error: insertErr } = await admin.from("scheduled_calls").insert({
      org_id: this.orgId,
      agent_id: agentId,
      phone: e164,
      checkout_id: checkoutId,
      checkout_token: checkout.token || null,
      scheduled_at: scheduledAt,
      status: "pending",
      attempt: 1,
      metadata: {
        customer_name: customerName,
        cart_total: cartTotal,
        cart_items: cartItems,
        recovery_url: abandonedUrl,
        email,
        country_code: cc,
      },
    });

    if (insertErr) {
      logger.error({ err: insertErr, checkout_id: checkoutId }, "Failed to schedule cart recovery call");
      throw insertErr;
    }

    logger.info({ checkout_id: checkoutId, phone: e164, scheduled_at: scheduledAt }, "Scheduled cart recovery call");
    return { received: true, topic: "checkout", checkout_id: checkoutId, handled: true, scheduled_at: scheduledAt };
  }
}

module.exports = ShopifyProvider;
