# Integration Gaps & Deprecated API Audit

**Repo:** `vocalist/backend`  
**Audited:** 2026-06-29  
**Auditor:** Runable AI  
**Status:** ⚠️ 3 critical crashes, 4 silent failures, 2 stubs shipping as real features

---

## Priority Queue

| ID | Severity | File | Issue | Action |
|----|----------|------|-------|--------|
| IG-001 | 🔴 CRASH | `integration.service.js` | 5 of 7 allowed integration types throw `BadRequest` on `buildProvider()` | Add stub providers |
| IG-002 | 🔴 CRASH | `shopify.provider.js` | `/checkouts.json` removed in Shopify API `2024-10` | Migrate to GraphQL |
| IG-003 | 🔴 CRASH | `stripe.handler.js` | `plan_tier_key` + `last_reported_overage_minutes` columns don't exist in DB | Add migration |
| IG-004 | 🟠 SILENT | `shopify.provider.js` | `marketing_consent.state` wrong path since API `2022-04+` | Fix field path |
| IG-005 | 🟠 SILENT | `shopify.provider.js` | Sends read-only `usage_count` in discount body | Send `usage_limit` |
| IG-006 | 🟠 SILENT | `webhook.routes.js` | Stripe `apiVersion: "2023-10-16"` — outdated (current: `2024-06-20`) | Update version |
| IG-007 | 🟠 SILENT | `elevenlabs.handler.js` | `recording_url` stored as auth-gated URL — breaks public playback | Store as ref, proxy on demand |
| IG-008 | 🟡 STUB | `hubspot.provider.js` | `testConnection()` returns true on expired token; `syncContacts()` is dead stub | Implement or clearly gate in UI |
| IG-009 | 🟡 STUB | `webhook.routes.js` | Shopify `/orders` + `/customers` webhooks log and return 200, no processing | Implement or remove routes |

---

## Detailed Findings

---

### IG-001 — 🔴 Integration Registry Missing 5 of 7 Providers

**File:** `backend/src/modules/integrations/integration.service.js`

**What happens:**  
Route layer allows `type` values: `calcom`, `google_cal`, `outlook_cal`, `crm`, `zapier`, `twilio`.  
`buildProvider()` switch only handles `shopify` and `hubspot`.  
Any other type throws `BadRequest("Unknown integration provider")` at runtime.

```js
// Current (broken)
switch (type) {
  case 'shopify': return new ShopifyProvider(config);
  case 'hubspot':  return new HubSpotProvider(config);
  default: throw new BadRequest("Unknown integration provider"); // 🔴 hits for 5 types
}
```

**Fix:** Add stub provider classes (at minimum) for all allowed types, or restrict the allowed `type` enum in the route validator to only `shopify` | `hubspot` until others are implemented.

```js
// Minimum viable fix — stub class
class StubProvider {
  constructor(type, config) { this.type = type; this.config = config; }
  async testConnection() { return { ok: false, note: `${this.type} not yet implemented` }; }
  async syncContacts()   { return { synced: 0, note: `${this.type} not yet implemented` }; }
}
// then in switch default:
default: return new StubProvider(type, config);
```

---

### IG-002 — 🔴 Shopify Abandoned Checkouts Endpoint Removed

**File:** `backend/src/modules/integrations/providers/shopify.provider.js`  
**Method:** `lookupAbandonedCheckouts()`

**What happens:**  
Calls `GET /admin/api/2025-01/checkouts.json` — this REST endpoint was **deprecated in 2024-04** and **removed in 2024-10**. Any call returns `404` on stores with API version ≥ `2024-10`.

```js
// Current (broken)
const response = await this.client.get('/checkouts.json', { params: filters });
```

**Fix — GraphQL (recommended):**
```graphql
query AbandonedCheckouts($first: Int!) {
  abandonedCheckouts(first: $first) {
    edges {
      node {
        id
        completedAt
        customer { email phone }
        lineItems(first: 10) {
          edges { node { title quantity } }
        }
        totalPriceV2 { amount currencyCode }
      }
    }
  }
}
```

```js
// Replacement method
async lookupAbandonedCheckouts(filters = {}) {
  const query = `query AbandonedCheckouts($first: Int!) { ... }`;
  const variables = { first: filters.limit || 50 };
  const response = await this.client.post('/graphql.json', { query, variables });
  return response.data.data.abandonedCheckouts.edges.map(e => e.node);
}
```

Required scope: `read_orders` (already in OAuth scope list per `shopify.provider.js:L12`).

---

### IG-003 — 🔴 Stripe Webhook Handler References Non-Existent DB Columns

**File:** `backend/src/modules/webhooks/handlers/stripe.handler.js`

