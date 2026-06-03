const crypto = require("crypto");
const { VoiceProvider } = require("./interface");

class MockProvider extends VoiceProvider {
  static get name() { return "mock"; }

  async startCall({ toE164, leaseToken }) {
    return {
      provider_call_id: `mock-${crypto.randomUUID()}`,
      status: "queued",
      meta: { toE164, leaseToken, mock: true },
    };
  }

  async endCall(providerCallId) {
    return { ok: true, providerCallId };
  }

  async dropVoicemail() {
    return { ok: true, note: "mock_voicemail_drop" };
  }
}

module.exports = MockProvider;
