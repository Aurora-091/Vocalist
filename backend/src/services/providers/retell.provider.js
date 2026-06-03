const { VoiceProvider } = require("./voice-provider.interface");

class RetellProvider extends VoiceProvider {
  static get name() { return "retell"; }

  async createAgent(agent, systemPrompt) { throw new Error("Not implemented"); }
  async updateAgent(agent, systemPrompt) { throw new Error("Not implemented"); }
  async deleteAgent(providerRef) { throw new Error("Not implemented"); }
  async startOutboundCall(_args) { throw new Error("Not implemented"); }
  async endCall(_providerCallId) { throw new Error("Not implemented"); }
  async assignPhoneNumber(_args) { throw new Error("Not implemented"); }
  async syncCall(_providerCallId) { throw new Error("Not implemented"); }
  async handleWebhook(_req) { throw new Error("Not implemented"); }
  async getUsage(_providerCallId) { throw new Error("Not implemented"); }
}

module.exports = RetellProvider;
