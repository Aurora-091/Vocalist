# Aurora — Specification Documents

Canonical project specs. These are the source of truth that all implementation
work (backend, frontend, ops) should be measured against.

## Specs (the master)

| Document | What it covers |
|---|---|
| [`Aurora-v1-Scope-and-Build-Contract.md`](./Aurora-v1-Scope-and-Build-Contract.md) | **The master.** v1 scope (#1-26 + 7b), per-capability acceptance criteria, the 12 non-negotiables, inbound admission flow, spend guards, pricing tiers, settings, error/empty states, deferred items. Read this first. |
| [`Aurora-BlackBook.md`](./Aurora-BlackBook.md) | Comprehensive technical black book — system architecture, database design, ER diagrams, RLS policies, pricing model (all markets), unit economics, security model. |
| [`Aurora-UIUX-Spec.md`](./Aurora-UIUX-Spec.md) | UI/UX & frontend spec — design system, sitemap, navigation/IA, role-based views, component library, per-page wireframes, user flows, state matrix. |
| [`database-guide.md`](./database-guide.md) | Database guide companion to the migrations in `supabase/migrations/`. |

## Active implementation plans

| Document | Status | Covers |
|---|---|---|
| [`implementation-plan-phase-1.md`](./implementation-plan-phase-1.md) | **ACTIVE** | v1 build sequence. 5 phases, 25 ordered PRs, scope mapping. |
| [`implementation-plan-phase-3-india.md`](./implementation-plan-phase-3-india.md) | **FUTURE** | India telephony (Plivo + Exotel BYO), TRAI compliance, INR pricing. |

## Research / decision audit trail

| Document | What it covers |
|---|---|
| [`research/elevenlabs-cai-evidence.md`](./research/elevenlabs-cai-evidence.md) | Cost/capability evidence behind the ElevenLabs CAI pivot. True COGS math, startup grant terms, competitor positioning. |
| [`research/critique-response-and-decisions.md`](./research/critique-response-and-decisions.md) | Four red-team findings and decisions. Audit trail — do not delete. |

## Developer reference

| Document | What it covers |
|---|---|
| [`AURORA_CURSOR_PROMPT.md`](./AURORA_CURSOR_PROMPT.md) | Living AI/developer prompt — what Aurora is, tech stack bindings, decision constraints. |

## Where the implementation lives

- Backend (Node + Express + Supabase): `backend/`
- Database migrations: `supabase/migrations/`
- Frontend (Vite + React + Tailwind v4 + shadcn/ui): `src/`
- Edge Functions: `supabase/functions/`
