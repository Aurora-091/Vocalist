# Aurora — Phase 1 Implementation Plan

**Status:** ACTIVE · **Owner:** Backend lead · **Updated:** 2026-06-04
**Source of truth for v1 build sequence. Replaces prior plans.**

**Supersedes:**
- `implementation-plan-elevenlabs-twilio.md` (the earlier ElevenLabs-only plan — kept in repo as the design exploration; this doc is now authoritative).
- `implementation-plan-vapi-twilio-billing.md` (already marked DEFERRED to Phase 4 reference; unchanged status).

**Reads against:**
- [`Aurora-v1-Scope-and-Build-Contract.md`](./Aurora-v1-Scope-and-Build-Contract.md) — what we ship and the acceptance gates
- [`Aurora-BlackBook.md`](./Aurora-BlackBook.md) — the system design
- [`Aurora-UIUX-Spec.md`](./Aurora-UIUX-Spec.md) — the customer-facing surface
- [`database-guide.md`](./database-guide.md) — schema + operational patterns (this plan adds new tables that must be folded back into the DB Guide at the next consolidation; SQL is inlined here, §A)
- [`research/elevenlabs-cai-evidence.md`](./research/elevenlabs-cai-evidence.md) — the cost / capability evidence that drove the runtime choice
- [`research/critique-response-and-decisions.md`](./research/critique-response-and-decisions.md) — the four red-team findings and what we did with them

---

## 0. Decisions locked

From the updated Scope §I non-negotiables, the research brief, and the critique response. These are not up for debate inside Phase 1 — only in a Phase-4 revisit with explicit triggers.

| # | Decision | Source |
|---|---|---|
| 1 | **Voice runtime = ElevenLabs Conversational AI** (Phase 1). Vapi compiled but **not registered** behind the `VoiceProvider` seam. Phase-4 swap is a one-line factory change + a ~200-line migration script. | Scope §I.5 · Critique §"What did not change" |
| 2 | **Knowledge Base = CAI-native RAG.** `knowledge_sources` is a thin mirror with `cai_doc_id`. **No pgvector in Phase 1.** | Scope §A.7 · §I.10 · §B |
| 3 | **Inbound goes through our Hono/Express admission gate first.** `check_inbound_rate()` + `can_spend()` before any TwiML handoff to CAI. **Native CAI number binding for inbound is forbidden.** | Scope §J · §I.11 · §B · Critique #1 |
| 4 | **Spend guards meter on `cost_usd`, not minutes.** `usage_ledger` records `tokens_in` / `tokens_out` / `cost_usd` per call segment. `meter_kind` gains `llm_tokens`. Ships from call #1 (Phase 1), independent of Stripe billing. | Scope §E.1 · §I.9 · §I.12 · Critique #4 |
| 5 | **Shopify deep integration is the Phase-1 moat.** Cart-recovery + order-modifier agent with `lookup_order`/`cancel_order`/`apply_discount_code`/`update_address` tools + abandoned-checkout trigger ships in Phase 1, not Phase 3. Clinic and the rest of the integration bags ship in Phase 3. | Scope §0 moat paragraph · Critique #3 |
| 6 | **Pricing = subscription + bundled minutes + overage.** Starter $99 / 400 min / $0.30 over · Growth $299 / 1,500 / $0.32 · Scale $799 / 5,000 / $0.35. Overage ≈ 2× COGS is the margin engine. Outcome pricing is a **Phase-2 upsell**, not the v1 foundation. | Scope §E · Brief §3 · Critique #2 (accepted risk, revisit trigger documented) |
| 7 | **Apply for the ElevenLabs Startup Grant before Workstream 1.1.** 33M characters / ~680 hours of CAI / 12 months / ~$4K value. <25 employees · pre-seed → Series A · display "ElevenLabs Grants" logo. | Scope binding stack paragraph · Brief §4 |
| 8 | **Email `sales@elevenlabs.io` before Workstream 1.1** to validate the SaaS-on-API usage pattern under their ToS. Reply filed before any agent provisioning code ships. | Critique companion + Brief §4 |
| 9 | **Stack other startup credits** — Twilio Startup Program (highest leverage since it offsets the COGS the ElevenLabs grant does not cover), AWS Activate, Google for Startups Cloud, Stripe partner, Supabase startup credits. | Brief §5 |
| 10 | **Stack:** Node + Express + CommonJS for v1 (the existing backend). Hono / Bun / TS migration is Phase 4. "Hono admission gate" in the scope = the admission-gate **endpoint**, built on Express. | Scope binding stack paragraph |
| 11 | **Recording = opt-in per tenant, NOT always-on.** Default off. When opted in, agent first-message includes a mandatory disclosure preamble. Honors two-party-consent jurisdictions. | Q&A clarification on prior plan; consistent with Scope §G and the consent ledger pattern. |

---

## 1. Build sequence overview

Five phases. Each phase is one or more PRs. **Phase 0 lands before any agent-runtime code is written** because two of its workstreams (the grant application and the ToS email) are external dependencies with multi-day latency.

