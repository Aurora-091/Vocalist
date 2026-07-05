# Weeber — Full Codebase Audit

_Last updated: 2026-07-05_
_Scope: Security, code quality, architecture, dependencies & configuration_
_Stack: React + Vite + Tailwind v4 + shadcn/ui (frontend) · Node/Express 5 (backend) · Supabase (Postgres + Auth + Edge Functions + 10 Edge Functions) · ElevenLabs + Twilio + Stripe_

This audit reviews the frontend (`src/`), backend API (`backend/`), Supabase migrations and Edge Functions (`supabase/`), and project configuration. Findings are grouped by severity.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 4 (4 fixed) |
| High | 8 (8 fixed) |
| Medium | 14 (12 fixed, 2 open: M1, M2) |
| Low / Informational | 9 |
| DB Linter | 3 categories (2 fixed via migration, 1 manual dashboard step) |

**Overall:** The codebase is fully hardened against the vulnerabilities highlighted in both the June 16 and June 18 audits. Webhook signatures are timing-safe verified, OAuth exchanges are CSRF protected, environment secret leakages are prevented via Vault decryption lookups, and client-side data fetching is consolidated via a centralized `db.ts` abstraction. The July 5 remediation pass addressed CSP, code-splitting, Twilio lifecycle, rate limiting, remaining medium findings (M3–M8 resolved or verified safe), and Supabase database linter warnings (function permissions, partition RLS policies).

### DB Linter Findings (2026-07-05)

| Category | Status | Resolution |
|----------|--------|------------|
| SECURITY DEFINER functions callable by anon/authenticated | Fixed | `20260705200000_linter_security_remediation.sql` — explicit REVOKE from anon+authenticated, GRANT to service_role. `auth_org()` keeps authenticated access (required for RLS). |
| 57 partition tables with RLS enabled but no policies | Fixed | Same migration — DO block creates matching policies on all existing partitions; `ensure_monthly_partitions()` rewritten to create policies on future partitions at creation time. |
| Leaked password protection disabled | Open (manual) | Dashboard-only setting — cannot be set via SQL. Enable in Supabase Dashboard: Authentication > Providers > Email > "Leaked Password Protection". |

---

## Remediation status

### Fixed (from 2026-06-18 audit)

| ID | Status | Change |
|----|--------|--------|
| C3 | Fixed | Verified Twilio signatures via SHA-256 and HMAC-SHA1 using Vault credentials. |
| C4 | Fixed | Session-bound CSRF token validation on OAuth callbacks. |
| C5 | Fixed | Removed global Deno.env credential fallbacks; forced Vault lookup for integrations. |
| C6 | Fixed | Optimistic locking on oauth_tokens writes based on updated_at to prevent refresh races. |
| H6 | Fixed | Scoped contacts export query in google-sheets-export edge function to current tenant org_id. |
| H7 | Fixed | Fenced system prompts and added input sanitization (length capping, character escaping) for agent personas. |
| H8 | Fixed | Throws fatal error on production boot when RESEND_API_KEY is not defined. |
| M9 | Fixed | Added try/catch and toast error handlers to frontend database mutations. |
| M10| Fixed | Sanitized client-facing edge function error logs to prevent detail leakage. |
| M11| Fixed | Cross-referenced user roles authoritatively against the users database table in voice-sync. |
| M12| Fixed | Warnings and limits checks implemented for Sheets row exports. |
| M13| Fixed | Logged and handled database exceptions in catch blocks across components. |
| M14| Fixed | Consolidated frontend client-side data access through centralized db.ts layer. |

### Fixed (from 2026-06-16 audit)

| ID | Status | Change |
|----|--------|--------|
| C1 | Fixed | `auth.middleware.js` now `jwt.verify()`s tokens with `SUPABASE_JWT_SECRET` (HS256). |
| C2 | Fixed | New strict `authLimiter` (10 req/min/IP) on `/v1/auth/{login,signup,refresh,password-reset}` and `/v1/waitlist/join`. |
| H1 | Resolved by C1 | Role/org claims now only trusted after signature verification. |
| H2 | Fixed | CORS restricted to `vocalist-*.vercel.app` deployments. |
| H3 | Fixed | `src/lib/api.ts` no longer falls back to hardcoded prod URL. |
| H4 | Fixed | `npm audit fix` in `backend/` — 0 vulnerabilities. |
| H5 | Fixed | Vapi/ElevenLabs/Twilio webhooks reject (503) when secret is unset. |

---

## New Critical Findings (2026-06-18 — Edge Functions)

### C3 — WhatsApp webhook accepts unsigned events
**Location:** `supabase/functions/whatsapp-webhook/index.ts`

No Twilio signature verification (`X-Twilio-Signature`) is performed. Any HTTP client can POST fabricated inbound messages, which are stored in `whatsapp_messages` and associated with contacts.

