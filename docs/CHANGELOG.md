# Changelog

All notable changes to the Weeber platform will be documented in this file. This project adheres to Semantic Versioning.

---

## [Unreleased] — 2026-07-05

### Added

#### Shopify v2 — Playbooks & Scheduled Calls
- **Playbooks Table** (`20260705100647_create_playbooks_table.sql`): New `playbooks` table lets each org configure multiple named call flows (`cart_recovery`, `cod_confirm`, `feedback`). Columns: `key`, `agent_id`, `enabled`, `delay_minutes`, `max_attempts`, `call_hours_start`, `call_hours_end`, `timezone`, `config`. RLS scoped to `auth_org()`. Unique constraint on `(org_id, key)`.
- **Scheduled Calls v2 Columns** (`20260705100422_add_scheduled_calls_v2_columns.sql`): Extended `scheduled_calls` with `checkout_token`, `order_id`, `attempt`, `outcome`, `recovered_order_id`, `recovered_value`, `recovered_currency`, `cancelled_reason`, and `playbook_key`. Adds indexes for checkout→order lookups, COD idempotency, and scheduler polling. All new columns nullable for backward compatibility.
- **Shopify Internal Routes** (`shopify.internal.routes.js`): New router at `/api/integrations/shopify/*` guarded by `WEEBER_INTERNAL_SECRET`. Endpoints: `/connected`, `/uninstalled`, `/cart-recovery`, `/cod-confirm`, `/order-paid`, `/retry-ladder`, `/playbook/:org_id`. Replaces the ad-hoc inline handler in `app.js`.
- **`WEEBERSH_INSTALL_URL` env variable** (`env.js`): New config key (default `https://weebersh.com/api/auth`) for the Shopify app install redirect. Validated by Zod schema on boot.

#### New CRM & Vertical Integration Providers
Nine new integration provider modules under `backend/src/modules/integrations/providers/`, all implementing `connect()`, `syncContacts()`, `disconnect()`:
- **`calcom.provider.js`** — Cal.com scheduling; API key auth, syncs bookings as contacts.
- **`cliniko.provider.js`** — Cliniko practice management; Basic auth, syncs patient records.
- **`drchrono.provider.js`** — DrChrono EHR; OAuth2, syncs patient appointments.
- **`freshsales.provider.js`** — Freshsales CRM; API key auth, syncs leads/contacts.
- **`jane_app.provider.js`** — Jane App clinic management; API key auth, syncs patients.
- **`pipedrive.provider.js`** — Pipedrive CRM; API token auth, syncs persons/deals.
- **`salesforce.provider.js`** — Salesforce CRM; OAuth2 SOQL-based sync of Contacts and Leads.
- **`whatsapp.provider.js`** — WhatsApp Business API; access token auth, lists phone numbers.
- **`zoho_crm.provider.js`** — Zoho CRM; OAuth2, syncs Leads and Contacts modules.

#### New Telephony Adapters
- **Exotel** (`backend/src/providers/telephony/exotel.adapter.js`): Indian cloud telephony. Basic auth (`api_key:api_token`). Implements `connect()`, `makeCall()`, `listNumbers()`, `releaseNumber()`. Registered in factory as `exotel`.
- **VoBiz** (`backend/src/providers/telephony/vobiz.adapter.js`): Indian VoIP provider. Basic auth (`api_key:api_secret`). Same interface. Registered as `vobiz`.

#### New Frontend Components
- **`WebTestCallModal`** (`src/components/WebTestCallModal.tsx`): In-browser test call UI using `@11labs/react`. Manages mic permission, WebSocket to ElevenLabs CAI, live transcript stream, mute toggle, elapsed timer, auto-stop at 5 min. Phases: `idle → requesting-mic → connecting → active → ended`.
- **`VariablesPanel`** (`src/components/VariablesPanel.tsx`): Sidebar panel for the agent prompt editor. Parses `{{variable}}` tokens, categorizes into *Call-time*, *Settings*, and *Custom* groups, renders copy-to-clipboard badges. Sourced from `src/config/agent-variables.ts`.
- **`agent-variables.ts`** (`src/config/agent-variables.ts`): Canonical definition of all known agent prompt variables with category, label, and description. Exports `KNOWN_VARIABLES`, `extractVariablesFromText()`, and `categorizeVariable()`.
- **`CommandPalette`** (`src/components/layout/CommandPalette.tsx`): `⌘K`/`Ctrl+K` keyboard-driven navigation dialog. Renders all vertical nav items from `config.navigation`. Integrated into `AppShell`.

#### Database & Performance
- **Performance Indexes** (`20260704213757_add_performance_indexes.sql`): Three composite indexes added: `idx_calls_org_status` for live-calls dashboard, `idx_contacts_org_created_at` for cursor pagination, `idx_waitlist_email_created` for edge-function dedup checks.

