const ShopifyProvider = require("./providers/shopify.provider");
const HubspotProvider = require("./providers/hubspot.provider");
const PipedriveProvider = require("./providers/pipedrive.provider");
const FreshsalesProvider = require("./providers/freshsales.provider");
const ClinikoProvider = require("./providers/cliniko.provider");
const JaneAppProvider = require("./providers/jane_app.provider");
const CalcomProvider = require("./providers/calcom.provider");
const WhatsAppProvider = require("./providers/whatsapp.provider");
const ZohoCrmProvider = require("./providers/zoho_crm.provider");
const SalesforceProvider = require("./providers/salesforce.provider");
const DrChronoProvider = require("./providers/drchrono.provider");
const { BadRequest } = require("../../utils/errors");

const REGISTRY = {
  shopify: ShopifyProvider,
  hubspot: HubspotProvider,
  pipedrive: PipedriveProvider,
  freshsales: FreshsalesProvider,
  cliniko: ClinikoProvider,
  jane_app: JaneAppProvider,
  calcom: CalcomProvider,
  whatsapp: WhatsAppProvider,
  zoho_crm: ZohoCrmProvider,
  salesforce: SalesforceProvider,
  drchrono: DrChronoProvider,
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