**Risk:** Message injection, fake opt-out/opt-in triggers, data pollution.
**Fix:** Validate `X-Twilio-Signature` against the request URL + body using `TWILIO_AUTH_TOKEN`. Reject with 403 if invalid.

### C4 — OAuth exchange missing state/CSRF validation
**Location:** `supabase/functions/oauth-exchange/index.ts`

The OAuth callback accepts any `code` + `provider` without verifying the `state` parameter. An attacker can craft a callback URL that exchanges a malicious authorization code, linking their account to the victim's org.

**Risk:** Account hijacking via OAuth CSRF.
**Fix:** Generate a random `state` before redirect, store in session/cookie, verify on callback.

### C5 — Cross-org credential leakage via global env vars
**Location:** `supabase/functions/agent-bridge/index.ts`, `shopify-proxy/index.ts`

Provider API keys (SHOPIFY_API_KEY, TWILIO_ACCOUNT_SID, etc.) are read from `Deno.env` as global fallbacks when `config.secret_ref` is missing. Since edge functions are shared across all orgs, any org's request can use another org's credentials.

**Risk:** Cross-tenant data access, unauthorized API calls.
**Fix:** Remove env var fallbacks. Require `secret_ref` → Vault lookup for every provider call. Return 422 if not configured.

### C6 — OAuth token refresh race condition
**Location:** `supabase/functions/agent-bridge/index.ts`, `google-sheets-export/index.ts`

Concurrent requests can trigger simultaneous token refreshes. Both read the same refresh_token, both exchange it, but only one new access_token is valid (providers invalidate the old refresh_token on use). The loser writes a stale token.

**Risk:** Permanent token invalidation requiring user re-authentication.
**Fix:** Use optimistic locking (`updated_at` version check) on `oauth_tokens` writes. If the write conflicts, re-read and retry with the new token.

---

## New High Findings (2026-06-18)

### H6 — Google Sheets export missing org_id filter on contacts
**Location:** `supabase/functions/google-sheets-export/index.ts`

The contacts export query does not filter by `org_id`, potentially returning all contacts in the system (mitigated if service role + RLS bypass is scoped, but the function uses service role).

**Fix:** Add `.eq("org_id", orgId)` to the contacts query.

### H7 — Persona prompt injection (no input sanitization)
**Location:** `backend/src/services/persona.service.js`

Agent persona fields (objective, first_message, custom instructions) are concatenated directly into the system prompt without sanitization. A user could inject instructions that override guardrails.

**Fix:** Escape or fence user-supplied content within the prompt template. Validate max length and reject known injection patterns.

### H8 — Silent email delivery failure
**Location:** `backend/src/services/email.service.js`

When `RESEND_API_KEY` is not configured, the email service returns success without sending. No error is logged or surfaced. Waitlist confirmations and admin broadcasts silently fail.

**Fix:** Throw at boot if `RESEND_API_KEY` is unset in production. Log a warning in development.

---

## New Medium Findings (2026-06-18)

### M9 — Frontend mutations missing error handling
**Locations:**
- `Settings.tsx` — `saveTheme()`, `revokeSession()` (no error check after UPDATE)
- `CampaignDetail.tsx` — `setStatus()` (no error handling)
- `AgentsList.tsx` — delete agent (no error check)
- `Numbers.tsx` — hard DELETE instead of soft-delete

**Fix:** Wrap all direct Supabase mutations in consistent try/catch with toast notifications.

### M10 — Error messages expose internal details
**Location:** `supabase/functions/agent-bridge/index.ts`

Error responses include provider-specific details ("Unknown Shopify action: X", internal stack traces in non-production).

**Fix:** Return generic error messages; log detailed errors server-side only.

### M11 — voice-sync role check not authoritative
**Location:** `supabase/functions/voice-sync/index.ts`

Checks `role !== "admin" && role !== "owner"` from `app_metadata`, but doesn't verify the role against the `users` table. If JWT metadata drifts, unauthorized sync could occur.

**Fix:** Cross-reference with `users.role` or trust only the verified JWT claim.

### M12 — Google Sheets export silent row cap
**Location:** `supabase/functions/google-sheets-export/index.ts`

Exports are silently capped at 1000 rows with no user notification.

**Fix:** Return the total count alongside the export and warn when truncated.

### M13 — Empty catch blocks swallow errors
**Locations:** `Dashboard.tsx`, `Onboarding.tsx`, `CampaignDetail.tsx`

Multiple `catch {}` blocks discard error information, making debugging impossible.

**Fix:** At minimum log errors; surface user-facing toast for recoverable failures.

### M14 — Inconsistent data-fetching abstraction
**Scope:** ~40% of pages call `supabase.from()` directly instead of using `lib/db.ts`

This creates inconsistent error handling and makes it harder to apply cross-cutting concerns (caching, retries, telemetry).

**Fix:** Consolidate all data access through `lib/db.ts` for consistent patterns.

