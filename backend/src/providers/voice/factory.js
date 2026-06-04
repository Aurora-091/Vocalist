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
 * Current state (PR #8 / Phase 0): vapi + retell are still registered
 * here so existing call paths (call.service / agent.service) and the
 * dialer worker keep working while we migrate them. PR #9 (workstream
 * 1.1 of the Phase-1 plan) finishes the consolidation:
 *   - adds ElevenLabsProvider to PROVIDERS
 *   - removes vapi + retell from PROVIDERS
 *   - migrates call.service + agent.service to use this factory
 *   - deletes the duplicate backend/src/services/providers/ tree
 *
 * See backend/src/providers/voice/README.md for the full architecture.
 */

const VapiProvider = require("./vapi.provider");
const RetellProvider = require("./retell.provider");
const MockProvider = require("./mock.provider");

const PROVIDERS = {
  // ↓ PR #9 will remove these two and add 'elevenlabs' instead.
  vapi: VapiProvider,
  retell: RetellProvider,
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
    "vapi";

  const Cls = PROVIDERS[name];
  if (!Cls) {
    throw new Error(
      `Unknown voice provider: "${name}". Registered: ${Object.keys(PROVIDERS).join(", ")}. ` +
        `See backend/src/providers/voice/README.md.`
    );
  }
  return new Cls({ orgId: agent?.org_id, agent, config: integrationConfig });
}

function listVoiceProviders() {
  return Object.keys(PROVIDERS);
}

module.exports = { buildVoiceProvider, listVoiceProviders, PROVIDERS };
