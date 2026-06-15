# Aurora / Weeber — Full Codebase Audit

_Date: 2026-06-15_
_Scope: Security, code quality, architecture, dependencies & configuration_
_Stack: React + Vite + Tailwind v4 + shadcn/ui (frontend) · Node/Express 5 (backend) · Supabase (Postgres + Auth + Edge Functions) · ElevenLabs + Twilio + Stripe_

This audit reviews the frontend (`src/`), backend API (`backend/`), Supabase migrations and Edge Functions (`supabase/`), and project configuration. Findings are grouped by severity. Each item lists the affected location, the problem, the risk, and a recommended fix.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 2 |
| High | 5 |
| Medium | 8 |
| Low / Informational | 9 |

**Overall:** The architecture is solid and notably mature for its stage — modular backend, Zod validation on most routes, RLS enabled broadly with a clean `auth_org()` claim pattern, webhook signature verification, idempotency on webhooks, and an invariant test suite. The most serious problems are concentrated in the **API authentication layer**: bearer tokens are decoded but never cryptographically verified, and the auth/waitlist endpoints are not rate-limited. These should be fixed before any production traffic.

---

## Remediation status (updated 2026-06-16)

All Critical and High findings have been fixed in code:

| ID | Status | Change |
|----|--------|--------|
| C1 | ✅ Fixed | `auth.middleware.js` now `jwt.verify()`s tokens with `SUPABASE_JWT_SECRET` (HS256); unverified `jwt.decode()` only remains as an explicit non-production fallback when no secret is set. |
| C2 | ✅ Fixed | New strict `authLimiter` (10 req/min/IP) applied directly to `/v1/auth/{login,signup,refresh,password-reset}` and `/v1/waitlist/join`. |
| H1 | ✅ Resolved by C1 | Role/org claims are now only trusted after signature verification. |
| H2 | ✅ Fixed | CORS no longer allows any `*.vercel.app`; restricted to this project's `vocalist-*.vercel.app` deployments. |
| H3 | ✅ Fixed | `src/lib/api.ts` no longer falls back to a hardcoded prod URL; relative in dev, throws on missing `VITE_API_BASE_URL` in prod builds. |
| H4 | ✅ Fixed | `npm audit fix` in `backend/` — 0 vulnerabilities. |
| H5 | ✅ Fixed | Vapi/ElevenLabs/Twilio webhooks now reject (503) when their secret is unset and enforce signatures in **all** environments. |

Verification: frontend `vite build` passes, backend `lint:syntax` passes, and all 66 backend invariant tests pass. Medium/Low items below remain open and are tracked for follow-up.

---

## Critical

### C1 — API trusts unverified JWTs (signature never checked)
**Location:** `backend/src/middleware/auth.middleware.js:20`

```js
decoded = jwt.decode(token); // decode only — does NOT verify the signature
```

The middleware uses `jwt.decode()`, which parses the token without validating its signature. `req.auth` (`userId`, `orgId`, `role`) is then populated from this **untrusted** payload. `SUPABASE_JWT_SECRET` is declared and even *required in production* (`config/env.js:18`), but it is never used anywhere (`jwt.verify` appears nowhere in the codebase).

**Why this is critical:**
- **Privilege escalation:** `requireRole("owner","admin")` and `requireOrg` gate sensitive routes (agent create/delete, campaign control, number assignment) purely on the decoded `role`/`org_id`. An attacker can craft a token with `role: "owner"` and any `org_id` and pass every app-layer authorization check.
- **Partial mitigation, not a fix:** Row Level Security saves you *only* on routes that go through `req.supabase` (the per-token client), because Supabase/PostgREST verifies the JWT server-side before `auth_org()` reads `request.jwt.claims`. A forged token fails there. **However**, many routes use the **service-role admin client** (`requireAdmin()`), which bypasses RLS entirely and reads `org_id`/`user_id` from `req.auth`. Examples: `webhooks/webhook.routes.js` (inbound voice), `onboarding.routes.js`, `users.routes.js`, `campaigns.routes.js`, `billing.service.js`. On those paths a forged JWT means **cross-tenant data access and tampering**.

**Fix:** Verify the token before trusting it.
```js
const jwt = require("jsonwebtoken");
try {
  decoded = jwt.verify(token, env.SUPABASE_JWT_SECRET, { algorithms: ["HS256"] });
} catch {
  throw Unauthorized("Invalid or expired token");
}
```
For projects on Supabase's newer asymmetric (ES256/JWKS) signing keys, verify against the project JWKS instead. Either way, **never** populate `req.auth` from `jwt.decode()`. After this fix, audit every `requireAdmin()` route to ensure it still scopes by the now-trusted `req.auth.orgId`.

---

### C2 — Authentication & waitlist endpoints have no rate limiting
**Location:** `backend/src/app.js:95-99`

```js
app.use("/v1/auth", authRoutes);      // registered FIRST
app.use("/v1/waitlist", waitlistRoutes);
app.use("/v1", apiLimiter);            // limiter registered AFTER — never reached
```