**What happens:**  
Two column references that don't exist in any migration file:
- `plan_tier_key` on `subscriptions` table
- `last_reported_overage_minutes` on `subscriptions` table

Any `customer.subscription.updated` or overage event will throw a Postgres `column does not exist` error, silently breaking billing state sync.

**Fix — Migration needed:**
```sql
-- migrations/XXXX_add_subscription_billing_cols.sql
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS plan_tier_key TEXT,
  ADD COLUMN IF NOT EXISTS last_reported_overage_minutes INTEGER DEFAULT 0;

COMMENT ON COLUMN subscriptions.plan_tier_key IS 'Maps to pricing tier: starter|growth|scale';
COMMENT ON COLUMN subscriptions.last_reported_overage_minutes IS 'Last overage cycle minutes for idempotency check';
```

Also: `stripe.subscriptions.retrieve` is called synchronously inside the webhook handler — this blocks Stripe's 30s timeout window and risks duplicate webhook delivery. Move to an async job queue.

---

### IG-004 — 🟠 Shopify Marketing Consent Wrong Field Path

**File:** `backend/src/modules/integrations/providers/shopify.provider.js`  
**Method:** `syncContacts()`

**What happens:**  
Uses `marketing_consent.state` — this field path was renamed to `email_marketing_consent.state` in Shopify API `2022-04`. On current API version `2025-01` it returns `undefined` silently, so all contacts sync as non-consented regardless of their actual status.

```js
// Current (wrong)
const hasConsent = customer.marketing_consent?.state === 'subscribed';

// Fix
const hasConsent = customer.email_marketing_consent?.state === 'subscribed';
```

---

### IG-005 — 🟠 Shopify Discount Code Sends Read-Only Field

**File:** `backend/src/modules/integrations/providers/shopify.provider.js`  
**Method:** `applyDiscountCode()`

**What happens:**  
Sends `usage_count: 0` in the price rule body. This field is **read-only** — Shopify accepts the request and silently ignores `usage_count`. The `usage_limit` parameter passed to the function is never sent.

```js
// Current (wrong)
body: {
  price_rule: {
    ...ruleParams,
    usage_count: 0  // read-only, ignored by Shopify
  }
}

// Fix
body: {
  price_rule: {
    ...ruleParams,
    usage_limit: ruleParams.usage_limit ?? null  // writable field
    // remove usage_count entirely
  }
}
```

---

### IG-006 — 🟠 Stripe SDK Initialized with Outdated API Version

**File:** `backend/src/modules/webhooks/webhook.routes.js`

```js
// Current
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",  // outdated
});

// Fix
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",  // current as of June 2026
});
```

Note: Also check `backend/src/modules/billing/` — may have its own Stripe init with same stale version.

> **Also note:** Stripe is rejected for Indian entity (Dodo Payments + Razorpay migration pending). This fix is lower priority until billing migration is decided. Track separately.

---

### IG-007 — 🟠 ElevenLabs Recording URL Stored as Auth-Gated URL

**File:** `backend/src/modules/webhooks/handlers/elevenlabs.handler.js`

**What happens:**  
`recording_url` is stored as:
```
https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/audio
```
This endpoint requires `xi-api-key` auth header. Storing it as a plain URL means:
- Any public playback link in the dashboard → `401 Unauthorized`
- Frontend audio player will silently fail with no visible error

**Also:** `transcript_id` is mapped from `conversationId` — these are different concepts in the ElevenLabs API. `conversation_id` is the session ID; the actual transcript is a nested object within the conversation detail response, not a separate resource with its own ID.

**Fix:**
```js
// Don't store raw EL URL as recording_url
// Option A: Store conversation_id, proxy through your own endpoint
recording_url: null,               // or omit
el_conversation_id: conversationId, // store the ref

// Then add a signed proxy route:
// GET /api/calls/:callId/recording
// → fetches from EL with server-side xi-api-key, streams back to client
```

---

### IG-008 — 🟡 HubSpot Provider: Fake testConnection + Dead syncContacts

**File:** `backend/src/modules/integrations/providers/hubspot.provider.js`

**testConnection:**
```js
// Current — returns true even for expired/invalid tokens
async testConnection() {
  return { ok: !!this.config.access_token };
}

// Should call actual HubSpot endpoint
async testConnection() {
  try {
    const res = await this.client.get('/crm/v3/objects/contacts?limit=1');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
```

**syncContacts:**  
Returns `{ synced: 0, note: "HubSpot contact sync stub - implement with v3 API" }` — this ships as a working feature in the UI. Either gate HubSpot as "coming soon" in the integrations list, or implement using HubSpot CRM v3 API (`POST /crm/v3/objects/contacts/batch/upsert`).

