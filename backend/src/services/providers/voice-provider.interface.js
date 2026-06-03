/**
 * Voice Provider Interface
 *
 * All voice runtime providers (Vapi, Retell, Pipecat, ...) must implement
 * this interface so that business logic stays free of provider-specific code.
 *
 * Methods return Promises so providers can perform remote calls when needed.
 */
class VoiceProviderInterface {
  // eslint-disable-next-line no-unused-vars
  constructor(config = {}) {
    if (new.target === VoiceProviderInterface) {
      throw new Error(
        "VoiceProviderInterface is abstract and cannot be instantiated directly"
      );
    }
  }

  get name() {
    throw new Error("Provider must implement `name` getter");
  }

  /**
   * Create an assistant/agent on the provider for the given agent
   * configuration. Returns the provider-assigned identifier.
   *
   * @param {object} agentConfig - output of buildAgentConfiguration(agent)
   * @returns {Promise<{ providerRef: string, raw?: object }>}
   */
  // eslint-disable-next-line no-unused-vars
  async createAssistant(agentConfig) {
    throw new Error(`${this.name}: createAssistant not implemented`);
  }

  /**
   * Update an existing provider assistant.
   *
   * @param {string} providerRef
   * @param {object} agentConfig
   * @returns {Promise<{ providerRef: string, raw?: object }>}
   */
  // eslint-disable-next-line no-unused-vars
  async updateAssistant(providerRef, agentConfig) {
    throw new Error(`${this.name}: updateAssistant not implemented`);
  }

  /**
   * Delete a provider assistant.
   *
   * @param {string} providerRef
   * @returns {Promise<void>}
   */
  // eslint-disable-next-line no-unused-vars
  async deleteAssistant(providerRef) {
    throw new Error(`${this.name}: deleteAssistant not implemented`);
  }

  /**
   * Fetch a provider assistant by its reference.
   *
   * @param {string} providerRef
   * @returns {Promise<object|null>}
   */
  // eslint-disable-next-line no-unused-vars
  async getAssistant(providerRef) {
    throw new Error(`${this.name}: getAssistant not implemented`);
  }
}

module.exports = VoiceProviderInterface;
