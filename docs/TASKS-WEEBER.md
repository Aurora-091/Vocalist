# TASKS — Weeber backend (Vocalist repo)
**Owner: Ashutosh · Est. total: ~4 days · Supersedes Part A execution order in weeber-shopify-agents-gap-report.md where noted.**

## What changed vs the earlier gap report
- **G0 (webhook registration): DROPPED** — solved by webbersh's `shopify.app.toml`. Zero work here.
- **G1 (log-only routes): RESHAPED** — do NOT wire the old `/webhooks/shopify/*` HMAC routes. webbersh forwards with `X-Weeber-Secret`, not Shopify HMAC, and to different paths. Build V1 below instead; mark the old HMAC routes deprecated (delete after one clean week — they're dead code once V1 lands).
- **G9 (GDPR): HALVED** — webbersh has the routes; you only build the receiving endpoints (in V1).
- Everything else from the report stands: G2–G5, G7, G8, web test call, U1/U3.

## V1 · Internal S2S router — the contract's backend half (~half day) — DO FIRST
New file `backend/src/modules/integrations/shopify.internal.routes.js`, mounted in `app.js` at `/api/integrations/shopify`, every route behind `verifyInternalSecret` (already exists in `shopify.oauth.js`). Routes per CONTRACT.md:
- `POST /webhooks/checkouts` → resolve integration by `shop` → `provider._handleCheckoutEvent(body)` (topic-aware: create vs update for G7)
- `POST /orders/create` → `provider._handleOrderEvent(payload)` (V2 logic)
- `POST /orders/fulfilled` → schedule feedback call per playbook (V5)
- `POST /webhooks/customers` → `provider._handleCustomerEvent(body)` (this un-deadens your existing contact-sync code)
- `POST /uninstalled` → reuse `handleUninstalled` + cancel pending scheduled_calls + purge token (extends current handler)
- `POST /customers/redact`, `POST /shop/redact` → delete/anonymize contacts + call metadata for that shop's org
Migrate the special-cased `/connected` handler from `app.js:106` into this router so all S2S lives in one file.
**Idempotency:** checkouts keyed on `body.token` (dedupe exists — keep), orders on `order_id` (add `processed_shopify_events` check or an upsert-style guard).

## V2 · Conversion-cancel + attribution (G2, ~1 day) — the demo-killer fix + the pitch metric
Migration on `scheduled_calls`: `checkout_token text`, `attempt int default 1`, `outcome text`, `recovered_order_id text`, `recovered_value numeric`, `recovered_currency text`, `cancelled_reason text`. Store `checkout_token` (Shopify checkout `token`) at scheduling time.
`_handleOrderEvent`: (a) cancel pending rows matching `checkout_token` OR normalized phone → `cancelled_converted`; (b) attribution — completed call to same phone in last 72h → `outcome='recovered'` + order value; (c) COD branch — if `payment_gateway_names` includes cod → insert COD-confirmation scheduled call per playbook (delay ~5 min, agent from playbook). Code sketch already in the gap report §G2.
Dashboard: "₹ recovered this month" stat card (sum `recovered_value` where recovered, current month) on Dashboard.tsx.

## V3 · E.164 normalization (G5, ~2 hrs) — India launch-critical
Replace all four `phone.replace(/[^\d+]/g,"")` sites in `shopify.provider.js` with `toE164(phone, integration.config.country_code || "IN")` from `utils/phone.js`. The `country_code` now arrives in the `/connected` payload — ensure `handleConnected` persists it into integration config. Log + skip rows that still fail (surface count to merchant later).

## V4 · Retry ladder + quiet hours (G3+G4, ~1 day)
- Post-call webhook handler: on `no_answer|busy|voicemail` and `attempt < playbook.max_attempts` → insert retry row (`attempt+1`, `scheduled_at = now + retry_gap`, same metadata/token). Hard cap 3 total attempts.
- `clampToQuietHours(date, playbook)` using `quiet_hours_start/end` + `timezone` (timezone also arrives from `/connected` — default Asia/Kolkata). Apply at insert time in `_handleCheckoutEvent`, COD branch, feedback scheduling, and retry inserts. NOT in the worker.
- Checkout `update` topic: if pending row exists → refresh metadata + reset `scheduled_at` (customer still editing ≠ abandoned) — this is G7, ~10 lines inside the same handler.

## V5 · Playbooks table + feedback agent (G8, ~1 day)
`playbooks`: `org_id, key ('cart_recovery'|'cod_confirm'|'feedback'), enabled bool, agent_id, config jsonb, version int`. Config JSON per the flow schema (delay, max_attempts, retry_gap, quiet_hours, key-specific extras: discount toggle / cod detection mode / feedback delay_days + review_ask).
- Handlers read their playbook instead of `integrations.call_delay_minutes/max_attempts` (keep those columns as fallback for one release).
- Seed migration: feedback agent preset (prompt: verify delivery, capture 1–5 rating + verbatim, if 4–5 ask consent to share as review; keep under 90 seconds; tools: none required v1 — outcome captured via post-call analysis). Reuse the seed format from `20260610192802_seed_shopify_agent_presets.sql`.
- Settings UI: three playbook cards (toggle + delay + retries + quiet hours + agent picker). Plain form, no canvas.

## V6 · Web test call (~1.5 days) — after the pipeline works
Per gap report Part C: `POST /v1/agents/:id/web-session` (org check → `can_spend` → ElevenLabs signed-URL via org credentials → return), rate-limit 10/hr/org, 5-min session cap. Frontend: `@elevenlabs/react` modal, "Test in browser" primary on AgentDetail + final onboarding step. Tag conversations `channel: web_test`, exclude from attribution. Instrument PostHog: activation, time-to-first-conversation, tests/agent/week.

## V7 · If time remains: U1 variables panel (~1 day), U3 template gallery on AgentsList (~0.5 day)

## Sequencing with the webbersh dev (parallel-safe)
- **Day 1 AM:** both read CONTRACT.md. You build V1; they do T9 (file protected-data request) + T1–T3.
- **Day 1 PM:** joint smoke test — dev store install → `/connected` 200; abandoned checkout → row in `scheduled_calls`. First end-to-end proof.
- **Day 2:** you V2+V3; they T4–T8. Evening: run the full Definition-of-done checklist from TASKS-WEEBERSH.md together.
- **Day 3:** you V4+V5. webbersh dev is done — hand them QA on the dev store (all three playbooks) or U3.
- **Day 4:** V6 web test call. Ship.
Interface discipline: **neither person edits the other's repo.** Any payload/path change goes through CONTRACT.md version bump first.