---

### IG-009 — 🟡 Shopify Webhook Routes Are No-Op Stubs

**File:** `backend/src/modules/webhooks/webhook.routes.js`

Both `/webhooks/shopify/orders` and `/webhooks/shopify/customers` log the event and return `200` with no processing. Shopify will consider these delivered — meaning real order/customer events are silently dropped.

```js
// Current
router.post('/shopify/orders', (req, res) => {
  logger.info('Shopify order webhook received');
  res.status(200).json({ received: true }); // no-op
});
```

**Options:**
1. Implement order/customer processing (route to `handleOrderCreated`, `handleCustomerUpdate`)
2. Remove routes and remove Shopify webhook registration for these topics until implemented
3. Queue the raw payload to a job table for future processing (safe middle ground)

---

## Twilio Webhook — Bonus Finding

**File:** `backend/src/modules/webhooks/webhook.routes.js`  
**Route:** `/webhooks/twilio/voice` (inbound blocked-rate handling)

When inserting `call_events` in the blocked rate / blocked spend paths:
```js
await db.insert(callEvents).values({
  // call_id missing here — FK violation if column is NOT NULL
  tenant_id: tenantId,
  event_type: 'blocked',
  ...
});
```

If `call_id` is `NOT NULL` in the `call_events` table (it is, per `DATABASE_GAPS.md`), this will throw on every inbound blocked call. Verify `call_id` nullability and either pass a null-safe placeholder or create a placeholder call record first.

---

## Fix Priority Order

```
Week 1 (critical — crashes in prod):
  IG-001  Add stub providers to buildProvider() registry
  IG-002  Migrate lookupAbandonedCheckouts to GraphQL
  IG-003  DB migration: add plan_tier_key + last_reported_overage_minutes

Week 2 (silent data corruption):
  IG-004  Fix email_marketing_consent.state path
  IG-005  Fix usage_limit vs usage_count in discount body
  IG-007  Fix ElevenLabs recording_url — proxy pattern

Week 3 (stubs / polish):
  IG-006  Update Stripe apiVersion (post billing-migration decision)
  IG-008  Gate HubSpot as coming-soon or implement testConnection
  IG-009  Implement or queue Shopify order/customer webhook handlers
```

---

## Related Docs

- `docs/DATABASE_GAPS.md` — 8 pending DB migrations (FK violations, missing indexes, missing columns)
- `docs/AUDIT_NOTES.md` — ElevenLabs API breaking changes (CAI 2.0, InteractionBudget enum)

---

*Last updated: 2026-06-29 | Vocalist backend audit*

---

## Part 2 — Credential Schema & Auth Type Matrix

> Added: 2026-06-29 | Covers every integration type allowed in `integration.routes.js` schema

### Auth Type per Integration

| Integration | Auth Type | Credential Fields Required | Where Stored | Webhook Secret? |
|-------------|-----------|---------------------------|--------------|-----------------|
| `shopify` | OAuth (access token per store) | `shop_domain`, `access_token` | `integrations.config` (token in vault) | `SHOPIFY_CLIENT_SECRET` (env) — HMAC per webhook |
| `twilio` | Account SID + Auth Token | `account_sid`, `auth_token` | Supabase Vault (`vault_read`) | Webhook uses `TWILIO_AUTH_TOKEN` for signature verify |
| `calcom` | API Key | `api_key` | Vault ref | None (polling) |
| `google_cal` | OAuth 2.0 (PKCE flow) | `access_token`, `refresh_token`, `token_expiry`, `calendar_id` | Vault (tokens) + `config` (calendar_id, scopes) | None (push channels optional) |
| `outlook_cal` | OAuth 2.0 (MSAL) | `access_token`, `refresh_token`, `token_expiry`, `calendar_id` | Vault (tokens) + `config` (calendar_id) | None |
| `hubspot` (crm) | OAuth 2.0 or Private App key | `access_token`, `refresh_token` (OAuth) OR `api_key` (private app) | Vault | Optional (HubSpot push subscriptions) |
| `zapier` | API Key + Webhook URL (both directions) | `webhook_url` (Zapier sends to us), `api_key` (we send to Zapier) | `config.webhook_url`, vault for api_key | Zapier signs requests with `X-Hook-Secret` |
| `elevenlabs` | API Key | `api_key` | `ELEVENLABS_API_KEY` env | `ELEVENLABS_WEBHOOK_SECRET` env |
| `stripe` | API Key | `STRIPE_SECRET_KEY` | Env only (never DB) | `STRIPE_WEBHOOK_SECRET` env |

---

