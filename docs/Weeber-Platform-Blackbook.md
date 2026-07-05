# Weeber Platform — Product Blackbook

**Last updated:** June 16, 2026  
**Audience:** Engineering, Product, Founders, Investors

---

## 1. What Is Weeber?

Weeber (internal codename: Aurora) is a **no-code voice AI platform for SMBs**. It lets a business owner deploy a 24/7 AI voice agent in under 10 minutes — no engineering, no legal team, no call-center budget needed.

The agent can:

- **Answer inbound calls** around the clock (missed calls, after-hours)
- **Place outbound calls** triggered by events (abandoned cart, appointment reminder, no-show recovery)
- **Run bulk voice campaigns** to a contact list with full TCPA compliance enforced in the infrastructure

The problem it solves: 85% of SMBs miss calls. Each missed call is ~$200 in lost revenue. Existing solutions (Twilio, Retell, Vapi) require a developer and a compliance lawyer. Weeber removes both.

---

## 2. Who It's For

| Vertical | Primary Use Case | Measurable Outcome |
|---|---|---|
| Shopify / D2C | Cart recovery, order status, promos | 18–24% cart recovery avg |
| Clinic / Healthcare | Appointment reminders, no-show recovery, after-hours | 62% of calls outside hours handled |
| Local Services | Receptionist, booking, review collection | 3.2 hrs/day of owner time reclaimed |

**Phase 1 go-to-market** is exclusively Shopify merchants. Clinic is Phase 2. Horizontal expansion is Phase 3.

---

## 3. Business Model

| Tier | Monthly | Bundled Minutes | Overage/min | Numbers |
|---|---|---|---|---|
| Starter | $99 | 400 | $0.30 | 1 |
| Growth | $299 | 1,500 | $0.32 | 3 |
| Scale | $799 | 5,000 | $0.35 | 10 |

**COGS:** ~$0.14/min (US) = ElevenLabs + LLM + Twilio + headroom  
**Gross margin:** 46–56% on bundled minutes; overage is the margin engine  
**India pricing:** COGS-negative until ElevenLabs grant ($4K/12mo zeroes CAI cost)

Revenue layers (phased):
1. Tiered SaaS + metered overage (v1)
2. Outcome pricing: per-booking, per-recovered-cart (Phase 2)
3. Whitelabel + reseller (Phase 3)

---

## 4. Architecture Overview

```
Caller / Browser
       │
   Twilio DID
       │
  Express Admission Gate  ← rate check + spend guard (always runs before CAI)
       │
ElevenLabs CAI  ←──── VoiceProvider abstraction
       │
  Supabase DB  ←───── Row-Level Security on every table
       │
  Node/Express API  ←─ React/Vite frontend
```

**Non-negotiable architectural constraints:**

1. Every outbound dial must pass `can_dial()` at dial time — enforced in the dialer worker, not the UI
2. Inbound calls always route through the Express admission gate before reaching ElevenLabs. Native CAI number binding is explicitly banned (it would bypass spend/rate limits)
3. Consent and DNC ledgers are append-only — no UPDATE/DELETE permitted by DB trigger
4. RLS is enabled on every tenant table — no cross-org data read is possible
5. Secrets live in Vault/KMS references, never in plaintext columns
6. Usage billing reads from `usage_ledger`, never from COGS APIs

**Voice provider abstraction:**

```
VoiceProvider interface
├── ElevenLabsProvider   ← Phase 1 (active)
├── VapiProvider         ← compiled, inactive until Phase 4
├── RetellProvider       ← fallback option
└── PipecatProvider      ← Phase 4 (self-hosted, ~50% COGS reduction)
```

Swapping providers requires changing one factory line. This is a deliberate business moat — negotiation leverage with any single vendor.

---

## 5. Database Schema

### Core Tables

