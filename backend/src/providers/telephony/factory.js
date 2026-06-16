const { TwilioTelephonyAdapter } = require('./twilio.adapter');
const { PlivoTelephonyAdapter } = require('./plivo.adapter');

const ADAPTERS = {
  twilio: TwilioTelephonyAdapter,
  plivo: PlivoTelephonyAdapter,
};

/**
 * Returns a TelephonyProvider adapter instance for the given provider key.
 * @param {string} providerKey  - 'twilio' | 'plivo' | ...
 * @param {object} options      - { orgId, credentials }
 */
function getTelephonyAdapter(providerKey, options = {}) {
  const Adapter = ADAPTERS[providerKey];
  if (!Adapter) throw new Error(`No telephony adapter registered for provider: ${providerKey}`);
  return new Adapter(options);
}

function getSupportedProviders() {
  return Object.keys(ADAPTERS);
}

module.exports = { getTelephonyAdapter, getSupportedProviders };
