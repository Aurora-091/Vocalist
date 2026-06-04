# Implementation Plan — Vapi + Twilio integration & Aurora billing

**Status:** **DEFERRED to Phase 4** (post-seed). Kept as the audit-trail of analysis and as the reference for the eventual cost-optimisation swap.
**Active plan for Phase 1:** [`implementation-plan-elevenlabs-twilio.md`](./implementation-plan-elevenlabs-twilio.md)
**Owner:** Backend team · **Updated:** 2026-06-04

> **Why deferred:** Aurora is a no-code product where customers never bring API keys, and we are pre-seed. The engineering velocity of pre-built agent runtime + KB + voice library (ElevenLabs CAI) beats the ~15% per-minute cost optimisation of Vapi-with-BYO during the runway-extension phase. The ElevenLabs Startup Grant (33M characters / 12 months) further tilts the math. We keep the Vapi provider code in the repo, compiled and tested, behind the same `VoiceProvider` abstraction — flipping back is a one-line factory change plus a data migration. See `implementation-plan-elevenlabs-twilio.md` §15.

---

## 0. Why this exists

Two things are not where v1 needs them:

1. **The Vapi + Twilio integration is half-wired.** Outbound dialing through Vapi works and Twilio subaccount provisioning works, but:
   - The Twilio inbound webhook just plays a static greeting and never bridges into Vapi.
   - There is no automation to create a Vapi assistant when an Aurora agent is created.
   - There are **two `vapi.provider.js` files** in two different folders; the worker uses one, `call.service` uses the other.
   - Voicemail-drop is a stub.
   - We never pull final `cost` / `costBreakdown` from Vapi, so our `usage_ledger` only counts minutes — not what the call actually cost us.

2. **Aurora has no defensible billing model.** `usage_ledger` records minutes per call (good, idempotent) and Stripe `checkout.session` works for subscriptions. But:
   - We never push **meter events** to Stripe, so overage doesn't actually bill.
   - No tier gating (`plan_tiers` exists in the schema, no enforcement).
   - No reconciliation between Aurora's ledger and Stripe's meter event summary.
   - No spend guardrails on the Twilio side per tenant, which is how you bankrupt a SaaS in one weekend.

This plan fixes both, anchored to the **lowest-cost stack we can ship without losing voice quality** and a **margin we can actually defend**.

---

## 1. Cost research — 2026 numbers

All prices below are US, public list-rate, June 2026. Sources: Vapi pricing page, Twilio Programmable Voice + SIP Trunking pricing pages, Deepgram, ElevenLabs, Cartesia, OpenAI.

### 1.1 Vapi — orchestrator + pass-through

| Line item | Cost | Notes |
|---|---|---|
| Vapi platform fee | **$0.05 / min** | flat orchestration fee, no markup on anything else if you BYO keys |
| Concurrency over 10 lines | **$10 / line / month** | only matters at scale |
| Model passthrough (STT/LLM/TTS) | **$0 with BYO keys**, otherwise at-cost | Vapi explicitly takes no margin |
| HIPAA add-on | $2,000 / mo | **skip for v1** |
| Zero-Data-Retention add-on | $1,000 / mo | **skip for v1** |
| Data retention (free) | 14 days call history, 30 days chat | enough for v1; we mirror to our DB anyway |

**Crucial fact:** Vapi's BYOK is per provider — once you add your OpenAI / Deepgram / ElevenLabs keys in `dashboard.vapi.ai/keys`, Vapi stops charging for that layer and you get billed by the provider directly. This is the only way to hit the cheap floor.

### 1.2 Twilio — telephony

