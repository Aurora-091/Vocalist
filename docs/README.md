# Weeber — Specification Documents

Welcome to the Weeber platform documentation directory. This folder houses all technical specifications, architecture decisions, deployment manifests, testing configurations, and compliance documents.

---

## 1. Active Developer Reference

| Document | Purpose |
|---|---|
| [`Weeber-Cursor-Rules.md`](./Weeber-Cursor-Rules.md) | Standard system parameters, environment constraints, codebase structures, and tech stack bindings for Cursor or other AI coding agents. |
| [`agent.md`](./agent.md) | System profile, rule binding, and playbook for AI coding assistants (like Antigravity) working on the codebase. |
| [`CHANGELOG.md`](./CHANGELOG.md) | Audit trail of all shipped features, patches, dependencies fixes, and tests configurations. |
| [`DECISIONS.md`](./DECISIONS.md) | Living log tracking architectural decisions, pivots, integrations constraints, and system boundaries. |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | Pipeline workflows, server host requirements, Supabase Vault sync, and environment variables list. |
| [`POC-Checklist.md`](./POC-Checklist.md) | "Definition of Done" criteria detailing the 5 core deliverables required for validation demos. |
| [`../AUDIT.md`](../AUDIT.md) | Security and architecture audit — covers backend, edge functions, frontend data patterns, and RLS posture. |

---

## 2. Platform Core Architecture Specs

| Document | Purpose |
|---|---|
| [`Weeber-Platform-Blackbook.md`](./Weeber-Platform-Blackbook.md) | Technical architecture overview — database patterns, spend boundaries, multi-tenancy schemas, and security design. |
| [`database-guide.md`](./database-guide.md) | Technical schema catalog detailing Supabase migrations, triggers, column indexes, partitioning, and 40+ tables. |

---

## 3. Active Implementation Plans

_No active phase plans. Historical plans are in `archive/`._

---

## 4. Frontend Architecture (as of 2026-06-18)

```
src/
├── config/
│   ├── verticals/          ← Vertical registry (one file per vertical)
│   │   ├── index.ts        ← Types, VERTICAL_REGISTRY, utility functions
│   │   ├── shopify.ts      ← Ecommerce vertical definition
│   │   ├── clinic.ts       ← Healthcare vertical definition
│   │   └── hotel.ts        ← Hospitality vertical (preview, disabled)
│   └── marketing.ts        ← Public site content
├── lib/
│   ├── VerticalContext.tsx  ← React context provider + t() glossary helper
│   ├── db.ts               ← Supabase data access layer (30+ functions)
│   ├── api.ts              ← Backend HTTP client with auth retry
│   ├── admin-api.ts        ← Admin panel API client
│   └── supabase.ts         ← Supabase client initialization
├── components/
│   ├── layout/             ← AppShell (config-driven sidebar), AdminShell
│   ├── ui/                 ← shadcn/ui components
│   ├── marketing/          ← Public site components
│   └── AnalyticsLoader.tsx ← Dynamic Google & Facebook analytics script loader
├── pages/                  ← Route-level page components (39 pages)
└── apps/
    ├── admin/              ← Admin panel sub-app
    └── customer/           ← Customer-facing sub-app
```

**Key Principle:** Zero `if (vertical === ...)` conditionals. All vertical-specific behavior is driven by the registry config.

---

## 5. Specification Archives

Historical Aurora-branded documents are preserved in the `archive/` folder for reference, audit tracks, and compliance verification:

- [`archive/Aurora-v1-Scope-and-Build-Contract.md`](./archive/Aurora-v1-Scope-and-Build-Contract.md) — Scope contracts.
- [`archive/Aurora-BlackBook.md`](./archive/Aurora-BlackBook.md) — Original technical blueprints.
- [`archive/Aurora-UIUX-Spec.md`](./archive/Aurora-UIUX-Spec.md) — Frontend layout mocks.
- [`archive/implementation-plan-phase-1.md`](./archive/implementation-plan-phase-1.md) — Phase 1 build contract milestones.
- [`archive/AURORA_CURSOR_PROMPT.md`](./archive/AURORA_CURSOR_PROMPT.md) — Outdated rules catalog.