#### Supabase Edge Functions
- **`waitlist-join/index.ts`**: New edge function for waitlist signup with deduplication and validation.
- **`waitlist-phone/index.ts`**: New edge function for phone-number-based waitlist entries.
- **`enterprise-inquire/index.ts`**: Enterprise inquiry submission moved to an edge function.

### Changed

- **`AppShell`**: Wired `CommandPalette`; `⌘K`/`Ctrl+K` opens it globally.
- **`AgentDetail`**: Integrated `WebTestCallModal` as the web-call test trigger; `VariablesPanel` added alongside prompt editor.
- **`IntegrationConnect`**: Shopify install now redirects to `WEEBERSH_INSTALL_URL` instead of direct Shopify OAuth.
- **`agent-bridge` edge function**: Hardened error types, improved call-variable forwarding, consistent response shapes.
- **`oauth-exchange` edge function**: Multi-provider state handling with CSRF verification.
- **Calls routes**: Added filtering by `status`, `agent_id`, `from`/`to` date range on the calls list endpoint.
- **Segment routes**: Added filter/search to contact segment list endpoint.
- **`index.html`**: Updated CSP headers (tracking domains, Supabase, PostHog).
- **Dependencies**: Added `@11labs/react` (in-browser ElevenLabs SDK). Removed `posthog-node` backend dependency.
- **`credential.helper.js`**: Refactored — legacy `vaultifyConfig` approach replaced with Vault RPC-based `readSecret`/`writeSecret`. File retained; still used by integration routes.
- **Test files**: `integrations.test.js`, `remediation.test.js`, `auth-middleware.test.js` retained but may reference deprecated patterns. Active tests: `shopify-v2.test.js`, `shopify-provider.test.js`, `billing.test.js`, `elevenlabs.test.js`.

### Removed

- **`tools/` module** (`backend/src/modules/tools/`): Entire tools layer removed — routes, middleware, and all four handler files (`calcom`, `calendar`, `shopify`, `twilio`). Tool execution now lives inside integration providers and webhook handlers.
- **`custom.orchestrator.js`**: Custom voice orchestration removed. ElevenLabs CAI is the sole active runtime.
- **`posthog.service.js`**: Backend PostHog service removed. Analytics is frontend-only.
- **`stub.provider.js`**: Placeholder integration stub removed.
- **Docs cleanup**: Removed `docs/guides/custom-tools.md`, `docs/guides/developer-rules.md`, `docs/guides/vault-setup.md`, `docs/1-WELCOME.md`, `docs/2-JOURNEY_AND_HISTORY.md`, `backend/.../SHOPIFY_INTEGRATION.md`. `docs/architecture/security-audit.md` → relocated to `AUDIT.md` at repo root.

---

## [1.6.0] — 2026-07-04

### Fixed
- **Auth 401 Infinite Loop** (`auth.middleware.js`, `api.ts`): `decodeBearer()` was reading the stale `sb-access-token` httpOnly cookie before the `Authorization: Bearer` header. After Supabase SDK auto-refresh, the stale cookie shadowed the fresh token on every request → infinite retry loop. Fix: header-only, no cookie fallback. `api.ts` removes `credentials: "include"`. (See DEC-015.)
- **`phone.e164` typo** (`agent.service.js`): `assignNumber` wrote `undefined` to `agents.inbound_number` because it referenced `phone.number` instead of `phone.e164`.
- **`calls.updated_at` schema cache miss** (`20260704000002_add_calls_updated_at.sql`): Backend tried to update a column that didn't exist. Migration adds column + `NOTIFY pgrst, 'reload schema'`.
- **ElevenLabs phone import field names** (`elevenlabs.provider.js`): Payload sent `twilio_account_sid`/`twilio_auth_token`; ElevenLabs expects `sid`/`token`.

### Added
- **Phone number assignment UI** (`AgentDetail.tsx`, `AgentsList.tsx`): Dropdown to select/swap phone numbers on agent forms. Backend `unassignPhoneNumberAgent()` helper clears stale references on swap.
- **Cookie layer removed — Bearer-token-only session** (`auth.routes.js`, `auth.middleware.js`, `app.js`): `setAuthCookies()`, `clearAuthCookies()`, `cookieOptions`, all `res.cookie()`/`res.clearCookie()` calls, and `cookie-parser` middleware removed. Supabase JS SDK Bearer tokens are the sole session mechanism. (See DEC-015.)
- **DEC-015 decision record** (`docs/DECISIONS.md`): Bearer-only session model documented with XSS/CSRF tradeoff rationale. DEC-011 corrected.

---

## [1.9.0] — 2026-07-04 00:09 IST

### Added
- **ElevenLabs `fromE164` rejection test** (`elevenlabs.test.js`): Added invariant test verifying that `startCall()` throws when `fromE164` is absent, guarding against silent outbound call failures.