| Table | Purpose |
|---|---|
| `orgs` | Multi-tenant root. Every row is a customer account. |
| `users` | Org members with roles: owner / admin / ops |
| `agents` | AI voice agents. Each belongs to an org, synced to ElevenLabs CAI |
| `integrations` | OAuth / API key connections per org (Shopify, Cal.com, HubSpot, etc.) |
| `contacts` | Phone number addressbook. Has consent_status and DNC flag. |
| `campaigns` | Bulk outbound campaigns with schedule, concurrency, retry config |
| `campaign_targets` | One row per contact per campaign. State machine per target. |
| `calls` | Every conversation (inbound or outbound). Channel-agnostic. |
| `call_events` | Append-only event stream per call (partitioned by month) |
| `consent_events` | Append-only legal ledger of every consent grant/revoke/import |
| `dnc_list` | Do-not-call list. Populated automatically on opt-out. |
| `dialer_transitions` | Append-only state machine log for campaign targets |
| `webhook_events` | Idempotent webhook log (Twilio, Stripe, Shopify, etc.) |
| `subscriptions` | Stripe subscription state per org |
| `usage_ledger` | Append-only metered usage (voice minutes, overages) |
| `phone_numbers` | Phone numbers owned by org. BYO or Aurora-managed. |
| `knowledge_sources` | Documents / URLs uploaded to the agent's knowledge base |
| `plan_tiers` | Subscription plan definitions |

### Key Enums

| Enum | Values |
|---|---|
| `call_status` | queued / ringing / in_progress / completed / failed / no_answer / busy / voicemail / canceled |
| `campaign_status` | draft / scheduled / running / paused / completed / canceled |
| `target_state` | queued / suppressed / dialing / ringing / in_call / completed / failed / voicemail / retry_wait / do_not_call |
| `consent_status` | granted / none / revoked |
| `conversation_channel` | voice / sms / chat / email / whatsapp |
| `phone_number_status` | active / assigned / unassigned / pending_purchase / pending_release / released / failed |

### Critical DB Functions

**`can_dial(org_id, e164, now, tz)`** → boolean  
Returns true only if: contact has consent=granted AND e164 not in DNC AND current hour is 9–19 in the org's calling timezone. The dialer calls this before every single outbound dial — not optional, not bypassable.

**`apply_consent_event()`** (trigger on `consent_events` INSERT)  
On revoke: inserts to `dnc_list`, updates all queued campaign targets for that number to `do_not_call` — in the same transaction. Opt-out is instantaneous and atomic.

**`gdpr_erase(org_id, e164)`**  
Adds DNC entry, nullifies call transcripts/recordings, deletes campaign targets, hard-deletes contact. The only place hard-delete is permitted.

---

## 6. What Is an Agent?

An agent is the core product unit. It is an AI voice persona that can handle inbound or outbound calls in a specific role.

### Agent Properties

| Field | Description |
|---|---|
| `name` | Display name (e.g. "Aria — Support") |
| `direction` | inbound / outbound / both |
| `provider` | Voice AI runtime (elevenlabs / vapi / retell) |
| `provider_ref` | ID in the provider system (ElevenLabs conversation agent ID) |
| `voice_id` | The voice used (from Voice Library) |
| `persona` | JSON blob: objective, tone, business_name, first_message, guardrails, identity |
| `languages` | Array of supported languages (e.g. ["en-US", "hi-IN"]) |
| `inbound_number` | Phone number assigned for inbound calls |
| `consent_required` | Always true for outbound agents (architectural) |
| `sync_status` | synced / failed (tracks ElevenLabs sync state) |
| `conversation_config_id` | ElevenLabs conversation config reference |

### Agent Lifecycle

```
Create → Build system prompt from persona
       → Call VoiceProvider.createAgent()  (ElevenLabs API)
       → Write agents table + organization_agents registry
       → Status: synced

Update → Merge persona fields
       → Call VoiceProvider.updateAgent()
       → On provider error: sync_status = 'failed', sync_error saved

Delete → Call provider delete (best effort)
       → Soft-delete: deleted_at = now()

Clone  → Copy name + " Copy", all persona/voice/language config
       → Full createAgent flow

Assign Number → Twilio binding via provider.assignPhoneNumber()
              → Updates phone_numbers.agent_id + agents.inbound_number
```