---

---

## Previously Identified Medium (status updated 2026-07-05)

### M1 — TypeScript strictness disabled (open)
**Location:** `tsconfig.json:14` — `"strict": false`

### M2 — Lint is a stub; no enforced linting (open)
**Location:** `package.json` — `"lint": "echo 'lint stub'"`

### M3 — Hardcoded demo credentials in client bundle (resolved — not a real issue)
**Location:** `src/pages/Login.tsx:13-14`
**Status:** Credentials are read from `import.meta.env.VITE_DEMO_EMAIL` / `VITE_DEMO_PASSWORD` (env vars), not hardcoded. The demo UI only renders when both vars are set. No fix needed.

### M4 — Error handler exposes internal details for 4xx (resolved — already safe)
**Location:** `backend/src/middleware/error.middleware.js:17`
**Status:** `err.details` is gated behind `NODE_ENV !== "production"`. HttpError messages are developer-controlled strings, not stack traces. The catch-all returns generic "Internal server error". No fix needed.

### M5 — `markProcessed` silently swallows a DB error class (fixed)
**Location:** `backend/src/modules/webhooks/webhook.service.js:35`
**Fix:** `P0001` exceptions are now logged with `logger.warn()` instead of silently swallowed.

### M6 — No `apiVersion` pinned on Stripe client (resolved — already pinned)
**Location:** `backend/src/modules/webhooks/webhook.routes.js:19`
**Status:** Stripe client is instantiated with `{ apiVersion: "2023-10-16" }`. No fix needed.

### M7 — `trust proxy` set to `1` unconditionally (fixed)
**Location:** `backend/src/app.js:82-84`
**Fix:** Now wrapped in `if (env.NODE_ENV === "production")` so development environments don't trust proxy headers.

### M8 — Body size limit applies after webhook raw parsing only (resolved — correct by design)
**Location:** `backend/src/app.js:99-100`
**Status:** `/webhooks` routes are mounted *before* `express.json()`, handling their own raw body parsing inline. The JSON body parser at line 99 correctly only applies to non-webhook routes. This is the intended Express middleware ordering pattern.

---

## Low / Informational

- **L1 — `package.json` name:** root package is named `"weeber"` — consistent with branding.
- **L2 — `allowedHosts` hardcodes a sandbox host** (`vite.config.ts:14`). Fine for preview; prefer env-driven in production.
- **L3 — No security headers (CSP, HSTS)** configured for the static frontend via `vercel.json`.
- **L4 — `console.error` for fatal env config** (`config/env.js`) — consider structured logger.
- **L5 — Server-side logout may no-op** (`auth.service.js:69`) — verify token revocation actually happens.
- **L6 — Random fallback IDs for webhook idempotency** defeat dedup when provider omits an ID. Prefer payload hashing.
- **L7 — Demo/seed migrations in main folder** — gate behind env flag for production.
- **L8 — CI workflow exists** (`.github/workflows/ci.yml`) — verify it covers backend invariant tests.
- **L9 — `escapeXml` used for TwiML** — good pattern, no action needed.

---

## Architecture Strengths

- **RLS-first data model:** `auth_org()` + per-table isolation policies on all 40+ tables.
- **Vertical Registry:** Zero conditional branching — all vertical behavior is config-driven.
- **Append-only audit ledgers:** consent_events, usage_ledger, webhook_events, dialer_transitions immutable by trigger.
- **Spend guards:** Dollar-metered reserve/commit/release pattern prevents runaway costs.
- **Consent gating:** `can_dial()` enforces consent + DNC + calling hours as a single checkpoint.
- **GDPR erasure:** Dedicated function scrubs PII while preserving suppression tombstone.
- **Webhook hardening:** HMAC signature verification, idempotency via unique constraints, raw-body parsing.
- **Timing-safe comparison:** `crypto.timingSafeEqual` with length guard in `utils/signature.js`.
- **Zod validation:** Request bodies/params/query validated across backend modules.
- **Secret hygiene:** No hardcoded secrets in source; `.env*` gitignored; env validated at boot.
- **Time-series partitioning:** Monthly partitions on call_events, webhook_events, usage_ledger.
- **Vector search:** pgvector with ivfflat index for knowledge retrieval, org-scoped.

---

## Recommended Remediation Order

1. **C3** — Add Twilio signature verification to whatsapp-webhook.
2. **C4** — Add OAuth state parameter validation.
3. **C5** — Remove global env var fallbacks in edge functions; require vault-based secrets.
4. **C6** — Add optimistic locking on token refresh.
5. **H6** — Add org_id filter to Google Sheets export.
6. **H7** — Sanitize persona fields before prompt injection.
7. **H8** — Fail loudly on missing email API key.
8. **M9–M14** — Consolidate error handling patterns.
9. **M1–M8** — TypeScript strict mode, linting, remaining medium items.
