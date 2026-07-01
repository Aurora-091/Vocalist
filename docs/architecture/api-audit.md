# Weeber Express API Security and Architecture Audit 🔍

_Audit Date: 2026-07-01_  
_Auditor: Antigravity AI Agent_  
_Scope: Express backend modules routing, controllers input validation, multi-tenancy auth leaks, and credential storage integration._

---

## 1. Summary of Findings

| ID | Severity | File / Location | Description | Status |
|:---|:---|:---|:---|:---|
| **A1** | 🔴 CRASH / LEAK | `backend/src/app.js` & `shopify.oauth.js` | Shopify OAuth connection handler writes `access_token` in plaintext config instead of Vault reference. | ⚠️ Awaiting Fix |
| **A2** | 🟠 LEAK RISK | `agents.routes.js`, `contacts.routes.js`, `campaigns.routes.js`, `integration.routes.js` | GET, PATCH, and DELETE endpoints fetch/delete rows by UUID `id` without filtering by `org_id` in app code. | ⚠️ Awaiting Fix |
| **A3** | 🔴 CRASH | `agent.service.js` | Attempts to insert `tools` property directly into `agents` table (which lacks a `tools` column). | ⚠️ Awaiting Fix |
| **A4** | 🟡 VALIDATION | `segments.routes.js` | Preview and creation routes lack Zod input validation schemas. | ⚠️ Awaiting Fix |

---

## 2. Detailed Findings

### A1 — Unencrypted Shopify Access Token Upsert (🔴 CRASH / LEAK)
* **Location**: `backend/src/app.js:107-148` & `backend/src/modules/integrations/shopify.oauth.js:13-42`
* **Issue**: When a user completes the Shopify OAuth authorization flow via the `connected` webhook routes, the plaintext `access_token` is saved directly inside the `config` JSONB column of the `integrations` database table. This completely bypasses the Supabase Vault storage pattern (`vaultifyConfig`) implemented on general PUT integrations.
* **Risk**: DB dumps or configuration read leaks would compromise Shopify customer access tokens.
* **Remediation**: Use `writeSecret` to write the token to Supabase Vault, and store the reference pointer (`vault:integrations:shopify:access_token:${org_id}`) inside the config object.

---

### A2 — Missing Tenant Filtering (`org_id` check) in Endpoints (🟠 LEAK RISK)
* **Location**: 
  - `integration.routes.js` (`DELETE /:type` & `POST /:type/test`)
  - `contacts.routes.js` (`GET /:id`, `PATCH /:id`, `DELETE /:id`)
  - `campaigns.routes.js` (`GET /:id`, `PATCH /:id`)
  - `agents.routes.js` (`GET /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`)
* **Issue**: Endpoints fetch, modify, or delete database rows directly by UUID `id` or type without adding `.eq("org_id", req.auth.orgId)` filters in the Express routers.
* **Risk**: While Supabase Row-Level Security (RLS) policies prevent cross-tenant access for user-bound tokens, any developer errors in RLS policies or internal usage of the admin/service-role client would immediately leak or delete data across tenants. For example, a user calling `DELETE /v1/integrations/shopify` would delete *all* shopify integrations in the system.
* **Remediation**: Always apply explicit `.eq("org_id", req.auth.orgId)` filters to all tenant-scoped database queries in route handlers for defense-in-depth.

---

### A3 — Database Column Mismatch for `tools` (🔴 CRASH)
* **Location**: `backend/src/modules/agents/agent.service.js:59` & `116`
* **Issue**: The `agents` table schema in the database does not contain a `tools` column (agent tools are stored separately in `agent_active_skills`). However, the `createAgent` and `updateAgent` service methods destructure body arguments but fail to remove `tools` from the destructured database insertion object (`dbAgentData`).
* **Risk**: If a front-end client passes a `tools` array inside the POST/PATCH request to `/v1/agents`, the database upsert statement will fail with a Postgres `column "tools" of relation "agents" does not exist` database exception.
* **Remediation**: Explicitly destructure `tools` from the input payload in `createAgent` and `updateAgent` so it is not passed to the database insert/update operations.

---

### A4 — Missing Input Validations on Segments Router (🟡 VALIDATION)
* **Location**: `backend/src/modules/segments/segments.routes.js`
* **Issue**: The creation (`POST /`) and preview (`POST /preview`) endpoints accept filter parameter structures from the request body without validation.
* **Risk**: Incoming malformed JSON objects can cause runtime errors (e.g. `TypeError` on filter processing) or allow SQL/NoSQL injections.
* **Remediation**: Create a Zod schema validating segment creation and preview shapes, and hook up the `validate` middleware.
