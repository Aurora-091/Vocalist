# Welcome to Weeber 🚀

Welcome to the **Weeber** project workspace! Weeber is a vertical-tenant AI voice dialing platform built to empower small and medium businesses (SMBs) with smart, automated, and compliant voice interactions.

---

## 1. Tech Stack Overview

The platform is designed around a modern, scalable, and secure architecture:
*   **Database & Auth**: [Supabase](https://supabase.com) (Postgres) with strict Row-Level Security (RLS) policies enforcing multi-tenancy.
*   **Backend Server**: Node.js & Express API routing webhooks, orchestrating calls, and serving integrations.
*   **Frontend Interface**: React with TypeScript, using config-driven vertical styling directories.
*   **Voice & LLM Runtime**: [ElevenLabs Conversational AI (CAI)](https://elevenlabs.io) with dynamic prompts driven by `gemini-2.5-flash`.
*   **Telephony Gateway**: Twilio (Subaccounts provisioning, inbound XML routing, SIP media streams).
*   **Payments & Billing**: Stripe (lazy-loaded client interfaces, automated overage reporting based on usage loggers).

---

## 2. Core Architecture Capabilities

As a developer or AI assistant working on this codebase, you should understand the 5 pillars of the platform:

1.  **Zero-Branching Verticals**: No hardcoded `if (vertical === 'shopify')` switches in frontend templates. All vertical configurations (colors, forms, sidebar menus, onboarding checklists) are loaded dynamically from the vertical registry.
2.  **Consent Gate & DNC compliance**: The dialer engine validates each call against target time windows, Do Not Call (DNC) registers, and explicit user consent entries via the centralized `can_dial()` query before executing.
3.  **Spend Guard Reserve-Commit Pattern**: Custom DB triggers lock a projected calling cost (`reserve_spend`) before initiating dial commands and settle actual duration costs (`commit_spend` / `release_spend`) on call completion, preventing run-away billing.
4.  **Secure Integrations Vault**: Integration API tokens are automatically stored inside the Supabase `vault` schema, leaving database data rows completely clean of raw secret keys.
5.  **Dynamic Tools Proxy**: Outbound agents dynamically call secure tool handlers (e.g. order tracking, availability checks, appointment booking) routed through a central proxy `/v1/tools/:integration/:action` using signed headers.

---

## 3. Quickstart Guide

To verify your development environment is healthy:

1.  **Install dependencies**:
    ```bash
    cd backend && npm install
    ```
2.  **Run backend tests**:
    ```bash
    npm run test
    ```
    *(Verify that all 71 tests pass successfully)*.
3.  **Inspect database guides**:
    Check [database-guide.md](./architecture/database-guide.md) to learn about tables, partition boundaries, and security triggers.
