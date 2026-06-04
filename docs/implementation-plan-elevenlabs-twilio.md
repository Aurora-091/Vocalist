# Implementation Plan — ElevenLabs CAI + Twilio (Phase 1)

**Status:** Active · **Supersedes:** `implementation-plan-vapi-twilio-billing.md` (kept as Phase 4 reference)
**Owner:** Backend team · **Updated:** 2026-06-04
**Decision context:** Pre-seed, no-code product, customers never see API keys. Engineering velocity dominates per-minute cost optimisation.

---

## 0. The bet

For Phase 1 (pre-seed → seed), Aurora runs **ElevenLabs Conversational AI as the agent runtime** behind a Twilio managed-subaccount telephony layer. We do not build voice orchestration ourselves and we do not run a vector database. The ElevenLabs **Startup Grant gives us 33M characters / ~680 hours of free Conversational AI for 12 months** ($4K+ value), which covers most of pre-seed runway.

We keep the Vapi provider code in the repo behind the same `VoiceProvider` interface — **inactive, not deleted** — so we can switch back when the seed round funds the engineering work to optimise per-minute cost (see Phase 4 in §11).

Our differentiation is not the voice runtime. It is:

1. **Verticalised integrations** (Shopify, Cal.com, calendars, CRMs).
2. **The campaign engine** (state machine + dialer + retries + leases + consent gate).
3. **Outcomes / analytics** scoped to those verticals.

The voice and the LLM are commodities we rent. The bet is that customers buy Aurora because it *closes Shopify carts* and *fills clinic calendars*, not because it has the prettiest TTS voice.

---

## 1. Strategy in one diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                 Aurora console (React, shadcn)                  │
│  Customer-built agents · multi-agent + multi-number per tenant  │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│              Aurora backend (Node + Express + Supabase)         │
│  Orgs · users · auth · plan tiers · spend guards · billing      │
│  Contacts · segments · consent · DNC · can_dial()               │
│  Campaign engine · dialer worker · retry · lease sweeper        │  ← OUR MOAT
│  Integrations: Shopify · Cal.com · Google/Outlook · HubSpot     │
│  Outcomes / analytics RPCs                                       │
└────────┬─────────────────────────┬──────────────────────────────┘
         │                         │
   VoiceProvider                Twilio
   abstraction                  subaccount
   (interface)                  per tenant
         │                         │
  ┌──────┴──────┐                  │
  │             │                  │
  ▼             ▼                  ▼
┌──────────┐ ┌──────┐         ┌────────┐
│ Eleven   │ │ Vapi │         │ Twilio │
│ Labs CAI │ │ (kept│         │ (PSTN, │
│ ACTIVE   │ │  but │         │  numbers,│
│          │ │inactive)│       │  recording)│
└────┬─────┘ └──────┘         └────┬───┘
     │                              │
     │    bound via                 │
     └────POST /v1/convai/──────────┘
          phone-numbers/twilio
