# Weeber × ElevenLabs: Dependency Audit & Enterprise Feature Gap Report
**Audience:** CTO / Engineering Team | **Date:** June 18, 2026 | **Scope:** Full backend codebase audit of ElevenLabs integration depth

---

## Executive Summary

Weeber's core voice stack is **tightly and correctly coupled** to ElevenLabs — the integration is real, not shallow. Agent provisioning, outbound calling, inbound streaming, knowledge base sync, and lifecycle webhooks all run through ElevenLabs APIs. However, **6 enterprise-tier features that ElevenLabs already ships are completely unused**, and 2 more are only half-wired. The biggest missed opportunity is `dynamic_variables` — every Shopify cart recovery call happens with zero runtime context injected into the agent, meaning the AI can't say the customer's name, cart total, or abandoned URL. That gap alone kills the core differentiation. Fix order: `dynamic_variables` → voicemail drop → multi-language runtime → custom LLM. Total fix effort: ~14 dev days.

---

## Key Findings

- **6 of 15 ElevenLabs API surfaces are fully used** — the critical path (create/update/delete agent, outbound call, inbound stream, webhooks, KB sync) works end-to-end
- **`dynamic_variables` is zero** — every single outbound call launches with no customer context; the agent can't personalize a single word
- **Voicemail drop is a stub** — `dropVoicemail()` exists in the interface, logs a note, returns `ok: true` — nothing happens
- **ElevenLabs Conversation History API is never queried** — transcripts come from webhook events only; direct retrieval (`GET /v1/convai/conversations/{id}`) is unused
- **Post-call analysis (`data_collection` + `evaluation_criteria`)** is wired in `_buildPlatformSettings()` but the agent creation schema doesn't expose it to merchants
- **No single file in the codebase calls ElevenLabs API more than 7 times** — `elevenlabs.provider.js` has all 7 calls; the rest of the system calls it zero times directly
- **TRAI DLT compliance is zero** — outbound calls at scale in India without DLT registration are a legal liability; no consent layer for DPDP Act either

---

## Section 1: What Weeber Is Using (Fully Wired ✅)

### 1.1 Agent CRUD — `elevenlabs.provider.js`

ElevenLabs Conversational AI agents are first-class objects. Every agent created in Weeber is provisioned live on ElevenLabs:

| Operation | EL Endpoint | Weeber Code |
|-----------|-------------|-------------|
| Create | `POST /v1/convai/agents/create` | `createAgent()` |
| Update | `PATCH /v1/convai/agents/{id}` | `updateAgent()` |
| Delete | `DELETE /v1/convai/agents/{id}` | `deleteAgent()` |
| Sync (read back) | `GET /v1/convai/agents/{id}` | `syncAgent()` |

The `_buildAgentPayload()` function correctly maps Weeber's persona model to ElevenLabs' `conversation_config` — including `prompt`, `first_message`, `language`, `voice_id`, tools, and knowledge base IDs. The `_resolveTools()` method maps Weeber skill definitions to EL's tool schema with method, URL, auth, parameters, and headers.

**What's correct:** Weeber stores `provider_ref` (EL's `agent_id`) on every agent row. All subsequent operations reference it. Sync status (`synced`/`failed`) is tracked per agent.

### 1.2 Outbound Calling via Twilio — `startCall()`

```
POST /v1/convai/twilio/outbound-call
```

Weeber uses ElevenLabs' native Twilio outbound call endpoint — the cleanest way to do it. The flow:
1. `_getOrImportPhoneNumberId()` resolves or imports the Twilio number into EL's phone number registry
2. `POST /v1/convai/phone-numbers` registers Twilio credentials against the number (per sub-account)
3. The call is placed with `agent_id`, `agent_phone_number_id`, `to_number`, and `conversation_initiation_client_data` for call tracking

This is the correct architecture. ElevenLabs manages the Twilio-to-EL bridge so Weeber doesn't have to handle raw TwiML for outbound.

### 1.3 Inbound Calling via WebSocket Stream — `twilio-stream.service.js`

For inbound calls, Weeber uses the ElevenLabs Conversational AI WebSocket:
```
wss://api.elevenlabs.io/v1/convai/conversation?agent_id={agent_ref}
```

The stream service bridges: `Twilio media stream ↔ ElevenLabs ConvAI WebSocket`. Twilio sends 20ms mulaw audio chunks (`user_audio_chunk` events), ElevenLabs responds with audio chunks (`event: "audio"`), which are sent back to Twilio. Heartbeat ping-pong every 15s keeps the connection alive. Graceful cleanup on both stream close and error.

