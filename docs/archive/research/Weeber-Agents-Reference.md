# Weeber Agents — Deep Technical Reference

**Last updated:** June 16, 2026  
**Audience:** Engineering, Product, AI team

---

## 1. What Is an Agent?

An agent is the core product unit in Weeber. It is a configured AI voice persona — backed by an ElevenLabs Conversational AI (CAI) instance — that can:

- Answer inbound phone calls on behalf of a business
- Place outbound calls triggered by events or campaigns
- Execute tool calls against connected integrations (Shopify, calendar systems, CRMs) in real time during the call

Each agent lives in two places simultaneously:
1. **Weeber DB** (`agents` table) — the source of truth for configuration, RLS-scoped to the org
2. **ElevenLabs CAI** — where the agent actually runs during calls (synced via API)

---

## 2. Agent Data Model

### Core Fields (`agents` table)

| Field | Type | Description |
|---|---|---|
| `id` | uuid | Internal primary key |
| `org_id` | uuid | Tenant isolation — RLS enforced |
| `name` | text | Display name (e.g. "Aria — Support") |
| `vertical` | text | shopify / clinic / generic |
| `direction` | text | inbound / outbound / both |
| `provider` | text | elevenlabs / vapi / retell |
| `provider_ref` | text | ElevenLabs agent_id — the CAI resource ID |
| `provider_agent_id` | text | Duplicate of provider_ref (for registry joins) |
| `voice_id` | text | ElevenLabs voice ID used for TTS |
| `languages` | text[] | e.g. `['en', 'hi-IN', 'es']` |
| `persona` | jsonb | Structured persona config (see §4) |
| `inbound_number` | text | E.164 phone number assigned for inbound |
| `transfer_number` | text | Human escalation number |
| `timezone` | text | Calling timezone (e.g. America/New_York) |
| `consent_required` | boolean | Always true for outbound — DB-enforced |
| `conversation_config_id` | text | ElevenLabs conversation config ID |
| `sync_status` | text | synced / failed |
| `sync_error` | text | Last sync error message if failed |
| `last_synced_at` | timestamptz | When last successfully pushed to ElevenLabs |
| `deleted_at` | timestamptz | Soft delete timestamp |

### Registry (`organization_agents` table)

A denormalized registry row per agent. Enables fast cross-query without joining back to agents. Updated every time the agent is created or updated.

| Field | Description |
|---|---|
| `org_id` | Tenant |
| `agent_id` | FK to agents |
| `provider` | elevenlabs / vapi / retell |
| `provider_agent_id` | ElevenLabs agent_id |
| `voice_id` | Current voice |
| `phone_number_id` | FK to phone_numbers if assigned |
| `sync_status` | Mirror of agents.sync_status |

---

## 3. Agent Lifecycle

### 3.1 Create

```
POST /v1/agents
        │
1. Duplicate check (case-insensitive name match within org)
   └─ if exists → return existing agent (idempotent)
        │
2. Generate system prompt from persona
   (personaService.generateSystemPrompt)
        │
3. Resolve voice provider
   (buildVoiceProvider → ElevenLabsProvider)
        │
4. POST /v1/convai/agents/create → ElevenLabs CAI
   Returns: { agent_id, conversation_config }
        │
5. INSERT into agents table
   (org_id, name, persona, provider_ref=agent_id, voice_id, sync_status='synced')
        │
6. INSERT into organization_agents registry
```

**ElevenLabs payload on create:**

```json
{
  "name": "Aria — Cart Recovery",
  "conversation_config": {
    "agent": {
      "prompt": {
        "prompt": "<compiled system prompt>",
        "llm": "gpt-4o-mini",
        "temperature": 0.5
      },
      "first_message": "Hi, I noticed you left some items in your cart...",
      "language": "en"
    },
    "tts": {
      "voice_id": "EXAVITQu4vr4xnSDxMaL"
    }
  }
}
```

### 3.2 Update

