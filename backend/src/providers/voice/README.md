# `backend/src/providers/voice/` — canonical voice provider abstraction

> **Per [Scope Contract §I.5](../../../../docs/Aurora-v1-Scope-and-Build-Contract.md):**
> *"No vendor SDK imported directly — all voice goes through `VoiceProvider`. Phase 1 = **ElevenLabs CAI** registered; **Vapi compiled but NOT registered** in the factory."*

## What lives here

| File | Role | Phase-1 status |
|---|---|---|
| `interface.js` | The base `VoiceProvider` interface every provider implements. | active |
| `factory.js` | Registers concrete providers and builds instances by name (`agent.provider`). | active |
| `mock.provider.js` | No-op provider for tests + `VOICE_PROVIDER_FORCE_MOCK=1`. | active |
| `elevenlabs.provider.js` | The Phase-1 runtime. Implements CAI agent CRUD, KB ingestion, outbound calls, voice library, previews. | **planned in PR #9** (workstream 1.2 in the [Phase-1 plan](../../../../docs/implementation-plan-phase-1.md)) |
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

## The duplicate folder problem

There is a second voice-provider tree at `backend/src/services/providers/` that exists due to a prior merge. It has parallel implementations of `vapi.provider.js`, `retell.provider.js`, `pipecat.provider.js`, and its own `voice-provider.interface.js`. `call.service.js` and `agent.service.js` import from it; the workers (`dialer.worker.js`, `retry.worker.js`, etc.) import from this canonical folder.

**This is being consolidated in PR #9** (workstream 1.1 of the Phase-1 plan). When that lands:
- The duplicate folder is deleted.
- `call.service.js` and `agent.service.js` are migrated to import from this canonical `factory.js`.
- The canonical interface gains the methods the duplicate had that this side was missing (notably `createAgent`/`updateAgent`/`deleteAgent`).
- The factory de-registers `vapi` and `retell`, leaving only `elevenlabs` (+ `mock` for tests) registered.

Until PR #9 ships, both folders coexist. Do not add new consumers of `backend/src/services/providers/*` — point them at this canonical folder instead.

## Phase-4 reactivation path

If we ever flip back to Vapi:

```js
// factory.js — one-line change
const DEFAULT_PROVIDER = process.env.VOICE_PROVIDER || "vapi"; // was "elevenlabs"
```

Plus the data migration script `scripts/migrate-elevenlabs-to-vapi.js` (designed in [implementation-plan-vapi-twilio-billing.md](../../../../docs/implementation-plan-vapi-twilio-billing.md), the deferred-to-Phase-4 plan).

This is why the Vapi file stays in this folder. Deleting it would force a full re-implementation if Phase 4 ever needs to swap.