### Per-Integration Credential Schemas (what `config` JSONB must contain)

#### `shopify`
```jsonb
{
  "shop_domain": "mystore.myshopify.com",     -- required
  "access_token": "[vault_ref]",              -- required, store as vault ref
  "scopes": ["read_customers","read_orders","write_discounts","read_checkouts"],
  "agent_id": "uuid",                          -- which Weeber agent handles this store
  "call_delay_minutes": 30                     -- abandoned cart recovery delay
}
```
**Validation rules:**
- `shop_domain` must match `/^[a-z0-9-]+\.myshopify\.com$/`
- `access_token` starts with `shpua_` (OAuth) or `shpat_` (admin token)
- Never expose `access_token` in API responses — use `scrubSecrets()` ✅ (already done)

#### `twilio` (org's BYO Twilio — distinct from Weeber's own Twilio sub-accounts)
```jsonb
{
  "account_sid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",  -- required, 34 chars, starts AC
  "auth_token": "[vault_ref]",                          -- required, store as vault ref
  "phone_number": "+1XXXXXXXXXX",                       -- optional, their DID
  "subaccount_sid": "ACxxxxxxxx"                        -- optional if they want sub-account isolation
}
```
**Validation rules:**
- `account_sid` must match `/^AC[a-f0-9]{32}$/`
- `auth_token` is 32 hex chars — validate length
- Test connection: `GET https://api.twilio.com/2010-04-01/Accounts/{AccountSid}.json` with BasicAuth

#### `calcom`
```jsonb
{
  "api_key": "[vault_ref]",        -- required, starts with cal_
  "base_url": "https://api.cal.com",  -- allow self-hosted
  "event_type_id": 12345           -- which event type to book
}
```
**Validation rules:**
- `api_key` starts with `cal_live_` (production) or `cal_test_`
- Test connection: `GET /v1/me` with `Authorization: Bearer {api_key}`

#### `google_cal`
```jsonb
{
  "calendar_id": "primary",         -- or specific calendar ID
  "access_token_ref": "vault:gc_at_orgid",   -- vault key
  "refresh_token_ref": "vault:gc_rt_orgid",  -- vault key
  "token_expiry": "2026-07-01T00:00:00Z",
  "scopes": ["https://www.googleapis.com/auth/calendar"]
}
```
**OAuth flow:** Standard OAuth 2.0 redirect. Scopes: `calendar.events` (minimum), `calendar.readonly` for read-only.
**Token refresh:** On 401 from Google, use `refresh_token` against `https://oauth2.googleapis.com/token` before retrying.

#### `outlook_cal`
```jsonb
{
  "calendar_id": "primary",
  "access_token_ref": "vault:ms_at_orgid",
  "refresh_token_ref": "vault:ms_rt_orgid",
  "token_expiry": "2026-07-01T00:00:00Z",
  "tenant_id": "common"              -- or org tenant ID
}
```
**OAuth flow:** Microsoft MSAL OAuth 2.0. Scopes: `Calendars.ReadWrite offline_access`.

#### `hubspot` (crm)
```jsonb
{
  "access_token_ref": "vault:hs_at_orgid",   -- if OAuth
  "refresh_token_ref": "vault:hs_rt_orgid",
  "token_expiry": "2026-07-01T00:00:00Z",
  "portal_id": "12345678",
  "api_key_ref": "vault:hs_key_orgid"        -- if Private App key (preferred for new integrations)
}
```
**Note:** HubSpot deprecated API keys in Nov 2022. Use Private App tokens (longer-lived, more scoped) or OAuth.
`testConnection()` must call `GET https://api.hubapi.com/crm/v3/objects/contacts?limit=1` with real bearer token.

#### `zapier`
```jsonb
{
  "inbound_webhook_url": "https://hooks.zapier.com/hooks/catch/...",  -- Zapier sends to our endpoint
  "hook_secret": "[vault_ref]",        -- Zapier X-Hook-Secret for validation
  "outbound_api_key_ref": "vault:zap_orgid"   -- if we trigger Zapier zaps
}
```

---

## Part 3 — Bulletproof Credential Storage Pattern

### Current State (gaps)

| Gap | Impact |
|-----|--------|
| `access_token` stored directly in `integrations.config` JSONB | Token visible in DB, logs, admin queries |
| HubSpot `access_token` in `config.access_token` directly | Exposed on `GET /integrations` (scrubSecrets partially helps but JSONB nested may leak) |
| Shopify `access_token` in `config.access_token` directly | Same |
| No refresh logic for OAuth tokens | Google/Outlook/HubSpot tokens expire in 1hr; no refresh → silent 401 failures |
| No token expiry tracking | No proactive refresh before calls |

