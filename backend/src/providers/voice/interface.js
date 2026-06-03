class VoiceProvider {
  constructor({ orgId, agent, config = {} } = {}) {
    this.orgId = orgId;
    this.agent = agent;
    this.config = config;
  }

  static get name() { throw new Error("name not implemented"); }

  // Place an outbound call. Returns:
  //   { provider_call_id: string, status: 'queued'|'ringing'|'in_progress', meta?: object }
  async startCall(_args) { throw new Error("startCall not implemented"); }

  // End an in-progress call. Returns: { ok: boolean }
  async endCall(_providerCallId) { throw new Error("endCall not implemented"); }

  // Drop a pre-recorded voicemail message after voicemail detection.
  async dropVoicemail(_args) { throw new Error("dropVoicemail not implemented"); }

  // Quick health check used by integration tests.
  async ping() { return { ok: true }; }
}

module.exports = { VoiceProvider };