### Agent Persona Fields

The `persona` JSON is what actually drives the AI behavior:

```json
{
  "objective": "Help customers recover their abandoned Shopify cart by offering a 10% discount code",
  "tone": "warm_professional",
  "business_name": "Bloom Dental",
  "first_message": "Hi, this is Maya calling from Bloom Dental...",
  "guardrails": [
    "Never discuss competitor pricing",
    "Transfer to human if caller sounds distressed"
  ],
  "identity": "You are Maya, a friendly receptionist for Bloom Dental"
}
```

**Tone presets:** warm_professional / calm_reassuring / energetic / formal / empathetic / concise / custom

### Agent Presets

Presets are pre-configured agent templates per vertical, stored in the `agent_presets` table. Each preset includes persona, voice_id, direction, tools, and language defaults. The onboarding flow selects a preset to create the first agent quickly.

---

## 7. Voice Library

Voices are synced from ElevenLabs via the `voice-sync` edge function. Each voice has:

- Provider metadata (voice_id, preview URL, accent, gender)
- Use case classification: customer_support / sales / appointment_booking / receptionist / collections / conversational
- Language tags
- A generated avatar (initials from name)

**Use case classification** uses keyword matching on voice description and tags:

| Use Case | Keywords |
|---|---|
| customer_support | support, service, warm, empathetic, calm, reassuring, patient |
| sales | sales, persuasive, energetic, upbeat, confident, dynamic |
| appointment_booking | appointment, booking, schedule, reminder, clear, efficient |
| receptionist | professional, polished, corporate, formal, neutral |
| collections | firm, assertive, serious, authoritative, deep, commanding |
| conversational | fallback for everything else |

---

## 8. Onboarding Flow

The onboarding wizard is a 6-step flow that takes a new user from signup to live agent. It is designed to complete in under 10 minutes.

### Step 1 — Pick Vertical
User selects their business type:
- **Shopify**: Cart recovery, order status, promos
- **Healthcare/Clinic**: Appointment reminders, no-show recovery

This selection drives which agent presets, integrations, and knowledge templates appear downstream. It writes to `orgs.vertical`.

### Step 2 — Connect Tools
Shows available integrations filtered to the selected vertical:
- Shopify (OAuth)
- Cal.com (API key)
- HubSpot (API key)
- Google Calendar (OAuth, Phase 2)

Each integration follows the same flow: enter credentials → validate → save `integration_bridge_config` row.

### Step 3 — Add Knowledge
User enters their website URL. The platform fetches and embeds the content into ElevenLabs CAI as a native knowledge source. This gives the agent factual grounding (business hours, services, FAQs) without any manual writing.

Creates a `knowledge_sources` row with `kind=url`.

### Step 4 — Create Agent
User defines their first agent:
- Name
- Direction (inbound / outbound)
- Objective (what should this agent accomplish?)
- Business persona

For outbound agents, `consent_required` is forced to `true` — the UI does not expose this as an option; it is architectural.

Calls `POST /v1/agents` → syncs to ElevenLabs CAI → writes `agents` row.

### Step 5 — Get Phone Number
User enters Twilio credentials (Account SID + Auth Token) to provision a phone number. This creates a Twilio subaccount entry and buys a DID. 

Users can skip this step and use the agent for web-embedded calls only, or provide BYO (Bring Your Own) number later.

### Step 6 — Test and Go Live
Confirmation screen. User can place a test call from the browser.

---

## 9. App Pages

### Dashboard `/dashboard`

The operational home page. Refreshed live via Supabase Realtime.

**Stat cards:**
- Calls today
- Deflection % (inbound calls handled without escalation)
- Carts recovered $ (Shopify vertical) OR Bookings + No-show recovery (Clinic vertical)

**Sections:**
- Setup checklist — 6-step progress bar; dismissed when all steps complete
- Live now — active agents with real-time call count
- Recent conversations — live table updating as calls arrive
- Campaign quick-launch CTA

---

