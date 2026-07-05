const { IntegrationProvider } = require("./interface");
const logger = require("../../../config/logger");

// WhatsApp via Twilio API
class WhatsAppProvider extends IntegrationProvider {
  static get type() { return "messaging"; }

  get baseUrl() {
    return `https://api.twilio.com/2010-04-01/Accounts/${this.config.account_sid}`;
  }

  get authHeader() {
    const { account_sid, auth_token } = this.config;
    return `Basic ${Buffer.from(`${account_sid}:${auth_token}`).toString("base64")}`;
  }

  async testConnection() {
    if (!this.config.account_sid || !this.config.auth_token) {
      return { ok: false, reason: "missing_credentials" };
    }
    try {
      const res = await fetch(`${this.baseUrl}.json`, {
        headers: { Authorization: this.authHeader },
      });
      if (!res.ok) return { ok: false, reason: `twilio_api_${res.status}` };
      const data = await res.json();
      return { ok: true, account_name: data.friendly_name, status: data.status };
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  }

  async syncContacts() {
    return { synced: 0, note: "WhatsApp does not provide a contacts API" };
  }

  async sendMessage({ to, body, mediaUrl } = {}) {
    if (!to || !body) throw new Error("to and body are required");
    if (!this.config.whatsapp_number) throw new Error("whatsapp_number not configured");

    const from = this.config.whatsapp_number.startsWith("whatsapp:")
      ? this.config.whatsapp_number
      : `whatsapp:${this.config.whatsapp_number}`;

    const toNumber = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

    const formData = new URLSearchParams();
    formData.set("To", toNumber);
    formData.set("From", from);
    formData.set("Body", body);
    if (mediaUrl) formData.set("MediaUrl", mediaUrl);

    const res = await fetch(`${this.baseUrl}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(`WhatsApp send failed: ${res.status} ${errBody.message || ""}`);
    }
    return res.json();
  }

  async getMessageStatus(messageSid) {
    const res = await fetch(`${this.baseUrl}/Messages/${messageSid}.json`, {
      headers: { Authorization: this.authHeader },
    });
    if (!res.ok) throw new Error(`WhatsApp get message status failed: ${res.status}`);
    return res.json();
  }

  async listMessages({ to, from, limit = 20 } = {}) {
    const params = new URLSearchParams({ PageSize: String(limit) });
    if (to) params.set("To", `whatsapp:${to}`);
    if (from) params.set("From", `whatsapp:${from}`);

    const res = await fetch(`${this.baseUrl}/Messages.json?${params}`, {
      headers: { Authorization: this.authHeader },
    });
    if (!res.ok) throw new Error(`WhatsApp list messages failed: ${res.status}`);
    return res.json();
  }

  async webhook(payload) {
    const { From, To, Body, MessageSid, MessageStatus } = payload || {};
    logger.info({ from: From, to: To, sid: MessageSid, status: MessageStatus, org_id: this.orgId }, "WhatsApp webhook received");
    return { received: true, sid: MessageSid, status: MessageStatus };
  }
}

module.exports = WhatsAppProvider;
