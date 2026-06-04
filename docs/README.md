# Aurora — Specification Documents

Canonical project specs. These are the source of truth that all implementation
work (backend, frontend, ops) should be measured against. Update these here
when scope or design changes — do not let them drift out of date.

## Specs

| Document | What it covers |
|---|---|
| [`Aurora-v1-Scope-and-Build-Contract.md`](./Aurora-v1-Scope-and-Build-Contract.md) | v1 scope, build sequence, definition of done, and the contract between product/eng. Start here. |
| [`Aurora-BlackBook.md`](./Aurora-BlackBook.md) | Comprehensive technical black book — system architecture, database design, ER diagrams, RLS policies, indexing, partitioning, triggers, feature specs, security model. |
| [`Aurora-UIUX-Spec.md`](./Aurora-UIUX-Spec.md) | UI/UX & frontend spec — design system, sitemap, navigation/IA, role-based views, component library, per-page wireframes, user flows, state matrix. Covers Shopify + Clinic verticals + internal Ops role. |
| [`database-guide.md`](./database-guide.md) | Database guide companion to the migrations in `supabase/migrations/` — table definitions, enums, partitioning strategy, triggers, RLS, operational patterns. |

## Active implementation plans

| Document | Status | Covers |
|---|---|---|
| [`implementation-plan-elevenlabs-twilio.md`](./implementation-plan-elevenlabs-twilio.md) | **ACTIVE — Phase 1** | ElevenLabs CAI as agent runtime + ElevenLabs KB as RAG layer + Twilio for PSTN. Customer-built personas, multi-agent/multi-number per tenant, vertical integrations (Shopify + Clinic) in Phase 3. Apply for the ElevenLabs Startup Grant on day 1. |
| [`implementation-plan-vapi-twilio-billing.md`](./implementation-plan-vapi-twilio-billing.md) | **DEFERRED to Phase 4** | Pre-seed-period analysis of the Vapi+BYO route. Kept as the reference for the post-seed cost-optimisation swap. The Vapi provider code stays in the repo behind the same `VoiceProvider` abstraction. |

## How they relate

- **Build Contract** = what we are shipping in v1 and in what order.
- **Black Book** = the full system design these contracts implement.
- **UI/UX Spec** = how the frontend renders that design across roles and verticals.
- **Database Guide** = the operational view of the schema; the migrations remain the executable source of truth.
- **Implementation plans** translate spec gaps into ordered workstreams with acceptance criteria. New plans should explicitly mark what they supersede.

## Where the implementation lives

- Backend (Node + Express + Supabase): `backend/`
- Database migrations: `supabase/migrations/`
- Frontend (Vite + React + Tailwind v4 + shadcn/ui): `src/`, `components.json`, `vite.config.ts`
