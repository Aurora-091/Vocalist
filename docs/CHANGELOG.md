# Changelog

All notable changes to the Weeber platform will be documented in this file. This project adheres to Semantic Versioning.

---

## [1.8.0] - Monday, 2026-06-29 20:30 IST

### Added
- **Supabase Vault Integration & Helpers** (`credential.helper.js`): Added utility functions (`writeSecret`, `readSecret`, `resolveConfigSecrets`) to store plaintext integration credentials (API keys, Shopify access tokens, Twilio tokens) securely in Supabase Vault via `vault_store` RPCs, keeping database columns clean of plaintext secrets.
- **Dynamic Tools Proxy Architecture** (`backend/src/modules/tools`): Created `/v1/tools/:integration/:action` proxy routes and middleware to authorize requests using `WEEBER_TOOL_SECRET` and resolve tenant context (`org_id`, `vertical`) dynamically.
- **Mock Tool Action Handlers**: Built mock tools handlers for `shopify` (order check, product lists, discounts, cancellations, shipping), `calcom` (scheduling, booking, cancellations), `calendar` (events management), and `twilio` (calls transfer, SMS sending) to return structured ElevenLabs-compatible schemas.
- **ElevenLabs Recording Proxy Endpoint** (`calls.routes.js`): Implemented a server-side proxy route `GET /v1/calls/:id/recording` to securely stream call audio from ElevenLabs using the backend `ELEVENLABS_API_KEY`, preventing public authentication errors.
- **Integrations Test Suite** (`integrations.test.js`): Created unit tests checking credentials vaulting, resolution, and provider builder mapping invariants.

### Changed
- **Shopify Checkouts GraphQL Query** (`shopify.provider.js`): Rewrote abandoned checkouts query to use modern Admin GraphQL API (`2025-01`) instead of the deprecated REST `/checkouts.json` endpoint.
- **Shopify Email Consent Path**: Standardized marketing consent checks to use the current `email_marketing_consent.state` field path.
- **Non-blocking Stripe Webhook processing** (`webhook.routes.js`): Redesigned Stripe webhook handlers to process events asynchronously in the background and respond immediately to Stripe with `200 OK` to prevent timeouts. Failed background handlers automatically log events to `webhook_dlq`.
- **Stripe API Version**: Updated client configuration to API version `"2024-06-20"`.

### Fixed
- **Twilio Voice Call Events FK Constraint**: Fixed database foreign key violations by creating a placeholder "failed" call record in the `calls` table before logging blocked spend and blocked rate `call_events`.
- **Shopify Discount Creation Payload**: Excluded the read-only `usage_count` field from discount code body construction to prevent API errors.
- **Fallback Provider Registry Crash**: Added a fallback stub provider (`stub.provider.js`) for unimplemented provider mappings to prevent `buildProvider` crashes.

## [1.7.0] - Saturday, 2026-06-27 02:47 IST

### Added
- **Database Security Hardening Migration** (`20260627000000_database_security_hardening.sql`): Added a comprehensive migration script to resolve all Supabase database linter and security advisor findings.
- **Broadcasts RLS Policy** (`broadcasts`): Added an explicit `service_role_access_only` policy on the `broadcasts` table, satisfying the linter requirement while maintaining restricted public access.

### Changed
- **RLS Enablement on Dynamic Partitions** (`ensure_monthly_partitions`): Enabled Row Level Security on the 12 existing partition tables and modified the dynamic partition rotation function to automatically enable RLS on newly generated partitions.
- **v_rls_coverage Security Invoker View** (`v_rls_coverage`): Recreated the view using `WITH (security_invoker = true)` to inherit caller privileges instead of view owner credentials.
- **Extension Isolation** (`vector`): Relocated the `vector` extension from the `public` schema to the `extensions` schema.

### Fixed
- **Mutable search_path Hardening**: Applied strict `SET search_path = public, pg_temp` on 19 schema functions to mitigate path mutable hijack risks.
- **Latent Bug in enforce_max_sessions**: Corrected a bug in the triggers count query that attempted to select from a non-existent `ended_at` column instead of the correct `revoked_at` column in `user_sessions`.
- **Restricted RPC Execution**: Revoked public execute permissions for 8 sensitive `SECURITY DEFINER` functions (`can_spend`, `check_inbound_rate`, `cleanup_inbound_rate_counters`, `commit_spend`, `handle_new_oauth_user`, `release_spend`, `reserve_spend`, `seed_demo_data`) from public, restricting execution exclusively to `service_role`.
- **Waitlist RLS Tightening**: Replaced the unrestricted `WITH CHECK (true)` policy on the waitlist table with a hardened regex check validating email formats and name constraints.
- **Consent Events Query Column Fixed** (`db.ts`): Resolved a PostgREST 400 Bad Request error by correcting the `optOuts` query to query the correct database column `kind = 'revoke'` instead of the non-existent `new_status = 'revoked'`.
- **ElevenLabs Agent Creation Payload Fixed** (`elevenlabs.provider.js`): Resolved an ElevenLabs 422 Unprocessable Content error during agent creation/saving by removing the invalid `safety.interaction_budget` block from the payload configuration.

---

## [1.6.0] - Saturday, 2026-06-27 01:42 IST

### Added
- **PostHog Analytics Server-Side Proxy** (`posthog.service.js` & `admin.routes.js`): Added backend proxy to fetch analytics from PostHog via HogQL queries. Exposes 6 routes under `/v1/admin/posthog/*` for insights, top pages, top events, user activity, traffic referrers, and country distributions, gated by `requireSuperAdmin` middleware.
- **Product Analytics Dashboard** (`ProductAnalytics.tsx`): Built a rich administrative dashboard with overview metric cards (unique users, pageviews, total events, sessions with trend badges), a dynamic SVG bar chart for daily active users (DAU), and lists for top pages and custom events.
- **Marketing Analytics Dashboard** (`MarketingAnalytics.tsx`): Built a marketing attribution dashboard displaying active users over time, attribution referrers, and country geolocation metrics.

### Changed
- **Node.js Runner Upgrade** (`ci.yml`): Upgraded the GitHub Actions runner Node.js version from 20 to 22, enabling native WebSocket support to fix failing tests relying on Supabase database connectivity.

### Fixed
- **PostHog Prefix Correction** (`.env.local`): Renamed PostHog keys in the root env file to use the `VITE_` prefix (`VITE_POSTHOG_KEY`/`VITE_POSTHOG_HOST`) to match client-side requirements.
- **CodeQL Dynamic Instantiation Hardening** (`factory.js` & `integration.service.js`): Hardened class instantiation factories against unvalidated dynamic method calls by enforcing prototype safety check (`hasOwnProperty`) and constructor type validations (`typeof Cls === "function"`), resolving CodeQL security alerts #3 and #4.
- **Shopify Domain Input Hardening** (`ShopifyConnect.tsx`): Refactored domain normalization logic to perform strict host-only pattern verification, resolving open redirection vulnerabilities.

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
