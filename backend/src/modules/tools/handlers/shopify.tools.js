const logger = require("../../../config/logger");

async function lookup_order(req) {
  const { order_number, customer_phone } = req.body;
  logger.info({ orgId: req.orgId, agentId: req.agentId, order_number, customer_phone }, "Executing shopify.lookup_order tool");
  return {
    status: "success",
    order: {
      id: "shopify-1092837",
      name: order_number || "#1205",
      financial_status: "paid",
      fulfillment_status: "fulfilled",
      total_price: "85.00",
      currency: "USD",
      created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
      tracking_number: "1Z999AA10123456784",
      tracking_company: "UPS",
      line_items: [
        { title: "Weeber Premium Wireless Earbuds", quantity: 1 }
      ]
    }
  };
}

async function list_products(req) {
  logger.info({ orgId: req.orgId, agentId: req.agentId }, "Executing shopify.list_products tool");
  return {
    status: "success",
    products: [
      { id: "prod-001", title: "Weeber Earbuds Pro", price: "129.99", inventory_quantity: 45 },
      { id: "prod-002", title: "Weeber Classic Over-Ear", price: "199.99", inventory_quantity: 12 },
      { id: "prod-003", title: "Weeber Portable Speaker Lite", price: "59.99", inventory_quantity: 0 }
    ]
  };
}

async function apply_discount(req) {
  const { code } = req.body;
  logger.info({ orgId: req.orgId, agentId: req.agentId, code }, "Executing shopify.apply_discount tool");
  return {
    status: "success",
    discount: {
      code: code || "WELCOME15",
      discount_type: "percentage",
      value: "15.0",
      usage_limit: 1,
      price_rule_id: "rule-982374"
    }
  };
}

async function cancel_order(req) {
  const { order_id } = req.body;
  logger.info({ orgId: req.orgId, agentId: req.agentId, order_id }, "Executing shopify.cancel_order tool");
  return {
    status: "success",
    cancelled_order_id: order_id || "shopify-1092837",
    cancelled_at: new Date().toISOString(),
    status: "cancelled",
    refund_status: "pending_refund"
  };
}

async function track_shipment(req) {
  const { tracking_number } = req.body;
  logger.info({ orgId: req.orgId, agentId: req.agentId, tracking_number }, "Executing shopify.track_shipment tool");
  return {
    status: "success",
    shipment: {
      carrier: "UPS",
      tracking_number: tracking_number || "1Z999AA10123456784",
      status: "in_transit",
      estimated_delivery: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      location: "San Francisco Sorting Facility, CA"
    }
  };
}

module.exports = { lookup_order, list_products, apply_discount, cancel_order, track_shipment };