### Required Pattern: Vault Refs

```
config JSONB only stores: non-sensitive metadata + vault reference keys
Secrets live in: Supabase Vault (pg_secrets) or encrypted column

Pattern:
  config.access_token_ref = "vault:shopify_token_org_abc123"
  Actual token: admin.rpc("vault_read", { name: "vault:shopify_token_org_abc123" })
```

### Helper Needed: `credential.helper.js`

```javascript
// backend/src/utils/credential.helper.js
const { requireAdmin } = require('../config/supabase');

async function readSecret(ref) {
  if (!ref || !ref.startsWith('vault:')) return ref; // plain value fallback
  const admin = requireAdmin();
  const { data, error } = await admin.rpc('vault_read', { name: ref });
  if (error) throw new Error(`vault_read failed for ${ref}: ${error.message}`);
  return data;
}

async function writeSecret(name, value) {
  const admin = requireAdmin();
  const { error } = await admin.rpc('vault_upsert', { name, secret: value });
  if (error) throw new Error(`vault_upsert failed: ${error.message}`);
  return `vault:${name}`;
}

module.exports = { readSecret, writeSecret };
```

### OAuth Token Refresh Pattern

All OAuth providers (Google, Outlook, HubSpot) need this:

```javascript
// backend/src/utils/oauth.refresh.js
async function refreshIfExpired(provider, config, orgId) {
  const expiresAt = new Date(config.token_expiry || 0);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000; // refresh 5min before expiry

  if (now < new Date(expiresAt - bufferMs)) {
    return config; // still valid
  }

  // Call provider-specific refresh endpoint
  const refreshToken = await readSecret(config.refresh_token_ref);
  let newTokens;

  switch (provider) {
    case 'google_cal':
      newTokens = await refreshGoogleToken(refreshToken);
      break;
    case 'outlook_cal':
      newTokens = await refreshMicrosoftToken(refreshToken, config.tenant_id);
      break;
    case 'crm': // hubspot
      newTokens = await refreshHubspotToken(refreshToken);
      break;
    default:
      throw new Error(`No refresh handler for ${provider}`);
  }

  // Write new tokens to vault + update config
  await writeSecret(config.access_token_ref.replace('vault:', ''), newTokens.access_token);
  const newExpiry = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

  const admin = requireAdmin();
  await admin.from('integrations').update({
    config: { ...config, token_expiry: newExpiry }
  }).eq('org_id', orgId).eq('type', provider);

  return { ...config, token_expiry: newExpiry };
}
```

### `upsert` Route Must Redirect Secrets to Vault

Current `PUT /integrations` stores everything in `config` directly. Fix:

```javascript
// In integration.routes.js PUT handler — before upsert:
const VAULT_FIELDS = {
  shopify: ['access_token'],
  twilio: ['auth_token'],
  calcom: ['api_key'],
  google_cal: ['access_token', 'refresh_token'],
  outlook_cal: ['access_token', 'refresh_token'],
  crm: ['access_token', 'refresh_token', 'api_key'],
  zapier: ['hook_secret', 'api_key'],
};

async function vaultifyConfig(type, config, orgId) {
  const fields = VAULT_FIELDS[type] || [];
  const safeConfig = { ...config };
  for (const field of fields) {
    if (safeConfig[field] && !safeConfig[field].startsWith('vault:')) {
      const vaultKey = `${type}_${field}_${orgId}`;
      safeConfig[`${field}_ref`] = await writeSecret(vaultKey, safeConfig[field]);
      delete safeConfig[field]; // never store plain secret in config
    }
  }
  return safeConfig;
}
```

---

## Part 4 — Fixed Shopify Deprecated APIs

### IG-002 Fix: `lookupAbandonedCheckouts` — Replace REST with GraphQL

The REST endpoint `/admin/api/2024-10/checkouts.json` is **removed**. Use Storefront API or Admin GraphQL.

**Correct approach (Admin GraphQL `2025-01`):**