### Fixed
- **Contact creation enum** (`contacts.routes.js`, `Contacts.tsx`): Corrected invalid consent_status enum value sent during contact creation from the frontend.
- **Test-call provider error surfacing** (`elevenlabs.provider.js`): Ensured provider-level errors from ElevenLabs are correctly rethrown rather than swallowed, making test-call failures visible in the API response.
- **Knowledge sync error surfacing** (`knowledge.routes.js`, `Knowledge.tsx`): Fixed silent failures in knowledge source resync — errors now propagate to the frontend toast system.

---

## [1.8.7] — 2026-07-02 21:32 IST

### Added
- **Shopify direct install support** (`integration.routes.js`): Added route handler for Shopify apps installed directly from the Shopify App Store (as opposed to OAuth-initiated installs from within the Weeber dashboard). Enables the two-way integration flow.
- **Full checkout payload forwarding** (`integration.routes.js`): Cart recovery webhook now forwards the complete Shopify checkout payload (line items, customer, shipping address, discount codes, currency) to the scheduled call context, enabling the AI agent to reference order details in conversation.

---

## [1.8.6] — 2026-07-02 21:19 IST

### Fixed
- **Test-calls Twilio subaccount pre-flight check** (`agents.routes.js`): Added strict subaccount existence validation before initiating a test call, stopping silent failures where calls were attempted without a provisioned Twilio subaccount.
- **Legacy synthetic agent ID rejection** (`agents.routes.js`): Test-call handler now rejects `local_`-prefixed synthetic agent IDs that were created before the ElevenLabs sync was implemented.
- **E.164 phone validation — frontend** (`AgentDetail.tsx`): Added client-side E.164 format validation on the test-call phone number input to prevent malformed numbers from reaching the API.

### Added
- **Proactive Twilio subaccount provisioning on signup** (`auth.service.js`): Aurora-managed Twilio subaccounts are now created during user signup rather than lazily on first call, eliminating a class of "subaccount not found" errors on first test-call.
- **A2P 10DLC compliance guide** (`docs/A2P_10DLC_GUIDE.md`): Added documentation for US A2P 10DLC registration requirements for SMS/voice campaigns.
- **`mock.provider.js` voice mock** (`providers/voice/mock.provider.js`): Added a mock voice provider for test environments that returns well-structured responses without hitting ElevenLabs.
- **Vapi provider hardening** (`vapi.provider.js`): Updated Vapi provider to match the shared `VoiceProvider` interface contract.

### Changed
- **Rate limit middleware** (`rate-limit.middleware.js`): Tuned request-rate thresholds for auth endpoints.
- **`errors.js`**: Added `BadGateway` (502) helper for provider upstream failures.

---

## [1.8.5] — 2026-07-01 23:16 IST

### Added
- **Self-healing signup for orphaned Supabase Auth users** (`auth.service.js`): When signup detects an existing `auth.users` row but no corresponding `public.users` row (orphaned from a previous partial signup), the flow now auto-creates the missing `public.users` + `orgs` rows rather than returning a misleading `409 Conflict`. Covered by 8 new invariant tests in `remediation.test.js`.

> **Note**: This self-healing logic was subsequently removed in a later cleanup (post-July 4) as it was identified as a potential account-takeover vector. The removal is documented under the auth hardening work.

---

## [1.8.4] — 2026-07-01 22:26 IST

### Fixed
- **ElevenLabs `interaction_budget` safety block** (`elevenlabs.provider.js`): Re-added `safety.interaction_budget` with a valid enum value to `_buildAgentPayload`; ElevenLabs deprecated the `async` value and this prevents future API breakage.
- **ElevenLabs path-param schema** (`elevenlabs.provider.js`): Webhook tool URLs using `{{placeholder}}` Handlebars syntax are now converted to single-braced `{placeholder}` ElevenLabs URL templates, with an auto-generated `path_params_schema` block mapping them as dynamic variables.

### Added
- **ElevenLabs compliance test suite** (`remediation.test.js`): 6 new invariant tests verifying agent payload structure, tool URL conversion, `path_params_schema` generation, and `request_body_schema` translation.

---

## [1.8.3] — 2026-07-01 22:19 IST

### Added
- **Phase 2 API security remediations** — tenant hardening:
  - **Call list org isolation** (`calls.routes.js`): All call list/detail queries now enforce `org_id` filter from `req.auth`.
  - **Consent endpoint guard** (`consent.routes.js`): Added `requireAuth` to all consent mutation routes.
  - **Phone numbers ownership check** (`numbers.routes.js`): Number assignment and release routes now verify the phone number belongs to the requesting org before proceeding.
  - **User update scoping** (`users.routes.js`): Users can only update their own profile; admin-only fields (role, org_id) are blocked from self-update.
- **Remediation test coverage** (`remediation.test.js`): 12 new invariant tests covering org-scoped call queries, user update isolation, and number ownership enforcement.

