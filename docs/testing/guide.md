# Developer Testing Guide

This guide details how to run automated invariant tests, manage static fixtures, and update the living edge cases checklist on the Weeber platform.

---

## 1. Directory Structure

All testing files are organized as follows:
```
backend/src/tests/
├── fixtures/          # Mock payloads (Shopify checkouts, ElevenLabs completion bodies)
├── logs/              # Temporary test-run logs (ignored by Git)
└── invariants/        # Automated test suites (remediation, integrations, state machines)
```

### Test Suites

| File | Coverage Area |
|------|---------------|
| `auth-middleware.test.js` | JWT validation, token expiry, org extraction |
| `billing.test.js` | Overage calculation, idempotency, cost formulas |
| `consent-gate.test.js` | DPDP consent enforcement before outbound calls |
| `consent-locked.test.js` | Consent withdrawal blocks further processing |
| `elevenlabs.test.js` | ElevenLabs webhook signature, payload parsing |
| `enterprise-inquiries.test.js` | Enterprise form validation |
| `idempotency.test.js` | Duplicate request prevention |
| `inbound-gate.test.js` | Inbound call admission control |
| `integrations.test.js` | Provider connect/disconnect flows |
| `onboarding.test.js` | Onboarding step progression |
| `phone.test.js` | E.164 normalization, country inference |
| `remediation.test.js` | Audit issue fixes verification |
| `security-headers.test.js` | Vercel security headers (CSP, HSTS, XSS, Permissions-Policy) |
| `settings-sync.test.js` | Settings read/write consistency |
| `shopify-provider.test.js` | Shopify integration provider |
| `shopify-v2.test.js` | Shopify v2 playbooks and scheduled calls |
| `state-machine.test.js` | Campaign target state transitions |
| `twilio-stream.test.js` | Twilio media stream WebSocket handling |
| `twilio.test.js` | Twilio subaccount provisioning |
| `webhook-sig.test.js` | Webhook HMAC signature verification |
| `worker-infra.test.js` | Worker service splitting, Railway config, Procfile, health probes |

---

## 2. Running Automated Tests

To execute the backend testing suites locally:
```bash
cd backend
npm test
```

This runs the custom node test runner on all `*.test.js` files under the `invariants` directory.

### Running Individual Test Suites
```bash
cd backend
SUPABASE_URL=http://localhost SUPABASE_ANON_KEY=dummy_key_must_be_20_chars \
  node --test src/tests/invariants/worker-infra.test.js
```

### Code Coverage
To verify test coverage:
```bash
npm run coverage
```

---

## 3. Managing Mock Fixtures
Static mock payloads should be placed in `backend/src/tests/fixtures/` as JSON files instead of being hardcoded inside test scripts.
To import a fixture in your test:
```javascript
const fs = require("fs");
const path = require("path");

const shopifyFixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../fixtures/shopify_order.json"), "utf8")
);
```

---

## 4. Infrastructure Tests

The `worker-infra.test.js` and `security-headers.test.js` suites verify deployment configuration correctness without requiring network access or running services. They validate:

- **Worker splitting**: `worker-entry.js` imports all workers, has a health probe, handles signals, and does NOT start Express.
- **Railway configs**: Both `railway.json` (API) and `railway.worker.json` (workers) have correct start commands and healthcheck paths.
- **Procfile**: Defines both `web` and `worker` process types.
- **Security headers**: All Vercel response headers match expected security posture (HSTS, CSP directives, XSS protection disabled, frame/object blocking).

These tests run as part of the standard test suite and catch configuration drift before deployment.

---

## 5. Maintenance of the Living Edge-Cases Sheet
When writing new features, modifying webhooks, or updating the database schema:
1. **Automated Test**: Write a matching unit/integration test in `backend/src/tests/invariants/`.
2. **Changelog Entry**: Add details of the fix or feature to `docs/CHANGELOG.md`.
3. **Manual QA Row**: Open `docs/testing/edge_cases.md` and add a new row detailing the manual steps required to verify this functionality in staging. Do not mark it `[x] Verified` until staging QA has been executed.