```

**Active path:** Aurora → ElevenLabs CAI → Twilio. The dialer and webhook handlers go through the `ElevenLabsProvider`. Vapi provider stays compiled and tested but is not wired into the factory's default registration.

---

## 2. What changes vs PR #5 (Vapi-centric plan)

| Layer | PR #5 plan | This plan |
|---|---|---|
| Agent runtime | Vapi + BYO STT/LLM/TTS | **ElevenLabs CAI** |
| TTS | Deepgram Aura-2 / ElevenLabs Flash via Vapi | **ElevenLabs (bundled in CAI)** |
| STT | Deepgram Nova-3 via Vapi | **ElevenLabs (bundled)** |
| LLM | Passthrough via Vapi BYO | **Passthrough via ElevenLabs CAI** |
| Knowledge Base | pgvector + custom chunker + embedder | **ElevenLabs Knowledge Base API** (auto-RAG, no vector DB) |
| Voice library | Multi-vendor swap | **ElevenLabs catalogue** (200+ voices, 70+ languages) |
| Pre-built personas | "17 templates with personas" | **Empty skeletons per vertical** — customer writes persona |
| Telephony | Twilio | Twilio (unchanged) |
| Campaign engine | Aurora | Aurora (unchanged) |
| Integrations | Aurora | Aurora (unchanged, Phase 3) |
| Billing | Stripe Billing Meters | Stripe Billing Meters (unchanged) |
| Spend guards | Twilio UsageTrigger + dial_allowed + Stripe past_due | Same (unchanged) |
| Vapi provider code | The active provider | **Compiled but inactive; reactivation is a Phase 4 capex decision** |

Engineering complexity reduction vs PR #5: **~40% less code, no Vapi assistant lifecycle to wire, no deferred cost-fetch worker (ElevenLabs returns final cost in the webhook), no vector DB / embedding pipeline, no dual provider operations.**

---

## 3. ElevenLabs Startup Grant — apply day 1

| Field | Value |
|---|---|
| Program | [ElevenLabs Startup Grants](https://elevenlabs.io/startup-grants) |
| Credits | 33,000,000 characters · ~680 hours of Conversational AI |
| Duration | 12 months free |
| Equivalent retail | ~$4,000+ |
| Eligibility | <25 employees, pre-seed to Series A, clear monetisation plan |
| Obligations | Display "ElevenLabs Grants" logo on website for 12 months |
| Application | <https://elevenlabs.io/grants-application> |

Action item before any code ships: file the application. The eligibility check is trivial for us. The character allowance covers ~680 hours of CAI — at our projected 1,500 minutes/month per active customer that's ~25 customer-months of voice on the house. Cash runway extension for free.

Concurrent: contact ElevenLabs sales (`sales@elevenlabs.io`) with one paragraph confirming the SaaS-on-API usage pattern (Aurora-branded product, customers don't see ElevenLabs, we pay one bill). File the email reply with legal.

---

## 4. Product surface — exactly what the customer sees

The customer builds the agent. We do not write personas for them. Every field below is owned by the customer, defaults are blank or vertical-suggested only.

### 4.1 Create agent

```tsx
<AgentNew vertical={org.vertical}>
  <Skeletons />               {/* "Sales" / "Support" / "Cart Recovery"        */}
                              {/* for Shopify; "Appointment" / "Intake" /      */}
                              {/* "Reminders" for Clinic. Just starter names.  */}

  <Input label="Agent name"     placeholder="e.g. Front Desk Sarah" />
  <Textarea label="Persona"     placeholder="Describe how the agent should talk
                                              and what it should do" rows={5} />
  <VoicePicker  source="elevenlabs"  preview />
  <LanguagePicker options={["en","es"]} />
  <Input label="Opening message — inbound"
         placeholder="e.g. Hi, thanks for calling Acme Dental. How can I help?" />
  <Input label="Opening message — outbound"
         placeholder="e.g. Hi {first_name}, this is Sarah from Acme calling
                          about your appointment tomorrow." />

  <KnowledgeUploader sources={["pdf","url","docx","txt"]} />
  {/* uploads pipe directly to ElevenLabs KB; we just store the kb_doc_id */}

  <Button>Save</Button>
  <Button variant="outline">Test call yourself</Button>  {/* capability #18 */}