| Line item | Programmable Voice (US) | Elastic SIP Trunking (US) |
|---|---|---|
| Outbound (US-48) | $0.0140 / min | **$0.0100 / min** |
| Inbound, local DID | $0.0085 / min | $0.0034 / min (origination) |
| Inbound, toll-free | $0.0220 / min | $0.0011 / min (origination) |
| Local DID rental | $1.15 / mo | $1.15 / mo |
| Toll-free DID rental | $2.15 / mo | $2.15 / mo |
| Recording (processing) | $0.0025 / min | same |
| Recording storage | free first 10K min/mo, then $0.0005 / min / mo | same |
| Volume break | tiered down at 100K/1M/10M+ min/mo | similar tiering |

**Insight:** Elastic SIP Trunking is **~30–60% cheaper per minute** than Programmable Voice for the same call. Because we don't need TwiML — Vapi is doing the voice logic — we should use **Programmable Voice for v1 (simpler webhook story)** and **migrate to SIP Trunking + Vapi SIP termination in Phase 2** to claw back a few cents/min once volume justifies the operational complexity.

**Spend safety:** Twilio exposes a `UsageTrigger` REST endpoint (POST `/Accounts/{Sid}/Usage/Triggers.json`) that fires a webhook when a category's `count` / `usage` / `price` crosses a threshold daily/monthly. We will set one **per subaccount** to cap each tenant.

### 1.3 STT / LLM / TTS — what to pick

Cost estimates assume an average 150 spoken words/min ≈ 750 characters/min of TTS output. Real-call mileage varies ±20%.

| Layer | Provider / Model | Cost | Per-minute equivalent | Notes |
|---|---|---|---|---|
| STT | **Deepgram Nova-3** | $0.0043 / min | $0.0043 | best $/min, low latency, multilingual |
| LLM (cheap) | **OpenAI GPT-4o-mini** | ~$0.01–0.02 / min conversation | $0.015 | default for v1 |
| LLM (premium) | **Claude Sonnet 4 or GPT-4o** | ~$0.06–0.12 / min | $0.08 | optional per agent |
| TTS (cheap) | **Deepgram Aura-2** | $0.030 / 1K char | **$0.0045 / min** | cheapest production-grade |
| TTS (default) | **ElevenLabs Flash v2.5** | $60 / 1M char | **$0.009 / min** | best quality-for-price, ~288ms TTFA |
| TTS (premium) | **ElevenLabs Multilingual v2** | $120 / 1M char | $0.018 / min | only for premium tiers — 1.2s TTFA is borderline for real-time |

### 1.4 Three landed-cost stacks for Aurora

| Stack | Components | Inbound (US local) | Outbound (US-48) |
|---|---|---|---|
| **Floor** | Vapi + Nova-3 + GPT-4o-mini + Aura-2 + Twilio PV | $0.05 + $0.0043 + $0.015 + $0.0045 + $0.0085 = **$0.082 / min** | swap inbound for outbound: **$0.088 / min** |
| **Default** | same but TTS = ElevenLabs Flash v2.5 | **$0.087 / min** | **$0.092 / min** |
| **Premium** | GPT-4o + Eleven Multilingual v2 + Nova-3 + Twilio PV | **$0.16 / min** | **$0.17 / min** |

Add **recording $0.0025/min + storage** to anything we record (we record by default for compliance/QA → call this a flat **+$0.003/min** worst case for 90-day retention).

**Cost ceiling we will design to:** **$0.10 / min landed for the Default stack**, **$0.20 / min for Premium**.

---

## 2. Aurora pricing — the strategy

The whole point of being on top of Vapi is that we sell **outcomes and operations** (campaigns, integrations, consent, analytics), not minutes. Minute pricing exists to keep us cash-positive and meter abusers.

### 2.1 Plan tiers (proposed; `plan_tiers` table already exists)

