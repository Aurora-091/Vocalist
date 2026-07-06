# CONTRACT.md — webbersh ⇄ Weeber Backend (Vocalist)
**Version 1.0 · 2026-07-05 · Copy this file into BOTH repos. Any change requires bumping the version and updating both copies.**

## Transport
- Base URL: `https://api.weeber.ai`
- All requests: `POST`, `Content-Type: application/json`
- **Auth: every request carries header `X-Weeber-Secret: ${WEEBER_INTERNAL_SECRET}`** (same value in both repos' env). Backend rejects missing/wrong secret with 401.
- Delivery: at-least-once (Shopify retries + webbersh retries). **Every endpoint must be idempotent.**
- webbersh always returns 200 to Shopify regardless of forward success (log failures; never trigger Shopify's retry storm for our internal errors) — except auth failures from `authenticate.webhook`, which Remix handles.

## Endpoints (all under `/api/integrations/shopify`)

### 1. `POST /connected` — OAuth completion ✅ exists
```json
{ "shop": "x.myshopify.com", "access_token": "...", "scopes": "read_orders,...",
  "org_id": "uuid|null", "plan_name": "...", "currency": "INR",
  "country_code": "IN", "timezone": "Asia/Kolkata", "contact_email": "...",
  "shop_name": "...", "shop_domain": "...", "product_count": 0,
  "order_count_30d": 0, "checkout_count": 0, "customer_count": 0 }
```

### 2. `POST /webhooks/checkouts` — checkout created/updated 🆕 backend
```json
{ "shop": "x.myshopify.com", "topic": "checkouts/create" | "checkouts/update",
  "body": { /* full Shopify checkout payload, incl. token, phone, line_items,
               total_price, abandoned_checkout_url, billing_address */ } }
```
Backend behavior: create/update the scheduled recovery call. Idempotency key: `body.token`.

### 3. `POST /orders/create` — order placed 🆕 backend
```json
{ "shop": "x.myshopify.com", "order_id": 123, "order_number": 1001,
  "checkout_token": "abc|null", "email": "...|null", "phone": "...|null",
  "total_price": "1499.00", "currency": "INR", "financial_status": "pending",
  "payment_gateway_names": ["cash_on_delivery"],
  "customer_name": "First Last|null",
  "shipping_address": { "city": "...", "province": "...", "country": "...", "phone": "...|null" },
  "line_items": [{ "title": "...", "quantity": 1, "price": "..." }],
  "created_at": "ISO" }
```
Backend behavior: (a) cancel pending recovery calls matching `checkout_token` or `phone`;
(b) attribution — mark a completed call in last 72h as `recovered` with order value;
(c) if COD (gateway includes `cash_on_delivery` / `cod`, or financial_status `pending` per playbook config) → schedule COD confirmation call. Idempotency key: `order_id`.

### 4. `POST /orders/fulfilled` — order fulfilled 🆕 both sides
```json
{ "shop": "...", "order_id": 123, "order_number": 1001, "phone": "...|null",
  "email": "...|null", "customer_name": "...|null",
  "line_items": [{ "title": "...", "quantity": 1 }], "fulfilled_at": "ISO" }
```
Backend behavior: schedule feedback call per feedback playbook (delay days). Idempotency key: `order_id`.

### 5. `POST /webhooks/customers` — customer created/updated 🆕 backend
```json
{ "shop": "...", "topic": "customers/create" | "customers/update",
  "body": { /* full Shopify customer payload */ } }
```
Backend behavior: upsert contact (consent mapping from `marketing_consent`). Idempotent by `(org_id, e164)`.

### 6. `POST /uninstalled` — app uninstalled ⚠️ path+auth fix
```json
{ "shop": "x.myshopify.com" }
```
Backend behavior: integration → `disconnected`, cancel ALL pending shopify-playbook scheduled calls for the org, purge stored access token.

### 7. `POST /customers/redact` and `POST /shop/redact` — GDPR 🆕 both sides
```json
{ "shop": "...", "customer": { "id": 1, "email": "...", "phone": "..." } }   // customers/redact
{ "shop": "..." }                                                            // shop/redact
```
Backend behavior: delete/anonymize matching contacts + call metadata within 30 days (immediate is fine). Return 200.

## Environment
| Var | webbersh | Vocalist |
|---|---|---|
| `WEEBER_INTERNAL_SECRET` | required, fail loudly at boot if missing | required |
| Shopify API version | **2025-01 everywhere** (toml + weeber.server.js) | 2025-01 (already) |

## Change log
- 1.0 — initial contract. Endpoints 2,3,4,5,7 new on backend; 4,7 new on webbersh; 6 fixed on webbersh.
