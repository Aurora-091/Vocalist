const { TelephonyProvider } = require('./interface');

class PlivoTelephonyAdapter extends TelephonyProvider {
  static get providerKey() { return 'plivo'; }

  get _auth() {
    const { auth_id, auth_token } = this.credentials;
    return 'Basic ' + Buffer.from(`${auth_id}:${auth_token}`).toString('base64');
  }

  async connect() {
    const { auth_id, auth_token } = this.credentials;
    if (!auth_id || !auth_token) return { ok: false, error: 'auth_id and auth_token are required' };
    try {
      const res = await fetch(`https://api.plivo.com/v1/Account/${auth_id}/`, {
        headers: { Authorization: this._auth },
      });
      if (!res.ok) return { ok: false, error: `Plivo returned ${res.status}` };
      const data = await res.json();
      return { ok: true, accountId: data.auth_id };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async disconnect() { return { ok: true }; }
  async verify() { return this.connect(); }

  async listAvailableNumbers({ countryCode = 'US', numberType = 'local', limit = 10 } = {}) {
    const { auth_id } = this.credentials;
    const type = numberType === 'toll_free' ? 'tollfree' : 'local';
    const params = new URLSearchParams({ country_iso: countryCode, type, limit: String(limit) });
    const res = await fetch(`https://api.plivo.com/v1/Account/${auth_id}/PhoneNumber/?${params}`, {
      headers: { Authorization: this._auth },
    });
    if (!res.ok) throw new Error(`Plivo listAvailableNumbers failed: ${res.status}`);
    const data = await res.json();
    return (data.objects || []).map((n) => ({
      e164: n.number,
      friendlyName: n.number,
      monthlyPrice: n.monthly_rental_rate ? Number(n.monthly_rental_rate) : null,
      capabilities: { voice: n.voice_enabled, SMS: n.sms_enabled },
    }));
  }

  async buyNumber(e164) {
    const { auth_id } = this.credentials;
    const res = await fetch(`https://api.plivo.com/v1/Account/${auth_id}/PhoneNumber/${e164}/`, {
      method: 'POST',
      headers: { Authorization: this._auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error(`Plivo buyNumber failed: ${res.status}`);
    return { e164, providerRef: e164, monthlyPrice: null };
  }

  async releaseNumber(providerRef) {
    const { auth_id } = this.credentials;
    const res = await fetch(`https://api.plivo.com/v1/Account/${auth_id}/Number/${providerRef}/`, {
      method: 'DELETE',
      headers: { Authorization: this._auth },
    });
    return { ok: res.ok || res.status === 204 };
  }

  async assignWebhook(providerRef, webhookUrl) {
    const { auth_id } = this.credentials;
    const res = await fetch(`https://api.plivo.com/v1/Account/${auth_id}/Number/${providerRef}/`, {
      method: 'POST',
      headers: { Authorization: this._auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: null, voice_url: webhookUrl }),
    });
    return { ok: res.ok };
  }

  async healthCheck() {
    const result = await this.verify();
    return { ok: result.ok };
  }
}

module.exports = { PlivoTelephonyAdapter };