### Agents `/agents`

Lists all agents for the org. Status indicator shows sync state (synced / failed).

**Actions:** Create agent (opens preset picker), Clone, Delete

---

### Agent Detail `/agents/:id`

Multi-tab editor for a single agent. All changes sync to ElevenLabs on save.

**Tabs:**

| Tab | Contents |
|---|---|
| **Persona** | Objective, business name, first message, identity, guardrails (one per line), tone preset |
| **Voice** | Voice picker with preview audio; language selector |
| **Playbook** | Inbound rules, call routing, escalation triggers (Phase 2) |
| **Numbers** | Phone numbers assigned to this agent; assign/unassign |
| **Test** | In-browser test call launcher |

**Tone presets** map directly to system prompt modifiers passed to ElevenLabs.  
**Languages** constrain which voices are available (voice-language compatibility matrix).

---

### Campaigns `/campaigns`

Lists all campaigns. Filtered by status chips: All / Running / Paused / Draft / Completed.

**Campaign states:**
- `draft` — being configured
- `scheduled` — ready, waiting for window start
- `running` — dialer worker is actively dialing
- `paused` — manually paused; can resume
- `completed` — all targets reached or exhausted
- `canceled` — stopped permanently

---

### New Campaign `/campaigns/new`

4-step wizard:

1. **Audience** — select segment, tag, or upload CSV; shows consent/DNC counts
2. **Agent & Script** — pick an outbound agent; preview first message
3. **Schedule** — calling window (start/end hours), timezone, concurrency (parallel calls), max retries
4. **Compliance Review** — mandatory step showing exact breakdown:
   - Contacts with consent ✓ (will be dialed)
   - No-consent contacts (will be skipped)
   - DNC contacts (will be skipped)
   - Outside-hours contacts (will be deferred)

After compliance review, a confirmation modal forces the user to acknowledge that real calls will be placed.

---

### Campaign Detail `/campaigns/:id`

Live view of a running or completed campaign.

- Real-time target state breakdown (queued / dialing / completed / failed)
- Per-contact outcome log
- Pause / Resume / Stop controls
- Cost running total

---

### Conversations `/calls`

Full conversation log across all channels. Previously named "Calls".

**Filters (URL-persisted):** Agent, date range (from/to), status, direction  
All filter state lives in the URL query string — links are shareable and refresh-safe.

**Stat cards:** Total cost, Total duration, Avg cost/conversation, Avg duration/conversation

**Table columns:** ID (copyable), Channel (icon), Agent, Direction, Duration, Hangup By, Initiated At, Cost, Status, Data

**Conversation drawer (opens on row click):**

| Tab | Contents |
|---|---|
| **Summary** | Channel, direction, status, provider, hangup by, started, duration, cost |
| **Transcript** | Chat-bubble view with agent (left) and customer (right) turns |
| **Recording** | Audio player (if recording exists) |
| **Tool Calls** | Any tool invocations made during the call (e.g. Shopify lookups) |
| **Raw** | Full JSON record for debugging |

---

### Phone Numbers `/numbers`

Phone number inventory table.

**Columns:** Phone number, Status (lifecycle badge), Agent answering, Telephony provider, Purchased on, Renews on, Monthly rent, Unlink agent, Delete

**Lifecycle statuses:**
- `unassigned` — provisioned, no agent assigned
- `assigned` — linked to an agent
- `active` — live and receiving calls
- `pending_purchase` — buy request in progress
- `pending_release` — release request in progress
- `released` — returned to provider pool
- `failed` — provisioning or release failed

**Actions:** Unlink agent from number, Delete number (with confirmation dialog)

---

### Contacts `/contacts`

Contact list for the org. Search is debounced at 350ms.

**Table:** Name, phone, consent status, source, DNC indicator, last call

**Consent badge:**
- ● Green: granted
- ● Gray: none
- ● Red: revoked

**Actions:**
- Import CSV — with consent attestation gate (required)
- Upload DNC — bulk add numbers to DNC list
- Delete contact — soft-delete (sets `deleted_at`)