### Changed
- **API audit report updated** (`docs/architecture/api-audit.md`): All Phase 2 findings marked resolved with fix dates and commit references.

---

## [1.8.2] — 2026-07-01 21:37 IST

### Added
- **Full Express API security remediations**:
  - **Multi-tenant contact isolation** (`contacts.routes.js`): All contact CRUD operations now enforce `org_id` scoping. Bulk import validates all contacts belong to the calling org.
  - **Campaign ownership validation** (`campaigns.routes.js`): Campaign read/write/delete routes verify campaign `org_id` matches authenticated org.
  - **Segment route hardening** (`segments.routes.js`): Segment queries scoped to org; pagination and sorting sanitized.
  - **Agent service cleanup** (`agent.service.js`): Removed raw Supabase client calls in favour of admin-scoped queries; added `deleted_at IS NULL` filters throughout.
  - **Credential helper expansion** (`credential.helper.js`): Added `vaultifyConfig` to handle structured config objects (Shopify, HubSpot, Twilio) — stores sensitive fields in Vault and returns scrubbed config.
  - **Shopify OAuth hardening** (`shopify.oauth.js`): State parameter CSRF check; domain normalisation hardened.
  - **Integration routes cleanup** (`integration.routes.js`): Auth guards added to all integration CRUD endpoints.
- **200+ new invariant tests** (`remediation.test.js`): Covers multi-tenant isolation, vaultification, credential resolution, agent lifecycle, and Shopify provider flows.

---

## [1.8.1] — 2026-07-01 20:52 IST

### Added
- **Full Express API security and architecture audit** (`docs/architecture/api-audit.md`): Comprehensive audit of all backend API routes covering authentication gaps, tenant isolation, input validation, rate limiting, and error handling. Identified and documented all findings with severity ratings.

---

## [1.8.0] — 2026-06-29 20:30 IST

### Added
- **Supabase Vault Integration & Helpers** (`credential.helper.js`): Added `writeSecret`, `readSecret`, `resolveConfigSecrets` utilities to store integration credentials (API keys, Shopify access tokens, Twilio tokens) securely in Supabase Vault via `vault_store` RPCs, keeping database columns free of plaintext secrets.
- **Dynamic Tools Proxy Architecture** (`backend/src/modules/tools/`): Created `/v1/tools/:integration/:action` proxy routes and middleware that authorize requests using `WEEBER_TOOL_SECRET` and resolve tenant context (`org_id`, `vertical`) dynamically.
- **Mock Tool Action Handlers**: Built handlers for `shopify` (order check, product lists, discounts, cancellations, shipping), `calcom` (scheduling, booking, cancellations), `calendar` (events management), and `twilio` (calls transfer, SMS sending) returning structured ElevenLabs-compatible schemas.
- **ElevenLabs Recording Proxy** (`calls.routes.js`): `GET /v1/calls/:id/recording` — server-side proxy that streams call audio from ElevenLabs using the backend `ELEVENLABS_API_KEY`, preventing authentication errors in browser audio players.
- **Integrations test suite** (`integrations.test.js`): Unit tests for credential vaulting, resolution, and provider builder mapping invariants.

### Changed
- **Shopify Checkouts GraphQL** (`shopify.provider.js`): Rewrote abandoned checkouts query to use the modern Admin GraphQL API (`2025-01`) instead of the deprecated REST `/checkouts.json`.
- **Shopify email consent path**: Standardized marketing consent checks to `email_marketing_consent.state`.
- **Non-blocking Stripe webhooks** (`webhook.routes.js`): Stripe webhook handlers now process events asynchronously and immediately return `200 OK`. Failed handlers log to `webhook_dlq`.
- **Stripe API version**: Updated to `"2024-06-20"`.

### Fixed
- **Twilio Voice Call Events FK constraint**: Created a placeholder "failed" call record in `calls` before logging blocked-spend and blocked-rate `call_events` to satisfy the foreign key.
- **Shopify discount creation payload**: Excluded read-only `usage_count` field from discount code body.
- **Fallback provider registry crash**: Added `stub.provider.js` for unimplemented provider mappings to prevent `buildProvider` from throwing.

---

## [1.7.5] — 2026-06-29 20:43 IST

### Added
- **Database schema gap resolution** (`20260629000000_resolve_schema_and_verticals_gaps.sql`): Comprehensive migration seeding missing verticals (`clinic`, `hotel`, `education`, `real_estate`), agent presets per vertical, pre-creating 12 monthly call_event partitions, and backfilling missing `agent_presets` rows.
- **Lazy Stripe loading** (`billing.routes.js`): Stripe SDK is now lazily initialized on first use rather than at module load, preventing boot failures when `STRIPE_SECRET_KEY` is not configured.
- **Stripe billing columns migration** (`20260629000001_add_stripe_billing_cols.sql`): Added `stripe_customer_id`, `stripe_subscription_id`, and `current_period_end` to `subscriptions` table.

