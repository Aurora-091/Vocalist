const VoiceProviderInterface = require("./voice-provider.interface");

class RetellProvider extends VoiceProviderInterface {
  constructor(config = {}) {
    super(config);
    this.apiKey = config.apiKey || process.env.RETELL_API_KEY;
    this.baseUrl =
      config.baseUrl || process.env.RETELL_BASE_URL || "https://api.retellai.com";
  }

  get name() {
    return "retell";
  }

  async createAssistant(agentConfig) {
    return { providerRef: null, raw: { pending: true, agentConfig } };
  }

  async updateAssistant(providerRef, agentConfig) {
    return { providerRef, raw: { pending: true, agentConfig } };
  }

  async deleteAssistant(/* providerRef */) {
    return undefined;
  }

  async getAssistant(/* providerRef */) {
    return null;
  }
}

module.exports = RetellProvider;