---

### Integrations `/integrations`

Integration hub showing all available connectors, grouped by category.

**Categories:** E-Commerce, Messaging, Calendar, CRM, Telephony, Automation, Healthcare/EHR, Data Export

**Telephony providers:**
- Twilio
- Plivo
- Exotel (India)
- Vobiz (India)

**Integration states per connector:** Not connected / Connected / Error / Disconnected

Clicking "Connect" routes to `/integrations/connect/:provider` — a wizard that collects credentials, validates them, and stores via `integration_bridge_config`.

---

### Voice Library `/voices`

Browse and preview all available voices synced from ElevenLabs.

**Filters:** Use case (customer support, sales, etc.), language, gender

Each voice card shows: Name, use case badge, language tags, accent, audio preview button

---

### Knowledge `/knowledge`

Knowledge base management. Sources are embedded into ElevenLabs CAI natively.

**Source types:**
- URL (website crawl)
- File upload (PDF, DOCX)
- Plain text

Each source shows: Title, type, status (pending / processing / ready / failed), created date

---

### Analytics `/analytics`

Aggregate reporting across calls, agents, and campaigns.

**Metrics:** Call volume by day, deflection rate trend, campaign success rate, cost per outcome, top performing agents

---

### Outcomes `/outcomes`

Outcome-level reporting. Tracks what actually happened as a result of calls.

**Tracked outcomes per vertical:**

Shopify: cart recovery $ / discount codes redeemed / orders updated  
Clinic: appointments booked / reminders sent / no-shows prevented

---

### Billing `/billing`

- Current plan and usage meter
- Overage tracking (minutes used vs bundled)
- Upgrade / downgrade controls
- Invoice history
- Stripe portal link

---

### Settings `/settings`

Org-level configuration.

**Sections:**

| Section | Fields |
|---|---|
| Org Profile | Name, logo, timezone, calling hours |
| Notifications | Email alerts for missed calls, campaign completions, low balance |
| Compliance | Consent required toggle (locked ON for outbound), calling window defaults, DNC management |
| Whitelabel | Custom logo, brand color (Scale tier) |
| API | Webhook endpoint config, API key management |

---

## 10. Compliance System

Compliance is not a feature — it is infrastructure. These constraints cannot be turned off.

### Consent Flow

Every contact has a `consent_status`: granted / none / revoked.

Consent changes are written to `consent_events` (append-only ledger). The DB trigger `apply_consent_event()` fires on every INSERT and:
1. Updates `contacts.consent_status`
2. On revoke: inserts to `dnc_list` AND updates all queued campaign targets to `do_not_call` — in a single atomic transaction

There is no API endpoint to UPDATE or DELETE a consent event. The DB trigger `block_mutation()` raises an exception on any attempt.

### DNC Enforcement

The `dnc_list` table is the source of truth. A number lands here when:
- Customer says "stop" / "remove me" during a call
- Contact consent is revoked
- Manual DNC upload
- GDPR erasure request

`can_dial()` checks this table before every single outbound dial. Even if a campaign has a contact in `queued` state, they will be skipped at dial time if they appear in DNC.

### Calling Hours

`can_dial()` also checks the current time in the org's calling timezone. Calls outside 9am–7pm are blocked at the infrastructure level, regardless of campaign settings.

### TCPA Campaign Compliance Review Step

Campaign step 4 is non-skippable and shows:
- Contacts with valid consent (will be dialed)
- Contacts without consent (skipped, count shown)
- DNC contacts (skipped, count shown)
- Contacts outside calling hours (deferred, count shown)

The user must manually confirm the exact dial count before launch.

---

## 11. Campaign Dialer Architecture

The dialer is a background worker (`backend/src/workers/dialer.worker.js`) that processes campaign targets.

### Target State Machine

