/**
 * Voice provider factory.
 *
 * Per Scope Contract §I.5 (non-negotiable): all voice goes through the
 * VoiceProvider interface. Phase-1 target state is:
 *   - elevenlabs  → registered (the active runtime)
 *   - vapi        → compiled but NOT registered (Phase-4 swap option)
 *   - retell      → compiled but NOT registered (kept for parity)
 *   - mock        → registered (tests + VOICE_PROVIDER_FORCE_MOCK=1)
 *
 * Current state (post PR #9): consolidation is complete. Registered
 * providers are elevenlabs + mock, plus a `pipecat` alias that routes
 * to mock so legacy agent.provider='pipecat' rows do not crash.
 * vapi.provider.js and retell.provider.js remain compiled but
 * unregistered for the Phase-4 swap option. call.service and
 * agent.service build providers exclusively through this factory.
 *
 * See backend/src/providers/voice/README.md for the full architecture.
 */

const ElevenLabsProvider = require("./elevenlabs.provider");
const MockProvider = require("./mock.provider");

const PROVIDERS = {
  elevenlabs: ElevenLabsProvider,
  // Aliases / placeholders kept so agent.provider='pipecat' (a v0 enum
  // value) does not crash; routes to mock until Phase 4.
  pipecat: MockProvider,
  mock: MockProvider,
};

function buildVoiceProvider({ agent, integrationConfig = {}, force } = {}) {
  const name =
    force ||
    (process.env.VOICE_PROVIDER_FORCE_MOCK === "1" ? "mock" : agent?.provider) ||
    process.env.VOICE_PROVIDER ||
    "elevenlabs";

  if (!name || !Object.prototype.hasOwnProperty.call(PROVIDERS, name)) {
    throw new Error(
      `Unknown voice provider: "${name}". Registered: ${Object.keys(PROVIDERS).join(", ")}. ` +
        `See backend/src/providers/voice/README.md.`
    );
  }

  const Cls = PROVIDERS[name];
  if (typeof Cls !== "function") {
    throw new Error(`Voice provider Cls is not a function/class for: "${name}".`);
  }

  return new Cls({ orgId: agent?.org_id, agent, config: integrationConfig });
}

function listVoiceProviders() {
  return Object.keys(PROVIDERS);
}

module.exports = { buildVoiceProvider, listVoiceProviders, PROVIDERS };