```
PATCH /v1/agents/:id
        │
1. Fetch existing agent (RLS: org_id must match)
        │
2. Merge persona fields (new over existing)
        │
3. Re-generate system prompt
        │
4. PATCH /v1/convai/agents/:provider_ref → ElevenLabs CAI
   ├─ success → sync_status = 'synced'
   └─ failure → sync_status = 'failed', sync_error = message
        │
5. UPDATE agents table
        │
6. UPSERT organization_agents registry
```

**Note:** Knowledge base IDs are attached at update time. If `knowledge_base_ids` is present in the agent data, it is passed to ElevenLabs as `prompt.knowledge_base`.

### 3.3 Delete

```
DELETE /v1/agents/:id
        │
1. Fetch existing agent
        │
2. DELETE /v1/convai/agents/:provider_ref (ElevenLabs)
   └─ errors are suppressed (best-effort cleanup)
        │
3. DELETE from organization_agents
        │
4. UPDATE agents SET deleted_at = now() (soft delete)
```

Hard deletes are never done on agents. This preserves call history integrity — `calls.agent_id` would break with a hard delete.

### 3.4 Sync (Manual Re-push)

```
POST /v1/agents/:id/sync
        │
1. Fetch agent + generate system prompt
        │
2. PATCH ElevenLabs with current agent state
        │
3. UPDATE sync_status = 'synced', last_synced_at = now()
```

Used to recover from a `sync_status = 'failed'` state. Available from the AgentDetail UI as a "Retry sync" button.

### 3.5 Clone

```
POST /v1/agents/:id/clone
        │
1. Fetch source agent
        │
2. Build clone data:
   name          = "${source.name} (Copy)"
   persona       = source.persona  (deep copy)
   voice_id      = source.voice_id
   languages     = source.languages
   provider      = source.provider
   timezone      = source.timezone
   transfer_number = source.transfer_number
   consent_required = source.consent_required
        │
3. Full createAgent flow (new ElevenLabs agent, new DB row)
```

Clone does not copy phone number assignments — each agent must be explicitly assigned a number.

### 3.6 Assign Phone Number

```
POST /v1/agents/:id/assign-number
Body: { phone_number_id }
        │
1. Fetch agent (verify org_id)
        │
2. Fetch phone_numbers row (verify org_id)
        │
3. ElevenLabsProvider.assignPhoneNumber({
     provider_ref: agent.provider_ref,
     phone_number: phone.number
   })
        │
   3a. GET /v1/convai/phone-numbers
       → find existing number OR import it:
         POST /v1/convai/phone-numbers (with Twilio credentials)
        │
   3b. PATCH /v1/convai/phone-numbers/:phone_number_id
       { agent_id: provider_ref }
        │
4. UPDATE phone_numbers SET agent_id = agentId
        │
5. UPDATE agents SET inbound_number = phone.number
        │
6. UPDATE organization_agents SET phone_number_id = phoneNumberId
```

Twilio credentials are read from the org's `twilio_subaccounts` table (Vault-backed auth_token).

---

## 4. Persona System

The `persona` is a JSON blob that drives every aspect of agent behavior. It is stored in the `agents` table and compiled into an LLM system prompt before being sent to ElevenLabs.

### Persona Shape

```json
{
  "objective": "Recover abandoned shopping carts...",
  "tone": "friendly, helpful, not pushy",
  "business_name": "Bloom Dental",
  "first_message": "Hi {{customer_name}}, this is...",
  "identity": "You are Maya, a friendly receptionist...",
  "guardrails": [
    "Never offer more than the configured discount",
    "Always respect DNC requests immediately",
    "End call if customer is hostile"
  ],
  "context": "...",
  "goals": "..."
}
```

All fields are optional. The persona compiler handles missing values gracefully.

### How the Persona Compiles to a System Prompt

`personaService.generateSystemPrompt(persona)` produces a structured prompt with these sections:

```
# IDENTITY
You are a helpful voice AI assistant representing Bloom Dental.

# TONE & STYLE
friendly, helpful, not pushy

# GOALS
Recover abandoned shopping carts by calling the customer...

# GUARDRAILS
Never offer more than the configured discount
Always respect DNC requests immediately
End call if customer is hostile

# OPENING MESSAGE
When the user connects, you should greet them with:
"Hi {{customer_name}}, this is..."

# BEHAVIORAL INSTRUCTIONS
1. Always maintain the specified tone.
2. Keep your responses conversational, suitable for a voice call.
3. Do not use complex markdown, emojis, or formatting that sounds unnatural when spoken.
```

There is also a second, more structured prompt builder (`promptBuilder.js`) that adds compliance sections. Both are used in different paths and produce slightly different prompt structures. The persona service is the active path for all user-facing agent saves.

### Compliance Section (Always Injected)

Regardless of persona configuration, every outbound agent system prompt always includes:

```
# Compliance & Consent Disclosure
- At the start of every outbound call, after introducing yourself, state:
  "This call may be recorded for quality and training purposes."
- If the recipient asks to be removed from the call list, immediately comply,
  confirm their removal, end the call politely, and flag the contact for DNC.
- Never proceed with a sales pitch or appointment booking until the recipient
  has acknowledged the recording disclosure.
- If calling on behalf of a business, always identify the business name within
  the first 10 seconds of the call.
```

This is injected by `promptBuilder.js` and cannot be removed by any user-facing configuration.

### Template Variables

Persona fields and system prompts use `{{variable}}` syntax for runtime injection:

| Variable | Injected At | Source |
|---|---|---|
| `{{business_name}}` | Agent save | org.name |
| `{{agent_name}}` | Prompt compile | agent.name |
| `{{customer_name}}` | Runtime (tool call) | Shopify customer data |
| `{{cart_items}}` | Runtime (tool call) | Shopify get_cart |
| `{{cart_total}}` | Runtime (tool call) | Shopify get_cart |
| `{{discount_code}}` | Runtime (tool call) | Shopify create_discount |
| `{{patient_name}}` | Runtime (tool call) | Clinic patient record |
| `{{appointment_date}}` | Runtime (tool call) | Calendar booking |
| `{{provider_name}}` | Runtime (tool call) | Calendar practitioners |

ElevenLabs injects dynamic variables from the `conversation_initiation_client_data` sent at call start.

---

## 5. Tone Presets

7 tone presets are available in the Agent Detail UI. Each maps to a string passed into the `persona.tone` field:

| Preset Key | Description | Typical Use Case |
|---|---|---|
| `warm_professional` | Friendly but business-appropriate | General customer service |
| `calm_reassuring` | Slow, patient, never rushed | Healthcare, collections |
| `energetic` | Upbeat, fast-paced, enthusiastic | Promo blasts, sales |
| `formal` | Corporate, precise, no warmth cues | B2B, insurance |
| `empathetic` | Explicitly acknowledges feelings | No-show recovery, complaints |
| `concise` | Short responses, information-dense | Order status, COD confirmation |
| `custom` | Free-text entry — user writes own | Advanced users |

Custom tone bypasses the preset and writes directly to `persona.tone`.

---

## 6. Agent Presets

Presets are pre-built agent templates stored in the `agent_presets` table. They are global (not org-scoped) and are filtered by `vertical_key`. They eliminate the need for a user to write a system prompt from scratch.

### Preset Schema

```json
{
  "vertical_key": "shopify",
  "preset_key": "shopify_cart_recovery",
  "name": "Cart Recovery",
  "description": "Recovers abandoned carts within 1-4 hours...",
  "direction": "outbound",
  "persona": { ... persona object ... },
  "tools": [ ... tool definitions ... ],
  "voice_id": "EXAVITQu4vr4xnSDxMaL",
  "voice_name": "Bella",
  "languages": ["en"],
  "consent_required": true,
  "sort_order": 1
}
```

### Shopify Presets (8)