### Fixed
- **Duplicate migrations cleanup**: Removed conflicting migrations from the `20260619` and `20260704000001` series that caused schema conflicts.
- **ElevenLabs agent payload builder** (`elevenlabs.provider.js`): Additional compliance fixes for `conversation_config` structure.

---

## [1.7.4] — 2026-06-29 17:27 IST

### Added
- **Custom Voice Orchestrator** (`providers/voice/custom.orchestrator.js`): Introduced a custom orchestration layer to handle live Twilio Media Streams → ElevenLabs CAI bridging. Implements audio chunking, session lifecycle management, and dual-channel WebSocket coordination.
- **Twilio Stream Service refactor** (`services/twilio-stream.service.js`): Rewrote the Twilio Media Stream handler to delegate to the orchestrator, simplifying the WebSocket event routing and improving call teardown reliability.

---

## [1.7.0] — 2026-06-27 02:47 IST

### Added
- **Database Security Hardening Migration** (`20260627000000_database_security_hardening.sql`): Comprehensive migration resolving all Supabase database linter and security advisor findings. Includes RLS on all 12 partition tables, `search_path` hardening on 19 functions, and `service_role`-only execute grants.
- **Broadcasts RLS policy**: Added explicit `service_role_access_only` policy on `broadcasts` table.

### Changed
- **RLS on dynamic partitions**: Modified `ensure_monthly_partitions` function to automatically enable RLS on newly created partitions.
- **`v_rls_coverage` view**: Recreated with `security_invoker = true` to inherit caller privileges.
- **`vector` extension**: Relocated from `public` schema to `extensions` schema.

### Fixed
- **`search_path` mutable hijack**: Applied `SET search_path = public, pg_temp` to 19 `SECURITY DEFINER` functions.
- **`enforce_max_sessions` bug**: Corrected trigger query that referenced non-existent `ended_at` column instead of `revoked_at` in `user_sessions`.
- **Restricted RPC execution**: Revoked public execute on 8 sensitive functions (`can_spend`, `check_inbound_rate`, `cleanup_inbound_rate_counters`, `commit_spend`, `handle_new_oauth_user`, `release_spend`, `reserve_spend`, `seed_demo_data`) — now `service_role` only.
- **Waitlist RLS tightened**: Replaced `WITH CHECK (true)` with a hardened regex validating email format and name constraints.
- **Consent events query column** (`db.ts`): Fixed `optOuts` query to use `kind = 'revoke'` instead of non-existent `new_status = 'revoked'`.
- **ElevenLabs agent creation payload** (`elevenlabs.provider.js`): Removed invalid `safety.interaction_budget` block that caused 422 errors on agent create/save.

---

## [1.6.1] — 2026-06-27 01:42 IST

### Added
- **PostHog Analytics Server-Side Proxy** (`posthog.service.js`, `admin.routes.js`): Backend proxy for PostHog HogQL queries. 6 routes under `/v1/admin/posthog/*`: insights, top pages, top events, user activity, traffic referrers, country distributions. Gated by `requireSuperAdmin`.
- **Product Analytics Dashboard** (`ProductAnalytics.tsx`): Overview metric cards (unique users, pageviews, total events, sessions with trend badges), SVG bar chart for daily active users, top pages and top events lists.
- **Marketing Analytics Dashboard** (`MarketingAnalytics.tsx`): Attribution referrers, country geolocation metrics, active users over time.
- **Supabase migrations CI** (`.github/workflows/ci.yml`): Added GitHub Action to run `supabase db push` automatically on push to main. Includes `workflow_dispatch` trigger for manual runs.

### Changed
- **Node.js runner upgrade** (`ci.yml`): GitHub Actions runner upgraded from Node 20 → 22 for native WebSocket support.
- **`npm ci` → `npm install`** (`ci.yml`): Switched to `npm install` to fix cross-platform lockfile errors in CI.

### Fixed
- **CodeQL dynamic instantiation** (`factory.js`, `integration.service.js`): Hardened class instantiation factories with prototype safety checks (`hasOwnProperty`) and constructor type validation (`typeof Cls === "function"`). Resolves CodeQL alerts #3 and #4.
- **Shopify domain input hardening** (`ShopifyConnect.tsx`): Strict host-only pattern validation replaces substring-based check, resolving open-redirect vulnerability.
- **Vite + esbuild Dependabot vulnerabilities**: Upgraded Vite and forced secure esbuild version via `overrides` in `package.json`.

---

## [1.5.2] - Thursday, 2026-06-26 02:07 IST


