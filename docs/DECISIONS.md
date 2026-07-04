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

## DEC-008: Dynamic Hybrid GTM/GA4 Client-Side Analytics Engine
* **Date**: 2026-06-22
* **Status**: Superseded / Accepted
* **Context**: Marketing required dynamic setup and rotation of analytics script configurations (GTM and GA4) without rebuilding/redeploying the client code. A legacy profile rotation design was found to be overly complex and has been refactored.
* **Decision**: We consolidated the database storage into a single public settings table `site_settings` to hold the active `gtm_container_id` and `tracking_enabled` status. We developed a hybrid `AnalyticsLoader.tsx` component that:
  1. Auto-detects the tag type (GTM or GA4) by parsing the prefix (`GTM-` or `G-`).
  2. Implements a fast-path loader that immediately injects scripts if configured in environment variables (`VITE_GTM_ID` or `VITE_GA4_ID`), bypassing database checks entirely for optimal page load speed.
  3. Integrates a reactive diagnostics object `window.__weeber_analytics` reporting status details (such as ad-blocker script blocks, loading errors, active tag type) back to the admin settings dashboard.
* **Key Files**:
  - `src/components/AnalyticsLoader.tsx` — Main analytics script loader and pageview dispatcher.
  - `src/pages/admin/AdminSettings.tsx` — Dashboard configuration card displaying validation status.
  - `supabase/migrations/20260619073425_20260619124100_gtm_container_settings.sql` — SQL migration creating singleton settings.

---

## DEC-009: ElevenLabs Passthrough LLM Switch to Gemini 2.5 Flash
* **Date**: Thursday, 2026-06-26 01:51 IST
* **Status**: Accepted
* **Context**: ElevenLabs Conversational AI agents accept an LLM identifier string in the agent payload's `prompt.llm` field, which controls the language model used for conversational reasoning during calls. The prior setting was `gpt-4o-mini` (~$0.003/min passthrough cost). Google's `gemini-2.5-flash` is now available as a supported identifier and offers comparable conversational quality at ~$0.0012/min — a ~60% reduction in per-call LLM cost.
* **Decision**: Switch the `llm` field in `_buildAgentPayload` from `gpt-4o-mini` to `gemini-2.5-flash`. No other payload or integration changes are required — ElevenLabs accepts the string identifier directly. This change also coincides with adding an explicit `safety.interaction_budget` block (`thirty_minutes`) to the conversation config, since ElevenLabs deprecated the previous `async` enum value.
* **Key Files**:
  - `backend/src/providers/voice/elevenlabs.provider.js` — `_buildAgentPayload` method

---

## DEC-010: Server-Side PostHog Analytics Proxy and Node 22 CI Upgrade
* **Date**: Saturday, 2026-06-27 01:40 IST
* **Status**: Accepted
* **Context**: We need to display product and marketing analytics to platform administrators directly within our custom admin panel, without requiring them to navigate to the external PostHog dashboard. However, querying PostHog's API directly from the client would expose the PostHog Personal API Key, violating security policies. Furthermore, running local tests in GitHub Actions was failing because Node.js 20 lacks native WebSocket support (which the Supabase client depends on).
* **Decision**: We resolved this with two actions:
  1. Built a secure server-side PostHog HogQL query proxy in the Node/Express backend (`posthog.service.js` and `/v1/admin/posthog/*` routes) gated by super-admin authorization. The frontend client (`admin-api.ts`) communicates only with this proxy.
  2. Upgraded the CI workflow (`.github/workflows/ci.yml`) runner version to Node.js 22 to natively support WebSockets, fixing the testing regressions.
* **Key Files**:
  - `backend/src/services/posthog.service.js` — HogQL query service
  - `backend/src/modules/admin/admin.routes.js` — Admin routing and controller logic
  - `src/lib/admin-api.ts` — Client-side API mapping
  - `src/pages/admin/analytics/ProductAnalytics.tsx` — Product analytics dashboard
  - `src/pages/admin/analytics/MarketingAnalytics.tsx` — Marketing analytics dashboard
  - `.github/workflows/ci.yml` — Updated Node version to 22

## DEC-011: Auth Security Hardening (HttpOnly Cookies & Self-Healing Removal)
* **Date**: Thursday, 2026-07-02 10:57 IST
* **Status**: Accepted
* **Context**: JWT bearer tokens were previously stored in `localStorage`, which exposed them to XSS attacks. Furthermore, a legacy self-healing script during signup silently reset passwords and swallowed `409` errors if a user already existed in Supabase Auth but not `public.users`. Finally, the forgot password route allowed email enumeration by throwing errors on non-existent users.
* **Decision**: We eliminated `localStorage` usage in favor of `httpOnly`, `SameSite=Lax` cookies set natively by the Express server. The frontend API client uses `credentials: "include"`. The self-healing signup script was removed entirely; the server now correctly rejects duplicate accounts with a `409 Conflict`. The forgot-password endpoint now silently succeeds regardless of user existence.
* **Key Files**:
  - `backend/src/modules/auth/auth.routes.js`
  - `backend/src/modules/auth/auth.service.js`
  - `src/lib/api.ts`