| Tier | Monthly | Included minutes | Overage / min | Concurrency | Notes |
|---|---|---|---|---|---|
| **Trial** | free | 25 min total | n/a (hard-stop at 25) | 1 | 14 days, then auto-downgrade to Starter or pause |
| **Starter** | $99 | 200 | **$0.25** | 2 | Default stack only, 1 number |
| **Growth** | $399 | 1,000 | **$0.22** | 5 | Default or Premium per agent, ≤3 numbers |
| **Scale** | $1,499 | 5,000 | **$0.18** | 25 | + Premium stack on every agent, unlimited numbers, BYO Twilio supported |
| **Enterprise** | custom | custom | custom | custom | HIPAA, BYO LLM keys, SSO, custom retention |

**Margin math at the Default stack ($0.092/min landed):**

| Tier | Effective price / min (incl + overage blend at 1.5× included) | Margin |
|---|---|---|
| Starter at 300 min (100 over) | ($99 + 100 × $0.25) / 300 = **$0.413** | **+349%** |
| Growth at 1,500 min (500 over) | ($399 + 500 × $0.22) / 1,500 = **$0.339** | **+268%** |
| Scale at 7,500 min (2,500 over) | ($1,499 + 2,500 × $0.18) / 7,500 = **$0.260** | **+183%** |
| **Edge case:** Starter user uses exactly 200 min | $99 / 200 = $0.495 | **+438%** |
| **Edge case:** Scale user uses exactly 5,000 min | $1,499 / 5,000 = $0.300 | **+226%** |

Floor margin is ~180% on Scale even before considering that overage is the most likely state. This is healthy for v1.

### 2.2 What we charge for, what we eat

| Cost line | Who pays | Why |
|---|---|---|
| Vapi platform $0.05/min | Aurora | always |
| LLM / STT / TTS | Aurora | always — keep BYO keys hidden from customer in v1 |
| Twilio voice minutes | Aurora (managed path) / customer (BYO Twilio at Scale+) | managed subaccount default |
| Twilio number rental | Aurora bills $5/mo per local number, $9/mo per toll-free — surfaces in `usage_alerts` | covers $1.15/$2.15 with comfortable margin |
| Recording storage past 30 days | Aurora pre-90 days; charge $0.01/min/mo past 90 (premium retention) | aligns with capability §14 retention SLA |
| Voicemail-drop audio storage | Aurora | trivial cost, included |

### 2.3 Spend guards (the thing that prevents a $50K mistake)

Three layers, each a hard cap:

1. **Per-tenant Twilio UsageTrigger.** On subaccount creation, register a daily `price` trigger at `tier.daily_price_cap` (e.g. Starter = $25/day). Webhook → suspend tenant's subaccount via `subaccount.update({status:'suspended'})` and surface a `usage_alerts` row.
2. **Aurora-side ledger gate.** Before `claim_dial_targets()` returns leases, an RPC `dial_allowed(org)` checks `usage_ledger` MTD against `plan_tiers.hard_cap_minutes` (= 5× included). Over cap → suppresses new dials with reason `quota_exhausted`, doesn't kill in-flight calls.
3. **Stripe customer-balance check.** On every `customer.subscription.updated` webhook, if `latest_invoice.status='past_due' > 7 days`, flip `orgs.status='past_due'` → API rejects new calls but keeps reads working.

---

## 3. Architecture changes

### 3.1 Consolidate the voice provider abstraction

**Problem:** `backend/src/providers/voice/*.js` (used by `dialer.worker`) and `backend/src/services/providers/*.js` (used by `call.service` + `agent.service`) are two parallel implementations of the same `VoiceProvider` interface. They drifted during the bolt merge.

