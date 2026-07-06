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

---

## 2. Running Automated Tests

To execute the backend testing suites locally:
```bash
cd backend
npm test
```

This runs the custom node test runner on all `*.test.js` files under the `invariants` directory.

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

## 4. Maintenance of the Living Edge-Cases Sheet
When writing new features, modifying webhooks, or updating the database schema:
1. **Automated Test**: Write a matching unit/integration test in `backend/src/tests/invariants/`.
2. **Changelog Entry**: Add details of the fix or feature to `docs/CHANGELOG.md`.
3. **Manual QA Row**: Open `docs/testing/edge_cases.md` and add a new row detailing the manual steps required to verify this functionality in staging. Do not mark it `[x] Verified` until staging QA has been executed.
