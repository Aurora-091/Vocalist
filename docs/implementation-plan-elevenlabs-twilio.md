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
  <LanguagePicker languages={ELEVENLABS_FLASH_V2_5_LANGUAGES} />
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

### 4.5 Voice Library — categorised, previewable, not robotic

This is the surface a non-technical owner spends the most time on. It needs to feel like picking a voice in a streaming app, not like reading a CSV.

**Data sources** (we hit both):

| Tab | API | Notes |
|---|---|---|
| **Aurora curated** | `GET /v2/voices` against our workspace | Voices we've pre-vetted and added to our ElevenLabs workspace. Top of the list because we own quality control. |
| **Browse all** | `GET /v1/shared-voices` against the public marketplace | All 5,000+ community + professional voices. Filters sent as query params; backend caches results in Redis with 24h TTL so we don't hammer ElevenLabs. |

**Filters (left rail):**

| Filter | Source field | Options |
|---|---|---|
| Language | `language` (top-level on shared, `verified_languages[].language` on workspace) | the 32 Flash v2.5 codes (`en`, `es`, `de`, `fr`, `ja`, `zh`, `hi`, `ar`, `pt`, `it`, `ko`, `nl`, `tr`, `pl`, `sv`, `id`, `fil`, `bg`, `ro`, `cs`, `el`, `fi`, `hr`, `ms`, `sk`, `da`, `ta`, `uk`, `ru`, `hu`, `no`, `vi`) |
| Gender | `gender` / `labels.gender` | male · female · neutral · non-binary |
| Age | `age` / `labels.age` | young · middle-aged · old |
| Accent | `accent` / `labels.accent` | American · British · Australian · Indian · Irish · Scottish · South African · Canadian · etc. |
| Use case | `use_cases` / `labels.use_case` | conversational · narration · news · social · characters · advertising |
| Style descriptive | `descriptives` | calm · confident · warm · authoritative · friendly · excited · soothing · raspy · deep |
| Category (shared tab only) | `category` query param | `professional` · `famous` · `high_quality` |

**Aurora-added curated rails (above the filters):**

- **Best for your vertical** — voices we tag in our workspace metadata as `aurora_recommended_for: ["shopify"]` or `["clinic"]`
- **Recently used in your org** — last 10 voices anyone in the org picked
- **Favorites** — per-user starred list (new tiny table `voice_favorites(org_id, user_id, voice_id, created_at)`)

**Voice card UI** (each row in the grid):

```
┌─────────────────────────────────────────────────────────┐
│ ●▶  Bella       [American · Young · Conversational]    │
│     "Hi, I'm Bella. I can help you book that appoi…"   │
│                                          [★] [Use this] │
└─────────────────────────────────────────────────────────┘
```

- **▶ Preview button** plays `voice.preview_url` inline (browser `<audio>`, no streaming complexity). Cached in IndexedDB on first play so re-listening is instant.
- **"Hear in your language" toggle** generates a fresh preview by calling our backend: `POST /v1/voices/{voice_id}/preview` with `{ language, text }` → backend calls `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}` with a vertical-appropriate sample line ("Hi, thanks for calling — how can I help you today?" for clinic, "Hi! I have your cart from earlier, want me to walk you through checkout?" for Shopify). Returns base64 mp3, plays inline. **Cached per (voice_id, language, sample_id)** in our DB so subsequent same-preview is free.
- **★ Favorite** toggles the row in `voice_favorites`.
- **"Use this"** writes to `agents.voice_id` and closes the modal.

**Search bar:** free-text search across name + descriptives + use_cases (debounced, sent as `?search=` query param on shared tab, client-side filter on curated tab).

**Pagination:** infinite scroll on shared tab (page=N), single-page on curated (workspaces are bounded).

**Defaults:**
- When a customer opens the picker without prior selection, we surface 12 "Aurora picks" first — a hand-curated list per vertical of voices we know work well over the phone (we maintain this list in `vertical_configs.config.recommended_voices`).
- New agent without a voice chosen at save time → defaults to a neutral curated pick (`Bella` for EN, `Mateo` for ES, etc., per language). Banner under the agent says "Voice: Bella · change anytime".

### 4.6 Test-call-yourself — polished end-to-end