```javascript
async lookupAbandonedCheckouts({ limit = 10 } = {}) {
  const query = `
    query AbandonedCheckouts($first: Int!) {
      abandonedCheckouts(first: $first, query: "completed_at:null") {
        edges {
          node {
            id
            email
            phone
            totalPriceSet { shopMoney { amount currencyCode } }
            createdAt
            abandonedCheckoutUrl
            lineItems(first: 10) {
              edges {
                node {
                  title
                  quantity
                  variant { price }
                }
              }
            }
          }
        }
      }
    }
  `;

  const res = await fetch(
    `https://${this.config.shop_domain}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: { ...this.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { first: limit } })
    }
  );

  if (!res.ok) throw new Error(`Shopify GraphQL failed: ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(`Shopify GraphQL error: ${JSON.stringify(json.errors)}`);

  return (json.data?.abandonedCheckouts?.edges || []).map(({ node: c }) => ({
    id: c.id,
    email: c.email,
    phone: c.phone,
    total_price: c.totalPriceSet?.shopMoney?.amount,
    currency: c.totalPriceSet?.shopMoney?.currencyCode,
    created_at: c.createdAt,
    abandoned_url: c.abandonedCheckoutUrl,
    line_items: (c.lineItems?.edges || []).map(({ node: li }) => ({
      title: li.title,
      quantity: li.quantity,
      price: li.variant?.price,
    })),
  }));
}
```

**Required Shopify scope:** `read_checkouts` — ensure this is in OAuth scopes array.

---

### IG-004 Fix: `email_marketing_consent.state`

```javascript
// WRONG (pre-2022-04):
consent_status: c.marketing_consent?.state === 'subscribed' ? 'granted' : 'none',

// CORRECT (2022-04+):
consent_status: c.email_marketing_consent?.state === 'subscribed' ? 'granted' : 'none',
```

Also: `sms_marketing_consent.state` exists separately for SMS consent — relevant for Weeber outbound call compliance.

---

### IG-005 Fix: `applyDiscountCode` — Send `usage_limit` Not `usage_count`

```javascript
// WRONG:
body: JSON.stringify({ discount_code: { code, usage_count: 0 } }),

// CORRECT:
body: JSON.stringify({
  discount_code: {
    code,
    // usage_count is READ-ONLY — Shopify ignores it silently
    // usage_limit is the writable field on price_rule, not on discount_code
    // To set usage limit, set it on the price_rule itself at creation time
    // discount_code only needs: { code }
  }
}),
```

**Note:** `usage_limit` belongs on the **price_rule**, not the discount_code. The discount code endpoint only accepts `code`. To create a single-use code: create price_rule with `usage_limit: 1`, then create discount_code under it. Fix the caller, not just the body.

---

## Part 5 — Agent Skills on Integrations

### What "Skills" Are in Weeber's Architecture

Skills = ElevenLabs **tools** attached to an agent's prompt config. Each tool is an HTTP webhook that the voice agent can call mid-conversation. The `agent_skills` table stores what's available; `agent.tools` JSONB stores what's active for an agent.

### Current State

```
agent_skills table exists (routes: GET /v1/skills, GET /v1/skills/:id)
agent.tools JSONB → passed to _resolveTools() → sent to ElevenLabs as promptConfig.tools
Integration types in code: shopify, calcom, google_cal, outlook_cal, crm, zapier, twilio
```

### Gap: Skills Are Not Bound to Integration Credential Auth

**The problem:** `agent.tools[].url` points to Weeber's own backend (e.g. `/v1/tools/shopify/lookup-order`). But that endpoint needs to know **which org's Shopify token** to use. Currently there's no mechanism to inject org context into tool calls.

**Required pattern — Tool Proxy with Org-Scoped Credentials:**

```
ElevenLabs agent calls:
  POST /v1/tools/{tool_name}
  Headers: { "X-Weeber-Agent-Id": "agent_uuid" }
  Body: { param1, param2, ... }

Weeber backend:
  1. Read agent_id from header (set in tool's `headers` config via EL dynamic variables)
  2. Look up agent.org_id
  3. Look up integration for that org + type
  4. Fetch credentials from vault
  5. Make real API call (Shopify, Cal.com, etc.)
  6. Return structured response to EL
```

### Tool Definitions per Integration

#### Shopify Tools (for Shopify vertical agents)

| Tool Name | EL Tool Type | Description | Weeber Endpoint |
|-----------|-------------|-------------|-----------------|
| `lookup_order` | `webhook` | Get order status by order # or phone | `POST /v1/tools/shopify/lookup-order` |
| `list_products` | `webhook` | Get product catalog / inventory | `POST /v1/tools/shopify/list-products` |
| `apply_discount` | `webhook` | Generate and apply discount code mid-call | `POST /v1/tools/shopify/apply-discount` |
| `cancel_order` | `webhook` | Cancel order (with confirmation gates) | `POST /v1/tools/shopify/cancel-order` |
| `track_shipment` | `webhook` | Get fulfillment/tracking status | `POST /v1/tools/shopify/track-shipment` |

#### Cal.com Tools (for clinic/scheduling agents)

| Tool Name | EL Tool Type | Description | Weeber Endpoint |
|-----------|-------------|-------------|-----------------|
| `check_availability` | `webhook` | Get available slots for a date range | `POST /v1/tools/calcom/check-availability` |
| `book_appointment` | `webhook` | Create booking via Cal.com API | `POST /v1/tools/calcom/book-appointment` |
| `cancel_appointment` | `webhook` | Cancel existing booking by booking ID | `POST /v1/tools/calcom/cancel-appointment` |
| `reschedule_appointment` | `webhook` | Reschedule to new slot | `POST /v1/tools/calcom/reschedule` |

#### Google / Outlook Calendar Tools (hotel/enterprise agents)

| Tool Name | EL Tool Type | Description | Weeber Endpoint |
|-----------|-------------|-------------|-----------------|
| `check_calendar` | `webhook` | Check availability on calendar | `POST /v1/tools/calendar/check` |
| `create_event` | `webhook` | Create calendar event / reservation | `POST /v1/tools/calendar/create` |
| `update_event` | `webhook` | Modify existing event | `POST /v1/tools/calendar/update` |

#### Twilio Tools (for call transfer / SMS within-call)

| Tool Name | EL Tool Type | Description | Weeber Endpoint |
|-----------|-------------|-------------|-----------------|
| `transfer_call` | `webhook` | Transfer active call to human agent | `POST /v1/tools/twilio/transfer` |
| `send_sms` | `webhook` | Send SMS with booking link / discount code | `POST /v1/tools/twilio/send-sms` |

### ElevenLabs Tool Definition Format (for `agent.tools` JSONB)

```json
{
  "name": "lookup_order",
  "description": "Look up the status of a customer order. Call this when the customer asks about their order, package, or delivery.",
  "method": "POST",
  "url": "https://api.weeber.ai/v1/tools/shopify/lookup-order",
  "authentication": {
    "type": "custom_header",
    "header_name": "X-Weeber-Secret",
    "header_value": "{{WEEBER_TOOL_SECRET}}"
  },
  "body_parameters": [
    {
      "id": "order_number",
      "type": "string",
      "description": "The order number (e.g. #1234) or order ID. Extract from what the customer said.",
      "required": false
    },
    {
      "id": "customer_phone",
      "type": "string",
      "description": "Customer phone number. Use {{caller_phone}} if not said explicitly.",
      "required": false
    }
  ],
  "headers": [
    { "key": "X-Weeber-Agent-Id", "value": "{{agent_id}}" }
  ]
}
```

**Notes on EL tool config (as of June 2026):**
- `authentication.type` options: `bearer`, `custom_header`, `none`
- Dynamic variables like `{{agent_id}}`, `{{caller_phone}}` injected by EL at call time
- Tool response must be JSON — EL passes it to the LLM as tool result
- Tool calls are blocking (LLM waits for response) — keep tool endpoints under 2s
- Max 10 tools per agent in EL (verify per plan)

### Recommended Tool Proxy Module

Create: `backend/src/modules/tools/` with:

```
tools/
  tools.routes.js          -- POST /v1/tools/:integration/:action
  tools.middleware.js      -- verify X-Weeber-Secret, extract agent_id → org_id
  handlers/
    shopify.tools.js       -- lookup_order, apply_discount, cancel_order, track_shipment
    calcom.tools.js        -- check_availability, book_appointment, cancel, reschedule
    calendar.tools.js      -- check_calendar, create_event, update_event
    twilio.tools.js        -- transfer_call, send_sms
```

`tools.middleware.js` pattern:
```javascript
async function resolveOrgFromAgent(req, res, next) {
  const agentId = req.headers['x-weeber-agent-id'];
  const secret = req.headers['x-weeber-secret'];

  if (secret !== process.env.WEEBER_TOOL_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  if (!agentId) return res.status(400).json({ error: 'missing agent id' });

  const admin = requireAdmin();
  const { data: agent } = await admin
    .from('agents')
    .select('id, org_id, vertical')
    .eq('id', agentId)
    .maybeSingle();

  if (!agent) return res.status(404).json({ error: 'agent not found' });

  req.agentId = agent.id;
  req.orgId = agent.org_id;
  req.vertical = agent.vertical;
  next();
}
```

---

## Part 6 — Integration UI: What Credentials to Show Per Type

The connect modal / integration card must show the right fields per type. No generic "API key" field for everything.

| Integration | UI Auth Flow | Fields to Show | Doc Link |
|-------------|-------------|----------------|----------|
| `shopify` | OAuth redirect (install flow via shopify.oauth.js) | Auto-filled after OAuth. Show: shop domain (read-only), connected status, agent assignment | [Shopify OAuth](https://shopify.dev/docs/apps/auth/oauth) |
| `twilio` | Form (paste credentials) | Account SID, Auth Token (masked), Phone Number | [Twilio Console](https://console.twilio.com) |
| `calcom` | Form (API key) | API Key (masked), Base URL (optional for self-hosted), Event Type ID | [Cal.com API Keys](https://app.cal.com/settings/developer/api-keys) |
| `google_cal` | OAuth redirect (Google) | Calendar picker (after OAuth) | [Google OAuth](https://console.cloud.google.com) |
| `outlook_cal` | OAuth redirect (Microsoft) | Calendar picker (after OAuth) | [Azure App Registration](https://portal.azure.com) |
| `hubspot` | OAuth redirect OR Private App key form | If API key: paste token (masked). If OAuth: redirect | [HubSpot Private Apps](https://developers.hubspot.com/docs/api/private-apps) |
| `zapier` | Form (webhook URL + secret) | Zap webhook URL (from Zapier), Hook secret (auto-generate) | [Zapier Webhooks](https://zapier.com/apps/webhook) |

**UX Rule:** never show auth_token / api_key in plain text after save. Show `••••••••[last4]` with a "Reconnect" button to re-enter.

---

## Part 7 — Bulletproof Webhook Handling Rules

Every incoming webhook must pass ALL of these before touching the DB:

```
1. Signature verification     → 401 if fails (already done for all providers ✅)
2. Idempotency check          → logWebhookEvent() dedup (already done ✅)
3. JSON parse with try/catch  → 400 if invalid (already done ✅)
4. Payload field presence     → validate required fields before DB ops
5. Max response time < 5s     → heavy work in background job / queue
6. Always return 200 to Shopify/Twilio even on handler error  → prevents retry storm
7. DLQ on handler error       → webhook_dlq table exists, use it for all failures
```

**Current violations:**

| Webhook | Issue |
|---------|-------|
| `/webhooks/shopify/orders` | No handler — returns 200 as no-op (acceptable temporarily, document it) |
| `/webhooks/shopify/customers` | Same |
| `/webhooks/stripe` | `stripe.subscriptions.retrieve` inside handler = sync API call blocking 5s response window |
| `/webhooks/twilio/voice` | `blocked_rate` + `blocked_spend` paths insert `call_events` without `call_id` (FK null) |

**Fix for Stripe blocking call:**
```javascript
// DO NOT await synchronous Stripe API calls inside webhook handler
// Instead: use the subscription data already in the webhook event object
// Stripe sends the full subscription in checkout.session.completed → obj.subscription expanded
// OR: queue a background job to fetch + process
```

---

## Updated Priority Queue (All Issues)

| ID | Sev | File | Issue | Week |
|----|-----|------|-------|------|
| IG-001 | 🔴 | `integration.service.js` | 5 of 7 providers crash `buildProvider()` | 1 |
| IG-002 | 🔴 | `shopify.provider.js` | `/checkouts.json` removed in API 2024-10 | 1 |
| IG-003 | 🔴 | `stripe.handler.js` | Missing DB columns (`plan_tier_key`, `last_reported_overage_minutes`) | 1 |
| IG-010 | 🔴 | `integration.routes.js` PUT | Stores secrets in plain JSONB — need vault pattern | 1 |
| IG-011 | 🔴 | All OAuth integrations | No token refresh logic — Google/Outlook/HubSpot break after 1hr | 1 |
| IG-004 | 🟠 | `shopify.provider.js` | `marketing_consent` → `email_marketing_consent` | 2 |
| IG-005 | 🟠 | `shopify.provider.js` | `usage_count` (read-only) → fix discount code creation | 2 |
| IG-006 | 🟠 | `webhook.routes.js` | Stripe `apiVersion` outdated | 2 (post billing migration) |
| IG-007 | 🟠 | `elevenlabs.handler.js` | `recording_url` auth-gated — break public playback | 2 |
| IG-012 | 🟠 | `webhook.routes.js` | `/twilio/voice` blocked paths insert `call_events` without `call_id` | 2 |
| IG-013 | 🟠 | `stripe.handler.js` | Sync Stripe API call inside webhook handler blocks response | 2 |
| IG-008 | 🟡 | `hubspot.provider.js` | Fake `testConnection`, stub `syncContacts` | 3 |
| IG-009 | 🟡 | `webhook.routes.js` | `/shopify/orders` + `/shopify/customers` no-op stubs | 3 |
| IG-014 | 🟡 | `agent.tools` | Tool calls have no org-scoped credential injection | 3 |
| IG-015 | 🟡 | None exists | No `tools/` module — agent tool proxies not implemented | 3 |

---

*Last updated: 2026-06-29 | Part 2-7 added — credential schemas, vault pattern, OAuth refresh, tool proxy arch, bulletproof webhook rules*
