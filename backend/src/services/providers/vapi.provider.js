const VoiceProviderInterface = require("./voice-provider.interface");

class VapiProvider extends VoiceProviderInterface {
  constructor(config = {}) {
    super(config);
    this.apiKey = config.apiKey || process.env.VAPI_API_KEY;
    this.baseUrl = config.baseUrl || process.env.VAPI_BASE_URL || "https://api.vapi.ai";
  }

  get name() {
    return "vapi";
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

module.exports = VapiProvider;