</AgentNew>
```

**Zero pre-written personas, zero "Maya" defaults.** Skeletons exist only to label common vertical use cases for navigation/filtering, not to inject text.

### 4.2 Knowledge sources — what the customer can upload

ElevenLabs KB API accepts all of:

| Source | Endpoint | Notes |
|---|---|---|
| PDF | `POST /v1/convai/knowledge-base/file` | multipart upload |
| Word doc (.docx) | same | same |
| Plain text / markdown | `POST /v1/convai/knowledge-base/text` | raw body |
| Website URL | `POST /v1/convai/knowledge-base/url` | ElevenLabs scrapes + indexes |
| Re-sync URL | re-POST same endpoint | covers content updates without re-uploading |

Aurora UI exposes all 4 ingestion types. After upload we trigger `POST /v1/convai/knowledge-base/{id}/rag-index` and poll until `status=ready`. Customer sees: `Uploading → Indexing → Ready` lifecycle, matches Build Contract capability §7.

### 4.3 Multi-agent + multi-number per tenant

Already in the schema (`agents`, `phone_numbers` both `org_id`-scoped, no 1:1 constraint). Frontend just needs to surface it.

**Plan tier caps** enforce limits (PR #5 §3 spend guards add the middleware):

| Plan | Max agents | Max numbers |
|---|---|---|
| Trial | 1 | 1 |
| Starter | 3 | 1 |
| Growth | 10 | 3 |
| Scale | unlimited | unlimited |

**Shopify tenant example:** the merchant can have a "Sales Agent" on a sales line, a "Support Agent" on the support line, and a "Cart Recovery Agent" that places outbound calls from a third number. Three agents, three numbers, one tenant.

**Clinic tenant example:** practice manager has an "Appointment Booking Agent" on the main line and an "Intake Triage Agent" on a secondary line. Two agents, two numbers, one tenant.

### 4.4 The vertical is the integrations, not the persona

A Shopify-vertical org gets:
- Shopify connect button on `/integrations`
- Webhook handler ingesting `checkouts/abandoned` → enqueues outbound campaign target
- Agent tools available: `lookup_order`, `apply_discount_code`, `update_address`, `cancel_order`
- Contact fields auto-mapped: `customer.first_name`, `customer.email`, `last_order_total`

A Clinic-vertical org gets:
- Cal.com / Google Cal / Outlook Cal connect buttons
- Agent tools: `book_appointment`, `reschedule_appointment`, `cancel_appointment`, `check_availability`
- Contact fields: `patient_name`, `last_visit_date`, `provider_name`

Same agent runtime in both cases. The vertical is purely the bag of tools + integration triggers + recommended skeleton names. This is what the existing `vertical_configs` migration is designed for — we just need to populate the two seed rows.

---

## 5. Mapping Aurora data → ElevenLabs CAI

| Aurora concept | ElevenLabs CAI concept | Notes |
|---|---|---|
| `agents.id` (Aurora) | `agent_id` (ElevenLabs) — stored in `agents.provider_ref` | created on agent insert, deleted on agent soft-delete |
| `agents.persona` (JSONB) | `agent.conversation_config.agent.prompt.prompt` | `generateSystemPrompt(persona)` already exists in `utils/promptBuilder.js` |
| `agents.voice_id` | `agent.conversation_config.tts.voice_id` | ElevenLabs voice catalogue |
| `agents.languages[0]` | `agent.conversation_config.agent.language` | EN/ES for v1 |
| `agents.persona.opening_message_inbound` | `agent.conversation_config.agent.first_message` | shown when inbound |
| `agents.persona.opening_message_outbound` | passed via `conversation_initiation_client_data.conversation_config_override.agent.first_message` per outbound call | so we can interpolate `{first_name}` per contact |
| `agents.business_hours` + `timezone` | enforced **by Aurora** in `can_dial()` before initiating outbound; for inbound we route out-of-hours calls to voicemail behaviour via agent config | capability #19 |
| `agents.transfer_number` | `agent.conversation_config.agent.client_events` tool: `transfer_call` | capability #21 |
| `agents.voicemail_message` | `agent.conversation_config.agent.voicemail` | capability §C |
| `knowledge_sources.provider_ref` | ElevenLabs `documentation_id` | one KB doc per source |
| `agent_knowledge` join | ElevenLabs `agent.conversation_config.agent.prompt.knowledge_base.documents` array | rebuilt on subscription change |
| `phone_numbers.vapi_phone_number_id` | rename to `phone_numbers.provider_ref` (provider-agnostic) | ElevenLabs returns `phone_number_id` |
| `calls.provider_call_id` | ElevenLabs `conversation_id` | already exists in schema |
| `calls.cost_usd` + `cost_breakdown` | ElevenLabs returns final cost in `conversation_completed` webhook | no deferred fetch needed |

The existing schema covers everything. Two minor changes (§9 below).

---

## 6. Outbound dialer flow (current code, swapped provider)

```js
// backend/src/workers/dialer.worker.js — unchanged except for provider name
const provider = getProvider("elevenlabs");      // was "vapi"