```
queued
  │
  ├── [can_dial() = false] ──→ suppressed / do_not_call
  │
  ├── [spend guard fails] ──→ suppressed
  │
  ├── [outside window] ──→ stays queued until window opens
  │
  └── [all checks pass] ──→ dialing
                              │
                         ringing / in_call
                              │
                    ┌─────────┼────────────┐
                 completed  failed      voicemail
                              │
                         [retries left] → retry_wait → queued
                              │
                         [no retries] → failed
```

### Dialer Concurrency

Each campaign has a `concurrency` setting (max simultaneous calls). The dialer uses `campaign_targets.lease_token` and `lease_expires_at` for distributed lease management — preventing double-dials even if multiple worker instances run in parallel.

Lease sweeper (`backend/src/workers/lease-sweeper.worker.js`) reclaims expired leases every minute.

### Retry Logic

Each target has `attempts` count and `max_retries` from the campaign. On failure, `next_attempt_at` is set with exponential backoff. The target returns to `queued` at that time.

---

## 12. Inbound Call Flow

```
Caller dials +1-XXX-XXX-XXXX (Twilio DID)
      │
Twilio webhook → POST /webhooks/twilio/inbound
      │
1. Resolve org_id + agent_id from phone number
2. Sliding-window rate check: max N calls per org per 60s window
3. can_spend(org_id, now): check against spend guard threshold
      │
      ├── [any check fails] → TwiML <Say>busy message</Say>
      │
      └── [all pass] → TwiML <Connect> to ElevenLabs CAI SIP endpoint
                              │
                        AI handles call
                              │
                        Post-call webhook → write calls row + usage_ledger
```

This is the most security-critical path. ElevenLabs CAI is never bound directly to a Twilio number — all calls pass through the admission gate.

---

## 13. Telephony Provider Architecture

The telephony abstraction layer at `backend/src/providers/telephony/` implements the same interface across all providers:

```javascript
TelephonyProvider interface:
  connect()             // validate credentials
  disconnect()          // revoke access
  verify()              // check credentials are still valid
  listAvailableNumbers() // search numbers to buy
  buyNumber(e164)       // purchase a number
  releaseNumber(ref)    // return number to pool
  assignWebhook(ref, url) // configure incoming webhook
  healthCheck()         // ping
```

**Implemented adapters:**
- `twilio.adapter.js` — Twilio REST API v2
- `plivo.adapter.js` — Plivo REST API v1
- `exotel.adapter.js` — Exotel (Indian cloud telephony)
- `vobiz.adapter.js` — VoBiz (Indian VoIP)

**Factory:**  
`getTelephonyAdapter(providerKey, { orgId, credentials })` returns the correct adapter instance.

---

## 14. Backend API Structure

```
/v1/                      ← All customer APIs (require auth JWT)
  /v1/agents              ← CRUD + sync
  /v1/calls               ← Read-only (mutations via webhooks)
  /v1/campaigns           ← CRUD + launch/pause/stop
  /v1/contacts            ← CRUD + consent + DNC
  /v1/integrations        ← Connect/disconnect/health
  /v1/numbers             ← Phone number management
  /v1/billing             ← Subscription + usage
  /v1/settings            ← Org config
  /v1/knowledge           ← Knowledge source management
  /v1/analytics           ← Read-only metrics
  /v1/webhooks/           ← Inbound webhooks (Twilio, Stripe, Shopify)

/v1/admin/                ← Internal platform APIs (require platform role)
  /v1/admin/users         ← Cross-org user management
  /v1/admin/orgs          ← Org provisioning
  /v1/admin/billing       ← Override subscriptions
  /v1/admin/agents        ← Cross-org agent audit
  /v1/admin/logs          ← Platform event logs
```

The admin API is behind `RequireAdmin` middleware (`backend/src/middleware/admin.middleware.js`). It checks the `platform_role` claim in the JWT — a separate field from the org-level `user_role`.

---

## 15. Supabase Edge Functions