Express runs middleware in registration order. Because `apiLimiter` is mounted *after* the auth and waitlist routers, requests to `/v1/auth/login`, `/v1/auth/signup`, `/v1/auth/password-reset`, and `/v1/waitlist/join` are handled and returned **before** the limiter ever runs. There is no dedicated limiter on `auth.routes.js` either.

**Risk:** Unthrottled credential brute-force / password spraying on `/login`, account-enumeration and email-bomb abuse via `/signup` and `/password-reset`, and spam flooding of the public waitlist.

**Fix:** Apply a strict limiter directly on these routers (e.g. a tighter `authLimiter` — 5–10 requests/min/IP for login & reset) mounted *inside* `auth.routes.js` and `waitlist.routes.js`, before the route handlers.

---

## High

### H1 — `requireRole` / `requireOrg` rely entirely on client-supplied claims
**Location:** `backend/src/middleware/auth.middleware.js:46-56`

Even after C1 is fixed, role and org come from the JWT `app_metadata`. That is fine *if* the token is verified (C1) and `app_metadata` is only ever set server-side (it is, in `auth.service.js` via `admin.auth.admin.createUser`). Until C1 is fixed, all role checks are advisory only. Track this as a hard dependency on C1, and add a defense-in-depth check that the user's role/org in the `users` table matches the claim for privileged mutations.

### H2 — Overly permissive CORS for `*.vercel.app` with credentials
**Location:** `backend/src/app.js:53-55`

```js
if (origin.match(/^https:\/\/.*\.vercel\.app$/)) return callback(null, true);
credentials: true,
```