const result = await provider.startOutboundCall({
  agentRef: agent.provider_ref,                  // ElevenLabs agent_id
  phoneNumberRef: number.provider_ref,           // ElevenLabs phone_number_id
  toE164: contact.e164,
  leaseToken: target.lease_token,
  metadata: {
    aurora_org_id: campaign.org_id,
    aurora_call_id: callId,
    aurora_campaign_id: campaign.id,
    aurora_contact_id: contact.id,
  },
  dynamicVariables: {
    first_name: contact.name?.split(" ")[0] ?? "",
    business_name: org.name,
  },
  firstMessageOverride: agent.persona.opening_message_outbound,
});
```

Under the hood `ElevenLabsProvider.startOutboundCall` POSTs to:

```
POST https://api.elevenlabs.io/v1/convai/twilio/outbound-call
{
  "agent_id": agentRef,
  "agent_phone_number_id": phoneNumberRef,
  "to_number": toE164,
  "call_recording_enabled": true,
  "conversation_initiation_client_data": {
    "conversation_config_override": {
      "agent": { "first_message": firstMessageOverride }
    },
    "dynamic_variables": dynamicVariables,
    "metadata": metadata
  }
}
```

Returns `conversation_id` and `callSid`. We persist `calls.provider_call_id = conversation_id`. The Twilio CallSid is kept in `calls.outcome.twilio_call_sid` for log correlation.

**The campaign state machine, lease-token mismatch detection, retry worker, and lease sweeper are all unchanged.** They operate above the provider boundary.

---

## 7. Webhook flow

ElevenLabs CAI emits webhooks at:
- `conversation_started` — `calls.status = in_progress`, `started_at`
- `conversation_completed` — final everything: `status`, `ended_at`, `duration_sec`, `cost_usd`, `cost_breakdown`, `transcript`, `recording_url`
- `tool_call` (per-event) — log into `call_events` for analytics

Crucially: **ElevenLabs returns final cost in `conversation_completed`**, no stale-data problem. We delete PR #5 §3.5 (the deferred cost-fetch worker) entirely.

Signature verification: ElevenLabs uses HMAC-SHA256 with a workspace-level secret. We already have `verifyHmacSha256` in `utils/signature.js`.

```js
// backend/src/modules/webhooks/handlers/elevenlabs.handler.js (new)
async function handle(payload) {
  const conv = payload.conversation_id;
  const callRow = await admin.from("calls").select(...)
    .eq("provider_call_id", conv).maybeSingle();
  if (!callRow) return { skipped: "unknown_call" };

  if (payload.type === "conversation_completed") {
    await admin.from("calls").update({
      status: mapStatus(payload.status),
      ended_at: payload.ended_at,
      duration_sec: payload.duration_seconds,
      cost_usd: payload.cost?.total_usd ?? 0,
      cost_breakdown: payload.cost ?? {},
      recording_url: payload.recording_url,
      transcript: payload.transcript,
      outcome: payload.metadata?.outcome ?? {},
    }).eq("id", callRow.id);

    if (callRow.campaign_id) {
      await transition(admin, {
        targetId: ...,
        fromState: STATES.IN_CALL,
        toState: targetStateFor(payload.status),
        reason: `elevenlabs:${payload.status}`,
        callId: callRow.id,
        orgId: callRow.org_id,
      });
    }

    await metering.recordVoiceMinutes(admin, {
      orgId: callRow.org_id,
      callId: callRow.id,
      durationSec: payload.duration_seconds,
      providerCallId: conv,
    });
  }
}
```

---

## 8. Cost model (with grant)

For year 1, the math is dominated by the grant.

| Scenario | Aurora cost | Customer-charged | Net |
|---|---|---|---|
| Grant period (first 33M chars ≈ 680 hours of CAI) | $0 ElevenLabs + Twilio only ~$0.025–0.042/min | Starter $99 + overage | ~95% gross margin |
| Post-grant Default (Eleven CAI Pro $99/mo + per-min) | $0.08 × min (95% silence discount applies) + Twilio | Starter $99 → Scale $1,499 | 110–190% margin (matches PR #5) |
| LLM passthrough (GPT-4o-mini) | ~$0.015/min | (included in our tier price) | absorbed |
| KB ingestion | counted against character credits — effectively free during grant | included in tier | absorbed |

**Practical implication:** the first ~25 customer-months of voice are essentially free. We should be **aggressive on Trial → paid conversion** during this window and avoid signing Scale-tier price-sensitive customers until our own per-minute costs are predictable. The grant lets us subsidise customer-onboarding minutes (free trial 25 min → 100 min) without bleeding cash.

---

## 9. Database changes (minimal, additive)

```sql
-- §5 mapping — provider-agnostic naming
alter table phone_numbers rename column vapi_phone_number_id to provider_ref;
-- (if the prior migration shipped under the old name; otherwise create as provider_ref)

-- §4.1 — opening messages live in persona JSONB, no schema change
--   persona.opening_message_inbound  text
--   persona.opening_message_outbound text
-- (no DDL needed since persona is JSONB)

