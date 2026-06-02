const { IntegrationProvider } = require("./interface");

class HubspotProvider extends IntegrationProvider {
  static get type() { return "crm"; }
  static get crmName() { return "hubspot"; }

  async testConnection() {
    return { ok: !!this.config.access_token };
  }

  async syncContacts() {
    return { synced: 0, note: "HubSpot contact sync stub - implement with v3 API" };
  }

  async webhook(payload) {
    return { received: true, subscription: payload?.subscriptionType };
  }
}

module.exports = HubspotProvider;
