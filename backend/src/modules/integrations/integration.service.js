const ShopifyProvider = require("./providers/shopify.provider");
const HubspotProvider = require("./providers/hubspot.provider");
const StubProvider = require("./providers/stub.provider");
const { BadRequest } = require("../../utils/errors");

const REGISTRY = {
  shopify: ShopifyProvider,
  crm: HubspotProvider,
  hubspot: HubspotProvider,
  calcom: class extends StubProvider { constructor(orgId, config) { super(orgId, config, "calcom"); } },
  google_cal: class extends StubProvider { constructor(orgId, config) { super(orgId, config, "google_cal"); } },
  outlook_cal: class extends StubProvider { constructor(orgId, config) { super(orgId, config, "outlook_cal"); } },
  zapier: class extends StubProvider { constructor(orgId, config) { super(orgId, config, "zapier"); } },
  twilio: class extends StubProvider { constructor(orgId, config) { super(orgId, config, "twilio"); } },
};

function buildProvider(typeOrName, orgId, config) {
  if (!typeOrName || !Object.prototype.hasOwnProperty.call(REGISTRY, typeOrName)) {
    throw BadRequest(`Unknown integration provider: ${typeOrName}`);
  }
  const Cls = REGISTRY[typeOrName];
  if (typeof Cls !== "function") {
    throw BadRequest(`Integration provider Cls is not a function/class for: ${typeOrName}`);
  }
  return new Cls(orgId, config);
}

function listProviderNames() {
  return ["shopify", "calcom", "google_cal", "outlook_cal", "crm", "zapier", "twilio"];
}

module.exports = { buildProvider, listProviderNames, REGISTRY };
