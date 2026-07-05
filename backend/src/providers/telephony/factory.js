const { TwilioTelephonyAdapter } = require('./twilio.adapter');
const { PlivoTelephonyAdapter } = require('./plivo.adapter');
const { ExotelTelephonyAdapter } = require('./exotel.adapter');
const { VobizTelephonyAdapter } = require('./vobiz.adapter');

const ADAPTERS = {
  twilio: TwilioTelephonyAdapter,
  plivo: PlivoTelephonyAdapter,
  exotel: ExotelTelephonyAdapter,
  vobiz: VobizTelephonyAdapter,
};

/**
 * Returns a TelephonyProvider adapter instance for the given provider key.
 * @param {string} providerKey  - 'twilio' | 'plivo' | 'exotel' | 'vobiz'
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