| # | Name | Direction | Voice | Purpose |
|---|---|---|---|---|
| 1 | Cart Recovery | outbound | Bella | Call within 1-4 hours of abandonment. Offers discount to close. |
| 2 | COD Order Confirmation | outbound | Antoni | Verify Cash-on-Delivery orders to reduce RTO. |
| 3 | Order Status | inbound | Rachel | Answer WISMO queries via Shopify Fulfillment API. |
| 4 | Returns & Exchanges | inbound | Bella | Check eligibility, initiate returns, offer exchanges first. |
| 5 | Post-Purchase Follow-Up | outbound | Adam | 3-7 days post-delivery. Satisfaction check + review request. |
| 6 | Promo Blast | outbound | Gigi | Flash sale announcement. 90-second max. Opted-in contacts only. |
| 7 | Win-Back | outbound | Adam | Re-engage customers 60-90 days inactive. |
| 8 | Subscription Renewal | outbound | Rachel | Pre-renewal confirmation. Handles cancellation/pause. |

### Clinic Presets (8)

| # | Name | Direction | Voice | Purpose |
|---|---|---|---|---|
| 1 | Appointment Booking | inbound | Rachel | Book new appointments via calendar integration. |
| 2 | Appointment Reminder | outbound | Bella | 24-48h pre-appointment confirmation or reschedule. |
| 3 | No-Show Recovery | outbound | Adam | Contact missed patients within 2h. Empathetic reschedule. |
| 4 | Patient Intake | inbound | Charlotte | Pre-visit PHI collection: medications, allergies, insurance. |
| 5 | Post-Visit Follow-Up | outbound | Bella | 2-3 days post-procedure symptom check. Red-flag escalation. |
| 6 | Prescription Refill | inbound | Daniel | Verify identity → check eligibility → route or auto-refill. |
| 7 | Insurance Verification | inbound | Rachel | Collect + verify coverage before procedures. |
| 8 | Preventive Care Recall | outbound | Adam | Contact overdue patients for screenings and checkups. |

---

## 7. Agent Tools (Skills)

Tools are the mechanism by which an agent takes real-world actions during a call. They are defined per preset as JSON and passed to ElevenLabs CAI in the agent's `conversation_config`. ElevenLabs calls them as webhook-style HTTP requests during the conversation.

### Tool Definition Format

```json
{
  "name": "get_cart",
  "description": "Fetch the abandoned cart details for this customer",
  "method": "GET",
  "url": "{{shopify_proxy_url}}/cart/{{cart_id}}",
  "authentication": {
    "type": "bearer",
    "bearer_token": "{{org_token}}"
  }
}
```

For tools that write data:

```json
{
  "name": "create_discount",
  "description": "Generate a one-time discount code for the customer",
  "method": "POST",
  "url": "{{shopify_proxy_url}}/discount",
  "authentication": { "type": "bearer", "bearer_token": "{{org_token}}" },
  "body_parameters": [
    {
      "identifier": "amount_percent",
      "data_type": "number",
      "description": "Discount percentage (5-15)",
      "value_type": "llm_prompt"
    },
    {
      "identifier": "cart_id",
      "data_type": "string",
      "description": "The cart ID",
      "value_type": "static"
    }
  ]
}
```

`value_type: "llm_prompt"` — the LLM decides the value based on conversation context.  
`value_type: "static"` — a fixed value provided at call initiation.

### Shopify Tools by Preset

**Cart Recovery**
- `get_cart` — Fetch cart items, total, and customer info from Shopify
- `create_discount` — Generate a one-time percentage discount code

**COD Order Confirmation**
- `get_order` — Fetch order details (items, total, delivery address)
- `confirm_order` — Mark as confirmed (with optional address correction)
- `cancel_order` — Cancel the order if customer denies placing it

**Order Status**
- `lookup_order` — Search by order number or customer email
- `get_fulfillment` — Get tracking number, carrier, estimated delivery

