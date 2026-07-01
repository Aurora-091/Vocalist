# Product Journey & History 📖

This document chronicles the design choices, major milestones, and pivots that shaped the **Weeber** platform.

---

## 1. The Scaffolding: Phase 1 (Aurora)

The project began under the workspace name **Aurora**. The initial contract was designed to validate:
*   Multi-tenant Postgres modeling with database RLS.
*   Basic outbound dialing queues via Twilio.
*   A React admin layout mockup.

The historical blueprints and scope specs from this phase are archived inside the [`archive/`](./archive/) folder to maintain an audit trail.

---

## 2. The Rebranding Pivot (DEC-001)

On **2026-06-12**, the product underwent a major pivot and rebranding:
*   **The Problem**: "Aurora" had name registration overlaps and did not emphasize the product's value (conversational customer voice agents).
*   **The Pivot**: Rebranded to **Weeber**. We standardized all user-facing paths, components, and code bases under the Weeber brand name, keeping original Aurora specifications frozen in archives.

---

## 3. Key Milestones Timeline

*   **2026-06-13 (DEC-002)**: Standardized active voice dialing runtimes on **ElevenLabs Conversational AI** over Retell and Vapi due to superior pricing and SMB integration capabilities.
*   **2026-06-22 (Release v1.5.0)**: Built the **Enterprise Inquiry Dialog** pipeline (Zod validation, Resend email notices, spam limits) and set up the onboarding merging state machine to prevent onboarding checklist state overwrites.
*   **2026-06-27 (Release v1.7.0)**: Executed a database security hardening migration, sealing all Supabase Advisor warnings (securing triggers, disabling public schema executions, securing views, and activating RLS across child partitions).
*   **2026-06-29 (Release v1.8.0)**: Resolved all 15 critical integration gaps:
    *   Replaced Shopify REST `/checkouts.json` queries with Shopify GraphQL API.
    *   Wrote the **Supabase Vault** integrations helper to prevent raw API keys from being saved in database text rows.
    *   Implemented real connection checks and synchronization routes for **HubSpot CRM v3**.
    *   Introduced the **Dynamic Tools Proxy** (`/v1/tools/:integration/:action`) executing mock callbacks for agent functions.
    *   Refactored Stripe webhook routes to work asynchronously in the background.

---

## 4. Journey References

To dive deeper into the history:
*   **Decisions Log**: Check [DECISIONS.md](./DECISIONS.md) to read detailed ADRs (`DEC-001` through `DEC-010`).
*   **Changelog**: Check [CHANGELOG.md](./CHANGELOG.md) to view the granular release audit trails.