Capability #18 in the Build Contract. The thing every demo opens with.

**Flow:**

1. Customer clicks **"Test call"** on any agent (button visible on `AgentDetail`, `AgentsList` row hover, and in `AgentNew` after save).
2. First-time per user: SMS-verify their personal phone number. Aurora sends a 6-digit code via Twilio Verify (separate from main telephony — uses Aurora's master Twilio account, not the tenant subaccount), stores verified number on `users.phone_e164`. After verify, subsequent test calls one-click.
3. On click, Aurora:
   - Creates a `calls` row with `direction='outbound'`, `outcome.test=true`, no `campaign_id`.
   - **Bypasses `can_dial()` consent gate** — the verified user is consenting to their own test by clicking the button. Logged as `consent_event` with `kind='test_call'`, `evidence={ user_id, button_clicked_at }`.
   - Calls `ElevenLabsProvider.startOutboundCall({ agentRef, phoneNumberRef, toE164: user.phone_e164, dynamicVariables, firstMessageOverride })`.
   - Returns the `call_id` to the frontend immediately.
4. Frontend opens a **live transcript drawer** (right-side `Sheet` from shadcn). Subscribes to ElevenLabs conversation events via a WebSocket relay on our backend (`/v1/calls/{id}/events` → SSE that forwards ElevenLabs webhooks the moment they arrive). Shows:
   - Live transcript (agent vs caller, alternating bubbles)
   - Tool calls as they fire (`📞 lookup_order(order_id=12345) → returned`)
   - Cost ticker (estimated, refreshes every 5s from duration × rate)
   - "End call" button (calls `ElevenLabsProvider.endCall(conversationId)`)
5. When call ends:
   - The `conversation_completed` webhook lands → `calls` row is finalised with `recording_url`, `transcript`, `cost_usd`, `cost_breakdown`.
   - Drawer flips to a "Call complete" state with the play button, full transcript, cost summary, and a "View full details" link to `/calls/{id}`.
   - **Ticks `onboarding_state.steps.test_and_golive = true`** — the checklist on the dashboard reflects it immediately via Supabase Realtime subscription.
6. If the call **fails** (no answer, voicemail, agent error):
   - Drawer shows what happened with a "Try again" button.
   - Does NOT tick the onboarding step — failed test ≠ tested.

**Why this matters:** the first test call is the moment a customer either believes Aurora works or churns. Polishing this single flow is worth 10× any other UX investment in Phase 1.

### 4.7 Multilingual strategy

ElevenLabs supports 32 languages on Flash v2.5 (real-time, ~75 ms TTFA) and 70+ on Eleven v3 (expressive, slower, not viable for real-time). For Aurora's voice-agent use case:

| Default | Real-time inbound + outbound | **Flash v2.5** (32 languages, 75 ms latency) |
| Fallback for unsupported langs | None in v1 — picker only shows the 32 Flash v2.5 languages |
| Voice cloning across langs | Out of v1 scope |

**Per-agent language model:**
- `agents.languages text[]` already in schema.
- `agents.languages[0]` = primary language → mapped to `agent.conversation_config.agent.language` on ElevenLabs.
- If `agents.languages.length > 1`, we enable `agent.language_detection: true` on the ElevenLabs config — the agent will detect the caller's spoken language on inbound and switch. Useful for a clinic with bilingual EN/ES staff who want one agent answering in either.
- Outbound calls always use the contact's preferred language if `contacts.preferred_language` is set (new optional column), else the agent's `languages[0]`.

**Voice × language compatibility:**

A voice trained primarily on English will still synthesise Spanish text via Flash v2.5, but the accent may sound forced. To avoid this, the voice picker filters voices by the agent's primary language by default — if a voice has `verified_languages` and the agent's language isn't in it, the voice is hidden unless the customer toggles "Show all voices for any language" (with a small warning).

**UI affordances:**
- Language picker shows native name + ISO code: "Español (es)", "中文 (zh)", "हिन्दी (hi)".
- Default order: customer's browser language first, then English, then alphabetical.
- For agents with `languages.length > 1`: small badge on the agent card "🌐 EN · ES (auto-detect)".

---

## 5. Mapping Aurora data → ElevenLabs CAI

| Aurora concept | ElevenLabs CAI concept | Notes |
|---|---|---|
| `agents.id` (Aurora) | `agent_id` (ElevenLabs) — stored in `agents.provider_ref` | created on agent insert, deleted on agent soft-delete |
| `agents.persona` (JSONB) | `agent.conversation_config.agent.prompt.prompt` | `generateSystemPrompt(persona)` already exists in `utils/promptBuilder.js` |
| `agents.voice_id` | `agent.conversation_config.tts.voice_id` | ElevenLabs voice catalogue |
| `agents.languages` (text[]) | primary → `agent.conversation_config.agent.language`; rest enable `agent.language_detection` for auto-detect on inbound | 32 languages via Flash v2.5; see §4.7 |
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

-- §4.5 — voice picker favorites + custom preview cache
create table voice_favorites (
  org_id     uuid not null references orgs(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  voice_id   text not null,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id, voice_id)
);
create index on voice_favorites (org_id, user_id);

create table voice_preview_cache (
  voice_id   text not null,
  language   text not null,
  sample_id  text not null,           -- e.g. "shopify_recovery_1" / "clinic_greeting_1"
  audio_b64  text not null,           -- mp3 base64, ~20-50 KB per sample
  created_at timestamptz not null default now(),
  primary key (voice_id, language, sample_id)
);

-- §4.6 — test-call flow needs verified personal phone per user
alter table users add column phone_e164 text;
alter table users add column phone_verified_at timestamptz;

-- §4.7 — optional per-contact language preference for outbound
alter table contacts add column preferred_language text;
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
| 1.10 | **Voice Library page** — two tabs (Aurora curated + Browse all), 7 filters, pagination, preview audio, favorites, "hear in your language" custom preview generator. Backend: Redis cache layer for `/v1/shared-voices`, new `voice_favorites` table, `POST /v1/voices/{id}/preview` endpoint with sample cache | medium |
| 1.11 | **Test-call-yourself polished flow** — SMS verify on first use (`users.phone_e164`), one-click subsequent calls, live transcript drawer with SSE relay of ElevenLabs conversation events, cost ticker, "End call" button, completion ticks `onboarding_state.steps.test_and_golive` | medium |
| 1.12 | **Multilingual support across 32 languages** — language picker uses native names + ISO codes, defaults to browser locale, voice filtering by `verified_languages`, multi-language agent support via `agent.language_detection` flag, optional `contacts.preferred_language` column | shallow |

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
- ❌ Voice cloning (custom voices from customer audio). Out of v1 — Phase 4. We expose ElevenLabs catalogue only.
- ❌ Eleven v3 (the 70+ language expressive model) — its latency disqualifies it for real-time voice calls. We stick to Flash v2.5's 32 languages.

---

## 14. Open questions to decide before Phase 1.7 ships

1. Default voice when customer hasn't picked one? Recommendation: a neutral Eleven default (`Bella` / `Rachel`) with a "you can change this anytime" hint.
2. Default opening message when customer leaves it blank? Recommendation: "Hi, how can I help you today?" for inbound; reject save for outbound (require explicit message per agent because dynamic-variable interpolation needs it).
3. Knowledge base size cap per tenant? Recommendation: 50 docs / 10MB total on Starter, 500 docs / 100MB on Growth, unlimited on Scale.
4. Voice library curation: §4.5 resolves this — show **two tabs**: Aurora curated (12 hand-picked per language, top of UI) + Browse all (full shared library with filters). Best of both worlds; analytics will tell us if anyone leaves the curated tab.
5. Recording always-on vs opt-in per agent? Recommendation: always-on for compliance/QA (capability §14), with a tenant-level "Don't store recordings" setting for HIPAA-leaning clinics.
6. Aurora curated voice list: who maintains it? Recommendation: backend team seeds 12 EN + 6 ES at launch in `vertical_configs.config.recommended_voices`; revisit quarterly based on adoption metrics. We add a voice to the curated list by tagging it in our ElevenLabs workspace metadata.
7. Custom preview sample lines per vertical: who writes them? Recommendation: product + design write 2-3 vertical-appropriate sample sentences per vertical, stored in `vertical_configs.config.preview_samples`. Customer never sees the sample list — they just click ▶ Preview and hear the right thing for their vertical.

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
