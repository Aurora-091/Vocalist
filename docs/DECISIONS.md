# Decisions Log

This document tracks all major product, architecture, and technology decisions made on the Weeber platform.

---

## DEC-001: Pivot to Weeber Branding
* **Date**: 2026-06-12
* **Status**: Accepted
* **Context**: The product was initially scaffolded under the name **Aurora**. Due to registration requirements, naming conflict resolution, and focus on the conversational nature of voice calling, the platform is rebranded to **Weeber**.
* **Decision**: All documentation, user-facing copy, metadata, and new components will use "Weeber" branding. Historical specification files in `docs/archive/` will remain untouched to preserve their original audit paths.

---

## DEC-002: Active Voice Runtime Standardized on ElevenLabs CAI
* **Date**: 2026-06-13
* **Status**: Accepted
* **Context**: We evaluated Vapi, Retell, and ElevenLabs Conversational AI (CAI). Vapi UI features would increase implementation overhead, whereas ElevenLabs CAI matches our target SMB simplicity and cost thresholds.
* **Decision**: We will use ElevenLabs CAI as our active voice provider. Vapi and Retell logic remain compiled in the backend codebase (`providers/voice/`) but are excluded from active factory instantiation.

---

## DEC-003: Supabase Auth Standardization
* **Date**: 2026-06-14
* **Status**: Accepted
* **Context**: Authentication requirements include session management, OAuth token vaults, multi-tenancy context passing, and automated onboarding schemas.
* **Decision**: We standardize on Supabase Auth. App state uses `supabase.auth.getSession()` to attach JWT Bearer tokens to internal HTTP requests, enforcing multi-tenancy at the Postgres RLS level.

---

## DEC-004: Admin Dashboard Subdomain Strategy
* **Date**: 2026-06-15
* **Status**: Accepted
* **Context**: Security boundaries dictate that internal admin controls (managing user accounts, waitlist approval, billing status, platform metrics, logs review) should be insulated from normal merchant consoles.
* **Decision**: Implement the admin module at the `/admin/` frontend routing namespace, gated behind a check on `platform_role` returned from `/v1/admin/me`. Only authorized platform administrators can access these dashboard routes.

---

## DEC-005: Testing Infrastructure Integration
* **Date**: 2026-06-16
* **Status**: Accepted
* **Context**: Active UI improvements and form modifications require rapid automated validation to avoid regression checks on manual UI workflows.
* **Decision**: Adopt and configure `Vitest` and `React Testing Library` for the frontend. All verification sweeps will run `npm test` alongside standard TypeScript compiler validations.

---

## DEC-006: Config-Driven Vertical Registry Architecture
* **Date**: 2026-06-18
* **Status**: Accepted
* **Context**: The platform serves multiple verticals (Ecommerce/Shopify, Clinic/Healthcare, Hotel/Hospitality) with different terminology, navigation, dashboard metrics, quick actions, templates, and integrations. The prior approach used scattered conditionals (`if (vertical === "shopify")`) which made adding new verticals expensive and error-prone.
* **Decision**: Implement a registry pattern at `src/config/verticals/` where each vertical is a single TypeScript file exporting a `VerticalDefinition` object. The definition drives all UI behavior: sidebar navigation groups, dashboard cards, glossary terms, quick actions, template filtering, and integration recommendations. The constraint is absolute: **zero conditional branching on vertical key** anywhere in the codebase. Adding a new vertical requires only creating one config file and registering it in the index — no component changes needed.
* **Key Files**:
  - `src/config/verticals/index.ts` — Registry types, exports, and utility functions
  - `src/config/verticals/shopify.ts` — Ecommerce vertical definition
  - `src/config/verticals/clinic.ts` — Healthcare vertical definition
  - `src/config/verticals/hotel.ts` — Hospitality vertical (enabled: false, preview)
  - `src/lib/VerticalContext.tsx` — React context provider consuming the registry

---

## DEC-007: API Audit Cadence and Edge Function Security Model
* **Date**: 2026-06-18
* **Status**: Accepted
* **Context**: A comprehensive API audit revealed 4 critical security issues in edge functions (missing webhook signature verification, OAuth CSRF, cross-org credential leakage, token refresh races). These are separate from the previously-fixed backend auth issues.
* **Decision**: Edge functions must follow these mandatory patterns:
  1. All inbound webhooks verify provider signatures before processing
  2. OAuth flows must generate and validate a `state` parameter
  3. Provider credentials must be fetched from Vault via `secret_ref` — never from global env vars
  4. Token refresh operations must use optimistic locking to prevent race conditions
  
  Future edge functions require a security review checklist before deployment.

---

## DEC-008: Dynamic Client-Side Analytics and Tracking Profiles Management
* **Date**: 2026-06-19
* **Status**: Accepted
* **Context**: Marketing requirements dictate frequent rotation of Google Analytics and Google Ads conversion targets without redeploying the frontend. Additionally, Meta Pixel is deployed globally.
* **Decision**: Store tracking settings and GA4/Google Ads profiles in Supabase (`site_settings` and `tracking_profiles` tables). Exactly one profile is active at a time. The client application mounts a `<AnalyticsLoader>` that dynamically queries the database on initial mount to inject `gtag.js` and Meta Pixel scripts. To prevent duplicate scripts injection, load status is tracked in global module-level variables. Pageviews are tracked manually on React Router path changes.
* **Key Files**:
  - `src/lib/tracking.ts` — Centralized database access helper functions.
  - `src/components/AnalyticsLoader.tsx` — Dynamic injection script module and route navigation tracker.
  - `src/pages/admin/AdminSettings.tsx` — Settings view featuring Dukaan-style configurations.

