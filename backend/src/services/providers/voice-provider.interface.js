class VoiceProvider {
  constructor({ orgId, config = {} } = {}) {
    this.orgId = orgId;
    this.config = config;
  }

  static get name() { throw new Error("name not implemented"); }

  // Agent Management
  async createAgent(_agent, _systemPrompt) { throw new Error("createAgent not implemented"); }
  async updateAgent(_agent, _systemPrompt) { throw new Error("updateAgent not implemented"); }
  async deleteAgent(_providerRef) { throw new Error("deleteAgent not implemented"); }

  // Telephony
  async startOutboundCall(_args) { throw new Error("startOutboundCall not implemented"); }
  async endCall(_providerCallId) { throw new Error("endCall not implemented"); }
  async assignPhoneNumber(_args) { throw new Error("assignPhoneNumber not implemented"); }

  // Call state & Webhooks
  async syncCall(_providerCallId) { throw new Error("syncCall not implemented"); }
  async handleWebhook(_req) { throw new Error("handleWebhook not implemented"); }
  async getUsage(_providerCallId) { throw new Error("getUsage not implemented"); }

  // Health
  async ping() { return { ok: true }; }
}

module.exports = { VoiceProvider };
