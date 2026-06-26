const ShopifyProvider = require("./providers/shopify.provider");
const HubspotProvider = require("./providers/hubspot.provider");
const { BadRequest } = require("../../utils/errors");

const REGISTRY = {
  shopify: ShopifyProvider,
  hubspot: HubspotProvider,
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
  return Object.keys(REGISTRY);
}

module.exports = { buildProvider, listProviderNames, REGISTRY };
