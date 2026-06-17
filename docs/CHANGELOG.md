# Changelog

All notable changes to the Weeber platform will be documented in this file. This project adheres to Semantic Versioning.

---

## [Unreleased] - 2026-06-17

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
