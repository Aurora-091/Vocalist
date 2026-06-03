const VapiProvider = require("./vapi.provider");
const RetellProvider = require("./retell.provider");
const MockProvider = require("./mock.provider");

const PROVIDERS = {
  vapi: VapiProvider,
  retell: RetellProvider,
  pipecat: MockProvider,
  mock: MockProvider,
};

function buildVoiceProvider({ agent, integrationConfig = {}, force }) {
  const name = force || (process.env.VOICE_PROVIDER_FORCE_MOCK === "1" ? "mock" : agent?.provider) || "vapi";
  const Cls = PROVIDERS[name];
  if (!Cls) throw new Error(`Unknown voice provider: ${name}`);
  return new Cls({ orgId: agent?.org_id, agent, config: integrationConfig });
}

function listVoiceProviders() {
  return Object.keys(PROVIDERS);
}

module.exports = { buildVoiceProvider, listVoiceProviders, PROVIDERS };