| Phase | Theme | Capabilities closed (scope §0 #) | When done, we can… |
|---|---|---|---|
| **0** | Credit stacking + legal validation + DB foundation | 7b, 26 (partial) | …have the financial + legal + schema runway to start writing runtime code. |
| **1** | Core runtime + Shopify moat + admission gate + voice library + test-call | 1, 2, 3, 5, 7, 7b, 8, 11, 18, 19, 21, 22, 26, **+ Shopify slice of 4 and 12** | …demo a working Shopify cart-recovery agent end-to-end, with multi-agent + multi-number per tenant, inbound admission gated, spend guards live. |
| **2** | Campaigns + billing + reconciliation + outcome pre-reg | 9, 10, 12, 13, 14, 15, 16, 17, 20, 24, 25 | …run a real outbound campaign through `can_dial()`+`can_spend()`, bill it in Stripe with reconciliation, surface it on the outcomes dashboard. |
| **3** | Remaining integrations + Clinic vertical UI | 4 (Cal.com, calendars, CRMs), 6 (agent template library), Clinic-side of 12 | …onboard a clinic tenant with appointment-booking + intake-triage agents on Cal.com. |
| **4** | Post-seed optimisation | n/a (closes none, opens optionality) | …optionally swap to Vapi/Pipecat for COGS, ship outcome pricing, migrate to Bun+Hono if needed. |

---

## 2. Phase 0 — Credit stacking + legal + DB foundation

Four PRs and three external applications. The applications go out **first** because response time is days, not minutes.

### Workstream 0.1 — External applications (ops task, no code)

| Action | Owner | Deliverable filed at |
|---|---|---|
| Apply for [ElevenLabs Startup Grant](https://elevenlabs.io/grants-application) | founder | screenshot of submission + acceptance email |
| Email `sales@elevenlabs.io`: "we are a voice-AI SaaS for SMBs in Shopify + clinic verticals; customers don't see ElevenLabs; we pay one bill. Confirm SaaS-on-API usage is within ToS; recommend a plan." | founder | reply email, filed in `docs/research/` as `elevenlabs-tos-confirmation.eml` (or markdown) |
| Apply to [Twilio Startup Program](https://www.twilio.com/en-us/startups) | founder | acceptance + credit allocation |
| Apply to [AWS Activate](https://aws.amazon.com/activate/) — Founder tier self-serve ($1K) or higher via accelerator | founder | credit allocation |
| Apply to [Google for Startups Cloud Program](https://cloud.google.com/startup) — AI-first tier targets $350K | founder | credit allocation |
| Note Stripe partner discounts + Supabase startup credits available via accelerator partnerships | founder | tracked alongside the others |

Done = grant accepted **or** rejection email on file (some get rejected; we still ship).

### Workstream 0.2 — `voice_provider` enum extension + Vapi-to-inactive

**Files:** `supabase/migrations/<timestamp>_add_elevenlabs_provider.sql` · `backend/src/providers/voice/factory.js`

```sql
-- Add ElevenLabs as a valid provider value
alter type voice_provider add value if not exists 'elevenlabs';
```

```js
// backend/src/providers/voice/factory.js
const DEFAULT_PROVIDER = process.env.VOICE_PROVIDER || "elevenlabs";
const REGISTERED = {
  elevenlabs: () => new ElevenLabsProvider(),
  // 'vapi' intentionally NOT registered — compiled, tested, available for Phase-4 swap
  // (Scope §I.5; see migration script outlined in §6 of this doc)
};
```

Complexity: shallow. Closes: foundation for Workstream 1.x.

### Workstream 0.3 — Token & cost metering on `usage_ledger` (Scope §I.12, Critique #4)

**Files:** `supabase/migrations/<timestamp>_usage_ledger_token_cost.sql` · DB Guide §11 (update next consolidation)

```sql
-- Per-segment token + dollar cost so spend guards meter on real cost, not minutes
alter table usage_ledger
  add column if not exists tokens_in  integer,
  add column if not exists tokens_out integer,
  add column if not exists cost_usd   numeric(12,4);

-- New meter kind so LLM token COGS is queryable as a distinct line item
alter type meter_kind add value if not exists 'llm_tokens';

-- Existing 'voice_minutes' / 'overage_minutes' kinds unchanged.
-- New 'llm_tokens' rows carry quantity=token_count, cost_usd=$ spent.

create index if not exists usage_ledger_org_cost_idx
  on usage_ledger (org_id, occurred_at desc)
  include (cost_usd);
```

**Invariant #11 (new):** `usage_ledger` rows for completed calls **must** have non-null `cost_usd`. Enforced in CI via a fixture test that asserts the call-end webhook populates it.

Complexity: shallow. Closes: foundation for spend guards + later Stripe meter push.

### Workstream 0.4 — `spend_guards` + `spend_counters` + `can_spend()` (Scope §E.1, §I.9)

**Files:** `supabase/migrations/<timestamp>_spend_guards.sql`

```sql
-- Per-org (and optionally per-agent / per-campaign) spend ceilings, metered in dollars.
create table spend_guards (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references orgs(id) on delete cascade,
  scope           text not null check (scope in ('org','agent','campaign')),
  scope_id        uuid,                          -- agent_id / campaign_id when scope <> 'org'
  period          text not null check (period in ('daily','monthly')),
  limit_usd       numeric(12,4) not null,
  warn_at_pct     int  not null default 80,     -- emit notification at this % of limit
  action_at_pct   int  not null default 100,    -- pause scope at this %
  enabled         boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index spend_guards_unique_scope
  on spend_guards (org_id, scope, coalesce(scope_id,'00000000-0000-0000-0000-000000000000'::uuid), period);
create index on spend_guards (org_id);

-- Rolling counters. Written by the dialer (pre-call projection) and the call-end webhook (true-up).
create table spend_counters (
  org_id          uuid not null references orgs(id) on delete cascade,
  scope           text not null check (scope in ('org','agent','campaign')),
  scope_id        uuid,
  period          text not null check (period in ('daily','monthly')),
  period_start    date not null,                  -- daily = the date; monthly = first of month
  spent_usd       numeric(12,4) not null default 0,
  reserved_usd    numeric(12,4) not null default 0,  -- in-flight projections
  updated_at      timestamptz not null default now(),
  primary key (org_id, scope, coalesce(scope_id,'00000000-0000-0000-0000-000000000000'::uuid), period, period_start)
);
create index on spend_counters (org_id, period_start);

-- Returns true if (spent + reserved + projected) <= limit for ALL applicable guards.
-- Applicable = enabled guards whose (scope, scope_id) match the call about to be placed.
-- Defaults open (returns true) if no guard configured for the scope.
create or replace function can_spend(
  p_org           uuid,
  p_scope         text,           -- 'org' | 'agent' | 'campaign'
  p_scope_id      uuid,           -- nullable for 'org'
  p_projected_usd numeric,
  p_now           timestamptz
) returns boolean language plpgsql stable as $$
declare
  v_blocked boolean := false;
begin
  -- Check the org-level guard always.
  select exists (
    select 1
      from spend_guards g
      join spend_counters c
        on c.org_id = g.org_id
       and c.scope = g.scope
       and (c.scope_id is not distinct from g.scope_id)
       and c.period = g.period
       and c.period_start = case g.period
             when 'daily'   then (p_now at time zone 'utc')::date
             when 'monthly' then date_trunc('month', p_now at time zone 'utc')::date
           end
     where g.org_id = p_org
       and g.enabled
       and ((g.scope = 'org')
         or (g.scope = p_scope and g.scope_id is not distinct from p_scope_id))
       and (c.spent_usd + c.reserved_usd + p_projected_usd)
           > (g.limit_usd * g.action_at_pct / 100.0)
  )
  into v_blocked;
  return not v_blocked;
end $$;

-- Reserve / commit / release helpers (called by the dialer + webhook handlers).
-- See workstream 0.4 helper RPCs in the §A appendix of this plan.
```

**Invariant #9 (new in scope, encoded here):** **no call placed when `can_spend()` returns false at place-time.** Tested by a fixture that pre-loads a hostile loop and asserts spend ≤ limit + at most one in-flight call.

Complexity: medium. Closes: scope #7b. Required by all of Phase 1 runtime.

### Workstream 0.5 — `inbound_rate_counters` + `check_inbound_rate()` (Scope §J, Critique #1)

**Files:** `supabase/migrations/<timestamp>_inbound_admission.sql`

```sql
-- Sliding-window counters for inbound abuse / cost-bomb protection.
-- Two dimensions matter: (a) one caller hammering us, (b) a botnet hitting one DID.
create table inbound_rate_counters (
  org_id       uuid not null references orgs(id) on delete cascade,
  bucket_key   text not null,                     -- 'from:+1...' or 'to:+1...'
  window_start timestamptz not null,              -- 60-second bucket aligned
  call_count   int not null default 0,
  primary key (org_id, bucket_key, window_start)
);
create index inbound_rate_counters_gc
  on inbound_rate_counters (window_start);        -- for periodic cleanup of stale rows

-- Tenant-configurable thresholds live in spend_guards.action_config (or a sibling table)
-- but ship with sensible defaults:
--   per-from: 5 calls / 60s
--   per-to:   30 calls / 60s
-- Returns 'admit' | 'blocked_rate' for the inbound admission gate.
create or replace function check_inbound_rate(
  p_org        uuid,
  p_from_e164  text,
  p_to_e164    text,
  p_now        timestamptz,
  p_per_from   int default 5,                     -- caller velocity
  p_per_to     int default 30                     -- DID velocity
) returns text language plpgsql as $$
declare
  v_window timestamptz := date_trunc('minute', p_now);
  v_from_count int;
  v_to_count int;
begin
  -- atomic increment + read for the from-key
  insert into inbound_rate_counters (org_id, bucket_key, window_start, call_count)
    values (p_org, 'from:' || p_from_e164, v_window, 1)
    on conflict (org_id, bucket_key, window_start)
      do update set call_count = inbound_rate_counters.call_count + 1
    returning call_count into v_from_count;

  insert into inbound_rate_counters (org_id, bucket_key, window_start, call_count)
    values (p_org, 'to:' || p_to_e164, v_window, 1)
    on conflict (org_id, bucket_key, window_start)
      do update set call_count = inbound_rate_counters.call_count + 1
    returning call_count into v_to_count;

  if v_from_count > p_per_from or v_to_count > p_per_to then
    return 'blocked_rate';
  end if;
  return 'admit';
end $$;

-- Daily cleanup job removes rows older than 24 hours.
```

**Invariant #10 (new):** **no inbound call admitted without `check_inbound_rate()='admit'` AND `can_spend()=true`.** Tested by a fixture that bombards a DID with > threshold and asserts CAI is never invoked.

Complexity: medium. Closes: foundation for §J inbound admission gate (Workstream 1.5).

---

## 3. Phase 1 — Runtime + Shopify moat + admission gate + voice library + test-call

Twelve PRs. Workstream 1.1 must merge first; everything else assumes the consolidated provider abstraction.

### PR 1.1 — Consolidate `VoiceProvider` abstraction; mark Vapi inactive

**Files:** `backend/src/providers/voice/{interface,factory,vapi.provider,mock.provider}.js` · delete `backend/src/services/providers/*` (the duplicate folder from prior history) · update 2 importers (`call.service`, `agent.service`).

The abstraction:

```js
class VoiceProvider {
  static get name() { /* "elevenlabs" | "vapi" | "pipecat" */ }
  async createAgent(agent, systemPrompt)             // returns { providerRef, raw }
  async updateAgent(providerRef, agent, systemPrompt)
  async deleteAgent(providerRef)
  async listVoices({ language, gender, age, accent, useCase, search, page })
  async previewVoice(voiceId, { language, sampleText })
  async attachPhoneNumber({ providerRef, twilioNumber, twilioCreds })
  async startOutboundCall({ agentRef, phoneNumberRef, toE164, leaseToken, metadata, dynamicVariables, firstMessageOverride })
  async endCall(providerCallId)
  // Note: no fetchCallCost() — ElevenLabs returns final cost in the conversation_completed webhook
  // (deferred fetch only needed if/when we re-activate Vapi in Phase 4).
}
```

Vapi stays compiled in `vapi.provider.js` and `vapi.provider.test.js` runs in CI; it just isn't registered in `factory.js`. (Scope §I.5)

Complexity: shallow. Closes: foundation; enables everything below.

### PR 1.2 — `ElevenLabsProvider` implementation

**Files:** `backend/src/providers/voice/elevenlabs.provider.js` · contract tests against the abstraction.

Implements every method against ElevenLabs CAI API endpoints:
- `POST /v1/convai/agents` for create / update / delete
- `GET /v1/voices` + `GET /v1/shared-voices` for `listVoices` (with cache layer — see 1.10)
- `POST /v1/text-to-speech/{voice_id}` for `previewVoice`
- `POST /v1/convai/phone-numbers/twilio` for `attachPhoneNumber`
- `POST /v1/convai/twilio/outbound-call` for `startOutboundCall`

Complexity: medium. Closes: foundation for all runtime workstreams.

### PR 1.3 — Agent CRUD wired to provider (Scope #5)

**Files:** `backend/src/modules/agents/{agent.service.js,agents.routes.js}` · update `agents.persona` keys to include `opening_message_inbound` + `opening_message_outbound`.

- `POST /api/v1/agents` → DB insert → `provider.createAgent(agent, generateSystemPrompt(persona))` → persist returned id into `agents.provider_ref`. Failure rolls back the DB row (no half-created agents).
- `PATCH` / `PATCH /persona` → also pushes to provider.
- `DELETE` (soft) → `provider.deleteAgent(provider_ref).catch(log)` best-effort.
- **Outbound agents force `persona.consent_required = true`** at the model layer (Scope #5 AC).

Complexity: medium. Closes: scope #5.

### PR 1.4 — Knowledge Base ingestion via CAI (Scope #7)

**Files:** `backend/src/modules/knowledge/knowledge.routes.js` · new `knowledge.service.js` · migration to add `knowledge_sources.cai_doc_id text` if not already present.

Replaces any custom chunker / embedder / vector code. Endpoints:
- `POST /api/v1/knowledge/sources/file` (multipart PDF/DOCX) → `POST /v1/convai/knowledge-base/file`
- `POST /api/v1/knowledge/sources/url` → `POST /v1/convai/knowledge-base/url`
- `POST /api/v1/knowledge/sources/text` → `POST /v1/convai/knowledge-base/text`
- `POST /api/v1/knowledge/sources/:id/reindex` → `POST /v1/convai/knowledge-base/{id}/rag-index`
- `DELETE /api/v1/knowledge/sources/:id` → delete in CAI + local

`agent_knowledge` join → CAI agent's `conversation_config.agent.prompt.knowledge_base.documents` array (rebuilt on subscribe/unsubscribe). Agent **only** sees its subscribed docs (Scope #7 AC).

Complexity: shallow (CAI does the heavy lifting). Closes: scope #7.

### PR 1.5 — Inbound admission gate (Scope §J, Critique #1) — the cost-leak fix

**Files:** `backend/src/modules/webhooks/handlers/twilio.handler.js` (overhaul) · `backend/src/services/admission.service.js` (new) · `backend/src/modules/calls/call_events.repository.js`.

The flow, end-to-end (matches Scope §J):

```
[Twilio]──voice webhook──▶ [our Express POST /webhooks/twilio/inbound]
                                │
                                ▼
                      resolve org_id + bound agent_id from phone_numbers
                                │
                                ▼
                      check_inbound_rate(org, from, to, now)
                       │                            │
                       ▼                            ▼
                  'admit'                      'blocked_rate'
                       │                            │
                       ▼                            ▼
              can_spend(org, ...)              return TwiML <Say>...<Record/>
                       │                       log call_events('blocked_rate')
              true ◀───┴───▶ false
                │              │
                ▼              ▼
   return TwiML        return TwiML <Say>...<Record/>
   <Connect> handing   log call_events('blocked_spend')
   media to CAI
   conversation
   (SIP/stream URL)
```

**Hard rules:**
- Phone numbers are imported into Twilio (existing subaccount flow) but the `voiceUrl` always points at our endpoint. **Never `POST /v1/convai/phone-numbers/twilio` for inbound binding.** (Scope §B, §I.11)
- Both `blocked_rate` and `blocked_spend` write a `call_events` row with the reason and the resolved (org, from, to). Audit trail.
- TwiML for blocked = polite voicemail by default (better customer UX); hard `<Reject reason="busy"/>` available via `spend_guards.action_config.inbound_decline_mode = 'hard_reject'` for known-abuse tenants.
- We are **not** in the audio path — just one signaling hop, tens of ms.

Complexity: medium. Closes: scope #11; satisfies non-negotiables #11 and (with 0.4) #9.

### PR 1.6 — Voicemail + transfer-to-human (Scope #21, §C voicemail)

**Files:** migration `agents.voicemail_message text` · `agent.service.js` (push to `conversation_config.agent.voicemail`) · `agent.service.js` (register `transfer_call` client tool with `transfer_number`).

Complexity: shallow. Closes: scope #21.

### PR 1.7 — Voice Library page (categorised, previewable, multilingual-aware) (Scope #5, supports 22)

**Files:** `src/pages/VoiceLibrary.tsx` · `backend/src/modules/voices/voices.routes.js` (new) · `voice_favorites` migration · `voice_preview_cache` migration · Redis cache layer for `/v1/shared-voices`.

UX (from prior design):

- Two tabs: **Aurora curated** (workspace voices we vet) + **Browse all** (shared marketplace 5k+).
- Seven filters: language · gender · age · accent · use case · style descriptive · category.
- **Inline ▶ Preview** plays `voice.preview_url` (IndexedDB cache).
- **"Hear in your language"** generates a custom preview via `POST /v1/text-to-speech/{voice_id}` with a vertical-appropriate sample line ("Hi, thanks for calling Acme Dental..." vs "Hi! I have your cart from earlier..."). Cached server-side in `voice_preview_cache`.
- ★ Favorites per (org_id, user_id).
- Aurora curated picks (12 EN + 6 ES at launch) seeded in `vertical_configs.config.recommended_voices`.

```sql
create table voice_favorites (
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  voice_id text not null,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id, voice_id)
);

create table voice_preview_cache (
  voice_id text not null,
  language text not null,
  sample_id text not null,
  audio_b64 text not null,
  created_at timestamptz not null default now(),
  primary key (voice_id, language, sample_id)
);
```

Complexity: medium. Supports scope #5 + #22.

### PR 1.8 — Multilingual: 32 languages via Flash v2.5, multi-lang per agent, contact preference (Scope #22)

**Files:** migration `contacts.preferred_language text` · update `agent.service.js` to set `agent.language_detection: true` when `agents.languages.length > 1` · LanguagePicker on `AgentNew` enumerates the 32 Flash v2.5 languages with native names + ISO codes.

The 32 languages (Flash v2.5): `en es de fr ja zh hi ar pt it ko nl tr pl sv id fil bg ro cs el fi hr ms sk da ta uk ru hu no vi`.

Outbound calls use `contacts.preferred_language` if set, else `agents.languages[0]`. Inbound calls with `language_detection=true` auto-route to the caller's spoken language.

> Note: Scope §A.22 currently constrains to EN/ES with explicit "EN + ES only (others rejected gracefully)" AC. **This workstream extends scope #22 to all 32 Flash v2.5 languages**, per the prior conversation. If scope owner wants to hold the line at EN/ES for v1 launch, this is a one-liner toggle in the LanguagePicker; the schema and provider config support the full set regardless.

Complexity: shallow. Closes: scope #22 (extended).

### PR 1.9 — Test-call-yourself polished flow (Scope #18)

**Files:** new `users.phone_e164` + `phone_verified_at` columns · `backend/src/modules/test_calls/test_calls.routes.js` (new) · `/v1/calls/:id/events` SSE relay · `<TestCallDrawer>` in `src/pages/AgentDetail.tsx`.

1. First-time per user: SMS-verify their personal phone via Twilio Verify (uses Aurora's **master** Twilio account, NOT the tenant subaccount — keeps verification working even when a tenant subaccount is suspended). Store on `users.phone_e164` + `phone_verified_at`.
2. Subsequent: one-click "Call me now" button on every agent.
3. Backend creates `calls` row with `outcome.test=true`, `direction='outbound'`, **bypasses `can_dial()`** (verified user clicking = own consent — logged as `consent_event` with `kind='test_call'` + click evidence). **Still passes `can_spend()`** because COGS is real.
4. Frontend opens a right-side `Sheet` with live transcript (SSE relay of CAI conversation events), tool-call indicators, cost ticker (refreshed every 5s), "End call" button.
5. On completion: drawer flips to summary with play button, full transcript, cost breakdown. Ticks `onboarding_state.steps.test_and_golive` via Supabase Realtime.
6. Failed test (no answer / voicemail) does NOT tick the step.

Complexity: medium. Closes: scope #18.

### PR 1.10 — Shopify deep integration: connect + abandoned-cart trigger + agent tools (Scope §0 moat, Critique #3) **— the Phase-1 differentiator**

**Files:**
- `backend/src/modules/integrations/providers/shopify/{shopify.provider.js,oauth.routes.js,webhook.routes.js,tools.js}`
- `backend/src/modules/integrations/integration.service.js` (extend)
- migration adding `integrations.config.shopify_shop_domain` documentation; no schema change required (already JSONB)
- `src/pages/Integrations.tsx` updates for Shopify connect card
- Seed `vertical_configs` row for Shopify with `recommended_voices`, `recommended_agent_skeletons`, and `tool_catalogue`

**OAuth + connection:**
- `GET /api/v1/integrations/shopify/connect` → redirect to Shopify OAuth (`read_orders, write_orders, read_customers, write_customers, read_discounts, write_discounts, read_checkouts`)
- Callback persists access token via Vault `secret_ref`, marks `integrations(type='shopify', status='active')`
- Status banner if disconnected; tool catalogue greyed if integration inactive (Scope #4 AC)

**Webhook ingest (the trigger):**
- Subscribe to `checkouts/update` (abandoned-cart proxy; Shopify doesn't fire `checkouts/abandoned` directly — we detect "abandoned" as a checkout that hasn't progressed to an order after configurable N minutes, default 30)
- Handler at `POST /webhooks/shopify/checkouts` validates HMAC, ingests checkout, upserts contact (consent attestation flag set if Shopify customer opted into marketing — otherwise contact lands `consent_status='none'`)
- If consent ✓ → enqueue `campaign_targets` against the customer's pre-configured **cart_recovery** campaign

**Agent tools (CAI function tools — see `tools.js`):**

| Tool | What it does | CAI tool spec |
|---|---|---|
| `lookup_order(order_id \| email \| phone)` | Reads order status + line items + tracking | Server tool — POST our `/v1/agent-tools/shopify/lookup_order` from CAI |
| `apply_discount_code(order_id, code)` | Validates + applies a discount to the cart | Server tool |
| `update_address(order_id, address)` | Updates shipping address on an open order | Server tool |
| `cancel_order(order_id, reason)` | Cancels an order if status allows | Server tool |

Each tool is a thin Express route signed by a shared secret in the CAI tool config. Returns structured JSON the LLM can speak.

**Agent skeleton:** a Shopify-vertical org sees a "Cart Recovery" skeleton on `AgentNew` that pre-attaches these four tools and pre-populates the suggested outbound first-message variables. No persona text seeded (Scope §I.7 — customer writes their own).

Complexity: medium-high. Closes: scope #4 (Shopify slice) + scope #12 (Shopify trigger) + Shopify slice of #6 (template seed).

### PR 1.11 — Twilio managed subaccount (already exists) + number-binding hardening (Scope #8)

**Files:** `backend/src/modules/twilio/{twilio.client.js,twilio.routes.js}` (already largely there from prior work) · ensure subaccount-per-tenant flow is alive and the purchased number's `voiceUrl` points at our admission gate (not CAI).

`phone_numbers.provider_ref` is renamed/generalised to hold the CAI agent reference for the bound agent — but the **Twilio voiceUrl never points at CAI**, per §J. Numbers bind to agents via `phone_numbers.agent_id` (existing column).

Complexity: shallow. Closes: scope #8.

### PR 1.12 — Onboarding + Dashboard checklist + Settings v1 (Scope #1, #2, #17)

**Files:** `src/pages/{Dashboard,Settings}.tsx` migrate off legacy-ui to shadcn · `backend/src/modules/onboarding/onboarding.routes.js` (already exists, polish).

The 6-step `onboarding_state` checklist already exists in code; this PR migrates the UI to shadcn primitives and wires the `test_and_golive` tick (via PR 1.9). Settings page builds the four tabs from Scope §F.

Complexity: medium. Closes: scope #1, #2, #17.

---

## 4. Phase 2 — Campaigns + billing + reconciliation + outcome meter pre-reg

Seven PRs. Phase 2 is what turns "demo works" into "money flows correctly."

### PR 2.1 — Dialer + retry + lease sweeper hardening (Scope #12, #13)

The workers exist (`dialer.worker`, `retry.worker`, `lease-sweeper.worker`). This PR:
- Switches the provider call from prior Vapi path to `ElevenLabsProvider.startOutboundCall`
- **Adds `can_spend()` check alongside `can_dial()`** before claiming each target (Scope §I.9)
- Reserves `cost_usd` into `spend_counters.reserved_usd` at lease time; trues up on `conversation_completed`

Complexity: medium. Closes: scope #12, #13 (engine).

### PR 2.2 — Campaign builder UI (compliance-gated 5-step) (Scope §C)

**Files:** `src/pages/{CampaignNew,CampaignDetail}.tsx`.

The five steps from Scope §C: Audience → Agent/script → Schedule & limits → **Compliance review (cannot skip; shows consent ✓ / no-consent / DNC / outside-hours counts)** → Launch ConfirmGate.

Complexity: medium. Closes: scope #13 (UI).

### PR 2.3 — `conversation_completed` webhook → `calls` + `usage_ledger` (incl. tokens + cost) (Scope §I.6, §I.12)

**Files:** `backend/src/modules/webhooks/handlers/elevenlabs.handler.js` (new).

The webhook payload includes `cost.total_usd` and `cost.breakdown` (CAI-platform, LLM tokens in/out, telephony). We:
- Update `calls` (status, ended_at, duration_sec, cost_usd, cost_breakdown, recording_url, transcript, outcome)
- Insert `usage_ledger` row with `kind='voice_minutes'`, quantity, `cost_usd` from CAI
- Insert `usage_ledger` row with `kind='llm_tokens'`, quantity=tokens_in+tokens_out, `cost_usd` from CAI breakdown
- Commit reservation in `spend_counters` (move reserved → spent)
- Transition `campaign_targets` state (RINGING → IN_CALL → COMPLETED / VOICEMAIL / FAILED)
- All idempotent on `(provider, provider_call_id)` (existing unique constraint on `calls`)

Complexity: medium. Closes: scope #14 (recordings/transcripts persisted), enables #15, #16.

### PR 2.4 — Stripe Billing Meters push (subscriptions + metered usage) (Scope #16)

**Files:** `backend/src/workers/billing-rollup.worker.js` · `backend/src/modules/billing/{billing.service.js,billing.routes.js}` · seed Stripe meters via setup script.

Three meters registered in Stripe:
- `aurora_voice_minutes` (aggregation: sum, on `usage_ledger.quantity` where `kind='voice_minutes'`)
- `aurora_llm_tokens` (sum, where `kind='llm_tokens'` — informational; doesn't drive customer billing in v1)
- **Pre-register `aurora_outcome_bookings` and `aurora_outcome_cart_recovery`** with quantity=0 (so flipping outcome pricing on in Phase 4 is a config change, not a schema/Stripe-config rewrite — see Brief §3 principle 4, Critique #2 deferred decision)

Idempotency: every Stripe `meter_events.create` carries `identifier = sha256(org_id + provider_call_id + kind + period)` so retries within 24h dedupe natively.

Complexity: medium. Closes: scope #16.

### PR 2.5 — Daily billing reconciliation worker (Critique #4 prudence)

**Files:** `backend/src/workers/billing-reconciler.worker.js` (new).

Runs nightly. For each org with active subscription:
- `ledger_sum = sum(usage_ledger.quantity WHERE org_id AND period AND kind='voice_minutes')`
- `stripe_sum = stripe.billing.meters.eventSummaries.list({customer, meter, period})`
- If `|ledger_sum - stripe_sum| / ledger_sum > 0.001` (0.1% tolerance): emit ops alert + post a catch-up meter event with `identifier = recon_{org_id}_{period}`
- Also reconciles `spend_counters` ↔ `usage_ledger` (Scope §E.1 AC: "Counters reconcile with `usage_ledger` nightly")

Complexity: shallow. Closes: scope #16 AC + scope #7b AC.

### PR 2.6 — Outcomes / Analytics dashboard (Scope §D)

**Files:** `src/pages/Outcomes.tsx` · `backend/src/modules/analytics/analytics.routes.js` (already partial) + the 11 metrics from Scope §D table.

`calls.outcome` JSONB carries the standard outcome keys: `booked`, `recovered_cart`, `revenue_recovered_cents`, `opt_out`, `transferred`, `voicemail`. Rollups read from `calls` + `usage_ledger`.

Complexity: medium. Closes: scope #15.

### PR 2.7 — Billing UI: ledger vs Stripe meter side-by-side + 80%/100% alerts (Scope #16 + §E.1)

**Files:** `src/pages/Billing.tsx` migrate to shadcn · uses analytics RPC + Stripe meter summary endpoint.

Live usage meter, 80% amber alert, 100% danger + pause banner. Subscription view + invoices + cap thresholds.

Complexity: shallow. Closes: scope #16 AC, #17 (billing tab), #7b (alerts).

---

## 5. Phase 3 — Remaining integrations + Clinic vertical

Six PRs. This is where Clinic vertical comes online and the integration bag fills out.

### PR 3.1 — Cal.com integration + booking agent tools (Scope #4 — Clinic slice)

`book_appointment`, `reschedule_appointment`, `cancel_appointment`, `check_availability` as CAI function tools. OAuth flow → access token via Vault. Webhook for booking confirmations writes back into `contacts.fields`.

### PR 3.2 — Google Calendar / Outlook Calendar integrations

Same shape, OAuth → calendar API → same four tools.

### PR 3.3 — HubSpot / Salesforce CRM read + write

Read contacts, write call outcomes back as activity timeline entries.

### PR 3.4 — Zapier OUT (Scope #24)

`webhook_endpoints` table fires on configured events (`call.completed`, `outcome.booked`, etc.), HMAC-signed, retries on failure. (Some of this exists in code; this PR completes it + adds UI to manage endpoints.)

### PR 3.5 — Agent Template Library (17 templates) (Scope #6)

Seed `agent_templates` rows. Per Scope #5 + #6 + the critique-locked principle: **templates carry name/goal/voice-suggestion/tools/consent — NOT pre-written persona text.** Customer writes persona.

The 17 templates split by vertical:
- Shopify: Sales · Support · Cart Recovery · Order-Status · Returns · Loyalty Outreach · Win-Back
- Clinic: Appointment Booking · Intake Triage · Reminders · No-Show Recovery · Insurance Pre-Verify
- General: Receptionist · Lead Qualifier · Survey · Event Confirmation · After-Hours

### PR 3.6 — Vertical skeleton seeds + Clinic onboarding journey polish

Populate `vertical_configs` rows for both verticals: tool catalogue, recommended voices, recommended skeletons, contact field mapping, glossary. The journey UI reads from these (Scope #3 AC: "switching the seed config row changes the whole downstream UI with zero code change").

---

## 6. Phase 4 — Post-seed optimisation

NOT in v1. Documented here only so the architecture leaves room.

| Option | Revisit trigger | Effort |
|---|---|---|
| **Outcome pricing GA** (per-resolved-booking, per-recovered-cart pricing) | When Phase-1 Shopify has clean attribution data, OR when a deal is lost specifically on pricing model. Meters pre-registered in PR 2.4. | medium — new Stripe price ladder + `usage_ledger.kind` enum values + UI |
| **Vapi swap** (cost optimisation via BYO keys) | When monthly minutes > 1,000 customer-months sustained AND ElevenLabs grant expired. | shallow — flip `VOICE_PROVIDER` env, run `scripts/migrate-elevenlabs-to-vapi.js` |
| **Pipecat self-host** (deeper COGS cut) | When monthly minutes > 10K sustained AND SRE budget exists. | high — full new provider implementation + ops |
| **Twilio Elastic SIP Trunking** | When inbound minutes > 100K/mo (saves ~$0.005/min). | medium |
| **Bun + Hono + TS migration** | When team adds typed-runtime engineer; or when Express runtime cost matters. | high — full rewrite |
| **Self-hosted pgvector** | Only if CAI RAG limits or recall quality bite. Brief §7 risk row tracks. | high |
| **Per-customer BYO LLM keys** | On request, Enterprise-tier only. | medium |
| **HIPAA mode** ($2K/mo CAI add-on) | First qualified clinic deal that asks for BAA. | medium — config + custom storage + provider re-certification |

The `VoiceProvider` seam (Scope §I.5) is the contract that makes all of these refactors, not rewrites.

---

## 7. Consolidated DB changes

Every DDL added across the phases above. Fold into `database-guide.md` §3.1, §11, and appendix-invariants at the next consolidation pass.

```sql
-- Phase 0
alter type voice_provider add value if not exists 'elevenlabs';
alter type meter_kind     add value if not exists 'llm_tokens';

alter table usage_ledger
  add column if not exists tokens_in  integer,
  add column if not exists tokens_out integer,
  add column if not exists cost_usd   numeric(12,4);
create index if not exists usage_ledger_org_cost_idx
  on usage_ledger (org_id, occurred_at desc) include (cost_usd);

create table spend_guards (...);                  -- §0.4 full DDL above
create table spend_counters (...);                -- §0.4
create function can_spend(...) returns boolean;   -- §0.4

create table inbound_rate_counters (...);         -- §0.5
create function check_inbound_rate(...) returns text;  -- §0.5

-- Phase 1
alter table agents
  add column if not exists voicemail_message text;

create table voice_favorites (...);               -- PR 1.7
create table voice_preview_cache (...);           -- PR 1.7

alter table contacts
  add column if not exists preferred_language text;  -- PR 1.8

alter table users
  add column if not exists phone_e164         text,
  add column if not exists phone_verified_at  timestamptz;  -- PR 1.9

-- knowledge_sources already exists; ensure cai_doc_id column present
alter table knowledge_sources
  add column if not exists cai_doc_id text;

-- Phase 3
create table agent_templates (
  id           uuid primary key default gen_random_uuid(),
  vertical     text,                              -- 'shopify' | 'clinic' | null (general)
  slug         text not null unique,
  name         text not null,
  goal         text not null,
  recommended_voice_id text,
  default_tools text[],
  forces_consent_required boolean not null default false,
  created_at   timestamptz not null default now()
);

create table webhook_endpoints (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  url           text not null,
  secret_ref    text not null,
  events        text[] not null,
  status        text not null default 'active',
  created_at    timestamptz not null default now()
);
```

All RLS policies extend the existing org-isolation pattern (`using (org_id = auth_org())`).

---

## 8. Acceptance criteria index

Maps each scope §0 capability to the PR(s) that close it.

| # | Capability | Closed by PR(s) | Phase |
|---|---|---|---|
| 1 | Auth + tenant bootstrap | 1.12 (UI polish; backend done) | 1 |
| 2 | Dashboard Setup Checklist | 1.12 | 1 |
| 3 | Vertical picker + branching | 3.6 | 3 |
| 4 | Integrations connect (Shopify) | **1.10** | **1** |
| 4 | Integrations connect (Cal.com, Cal/G/O, CRMs) | 3.1, 3.2, 3.3 | 3 |
| 5 | No-code Agent Builder | 1.3 + 1.7 (voice picker) + 1.8 (lang) | 1 |
| 6 | Agent Template Library | 3.5 (full) + 1.10 (Shopify skeletons partial) | 1+3 |
| 7 | Knowledge Base (CAI-native RAG) | 1.4 | 1 |
| 7b | Spend guards | 0.4 + 2.5 (reconciliation) | 0+2 |
| 8 | Phone numbers | 1.11 | 1 |
| 9 | Local CRM import/export | 2.2 (campaign builder uses it) — standalone hardening can be a fast-follow | 2 |
| 10 | Consent + DNC + `can_dial()` | already in schema/code; integrated via PR 2.1 | 2 |
| 11 | Inbound | **1.5** (admission gate) | **1** |
| 12 | Triggered outbound (Shopify) | **1.10** | **1** |
| 12 | Triggered outbound (Cal.com / CRM) | 3.1, 3.3 | 3 |
| 13 | Campaign engine | 2.1 (engine) + 2.2 (UI) | 2 |
| 14 | Calls + recordings/transcripts | 2.3 (webhook persists) + viewer (already in pages) | 2 |
| 15 | Outcomes / Analytics | 2.6 | 2 |
| 16 | Billing | 2.4 + 2.5 + 2.7 | 2 |
| 17 | Settings | 1.12 (org + notif + compliance) + 2.7 (billing tab) | 1+2 |
| 18 | Test-call-yourself | **1.9** | **1** |
| 19 | Business hours / timezone | 1.3 (in agent CRUD) + `can_dial()` integration in 2.1 | 1+2 |
| 20 | Notifications | 2.7 (alerts) + existing `notifications` module | 2 |
| 21 | Call transfer / escalation | 1.6 | 1 |
| 22 | Multi-language EN/ES (or all 32) | 1.8 | 1 |
| 23 | Whitelabel basic UI | 1.12 (Settings F.4 tab) | 1 |
| 24 | Webhook / Zapier OUT | 3.4 | 3 |
| 25 | Error & empty states | crosscut — applied as pages are migrated to shadcn through Phase 1+2 | 1+2 |
| 26 | RLS + invariants | 0.4 + 0.5 (new invariants #9–11 added; #1–7 from existing schema) | 0 |

---

## 9. Risks and mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| ElevenLabs CAI ToS interpretation conflict | low | high | Workstream 0.1 — email `sales@elevenlabs.io` BEFORE writing runtime code; keep reply on file |
| Pass-through LLM token bloat (Critique #4) | medium | high | PR 2.3 records `tokens_in/out` + `cost_usd` per call; PR 0.4 gates on `cost_usd`; weekly eval surfaces real $/min vs $0.15 floor; if RAG context bloat is the driver, that's the trigger to revisit Phase-4 self-hosted pgvector |
| Inbound DoS / cost bomb (Critique #1) | medium | high | PR 1.5 admission gate + PR 0.5 rate counters; Twilio UsageTrigger on subaccount as provider-side backstop |
| Twilio toll fraud on a fresh subaccount | low | high (could be $10K in hours) | Per-tenant Twilio UsageTrigger + auto-suspend on threshold; Workstream 0.1 Twilio Startup credits soften the blow if it happens |
| ElevenLabs grant exhausted before pricing covers COGS | low | medium | 33M chars ≈ 680 hours ≈ 25 customer-months at 1,500 min/mo each; Starter trial cap 25 min; PR 0.4 hard quota stops runaway |
| Voice quality drift after CAI model updates | low | medium | Pin agent config schema; smoke-test probe agent every 15 min in prod (alerts if drift) |
| Concurrency cap hit during campaign blast (Pro = 20 concurrent) | medium at scale | medium | `campaigns.concurrency` default 5; monitor metric; auto-flag upgrade to Business when sustained > 18 |
| Shopify Partner app deprecation / breaking changes | medium | medium | `integrations/providers/shopify/` is a versioned interface; webhook handler tolerates payload shape changes via Zod with `passthrough` |
| Vapi code rots while inactive | high (low impact) | low | Quarterly CI run against the Vapi provider tests; if it rots, delete and re-implement against the abstraction during Phase 4 if needed |
| Pricing model captures less margin than outcome-based (Critique #2 accepted risk) | medium | low-medium | Outcome meters pre-registered in PR 2.4; revisit trigger documented; flipping is a config change |

---

## 10. Open questions

These do not block Phase 0 or 1.1. They block individual workstream PRs as noted.

| # | Question | Blocks | Default if no answer |
|---|---|---|---|
| 1 | Default voice when customer hasn't picked one? | PR 1.7 | Bella (EN) / Mateo (ES); "change anytime" banner on agent card |
| 2 | Default opening message when customer leaves it blank? | PR 1.3 | Inbound: "Hi, how can I help you today?"; Outbound: reject save (require explicit so `{first_name}` interpolation is intentional) |
| 3 | KB size cap per tenant tier? | PR 1.4 | Starter 50 docs / 10MB · Growth 500 docs / 100MB · Scale unlimited (within ElevenLabs account limits) |
| 4 | Voice library: full 5k+ or curated only? | PR 1.7 | Two tabs (curated + browse all) — both. Analytics tells us if anyone uses browse-all. |
| 5 | Recording on by default or opt-in? | PR 2.3 / Settings | **Opt-in per tenant, with mandatory disclosure preamble injected into agent first-message when on.** Default off (two-party-consent jurisdictions). |
| 6 | Aurora curated voice list — who maintains? | PR 1.7 | Backend team seeds 12 EN + 6 ES at launch; revisit quarterly based on adoption analytics |
| 7 | Custom preview sample lines per vertical — who writes? | PR 1.7 | Product + design write 2-3 per vertical, stored in `vertical_configs.config.preview_samples` |
| 8 | Inbound rate-limit thresholds — keep defaults (5/from-min, 30/to-min) or tighter? | PR 1.5 | Defaults; tenant-configurable later via `spend_guards.action_config` |
| 9 | TwiML on blocked inbound: voicemail (default) vs hard reject? | PR 1.5 | Voicemail; hard reject only via opt-in flag for known-fraud tenants |
| 10 | Multilingual: ship all 32 Flash v2.5 languages, or hold to EN/ES per Scope §A.22 strict reading? | PR 1.8 | Ship all 32 (the schema and provider support it); LanguagePicker can be filtered down with one config if scope owner wants EN/ES-only for launch |

---

## 11. Phase 4 migration plan — back to Vapi (reference)

(Reproduced from prior plan for completeness — the seam works either direction.)

```js
// backend/src/providers/voice/factory.js — flip in one line
const DEFAULT_PROVIDER = process.env.VOICE_PROVIDER || "elevenlabs";
//                                                   ^^^^^^^^^^^^   → "vapi"
```

Plus the data migration script `scripts/migrate-elevenlabs-to-vapi.js`:

1. For each `agents` row where `provider='elevenlabs'`: call `VapiProvider.createAgent(agent, generateSystemPrompt(persona))`, store the returned id, mark `provider='vapi'` + `provider_ref=new_id`.
2. For each `phone_numbers` row: call `VapiProvider.attachPhoneNumber(...)`, update `provider_ref`.
3. For each `knowledge_sources` row: re-ingest (Vapi has no equivalent KB; either swap to pgvector at the same time or keep CAI KB as a side service called by a tool).
4. Delete the ElevenLabs agents/numbers via their API.
5. Cut over the inbound webhook `/webhooks/twilio/inbound` to handoff to Vapi instead of CAI.

Estimated ~200 lines of script + ~1 day of careful migration per active org.

---

## 12. References

- Scope contract: [`Aurora-v1-Scope-and-Build-Contract.md`](./Aurora-v1-Scope-and-Build-Contract.md) — the master.
- Database guide: [`database-guide.md`](./database-guide.md) — schema reference (this plan adds tables that should fold in at next consolidation).
- Research evidence: [`research/elevenlabs-cai-evidence.md`](./research/elevenlabs-cai-evidence.md).
- Critique decisions audit trail: [`research/critique-response-and-decisions.md`](./research/critique-response-and-decisions.md).
- ElevenLabs Startup Grants: <https://elevenlabs.io/startup-grants>
- ElevenLabs CAI: <https://elevenlabs.io/agents>
- ElevenLabs Twilio native integration: <https://elevenlabs.io/docs/eleven-agents/phone-numbers/twilio-integration/native-integration>
- ElevenLabs KB API: <https://elevenlabs.io/docs/eleven-agents/customization/knowledge-base/rag>
- Stripe Billing Meters: <https://docs.stripe.com/api/billing/meter-event?api-version=2026-03-25.dahlia>
- Twilio UsageTrigger API: <https://www.twilio.com/docs/usage/api/usage-trigger>
- Twilio Programmable Voice pricing (US): <https://www.twilio.com/en-us/voice/pricing/us>