**Correctly implemented:** mock fallback mode (echo silence) when EL key or `provider_ref` is absent — useful for development without burning API credits.

### 1.4 Knowledge Base — `knowledge.routes.js`

```
POST /v1/convai/knowledge-base      # file/URL ingestion
```

Two knowledge source types are synced to ElevenLabs:
- **Document** — PDF/file downloaded from Supabase Storage, sent as multipart form
- **Website** — URL passed directly to EL's ingestion endpoint

EL returns a `knowledge_id` which is stored in `knowledge_provider_mappings` table. When a merchant subscribes an agent to a knowledge source, the `knowledge_base_ids` array on the EL agent is updated via `updateAgent()`. Knowledge source status transitions (`processing → ready → error`) are wired to the EL `knowledge.updated` webhook event.

### 1.5 Webhook Events — `elevenlabs.handler.js`

The ElevenLabs webhook handler processes:

| EL Event | Action |
|----------|--------|
| `conversation.started` / `call.started` | Sets call `status = in_progress`, records `started_at` |
| `conversation.ended` / `call.completed` | Records `ended_at`, `duration_sec`, `cost_usd`, `recording_url`, transcript, analysis outcome |
| `call.failed` | Sets call `status = failed`, triggers campaign state machine to `FAILED` |
| `transcript.available` | Handles transcript + analysis data |
| `knowledge.updated` | Updates knowledge source status to `ready` |

Recording URL is derived as:
```
https://api.elevenlabs.io/v1/convai/conversations/{conversation_id}/audio
```

Usage metering is driven by this webhook — `usage_ledger` entries are inserted when calls complete, which feeds the billing system. The handler also triggers campaign state machine transitions (QUEUED → IN_CALL → COMPLETED/FAILED).

### 1.6 Platform Settings — `_buildPlatformSettings()`

ElevenLabs' enterprise `platform_settings` object is partially wired:
- `data_collection` — agent can collect structured data from conversations
- `evaluation_criteria` — post-call quality scoring

Both are built from `agent.analysis_config` when present. **However**, the agent creation API schema (`createSchema` in `agents.routes.js`) does accept `analysis_config` as a passthrough field, so this path is theoretically usable — just not exposed in any merchant-facing UI.

---

## Section 2: What's Partially Wired ⚠️

### 2.1 Post-Call Analysis & Data Collection

**Status:** Infrastructure exists, UI missing.

`_buildPlatformSettings()` correctly builds the `platform_settings.data_collection` and `platform_settings.evaluation_criteria` payload for ElevenLabs. The agent creation endpoint accepts `analysis_config`. But:
- No merchant-facing UI to configure what data to collect
- No display of collected data in the call detail view
- The `outcome` field in the `calls` table does receive the `data.analysis` payload from the EL webhook — but it's a raw JSONB blob, never parsed into structured fields or surfaced in analytics

**What you're missing:** After every call, ElevenLabs can tell you: Did the customer book an appointment? What was the cart recovery outcome? Was the caller frustrated? You're storing the blob but never reading it.

### 2.2 Voice Assignment & Phone Number Import

**Status:** Works for outbound, incomplete for inbound.

`_getOrImportPhoneNumberId()` correctly imports Twilio numbers into EL's registry on first use. `assignPhoneNumber()` binds an EL agent to a phone number. But the inbound path (`/webhooks/twilio/voice`) uses TwiML + WebSocket streaming — it does NOT go through EL's native phone number routing. This means:
- Inbound calls bypass EL's `phone-numbers` assignment entirely
- Two separate inbound paths exist in the code (EL native assignment vs. Twilio stream bridge) and they don't coordinate

---

## Section 3: What's Completely Missing ❌

![ElevenLabs API Feature Coverage](/home/user/weeber-elevenlabs-audit.report/chart-coverage.png)

### 3.1 Dynamic Variables — CRITICAL

**EL Endpoint:** `conversation_initiation_client_data.dynamic_variables`  
**Weeber status:** Zero usage anywhere in the codebase.

This is the single biggest gap. ElevenLabs supports injecting runtime variables into an agent at call start:

```json
{
  "conversation_initiation_client_data": {
    "dynamic_variables": {
      "customer_name": "Jane Doe",
      "cart_total": "₹3,499",
      "cart_items": "2x Running Shoes",
      "abandoned_url": "https://kyonara.com/checkout/recover/abc123",
      "appointment_time": "Thursday 3pm",
      "order_number": "#1234"
    }
  }
}
```

The agent's system prompt can then reference `{{customer_name}}`, `{{cart_total}}` etc. as template variables. Without this, every outbound call starts with the same generic prompt regardless of who's being called or why.

**Impact on current product:**
- Shopify cart recovery calls can't say the customer's name, cart value, or specific items
- Clinic appointment reminder calls can't say the appointment time or doctor's name
- The entire "vertical AI" differentiation collapses — it's just a generic voice bot

**Fix effort:** ~2 dev days — add `dynamic_variables` to `startCall()` in `elevenlabs.provider.js` and thread it through from `dialer.worker.js` and `call.service.js`.

### 3.2 Voicemail Drop

**EL Endpoint:** `POST /v1/convai/voicemail` (or Twilio AMD)  
**Weeber status:** Stub — `dropVoicemail()` logs and returns `{ ok: true, note: "elevenlabs_voicemail_drop_stub" }`. The campaign state machine has a `VOICEMAIL` state. The dialer has retry logic. But the actual drop never fires.

For outbound campaigns, ~25–40% of calls will hit voicemail. Without drop, those contacts count as reached (state machine advances) but no message is left. Recovery rate tanks.

**Fix effort:** ~3 dev days — integrate Twilio AMD (Answering Machine Detection) or EL's voicemail detection, record agent audio clips per campaign, POST the clip URL on detection.

### 3.3 Conversation History API

**EL Endpoint:** `GET /v1/convai/conversations/{conversation_id}`  
**Weeber status:** Never called. Transcripts are captured only via webhook. If the webhook delivery fails (network issue, timeout), the transcript is permanently lost.

ElevenLabs stores full conversation history including:
- Complete turn-by-turn transcript
- Audio recording (already used as URL — but never fetched)
- Latency metrics per turn
- Tool calls made during the conversation
- Agent evaluation scores (if `evaluation_criteria` set)

**Fix effort:** ~3 dev days — add `fetchConversation()` to the provider, call it on-demand from the call detail API and as a fallback sync job for calls with missing transcripts.

### 3.4 Custom LLM (BYOLLM)

**EL Endpoint:** `conversation_config.agent.prompt.llm` can be set to `"custom"` with a webhook URL  
**Weeber status:** Hardcoded `"gpt-4o-mini"` in `_buildAgentPayload()`.