**Decision:** **`backend/src/providers/voice/` wins** (matches the docs and `fileStrucute.md` plan; it's already where the workers live). Delete `backend/src/services/providers/`. Merge the richer pieces from `services/providers/vapi.provider.js` (the `createAgent` / `updateAgent` methods) into `providers/voice/vapi.provider.js`.

**Interface (final shape):**

```js
class VoiceProvider {
  static get name()                                // "vapi" | "retell" | "pipecat"
  constructor(config, { orgId, agent })            // org-scoped instance
  async createAssistant(agent, systemPrompt)       // returns { providerRef, raw }
  async updateAssistant(providerRef, agent, systemPrompt)
  async deleteAssistant(providerRef)
  async attachPhoneNumber(providerRef, twilioNumber, twilioCreds)  // imports number into provider
  async startCall({ toE164, fromE164, leaseToken, metadata })      // outbound
  async endCall(providerCallId)
  async dropVoicemail({ providerCallId, audioUrl })
  async fetchCallCost(providerCallId)              // deferred cost lookup, returns { totalUsd, breakdown }
}
```

`agent.service` and `dialer.worker` both route through `providers/voice/factory.js → getProvider(name)`.

### 3.2 Vapi assistant lifecycle wired into agent.service

Today `agents.routes` writes the row to the DB and the dialer fails because `agent.provider_ref` is null. Fix:

1. **`POST /v1/agents`** → DB insert → `provider = getProvider(payload.provider)` → `await provider.createAssistant(agent, generateSystemPrompt(agent.persona))` → write returned `providerRef` back into `agents.provider_ref`. If the provider call fails, soft-delete the agent row and return 502 — no half-created agents.
2. **`PATCH /v1/agents/:id` or `PATCH /v1/agents/:id/persona`** → if `provider_ref` set, also `provider.updateAssistant(...)`. Persona/system-prompt changes propagate.
3. **`DELETE /v1/agents/:id`** (soft) → `provider.deleteAssistant(provider_ref).catch(log)` — best-effort, doesn't block soft-delete.
4. **`POST /v1/agents/:id/voice`** → already updates `voice_id`; also push to provider.

The actual Vapi API: `POST https://api.vapi.ai/assistant` with `{ name, model, voice, transcriber, firstMessage, serverUrl: ${env.PUBLIC_BASE_URL}/webhooks/vapi }`. The `serverUrl` is critical — that's where Vapi POSTs events back, and we already have the handler.

### 3.3 Twilio ↔ Vapi number binding (fix inbound)

**Replace the static-greeting TwiML inbound webhook.** Two options, pick #1 for v1:

**Option 1 (recommended for v1): Vapi imports the Twilio number directly.** When a tenant claims a number via our `POST /v1/numbers/purchase`, immediately after the Twilio purchase succeeds we call:

```
POST https://api.vapi.ai/phone-number
{
  "provider": "twilio",
  "number": "+1234567890",
  "twilioAccountSid": <subaccount SID>,
  "twilioAuthToken": <subaccount auth token from vault>,
  "assistantId": <agent.provider_ref>,
  "serverUrl": "${PUBLIC_BASE_URL}/webhooks/vapi",
  "name": "${org.name} / ${agent.name}"
}
```

Vapi automatically rewrites the Twilio number's `voiceUrl` to point at its own ingest endpoint. Our `/webhooks/twilio/voice` becomes obsolete for these numbers — we can keep it as a 404 fallback for unbound numbers.

Save the returned `phoneNumberId` into `phone_numbers.provider_ref` so re-binding / delete is idempotent.

**Option 2 (Phase 2): TwiML `<Dial><Sip>` to a Vapi SIP URI.** Cheaper at scale because we can move to Twilio Elastic SIP Trunking ($0.0034/min vs $0.0085/min inbound). Defer until volume justifies the operational extra surface.

### 3.4 Real voicemail drop

Vapi exposes voicemail behavior on the assistant itself (`voicemailDetection: { provider: "twilio" | "vapi", machineDetectionTimeout }` + `voicemailMessage`). We:

1. Add `agents.voicemail_message text` column (migration).
2. On assistant create/update, set `voicemailDetection: { provider: "twilio" }` and `voicemailMessage: agent.voicemail_message || persona.voicemail_message`.
3. Remove the stub in `providers/voice/vapi.provider.js#dropVoicemail`.

Twilio's AMD (Answering Machine Detection) is the cost driver: **+$0.0075/min** for first 30 seconds, included after. Worth it because the alternative is wasting full LLM minutes talking to voicemail.

### 3.5 Cost capture from Vapi (the critical billing fix)

The end-of-call-report webhook has **stale cost data** — Vapi confirmed this on their support forum. The accurate path is: when we receive `end-of-call-report`, we enqueue a job to `GET https://api.vapi.ai/call/{id}` **30 seconds later** to pull the final cost + `costBreakdown` (STT, LLM, TTS, transport, vapi-platform line items).

Implementation:

- New worker: `backend/src/workers/call-cost-reconciler.worker.js` — polls a `call_cost_pending` queue table every 10s.
- Vapi handler enqueues `(call_id, provider_call_id)` with `not_before = now() + 30s`.
- Reconciler calls `provider.fetchCallCost(providerCallId)`, writes `calls.cost_usd` + `calls.cost_breakdown jsonb` (new column).
- Then triggers `metering.recordVoiceMinutes` (already idempotent on `idempotency_key = (provider_call_id, "voice_minutes")`).

### 3.6 Switch on BYO provider keys in Vapi

Once-per-environment setup, but tracked in the runbook:

- Add Aurora's OpenAI key to `dashboard.vapi.ai/keys`.
- Add Aurora's Deepgram key (STT + Aura-2 TTS).
- Add Aurora's ElevenLabs key (Flash v2.5).
- Verify each via Vapi's "validate" button.

After this, our `costBreakdown` from §3.5 shows non-zero only for the Vapi platform fee + Twilio + (anything we forgot to BYO). This is also our automated test for "did we forget to wire BYO keys".

---

## 4. Stripe metered billing — the safe pattern

### 4.1 Use Billing Meters (NOT legacy usage records)

Stripe deprecated usage-records in API `2025-03-31.basil`. Use **Billing Meters API** (current `2026-03-25.dahlia`).

```js
await stripe.billing.meterEvents.create({
  event_name: "aurora_voice_minutes",
  identifier: `vm_${orgId}_${providerCallId}`,   // dedup key (24h rolling)
  payload: {
    stripe_customer_id: org.stripe_customer_id,
    value: ceilToMinutes(call.duration_sec),
  },
  timestamp: call.ended_at,
});
```

Three meters total for v1:

| Meter `event_name` | Aggregation | Triggers from |
|---|---|---|
| `aurora_voice_minutes` | sum | every `usage_ledger` row of kind `voice_minutes` |
| `aurora_campaign_calls` | sum | every `usage_ledger` row of kind `campaign_call` |
| `aurora_overage_minutes` | sum | reconciliation job, when MTD > included |

The `identifier` is the **single most important field** — it dedups within 24h. We construct it deterministically from `(orgId, providerCallId, meter_name)` so retries never double-bill.

### 4.2 Three layers of idempotency

1. **`usage_ledger.unique(org_id, idempotency_key, occurred_at)`** — DB-level (already enforced by the existing schema).
2. **Stripe meter event `identifier`** — Stripe-level (24h dedup window).
3. **Daily reconciliation job** — application-level safety net (next section).

A row only gets pushed to Stripe **after** it lands in `usage_ledger`. We never push from the webhook directly — webhooks can fire 2–3× legitimately.

### 4.3 Reconciliation job (the non-negotiable)

New worker `backend/src/workers/billing-reconciler.worker.js`, runs daily at 02:00 UTC:

```js
// For each org with an active subscription:
const ledgerSum = sum(usage_ledger.quantity WHERE kind='voice_minutes' AND period BETWEEN start AND end)
const stripeSum = await stripe.billing.meters.eventSummaries.list({...})
                    .then(sumValues)
if (Math.abs(ledgerSum - stripeSum) / ledgerSum > 0.001) {  // 0.1% tolerance
  await notify.opsTeam({ orgId, ledgerSum, stripeSum, diff })
  await stripe.billing.meterEvents.create({  // catch-up event
    event_name: "aurora_voice_minutes",
    identifier: `recon_${orgId}_${period}`,
    payload: { value: ledgerSum - stripeSum, stripe_customer_id: ... }
  })
}
```

Mismatches trigger a Slack alert. We never silently swallow billing drift.

### 4.4 Customer-facing usage page must match Stripe

Today `Billing.tsx` reads `analytics_usage(period)` from our DB. We add:

- `GET /v1/billing/stripe-usage?period=2026-06` → proxies `stripe.billing.meters.eventSummaries.list`
- UI side-by-side: "Aurora records 1,234 min · Stripe billed 1,234 min · ✓ reconciled"
- If they disagree, show a yellow banner with link to support — never silently show only one number.

---

## 5. Implementation workstreams

These are ordered. **Each row can be a separate PR.** The "complexity" column is technical depth, not calendar time.

| # | Workstream | Files touched | Complexity | Unblocks |
|---|---|---|---|---|
| 1 | Consolidate voice providers into one folder | delete `backend/src/services/providers/`, merge into `backend/src/providers/voice/`, update 2 importers (`call.service`, `agent.service`) | shallow, 1 PR | everything downstream |
| 2 | Implement `VapiProvider.createAssistant/updateAssistant/deleteAssistant/attachPhoneNumber` | `providers/voice/vapi.provider.js`, +integration test | shallow, contained | provisioning |
| 3 | Wire agent lifecycle to provider | `modules/agents/agent.service.js` (already exists, needs to be the only writer; `agents.routes.js` becomes a thin controller) | medium — also closes the "thin controllers" tech debt | inbound works end-to-end |
| 4 | Number-binding flow (Vapi import after Twilio purchase) | `modules/numbers/numbers.routes.js`, `modules/twilio/twilio.routes.js`, new helper `services/vapiPhoneNumber.js` | medium | inbound works end-to-end |
| 5 | Voicemail support | new migration adds `agents.voicemail_message`, update `createAssistant` payload | shallow | campaign quality / capability §C |
| 6 | Cost reconciler worker + `calls.cost_breakdown` migration | new worker, new column, `webhooks/handlers/vapi.handler.js` enqueues | medium | accurate per-call cost |
| 7 | Stripe billing meters (replace any legacy usage_record code, add meter push to `billing-rollup.worker.js`) | `workers/billing-rollup.worker.js`, `modules/billing/metering.js`, new env `STRIPE_METER_*` | medium — careful with idempotency | overage actually bills |
| 8 | Daily reconciliation worker + ops alert | new worker, Slack/email notifier | shallow once §7 lands | safety net |
| 9 | Spend guards: per-tenant Twilio `UsageTrigger`, `dial_allowed()` RPC, `orgs.status` flip on past-due | migration for `dial_allowed`, hook in `twilio.client.getOrCreateSubaccount`, Stripe webhook handler in `webhooks/handlers/stripe.handler.js` | medium — touches several modules | prevents $50K weekend |
| 10 | Plan tier enforcement (`plan_tiers` reads turn into gates) | `middleware/plan-gate.middleware.js`, mount on `agents`/`campaigns`/`numbers` create routes | shallow | tier monetization |
| 11 | Billing UI: side-by-side ledger vs Stripe meter summary | `src/pages/Billing.tsx` (migrate to shadcn while we're there) | shallow | customer trust |
| 12 | Runbook: BYO keys setup in Vapi dashboard + secret rotation procedure | new `docs/runbooks/vapi-byo-keys.md` | shallow | ops + audit |

**Workstream 1 must merge first.** Everything else assumes one canonical `VoiceProvider`.

---

## 6. Database changes summarized

All additive, all backwards-compatible.

```sql
-- §3.4 — voicemail
alter table agents add column voicemail_message text;

-- §3.5 — cost capture
alter table calls add column cost_breakdown jsonb not null default '{}';

create table call_cost_pending (
  call_id uuid primary key references calls(id) on delete cascade,
  provider_call_id text not null,
  provider voice_provider not null,
  attempts int not null default 0,
  not_before timestamptz not null,
  last_error text,
  created_at timestamptz not null default now()
);

-- §3.3 — number binding
alter table phone_numbers add column vapi_phone_number_id text;
create unique index phone_numbers_vapi_uniq on phone_numbers(vapi_phone_number_id) where vapi_phone_number_id is not null;

-- §4.x — dial gate
create or replace function dial_allowed(p_org uuid) returns boolean language sql stable as $$
  select coalesce((
    select case
      when o.status = 'past_due' then false
      when (
        select coalesce(sum(quantity),0) from usage_ledger
         where org_id = p_org and kind = 'voice_minutes'
           and occurred_at >= date_trunc('month', now())
      ) >= coalesce(t.hard_cap_minutes, 999999) then false
      else true
    end
    from orgs o
    left join subscriptions s on s.org_id = o.id
    left join plan_tiers t on t.id = s.plan_id
    where o.id = p_org
  ), false);
$$;
```

Then update `claim_dial_targets()` to call `dial_allowed(p_org)` and skip orgs that return false (do not error — just don't lease).

---

## 7. Environment variables added

```
# Vapi
VAPI_API_KEY                       # used by createAssistant + fetchCallCost
VAPI_WEBHOOK_SECRET                # already used

# Stripe (already had STRIPE_SECRET_KEY)
STRIPE_METER_VOICE_MINUTES         # event_name registered in Stripe Dashboard
STRIPE_METER_CAMPAIGN_CALLS
STRIPE_METER_OVERAGE_MINUTES

# Public URL Vapi posts back to
PUBLIC_BASE_URL                    # e.g. https://api.aurora.app

# Ops alerting
OPS_ALERT_WEBHOOK_URL              # Slack incoming webhook
```

Existing `TWILIO_*`, `SUPABASE_*` stay as-is. Provider keys (OpenAI, Deepgram, ElevenLabs) **live in Vapi's dashboard, not in our env** — that's the BYO-via-Vapi pattern. Aurora never sees the per-call API costs except through Vapi's `costBreakdown`.

---

## 8. Acceptance criteria

A milestone counts as done when:

1. **Workstream 1–4 done:** Creating an agent in the UI provisions a Vapi assistant, purchasing a Twilio number binds it to that assistant, and a real inbound call to that number is answered by the Aurora agent (not a static greeting). Logged in `calls` with non-null `recording_url` and `transcript`.
2. **Workstream 5 done:** Voicemail-targeted outbound calls drop the configured message and transition the `campaign_target` to `VOICEMAIL` (and a retry is scheduled if within retry budget).
3. **Workstream 6 done:** Every call in `calls` has `cost_usd > 0` and `cost_breakdown.vapi_platform > 0` within 60s of `ended_at` — measured by a synthetic-call canary in staging.
4. **Workstream 7–8 done:** Sending 100 test calls in staging produces exactly 100 `usage_ledger` rows AND exactly 100 line items in the Stripe meter event summary; reconciler reports `diff = 0`. Re-running the same calls (duplicate webhooks) does NOT add additional rows on either side.
5. **Workstream 9 done:** A test tenant hitting `tier.daily_price_cap` is suspended within 90 seconds of crossing it; resuming after a manual override restores dialing.
6. **Workstream 10 done:** A Starter tenant cannot create a 4th phone number; the error is a friendly `403 plan_limit_exceeded` not a 500.
7. **Workstream 11 done:** `/billing` page shows matching Aurora-ledger and Stripe-meter numbers with a ✓; an artificial mismatch (forced by ops) shows a yellow reconciliation banner.

---

## 9. What we are explicitly NOT doing in this round

- ❌ **Elastic SIP Trunking migration.** Defer to Phase 2 once volume justifies the operational complexity. We document the migration path but stay on Programmable Voice.
- ❌ **Self-hosted Pipecat.** Phase 4 per the contract. The provider interface keeps the door open; nothing more.
- ❌ **HIPAA mode.** $2K/mo Vapi add-on + dedicated infra. Wait for the first qualified clinic deal.
- ❌ **Per-customer BYO LLM keys.** Plumbing exists in Vapi but adds support load. Only enable for Enterprise tier on request.
- ❌ **Stripe Connect / payouts.** No marketplace flows in v1. Direct billing only.
- ❌ **Premium TTS as default.** ElevenLabs Multilingual v2 is too slow (~1.2s TTFA) for real-time. Opt-in per agent via `agents.persona.tts_quality = "premium"`.

---

## 10. Risks and mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Vapi pricing changes after we publish tiers | medium | medium | Quarterly pricing review, `plan_tiers.cost_basis_per_min` column lets us see if any tier dropped below the cost ceiling |
| Vapi `costBreakdown` stays stale beyond 60s | low | medium | Reconciler retries with exponential backoff up to 1h; alerts after that |
| Twilio toll fraud on a fresh subaccount | low | high (could be $10K in hours) | §3 spend guards + Twilio fraud-response best practices + we only allow geographic regions tenant selected |
| Stripe meter event drops (rare but documented) | low | medium | §4.3 daily reconciliation catches everything within 24h |
| BYO key revoked in Vapi dashboard | low | high (calls fail silently) | Synthetic canary call every 15 min in production; failure pages on-call |
| Concurrency limit hit on Vapi default 10 lines | medium at scale | medium | Auto-upgrade trigger: if any 5-minute window exceeds 8 concurrent calls → buy +10 lines ($10/mo) and Slack ops |

---

## 11. Open questions (decide before workstream 7 ships)

1. Do we want overage to be **automatic** or **manual approval** for Starter/Growth? (Recommendation: automatic, with a single "set monthly cap" knob in `/billing`.)
2. Toll-free vs local default for new numbers? (Recommendation: local — cheaper, no STIR/SHAKEN attestation overhead in v1.)
3. Recording retention: default 90 days as the contract says, or 30 with a paid upgrade? (Recommendation: 30 free, 90 on Growth+, 1yr on Scale.)
4. Do we want `aurora_voice_minutes` priced **per-second** or **rounded up to the minute**? (Recommendation: per-second to Stripe, rounded display in UI — fairer to customers, no revenue impact at scale.)
5. EU launch needs a separate Vapi tenant + Twilio EU subaccount + €/min meter. Out of v1 scope — flag for Phase 2.

---

## 12. References

- Vapi pricing: <https://vapi.ai/pricing>
- Vapi provider keys (BYOK): <https://docs.vapi.ai/customization/provider-keys>
- Vapi data flow / BYOK matrix: <https://docs.vapi.ai/security-and-privacy/data-flow.mdx>
- Vapi end-of-call-report (stale cost note): <https://vapi.ai/community/m/1216910407114031276>
- Vapi import Twilio number: <https://docs.vapi.ai/phone-numbers/import-twilio>
- Twilio Programmable Voice pricing (US): <https://www.twilio.com/en-us/voice/pricing/us>
- Twilio Elastic SIP Trunking pricing (US): <https://www.twilio.com/en-us/sip-trunking/pricing/us>
- Twilio `UsageTrigger` API: <https://www.twilio.com/docs/usage/api/usage-trigger>
- Stripe Billing Meters: <https://docs.stripe.com/billing/subscriptions/usage-based/implementation-guide.md>
- Stripe Meter Events API (idempotency): <https://docs.stripe.com/api/billing/meter-event>
- Stripe legacy → meters migration: <https://docs.stripe.com/billing/subscriptions/usage-based-legacy/migration-guide>
