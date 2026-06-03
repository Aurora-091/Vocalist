const { IntegrationProvider } = require("./interface");

class ShopifyProvider extends IntegrationProvider {
  static get type() { return "shopify"; }

  async testConnection() {
    if (!this.config.shop_domain || !this.config.access_token) {
      return { ok: false, reason: "missing_credentials" };
    }
    return { ok: true };
  }

  async syncContacts() {
    return { synced: 0, note: "Shopify customer sync stub - implement with Admin API" };
  }

  async webhook(payload) {
    return { received: true, topic: payload?.topic || "unknown" };
  }
}

module.exports = ShopifyProvider;