| Function | Purpose |
|---|---|
| `voice-sync` | Sync voices from ElevenLabs to `voices` table |
| `agent-bridge` | Proxy agent API calls; inject integration context for tool calls |
| `shopify-connect` | Shopify OAuth callback handler |
| `shopify-proxy` | Proxy Shopify API calls from frontend (avoids CORS + secret exposure) |
| `oauth-exchange` | Generic OAuth token exchange for Cal.com, HubSpot |
| `google-sheets-export` | Export call/campaign data to Google Sheets |
| `whatsapp-webhook` | Inbound WhatsApp messages handler |
| `waitlist-join` | Waitlist signup with email deduplication |
| `waitlist-phone` | Phone-number-based waitlist entries |
| `enterprise-inquire` | Enterprise inquiry submission |

All edge functions enforce CORS headers on every response, including preflight.

---

## 16. Admin Panel `/admin/*`

The admin panel is a separate shell (`AdminShell`) only accessible to users with `platform_role = 'admin'` in the DB.

**Pages:**

| Route | Purpose |
|---|---|
| `/admin` | Dashboard: total orgs, calls today, revenue metrics |
| `/admin/users` | All users across all orgs |
| `/admin/waitlist` | Waitlist management; approve/reject/export |
| `/admin/agents` | All agents across all orgs with sync status |
| `/admin/billing` | Subscription overrides, invoice management |
| `/admin/logs` | Platform event log with structured search |
| `/admin/support` | Support ticket queue |
| `/admin/settings` | Platform-wide config (feature flags, tier limits) |
| `/admin/analytics/product` | Product analytics |
| `/admin/analytics/marketing` | Marketing funnel |
| `/admin/analytics/revenue` | Revenue metrics |

---

## 17. Waitlist & Pre-Launch

The public entry point is `/waitlist` — a landing page that captures name, phone, and email. Supabase table: `waitlist`.

The waitlist supports:
- Referral tracking (`referred_by` column)
- Unsubscribe token (unique per row)
- Phone field for SMS outreach
- Admin page at `/admin/waitlist` to review and approve

Waitlist count is exposed via a `useWaitlistCount` hook (used in the marketing page for social proof counter).

---

## 18. Team

| Person | Role |
|---|---|
| Ashutosh Pawar | Founder, full-stack, product (AdloomX background) |
| Rushikesh Pawar | Co-founder, AI/ML engineering |

---

## 19. What Is Not Built Yet (Explicit Phase 2+)

These are explicitly excluded from v1:

- EHR / PMS integration (clinic scheduling systems)
- Full HIPAA Business Associate Agreement
- Custom call flow builder (visual IVR)
- Languages beyond English and Hindi/Spanish
- Reseller / whitelabel program (UI exists, backend not wired)
- Self-hosted voice (Pipecat — Phase 4, ~50% COGS reduction)
- pgvector RAG (CAI-native knowledge only in v1)
- 3rd, 4th vertical beyond Shopify + Clinic
- Live call monitoring (listen-in) for supervisors
- AI-generated conversation summaries
- Call quality scoring
- WebSocket real-time updates on conversations page

---

## 20. Key Decisions Log

| Decision | Rationale |
|---|---|
| ElevenLabs CAI Phase 1, not Vapi | Native RAG (no pgvector), one API for agent + knowledge + voice |
| Twilio DID → Hono gate → CAI (not native binding) | Security: native binding bypasses spend/rate limits. Non-negotiable. |
| Append-only ledgers for consent, usage, webhooks | Legal defensibility, no mutation = no audit gaps |
| VoiceProvider abstraction from day 1 | Vendor negotiation leverage; swap in weeks not months |
| No pgvector in v1 | CAI-native RAG is faster to ship; sufficient for v1 |
| Shopify-only GTM Phase 1 | Measurable ROI (cart $$) vs soft clinic ROI; Shopify merchant pays faster |
| India BYO Plivo (Phase 3) | Twilio India pricing is 3x higher; Plivo makes India margin-positive |
| Spend guard from call #1 (even on trial) | COGS leak prevention; free trial is bounded by 25 min hard cap |
| `can_dial()` in DB not app code | Can't be bypassed by app bug; enforced at DB function level |
| Vertical config rows not hardcoded | Adding a vertical is data, not a deploy |