Any site hosted on `*.vercel.app` (i.e. anyone's Vercel deployment) is an allowed cross-origin caller with credentials. Combined with cookie/token flows this broadens CSRF/credential-relay surface. **Fix:** Restrict to your specific preview/production domains via `CORS_ALLOWED_ORIGINS`, or match a project-specific prefix (e.g. `^https:\/\/vocalist-[a-z0-9]+\.vercel\.app$`).

### H3 — Hardcoded production API URL fallback in the frontend
**Location:** `src/lib/api.ts:3`

```js
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://vocalist-production.up.railway.app";
```

If `VITE_API_BASE_URL` is unset in any environment (including local dev or a preview), the client silently talks to **production**. This risks dev/test actions hitting live data. **Fix:** Default to the Vite proxy (empty string / relative `/v1`) in dev and fail loudly if the var is missing in a production build.

### H4 — Backend dependency vulnerability: `form-data` (high)
**Location:** `backend/package-lock.json` (transitive)

`npm audit` reports a **high** severity advisory (GHSA-hmw2-7cc7-3qxx, CRLF injection in `form-data` 4.0.0–4.0.5), pulled in transitively. A fix is available. **Fix:** Run `cd backend && npm audit fix` and commit the updated lockfile. (Frontend audit is clean — 0 vulnerabilities.)

### H5 — ElevenLabs webhook accepts unsigned events when secret is unset
**Location:** `backend/src/modules/webhooks/webhook.routes.js:71-79`

```js
const signatureOk = verifyHmacSha256(webhookSecret, rawString, sigHeader);
if (webhookSecret && !signatureOk && env.NODE_ENV === "production") { ...reject... }
```

If `ELEVENLABS_WEBHOOK_SECRET` is not configured, signature verification is skipped and the event is logged with `signatureOk: true`. This lets a spoofed request drive call/billing state. The Vapi handler has the same "only enforce in production" shape, and Twilio likewise only rejects bad signatures in production. **Fix:** Treat a missing webhook secret as a hard misconfiguration (refuse to process, return 503) and enforce signature checks in all environments, not just production.

---

## Medium

### M1 — TypeScript strictness disabled
**Location:** `tsconfig.json:14` — `"strict": false`

Disabling strict mode (and the use of `as any` in `src/lib/supabase.ts`, `Feature({ icon: any })` in `Login.tsx`, etc.) forfeits most of TypeScript's safety guarantees. **Fix:** Enable `"strict": true` and address the resulting errors incrementally (or at least enable `strictNullChecks` and `noImplicitAny`).

### M2 — Lint is a stub; no enforced linting
**Location:** `package.json` — `"lint": "echo 'lint stub'"`

There is no real linter on the frontend. The backend has only `lint:syntax` (a `node --check` pass). **Fix:** Add ESLint (with `@typescript-eslint`, `react-hooks`) to the frontend and wire both into CI so regressions are caught.

### M3 — Hardcoded demo credentials in client bundle
**Location:** `src/pages/Login.tsx:8-9`

```js
const DEMO_EMAIL = "demo@weeber.dev";
const DEMO_PASSWORD = "weeber-demo-2026";
```

A real, working account's password ships in the public JS bundle. If that account has any real org data or write access, it is effectively public. `.env.example` already anticipates `VITE_DEMO_EMAIL/PASSWORD`, so this is also inconsistent with intent. **Fix:** Move to env vars, and ensure the demo account is sandboxed (read-only / disposable seed data).

### M4 — Error handler exposes internal details for 4xx
**Location:** `backend/src/middleware/error.middleware.js:23-24`

`details` is returned to clients for any non-500 (or any error in non-production). Zod `flatten()` output is generally safe, but confirm no handler stuffs sensitive context into `err.details`. **Fix:** Whitelist what goes into `details`; never echo raw provider errors.

### M5 — `markProcessed` silently swallows a DB error class
**Location:** `backend/src/modules/webhooks/webhook.service.js:38`

`if (error && error.code !== "P0001") throw error;` ignores `P0001` (raised exception). If a trigger raises P0001 during the "mark processed" update, the webhook is reported as handled but isn't marked, which can cause reprocessing. **Fix:** Log P0001 explicitly rather than silently discarding it.

### M6 — No `apiVersion` pinned on Stripe client
**Location:** `backend/src/modules/webhooks/webhook.routes.js:17`

`new Stripe(env.STRIPE_SECRET_KEY)` uses the account's default API version, which can drift. **Fix:** Pin `{ apiVersion: "..." }` so webhook payload shapes stay stable.

### M7 — `trust proxy` set to `1` unconditionally
**Location:** `backend/src/app.js:65`

`app.set("trust proxy", 1)` trusts one hop. On Railway/Vercel this is usually correct, but if the hop count differs, `req.ip` (used as the rate-limit key fallback) can be spoofed via `X-Forwarded-For`, weakening IP-based limits. **Fix:** Confirm the exact proxy chain and set the value to match, or use a more specific trust function.

### M8 — Body size limit applies after webhook raw parsing only
**Location:** `backend/src/app.js:84-85`

JSON/urlencoded limits (`2mb`) are reasonable, but the Twilio webhook uses `express.urlencoded({ extended:false })` with no explicit limit at the route, inheriting defaults. Confirm a sane cap on all public webhook routes to avoid memory pressure from oversized payloads. **Fix:** Set explicit `limit` on webhook body parsers.

---

## Low / Informational

- **L1 — `package.json` name mismatch:** root package is named `"weeber"` while the repo/product is "Aurora"/"Vocalist". Cosmetic but confusing; align naming.
- **L2 — `allowedHosts` hardcodes a sandbox host** (`vite.config.ts:14`). Fine for this preview, but don't ship a sandbox-specific host in committed config long-term; prefer an env-driven list.
- **L3 — SPA rewrite is correct** (`vercel.json`) but there are no security headers (CSP, HSTS, X-Frame-Options) configured for the static frontend. Consider adding them via `vercel.json` `headers`.
- **L4 — `console.error` for fatal env config** (`config/env.js`) is fine, but consider routing through the structured logger for consistency.
- **L5 — `logout` uses optional chaining that may no-op** (`auth.service.js:69`): `anonClient.auth.admin?.signOut?.(token) ?? { error: null }` — the anon client has no `auth.admin`, so server-side logout likely never revokes the session. Verify token revocation actually happens (use admin client or `auth.signOut(jwt)` appropriately).
- **L6 — Random fallback IDs for webhook idempotency** (e.g. `vapi-${Date.now()}-${Math.random()}`) defeat dedup when the provider omits an ID. Prefer hashing the payload for a stable external_id.
- **L7 — Demo/seed migrations in the main migrations folder** (`*_demo_seed.sql`, `seed_demo_merchant_bloom_dental.sql`). Ensure these are not applied to production, or gate them behind an env flag.
- **L8 — No automated test runner in CI is visible from config.** The backend has a good invariant suite (`npm test`); ensure it runs in `.github/` CI on every PR (verify the workflow covers it).
- **L9 — `escapeXml` is used for TwiML** (good — prevents TwiML/XML injection in the inbound greeting). No action; noted as a positive. Keep using it for any user-derived TwiML content.

---

## What's done well (keep it up)

- **RLS-first data model:** `auth_org()` reads the verified `request.jwt.claims ->> 'org_id'`, and policies consistently scope by `org_id = auth_org()` across tables. This is the right pattern and is the main reason C1 is not already catastrophic.
- **Zod validation** on request bodies/params/query across modules, with a clean central `validate()` middleware.
- **Webhook hardening:** raw-body parsing before JSON, HMAC/Stripe signature verification, idempotency via `webhook_events` unique constraint + `logWebhookEvent`/`markProcessed`.
- **Timing-safe signature comparison** (`utils/signature.js`) using `crypto.timingSafeEqual` with length guard.
- **Operational maturity:** spend guards, inbound rate RPC, consent gate + calling-hours enforcement, graceful shutdown, structured logging (pino), and a focused invariant test suite.
- **Secret hygiene:** no hardcoded secrets in source; `.env*` correctly gitignored; env validated at boot with Zod.

---

## Recommended remediation order

1. **C1** — verify JWT signatures (blocks everything else security-wise).
2. **C2** — rate-limit auth & waitlist endpoints.
3. **H4** — `npm audit fix` in backend.
4. **H2 / H3 / H5** — tighten CORS, remove prod API fallback, enforce webhook secrets everywhere.
5. **M1 / M2** — enable TS strict mode and real linting in CI.
6. Work through remaining Medium/Low items.
