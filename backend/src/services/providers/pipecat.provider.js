const VoiceProviderInterface = require("./voice-provider.interface");

class PipecatProvider extends VoiceProviderInterface {
  constructor(config = {}) {
    super(config);
    this.apiKey = config.apiKey || process.env.PIPECAT_API_KEY;
    this.baseUrl =
      config.baseUrl || process.env.PIPECAT_BASE_URL || "https://api.pipecat.ai";
  }

  get name() {
    return "pipecat";
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

module.exports = PipecatProvider;
