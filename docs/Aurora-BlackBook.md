# Aurora — Technical Project Black Book

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Project Overview](#project-overview)
3. [System Architecture](#system-architecture)
4. [Database Design & ER Diagrams](#database-design--er-diagrams)
   - [Entity Relationship Diagram](#entity-relationship-diagram)
   - [Database Tables Specification](#database-tables-specification)
   - [Key Database Constraints](#key-database-constraints)
   - [Indexing & Partitioning Strategy](#indexing--partitioning-strategy)
   - [Triggers & Atomic Functions](#triggers--atomic-functions)
5. [Data Flow & Workflows](#data-flow--workflows)
6. [Feature Specifications](#feature-specifications)
7. [Technology Stack](#technology-stack)
8. [API & Database Operations](#api--database-operations)
9. [Security & RLS Policies](#security--rls-policies)

---

## Executive Summary

**Aurora** is a no-code voice-AI platform for SMBs. An owner connects their store, calendar, or CRM and gets a production voice agent live in under 10 minutes. The agent handles **inbound** calls, places **outbound** calls, runs **bulk scheduled voice campaigns**, routes via IVR, and drops voicemails — billed on plans + metered usage + outcomes.

The product's moat is **not** the telephony/media stack (that is rented from a managed voice runtime). It is the integrations (Shopify, Cal.com, CRM, calendars), the call playbooks, the outbound **campaign engine**, and the outcomes dashboard.

**Project Status**: Pre-MVP — architecture and data model locked; inbound-first build sequenced over a Wk1–19 timeline. Consent/DNC is treated as a legal-critical, most-tested subsystem (not a feature).
**Architecture**: Thin opinionated app layer on a managed voice runtime, with a `VoiceProvider` abstraction enabling a Phase-4 swap to self-hosted orchestration to cut COGS from ~$0.12 to ~$0.06/min.
**Database**: Supabase PostgreSQL — shared-table multi-tenancy with RLS by `org_id`. ~14 core tables, 4 append-only ledgers, native enum types, lease-based dialer idempotency, partitioned high-volume event tables.
**Voice Runtime**: Vapi (MVP, primary) behind a `VoiceProvider` interface; Pipecat/LiveKit self-host as the Phase-4 endgame; Retell available as a drop-in fallback.
**Billing**: Stripe (subscriptions + metered minutes) driven off an append-only usage ledger.
**Compliance posture**: TCPA-grade consent/DNC enforcement, immutable audit ledgers, RLS tenant isolation, vendor BAA chain for HIPAA.

---

## Project Overview

### Problem Statement

SMBs (e.g. Shopify merchants) struggle to:
- Answer every inbound call — missed calls are missed revenue and tickets.
- Run outbound recovery/marketing calls without standing up a compliant dialer.
- Stitch together telephony + STT + LLM + TTS + integrations themselves — infra players sell an *engine*, not an *outcome*.
- Stay compliant (TCPA consent, DNC, calling hours) when calling customers.

### Solution

Aurora provides a single self-serve product that ships **inbound + outbound + bulk campaigns + Shopify/CRM/calendar integrations** — a gap no incumbent fills (infra players give an engine; CX bots are text-only; receptionists are inbound-only; dialers are enterprise-priced). Pricing is an honest all-in SMB plan (bundled minutes + outcome metrics).

### Core Value Propositions

1. **Live in <10 minutes** — connect a store/calendar/CRM, get a working agent. No code.
2. **Inbound + outbound + campaigns in one product** — the unoccupied product gap.
3. **Compliance built in** — pre-dial consent ✓ / DNC ✓ / calling-hours ✓ gate as a hard invariant.
4. **Outcome-billed** — plans + metered minutes + outcome metrics (recovered carts, bookings, deflection).
5. **Vendor-portable** — `VoiceProvider` abstraction; never imports a vendor SDK directly, so COGS can be cut later without a rewrite.
6. **Real-time visibility** — live campaign monitor and outcomes dashboard.

### Target Users

- **Maya — Shopify merchant** (non-technical): never miss a sale, recover carts, run consented promo blasts, deflect support.
- **Aurora ops** (internal): monitor agents, QA transcripts, manage billing/compliance/consent.

### Key Design Principles

1. **The `VoiceProvider` abstraction** — all call control (start, stream events, function-call hooks, voicemail detection, end) goes through one interface with two implementations: `ManagedProvider` (Vapi, MVP) and `SelfHostedProvider` (Pipecat, Phase 4). The app never imports a vendor SDK directly. This lets a 2-person team ship now and cut COGS later without a rewrite.
2. **The `CampaignEngine`** — outbound is not "loop and call." It is a scheduler (windows/timezones/calling-hours) + rate-limited dialer (concurrency cap) + a **pre-dial gate** (consent ✓, DNC ✓, hours ✓) + retry state machine + voicemail-drop handling, running as a worker off a queue so it scales independently of the API and never blocks the request path.

---

## System Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                  FRONTEND CONSOLE (React + TS)                    │
│  Pages: Onboarding, Agents, Integrations, Campaigns,             │
│         Live Monitor, Calls/Transcripts, Outcomes, Billing       │
│  Realtime wallet/usage + live campaign progress (Supabase RT)    │
└─────────────────────────────────────────────────────────────────┘
                          │ HTTPS / REST + webhooks
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   APP LAYER (Bun + Hono + TS)                     │
│  Auth · Agents · Campaigns · Billing · Webhook handlers          │
│  ┌───────────────┐ ┌──────────────────┐ ┌────────────────────┐   │
│  │ VoiceProvider │ │ Integration      │ │ CampaignEngine      │   │
│  │ (abstraction) │ │ providers        │ │ scheduler + dialer  │   │
│  │ MVP: Vapi     │ │ Shopify/Cal.com/ │ │ consent+DNC+hours    │   │
│  │ P4: Pipecat   │ │ Calendar/CRM/Zap │ │ + retry + voicemail │   │
│  └───────────────┘ └──────────────────┘ └────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐   ┌──────────────────┐   ┌──────────────────────┐
│ Voice Runtime │   │ External APIs     │   │ SUPABASE              │
│ MVP: Vapi     │   │ Shopify GraphQL   │   │ Postgres (RLS)        │
│ P4: Pipecat + │   │ Cal.com / Google /│   │ Auth · Realtime       │
│ Twilio/DG/TTS │   │ Outlook / Stripe  │   │ Edge Functions · Storage│
└───────────────┘   └──────────────────┘   └──────────────────────┘
                                            ┌──────────────────────┐
                                            │ Upstash Redis (queue) │
                                            │ dialer queue · state  │
                                            │ rate limits           │
                                            └──────────────────────┘
```

### Architectural Decisions

| Concern | Choice | Rationale |
|---|---|---|
| App layer | **Bun + Hono + TypeScript** | Fast, single-language, fits a 2-dev team. |
| Data + Auth + Realtime + Storage | **Supabase** (Postgres + RLS + Auth + Realtime + Edge Functions + Storage) | One platform removes glue; Realtime powers the live monitor; Edge Functions host inbound webhooks; RLS enforces tenant isolation at the DB layer. |
| Queue/cache | **Upstash Redis** (or Supabase queue) | Campaign dialer queue, call session state, rate limits — keeps the worker off the request path. |
| Voice runtime (MVP) | **Vapi** (primary) | Best-in-class outbound/campaign primitives, high concurrency, squads/workflows, BYO Twilio, voicemail detection. |
| Voice runtime (P4) | **Pipecat + Twilio/Deepgram/OpenAI/ElevenLabs** | Owns COGS at scale (~$0.06/min). |
| Billing | **Stripe** (subscriptions + metered) | Standard metered minutes. |
| Multi-tenancy | **Shared tables + RLS by `org_id`** | Recommended SaaS model; schema/DB-per-tenant is ops a 2-dev team can't carry. |

---

## Database Design & ER Diagrams

### Entity Relationship Diagram

```
                         ┌────────────┐
                         │   orgs     │  (tenant root)
                         └─────┬──────┘
        ┌──────────────┬──────┼───────────────┬──────────────┐
        │              │      │               │              │
   ┌────▼───┐   ┌──────▼──┐ ┌─▼──────────┐ ┌──▼─────────┐ ┌──▼──────────┐
   │ users  │   │ agents  │ │integrations│ │ contacts   │ │subscriptions│
   └────────┘   └────┬────┘ └────────────┘ └────┬───────┘ └──────────────┘
                     │                          │
              ┌──────▼──────┐            ┌───────▼─────────┐
              │ campaigns   │            │ consent_events  │ (append-only)
              └──────┬──────┘            └─────────────────┘
                     │                   ┌─────────────────┐
              ┌──────▼──────┐            │ dnc_list        │
              │campaign_    │            └─────────────────┘
              │ targets     │  (dialer state machine rows)
              └──────┬──────┘
                     │  1:N transitions (append-only)
              ┌──────▼─────────┐
              │dialer_         │
              │ transitions    │
              └────────────────┘

   ┌─────────┐   ┌──────────────┐   ┌──────────────┐   ┌───────────────┐
   │ calls   │──▶│ call_events  │   │ usage_ledger │   │ webhook_events│
   └────┬────┘   └──────────────┘   └──────────────┘   └───────────────┘
        │  recording_url → Supabase Storage (org-scoped bucket)
        └─ FK: agent_id, campaign_id?, contact_id?

Every table except `orgs` carries org_id → orgs.id (RLS isolation key).
```

### Multi-Tenancy Model

**Decision: shared tables + RLS by `org_id`** (recommended for this SaaS).

- Every tenant-scoped row carries `org_id uuid NOT NULL`, never nullable, never updatable.
- Postgres **Row Level Security** enforces isolation *at the database layer*, not the application — a missed `WHERE` clause cannot leak cross-tenant data.
- Schema-per-tenant and DB-per-tenant were rejected: they multiply migration and ops cost beyond what a 2-dev team can carry, and RLS was already chosen as a hard (Tier-1) invariant.
- Primary keys are `uuid` (`gen_random_uuid()`) so IDs are non-enumerable and safe in URLs/webhooks.

### Risk Tiering of the Schema

Tables are classified by blast radius. This governs who may author the code that touches them.

| Tier | Tables | Rule |
|---|---|---|
| **Tier-1 (legal-critical)** | `consent_events`, `dnc_list`, `campaign_targets` (dialer state), `usage_ledger`, `webhook_events`, RLS policies | Human-authored. Most-tested code in the system. |
| **Tier-2** | `campaigns`, `calls`, `contacts`, `subscriptions` | Drafted with care, human-reviewed. |
| **Tier-3** | `agents`, `integrations`, `call_events` | Standard CRUD. |

### Database Tables Specification

#### Enums (native Postgres types)

```sql
create type user_role         as enum ('owner','admin','ops');
create type integration_type  as enum ('shopify','calcom','google_cal','outlook_cal','crm','zapier','twilio');
create type call_direction    as enum ('inbound','outbound');
create type voice_provider     as enum ('vapi','retell','pipecat');
create type contact_source     as enum ('shopify','crm','upload','inbound');
create type consent_status     as enum ('granted','none','revoked');
create type consent_event_kind as enum ('grant','revoke','import_attest','expiry');
create type consent_channel    as enum ('voice','sms','web_form','shopify_optin','manual');
create type campaign_status    as enum ('draft','scheduled','running','paused','completed','canceled');
create type target_state       as enum ('queued','suppressed','dialing','ringing','in_call',
                                        'completed','failed','voicemail','retry_wait','do_not_call');
create type call_status        as enum ('queued','ringing','in_progress','completed',
                                        'failed','no_answer','busy','voicemail','canceled');
create type meter_kind         as enum ('voice_minutes','sms','overage_minutes','campaign_call');
create type webhook_source     as enum ('vapi','retell','pipecat','shopify','stripe','calcom','twilio');
```

#### 1. **orgs** (Tenant root)
```sql
Columns:
- id (UUID, PK)
- name (Text)
- plan_id (Text)          -- maps to Stripe plan
- created_at (Timestamptz)
- deleted_at (Timestamptz, nullable)   -- soft delete

Notes: the ONLY table without org_id (it IS the org). All other tables FK to orgs.
```

#### 2. **users** (linked to Supabase auth.users)
```sql
Relationships: id → auth.users(id) CASCADE; org_id → orgs(id) CASCADE
Columns:
- id (UUID, PK)           -- = auth.users.id
- org_id (UUID, FK)
- email (Text)
- role (user_role)        -- owner | admin | ops
- created_at (Timestamptz)
Index: (org_id)
RLS: org-isolated (see §Security)
```

#### 3. **agents** (Voice agent config)  — Tier 3
```sql
Columns:
- id (UUID, PK)
- org_id (UUID, FK)
- name (Text)
- vertical (Text)
- persona (JSONB)         -- prompt/persona config
- voice_id (Text)
- inbound_number (Text)
- provider (voice_provider, default 'vapi')
- provider_ref (Text)     -- external assistant/agent id
- created_at, updated_at (Timestamptz), deleted_at (nullable)
Index: (org_id)
```

#### 4. **integrations** (Connected apps)  — Tier 3
```sql
Columns:
- id (UUID, PK)
- org_id (UUID, FK)
- type (integration_type) -- shopify | calcom | ... 
- config (JSONB)          -- NON-secret config
- secret_ref (Text)       -- pointer to Supabase Vault/KMS, NEVER a raw token
- status (Text, default 'active')
- created_at (Timestamptz)
Constraint: UNIQUE (org_id, type)

Design rule: secrets never stored as plaintext columns — a DB dump must not be a credential breach.
```

#### 5. **contacts** (Call targets)  — Tier 2
```sql
Relationships: org_id → orgs CASCADE
Columns:
- id (UUID, PK)
- org_id (UUID, FK)
- e164 (Text)             -- normalized +country phone
- name, email (Text)
- source (contact_source)
- crm_ref (Text)
- consent_status (consent_status, default 'none')  -- DENORMALIZED CACHE (trigger-maintained)
- consent_ts (Timestamptz)
- created_at, updated_at, deleted_at
Constraint: UNIQUE (org_id, e164)
Indexes: (org_id), (org_id, consent_status)

CRITICAL: consent_status is a cache. The append-only consent_events ledger is the source of truth.
```

#### 6. **consent_events** (Consent ledger — APPEND-ONLY)  — Tier 1
```sql
Columns:
- id (UUID, PK)
- org_id (UUID, FK)
- e164 (Text)             -- keyed on NUMBER, survives contact delete/re-import
- contact_id (UUID, FK, ON DELETE SET NULL)
- kind (consent_event_kind)  -- grant | revoke | import_attest | expiry
- channel (consent_channel)  -- how consent was captured/withdrawn
- evidence (JSONB)        -- recording_url, form payload, SMS body, IP, operator
- occurred_at, created_at (Timestamptz)
Index: (org_id, e164, occurred_at DESC)

Immutability: NO update/delete policy + a BEFORE UPDATE/DELETE trigger raises an exception.
This is the legal record of truth for TCPA defense.
```

#### 7. **dnc_list** (Suppression — keyed on number)  — Tier 1
```sql
Columns:
- org_id (UUID, FK)
- e164 (Text)
- reason (Text)           -- opt_out | global_suppression | complaint | manual | gdpr_erased
- added_at (Timestamptz)
- source_event_id (UUID, FK → consent_events)
Primary Key: (org_id, e164)   -- idempotent: re-adding is a no-op upsert

Keyed on the number, not the contact, so suppression survives delete/re-import.
```

#### 8. **campaigns** (Outbound campaigns)  — Tier 2
```sql
Columns:
- id (UUID, PK)
- org_id (UUID, FK)
- agent_id (UUID, FK)
- name (Text)
- status (campaign_status)   -- draft | scheduled | running | paused | completed | canceled
- window_start, window_end (Timestamptz)
- calling_tz (Text)
- concurrency (Int, default 5)
- max_retries (Int, default 2)
- created_at, updated_at
Index: (org_id, status)
```

#### 9. **campaign_targets** (Dialer state machine)  — Tier 1
```sql
Columns:
- id (UUID, PK)
- org_id (UUID, FK)
- campaign_id (UUID, FK CASCADE)
- contact_id (UUID, FK)
- state (target_state)       -- queued | suppressed | dialing | ringing | in_call | 
                             --   completed | failed | voicemail | retry_wait | do_not_call
- attempts (Int)
- next_attempt_at (Timestamptz)
- lease_token (UUID)         -- idempotent dial claim (see Triggers/Functions)
- lease_expires_at (Timestamptz)
- last_call_id (UUID)
- created_at, updated_at
Constraint: UNIQUE (campaign_id, contact_id)   -- a contact appears once per campaign
Indexes:
- (org_id, campaign_id, state)
- PARTIAL (campaign_id, next_attempt_at) WHERE state IN ('queued','retry_wait')  -- dialer poll

The ROWS ARE the state machine. Every transition is appended to dialer_transitions.
```

#### 10. **dialer_transitions** (Transition log — APPEND-ONLY)  — Tier 1
```sql
Columns:
- id (UUID, PK), org_id (UUID, FK)
- target_id (UUID, FK CASCADE)
- from_state, to_state (target_state)
- reason (Text), call_id (UUID)
- occurred_at (Timestamptz)
Index: (target_id, occurred_at)
Purpose: audit + replay/debug of every dialer decision.
```

#### 11. **calls** (Call records)  — Tier 2
```sql
Columns:
- id (UUID, PK), org_id (UUID, FK)
- agent_id (UUID, FK), campaign_id (UUID, FK nullable), contact_id (UUID, FK nullable)
- direction (call_direction)
- status (call_status)
- provider (voice_provider)
- provider_call_id (Text)    -- external id for reconciliation
- started_at, ended_at (Timestamptz), duration_sec (Int)
- cost_usd (Numeric 12,4)    -- COGS, NOT what we bill
- outcome (JSONB)            -- booked | recovered_cart | deflected | opt_out ...
- transcript (JSONB)         -- inline if small; pointer to Storage if large
- recording_url (Text)       -- Supabase Storage path, org-scoped bucket
- created_at
Constraint: UNIQUE (provider, provider_call_id)   -- reconciliation idempotency
Indexes: (org_id, created_at DESC), (org_id, campaign_id), (org_id, contact_id)
```

#### 12. **call_events** (Per-call event stream — PARTITIONED)  — Tier 3
```sql
Columns:
- id (UUID, PK), org_id (UUID), call_id (UUID, FK CASCADE)
- kind (Text)                -- transcript_partial | tool_call | voicemail_detected ...
- payload (JSONB)
- occurred_at (Timestamptz)
PARTITION BY RANGE (occurred_at)   -- monthly partitions; high write volume

Index discipline: only (call_id, occurred_at) matters — it is write-heavy, do not over-index.
```

#### 13. **subscriptions** (Billing plan state)  — Tier 2
```sql
Columns:
- org_id (UUID, PK, FK)
- stripe_customer_id, stripe_subscription_id (Text)
- plan_id (Text)
- included_minutes (Int)
- status (Text, default 'active')
- period_start, period_end (Timestamptz)
- updated_at
```

#### 14. **usage_ledger** (Metering — APPEND-ONLY, PARTITIONED)  — Tier 1
```sql
Columns:
- id (UUID, PK), org_id (UUID, FK)
- kind (meter_kind)          -- voice_minutes | sms | overage_minutes | campaign_call
- quantity (Numeric 12,4)
- call_id (UUID, FK)
- period (Date)              -- billing month this falls in
- idempotency_key (Text)     -- = provider_call_id + segment
- occurred_at (Timestamptz)
Constraint: UNIQUE (org_id, idempotency_key)   -- cannot double-bill a segment
Index: (org_id, period, kind)
PARTITION BY RANGE (occurred_at)

Source of truth for invoicing. Never compute billing from calls.cost_usd (that is COGS).
```

#### 15. **webhook_events** (Inbound webhook ledger — APPEND-ONLY, PARTITIONED)  — Tier 1
```sql
Columns:
- id (UUID, PK), org_id (UUID, nullable until signature-verified)
- source (webhook_source)    -- vapi | stripe | shopify | twilio | ...
- external_id (Text)         -- provider event id
- signature_ok (Boolean)
- payload (JSONB)
- processed_at (Timestamptz, nullable)
- received_at (Timestamptz)
Constraint: UNIQUE (source, external_id)   -- dedup: duplicate delivery = no-op insert
PARTITION BY RANGE (received_at)

Every inbound webhook lands here BEFORE business logic. Gives at-least-once delivery +
exactly-once effect + a replayable audit of everything that hit the system.
```

### Key Database Constraints

| Constraint | Purpose | Implementation |
|---|---|---|
| Tenant isolation | No cross-org data access | RLS policy `org_id = auth_org()` on every tenant table |
| Consent immutability | TCPA legal record can't be altered | No UPDATE/DELETE policy + BEFORE-trigger on `consent_events` |
| DNC idempotency | Re-suppression is safe | PK `(org_id, e164)` + `ON CONFLICT DO NOTHING` |
| One dial per target | No double-dial | `lease_token` claim with `FOR UPDATE SKIP LOCKED` |
| One contact per campaign | No duplicate targets | UNIQUE `(campaign_id, contact_id)` |
| No double-billing | Each call segment billed once | UNIQUE `(org_id, idempotency_key)` on `usage_ledger` |
| Webhook dedup | Exactly-once effect | UNIQUE `(source, external_id)` |
| Call reconciliation | One record per provider call | UNIQUE `(provider, provider_call_id)` |
| Secret safety | DB dump ≠ credential breach | `secret_ref` pointer to Vault, never raw tokens |

### Indexing & Partitioning Strategy

The red-team flagged **Supabase connection limits / RLS performance at high write volume from call events** as a top-3 future bottleneck. Mitigations:

- **Connection pooling:** route the dialer worker + API through **Supavisor (transaction mode)** — bursty workers keep the connection count flat.
- **Partition hot append tables by month:** `call_events`, `usage_ledger`, `webhook_events`. Automate next-month partition creation via `pg_cron`; detach + archive old partitions (ties into retention).
- **Index inventory (the ones that matter):**

| Table | Index | Serves |
|---|---|---|
| `contacts` | `(org_id, e164)` unique | pre-dial lookup, import dedup |
| `dnc_list` | `(org_id, e164)` PK | DNC check in `can_dial` |
| `campaign_targets` | partial `(campaign_id, next_attempt_at) WHERE state IN (queued,retry_wait)` | dialer poll |
| `consent_events` | `(org_id, e164, occurred_at DESC)` | latest-consent / audit |
| `calls` | `(org_id, created_at DESC)` | dashboard feed |
| `usage_ledger` | `(org_id, period, kind)` | billing rollup |

- **RLS performance:** keep policy predicates trivial (`org_id = auth_org()`), wrap the org lookup in a `stable` SQL function so the planner caches it per-statement, and always filter `org_id` in queries too — don't make RLS do the index work.

### Triggers & Atomic Functions

#### Append-only immutability trigger
```sql
create or replace function block_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'append-only table: % may not be updated or deleted', tg_table_name;
end $$;
-- applied to: consent_events, usage_ledger, webhook_events, dialer_transitions
```

#### Consent application + DNC propagation (trigger on `consent_events` insert)
```sql
-- On a 'revoke' event, in ONE transaction:
--   1. flip contacts.consent_status cache to 'revoked'
--   2. upsert dnc_list (idempotent, ON CONFLICT DO NOTHING)
--   3. flip any queued/retry_wait campaign_targets for that number to 'do_not_call'
-- => opt-out is honored in the same run AND all future runs (US-24).
```

#### The single pre-dial gate
```sql
-- Returns true only if the number may be dialed RIGHT NOW.
create or replace function can_dial(p_org uuid, p_e164 text, p_now timestamptz, p_tz text)
returns boolean language sql stable as $$
  select
        exists (select 1 from contacts
                 where org_id=p_org and e164=p_e164
                   and consent_status='granted' and deleted_at is null)   -- consent
    and not exists (select 1 from dnc_list where org_id=p_org and e164=p_e164)  -- not DNC
    and extract(hour from (p_now at time zone p_tz)) between 9 and 19;          -- calling hours
$$;
```

#### Idempotent dial claim (lease pattern)
```sql
-- Atomically claim up to N dialable targets; SKIP LOCKED avoids contention.
update campaign_targets t
   set state='dialing', lease_token=gen_random_uuid(),
       lease_expires_at=now()+interval '90 seconds', attempts=attempts+1, updated_at=now()
 where t.id in (
   select id from campaign_targets
    where campaign_id=$1 and state in ('queued','retry_wait')
      and (next_attempt_at is null or next_attempt_at<=now())
    order by next_attempt_at nulls first
    for update skip locked limit $2)
returning t.id, t.contact_id, t.lease_token;
-- can_dial() is re-checked before the provider call is actually placed.
-- A sweeper reclaims 'dialing' rows whose lease expired (crashed worker).
```

---

## Data Flow & Workflows

### Inbound call
```
Caller dials agent number
  → Voice runtime answers (Vapi) → streams events to app via webhook (Edge Function)
  → webhook_events insert (signature verified, deduped)
  → agent runs playbook; function-calls hit Integration providers (Shopify order lookup, etc.)
  → call ends → calls row finalized → usage_ledger entry → outcome recorded
  → Realtime pushes update to console
```

### Outbound campaign (the CampaignEngine)
```
Merchant uploads/segments list → campaign + campaign_targets (state='queued')
  → Scheduler respects window/timezone/calling-hours
  → Dialer worker claims targets (lease, SKIP LOCKED) up to concurrency cap
     → re-check can_dial() ──false──▶ state='suppressed' (logged, never dialed)
     └──true──▶ place call via VoiceProvider → state='dialing'→'ringing'→'in_call'
  → call-status webhook (carries lease_token) → validate token → apply transition
  → on complete: calls finalized, usage_ledger entry, retry logic if no-answer
  → every transition appended to dialer_transitions
```

### Opt-out propagation (legal-critical)
```
Mid-call "stop" / SMS STOP / web form
  → insert consent_events(kind='revoke')
  → trigger: cache→'revoked' + dnc_list upsert + queued targets→'do_not_call'
  → number never dialed again, in this run or any future run
```

### Billing rollup (nightly, pg_cron + worker)
```
sum(usage_ledger.quantity) per org per period
  → overage = max(0, used − included_minutes)
  → push Stripe metered usage record (idempotent on period+org)
  → fire 80% / 100% cap alerts
  → reconcile sum(ledger) vs calls-derived minutes; drift > threshold pages a human
```

---

## Feature Specifications

| Feature | Description | Acceptance Criteria |
|---|---|---|
| **Onboarding (<10 min)** | Connect store/calendar/CRM, agent goes live | Test event round-trips; agent answers a test call |
| **Inbound agent** | Answers calls, runs playbook, escalates to human | Order-lookup function-call resolves; transcript logged |
| **Shopify cart recovery** | Abandoned checkout (>1h, consented) → agent calls, can issue discount | TCPA consent verified pre-dial; conversion logged |
| **Outbound campaigns** | Upload/segment list, schedule window, run at concurrency with retry | Runs within window; concurrency respected; per-call outcomes |
| **Consent + DNC enforcement** | Every target checked vs consent + DNC + hours *before* dialing | A DNC/no-consent number is **never** dialed; logged as suppressed |
| **Opt-out** | Mid/post-call "stop", SMS STOP → immediate DNC | Honored within same run + all future runs |
| **Voicemail drop** | Detect voicemail, leave a pre-recorded message | Detection event recorded; drop logged |
| **Outcomes dashboard** | Calls handled, deflection, carts recovered + $, bookings, opt-out rate | Per-outcome metrics filterable by date/agent/campaign |
| **Live campaign monitor** | Real-time progress of a running campaign | Supabase Realtime feed of target state changes |
| **Billing** | Plan w/ included minutes, live usage, overage, cap alerts | Stripe subscription + metered usage; 80/100% alerts |

---

## Technology Stack

**Frontend (Console)**
- React + TypeScript (scaffolded with Bolt.new)
- Supabase JS client + Realtime (live wallet/usage + campaign monitor)

**App Layer**
- **Bun** runtime, **Hono** HTTP framework, TypeScript
- `VoiceProvider` abstraction (ManagedProvider=Vapi, SelfHostedProvider=Pipecat)
- `CampaignEngine` worker (scheduler + dialer + pre-dial gate + retry)
- Integration providers: Shopify GraphQL Admin API, Cal.com, Google/Outlook Calendar, CRM, Zapier/webhooks

**Backend / Data**
- **Supabase**: Postgres 15 (RLS), Auth, Realtime, Edge Functions (Deno) for inbound webhooks, Storage (recordings)
- **Upstash Redis** (or Supabase queue): dialer queue, call session state, rate limits
- Migrations: forward-only SQL files in `supabase/migrations/`

**Voice Runtime**
- MVP: **Vapi** (primary) — telephony + STT + LLM + TTS orchestration, barge-in, voicemail detection
- Phase 4: **Pipecat** + Twilio/Deepgram/OpenAI/ElevenLabs (self-host, COGS)
- Fallback: Retell (drop-in via the abstraction)

**Billing & Comms**
- **Stripe** (subscriptions + metered usage)
- Twilio SMS for confirmations / opt-out (STOP) handling

**Compliance**
- Vendor BAA chain (Twilio/Deepgram/OpenAI/ElevenLabs/Vapi enterprise) for HIPAA posture
- TCPA consent/DNC subsystem, immutable audit ledgers, PHI redaction

---

## API & Database Operations

### Atomic, server-side credit-sensitive operations
All multi-step, legal-critical operations execute server-side, never as a chain of client calls.

| Operation | Steps (atomic) |
|---|---|
| **Enqueue campaign target** | validate consent state → insert `campaign_targets` (`queued`) → enforce UNIQUE(campaign, contact) |
| **Claim & dial** | lease-claim row (`FOR UPDATE SKIP LOCKED`) → `can_dial()` re-check → place provider call → transition to `dialing` + append `dialer_transitions` |
| **Apply call-status webhook** | verify signature → dedup insert `webhook_events` → validate `lease_token` → transition → finalize `calls` → one `usage_ledger` entry |
| **Apply consent revoke** | insert `consent_events(revoke)` → trigger flips cache + DNC + queued targets — one transaction |
| **Billing rollup** | aggregate `usage_ledger` → compute overage → idempotent Stripe metered record |

### Webhook handler contract (Edge Function)
1. **Verify signature first** — reject if bad (`signature_ok=false`, no processing).
2. `insert … on conflict (source, external_id) do nothing returning id` — if no row returned, it's a duplicate → ack 200 and stop (idempotent).
3. Process inside a transaction; set `processed_at = now()`.
4. For voice-status webhooks, validate `lease_token` before applying any dialer transition.

### Idempotency guarantees (CI invariants)
- `consent-invariant` — no `dialing` transition without a prior `can_dial()=true`.
- `optout-propagation` — a `revoke` flips cache + DNC + queued targets in one transaction.
- `idempotency` / `webhook-sig` — duplicate webhooks/retries produce exactly one effect.
- `rls-coverage` — every `org_id` table has RLS enabled + an isolation policy.

---

## Security & RLS Policies

### Authentication Flow
1. **Sign up / Sign in** — Supabase Auth (email/password + OAuth). Session token carries an `org_id` claim set at login.
2. **App layer / Edge Functions** use the service role for system operations and **must filter `org_id` explicitly** (service role bypasses RLS).
3. **Secrets** live in Supabase Vault/KMS, referenced by `secret_ref` — never plaintext columns.

### RLS Policy Structure

```sql
-- caller's org from JWT claim
create or replace function auth_org() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id','')::uuid
$$;

-- standard tenant table: one isolation policy
alter table contacts enable row level security;
create policy contacts_isolation on contacts
  using (org_id = auth_org())
  with check (org_id = auth_org());
-- repeated for: agents, integrations, campaigns, campaign_targets, calls,
--               call_events, subscriptions, usage_ledger
```

#### Append-only tables (read + insert, never mutate)
```sql
alter table consent_events enable row level security;
create policy consent_read   on consent_events for select using (org_id = auth_org());
create policy consent_insert on consent_events for insert with check (org_id = auth_org());
-- NO update/delete policy → those operations denied for all non-service roles.
-- The audit trail cannot be altered, even by the org owner, via the API.
```

### Attack Prevention

| Threat | Mitigation |
|---|---|
| **Cross-tenant data access** | RLS `org_id = auth_org()` on every table; `rls-coverage` CI test fails the build if any table lacks a policy |
| **Illegal dial (TCPA)** | Single `can_dial()` gate (consent ✓ / DNC ✓ / hours ✓), re-checked at claim time; `consent-invariant` property test |
| **Opt-out not honored** | Trigger propagates revoke → cache + DNC + queued targets atomically; `optout-propagation` test |
| **Audit tampering** | Append-only ledgers (`consent_events`, `usage_ledger`, `webhook_events`, `dialer_transitions`) with mutation-blocking trigger |
| **Double-dial / double-bill** | Lease-token claim (`SKIP LOCKED`); UNIQUE idempotency keys; webhook dedup; fuzz test fires duplicate webhooks |
| **Dialer abuse / spam** | Concurrency caps, velocity limits, fraud/abuse controls on the dialer (anti-spam) |
| **Webhook spoofing** | Signature verified before any processing (`webhook-sig` test) |
| **Credential leak from DB dump** | Secrets in Vault, only `secret_ref` in Postgres |
| **PHI exposure** | Vendor BAA chain + PHI redaction; recordings in org-scoped Storage with mirrored RLS |

### Data Retention, PITR & GDPR Erasure

| Concern | Approach |
|---|---|
| Backups | Supabase daily automated backups; quarterly restore verification |
| PITR | Point-in-Time Recovery enabled; RPO ≤ 5 min for consent/billing tables |
| Retention | Recordings 90d, `call_events` 180d (per-org configurable); enforced by dropping monthly partitions |
| Legal hold | `consent_events` + `dnc_list` exempt from routine deletion (TCPA defense, ≥5y) |
| **GDPR / CCPA erasure** | Hard-delete `contacts` + scrub call PII/recordings, but keep a **non-identifiable suppression tombstone** (hashed E.164) in `dnc_list` so the number stays suppressed without retaining PII — resolving the "delete everything" vs "never call again" conflict |

---

**END OF AURORA BLACK BOOK (Core)**

This document follows the SkillBarter Black Book structure (Core sections). For the full design rationale see the Aurora Database Design Guide; for product scope see the PRD; for risk analysis see the Red-Team Review.
