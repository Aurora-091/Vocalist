const VapiProvider = require("./vapi.provider");
const RetellProvider = require("./retell.provider");
const PipecatProvider = require("./pipecat.provider");

const SUPPORTED_PROVIDERS = ["vapi", "retell", "pipecat"];

const registry = new Map();

function getProvider(name) {
  if (!SUPPORTED_PROVIDERS.includes(name)) {
    throw new Error(
      `Unsupported voice provider "${name}". Supported: ${SUPPORTED_PROVIDERS.join(", ")}`
    );
  }
  if (!registry.has(name)) {
    switch (name) {
      case "vapi":
        registry.set(name, new VapiProvider());
        break;
      case "retell":
        registry.set(name, new RetellProvider());
        break;
      case "pipecat":
        registry.set(name, new PipecatProvider());
        break;
    }
  }
  return registry.get(name);
}

function isSupportedProvider(name) {
  return SUPPORTED_PROVIDERS.includes(name);
}

module.exports = {
  SUPPORTED_PROVIDERS,
  getProvider,
  isSupportedProvider,
};
