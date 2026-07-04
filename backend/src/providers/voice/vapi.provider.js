const { VoiceProvider } = require("./interface");
const logger = require("../../config/logger");

const VAPI_BASE = "https://api.vapi.ai";

class VapiProvider extends VoiceProvider {
  static get name() { return "vapi"; }

  async _call(method, path, body) {
    const apiKey = this.config.api_key;
    if (!apiKey) {
      throw new Error("Vapi provider requires config.api_key");
    }
    const res = await fetch(`${VAPI_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Vapi ${method} ${path} failed: ${res.status} ${text.slice(0, 200)}`);
    }
    return res.status === 204 ? null : res.json();
  }

  async startCall({ toE164, fromE164, leaseToken, metadata = {} }) {
    const assistantId = this.agent?.provider_ref;
    const phoneNumberId = this.config.phone_number_id;
    if (!assistantId) throw new Error("agent.provider_ref (Vapi assistantId) is required");

    const body = {
      assistantId,
      customer: { number: toE164 },
      metadata: { ...metadata, lease_token: leaseToken, org_id: this.orgId },
    };
    if (phoneNumberId) body.phoneNumberId = phoneNumberId;
    if (fromE164 && !phoneNumberId) body.phoneNumberFrom = fromE164;

    const result = await this._call("POST", "/call", body);
    return {
      provider_call_id: result.id,
      status: result.status === "queued" ? "queued" : result.status || "queued",
      meta: result,
    };
  }

  async endCall(providerCallId) {
    await this._call("PATCH", `/call/${providerCallId}`, { status: "ended" });
    return { ok: true };
  }

  async dropVoicemail({ providerCallId, audioUrl }) {
    logger.info({ providerCallId, audioUrl }, "Vapi voicemail-drop requested");
    return { ok: true, note: "vapi_voicemail_drop_via_assistant_message" };
  }
}

module.exports = VapiProvider;
