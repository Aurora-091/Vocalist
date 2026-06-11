const { VoiceProvider } = require("./interface");
const logger = require("../../config/logger");

const ELEVENLABS_BASE = "https://api.elevenlabs.io";

class ElevenLabsProvider extends VoiceProvider {
  static get name() { return "elevenlabs"; }

  async _call(method, path, body, isMultipart = false) {
    const apiKey = this.config.api_key || process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error("ElevenLabs provider requires config.api_key or ELEVENLABS_API_KEY env var");
    }

    const headers = {
      "xi-api-key": apiKey,
    };
    if (!isMultipart) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(`${ELEVENLABS_BASE}${path}`, {
      method,
      headers,
      body: body ? (isMultipart ? body : JSON.stringify(body)) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`ElevenLabs ${method} ${path} failed: ${res.status} ${text.slice(0, 200)}`);
    }

    if (res.status === 204) return null;
    return res.json();
  }

  async _getTwilioCredentials() {
    const { requireAdmin } = require("../../config/supabase");
    const admin = requireAdmin();
    const { data: sub } = await admin
      .from("twilio_subaccounts")
      .select("subaccount_sid, auth_token_ref")
      .eq("org_id", this.orgId)
      .maybeSingle();

    if (!sub) {
      logger.warn({ orgId: this.orgId }, "No Twilio subaccount found for org");
    }

    let authToken = process.env.TWILIO_AUTH_TOKEN;
    if (sub && sub.auth_token_ref) {
      try {
        const { data: secret } = await admin.rpc("vault_read", { name: sub.auth_token_ref });
        if (secret) {
          authToken = secret;
        }
      } catch (err) {
        logger.error({ err: err.message, orgId: this.orgId }, "Failed to read Twilio auth token from vault");
      }
    }
    const accountSid = sub?.subaccount_sid || process.env.TWILIO_ACCOUNT_SID;

    if (!accountSid || !authToken) {
      throw new Error("Twilio credentials unavailable - cannot proceed with telephony operation");
    }

    return { accountSid, authToken };
  }

  async _getOrImportPhoneNumberId(phone_number) {
    const res = await this._call("GET", "/v1/convai/phone-numbers");
    const matched = res.phone_numbers?.find((p) => p.phone_number === phone_number);
    if (matched) return matched.phone_number_id;

    // Import it
    const credentials = await this._getTwilioCredentials();
    if (!credentials.accountSid || !credentials.authToken) {
      throw new Error("Twilio credentials missing, cannot import number to ElevenLabs");
    }

    const importRes = await this._call("POST", "/v1/convai/phone-numbers", {
      phone_number: phone_number,
      label: `Imported ${phone_number}`,
      provider: "twilio",
      twilio_account_sid: credentials.accountSid,
      twilio_auth_token: credentials.authToken,
    });

    return importRes.phone_number_id;
  }

  async downloadFromStorage(storageRef) {
    const { requireAdmin } = require("../../config/supabase");
    const admin = requireAdmin();
    const { data, error } = await admin.storage
      .from("knowledge")
      .download(storageRef);
    if (error) throw error;
    return data.arrayBuffer();
  }

  // Agent Management
  async createAgent(agent, systemPrompt) {
    const payload = {
      name: agent.name,
      conversation_config: {
        agent: {
          prompt: {
            prompt: systemPrompt,
            llm: "gpt-4o-mini",
            temperature: 0.5,
          },
          first_message: agent.first_message || agent.persona?.opening_message || "Hello!",
          language: agent.language || (agent.languages && agent.languages[0]) || "en",
        },
        tts: {
          voice_id: agent.voice_id || "21m00Tcm4TlvDq8ikWAM", // Default Rachel voice
        },
      },
    };
    const result = await this._call("POST", "/v1/convai/agents/create", payload);
    return { provider_ref: result.agent_id, provider_meta: result };
  }

  async updateAgent(providerRef, agent, systemPrompt) {
    if (!providerRef) throw new Error("Missing providerRef");
    const payload = {
      name: agent.name,
      conversation_config: {
        agent: {
          prompt: {
            prompt: systemPrompt,
            llm: "gpt-4o-mini",
            temperature: 0.5,
          },
          first_message: agent.first_message || agent.persona?.opening_message || "Hello!",
          language: agent.language || (agent.languages && agent.languages[0]) || "en",
        },
        tts: {
          voice_id: agent.voice_id || "21m00Tcm4TlvDq8ikWAM",
        },
      },
    };

    if (agent.knowledge_base_ids && Array.isArray(agent.knowledge_base_ids)) {
      payload.conversation_config.agent.prompt.knowledge_base = agent.knowledge_base_ids;
    }

    const result = await this._call("PATCH", `/v1/convai/agents/${providerRef}`, payload);
    return { provider_ref: providerRef, provider_meta: result };
  }

  async deleteAgent(providerRef) {
    if (!providerRef) return;
    await this._call("DELETE", `/v1/convai/agents/${providerRef}`);
    return { ok: true };
  }

  async syncAgent(providerRef) {
    if (!providerRef) throw new Error("Missing providerRef");
    return this._call("GET", `/v1/convai/agents/${providerRef}`);
  }

  // Telephony Mapping
  async assignPhoneNumber({ provider_ref, phone_number }) {
    if (!provider_ref) throw new Error("Missing agent provider_ref");
    const phoneNumberId = await this._getOrImportPhoneNumberId(phone_number);
    await this._call("PATCH", `/v1/convai/phone-numbers/${phoneNumberId}`, {
      agent_id: provider_ref,
    });
    return { ok: true, phone_number_id: phoneNumberId };
  }

  async attachPhoneNumber({ providerRef, twilioNumber, twilioCreds }) {
    return this.assignPhoneNumber({ provider_ref: providerRef, phone_number: twilioNumber });
  }

  // Live Calling
  async startCall({ toE164, fromE164, leaseToken, metadata = {} }) {
    const agentId = this.agent?.provider_ref;
    if (!agentId) throw new Error("agent.provider_ref (ElevenLabs agent_id) is required");

    // Pre-flight: verify credentials before initiating the call
    const credentials = await this._getTwilioCredentials();
    logger.info({ orgId: this.orgId, agentId, toE164 }, "Starting ElevenLabs outbound call");

    const agentPhoneNumberId = await this._getOrImportPhoneNumberId(fromE164);

    const payload = {
      agent_id: agentId,
      agent_phone_number_id: agentPhoneNumberId,
      to_number: toE164,
      conversation_initiation_client_data: {
        lease_token: leaseToken,
        call_id: metadata.call_id || metadata.target_id,
        org_id: this.orgId,
        agent_id: agentId,
        from_number: fromE164,
      },
    };

    const result = await this._call("POST", "/v1/convai/twilio/outbound-call", payload);
    return {
      provider_call_id: result.call_sid || result.conversation_id,
      status: "queued",
      meta: result,
    };
  }

  async endCall(providerCallId) {
    try {
      const credentials = await this._getTwilioCredentials();
      const client = require("twilio")(credentials.accountSid, credentials.authToken);
      await client.calls(providerCallId).update({ status: "completed" });
      return { ok: true };
    } catch (err) {
      logger.error({ err: err.message, providerCallId }, "Failed to end call via Twilio");
      return { ok: false, error: err.message };
    }
  }

  async dropVoicemail({ providerCallId, audioUrl }) {
    logger.info({ providerCallId, audioUrl }, "ElevenLabs voicemail-drop requested");
    return { ok: true, note: "elevenlabs_voicemail_drop_stub" };
  }

  // Knowledge Ingestion
  async syncKnowledgeBase(knowledgeSource) {
    const formData = new FormData();
    formData.append("name", knowledgeSource.title);

    if (knowledgeSource.kind === "website") {
      formData.append("url", knowledgeSource.uri);
    } else if (knowledgeSource.kind === "document" && knowledgeSource.storage_ref) {
      const arrayBuffer = await this.downloadFromStorage(knowledgeSource.storage_ref);
      const blob = new Blob([arrayBuffer]);
      formData.append("file", blob, knowledgeSource.title);
    } else {
      throw new Error(`Unsupported knowledge source kind or missing storage reference: ${knowledgeSource.kind}`);
    }

    const result = await this._call("POST", "/v1/convai/knowledge-base", formData, true);
    return {
      provider_knowledge_id: result.id,
      meta: result,
    };
  }
}

module.exports = ElevenLabsProvider;
