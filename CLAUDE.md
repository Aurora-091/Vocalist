# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Weeber (repo name "Vocalist", formerly "Aurora") — a no-code voice-AI SaaS for SMBs (Shopify stores, clinics). Merchants get phone-based AI agents for inbound support, outbound calls, and bulk scheduled voice campaigns. Voice runtime is ElevenLabs Conversational AI (rented, not rebuilt); telephony is Twilio with per-tenant subaccounts; billing is Stripe subscription + metered usage.

Monorepo: `src/` (frontend), `backend/` (API + workers), `supabase/` (migrations + Deno edge functions), `docs/` (specs — see `docs/Weeber-Cursor-Rules.md`, the living source of truth).

## Commands

### Frontend (repo root — Vite + React + TypeScript)
```bash
npm run dev          # dev server on :5173 (proxies /v1, /webhooks, /ws to backend :3000)
npm run build        # vite build
npm run lint         # eslint src
npx tsc --noEmit     # type check — run before ending a change
npm test             # vitest run
npx vitest run src/path/to/File.test.tsx   # single test file
```

### Backend (`cd backend` — Node 20+, Express 5, CommonJS)
```bash
npm run dev          # nodemon server.js (port 3000)
npm start            # node server.js
npm run start:workers  # worker-entry.js — dialer/retry/billing-rollup/lease-sweeper/webhooks-out/call-scheduler (separate Railway service)
npm test             # node --test src/tests/invariants/*.test.js (injects dummy Supabase env)
npx cross-env SUPABASE_URL=http://localhost SUPABASE_ANON_KEY=dummy_key_must_be_20_chars node --test src/tests/invariants/billing.test.js   # single test
npm run lint:syntax  # node --check over all backend files
```

Database migrations live in `supabase/migrations/` and are applied via the Supabase dashboard or MCP tooling, not a local CLI workflow.

## The 13 Non-Negotiables

Hard invariants from `docs/Weeber-Cursor-Rules.md`. If a change would violate one, stop and flag it. Backend invariant tests in `backend/src/tests/invariants/` guard these.

1. No outbound dial without `can_dial()` = true at dial time (TCPA compliance).
2. Consent/DNC ledgers (`consent_events`) are append-only — never UPDATE/DELETE via API.
3. RLS on every tenant table — `org_id` filter enforced at DB level.
4. Secrets via Supabase Vault (`secret_ref`) — never plaintext credential columns.
5. No vendor voice SDK imported directly — all voice goes through the `VoiceProvider` interface (`backend/src/providers/voice/factory.js`).
6. No call billed twice — every `usage_ledger` insert uses `buildIdempotencyKey([call_id, meter_kind])`.
7. No technical jargon ("LLM", "prompt", "webhook", "endpoint") in default (non-Advanced) UI views.
8. Verticals are config rows in `vertical_configs` — never `if (vertical === ...)` conditionals in business logic.
9. No call placed without `can_spend()` = true.
10. Knowledge Base is CAI-native (ElevenLabs docs, `knowledge_sources` mirror with `cai_doc_id`) — never build self-hosted RAG / pgvector.
11. Inbound calls pass the Express admission gate (`check_inbound_rate()` + `can_spend()`) before any TwiML handoff — never bind numbers natively to CAI.
12. Spend guards meter on `cost_usd`, not minutes — completed call rows need `tokens_in`, `tokens_out`, `cost_usd`.
13. Centralized data access — never call `supabase.from()` in React pages/components; all frontend queries/mutations go through `src/lib/db.ts`.

## Architecture

### Backend (`backend/`)
- **CommonJS only** (`require`/`module.exports`) — no ESM syntax in `backend/`.
- `server.js` → `src/app.js` (Express app, CORS allowlist, route mounting). One folder per domain under `src/modules/` (agents, billing, calls, campaigns, consent, contacts, integrations, numbers, playbooks, twilio, webhooks, …), each with `*.routes.js` + service/validator files.
- **Voice provider abstraction**: `src/providers/voice/interface.js` is the base class; `factory.js` registers only `elevenlabs` + `mock` (vapi/retell are compiled but unregistered, reserved for a later swap). Telephony has a parallel abstraction in `src/providers/telephony/` (twilio, plivo).
- **Inbound webhooks**: `src/modules/webhooks/handlers/` (elevenlabs, twilio, stripe, vapi) — all signature-verified (`src/utils/signature.js`). Twilio uses per-tenant subaccounts with credentials in Supabase Vault.
- **Workers**: `src/workers/` run as a separate process (`worker-entry.js`, deployed via `railway.worker.json` with a bare HTTP health probe on :3001). The campaign engine = scheduler + consent gate (`modules/consent/consent-gate.js`) + retry state machine (`modules/campaigns/state-machine.js`) + spend guard.

### Frontend (`src/`)
- Two sub-apps under `src/apps/`: `customer/` and `admin/`, plus route-level pages in `src/pages/`.
- **Vertical registry**: `src/config/verticals/` (shopify, clinic, hotel) drives all vertical-specific behavior via config + the `VerticalContext` `t()` glossary helper — zero vertical conditionals in components.
- Data layer: `src/lib/db.ts` (all Supabase queries), `src/lib/api.ts` (backend HTTP client with auth retry), `src/lib/admin-api.ts`.
- Tailwind v4 + shadcn/ui (`src/components/ui/`).

### Supabase (`supabase/`)
- Deno TypeScript edge functions in `functions/` (shopify-connect, oauth-exchange, agent-bridge, whatsapp-webhook, …). Look up secrets from Vault; avoid Deno env fallbacks.
- Multi-tenancy pattern: every tenant table has non-nullable `org_id`, RLS policies check `auth.jwt() ->> 'org_id'`, PKs are `gen_random_uuid()`.

### Deployment
Frontend → Vercel (`vercel.json`); backend API + worker → Railway (`railway.json`, `railway.worker.json`). See `docs/DEPLOYMENT.md`.

## Conventions

- After meaningful changes, update `docs/CHANGELOG.md` (and `docs/DECISIONS.md` for architectural changes) with a timestamp formatted `Day, YYYY-MM-DD HH:MM IST`.
- When a change spans layers, update dependency files (`db.ts`, services) before the client views that consume them.
- Before finishing: `npx tsc --noEmit` at root and `npm test` in `backend/` must both pass.
