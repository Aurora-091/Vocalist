const { VoiceProvider } = require("./voice-provider.interface");
const logger = require("../../config/logger");

const VAPI_BASE = "https://api.vapi.ai";

class VapiProvider extends VoiceProvider {
  static get name() { return "vapi"; }

  async _call(method, path, body) {
    const apiKey = this.config.api_key || process.env.VAPI_API_KEY;
    if (!apiKey) {
      throw new Error("Vapi provider requires config.api_key or VAPI_API_KEY env var");
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
    if (res.status === 204) return null;
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return res.json();
    }
    return res.text();
  }

  // Agent Management
  async createAgent(agent, systemPrompt) {
    const payload = {
      name: agent.name,
      model: {
        provider: "openai",
        model: "gpt-4",
        messages: [{ role: "system", content: systemPrompt }]
      },
      voice: {
        provider: "11labs",
        voiceId: agent.voice_id || "burt",
      }
    };
    const result = await this._call("POST", "/assistant", payload);
    return { provider_ref: result.id, provider_meta: result };
  }

  async updateAgent(agent, systemPrompt) {
    if (!agent.provider_ref) throw new Error("Missing provider_ref");
    const payload = {
      name: agent.name,
      model: {
        provider: "openai",
        model: "gpt-4",
        messages: [{ role: "system", content: systemPrompt }]
      }
    };
    const result = await this._call("PATCH", `/assistant/${agent.provider_ref}`, payload);
    return { provider_ref: result.id, provider_meta: result };
  }

  async deleteAgent(providerRef) {
    if (!providerRef) return;
    await this._call("DELETE", `/assistant/${providerRef}`);
    return { ok: true };
  }

  // Telephony
  async startOutboundCall({ toE164, fromE164, leaseToken, metadata = {}, providerRef }) {
    if (!providerRef) throw new Error("provider_ref (Vapi assistantId) is required");

    const body = {
      assistantId: providerRef,
      customer: { number: toE164 },
      phoneNumber: fromE164 ? { twilioPhoneNumber: fromE164 } : undefined, // example payload
      metadata: { ...metadata, lease_token: leaseToken, org_id: this.orgId },
    };

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

  async assignPhoneNumber({ provider_ref, phone_number }) {
    // Vapi might require updating the phone number record to point to the assistant
    // or updating the assistant with the phone number. We'll simulate assistant update.
    const payload = {
      serverUrl: process.env.VAPI_WEBHOOK_URL, // webhook routing
      // Additional config if Vapi supports linking phone number id here
    };
    await this._call("PATCH", `/assistant/${provider_ref}`, payload);
    return { ok: true };
  }

  // Call state & Webhooks
  async syncCall(providerCallId) {
    const result = await this._call("GET", `/call/${providerCallId}`);
    return {
      status: result.status,
      durationSeconds: result.endedAt ? (new Date(result.endedAt) - new Date(result.startedAt)) / 1000 : 0,
      recordingUrl: result.recordingUrl,
      cost: result.cost
    };
  }

  async handleWebhook(req) {
    // Basic verification could go here, but usually done in middleware
    return req.body;
  }

  async getUsage(providerCallId) {
    const callData = await this.syncCall(providerCallId);
    return {
      durationSeconds: callData.durationSeconds,
      cost: callData.cost
    };
  }
}

module.exports = VapiProvider;
