const ShopifyProvider = require("./providers/shopify.provider");
const HubspotProvider = require("./providers/hubspot.provider");
const { BadRequest } = require("../../utils/errors");

const REGISTRY = {
  shopify: ShopifyProvider,
  hubspot: HubspotProvider,
};

function buildProvider(typeOrName, orgId, config) {
  const Cls = REGISTRY[typeOrName];
  if (!Cls) throw BadRequest(`Unknown integration provider: ${typeOrName}`);
  return new Cls(orgId, config);
}

function listProviderNames() {
  return Object.keys(REGISTRY);
}

module.exports = { buildProvider, listProviderNames, REGISTRY };
