const { TelephonyProvider } = require('./interface');

// Vobiz — Indian cloud telephony / VoIP provider
// Docs: https://vobiz.in/developer/
// Authentication: API key + secret in Basic auth or query params

class VobizTelephonyAdapter extends TelephonyProvider {
  static get providerKey() { return 'vobiz'; }

  get baseUrl() {
    return 'https://api.vobiz.in/v1';
  }

  get authHeader() {
    const { api_key, api_secret } = this.credentials;
    return 'Basic ' + Buffer.from(`${api_key}:${api_secret}`).toString('base64');
  }

  async connect() {
    const { api_key, api_secret } = this.credentials;
    if (!api_key || !api_secret) {
      return { ok: false, error: 'api_key and api_secret are required' };
    }
    try {
      const res = await fetch(`${this.baseUrl}/account`, {
        headers: { Authorization: this.authHeader },
      });
      if (!res.ok) return { ok: false, error: `Vobiz returned ${res.status}` };
      const data = await res.json();
      return { ok: true, accountId: data.account_id || data.id };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async disconnect() { return { ok: true }; }

  async verify() { return this.connect(); }

  async listAvailableNumbers({ countryCode = 'IN', limit = 10 } = {}) {
    try {
      const res = await fetch(
        `${this.baseUrl}/numbers/available?country=${countryCode}&limit=${limit}`,
        { headers: { Authorization: this.authHeader } }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return (data.numbers || []).map((n) => ({
        e164: n.phone_number || n.number,
        friendlyName: n.friendly_name || n.number,
        monthlyPrice: n.monthly_cost || null,
        capabilities: { voice: true, sms: n.sms_enabled || false },
      }));
    } catch {
      return [];
    }
  }

  async buyNumber(e164) {
    const body = JSON.stringify({ phone_number: e164 });
    const res = await fetch(`${this.baseUrl}/numbers/buy`, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
      },
      body,
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Vobiz buyNumber failed: ${res.status} ${errBody}`);
    }
    const data = await res.json();
    return {
      e164: data.phone_number || e164,
      providerRef: data.sid || data.id,
      monthlyPrice: data.monthly_cost || null,
    };
  }

  async releaseNumber(providerRef) {
    const res = await fetch(`${this.baseUrl}/numbers/${providerRef}`, {
      method: 'DELETE',
      headers: { Authorization: this.authHeader },
    });
    return { ok: res.ok || res.status === 204 };
  }

  async assignWebhook(providerRef, webhookUrl) {
    const res = await fetch(`${this.baseUrl}/numbers/${providerRef}`, {
      method: 'PATCH',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ voice_url: webhookUrl, voice_method: 'POST' }),
    });
    return { ok: res.ok };
  }

  async makeCall({ from, to, url, statusCallbackUrl } = {}) {
    if (!from || !to) throw new Error('from and to are required');
    const res = await fetch(`${this.baseUrl}/calls`, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        url,
        status_callback: statusCallbackUrl,
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Vobiz call failed: ${res.status} ${errBody}`);
    }
    return res.json();
  }

  async healthCheck() {
    const result = await this.connect();
    return { ok: result.ok };
  }
}

module.exports = { VobizTelephonyAdapter };
