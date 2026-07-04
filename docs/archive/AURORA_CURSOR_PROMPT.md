# Aurora — Master Cursor / AI Agent Prompt

> Paste this entire file into Cursor's "Rules for AI" or at the top of every session.
> Update it as decisions change — this is the living source of truth for the codebase.

---

## 1. What Aurora Is

Aurora is a **no-code voice-AI SaaS platform for SMBs**. A merchant connects their Shopify store (or clinic calendar), answers a short Q&A wizard, and gets a production voice agent live in under 10 minutes. The agent handles **inbound calls**, places **outbound calls**, and runs **bulk scheduled voice campaigns** — all billed on subscription + metered minutes + outcome metrics.

**The moat is NOT the voice runtime.** It is:
1. Deep **Shopify integration** (cart recovery agent with `lookup_order`, `cancel_order`, `apply_discount_code`, `update_address` tools + abandoned-checkout trigger)
2. Deep **Clinic integration** (Cal.com booking, appointment reminders, no-show reduction)
3. **Consent / DNC / compliance core** (TCPA-grade, pre-dial gate, append-only ledgers)
4. The **campaign engine** (scheduler + consent gate + retry state machine + spend guard)

The runtime is **ElevenLabs Conversational AI (CAI)** — rented, not rebuilt.

---

## 2. Stack (Binding — Do Not Change Without Explicit Approval)

| Layer | Tech |
|---|---|
| Backend | Node.js + Express + **CommonJS** (no ESM, no Bun, no Hono yet) |
| Frontend | Vite + React + TypeScript + **Tailwind v4** + **shadcn/ui** |
| Database | **Supabase** (Postgres + RLS + Auth + Realtime + Storage + Edge Functions) |
| Voice runtime | **ElevenLabs CAI** — registered in `VoiceProvider` factory; Vapi compiled but NOT registered (Phase-4 swap) |
| Telephony | **Twilio** — per-tenant subaccounts (not one master account); secrets stored in Supabase Vault |
| Billing | **Stripe** — subscriptions + metered usage from `usage_ledger` |
| Queue / cache | Upstash Redis (dialer job queue + rate limits) — not yet implemented |
| Package manager | npm (backend), npm (frontend) |
| Repo | `Aurora-091/Vocalist` — monorepo with `backend/`, `src/`, `supabase/` |

---

## 3. Directory Structure

```
Vocalist/
├── backend/                    Node + Express API
│   ├── server.js               Entry point
│   ├── src/
│   │   ├── app.js              Express app + route mounting
│   │   ├── config/             env.js · logger.js · supabase.js
│   │   ├── middleware/         auth · error · rate-limit · validation
│   │   ├── modules/            Feature modules (one folder = one domain)
│   │   │   ├── agents/         agent.service.js · agents.routes.js
│   │   │   ├── billing/        billing.service.js · metering.js · billing.routes.js
│   │   │   ├── calls/          call.service.js · calls.routes.js
│   │   │   ├── campaigns/      campaigns.routes.js · state-machine.js
│   │   │   ├── consent/        consent-gate.js · consent.routes.js
│   │   │   ├── contacts/       contacts.routes.js · contacts.validator.js
│   │   │   ├── integrations/   integration.service.js · providers/shopify · hubspot
│   │   │   ├── knowledge/      knowledge.routes.js
│   │   │   ├── notifications/  notifications.routes.js
│   │   │   ├── numbers/        numbers.routes.js
│   │   │   ├── onboarding/     onboarding.routes.js
│   │   │   ├── organizations/  organizations.routes.js
│   │   │   ├── settings/       settings.routes.js
│   │   │   ├── twilio/         twilio.client.js · twilio.routes.js
│   │   │   ├── users/          users.routes.js
│   │   │   ├── verticals/      verticals.routes.js
│   │   │   ├── webhooks/       webhook.routes.js · webhook.service.js
│   │   │   │   └── handlers/   elevenlabs.handler.js · twilio.handler.js · stripe.handler.js · vapi.handler.js
│   │   │   └── webhooks-out/   webhooks-out.routes.js
│   │   ├── providers/voice/    VOICE PROVIDER ABSTRACTION
│   │   │   ├── interface.js    VoiceProvider base class — ALL voice goes through here
│   │   │   ├── factory.js      buildVoiceProvider() — only elevenlabs + mock registered
│   │   │   ├── elevenlabs.provider.js  ← ACTIVE (Phase 1)
│   │   │   ├── vapi.provider.js        ← compiled, NOT registered (Phase 4)
│   │   │   ├── retell.provider.js      ← compiled, NOT registered
│   │   │   └── mock.provider.js        ← tests only
│   │   ├── services/           persona.service.js · twilio-stream.service.js
│   │   ├── tests/invariants/   12 test files covering critical invariants
│   │   ├── utils/              asyncHandler · errors · idempotency · phone · promptBuilder
│   │   └── workers/            ← MISSING: dialer worker must be built here
│   └── package.json
│
├── src/                        Vite + React frontend
│   ├── pages/                  19 pages (all scaffolded)
│   ├── components/             legacy-ui/ + shadcn ui/
│   └── lib/                    api.ts · db.ts · supabase.ts · utils.ts
│
└── supabase/
    ├── migrations/             23 migrations (schema is production-grade)
    └── functions/              shopify-connect · shopify-proxy · agent-bridge
                                oauth-exchange · whatsapp-webhook · google-sheets-export
```

