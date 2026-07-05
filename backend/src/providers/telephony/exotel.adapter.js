const { TelephonyProvider } = require('./interface');

// Exotel — Indian cloud telephony provider
// Docs: https://developer.exotel.com/api/
// Base URL: https://api.exotel.in/v1/Accounts/{account_sid}

class ExotelTelephonyAdapter extends TelephonyProvider {
  static get providerKey() { return 'exotel'; }

  get baseUrl() {
    const { subdomain } = this.credentials;
    const host = subdomain || 'api.exotel.in';
    return `https://${host}/v1/Accounts/${this.credentials.account_sid}`;
  }

  get authHeader() {
    const { api_key, api_token } = this.credentials;
    return 'Basic ' + Buffer.from(`${api_key}:${api_token}`).toString('base64');
  }

  async connect() {
    const { api_key, api_token, account_sid } = this.credentials;
    if (!api_key || !api_token || !account_sid) {
      return { ok: false, error: 'api_key, api_token, and account_sid are required' };
    }
    try {
      const res = await fetch(`${this.baseUrl}.json`, {
        headers: { Authorization: this.authHeader },
      });
      if (!res.ok) return { ok: false, error: `Exotel returned ${res.status}` };
      const data = await res.json();
      return { ok: true, accountId: data.Account?.Sid };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async disconnect() { return { ok: true }; }

  async verify() { return this.connect(); }

  async listAvailableNumbers({ countryCode = 'IN', limit = 10 } = {}) {
    // Exotel numbers are provisioned differently — listing available numbers
    // requires a support request or dashboard selection. We return empty
    // to signal that number purchase must be done via the Exotel dashboard.
    return [];
  }

  async buyNumber(_e164) {
    throw new Error('Exotel number purchase must be done via the Exotel dashboard — contact support@exotel.in');
  }

  async releaseNumber(providerRef) {
    // Exotel does not expose a release API — numbers are managed via the dashboard.
    return { ok: false, error: 'Number release must be done via the Exotel dashboard' };
  }

  async assignWebhook(providerRef, webhookUrl) {
    // Update the Exotel number's voice URL. The number (ExoPhone) must already be provisioned.
    const body = new URLSearchParams({
      'App[Url]': webhookUrl,
      'App[Method]': 'POST',
    });
    const res = await fetch(`${this.baseUrl}/Numbers/${providerRef}.json`, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    return { ok: res.ok };
  }

  async makeCall({ from, to, callerId, statusCallbackUrl, url } = {}) {
    if (!from || !to) throw new Error('from and to are required');
    const body = new URLSearchParams({
      From: from,
      To: to,
      CallerId: callerId || from,
      StatusCallback: statusCallbackUrl || '',
      Url: url || '',
    });
    const res = await fetch(`${this.baseUrl}/Calls/connect.json`, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Exotel call failed: ${res.status} ${errBody}`);
    }
    return res.json();
  }

  async getCallDetails(callSid) {
    const res = await fetch(`${this.baseUrl}/Calls/${callSid}.json`, {
      headers: { Authorization: this.authHeader },
    });
    if (!res.ok) throw new Error(`Exotel get call failed: ${res.status}`);
    return res.json();
  }

  async healthCheck() {
    const result = await this.connect();
    return { ok: result.ok };
  }
}

module.exports = { ExotelTelephonyAdapter };
