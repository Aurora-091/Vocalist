const { TelephonyProvider } = require('./interface');

class TwilioTelephonyAdapter extends TelephonyProvider {
  static get providerKey() { return 'twilio'; }

  async connect() {
    const { account_sid, auth_token } = this.credentials;
    if (!account_sid || !auth_token) {
      return { ok: false, error: 'account_sid and auth_token are required' };
    }
    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${account_sid}.json`, {
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${account_sid}:${auth_token}`).toString('base64'),
        },
      });
      if (!res.ok) return { ok: false, error: `Twilio returned ${res.status}` };
      const data = await res.json();
      return { ok: true, accountId: data.sid };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async disconnect() { return { ok: true }; }

  async verify() { return this.connect(); }

  async listAvailableNumbers({ countryCode = 'US', areaCode, numberType = 'local', limit = 10 } = {}) {
    const { account_sid, auth_token } = this.credentials;
    const type = numberType === 'toll_free' ? 'TollFree' : 'Local';
    const params = new URLSearchParams({ PageSize: String(limit) });
    if (areaCode) params.set('AreaCode', areaCode);
    const url = `https://api.twilio.com/2010-04-01/Accounts/${account_sid}/AvailablePhoneNumbers/${countryCode}/${type}.json?${params}`;
    const res = await fetch(url, {
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${account_sid}:${auth_token}`).toString('base64'),
      },
    });
    if (!res.ok) throw new Error(`Twilio listAvailableNumbers failed: ${res.status}`);
    const data = await res.json();
    return (data.available_phone_numbers || []).map((n) => ({
      e164: n.phone_number,
      friendlyName: n.friendly_name,
      monthlyPrice: null,
      capabilities: n.capabilities,
    }));
  }

  async buyNumber(e164) {
    const { account_sid, auth_token } = this.credentials;
    const body = new URLSearchParams({ PhoneNumber: e164 });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${account_sid}/IncomingPhoneNumbers.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${account_sid}:${auth_token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    if (!res.ok) throw new Error(`Twilio buyNumber failed: ${res.status}`);
    const data = await res.json();
    return { e164: data.phone_number, providerRef: data.sid, monthlyPrice: null };
  }

  async releaseNumber(providerRef) {
    const { account_sid, auth_token } = this.credentials;
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${account_sid}/IncomingPhoneNumbers/${providerRef}.json`, {
      method: 'DELETE',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${account_sid}:${auth_token}`).toString('base64'),
      },
    });
    return { ok: res.ok || res.status === 204 };
  }

  async assignWebhook(providerRef, webhookUrl) {
    const { account_sid, auth_token } = this.credentials;
    const body = new URLSearchParams({ VoiceUrl: webhookUrl, VoiceMethod: 'POST' });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${account_sid}/IncomingPhoneNumbers/${providerRef}.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${account_sid}:${auth_token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    return { ok: res.ok };
  }

  async healthCheck() {
    const result = await this.verify();
    return { ok: result.ok };
  }
}

module.exports = { TwilioTelephonyAdapter };
