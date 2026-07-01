# Weeber — Specification & Documentation Directory 📚

Welcome to the Weeber platform documentation directory. This folder houses all technical specifications, onboarding guides, architecture specs, deployment manifests, and compliance records.

---

## 1. Getting Started & Onboarding

| Document | Purpose |
|---|---|
| [`1-WELCOME.md`](./1-WELCOME.md) | **Onboarding Welcome**: Introduction to tech stack, system capabilities, and dev quickstart. |
| [`2-JOURNEY_AND_HISTORY.md`](./2-JOURNEY_AND_HISTORY.md) | **Journey Narrative**: Narrative of product evolution and rebranding timeline from Aurora to Weeber. |
| [`POC-Checklist.md`](./POC-Checklist.md) | **Definition of Done**: Criteria detailing core deliverables required for validation demos. |

---

## 2. Developer Guides & Playbooks

| Document | Purpose |
|---|---|
| [`guides/developer-rules.md`](./guides/developer-rules.md) | **Master Rules**: Living source of truth for technical bindings, rules (the 13 Non-Negotiables), and agent playbooks. |
| [`guides/vault-setup.md`](./guides/vault-setup.md) | **Supabase Vault Setup**: SQL and code setup guide for encrypted credential vaulting. |
| [`guides/custom-tools.md`](./guides/custom-tools.md) | **Custom Tools Guide**: Documentation on routing and creating integration tools for voice agents. |
| [`guides/deployment.md`](./guides/deployment.md) | **Deployment Manifest**: Pipelines, environments variables, and hosting setup instructions. |

---

## 3. Platform Core Architecture & Specifications

| Document | Purpose |
|---|---|
| [`architecture/platform-blackbook.md`](./architecture/platform-blackbook.md) | **Technical Architecture**: Database patterns, multi-tenancy, and security bounds. |
| [`architecture/database-guide.md`](./architecture/database-guide.md) | **Database Guide**: Catalog of triggers, RLS policies, indexing, and tables partitioning. |
| [`architecture/security-audit.md`](./architecture/security-audit.md) | **Security Audit**: Security posture assessment across backend, client-side, and RLS gates. |
| [`architecture/api-audit.md`](./architecture/api-audit.md) | **API Audit**: Express backend endpoints, input validations, and multi-tenant security gates. |
| [`DECISIONS.md`](./DECISIONS.md) | **Decisions Log**: Living log of architectural decisions records (ADR). |
| [`INTEGRATION_GAPS.md`](./INTEGRATION_GAPS.md) | **Integration Audit Report**: Priority queue of all integration and tool proxy gap statuses. |
| [`CHANGELOG.md`](./CHANGELOG.md) | **Changelog**: Release trails of all features, fixes, and dependencies versions. |

---

## 4. Specification Archives

Historical Aurora-branded documents are preserved in the `architecture/archive/` folder for reference, audit tracks, and compliance verification:
*   [`architecture/archive/Aurora-v1-Scope-and-Build-Contract.md`](./architecture/archive/Aurora-v1-Scope-and-Build-Contract.md) — Scope contracts.
*   [`architecture/archive/Aurora-BlackBook.md`](./architecture/archive/Aurora-BlackBook.md) — Original technical blueprints.
*   [`architecture/archive/Aurora-UIUX-Spec.md`](./architecture/archive/Aurora-UIUX-Spec.md) — Frontend layout mocks.
*   [`architecture/archive/implementation-plan-phase-1.md`](./architecture/archive/implementation-plan-phase-1.md) — Phase 1 build contract milestones.
*   [`architecture/archive/AURORA_CURSOR_PROMPT.md`](./architecture/archive/AURORA_CURSOR_PROMPT.md) — Outdated rules catalog.