**Returns & Exchanges**
- `check_return_eligibility` — Verify if item is within return window and eligible
- `initiate_return` — Create return request with reason

**Post-Purchase Follow-Up**
- `get_customer_order` — Fetch recent order and delivery date
- `send_review_link` — Trigger SMS with product review link

**Promo Blast**
- `send_promo_sms` — Send promo code + link via SMS if requested

**Win-Back**
- `get_customer_history` — Fetch purchase history and preferences
- `apply_winback_offer` — Apply personalized discount (percentage / fixed / free shipping)

**Subscription Renewal**
- `get_subscription` — Fetch subscription details and renewal date
- `update_subscription` — Set action: continue / pause / cancel

### Clinic Tools by Preset

**Appointment Booking**
- `check_availability` — Query provider calendar for open slots
- `book_appointment` — Create appointment (patient_id, provider_id, datetime, type)
- `get_patient` — Search patient by name or phone

**Appointment Reminder**
- `get_appointment` — Fetch appointment details
- `reschedule` — Move appointment to new datetime
- `check_availability` — Find alternative slots

**No-Show Recovery**
- `get_patient_record` — Patient history including no-show count
- `reschedule` — Book replacement appointment

**Patient Intake**
- `save_intake` — Write intake data (chief complaint, medications, allergies, insurance, emergency contact)
- `get_patient` — Look up patient record

**Post-Visit Follow-Up**
- `get_visit_details` — Fetch discharge instructions and procedure type
- `escalate_to_provider` — Alert on-call provider with severity level (low/medium/high/critical)
- `schedule_followup` — Book follow-up appointment

**Prescription Refill**
- `verify_patient` — Identity check (name + DOB + last 4 of phone)
- `check_refill` — Check eligibility and refill count
- `process_refill` — Submit eligible refill to pharmacy

**Insurance Verification**
- `verify_insurance` — Check eligibility with provider + CPT code
- `save_insurance` — Write insurance details to patient record

**Preventive Care Recall**
- `get_care_gaps` — Fetch overdue preventive items
- `schedule_preventive` — Book preventive care appointment
- `set_reminder` — Schedule future callback if patient declines now

---

## 8. Agent-Bridge Edge Function

All tool calls made by ElevenLabs during a conversation route through the `agent-bridge` Supabase Edge Function. This is the security boundary — it prevents ElevenLabs from calling integration APIs directly.

### Request Format

```json
{
  "provider": "shopify",
  "action": "get_cart",
  "params": {
    "cart_id": "checkout_abc123"
  }
}
```

### Bridge Flow

```
ElevenLabs CAI (tool call during conversation)
        │
        ▼
agent-bridge Edge Function
        │
1. Verify user JWT (Supabase auth)
2. Extract org_id from user.app_metadata
3. Resolve integration_bridge_config row
   (org_id + provider_key + status='active')
4. Route to provider handler function
        │
   ┌────┴──────────────────────────┐
   │ Providers                     │
   │ - shopify     → Shopify REST  │
   │ - hubspot     → HubSpot API   │
   │ - pipedrive   → Pipedrive API │
   │ - freshsales  → Freshsales    │
   │ - cliniko     → Cliniko API   │
   │ - jane_app    → Jane App API  │
   │ - google_cal  → Google Cal    │
   │ - calcom      → Cal.com API   │
   │ - whatsapp    → Twilio/WhatsApp│
   └───────────────────────────────┘
        │
5. Return { data, provider, action }
```

### Available Actions Per Provider

**Shopify**

| Action | HTTP | Purpose |
|---|---|---|
| `get_order` | GET | Fetch order by ID |
| `list_orders` | GET | List recent orders |
| `get_customer` | GET | Fetch customer by ID |
| `search_customers` | GET | Search by query (email, name) |
| `get_product` | GET | Fetch product details |
| `get_cart` | GET | Fetch abandoned checkout |

**HubSpot**