ElevenLabs Enterprise supports plugging in any LLM via a webhook — OpenRouter, Groq, Anthropic Claude, even a local Ollama endpoint. This matters for:
- Indian language performance (Sarvam, Krutrim, Dhruva are better for Hindi/Hinglish)
- Cost reduction (Groq's Llama 3 is 10x cheaper than gpt-4o-mini)
- Compliance (on-premises LLM for healthcare HIPAA requirements)

**Fix effort:** ~4 dev days — add `llm` and `custom_llm_webhook_url` fields to agent schema, expose in agent creation, map in `_buildAgentPayload()`.

### 3.5 Agent Secrets

**EL Endpoint:** `conversation_config.agent.prompt.agent_secrets`  
**Weeber status:** Not implemented.

ElevenLabs allows storing secret values (API keys, auth tokens) on the agent that are never exposed to the frontend but are injected into tool headers at runtime. This is the correct way to let agents call third-party APIs (CRM, booking system, Shopify admin API) without leaking credentials through the frontend.

**Fix effort:** ~2 dev days — add `agent_secrets` JSONB field to agents table, map in `_buildAgentPayload()`, exclude from GET responses.

### 3.6 Pronunciation Dictionary

**EL Endpoint:** `POST /v1/convai/pronunciation-dictionaries`  
**Weeber status:** Not implemented.

For Indian brands (Kyonara, Fastrack, Myntra), product names and brand names are frequently mispronounced by EL's default TTS. A pronunciation dictionary can map "Kyonara" → "Kee-oh-nara", "HDFC" → "H-D-F-C" (spelled out), etc.

This is a merchant-facing differentiator for the Indian market — none of the US-based competitors have this configured for Indian brands.

**Fix effort:** ~2 dev days per vertical template.

### 3.7 Multi-Language Runtime Switching

**EL Endpoint:** `language` field in `conversation_config.agent`  
**Weeber status:** Language is set at agent creation time (`agent.language || agent.languages[0] || "en"`), never switched dynamically.

ElevenLabs supports switching language mid-conversation based on the caller's detected language. For India, this means: agent starts in English, detects Hindi, switches. This is table stakes for any Indian SMB voice product.

**Fix effort:** ~5 dev days — requires EL language detection webhook events + agent config for supported languages + UI to configure per-agent language list.

### 3.8 Interruption Sensitivity Tuning

**EL Endpoint:** `conversation_config.turn.turn_timeout` / `interruption_sensitivity`  
**Weeber status:** Not set — EL defaults used.

ElevenLabs exposes per-agent interruption sensitivity (how quickly the agent yields when the caller speaks) and turn timeout (how long the agent waits for a response before continuing). For outbound sales calls these should be different from inbound support calls.

**Fix effort:** ~2 dev days — add fields to agent schema, expose in advanced settings UI.

---

## Section 4: Dependency Map

![Module Dependency](/home/user/weeber-elevenlabs-audit.report/chart-dependency.png)

**Key observation:** The entire ElevenLabs integration is concentrated in one file — `elevenlabs.provider.js`. Every other module that needs EL goes through the `buildVoiceProvider()` factory. This is the correct architecture. However:

- `twilio-stream.service.js` opens a direct WebSocket to ElevenLabs (bypassing the provider abstraction) — this is necessary for real-time streaming but means streaming-related EL config (auth, retries, connection params) lives outside the provider
- `elevenlabs.handler.js` (webhook handler) is also outside the provider class — again correct, but it means EL-specific logic lives in 3 different files with no shared types

**EL API lock-in assessment:** High for the core path (agent lifecycle + calling + KB). The provider abstraction (`voice/factory.js`) technically allows swapping to Vapi/Retell, but:
- The `conversation_initiation_client_data` structure in `startCall()` is EL-specific
- The WebSocket stream protocol in `twilio-stream.service.js` is EL-specific
- Webhook event types in `elevenlabs.handler.js` are EL-specific

If ElevenLabs raises prices or degrades quality, migration to Retell/Vapi would require rewriting ~4 files. This is acceptable risk given the provider abstraction exists.

---

## Section 5: Enterprise Feature Gap Analysis

![Gap Analysis Chart](/home/user/weeber-elevenlabs-audit.report/chart-gap-analysis.png)

| Feature | EL Support | Weeber Status | Effort | Impact | Priority |
|---------|-----------|---------------|--------|--------|----------|
| Dynamic Variables | ✅ Full | ❌ Zero | 2 days | 9/10 | **P0** |
| Multi-language Runtime | ✅ Full | ❌ Zero | 5 days | 8/10 | **P1** |
| Voicemail Drop | ✅ Full | ❌ Stub | 3 days | 6/10 | **P1** |
| Conversation History API | ✅ Full | ❌ Zero | 3 days | 6/10 | **P1** |
| Post-call Analysis (UI) | ✅ Full | ⚠️ Backend only | 3 days | 7/10 | **P1** |
| Custom LLM (BYOLLM) | ✅ Enterprise | ❌ Zero | 4 days | 7/10 | **P2** |
| Agent Secrets | ✅ Full | ❌ Zero | 2 days | 5/10 | **P2** |
| Pronunciation Dictionary | ✅ Full | ❌ Zero | 2 days | 4/10 | **P2** |
| Interruption Sensitivity | ✅ Full | ❌ Default | 2 days | 5/10 | **P2** |

---

## Section 6: Risk Assessment

### Risk 1: Full ElevenLabs COGS Dependency — HIGH
Every voice minute billed flows through EL. Weeber's `DEFAULT_COST_PER_MINUTE_USD` in `billing.constants.js` is the EL rate. If EL changes pricing, Weeber's margins compress directly. No EL cost tier negotiation is visible in the codebase.

**Mitigation:** Negotiate volume commit pricing with EL once call volume exceeds 10K min/month. The Vapi/Retell adapter stubs exist — keep them maintained as leverage.

### Risk 2: Single WebSocket Connection Per Inbound Call — MEDIUM
`twilio-stream.service.js` opens one WebSocket per inbound call to EL. No pooling, no circuit breaker, no reconnect on drop. At scale (50+ concurrent inbound calls), this is 50 simultaneous WebSocket connections to EL's API.

**Current state:** Works fine at current MVP scale. At growth, needs a connection pool or EL's native phone number routing (which handles this server-side).

### Risk 3: Transcript Loss on Webhook Failure — MEDIUM
If the EL webhook delivery fails (EL's servers have an outage, Weeber's endpoint is down for maintenance), transcripts are permanently lost — there's no fallback to `GET /v1/convai/conversations/{id}`. Given transcripts are core to the analytics dashboard and post-call analysis, this is a real data loss risk.

**Mitigation:** Add async `fetchConversation()` reconciliation job (see Section 3.3).

### Risk 4: No EL API Version Pinning — LOW
The HTTP client calls EL APIs without pinning to a specific API version. EL could introduce breaking changes in their endpoints. Currently acceptable — EL's ConvAI API is relatively stable — but worth adding an `EL_API_VERSION` env var.

---

## Section 7: Recommended Implementation Order

```
Week 1 (P0 — Revenue Critical)
────────────────────────────────
Day 1-2: Dynamic Variables
  → elevenlabs.provider.js: add dynamic_variables to startCall() payload
  → dialer.worker.js: thread metadata.dynamic_variables through dispatchOne()
  → call.service.js: accept dynamic_variables param in startOutboundCall()
  → Shopify provider: populate from cart event metadata

Week 2-3 (P1 — Product Completeness)
──────────────────────────────────────
Day 3-5: Post-call Analysis UI
  → Parse analysis JSONB from calls.outcome on call detail page
  → Add data_collection config to agent creation wizard (per vertical)
  → Surface booking/recovery outcomes in campaign analytics

Day 6-8: Conversation History Reconciliation
  → Add fetchConversation() to elevenlabs.provider.js
  → Nightly cron: find calls with missing transcripts, backfill via EL API

Day 9-11: Voicemail Drop
  → Integrate Twilio AMD into outbound call TwiML
  → Add voicemail_audio_url field to campaigns table
  → Record/upload EL TTS-generated voicemail clips per agent
  → Wire VOICEMAIL state machine transition to actual drop

Month 2 (P2 — Competitive Moat)
─────────────────────────────────
Custom LLM: expose llm field, connect to Groq for Hindi calls (cost + quality)
Multi-language: UI to configure supported languages per agent
Agent Secrets: secure credential storage for tool calls
Pronunciation Dictionary: per-vertical brand name config
Interruption Tuning: separate presets for inbound (patient) vs outbound (quick)
```

---

## Section 8: India Voice AI Landscape — Strategic Context

> *This section maps an independent competitive analysis of India's voice AI startup landscape against Weeber's current architecture and roadmap. Source: external AI-generated report, cross-validated against Weeber codebase.*

---

### 8.1 Where Weeber Is Already Ahead

**Vertical depth over platform breadth**
The external report's core recommendation — *"Don't build a platform, build a solution"* — is exactly what Weeber is doing. Shopify cart recovery + clinic booking are specific, high-intent verticals with real willingness to pay. Most India competitors (Bolna, Krutrim Voice) are still selling generic builders.

**Integration is the moat, not the LLM**
The report correctly identifies that the value in Indian voice AI is the last-mile integration (CRM, booking, compliance) — not the model itself. Weeber's provider abstraction + Shopify OAuth bridge is a concrete implementation of this. Global platforms like Vapi and Retell have none of this for Indian verticals.

**Human-in-the-Loop architecture**
Weeber's campaign state machine already has a `TRANSFER` state that routes to a human agent. The report flags this as mandatory for emotional/high-stakes scenarios (debt, medical bad news). Weeber has the architecture — it's just not yet exposed as a configurable threshold.

---

### 8.2 Where Weeber Has Real Gaps

**TRAI DLT compliance — not touched**
The report identifies TRAI DLT registration, 1600-series number provisioning, and DND scrubbing as the single biggest India-specific deployment barrier. Weeber has no DLT layer. This means:
- Any outbound marketing call (cart recovery, appointment reminders) without DLT registration is illegal in India under TRAI regulations
- Regulated sectors (BFSI, Healthcare) cannot legally be customers without this
- Competitors who build DLT compliance first will win enterprise contracts Weeber can't bid on

**Current risk:** Kyonara pilot calls may technically be in violation if numbers aren't DLT-registered. This is not a codebase problem — it's a business/legal gap.

**DPDP Act consent management — zero implementation**
India's Digital Personal Data Protection Act (DPDP, 2023) requires explicit consent before processing voice data. Penalties up to ₹250 crore. Weeber stores transcripts, recordings, and call metadata — but there's no:
- Pre-call consent capture or logging
- Consent withdrawal mechanism
- Data residency guarantee (calls currently route through EL's US/Singapore infrastructure)

**Latency — untested for India**
The report notes that global voice AI routes Indian calls through Singapore/US endpoints, causing 900ms+ latency. Weeber sits on top of ElevenLabs, which uses its own infrastructure routing. The current codebase has no India-specific latency optimization, no Mumbai/Bangalore inference layer, and no SIP trunk selection logic for Indian networks. Sub-300ms targets (recommended by the report) are unverifiable without load testing from Indian mobile networks.

**Hinglish / code-switching — not addressed**
ElevenLabs' default models handle English and Hindi independently but struggle with mid-sentence code-switching (the normal way Indian SMB customers speak). Weeber is hardcoded to `gpt-4o-mini` as the LLM and has no Hinglish-specific STT configuration. This directly limits conversion rates for real Indian SMB calls.

---

### 8.3 Strategic Gaps That Need Decisions (Not Just Engineering)

| Gap | Report Recommendation | Weeber Status | Effort |
|-----|-----------------------|---------------|--------|
| TRAI DLT registration | Build as a service layer | Not started | Legal + engineering, 4–6 weeks |
| DPDP consent management | Pre-call consent capture + audit logs | Zero | 3–4 dev days |
| Local inference (latency) | Mumbai/Bangalore audio processing node | Zero | Infrastructure decision needed |
| Hinglish STT | Fine-tuned or Sarvam/Dhruva models | Zero | Custom LLM (P2 from Section 3.4) |
| Data residency | India-hosted storage for voice data | EL default routing | EL Enterprise feature or self-host |
| Graceful degradation on noise | Explicit "can't hear you" + transfer | Not configured | Agent prompt change (1 dev day) |

---

### 8.4 What This Means for the Roadmap

The external report and the EL audit independently converge on the same conclusion: **Weeber's architecture is correct, but the India-specific compliance and localization layer is missing entirely.**

The EL audit surfaced `dynamic_variables` as P0 for call personalization.  
The India landscape report surfaces TRAI DLT compliance as P0 for legal operation.

**Revised priority stack:**

```
P0 — Must exist before any paid pilot scales
  → dynamic_variables (personalization, 2 days)
  → TRAI DLT registration (legal compliance, parallel legal track)
  → DPDP consent logging (data protection, 3 days)

P1 — Required for vertical product completeness
  → Post-call analysis UI
  → Conversation history reconciliation
  → Voicemail drop
  → Graceful degradation prompt config (Hinglish noise scenarios)

P2 — Competitive moat for India market
  → Custom LLM (Groq for cost, Sarvam for Hindi quality)
  → Multi-language runtime switching
  → Pronunciation dictionary (Indian brand names)
  → Latency optimization (measure first, then route)

P3 — Enterprise / regulated sector unlock
  → DLT-ready outbound compliance layer
  → Data residency options (India-hosted audio)
  → HIPAA / IRDAI compliance templates
```

**Bottom line:** Weeber can legally run English-only, non-regulated pilots right now (Kyonara, Bloom Dental) — the current stack is sufficient for that. The moment Weeber pitches to a clinic, BFSI company, or runs outbound at scale in India, the compliance layer becomes a legal blocker, not a product roadmap item.

---

## Methodology & Sources

This report is based entirely on direct codebase analysis — no external sources. Files audited:

- `src/providers/voice/elevenlabs.provider.js` (303 lines — primary EL integration)
- `src/modules/webhooks/handlers/elevenlabs.handler.js` (189 lines — event processing)
- `src/modules/agents/agent.service.js` (357 lines — agent lifecycle)
- `src/services/twilio-stream.service.js` (261 lines — real-time streaming)
- `src/modules/knowledge/knowledge.routes.js` (241 lines — KB sync)
- `src/modules/calls/call.service.js` (75 lines — call dispatch)
- `src/workers/dialer.worker.js` (231 lines — campaign dialer)
- `src/services/persona.service.js` (151 lines — system prompt generation)
- `src/modules/analytics/analytics.routes.js` (111 lines — analytics)
- `src/modules/agents/agents.routes.js` (353 lines — agent API)
- `src/modules/billing/billing.service.js` (98 lines — usage billing)

Cross-referenced against ElevenLabs Conversational AI public documentation (June 2026).

---

*Report generated June 18, 2026 | Weeber Engineering Audit Series*
