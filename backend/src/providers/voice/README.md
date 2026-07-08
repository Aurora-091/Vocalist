# `backend/src/providers/voice/` — canonical voice provider abstraction

> **Per [Scope Contract §I.5](../../../../docs/archive/Aurora-v1-Scope-and-Build-Contract.md):**
> *"No vendor SDK imported directly — all voice goes through `VoiceProvider`. Phase 1 = **ElevenLabs CAI** registered; **Vapi compiled but NOT registered** in the factory."*

## What lives here

| File | Role | Phase-1 status |
|---|---|---|
| `interface.js` | The base `VoiceProvider` interface every provider implements. | active |
| `factory.js` | Registers concrete providers and builds instances by name (`agent.provider`). | active |
| `mock.provider.js` | No-op provider for tests + `VOICE_PROVIDER_FORCE_MOCK=1`. | active |
| `elevenlabs.provider.js` | The active runtime. Implements CAI agent CRUD, KB ingestion, outbound calls, voice library, previews. | **active** (landed in PR #9; see the archived [Phase-1 plan](../../../../docs/archive/implementation-plan-phase-1.md)) |
| `vapi.provider.js` | Vapi implementation. **Compiled and unit-tested but NOT registered in the factory** as of PR #9. Kept for the Phase-4 cost-optimisation option (one-line factory flip + ~200-line migration). | compiled-inactive after PR #9 |
| `retell.provider.js` | Retell implementation. Same status as Vapi. | compiled-inactive |

## The contract

Every provider extends `VoiceProvider` and implements:

```js
async createAgent(agent, systemPrompt)              // returns { providerRef, raw }
async updateAgent(providerRef, agent, systemPrompt)
async deleteAgent(providerRef)
async listVoices({ language, gender, age, accent, useCase, search, page })
async previewVoice(voiceId, { language, sampleText })
async attachPhoneNumber({ providerRef, twilioNumber, twilioCreds })
async startOutboundCall({ agentRef, phoneNumberRef, toE164, leaseToken, metadata, dynamicVariables, firstMessageOverride })
async endCall(providerCallId)
```

Callers never `require('./vapi.provider')` or `require('./elevenlabs.provider')` directly — always go through `factory.js`:

```js
const { buildVoiceProvider } = require('./factory');
const provider = buildVoiceProvider({ agent });
```

## The duplicate folder problem (resolved)

There used to be a second voice-provider tree at `backend/src/services/providers/` from a prior merge. PR #9 (workstream 1.1 of the Phase-1 plan) consolidated it:

- The duplicate folder was deleted.
- `call.service.js` and `agent.service.js` now import from this canonical `factory.js`.
- The canonical interface gained the methods the duplicate had (notably `createAgent`/`updateAgent`/`deleteAgent`).
- The factory registers only `elevenlabs` + `mock` (plus a `pipecat` alias routing to mock for legacy `agent.provider` enum values).

This folder is the single voice-provider tree. Do not recreate provider implementations elsewhere.

## Phase-4 reactivation path

If we ever flip back to Vapi:

```js
// factory.js — one-line change
const DEFAULT_PROVIDER = process.env.VOICE_PROVIDER || "vapi"; // was "elevenlabs"
```

Plus a data migration script (`scripts/migrate-elevenlabs-to-vapi.js`, designed in the deferred-to-Phase-4 plan `implementation-plan-vapi-twilio-billing.md`; that plan document has since been removed from `docs/`).

This is why the Vapi file stays in this folder. Deleting it would force a full re-implementation if Phase 4 ever needs to swap.
