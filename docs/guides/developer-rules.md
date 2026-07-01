# Weeber Master Developer & AI Agent Playbook 📜

This document is the master playbook, rule binding, and technology guide for human developers and AI coding assistants (such as **Antigravity**) working on the Weeber codebase.

---

## 1. What Weeber Is

Weeber is a **no-code voice-AI SaaS platform for SMBs**. A merchant connects their Shopify store (or clinic calendar), answers a short Q&A wizard, and gets a production voice agent live in under 10 minutes. The agent handles **inbound calls**, places **outbound calls**, and runs **bulk scheduled voice campaigns** — all billed on subscription + metered minutes + outcome metrics.

The voice runtime is **ElevenLabs Conversational AI (CAI)** — rented, not rebuilt. Our primary differentiation (the moat) is:
1.  **Deep E-Commerce Integrations**: cart recovery, order status check, discount application.
2.  **Scheduling Integrations**: Cal.com / calendar booking, no-show reduction.
3.  **Strict Compliance**: TCPA-grade consent check, append-only logs, DNC controls.
4.  **Cost Containment**: Real-time dollar-based spend guards.

---

## 2. Invariant Rules (The 13 Non-Negotiables)

These are hard invariants. If a change violates any of these, **stop and flag it**.

1.  **No Outbound Dial without `can_dial()` = true** at dial time. (TCPA compliance).
2.  **Consent/DNC Ledgers are Append-Only** — never update or delete consent rows via API. Opt-out propagates in one atomic transaction.
3.  **RLS on Every Tenant Table** — `org_id` filtering must be active at the DB schema level (using `auth_org()`).
4.  **Secrets via Supabase Vault** (`secret_ref`) — never store credentials or tokens in plaintext table columns.
5.  **No Vendor SDK Imported Directly** — all voice provider actions must be instantiated through the `VoiceProvider` interface.
6.  **No Call Billed Twice** — deterministically build `usage_ledger` idempotency keys.
7.  **No Technical Jargon in the No-Code UI** — avoid raw terms like "LLM", "prompt", or "webhook" in default user views.
8.  **Verticals are Config Rows** in `vertical_configs` — never hardcoded in page routing conditionals.
9.  **No Call Placed without `can_spend()` = true** — prevent runaway telephony costs.
10. **Knowledge Base = CAI-Native** — map mirror documents directly to ElevenLabs; do not build self-hosted RAG.
11. **Inbound Passes Express admission gate first** — rate-limit and spend-check before routing.
12. **Spend Guards Meter on `cost_usd`** (not minutes) — record tokens and costs on completed calls.
13. **Centralized Data Access (No Direct Client-side Queries)** — Never call `supabase.from()` directly inside React views/components. All frontend database fetching and mutations must use the wrappers inside [db.ts](../../src/lib/db.ts).

---

## 3. Technology Stack Bindings

*   **Backend API**: Node.js + Express. **CommonJS modules format (`require` / `module.exports`) only**. DO NOT use ESM import/export syntax in the `backend/` directory.
*   **Frontend SPA**: Vite + React + TypeScript + Tailwind CSS v4 + shadcn/ui.
*   **Database**: Supabase (Postgres + RLS + Auth + Edge Functions).
*   **Edge Functions**: Deno TypeScript functions (`supabase/functions/*`). Always lookup secrets from Vault.

---

## 4. Playbook & Workflow

### Step-by-Step Edits
*   When performing multi-file edits, update dependency files (like `db.ts` or services) first before editing client views.
*   Ensure all custom error catches do not swallow critical errors silently (use logging and toast popups where appropriate).

### Invariant Verification
Before ending any turn, you **must** verify compilation and tests:
*   **Frontend Type Checking**: Run `npx tsc --noEmit` in the workspace root. Confirm 0 errors.
*   **Backend Tests**: Run `npm run test` inside the `backend/` directory. Confirm all tests pass.

### Documentation Synchronicity
*   **Always update documentation after changes**: After completing any code changes or refactoring, you must immediately update relevant documentation files: `CHANGELOG.md` with features/fixes/changes, `DECISIONS.md` if architectural patterns changed, and `README.md` if file structures or directories were altered.
*   **Timestamps on every entry**: Every entry in `CHANGELOG.md` and `DECISIONS.md` must include a precise timestamp in the format: `Day, YYYY-MM-DD HH:MM IST` (e.g. `Thursday, 2026-06-26 01:55 IST`).
*   **Auto commit & push**: After every set of changes (code + documentation), you must automatically stage all modified files, create a descriptive git commit, and push to the remote. Never leave changes uncommitted.
