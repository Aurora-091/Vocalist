/**
 * Abstract base class for telephony provider adapters.
 * Every concrete adapter (Twilio, Plivo, Exotel, Vobiz) must implement all methods.
 */
class TelephonyProvider {
  constructor({ orgId, credentials = {} } = {}) {
    this.orgId = orgId;
    this.credentials = credentials;
  }

  static get providerKey() { throw new Error('providerKey not implemented'); }

  /**
   * Validate credentials and establish the provider connection.
   * Returns: { ok: boolean, accountId?: string, error?: string }
   */
  async connect() { throw new Error('connect not implemented'); }

  /**
   * Revoke / clean up stored credentials.
   * Returns: { ok: boolean }
   */
  async disconnect() { throw new Error('disconnect not implemented'); }

  /**
   * Verify that stored credentials are still valid.
   * Returns: { ok: boolean, error?: string }
   */
  async verify() { throw new Error('verify not implemented'); }

  /**
   * Search available phone numbers to purchase.
   * @param {object} query  - { countryCode, areaCode, numberType: 'local'|'toll_free', limit }
   * Returns: Array<{ e164, friendlyName, monthlyPrice, capabilities }>
   */
  async listAvailableNumbers(_query = {}) { throw new Error('listAvailableNumbers not implemented'); }

  /**
   * Purchase a phone number.
   * @param {string} e164 - The E.164 number to buy
   * Returns: { e164, providerRef, monthlyPrice }
   */
  async buyNumber(_e164) { throw new Error('buyNumber not implemented'); }

  /**
   * Release a phone number back to the provider pool.
   * @param {string} providerRef - The provider-side reference for the number
   * Returns: { ok: boolean }
   */
  async releaseNumber(_providerRef) { throw new Error('releaseNumber not implemented'); }

  /**
   * Configure incoming webhook URL for a number.
   * @param {string} providerRef
   * @param {string} webhookUrl
   * Returns: { ok: boolean }
   */
  async assignWebhook(_providerRef, _webhookUrl) { throw new Error('assignWebhook not implemented'); }

  /**
   * Quick connectivity check.
   * Returns: { ok: boolean, latencyMs?: number }
   */
  async healthCheck() { return { ok: true }; }
}

module.exports = { TelephonyProvider };
