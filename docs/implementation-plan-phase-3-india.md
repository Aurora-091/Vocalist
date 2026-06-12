# Phase 3 — India Telephony Implementation Plan

> **Status:** FUTURE — not yet in development
> **Prerequisites:** Phase 1-2 complete, ElevenLabs grant decision received
> **Estimated effort:** 4-6 weeks (1 developer)

---

## Overview

The `VoiceProvider` seam already exists. This plan adds Plivo as bundled India telephony and Exotel/Plivo as BYO options.

---

## Part 1 — Plivo as Bundled India Provider

### Key API Differences from Twilio

| | Twilio | Plivo |
|---|---|---|
| Auth | AccountSid + AuthToken | Auth ID + Auth Token |
| Subaccount create | `POST /2010-04-01/Accounts` | `POST /v1/Account/{auth_id}/Subaccount` |
| Outbound call | `POST /Accounts/{Sid}/Calls` | `POST /v1/Account/{auth_id}/Call` |
| Status callback | `StatusCallback` param | `answer_url` + `hangup_url` |
| Phone number buy | `POST /IncomingPhoneNumbers` | `POST /v1/Account/{auth_id}/PhoneNumber` |
| Per-min cost India | ~$0.014 | ~$0.005-0.008 |
| Subaccounts | Yes | Yes |

### Schema Changes

```sql
ALTER TABLE phone_numbers
  ADD COLUMN IF NOT EXISTS telephony_provider
    text CHECK (telephony_provider IN ('twilio','plivo','exotel','byo_twilio','byo_plivo','byo_exotel'))
    DEFAULT 'twilio';

ALTER TABLE orgs
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS telephony_region text
    CHECK (telephony_region IN ('global','india'))
    DEFAULT 'global';
```

### Environment Variables

```
PLIVO_AUTH_ID=
PLIVO_AUTH_TOKEN=
PLIVO_REGION=india
VOICE_PROVIDER_INDIA=plivo
```

### New Files

- `backend/src/providers/telephony/plivo.provider.js` — Plivo client wrapper
- `backend/src/providers/telephony/exotel.provider.js` — Exotel BYO client
- `backend/src/providers/telephony/factory.js` — Routes by region (global=Twilio, india=Plivo)
- `backend/src/modules/webhooks/handlers/plivo.handler.js` — answer_url + hangup_url handlers

### TRAI Compliance (Non-Negotiable for India Outbound)

1. **140-series numbers only** — All outbound commercial calls must use 140-prefix numbers
2. **Calling hours: 9am-9pm IST** — TRAI mandate (existing gate adapts from 9-7 to 9-9)
3. **DND/NDNC scrubbing** — Plivo handles automatically for India numbers; log explicitly

---

## Part 2 — BYO India (Exotel + Plivo)

### Flow

```
Tenant signs up
  -> Onboarding: "Connect your telephony"
  -> Choose: Exotel / Plivo / Other
  -> Enter API credentials
  -> Aurora validates credentials (test account endpoint)
  -> Aurora routes calls through tenant's account
  -> Tenant pays their provider directly
  -> Aurora charges AI-only pricing (BYO tier)
```

### Validation Endpoint

`POST /v1/integrations/telephony/validate`

- Accepts: `{ provider, authId, authToken, accountSid? }`
- Tests credentials by fetching account details
- Stores encrypted in Vault (`byo_telephony:{org_id}`)
- Updates org telephony settings

---

## Part 3 — Pricing Implementation

When `org.telephony_region = 'india'` at billing time, apply INR pricing from plan_tiers. Stripe supports INR natively — create separate price objects for each India tier.

---

## Part 4 — Timeline

| Week | Task |
|---|---|
| 1 | Schema migrations, PlivoProvider skeleton, TelephonyFactory |
| 2 | Plivo subaccount provisioning, number purchase, outbound call |
| 3 | Plivo webhook handlers, admission gate for India, TRAI compliance |
| 4 | BYO UI, validation endpoint, Exotel + Plivo BYO providers |
| 5 | India pricing in Stripe (INR), billing config |
| 6 | Testing with first India pilot, fix edge cases |

---

## Part 5 — What This Unlocks

- First paying Indian customer
- BYO Exotel opens to every Indian SMB already using Exotel
- INR pricing removes biggest adoption barrier
- TRAI compliance built-in from day one
- Plivo subaccounts keep multi-tenant architecture clean