### Fixed
- **ElevenLabs Interaction Budget Enum** (`elevenlabs.provider.js`): Corrected `interaction_budget.total_budget` from `"thirty_minutes"` (not a valid ElevenLabs enum value) to `"1_hour"`. Valid values are `5_minutes`, `10_minutes`, `1_hour` only. Added inline comment documenting the valid enum to prevent future regression.
- **CSP `frame-src` GTM Blocking** (`index.html`): Expanded the Content-Security-Policy `frame-src` directive to include `https://td.doubleclick.net` (GTM conversion tracking) and `https://www.google.com` (reCAPTCHA). The original policy allowed `googletagmanager.com` but blocked downstream iframes GTM loads for conversion measurement.

### Added
- **DPDP Consent Compliance Columns** (`20260626020000_dpdp_consent_enhancements.sql`, `consent.routes.js`): Added `purpose`, `legal_basis`, `retention_days`, and `data_principal_name` columns to `consent_events` table for Digital Personal Data Protection Act compliance. All columns nullable for backward compatibility. Added a `CHECK` constraint on `legal_basis` and an index on `(org_id, purpose)`. Updated the consent events API endpoint to accept and pass through these fields.

---

## [1.5.1] - Thursday, 2026-06-26 01:51 IST

### Fixed
- **Onboarding Voice Selection UX** (`Onboarding.tsx`): Resolved a bug where the voice step's "Next" button appeared broken because no voice card showed a selection highlight. Root cause: when `selectedVoice` was an empty string and `selectedPreset?.voice_id` was null/undefined, the highlight condition `(selectedVoice || selectedPreset?.voice_id) === v.voice_id` matched nothing. Fix applies a default voice selection (`selectedPreset.voice_id` or the first voice) when the voice list loads, and simplifies the highlight condition to `selectedVoice === v.voice_id`.
- **Nested Button HTML Violation** (`Onboarding.tsx`): Changed the voice card outer element from `<button>` to `<div role="button" tabIndex={0}>` with an `onKeyDown` handler to eliminate the invalid nested `<button>` (Play button inside the card button), which caused click event misbehavior in some browsers.
- **Voice Selection Visual Indicator** (`Onboarding.tsx`): Added a `<Check>` icon in the top-right corner of the selected voice card for clearer visual feedback.
- **ElevenLabs Interaction Budget Safety** (`elevenlabs.provider.js`): Added `safety.interaction_budget` to `conversation_config` in `_buildAgentPayload`. ElevenLabs deprecated the `async` InteractionBudget enum value; this sets a safe explicit default to prevent future API breakage.

### Changed
- **LLM Provider Switch** (`elevenlabs.provider.js`): Switched the ElevenLabs conversational agent LLM from `gpt-4o-mini` to `gemini-2.5-flash`, reducing per-call LLM passthrough cost from ~$0.003/min to ~$0.0012/min. See DEC-009 in `DECISIONS.md`.

---

## [1.5.0] - 2026-06-22

### Added
- **Unified Google Tag Manager & GA4 Loader** (`AnalyticsLoader.tsx`): Rewrote the analytics injection engine to support both GTM (`GTM-XXXXX`) and GA4 (`G-XXXXX`) tags. Dynamically detects prefixes, runs a fast-path load using environment variables (`VITE_GTM_ID`/`VITE_GA4_ID`) to bypass database latency, and handles fallback database checks.
- **Analytics Health Validation** (`AdminSettings.tsx` & `AnalyticsLoader.tsx`): Implemented a global reactive status object (`window.__weeber_analytics`) and validation card in the admin panel to monitor script loading, error catching, and blockages (e.g. uBlock/ad-blockers).
- **Enterprise Inquiries Pipeline** (`enterprise_inquiries`, `EnterpriseDialog.tsx`, `enterprise.routes.js`, `email.service.js`):
  - Created the database table `enterprise_inquiries` with platforms-admin-only RLS controls.
  - Added a multi-step interactive sliding dialog (`EnterpriseDialog.tsx`) with field validations, submit checks, and user-facing error toast handling.
  - Set up an Express backend route with Zod validation, payload size limits, and rate-limiting (`authLimiter`).
  - Added secure, non-blocking email notifications sent via Resend (`sendEnterpriseConfirmation`) with HTML-escaping sanitization.
- **PostHog & Vercel Speed Insights Integration**: Wired up user auth mapping (`identifyUser`, `resetUser`) and pageview tracking in PostHog, and integrated Vercel Speed Insights.
- **SEO & Robot crawlers configuration**: Added standard files `public/robots.txt`, `public/sitemap.xml`, and `public/llms.txt`.
- **Enterprise Inquiries Invariant Test Suite** (`enterprise-inquiries.test.js`): Created a new backend unit test suite validating the inquiries Zod input boundaries and HTML escaping sanitization.

