# Weeber Express API Security and Architecture Audit 🔍

_Audit Date: 2026-07-01_  
_Scope: Express backend modules routing, controllers input validation, multi-tenancy auth leaks, and credential storage integration._

---

## 1. Summary of Findings

| ID | Severity | File / Location | Description | Status |
|:---|:---|:---|:---|:---|
| **A1** | 🔴 CRASH / LEAK | `backend/src/app.js` & `shopify.oauth.js` | Shopify OAuth connection handler writes `access_token` in plaintext config instead of Vault reference. | ✅ Resolved |
| **A2** | 🟠 LEAK RISK | `agents.routes.js`, `contacts.routes.js`, `campaigns.routes.js`, `integration.routes.js` | GET, PATCH, and DELETE endpoints fetch/delete rows by UUID `id` without filtering by `org_id` in app code. | ✅ Resolved |
| **A3** | 🔴 CRASH | `agent.service.js` | Attempts to insert `tools` property directly into `agents` table (which lacks a `tools` column). | ✅ Resolved |
| **A4** | 🟡 VALIDATION | `segments.routes.js` | Preview and creation routes lack Zod input validation schemas. | ✅ Resolved |
| **B1** | 🔴 PERFORMANCE | `contacts.routes.js` | DNC upload POST route executes sequential DB queries per phone, causing timeouts on large datasets (N+1). | ✅ Resolved |
| **B2** | 🟠 IDOR | `campaigns.routes.js` | Campaign targets insertion endpoint lacks campaign organization ownership validation. | ✅ Resolved |
| **B3** | 🟠 ERROR HANDL | `agent.service.js` | Raw Error throws result in generic 500 status codes, processed via fragile string matching in routes. | ✅ Resolved |
| **B4** | 🟠 ERROR HANDL | `agents.routes.js` | Delete and assign-number endpoints wrap original errors in generic Error, obscuring stack traces. | ✅ Resolved |
| **B5** | 🟡 BYPASS RISK | `campaigns.routes.js` | Admin (service-role) client is instantiated inside `GET /:id/review` to call `can_spend` RPC. | ✅ Resolved |
| **B6** | 🟡 PERFORMANCE | `agent.service.js` | Duplicate check query fetches all columns (`*`) of all organization agents. | ✅ Resolved |
| **B7** | 🟡 DEPENDENCY | `agents.routes.js` | Inline requires are used for `updateOnboardingStep`, presenting dependency pattern issues. | ✅ Resolved |
| **B8** | 🟡 MULTI-TENANT | `shopify.oauth.js` | Shopify uninstall webhook falls back to domain matching, potentially updating multiple tenants. | ✅ Resolved |
| **B9** | 🟡 AUTHORIZATION| `segments.routes.js` | POST and DELETE segment routes lack owner/admin role verification. | ✅ Resolved |

---

## 2. Remediation Details

### A1 — Unencrypted Shopify Access Token Upsert
* **Remediation**: Call `vaultifyConfig` to encrypt `access_token` in Supabase Vault and store vault reference key before saving config. Bypasses plaintext credentials leakage.

### A2 — Missing Tenant Filtering (`org_id` check)
* **Remediation**: Added explicit `.eq("org_id", req.auth.orgId)` scopes to all single-resource handlers (agents, campaigns, contacts, integrations) and GET lists to prevent cross-tenant access.

### A3 — Database Column Mismatch for `tools`
* **Remediation**: Destructured `tools` out of agent data inside `createAgent` and `updateAgent` in `agent.service.js` to bypass DB crashes.

### A4 — Missing Input Validations on Segments
* **Remediation**: Hooked up Zod schema validation middleware (`validate`) for segments creation and preview endpoints.

### B1 — N+1 Loop in DNC Upload
* **Remediation**: Restructured the route to extract all numbers, run a single select matching the E.164 array, then execute exactly one batch update and one batch insert query.

### B2 — Campaigns Targets IDOR Check
* **Remediation**: Added campaign ownership validation to verify target campaigns belong to the organization before target upserts.

### B3 & B4 — Error Handling & Typed Throws
* **Remediation**: Replaced raw Error throws in `AgentService` with standard factory `BadRequest` and `NotFound` HttpErrors, allowing original error types to propagate to the middleware handler cleanly.

### B5 — requireAdmin() inside campaigns review
* **Remediation**: Kept the service-role client strictly scoped to the `can_spend` RPC lookup, ensuring that all table queries continue to run under the user's `req.supabase` JWT client context.

### B6 — Duplicate Agent Search Optimization
* **Remediation**: Restricted query select statement in duplicate check to only fetch `id` and `name` fields.

### B7 — Inline require() inside route handlers
* **Remediation**: Moved `updateOnboardingStep` import to the top of `agents.routes.js`.

### B8 — Shopify Uninstall webhook multi-tenant vulnerability
* **Remediation**: Required `org_id` strictly in the request body of `handleUninstalled` to prevent updates filtering by `shop_domain`.

### B9 — Missing role checks on Segments
* **Remediation**: Added `requireRole("owner", "admin")` verification on segment creation and deletion endpoints.
