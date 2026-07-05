# Weeber — Master Cursor / AI Agent Rules

> Save this file's context into Cursor's "Rules for AI" or refer to it at the start of a coding session.
> This is the living source of truth for the codebase.

---

## 1. What Weeber Is

Weeber is a **no-code voice-AI SaaS platform for SMBs**. A merchant connects their Shopify store (or clinic calendar), answers a short Q&A wizard, and gets a production voice agent live in under 10 minutes. The agent handles **inbound calls**, places **outbound calls**, and runs **bulk scheduled voice campaigns** — all billed on subscription + metered minutes + outcome metrics.

**The moat is NOT the voice runtime.** It is:
1. Deep **Shopify integration** (cart recovery agent with `lookup_order`, `cancel_order`, `apply_discount_code`, `update_address` tools + abandoned-checkout trigger)
2. Deep **Clinic integration** (Cal.com booking, appointment reminders, no-show reduction)
3. **Consent / DNC / compliance core** (TCPA-grade, pre-dial gate, append-only ledgers)
4. The **campaign engine** (scheduler + consent gate + retry state machine + spend guard)

The voice runtime is **ElevenLabs Conversational AI (CAI)** — rented, not rebuilt.

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
| Repo | monorepo with `backend/` and `src/` (frontend) and `supabase/` |

---

## 3. Directory Structure

```
Vocalist/
├── backend/                    Node + Express API (CommonJS)
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
│   │   │   ├── integrations/   integration.service.js · providers/ (12 providers: shopify, hubspot, calcom, cliniko, drchrono, freshsales, jane_app, pipedrive, salesforce, whatsapp, zoho_crm + shopify.internal.routes.js)
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
│   │   │   ├── elevenlabs.provider.js  ← ACTIVE
│   │   │   ├── vapi.provider.js        ← compiled, NOT registered
│   │   │   ├── retell.provider.js      ← compiled, NOT registered
│   │   │   └── mock.provider.js        ← tests only
│   │   ├── services/           persona.service.js · twilio-stream.service.js
│   │   ├── tests/invariants/   19 test files covering critical invariants
│   │   ├── utils/              asyncHandler · errors · idempotency · phone · credential.helper
│   │   └── workers/            ← dialer worker must be built here
│   └── package.json
│
├── src/                        Vite + React frontend (TypeScript + Tailwind v4)
│   ├── pages/                  Page routing & views
│   ├── components/             UI, layouts, WebTestCallModal, VariablesPanel, CommandPalette
│   ├── config/                 agent-variables.ts · verticals/ · marketing.ts
│   └── lib/                    api.ts (custom client) · db.ts · supabase.ts · admin-api.ts
│
└── supabase/
    ├── migrations/             Supabase migrations (RLS is active)
    └── functions/              shopify-connect · oauth-exchange etc.
```

---

## 4. The 13 Non-Negotiables (Never Break These)

These are hard invariants. If a change would violate any of these, **stop and flag it**.

1. **No outbound dial without `can_dial()` = true** at dial time. (TCPA compliance)
2. **Consent/DNC ledgers are append-only** — never UPDATE or DELETE via API. Opt-out propagates in one atomic transaction.
3. **RLS on every tenant table** — `org_id` filter at DB level, not just application level.
4. **Secrets via Supabase Vault** (`secret_ref`) — never store API keys / auth tokens in plaintext columns.
5. **No vendor SDK imported directly** — all voice goes through `VoiceProvider` interface in `providers/voice/factory.js`.
6. **No call billed twice** — `usage_ledger` idempotency key (`buildIdempotencyKey([call_id, meter_kind])`) must be present on every insert.
7. **No technical jargon in the no-code UI** — "LLM", "prompt", "webhook", "endpoint" must not appear in default (non-Advanced) views.
8. **Verticals are config rows** in `vertical_configs` — never hardcoded in business logic.
9. **No call placed without `can_spend()` = true** — Twilio + LLM COGS are real money from call #1.
10. **Knowledge Base = CAI-native** — no pgvector. `knowledge_sources` is a thin mirror with `cai_doc_id`. Never build self-hosted RAG.
11. **Inbound passes our Express admission gate first** — `check_inbound_rate()` + `can_spend()` before any TwiML handoff to CAI. No native CAI number binding for inbound, ever.
12. **Spend guards meter on `cost_usd`** (not minutes) — `usage_ledger` must have `tokens_in`, `tokens_out`, `cost_usd` on every completed call row.
13. **Centralized Data Access (No Direct Client-side Queries)** — Never call `supabase.from()` directly inside frontend React pages/components. All queries and database mutations must be defined in `src/lib/db.ts` to ensure consistent error handling, tenant scoping, and logging.

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

---

## 6. Feature Flags & Environment Variables

Make sure environment variables are declared in server config. Core variables:
- `ELEVENLABS_API_KEY`
- `VOICE_PROVIDER` (defaults to `elevenlabs`)
- `TWILIO_ACCOUNT_SID` & `TWILIO_AUTH_TOKEN`
- `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY` & `STRIPE_WEBHOOK_SECRET`

---

## 7. Current Build Status

| Area | Status |
|---|---|
| Schema & Database Migrations | ✅ Production-grade |
| Auth + Multi-tenancy + RLS | ✅ Implemented |
| Express modules & controllers | ✅ Scaffolded |
| ElevenLabs Voice Provider | ✅ Implemented |
| Twilio Subaccount Provisioning | ✅ Implemented |
| Spend Guards & ledgers | ✅ Implemented |
| Admin Panel v2 (expanded charts & filters) | ✅ Implemented |
| Testing Infrastructure (Vitest) | ✅ Implemented |
| Zod Form Schemas & Helmet headers | ✅ Implemented |
| Dialer Worker | ✅ Implemented |
| Inbound TwiML Admission Gate | ✅ Implemented |
| Shopify OAuth App Callback | ✅ Implemented |
| Shopify v2 (Playbooks + Scheduled Calls) | ✅ Implemented |
| Web Test Call (in-browser via ElevenLabs) | ✅ Implemented |
| Indian Telephony (Exotel, VoBiz) | ✅ Implemented |
| **Stripe Subscriptions Webhook Sync** | ❌ MISSING (P1) |