### Fixed
- **Voice Sync Compiler Error** (`voice-sync/index.ts`): Removed a duplicate `const admin` redeclaration inside the Edge Function's request handler scope which caused compilation failures.
- **Onboarding Step Overwrite Guard** (`onboarding.routes.js`): Introduced a centralized, atomic `updateOnboardingStep` helper on the backend to merge JSONB checklist keys (e.g. `pick_vertical`, `create_agent`, etc.) instead of overwriting the entire onboarding state. Refactored `agents.routes.js`, `numbers.routes.js`, `twilio.routes.js`, `verticals.routes.js`, and `knowledge.routes.js` to utilize this helper.
- **Onboarding Helper Test Suite** (`onboarding.test.js`): Added backend unit tests validating key merging and `completed_at` timestamps inside the onboarding workflow.
- **Agent Deletion Phone Unbinding** (`agent.service.js`): Added automatic unbinding of any associated `phone_numbers` prior to soft-deleting an agent to prevent dangling references and routing errors.
- **Agent Deletion Test** (`elevenlabs.test.js`): Added an integration invariant test to verify correct database updates during agent deletion.

### Changed
- **Pageview Normalization** (`AnalyticsLoader.tsx`): Standardized SPA route view updates to trigger a native GA4 event (`window.gtag("event", "page_view", ...)`) or GTM custom pageview event (`spa_pageview`).
- **Normalized Waitlist Conversion** (`analytics.ts`): Refactored Google Ads conversion actions into a unified `signup_success` custom event pushed to `window.dataLayer`, removing legacy conversion scripts.
- **CI/CD Build Pipeline Hardening** (`.github/workflows/ci.yml`): Integrated the Vitest frontend unit test step (`npm test`) to be checked automatically during GitHub push and PR validation builds.
- **Enterprise Inquiries Form Hardening** (`enterprise.routes.js`): Enforced a `.max(120)` constraint on the email Zod parser to mitigate potential database stack flooding.
- **Deleted Legacy Code**: Cleaned up the database helper `src/lib/tracking.ts` and the deprecated `tracking_profiles` database table schema.

---

## [1.4.0] - 2026-06-19

### Added
- **Tracking & Analytics Management System** (`AnalyticsLoader.tsx`, `tracking.ts`, `AdminSettings.tsx`): Built a dynamic tracking system modeled after Dukaan's integrations UI. Allows rotation of Google Analytics (GA4) / Google Ads profiles dynamically, managed securely from the admin panel with a global toggle and Meta Pixel configuration.
- **Conversion Tracking Hooks** (`Waitlist.tsx`, `Signup.tsx`): Integrated Google Ads conversion fires (`trackSignupConversion()`) upon successful waitlist form submissions and user registrations.
- **Supabase Tracking Schema & Migration** (`20260619110000_tracking_management_system.sql`): Created database tables `tracking_profiles` and `site_settings` with Row-Level Security policies and a custom `activate_tracking_profile` RPC function.
- **Secure Webhook Verification** (`whatsapp-webhook/index.ts`): Implemented timing-safe Twilio request signature validation checking the request body SHA-256 and URL HMAC-SHA1 using securely decypted Twilio tokens.
- **CSRF Protection on OAuth Callback** (`IntegrationConnect.tsx` and `OAuthCallback.tsx`): Generated cryptographically secure random states stored in sessionStorage and verified on OAuth redirect responses.
- **Secure Vault Key Persistence** (`shopify-connect/index.ts` and `IntegrationConnect.tsx`): Directly call Vault storage RPC (`vault_store`) to securely store and decrypt credentials.
- **Database Fetching Consolidation** (`src/lib/db.ts`): Abstracted client-side `supabase.from()` direct queries into centralized database query and update helper functions.

### Changed
- **Edge Function Hardening** (`agent-bridge/index.ts`, `shopify-proxy/index.ts`): Removed insecure global environment fallback checks, enforcing decrypted credentials from the database Vault.
- **Optimistic Concurrency Locking** (`agent-bridge/index.ts`, `google-sheets-export/index.ts`): Enabled database version checks matching `updated_at` to eliminate race conditions when performing concurrent access token refreshes.
- **Prompt Injection Sanitization** (`persona.service.js`): Sanitized, length-capped, and XML-fenced user-supplied agent objective and greeting inputs to prevent instructions injection.
- **Email Service Configuration** (`email.service.js`): Added an assertive boot check to throw a fatal exception if `RESEND_API_KEY` is not defined in production mode.
- **Refactored Frontend Modules**: Ported `Settings.tsx`, `Outcomes.tsx`, `Onboarding.tsx`, `Numbers.tsx`, `Dashboard.tsx`, `Contacts.tsx`, `CampaignDetail.tsx`, `AgentsList.tsx`, `AgentDetail.tsx`, and `VerticalContext.tsx` to the centralized database helper layer.
- **Improved Error Management**: Expose sanitized user-facing messages in edge functions and frontend pages via toast indicators.
- **Aligned Content Security Policy** (`index.html`): White-listed tracking domains for Google Analytics, Google Ads, and Facebook Pixel.

---

