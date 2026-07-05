const { VoiceProvider } = require("./interface");
const logger = require("../../config/logger");

const VAPI_BASE = "https://api.vapi.ai";

class VapiProvider extends VoiceProvider {
  static get name() { return "vapi"; }

  async _call(method, path, body) {
    const apiKey = this.config.api_key;
    if (!apiKey) {
      const { BadRequest } = require("../../utils/errors");
      throw BadRequest("Vapi provider requires config.api_key");
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
      const { BadGateway, BadRequest } = require("../../utils/errors");
      if (res.status >= 400 && res.status < 500) {
        throw BadRequest(`Vapi ${method} ${path} failed: ${res.status}`, { details: text.slice(0, 500) });
      }
      throw BadGateway(`Vapi ${method} ${path} failed: ${res.status}`, { details: text.slice(0, 500) });
    }
    return res.status === 204 ? null : res.json();
  }

  async startCall({ toE164, fromE164, leaseToken, metadata = {} }) {
    const assistantId = this.agent?.provider_ref;
    const phoneNumberId = this.config.phone_number_id;
    if (!assistantId) {
      const { BadRequest } = require("../../utils/errors");
      throw BadRequest("agent.provider_ref (Vapi assistantId) is required");
    }

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
