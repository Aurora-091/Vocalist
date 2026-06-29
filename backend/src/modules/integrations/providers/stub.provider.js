const { IntegrationProvider } = require("./interface");

class StubProvider extends IntegrationProvider {
  constructor(orgId, config, type) {
    super(orgId, config);
    this._type = type;
  }

  async testConnection() {
    return { ok: false, note: `${this._type} integration not fully implemented yet` };
  }

  async syncContacts() {
    return { synced: 0, note: `${this._type} contact sync not fully implemented yet` };
  }

  async webhook(payload) {
    return { received: true, note: `${this._type} webhooks not fully implemented yet` };
  }
}

module.exports = StubProvider;