-- §C / capability §19 — voicemail (carried over from PR #5)
alter table agents add column voicemail_message text;

-- §7 — cost breakdown column
alter table calls add column cost_breakdown jsonb not null default '{}';

-- §10 — provider abstraction in DB enum
-- already supports vapi/retell/pipecat; add 'elevenlabs'
alter type voice_provider add value if not exists 'elevenlabs';
```

That's it. **No new tables. No pgvector. No `knowledge_chunks` table** (we delete that one from the prior knowledge_base migration plan — ElevenLabs owns the chunks).

Note: `knowledge_sources` keeps its existing columns plus `provider_ref text` to hold the ElevenLabs `documentation_id`.

---

## 10. Workstreams (ordered, each one PR)

Phased by what unblocks the next thing.

### Phase 1 — Core agent runtime (closes capabilities 1, 2, 3, 5, 7, 8, 18, 19, 21, 22, 26)

| # | Workstream | Complexity |
|---|---|---|
| 1.1 | Consolidate `backend/src/providers/voice/` into single canonical interface; mark `vapi.provider.js` `static get name(){return "vapi"}` but **not registered in factory** | shallow |
| 1.2 | Build `ElevenLabsProvider` (createAgent, updateAgent, deleteAgent, listVoices, attachPhoneNumber, startOutboundCall, fetchCallCost) | medium |
| 1.3 | Wire `agent.service` lifecycle to provider (create/update/delete agents on ElevenLabs side) | medium |
| 1.4 | Knowledge ingestion: replace any vector-DB plumbing with thin wrapper on `/v1/convai/knowledge-base/{url,file,text}` + RAG index trigger + status polling | shallow |
| 1.5 | Number-binding: after Twilio purchase, `POST /v1/convai/phone-numbers/twilio` and persist `provider_ref` | shallow |
| 1.6 | Webhook handler for `conversation_started/completed/tool_call` with HMAC verification | shallow |
| 1.7 | Frontend: AgentNew form per §4.1 (shadcn migrate this page first), VoicePicker (lists ElevenLabs voices), KnowledgeUploader (4 source types), Test-call button | medium |
| 1.8 | Voicemail support: `agents.voicemail_message` + push to ElevenLabs agent config | shallow |
| 1.9 | Transfer to human via agent tool (capability §21) | shallow |

### Phase 2 — Campaigns, billing, spend guards (closes 10, 12, 13, 14, 15, 16, 17, 20, 24, 25)

| # | Workstream | Complexity |
|---|---|---|
| 2.1 | Dialer worker calls `ElevenLabsProvider.startOutboundCall` (single line change in worker) | shallow |
| 2.2 | Stripe Billing Meters push from `billing-rollup.worker` (per PR #5 §4) | medium |
| 2.3 | Daily reconciliation worker (per PR #5 §4.3) | shallow |
| 2.4 | Spend guards: Twilio UsageTrigger per subaccount + `dial_allowed()` RPC + `orgs.status='past_due'` flip (per PR #5 §3) | medium |
| 2.5 | Plan tier enforcement middleware (per PR #5 §3) | shallow |
| 2.6 | Billing UI: ledger vs Stripe meter side-by-side (per PR #5 §4.4) | shallow |
| 2.7 | Outcomes/analytics dashboard fed by `conversation_completed` payload | shallow |

### Phase 3 — Vertical integrations (closes 4, 6 partial, 12 triggers)

This is the moat. Phase 3 is where Aurora becomes valuable and not just "a wrapper".

| # | Workstream | Complexity |
|---|---|---|
| 3.1 | **Shopify integration**: OAuth, webhook handler for `checkouts/abandoned`, contact ingest, "cart_recovery" campaign template skeleton | medium |
| 3.2 | **Shopify agent tools**: `lookup_order`, `apply_discount_code`, `update_address`, `cancel_order` — registered as ElevenLabs custom tools on the agent | medium |
| 3.3 | **Cal.com integration**: OAuth, calendar sync, `book_appointment` / `reschedule` / `cancel` tools | medium |
| 3.4 | **Google Calendar / Outlook Calendar**: same shape via OAuth provider abstraction | medium |
| 3.5 | **HubSpot / Salesforce CRM**: read contacts, write call outcomes back | medium |
| 3.6 | **Vertical skeleton seeds**: ~6 starter agent shells per vertical (Shopify: Sales / Support / Cart Recovery; Clinic: Appointment / Intake / Reminders) — name + suggested tool list only, no pre-written persona | shallow |

### Phase 4 — Post-seed optimisation (NOT NOW)

When we have the budget and team, re-evaluate:

| Option | When | Why |
|---|---|---|
| Switch agent runtime back to Vapi with BYO keys | Post-seed, ≥1,000 active customer-months/month | $0.087/min vs $0.10/min × scale = real money. Code already exists, just flip the factory default. |
| Self-host with Pipecat | Post-Series A, ≥10K minutes/month sustained | $0.05–0.06/min landed cost ceiling. Requires SRE team. |
| Per-customer BYO LLM keys for Enterprise | On request | Enables enterprise compliance asks. |
| Twilio Elastic SIP Trunking | When monthly minutes > 100K | Saves ~$0.005/min on inbound. |

**The `VoiceProvider` abstraction is the seam that makes these swaps a refactor, not a rewrite.** That's why we keep the Vapi code compiled and tested.

---

## 11. Acceptance criteria

A milestone counts as done when:

1. **Phase 1.1–1.5:** Creating an agent in the UI provisions an ElevenLabs CAI agent, purchasing a Twilio number binds it, uploading a PDF / URL adds it to the agent's knowledge base, and a real inbound call is answered using the customer's chosen voice + opening message + KB. Logged in `calls` with non-null `recording_url`, `transcript`, `cost_usd`, `cost_breakdown`.
2. **Phase 1.6–1.9:** Voicemail message plays on AMD detection; "Transfer to human" tool successfully bridges to `agents.transfer_number`.
3. **Phase 1.7:** A non-developer can create a working agent in ≤5 minutes without seeing any LLM/prompt/webhook terminology.
4. **Phase 2.1–2.3:** 100 staging outbound campaign calls produce exactly 100 `usage_ledger` rows AND exactly 100 Stripe meter line items with `diff = 0`. Duplicate webhooks don't add rows.
5. **Phase 2.4:** Test tenant exceeding `daily_price_cap` is suspended in ≤90s; cannot place new calls.
6. **Phase 2.5:** Starter tenant cannot create a 4th agent or 2nd number; error is `403 plan_limit_exceeded`.
7. **Phase 3.1–3.2:** A Shopify abandoned-cart event triggers an outbound campaign target, the agent uses the `lookup_order` tool during the call, and the order data appears in the transcript.
8. **Phase 3.3:** A Clinic agent receives an inbound call, uses `check_availability` + `book_appointment`, and the booking appears in Cal.com.
9. **Phase 3.6:** Vertical skeletons seed correctly per `vertical_configs.config` — Shopify org sees Sales/Support/Cart Recovery shells, Clinic org sees Appointment/Intake/Reminders.

---

## 12. Risks and mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| ElevenLabs OEM TOS interpretation conflict | low | high | Pre-launch email to `sales@elevenlabs.io` describing exact pattern (SaaS-on-API, customers don't see brand); keep reply on file. Many comparable SaaS run on this pattern (Synthflow, Outpopt, Air, Decagon). |
| Grant credits exhausted before paid customers cover voice cost | low | medium | 33M chars ≈ 680 hours; at our projected 1,500 min/customer-month that's 25 customer-months. Trial cap at 25 min, Starter at 200 min, hard quota gate stops runaway use. |
| ElevenLabs CAI agent template / config breaking changes | medium | medium | Pin a working agent config schema in `providers/voice/elevenlabs.provider.js`, version-stamp it, add a smoke-test that creates+deletes a probe agent every 15 min in production. |
| Voice quality drift after ElevenLabs model updates | low | medium | Customer picks voice from current catalogue; we expose `model_id` in agent config so we can pin if a particular voice degrades. |
| Concurrency cap (Pro = 20 concurrent calls) hit during campaign blast | medium at scale | medium | Dialer respects `campaigns.concurrency`, default 5 per campaign. Monitor `concurrent_calls` metric; upgrade to Business ($990/mo, 40 concurrent) before the threshold. |
| Twilio toll fraud on a fresh subaccount | low | high (could be $10K in hours) | PR #5 §3 spend guards — daily `price` UsageTrigger per subaccount + auto-suspend + Slack ops alert |
| Vertical integration vendor lock-in (Shopify Partner app deprecated, etc.) | medium | medium | All integrations behind `integrations/providers/*.js` interface; each integration is independently replaceable. |
| Vapi code rots in the repo while inactive | high (low impact) | low | Quarterly health check: `node --check`, run unit tests against it. If it rots, just delete — Phase 4 decision can re-implement against the abstraction. |

---

## 13. What we are explicitly NOT doing in Phase 1

- ❌ Building agent personas for customers (no "Maya", no "Sarah" — these are *examples in the UI placeholder*, not seeded data).
- ❌ Building a vector database / RAG pipeline.
- ❌ Running Vapi in production (kept compiled, inactive).
- ❌ Self-hosted Pipecat (Phase 4).
- ❌ ElevenLabs HIPAA mode (Phase 4 when we have a clinic deal that requires it).
- ❌ Per-customer BYO API keys (we own the ElevenLabs + Twilio billing entirely).
- ❌ Asking customers anything about LLM / TTS / STT / "models" / "prompts" / "webhooks" in the default UI.
- ❌ More than 2 languages (EN/ES). Customers asking for more get a "coming soon" note.

---

## 14. Open questions to decide before Phase 1.7 ships

1. Default voice when customer hasn't picked one? Recommendation: a neutral Eleven default (`Bella` / `Rachel`) with a "you can change this anytime" hint.
2. Default opening message when customer leaves it blank? Recommendation: "Hi, how can I help you today?" for inbound; reject save for outbound (require explicit message per agent because dynamic-variable interpolation needs it).
3. Knowledge base size cap per tenant? Recommendation: 50 docs / 10MB total on Starter, 500 docs / 100MB on Growth, unlimited on Scale.
4. Voice library curation: surface all 200+ ElevenLabs voices or curate to ~30 high-quality ones per language? Recommendation: curate to ~12 EN + ~6 ES voices to reduce choice paralysis; expose "more voices" link for power users.
5. Recording always-on vs opt-in per agent? Recommendation: always-on for compliance/QA (capability §14), with a tenant-level "Don't store recordings" setting for HIPAA-leaning clinics.

---

## 15. Migration plan back to Vapi (Phase 4 reference)

Because we keep the Vapi code:

```js
// backend/src/providers/voice/factory.js — to switch back, change one line:
const DEFAULT_PROVIDER = process.env.VOICE_PROVIDER || "elevenlabs";
//                                                   //  → "vapi"
```

Plus a one-time data migration:
1. For each Aurora `agents` row with `provider = 'elevenlabs'`, create a Vapi assistant via `VapiProvider.createAssistant()`.
2. Update `agents.provider = 'vapi'` and `agents.provider_ref = <vapi_assistant_id>`.
3. For each `phone_numbers` row, re-bind in Vapi via their `POST /phone-number` endpoint.
4. Delete the ElevenLabs agents/numbers in their dashboard.

A migration script `scripts/migrate-elevenlabs-to-vapi.js` ships in the same PR as Phase 4 work. The provider abstraction makes this ~200 lines of code, not a re-architecture.

---

## 16. References

- ElevenLabs Conversational AI overview: <https://elevenlabs.io/agents>
- ElevenLabs CAI pricing: <https://elevenlabs.io/pricing/agents>
- ElevenLabs Twilio native integration: <https://elevenlabs.io/docs/eleven-agents/phone-numbers/twilio-integration/native-integration>
- ElevenLabs outbound call API: <https://github.com/elevenlabs/skills/blob/main/agents/references/outbound-calls.md>
- ElevenLabs Knowledge Base RAG: <https://elevenlabs.io/docs/eleven-agents/customization/knowledge-base/rag>
- ElevenLabs Knowledge Base search API (April 2026): `GET /v1/convai/knowledge-base/{id}/search`
- **ElevenLabs Startup Grants:** <https://elevenlabs.io/startup-grants> · application: <https://elevenlabs.io/grants-application>
- ElevenLabs OEM Terms: <https://elevenlabs.io/oem-terms>
- ElevenLabs Workspaces / Consolidated billing: <https://elevenlabs.io/docs/overview/administration/workspaces/overview>
- Twilio Programmable Voice pricing: <https://www.twilio.com/en-us/voice/pricing/us>
- Twilio UsageTrigger (spend guards): <https://www.twilio.com/docs/usage/api/usage-trigger>
- Stripe Billing Meters API: <https://docs.stripe.com/api/billing/meter-event?api-version=2026-03-25.dahlia>