## [Unreleased] - 2026-06-18

### Added
- **Vertical Registry Architecture** (`src/config/verticals/`): Introduced a fully config-driven vertical system that eliminates all conditional branching. Each vertical (Shopify, Clinic, Hotel) is defined in a single file covering glossary, navigation, dashboard metrics, quick actions, templates, integrations, and empty states. Adding a new vertical requires only one new file — zero code changes elsewhere.
- **VerticalProvider Refactor** (`src/lib/VerticalContext.tsx`): Rebuilt the context provider to source configuration from the registry. Exposes `vertical`, `config`, `glossary`, `loading`, `setVertical`, and a `t()` glossary helper for dynamic microcopy.
- **Config-Driven Sidebar Navigation** (`src/components/layout/AppShell.tsx`): Sidebar now renders entirely from `config.navigation` — groups, labels, icons, collapsible sections, and footer items all declared per-vertical in the registry.
- **Collapsible Sidebar Groups** (`src/components/ui/collapsible.tsx`): Added Radix Collapsible primitive for sidebar sections marked `collapsible: true` in vertical config.
- **Config-Driven Dashboard** (`src/pages/Dashboard.tsx`): Metrics, capability cards, quick actions, and empty states all render from the vertical definition. No hardcoded vertical conditionals.
- **Glossary System**: Pages use `t("contacts")`, `t("campaigns")`, etc. for vertical-appropriate terminology (Patients vs Customers, Recalls vs Campaigns).
- **API Audit Report** (`AUDIT.md`): Updated comprehensive security and architecture audit covering all 7 edge functions, backend services, frontend data-fetching patterns, and RLS posture. Identified 4 critical, 4 high, and 6 medium findings in the edge function layer.

### Changed
- **Settings Page**: Business Type selector now powered by `listVerticals()` from the registry; disabled state driven by `v.enabled` flag.
- **Onboarding Page**: Imports from new registry (`src/config/verticals`) and persists via `persistVertical()`.
- **Integrations Page**: Recommended tab filtering uses `config.integrations` from the vertical registry.
- **Contacts/Campaigns/AgentsList Pages**: Use glossary `t()` for dynamic page titles and button labels.

### Removed
- **`src/lib/verticalConfig.ts`**: Legacy vertical configuration file superseded by the registry pattern.

---

## [1.3.0] - 2026-06-17

### Added
- **Testing Infrastructure (Vitest & RTL)**: Installed and configured `Vitest` and `React Testing Library` for the frontend application. Written and verified suite operations.
- **Zod Auth Forms Validation**: Implemented robust user-facing validation schemas using Zod for frontend signup and login forms, checking password strength, email formatting, and displaying inline validation messages.
- **Security Headers Middleware**: Integrated security headers (`helmet`) and secure CORS configurations inside the Express backend application to prevent clickjacking, content sniffing, cross-site scripting (XSS), and leakages.
- **Weeber Admin Panel v2**: Comprehensive functional upgrade to the administration dashboard pages:
  - **AdminDashboard**: Integrated a date range selector (Today, 7 days, 30 days) syncing with stats refetches. Added positive/negative trend badges on metric cards. Designed and implemented an inline responsive SVG-based bar chart to display call volumes, complete with a fallback "No data yet" view.
  - **AdminUsers**: Rendered an Actions card below user profiles, supporting inline Plan changes, Reset Password triggers, and a destructive Suspend Account button backed by Radix Dialog/AlertDialog confirmations.
  - **AdminSupport**: Scoped the "View Agents", "View Billing", and "View Logs" links with organization routing query parameters (`?org=org_id`). Integrated a "Send Email" action card that opens an inline form to POST directly to the email API.
  - **AdminLogs**: Added full-text search (`q`) and Org ID filter inputs next to severity filters. Created row expand details displaying error message text, retry counts, resolved times, and copyable raw JSON metadata, with a "Mark Resolved" patch trigger.
  - **AdminBilling**: Removed the Stripe ID column, added a `$XX/mo` monthly amount column, and added expandable row details (including a copyable sub ID button, period dates, usage data, and a Cancel Subscription AlertDialog).
  - **AdminAgents**: Upgraded rows to be clickable, fetching detailed config attributes dynamically via `adminApi.getAgentDetail` and offering a "View in Console" link opening in a new tab.
  - **Analytics pages**: Replaced all dashed placeholders in `RevenueAnalytics.tsx`, `ProductAnalytics.tsx`, and `MarketingAnalytics.tsx` with a single unified centered "Coming Soon in v1.1" banner card.

### Fixed
- **Dependency Audit Fixes**: Audited frontend and backend package dependencies, updated sub-dependencies with vulnerabilities, and verified overall project compilation via `npx tsc --noEmit`.
- **Database Auth Trigger**: Corrected an edge case in the Supabase database auth trigger to ensure consistent RLS mapping during user onboarding.