| Action | HTTP | Purpose |
|---|---|---|
| `get_contact` | GET | Fetch contact by ID |
| `search_contacts` | POST | Search by email |
| `create_note` | POST | Log call note to contact |

**Pipedrive**

| Action | HTTP | Purpose |
|---|---|---|
| `get_person` | GET | Fetch person by ID |
| `search_persons` | GET | Search by name/email |
| `get_deal` | GET | Fetch deal by ID |
| `list_deals` | GET | List open deals |

**Freshsales**

| Action | HTTP | Purpose |
|---|---|---|
| `get_contact` | GET | Fetch contact |
| `search_contacts` | GET | Search by email |
| `get_deal` | GET | Fetch deal |

**Cliniko (Healthcare)**

| Action | HTTP | Purpose |
|---|---|---|
| `get_patient` | GET | Fetch patient record |
| `search_patients` | GET | Search by name |
| `list_appointments` | GET | Upcoming appointments |
| `get_practitioners` | GET | List available providers |

**Jane App (Healthcare)**

| Action | HTTP | Purpose |
|---|---|---|
| `get_patient` | GET | Fetch patient |
| `search_patients` | GET | Search patients |
| `list_appointments` | GET | List appointments |
| `get_staff` | GET | List staff/practitioners |

**Google Calendar**

| Action | HTTP | Purpose |
|---|---|---|
| `list_events` | GET | Events in date range |
| `get_freebusy` | POST | Free/busy times for scheduling |
| `create_event` | POST | Book a calendar slot |

Google Calendar uses OAuth with automatic token refresh. Tokens stored in `oauth_tokens` table.

**Cal.com**

| Action | HTTP | Purpose |
|---|---|---|
| `list_event_types` | GET | Available booking types |
| `get_availability` | GET | Available slots in date range |
| `list_bookings` | GET | Existing bookings by status |

**WhatsApp (via Twilio)**

| Action | HTTP | Purpose |
|---|---|---|
| `send_message` | POST | Send WhatsApp message to contact |

---

## 9. Voice Provider Abstraction

The `VoiceProvider` abstract class at `backend/src/providers/voice/interface.js` defines the contract all voice AI providers must implement:

```javascript
class VoiceProvider {
  // Place an outbound call
  async startCall({ toE164, fromE164, leaseToken, metadata }) → {
    provider_call_id, status, meta
  }

  // End an in-progress call
  async endCall(providerCallId) → { ok }

  // Drop pre-recorded voicemail after AMD detection
  async dropVoicemail({ providerCallId, audioUrl }) → { ok }

  // Health check
  async ping() → { ok: true }
}
```

### ElevenLabs Provider Additional Methods

ElevenLabs extends the base interface with agent management:

```javascript
// Agent lifecycle
createAgent(agent, systemPrompt) → { provider_ref, provider_meta }
updateAgent(providerRef, agent, systemPrompt) → { provider_ref, provider_meta }
deleteAgent(providerRef) → { ok }
syncAgent(providerRef) → agent data from CAI

// Telephony mapping
assignPhoneNumber({ provider_ref, phone_number }) → { ok, phone_number_id }

// Knowledge management
syncKnowledgeBase(knowledgeSource) → { provider_knowledge_id }
```

### Factory

```javascript
const buildVoiceProvider = ({ agent, integrationConfig }) => {
  const providerName = agent.provider || 'elevenlabs';
  // Returns registered provider class instance
}
```

Registered providers: `elevenlabs`, `mock` (testing), `pipecat` (Phase 4).

---

## 10. Live Call Flow (Outbound)

When the dialer worker initiates an outbound call through an agent:

```
dialer.worker.js picks up queued campaign_target
        │
1. can_dial(org_id, e164, now, tz) → must return true
2. can_spend(org_id, now) → must return true
        │
3. callService.startCall({
     orgId, agentId, contactId, campaignId, targetId
   })
        │
4. Fetch agent + phone_numbers.number (fromE164)
        │
5. ElevenLabsProvider.startCall({
     toE164: contact.e164,
     fromE164: phone_numbers.number,
     leaseToken: target.lease_token,
     metadata: { call_id, org_id, agent_id }
   })
        │
6. POST /v1/convai/twilio/outbound-call
   Payload:
   {
     agent_id: agent.provider_ref,
     agent_phone_number_id: <EL phone number ID>,
     to_number: "+1XXXXXXXXXX",
     conversation_initiation_client_data: {
       lease_token, call_id, org_id, agent_id, from_number
     }
   }
        │
7. ElevenLabs dials via Twilio
        │
8. Call begins → agent runs playbook
        │
9. Tool calls → agent-bridge edge function → provider API
        │
10. Call ends → ElevenLabs webhook → POST /webhooks/elevenlabs/post-call
        │
11. callService.syncCall({
      provider_call_id,
      status, duration_sec, cost_usd,
      recording_url, transcript
    })
        │
12. UPDATE calls SET ...
13. INSERT into usage_ledger (voice_minutes, cost_usd)
14. UPDATE campaign_targets SET state = 'completed' / 'failed'
```

---

## 11. Inbound Call Flow

```
Caller dials Twilio DID owned by org
        │
Twilio webhook → POST /webhooks/twilio/inbound
        │
1. Resolve phone_numbers row → agent_id → agent → org_id
        │
2. Rate check: max N inbound calls per org per 60s window
3. can_spend(org_id, now): budget check
        │
   ├─ [any fails] → TwiML <Say>"Our lines are busy..."</Say>
   │
   └─ [all pass] → TwiML:
      <Connect>
        <Stream url="wss://api.elevenlabs.io/v1/convai/...">
          <Parameter name="agent_id" value="el_agent_id" />
        </Stream>
      </Connect>
        │
4. ElevenLabs CAI answers with agent persona
        │
5. Agent runs inbound playbook
        │
6. Tool calls → agent-bridge → provider API
        │
7. Call ends → same webhook + sync path as outbound
```

The Twilio number is never bound natively in ElevenLabs. All inbound calls pass through the Hono admission gate first. This is a hard architectural constraint — it prevents COGS leaks and enforces spend limits on every call.

---

## 12. Knowledge Base

Each agent can have knowledge sources attached. These are indexed by ElevenLabs natively (no pgvector required in v1).

### Adding Knowledge

```
POST /v1/knowledge
Body: { kind: 'website', uri: 'https://bloomdental.com' }
   OR
Body: { kind: 'document', title: 'FAQ', storage_ref: 'knowledge/org_id/faq.pdf' }
```

For website sources:
```
ElevenLabsProvider.syncKnowledgeBase({
  kind: 'website', uri: '...', title: '...'
})
→ POST /v1/convai/knowledge-base (multipart/form-data with url field)
→ Returns { provider_knowledge_id }
```

For document sources:
```
1. Download file from Supabase Storage bucket 'knowledge'
2. POST /v1/convai/knowledge-base (multipart/form-data with file field)
3. Returns { provider_knowledge_id }
```

### Attaching to Agent

On `updateAgent`, if `agent.knowledge_base_ids` is present, it is passed to ElevenLabs:

```json
{
  "conversation_config": {
    "agent": {
      "prompt": {
        "prompt": "<system prompt>",
        "knowledge_base": ["kb_id_1", "kb_id_2"]
      }
    }
  }
}
```

ElevenLabs CAI performs RAG over attached knowledge sources during conversations automatically. The agent will cite knowledge sources when answering factual questions (clinic hours, product info, FAQs).

---

## 13. Consent Enforcement at the Agent Level

The `consent_required` field on an agent is enforced at two levels:

**DB level (trigger `force_outbound_consent`):**
```sql
IF NEW.direction IN ('outbound', 'both') THEN
  NEW.consent_required := TRUE;
END IF;

IF OLD.consent_required = TRUE AND NEW.consent_required = FALSE THEN
  RAISE EXCEPTION 'Cannot remove consent_required once set';
END IF;
```