---

## 4. The 12 Non-Negotiables (Never Break These)

These are hard invariants. If a change would violate any of these, **stop and flag it**.

1. **No outbound dial without `can_dial()` = true** at dial time. (TCPA compliance)
2. **Consent/DNC ledgers are append-only** — never UPDATE or DELETE via API. Opt-out propagates in one atomic transaction.
3. **RLS on every tenant table** — `org_id` filter at DB level, not just application level.
4. **Secrets via Supabase Vault** (`secret_ref`) — never store API keys / auth tokens in plaintext columns.
5. **No vendor SDK imported directly** — all voice goes through `VoiceProvider` interface in `providers/voice/factory.js`.
6. **No call billed twice** — `usage_ledger` idempotency key (`buildIdempotencyKey([call_id, meter_kind])`) must be present on every insert.
7. **No technical jargon in the no-code UI** — "LLM", "prompt", "webhook", "endpoint" must not appear in default (non-Advanced) views.
8. **Verticals are config rows** in `vertical_configs` — never hardcoded in business logic.
9. **No call placed without `can_spend()` = true** — Twilio + LLM COGS are real money from call #1 even on the ElevenLabs grant.
10. **Knowledge Base = CAI-native** — no pgvector in Phase 1. `knowledge_sources` is a thin mirror with `cai_doc_id`. Never build self-hosted RAG.
11. **Inbound passes our Express admission gate first** — `check_inbound_rate()` + `can_spend()` before any TwiML handoff to CAI. No native CAI number binding for inbound, ever.
12. **Spend guards meter on `cost_usd`** (not minutes) — `usage_ledger` must have `tokens_in`, `tokens_out`, `cost_usd` on every completed call row.

---

## 5. Key Database Patterns

### Multi-tenancy
- Every table has `org_id uuid NOT NULL REFERENCES orgs(id)` — never nullable, never updatable.
- RLS policies enforce `auth.jwt() ->> 'org_id'` on every select/insert/update.
- PKs are `uuid` (`gen_random_uuid()`) — non-enumerable, safe in URLs.

### Append-only ledgers (never mutate)
- `consent_events` — opt-in/opt-out events only; never delete/update.
- `usage_ledger` — billing records; idempotency key prevents duplicates.
- `dialer_transitions` — campaign state machine audit trail.
- `webhook_events` — inbound webhook log.

### Spend guard pattern (run before every call)
```js
// Before placing any call:
const spendOk = await supabase.rpc('can_spend', { p_org: orgId, p_scope: 'org', p_scope_id: null });
const dialOk = await canDial(supabase, { orgId, e164, now });
if (!spendOk || !dialOk) { /* log + skip, never throw silently */ }
```

### Idempotency pattern (billing)
```js
const key = buildIdempotencyKey([callId, 'voice_minutes']); // SHA-256 hash
// usage_ledger has unique constraint on idempotency_key
// Insert with ON CONFLICT DO NOTHING + check error.code === '23505'
```

### Campaign state machine
Valid states: `queued → dialing → ringing → in_call → completed | failed | voicemail → retry_wait → queued | do_not_call`
Terminal states: `completed`, `do_not_call` — no transition out.
Use `transition(supabase, { targetId, fromState, toState })` in `state-machine.js` — never raw UPDATE.

---

## 6. Voice Provider Contract

Every voice operation MUST go through `buildVoiceProvider()`:

```js
const { buildVoiceProvider } = require('../../providers/voice/factory');
const provider = buildVoiceProvider({ agent, integrationConfig });

// Methods on every provider:
await provider.createAgent(agentData, systemPrompt)     // → { provider_ref, provider_meta }
await provider.startCall({ toE164, fromE164, leaseToken, metadata, providerRef })  // → { provider_call_id, status }
await provider.endCall(providerCallId)
await provider.deleteAgent(providerRef)
await provider.listVoices()
await provider.updateAgent(providerRef, updates)
```

