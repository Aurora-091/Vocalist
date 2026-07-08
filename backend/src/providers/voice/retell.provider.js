const { VoiceProvider } = require("./interface");

const RETELL_BASE = "https://api.retellai.com";

class RetellProvider extends VoiceProvider {
  static get name() { return "retell"; }

  async _call(method, path, body) {
    const apiKey = this.config.api_key;
    if (!apiKey) throw new Error("Retell provider requires config.api_key");
    const res = await fetch(`${RETELL_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Retell ${method} ${path} failed: ${res.status} ${text.slice(0, 200)}`);
    }
    return res.json();
  }

  async startCall({ toE164, fromE164, leaseToken, metadata = {} }) {
    const agentId = this.agent?.provider_ref;
    if (!agentId) throw new Error("agent.provider_ref (Retell agent_id) is required");

    const body = {
      from_number: fromE164 || this.config.from_number,
      to_number: toE164,
      override_agent_id: agentId,
      metadata: { ...metadata, lease_token: leaseToken, org_id: this.orgId },
    };
    const result = await this._call("POST", "/v2/create-phone-call", body);
    return {
      provider_call_id: result.call_id,
      status: "queued",
      meta: result,
    };
  }

  async endCall(providerCallId) {
    await this._call("POST", `/v2/stop-call/${providerCallId}`);
    return { ok: true };
  }

  async dropVoicemail({ providerCallId }) {
    return { ok: true, note: "retell_voicemail_drop_via_dynamic_variable", providerCallId };
  }
}

module.exports = RetellProvider;