Outbound agents always have `consent_required = true`. This cannot be set to false via any API — the DB trigger will override and block it.

**At dial time (consent-gate.js):**
```javascript
evaluateGate(orgId, e164, now, tz) → {
  allowed: boolean,
  reasons: [
    'CONTACT_NOT_FOUND',
    'CONSENT_NOT_GRANTED',
    'DNC_LISTED',
    'OUTSIDE_CALLING_HOURS'
  ]
}
```

The dialer calls `can_dial()` RPC before every single dial. Even if a campaign has thousands of targets queued, each is individually checked at the moment of dialing — not just when the campaign was launched.

---

## 14. AgentDetail UI — Tab by Tab

The `AgentDetail` page (`src/pages/AgentDetail.tsx`) is a multi-tab form that drives the agent's full configuration.

### Tab: Persona

Fields saved to `persona` JSON:
- **Objective** — textarea. What should the agent accomplish on this call?
- **Business name** — string. Injected as `{{business_name}}` at runtime.
- **First message** — The opening line the agent says immediately.
- **Identity** — Free-text description of who the agent is.
- **Guardrails** — Textarea, one rule per line. Each line becomes a bullet in the `# Guardrails` section.
- **Tone preset** — Dropdown of 7 presets + custom free-text.

### Tab: Voice

- **Voice picker** — Opens the Voice Library drawer.
- **Preview button** — Plays the ElevenLabs TTS preview audio.
- **Language selector** — Multi-select. Languages shown are filtered by voice compatibility (not all voices support all languages).
- **Compatibility warning** — Shown if selected voice does not support one of the selected languages.

On voice select, the agent is immediately updated via `PATCH /v1/agents/:id` — the voice change syncs to ElevenLabs without requiring a full save.

### Tab: Numbers

Shows `phone_numbers` rows where `agent_id = this agent`. Assign/unassign actions trigger `assignPhoneNumber` and the Twilio ElevenLabs binding.

### Tab: Test

- **Place test call** button — Calls `POST /v1/agents/:id/test-call`
- **Live transcript** — Streams the in-progress transcript via Supabase Realtime
- **System prompt preview** — Shows the compiled system prompt that will be sent to ElevenLabs

### Sync Status Banner

When `sync_status = 'failed'`, a banner appears showing `sync_error` and a "Retry sync" button that calls `POST /v1/agents/:id/sync`.

---

## 15. DB Constraints Summary

These database-level constraints protect agent data integrity:

| Constraint | Rule |
|---|---|
| Soft delete only | `deleted_at` timestamp; hard deletes not permitted |
| Duplicate name check | Applied in `agentService.createAgent()` before any DB write |
| Outbound consent | DB trigger: `consent_required = true` whenever `direction = 'outbound'` |
| Consent immutable | DB trigger: once `consent_required = true`, it cannot be set to false |
| RLS on every query | All agent reads/writes are filtered by `org_id = auth_org()` |
| `can_dial()` at dial time | DB function check before every single outbound call |
| Spend guard | `can_spend()` check enforced in dialer before every call |

---

## 16. Agent State at a Glance

At any moment, an agent is described by:

```
agent.sync_status      = 'synced' | 'failed'
agent.inbound_number   = E.164 or null
agent.provider_ref     = ElevenLabs agent_id
agent.direction        = 'inbound' | 'outbound' | 'both'
agent.consent_required = true (always for outbound)
agent.languages        = ['en', 'hi-IN', ...]
agent.voice_id         = ElevenLabs voice ID
```

**Healthy agent:** `sync_status = synced`, `provider_ref` set, `inbound_number` set (for inbound), voice assigned.

**Degraded agent:** `sync_status = failed` — the agent exists in the DB but the ElevenLabs config is stale. It will not handle calls correctly. Requires manual sync via UI or API.

**Deleted agent:** `deleted_at` set, excluded from all queries. ElevenLabs resource was deleted at soft-delete time (best effort).