**Active:** `elevenlabs` — registered in factory.
**Inactive (Phase 4):** `vapi`, `retell` — compiled but NOT in `PROVIDERS` map.
**Test only:** `mock` — registered; force with `VOICE_PROVIDER_FORCE_MOCK=1`.

---

## 7. ElevenLabs CAI Integration Points

### Agent creation
`POST /v1/convai/agents/create` → returns `agent_id` stored as `agents.provider_ref`

### Outbound call via Twilio
1. Import the Twilio number to ElevenLabs: `GET /v1/convai/phone-numbers` → if not found, `POST /v1/convai/phone-numbers/import` with Twilio credentials from Vault
2. Initiate: `POST /v1/convai/phone-numbers/{phone_number_id}/initiate-outbound-call`

### Inbound call (NEVER native binding)
Twilio webhook → our Express → admission gate → TwiML `<Connect>` to CAI SIP/stream

### Webhooks from ElevenLabs (→ `POST /webhooks/elevenlabs`)
- `conversation.started` / `call.started` → update `calls.status = 'in_progress'`
- `conversation.ended` / `call.completed` → update status, write `usage_ledger`, run `billing.processCallCompletion()`
- `call.failed` → update status, log reason
- `transcript.available` → store transcript on `calls.transcript`

### Knowledge Base
`POST /v1/convai/knowledge-base/` — upload PDF/URL/text → returns `cai_doc_id`
Store `cai_doc_id` in `knowledge_sources.cai_doc_id`. Attach to agent via agent update.

---

## 8. Shopify Integration — Current State & What's Missing

### What's built:
- `supabase/functions/shopify-connect/` — validates Admin API token (shpat_xxx), stores `api_key_ref` in `shopify_connections`
- `supabase/functions/shopify-proxy/` — proxied reads with caching (`shopify_cache` table) for orders, customers, carts
- `src/pages/ShopifyConnect.tsx` — 4-step UI: domain → instructions → paste token → done

### Critical gaps (must build for the Shopify moat):
1. **OAuth App** (Shopify Partners) — replaces paste-token flow; enables webhook registration
2. **Webhook registration** on install — `checkouts/create` (abandoned cart trigger), `orders/paid`, `app/uninstalled`
3. **Agent tools** — the actual function-calling tools that fire during calls:
   - `lookup_order(order_id)` → Shopify Admin API `GET /orders/{id}.json`
   - `cancel_order(order_id, reason)` → `POST /orders/{id}/cancel.json`
   - `apply_discount_code(checkout_token, code)` → `PUT /checkouts/{token}.json`
   - `update_address(order_id, address)` → `PUT /orders/{id}.json`
4. **Abandoned cart trigger** → enqueue outbound call → consent gate → dial

### OAuth flow to build (2 days):
```
GET /shopify/install?shop=mystore.myshopify.com
  → redirect to https://{shop}/admin/oauth/authorize?client_id=...&scope=...&redirect_uri=...

GET /shopify/callback?code=xxx&hmac=xxx&shop=xxx
  → validate HMAC
  → POST https://{shop}/admin/oauth/access_token → permanent access_token
  → store in shopify_connections
  → register webhooks (checkouts/create, orders/paid, app/uninstalled)
  → redirect merchant to Aurora dashboard
```

---

## 9. Missing Pieces (Priority Order)

### P0 — Blocks demo / investor pitch

**A. Dialer Worker** (`backend/src/workers/dialer.worker.js`)
The single biggest missing piece. Without this, campaigns are UI-only.
```
Logic:
1. Poll campaign_targets WHERE state='queued' AND campaign starts
2. For each target: check can_dial() + can_spend()
3. If pass: transition to 'dialing' → call call.service.startOutboundCall()
4. Handle retry logic (exponential backoff), voicemail drop
5. Update spend_counters after each call
```
Use Upstash Redis BullMQ or simple `setInterval` with DB locking (`FOR UPDATE SKIP LOCKED`).

**B. Inbound TwiML route** (`backend/src/modules/twilio/twilio.routes.js`)
Must exist at `POST /webhooks/twilio/inbound`:
```
1. Resolve org_id + agent_id from called number
2. check_inbound_rate() + can_spend()
3. Return TwiML <Connect> to ElevenLabs CAI endpoint
4. Log admission decision
```

**C. Shopify OAuth App** — see §8 above.

### P1 — Required for first paying merchant

**D. Stripe subscription wiring** — connect plan_tier → Stripe product → charge on overage
**E. Shopify agent tools** — `lookup_order`, `cancel_order`, `apply_discount_code`, `update_address`
**F. Abandoned cart trigger** — Shopify webhook → enqueue outbound call

