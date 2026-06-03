class IntegrationProvider {
  constructor(orgId, config = {}) {
    this.orgId = orgId;
    this.config = config;
  }
  static get type() { throw new Error("type not implemented"); }
  async testConnection() { throw new Error("testConnection not implemented"); }
  async syncContacts() { throw new Error("syncContacts not implemented"); }
  async webhook(_payload) { throw new Error("webhook not implemented"); }
}

module.exports = { IntegrationProvider };
