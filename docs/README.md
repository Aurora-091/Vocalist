# Aurora — Specification Documents

Canonical project specs. These are the source of truth that all implementation
work (backend, frontend, ops) should be measured against. Update these here
when scope or design changes — do not let them drift out of date.

## Specs (the master)

| Document | What it covers |
|---|---|
| [`Aurora-v1-Scope-and-Build-Contract.md`](./Aurora-v1-Scope-and-Build-Contract.md) | **The master.** v1 scope (#1–26 + 7b), per-capability acceptance criteria, the 12 non-negotiables, inbound admission flow (§J), spend guards (§E.1), pricing tiers (§E), settings (§F), error/empty states (§G), deferred items (§H). Read this first — if it isn't here, it isn't in v1. |
| [`Aurora-BlackBook.md`](./Aurora-BlackBook.md) | Comprehensive technical black book — system architecture, database design, ER diagrams, RLS policies, indexing, partitioning, triggers, feature specs, security model. |
| [`Aurora-UIUX-Spec.md`](./Aurora-UIUX-Spec.md) | UI/UX & frontend spec — design system, sitemap, navigation/IA, role-based views, component library, per-page wireframes, user flows, state matrix. Covers Shopify + Clinic verticals + internal Ops role. |
| [`database-guide.md`](./database-guide.md) | Database guide companion to the migrations in `supabase/migrations/` — table definitions, enums, partitioning strategy, triggers, RLS, operational patterns. The Phase-1 plan adds new tables (`spend_guards`, `spend_counters`, `inbound_rate_counters`, `voice_favorites`, `voice_preview_cache`, `agent_templates`, `webhook_endpoints`) + columns (`usage_ledger.tokens_in/out/cost_usd`, `agents.voicemail_message`, `users.phone_e164/phone_verified_at`, `contacts.preferred_language`) + RPCs (`can_spend`, `check_inbound_rate`) + invariants #9–11 — these should be folded into the DB Guide at the next consolidation pass. |

## Active implementation plan

| Document | Status | Covers |
|---|---|---|
| [`implementation-plan-phase-1.md`](./implementation-plan-phase-1.md) | **ACTIVE — single source of truth for the v1 build sequence.** | All 5 phases (0 Credits + Foundation · 1 Runtime + Shopify moat + Admission gate · 2 Campaigns + Billing · 3 Remaining integrations · 4 Post-seed). 25 ordered PRs. Every scope §0 capability mapped to a PR. Consolidated DB diff. Risks + open questions tracked. |

## Research / decision audit trail

| Document | What it covers |
|---|---|
| [`research/elevenlabs-cai-evidence.md`](./research/elevenlabs-cai-evidence.md) | Cost/capability evidence behind the Phase-1 pivot to ElevenLabs CAI. True COGS math (~$0.15/min planning floor), startup grant terms, other startup credit programs to stack (Twilio, AWS, GCP, Stripe, Supabase), competitor positioning. |
| [`research/critique-response-and-decisions.md`](./research/critique-response-and-decisions.md) | The four red-team findings against the Phase-1 plan and what we did with each. Three accepted-and-fixed (inbound admission gate, Shopify-as-moat, dollar-metered spend guards); one accepted as risk with explicit revisit trigger (outcome pricing is a Phase-2 upsell, not v1 foundation). Audit trail — do not delete. |

## Superseded / deferred plans (kept for the audit trail)

| Document | Status | Notes |
|---|---|---|
| [`implementation-plan-elevenlabs-twilio.md`](./implementation-plan-elevenlabs-twilio.md) | **SUPERSEDED by `implementation-plan-phase-1.md`** (only on the prior PR branch; not on main). The earlier ElevenLabs-only plan; comprehensive but predated the critique. The active Phase-1 plan absorbs its workstreams and corrects the cost math, pricing tiers, and inbound flow. |
| [`implementation-plan-vapi-twilio-billing.md`](./implementation-plan-vapi-twilio-billing.md) | **DEFERRED to Phase 4.** Vapi+BYO analysis. The Vapi provider stays compiled but unregistered behind the `VoiceProvider` seam. This doc is the reference for the eventual Phase-4 cost-optimisation swap. |

## How they relate

- **Scope Contract** is the master — every PR must close one or more capability AC entries from §A.
- **Black Book** is the system design these capabilities implement.
- **UI/UX Spec** is how the frontend renders that design across roles and verticals.
- **Database Guide** is the operational view of the schema; the migrations remain the executable source of truth, this Phase-1 plan adds new tables that fold back at next consolidation.
- **Active implementation plan** translates scope gaps into ordered PRs with acceptance criteria + DB diffs + risks.
- **Research docs** are the evidence + decision audit trail. New plans must explicitly mark what they supersede and why.

## Where the implementation lives

- Backend (Node + Express + Supabase): `backend/`
- Database migrations: `supabase/migrations/`
- Frontend (Vite + React + Tailwind v4 + shadcn/ui): `src/`, `components.json`, `vite.config.ts`