### P2 — Required for scale / fundraise

**G. Cal.com integration** (clinic vertical)
**H. Real-time campaign monitor** (Supabase Realtime → frontend)
**I. Stripe metered billing** (push `usage_ledger` to Stripe)
**J. Multi-user invite** (schema supports it, UI not built)

---

## 10. Pricing Tiers (Config — Do Not Hardcode)

| Tier key | $/mo | Bundled min | Overage $/min | Numbers |
|---|---|---|---|---|
| `starter` | $99 | 400 | $0.30 | 1 |
| `growth` | $299 | 1,500 | $0.32 | 3 |
| `scale` | $799 | 5,000 | $0.35 | 10 |

True COGS floor = **$0.15/min** (CAI ~$0.10 + LLM pass-through ~$0.02 + Twilio ~$0.014).
Overage is priced at ~2× COGS. This is the margin engine.

---

## 11. Feature Flags & Environment Variables

```env
# Voice
ELEVENLABS_API_KEY=
VOICE_PROVIDER=elevenlabs
VOICE_PROVIDER_FORCE_MOCK=0        # set to 1 in tests

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_SANDBOX_MODE=false          # true = mock subaccounts in dev

# Shopify OAuth (needs to be added)
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
SHOPIFY_SCOPES=read_orders,read_customers,read_checkouts,read_products,write_checkouts

# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Compliance
CALLING_HOUR_START=9               # local hour
CALLING_HOUR_END=20
```

---

## 12. Code Style Rules

- **CommonJS only** in backend — `require()` / `module.exports`. No `import`/`export`.
- **Async/await** everywhere — no raw `.then()` chains in new code.
- All route handlers wrapped in `asyncHandler()` from `utils/asyncHandler.js`.
- Errors via `AppError` class from `utils/errors.js` — never `throw new Error('string')` directly in routes.
- Logging via `logger` from `config/logger.js` — structured JSON, never `console.log` in production paths.
- Phone numbers in **E.164 format** (`+1xxxxxxxxxx`) everywhere — use `utils/phone.js` to normalize.
- Multi-tenant queries **always** include `.eq('org_id', orgId)` — never omit this filter.
- Never hardcode vertical names (`'shopify'`, `'clinic'`) in business logic — read from `vertical_configs`.

---

## 13. Testing Rules

- Every new service method needs a test in `backend/src/tests/invariants/`.
- Invariant tests must cover: the happy path, the blocked path (consent denied / spend over limit), and idempotency (run twice, assert one result).
- Use `VOICE_PROVIDER_FORCE_MOCK=1` in all tests — never make real ElevenLabs / Twilio calls in tests.
- Consent/DNC tests are **Tier-1** — always run, never skip.

---

## 14. What Is Out of Scope (v1) — Never Build These

- EHR / PMS integration (no PHI in v1)
- Full HIPAA BAA program
- Visual flow builder / drag-drop agent canvas
- Languages beyond EN / ES
- Community template marketplace
- Self-hosted voice runtime (Pipecat) — Phase 4
- White-label reseller program (basic logo/color IS in scope; full resale is not)
- pgvector / self-hosted RAG (CAI owns this)
- Outcome-based pricing (Phase 2 upsell, not v1)

---

## 15. Current Build Status

| Area | Status |
|---|---|
| Schema (23 migrations) | ✅ Production-grade |
| Auth + multi-tenancy + RLS | ✅ Done (auth trigger fixed 2026-06-11) |
| Backend module structure (17 modules) | ✅ Scaffolded |
| ElevenLabs provider (agent CRUD + calls) | ✅ Implemented |
| Twilio subaccount per tenant | ✅ Implemented |
| Spend guards (DB + can_spend RPC) | ✅ Implemented |
| Campaign state machine | ✅ Implemented |
| Consent gate (can_dial) | ✅ Implemented |
| Billing service (usage_ledger) | ✅ Implemented |
| ElevenLabs webhook handler | ✅ Implemented |
| Frontend (19 pages) | ✅ All scaffolded |
| Shopify connect (paste-token flow) | ✅ Done (edge function) |
| **Dialer worker** | ❌ MISSING |
| **Inbound TwiML admission gate** | ❌ MISSING |
| **Shopify OAuth app** | ❌ MISSING |
| **Shopify agent tools** (lookup_order etc.) | ❌ MISSING |
| **Abandoned cart trigger** | ❌ MISSING |
| **Stripe subscription wiring** | ❌ MISSING |
| Cal.com integration | ❌ Phase 3 |

---

*Last updated: 2026-06-11. Owner: Rushikesh Pawar (I-invincib1e). Repo: Aurora-091/Vocalist.*
