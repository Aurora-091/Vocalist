# Proof of Concept (POC) Checklist

This document defines the "Definition of Done" for the Weeber Proof of Concept (POC) demo. It lists the core capabilities that must be operational to prove technical viability to investors and stakeholders.

---

## What the POC Proves
A successful POC demo proves that an SMB merchant can register, connect their store, and place/receive compliance-grade voice calls where the voice agent acts on real-time store database parameters while respecting platform billing spend boundaries.

---

## The 5 Core Deliverables

### 1. Outbound Dialer Campaign
* **Description**: The platform must automatically schedule and dial numbers from a loaded campaign list.
* **Acceptance Criteria**:
  - [ ] A background scheduler/worker picks up `queued` target records.
  - [ ] The system evaluates `can_dial()` (TCPA hours checking) before dialing.
  - [ ] Twilio initiates outbound calls to active targets.
  - [ ] Expired, non-answering, or busy numbers are enqueued for retry backoffs.

### 2. Inbound Call Admission Gate
* **Description**: Incoming Twilio calls to provisioned numbers must pass billing and security validation before routing to the voice runtime.
* **Acceptance Criteria**:
  - [ ] Incoming request triggers webhook at `/webhooks/twilio/inbound`.
  - [ ] System resolves target `org_id` and checks `can_spend()` and `check_inbound_rate()`.
  - [ ] If check passes, returns a TwiML `<Connect>` to ElevenLabs CAI.
  - [ ] If check fails, returns a TwiML `<Reject>` or `<Say>` explanation.

### 3. Shopify OAuth App Installation
* **Description**: Seamless, click-through merchant onboarding via Shopify Partners OAuth.
* **Acceptance Criteria**:
  - [ ] Clicking "Connect Shopify" redirects merchant to Shopify Authorize screen.
  - [ ] Success callback exchanges query codes for a permanent access token.
  - [ ] Access token is stored in the Supabase Vault (`shopify_connections`).
  - [ ] App automatically registers webhooks (`checkouts/create`, `orders/paid`).

### 4. Shopify Agent Tools (Function Calling)
* **Description**: During active conversations, the ElevenLabs agent can read and write to the merchant's Shopify store.
* **Acceptance Criteria**:
  - [ ] `lookup_order` returns correct order parameters based on user input.
  - [ ] `cancel_order` modifies order status on Shopify Partner Dashboard.
  - [ ] `apply_discount_code` updates cart totals on abandoned checkout recovery.

### 5. Usage Ledger & Spend Guard
* **Description**: Automatic spend counter increments and bounds protection.
* **Acceptance Criteria**:
  - [ ] Every call completion logs an immutable row in `usage_ledger` with `idempotency_key`.
  - [ ] Counter ledger tallies `cost_usd` (Twilio fee + LLM tokens + CAI fee).
  - [ ] If a tenant exceeds their monthly balance limit, `can_spend()` returns `false` and subsequent calls are blocked.