---

## DEC-012: Provider Error Handling Normalization
* **Date**: Thursday, 2026-07-02 10:57 IST
* **Status**: Accepted
* **Context**: Third-party providers (ElevenLabs, Twilio, Vapi) threw raw `Error` objects on configuration or downstream failures. Since these weren't standard `HttpError` objects, the global `errorHandler` interpreted them as unhandled exceptions, swallowing the context and returning generic `500 Internal Server Errors` to the client. Additionally, Zod validation errors were being stripped in production because the HTTP code (`unprocessable_entity`) did not match the required `"validation_error"` bypass in `error.middleware.js`.
* **Decision**: Introduced a `BadGateway` (502) error class. Wrapped all `fetch` and SDK errors in our provider layers (ElevenLabs, Vapi, Twilio) inside `BadRequest` or `BadGateway` HttpErrors. Renamed `UnprocessableEntity`'s internal code to `"validation_error"`. This allows the client to receive structured, debuggable payloads (like "Invalid Twilio credentials" or Zod missing field maps) in production without masking them behind a 500.
* **Key Files**:
  - `backend/src/utils/errors.js`
  - `backend/src/providers/voice/elevenlabs.provider.js`
  - `backend/src/modules/twilio/twilio.client.js`

---

## DEC-013: ElevenLabs Webhook Tool Path Schema and URL Resolution
* **Date**: Saturday, 2026-07-04 17:55 IST
* **Status**: Accepted
* **Context**: ElevenLabs agent creation failed with 422 errors due to incompatibilities with our DB-stored tool formats and templating. Webhook tool URLs contained Handlebars-style `{{placeholder}}` path parameters that ElevenLabs expected to be single-braced `{placeholder}` URL templates, and these path parameters were never declared in a `path_params_schema` block. Additionally, `request_body_schema` expected standard JSON Schema objects rather than flat lists of parameters, and the system needed static call variables like `CALL_ID` and `patient_id` populated as dynamic variables at call initiation.
* **Decision**: Restructured `_resolveTools(agent)` in `elevenlabs.provider.js` to automatically convert double-braced URL templates to single braces and dynamically generate a companion `path_params_schema` object mapping these parameters to the conversation's dynamic variables. Standardized parameter-to-JSON Schema translation for `request_body_schema`. Updated `startCall()` to guarantee `CALL_ID` and `patient_id` are always injected into `conversation_initiation_client_data.dynamic_variables`.
* **Key Files**:
  - `backend/src/providers/voice/elevenlabs.provider.js`
  - `backend/src/tests/invariants/remediation.test.js`

---

## DEC-014: Phone Number Assignment and Import Telephony Credentials
* **Date**: Saturday, 2026-07-04 18:22 IST
* **Status**: Accepted
* **Context**: The platform lacked a way for merchants to assign or swap phone numbers directly on the agent creation form and the agent detail details tab, and the backend method `assignNumber` was setting `agents.inbound_number` to `undefined` due to a column reference typo. Additionally, test calls failed when ElevenLabs attempted to import a phone number, throwing a 422 because our integration was sending `twilio_account_sid` and `twilio_auth_token` fields instead of the required `sid` and `token` fields. In sandbox/staging environments using mock/sandbox Twilio credentials (e.g. SIDs starting with `ACsandbox`), ElevenLabs would also throw a 400 Bad Request since it could not authenticate the sandbox credentials with Twilio. Finally, during real outbound calls, updating the calls table failed with `Could not find the 'updated_at' column of 'calls' in the schema cache` because the database schema was missing an `updated_at` column that backend services tried to update.
* **Decision**: Added phone number select dropdown fields in the agent manual creation form and the configuration details tab. Added a database unbind helper in `db.ts` to cleanly wipe references on swap/unlink, and fixed `phone.number` typo to `phone.e164` in `agent.service.js` to ensure the number persists cleanly in the database, unblocking test calls. Corrected the ElevenLabs phone numbers POST import payload fields in `elevenlabs.provider.js` to map `sid` and `token` key names. Added logic to dynamically check if the Twilio Account SID starts with `ACsandbox`, and if so, bypass the live ElevenLabs phone number import and outbound calling APIs, returning simulated sandbox mock results instead to ensure the test call flow succeeds for testing purposes. Finally, created migration `20260704000002_add_calls_updated_at.sql` adding `updated_at` to the `calls` table and notifying `pgrst` to reload the schema cache.
* **Key Files**:
  - `backend/src/modules/agents/agent.service.js`
  - `backend/src/providers/voice/elevenlabs.provider.js`
  - `supabase/migrations/20260704000002_add_calls_updated_at.sql`
  - `src/lib/db.ts`
  - `src/pages/AgentDetail.tsx`
  - `src/pages/AgentsList.tsx`
