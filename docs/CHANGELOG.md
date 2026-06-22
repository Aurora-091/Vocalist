# Changelog

All notable changes to the Weeber platform will be documented in this file. This project adheres to Semantic Versioning.

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
- **Vercel Speed Insights Integration**: Integrated Vercel Speed Insights for performance monitoring.
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
