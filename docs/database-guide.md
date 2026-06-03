# Aurora — Database Design Guide

**Stack:** Supabase (Postgres 15) · RLS-enforced multi-tenancy · Drizzle/SQL migrations
**Scope:** Schema + ERD, RLS, consent/DNC + audit, dialer state machine, billing/metering, migrations, indexes/partitioning, backups/PITR/GDPR, webhook ledger, call-record storage.
**Audience:** the 2 engineers. Design-doc depth with copy-ready DDL for the load-bearing pieces.

> **Legal-critical reminder:** the consent/DNC tables, the dialer state machine, the metering ledger, and RLS are **Tier-1**. Human-authored. Agents may write tests and review only. Everything in this doc that touches those is written to be the *most-tested code in the system*.

---

## 0. Decisions (binding)

| Decision | Choice | Why |
|---|---|---|
| **Multi-tenancy** | **Shared tables + RLS by `org_id`** | Recommended for this SaaS. One schema, every tenant row carries `org_id`, Postgres RLS enforces isolation at the DB layer — not the app. Schema-per-tenant and DB-per-tenant add migration/ops cost a 2-dev team can't carry, and you already chose RLS as a Tier-1 invariant. |
| **Primary keys** | `uuid` (`gen_random_uuid()`) | No enumerable IDs leaking across tenants; safe in URLs/webhooks. |
| **Tenant key** | `org_id uuid NOT NULL` on **every** tenant-scoped table | The single column every RLS policy keys on. Never nullable, never updatable. |
| **Timestamps** | `created_at`, `updated_at timestamptz default now()` | UTC always. Display TZ is per-org/per-contact, computed in app. |
| **Soft vs hard delete** | Soft-delete app data (`deleted_at`); **hard-delete on GDPR erasure** | See §9. |
| **Money** | `numeric(12,4)` USD; minutes/seconds as integers | No floats for billing. Ever. |
| **Append-only ledgers** | `consent_events`, `usage_ledger`, `webhook_events`, `dialer_transitions` are **insert-only** | Immutability is the audit guarantee. Enforced by trigger + RLS (no UPDATE/DELETE policy). |

---

## 1. ERD (logical)

```
                         ┌────────────┐
                         │   orgs     │  (tenant root)
                         └─────┬──────┘
        ┌──────────────┬──────┼───────────────┬──────────────┐
        │              │      │               │              │
   ┌────▼───┐   ┌──────▼──┐ ┌─▼──────────┐ ┌──▼─────────┐ ┌──▼──────────┐
   │ users  │   │ agents  │ │integrations│ │ contacts   │ │ subscriptions│
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

  ── User-flow / knowledge / numbers round (see §3.1) ──
   vertical_configs (GLOBAL) ──◀ orgs.vertical_config_id
   orgs ─1:1─ onboarding_state          (dashboard checklist)
   orgs ─1:N─ knowledge_sources ─1:N─ knowledge_chunks (pgvector)
   agents ─N:N─ knowledge_sources       via agent_knowledge (subscribe)
   orgs ─1:1─ twilio_subaccounts        (Aurora-managed path)
   orgs ─1:N─ phone_numbers ──▶ agents  (number bound to agent)
   orgs ─1:N─ notifications · webhook_endpoints
```

Every box except `orgs` **and `vertical_configs`** carries `org_id` → `orgs.id`. (`vertical_configs` is global platform config; `orgs` is the tenant root.)

---

## 2. Enums (Postgres native types)

```sql
create type user_role        as enum ('owner','admin','ops');
create type integration_type as enum ('shopify','calcom','google_cal','outlook_cal','crm','zapier','twilio');
create type call_direction   as enum ('inbound','outbound');
create type voice_provider    as enum ('vapi','retell','pipecat');
create type contact_source    as enum ('shopify','crm','upload','inbound');
create type consent_status    as enum ('granted','none','revoked');         -- denormalized cache on contacts
create type consent_event_kind as enum ('grant','revoke','import_attest','expiry');
create type consent_channel   as enum ('voice','sms','web_form','shopify_optin','manual');
create type campaign_status    as enum ('draft','scheduled','running','paused','completed','canceled');
create type target_state       as enum ('queued','suppressed','dialing','ringing','in_call','completed','failed','voicemail','retry_wait','do_not_call');
create type call_status        as enum ('queued','ringing','in_progress','completed','failed','no_answer','busy','voicemail','canceled');
create type meter_kind         as enum ('voice_minutes','sms','overage_minutes','campaign_call');
create type webhook_source     as enum ('vapi','retell','pipecat','shopify','stripe','calcom','twilio');

-- New (user-flow / knowledge / numbers round)
create type onboarding_step    as enum ('pick_vertical','connect_tools','add_knowledge','create_agent','get_number','test_and_golive');
create type knowledge_kind      as enum ('document','website','integration');   -- how a source was added
create type knowledge_status    as enum ('processing','ready','error','syncing');
create type number_owner        as enum ('aurora','tenant');                    -- aurora-managed subaccount vs BYO
create type notification_kind   as enum ('missed_call','voicemail','campaign_done','billing','integration_broken');
```

> Enums over `text + check`: they're self-documenting, index-friendly, and the agent CI lint (`sdk-import-lint`) can assert no raw string states leak into the dialer code.

---

## 3. Core tenant tables (key DDL)

```sql
-- Tenant root. The ONLY table without org_id (it IS the org).
create table orgs (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  plan_id            text,                       -- maps to Stripe price/plan
  vertical_config_id uuid references vertical_configs(id),  -- which vertical (NOT hardcoded)
  branding           jsonb not null default '{}', -- whitelabel: { logo_url, primary_color } for multi-tenant future
  created_at         timestamptz not null default now(),
  deleted_at         timestamptz
);

-- Linked 1:1 to Supabase auth.users
create table users (
  id          uuid primary key references auth.users(id) on delete cascade,
  org_id      uuid not null references orgs(id) on delete cascade,
  email       text not null,
  role        user_role not null default 'ops',
  created_at  timestamptz not null default now()
);
create index on users (org_id);

create table agents (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references orgs(id) on delete cascade,
  name            text not null,
  vertical        text,                     -- denormalized convenience; source of truth = orgs.vertical_config_id
  persona         jsonb not null default '{}',  -- composed system prompt + first_message + objective + voices[] (see Template Library)
  voice_id        text,                     -- primary voice
  languages       text[] not null default '{en}',  -- EN/ES v1; per-language backup voices live in persona.voices[]
  inbound_number  text,                     -- legacy/quick ref; canonical link is phone_numbers.agent_id
  business_hours  jsonb not null default '{}',  -- { mon:[9,18], ... } — feeds can_dial() hours check
  timezone        text not null default 'UTC',
  transfer_number text,                     -- escalation: hand off to a human (E.164)
  consent_required boolean not null default false,  -- TCPA gate; FORCED true for any outbound agent (trigger below). Cannot be unset.
  provider        voice_provider not null default 'vapi',
  provider_ref    text,                     -- external assistant/agent id
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index on agents (org_id);

-- An agent is "outbound-capable" if its persona.direction includes outbound (or both).
-- consent_required must be TRUE for any such agent and may never be set back to false.
-- This is a hard DB invariant, not a UI nicety — it backs scope §I non-negotiable #1.
create or replace function force_outbound_consent() returns trigger language plpgsql as $
begin
  if (new.persona ->> 'direction') in ('outbound','both') then
    new.consent_required := true;            -- force on
  end if;
  -- never allow flipping an already-required flag back off
  if tg_op = 'UPDATE' and old.consent_required = true and new.consent_required = false then
    raise exception 'consent_required cannot be unset on agent %', new.id;
  end if;
  return new;
end $;

create trigger agents_force_consent
  before insert or update on agents
  for each row execute function force_outbound_consent();

-- The no-code builder writes friendly fields; they compose into persona (jsonb):
--   name, persona.direction, persona.objective (Goal), persona.voice.tone (Personality),
--   persona.first_message, voice_id (+ persona.voices[]), languages[], business_hours, timezone,
--   transfer_number, and agent_knowledge subscriptions. Advanced toggle exposes persona system prompt + tools.
--   consent_required is read-only in the UI for outbound agents (shown ON, locked) — enforced by the trigger above.

create table integrations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  type        integration_type not null,
  config      jsonb not null default '{}',      -- non-secret config
  secret_ref  text,                              -- pointer to Vault/secret store, NEVER raw token
  status      text not null default 'active',
  created_at  timestamptz not null default now(),
  unique (org_id, type)
);
```

> **Secrets never live in Postgres columns as plaintext.** `secret_ref` points at Supabase Vault (or an external KMS). This keeps a DB dump from being a credential breach.

---

## 3.1 Onboarding, Verticals, Knowledge, Numbers & standard features

> Backs the [User-Flow & Knowledge spec](Aurora-UserFlow-and-Knowledge.md). Every table carries `org_id` and RLS **except** `vertical_configs` (global config, read-only to tenants). Multi-tenant principle: **a vertical is a config row, never hardcoded.**

### Vertical config registry (global)
```sql
-- Global, NOT org-scoped. One row per vertical. App logic reads config; nothing about
-- Shopify/Clinic is hardcoded. Adding a vertical = inserting a row + its templates.
create table vertical_configs (
  id      uuid primary key default gen_random_uuid(),
  key     text not null unique,            -- 'shopify' | 'clinic' | future
  label   text not null,                   -- "Online Store" | "Clinic / Practice"
  config  jsonb not null default '{}',     -- glossary, recommended_integrations[], recommended_template_ids[],
                                           -- knowledge_prompts[], default_contact_fields[]
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
-- RLS: SELECT allowed to all authenticated; no tenant writes (seeded by platform).
```

### Onboarding state (the dashboard checklist)
```sql
-- One row per org, created at signup. Drives the dashboard Setup Checklist card.
create table onboarding_state (
  org_id     uuid primary key references orgs(id) on delete cascade,
  steps      jsonb not null default '{}',  -- { pick_vertical:true, connect_tools:false, ... } per onboarding_step
  dismissed  boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);
```

### Knowledge Base (org-wide library, agents subscribe; RAG over pgvector)
```sql
create extension if not exists vector;   -- pgvector

-- A source = one upload, one crawled site, or one integration pull. Org-wide.
create table knowledge_sources (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  kind        knowledge_kind not null,            -- document | website | integration
  title       text not null,                      -- "Shipping & Returns Policy"
  uri         text,                               -- Storage path (doc), URL (website), or integration ref
  storage_ref text,                               -- Supabase Storage pointer for uploaded files
  status      knowledge_status not null default 'processing',
  meta        jsonb not null default '{}',        -- page_count, chunk_count, last_synced, error_msg
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on knowledge_sources (org_id);

-- Chunked + embedded text. Retrieval is scoped to org_id AND the agent's subscribed sources.
create table knowledge_chunks (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,   -- redundant but lets RLS + ANN filter cheaply
  source_id   uuid not null references knowledge_sources(id) on delete cascade,
  ordinal     int  not null,
  content     text not null,
  embedding   vector(1536),                        -- model-dependent dim
  created_at  timestamptz not null default now()
);
create index on knowledge_chunks (org_id);
create index on knowledge_chunks (source_id);
create index on knowledge_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Which agents use which sources (subscribe model). An agent retrieves ONLY from its subscriptions.
create table agent_knowledge (
  agent_id   uuid not null references agents(id) on delete cascade,
  source_id  uuid not null references knowledge_sources(id) on delete cascade,
  org_id     uuid not null references orgs(id) on delete cascade,
  primary key (agent_id, source_id)
);
create index on agent_knowledge (org_id);
```
> **Retrieval gate:** at call time, similarity search filters `org_id = auth_org()` **and** `source_id IN (this agent's agent_knowledge)`. No agent sees unsubscribed knowledge; no org sees another's (RLS). If no relevant chunk clears the threshold, the agent defers to a human — it does not fabricate (matches every template's guardrail).

### Phone numbers (Twilio: per-tenant subaccount OR BYO)
```sql
-- One Twilio subaccount per org for the Aurora-managed path: isolation + per-tenant billing.
create table twilio_subaccounts (
  org_id         uuid primary key references orgs(id) on delete cascade,
  subaccount_sid text not null,
  secret_ref     text not null,            -- pointer to Vault (auth token), never raw
  status         text not null default 'active',
  created_at     timestamptz not null default now()
);

-- Every number, whether Aurora-purchased (in the subaccount) or brought by the tenant (BYO).
create table phone_numbers (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  e164        text not null,
  owner       number_owner not null,        -- 'aurora' (managed subaccount) | 'tenant' (BYO)
  byo         boolean not null default false,
  agent_id    uuid references agents(id) on delete set null,  -- bound agent (inbound routing / outbound caller-id)
  provider_ref text,                         -- Twilio number SID
  status      text not null default 'active',
  created_at  timestamptz not null default now(),
  unique (org_id, e164)
);
create index on phone_numbers (org_id);
create index on phone_numbers (agent_id);
```
> The provisioning **flow is identical across tenants/verticals** — only integrations + templates differ by vertical. BYO numbers bill to the tenant's own Twilio; Aurora-managed numbers roll up per subaccount so telephony COGS is attributable per org and reconcilable against billed minutes.

### Notifications, escalation & outbound webhooks (standard features)
```sql
create table notifications (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id) on delete cascade,
  user_id    uuid references users(id) on delete cascade,   -- null = whole org
  kind       notification_kind not null,
  payload    jsonb not null default '{}',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index on notifications (org_id, created_at desc);

-- Outbound webhooks / Zapier: fire call outcomes to the tenant's other tools.
create table webhook_endpoints (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  url         text not null,
  events      text[] not null default '{call.completed}',  -- which outcomes to fire on
  secret_ref  text,                                         -- HMAC signing key pointer
  status      text not null default 'active',
  created_at  timestamptz not null default now()
);
create index on webhook_endpoints (org_id);
```
> *Call transfer / escalation* is a column (`agents.transfer_number`), not a table — the agent invokes a transfer mid-call. *Business hours / timezone* (`agents.business_hours`, `agents.timezone`) feed the `can_dial()` hours check. *Recordings + transcripts* and *analytics* reuse the existing `calls` table (`recording_url`, `transcript`, `outcome`) — no new tables. *Whitelabel* is `orgs.branding`.

---

## 4. Contacts + Consent/DNC (Tier-1 — the compliance core)

The red-team flagged this as *the* under-engineered system. Design rules:

1. **Source of truth for consent is the append-only `consent_events` ledger**, not the `contacts.consent_status` column. That column is a **denormalized cache** maintained by trigger — convenient for queries, but the ledger wins disputes.
2. **DNC is a separate hard list**, keyed on the phone number itself (E.164), independent of any contact row, so a number stays suppressed even if the contact is deleted/re-imported.
3. **Revocation propagates everywhere, immediately and idempotently** (US-24). One `revoke` event ⇒ contact cache flips, DNC row upserted, any `queued`/`retry_wait` campaign targets for that number flip to `do_not_call`.
4. **Pre-dial gate reads from a single function** `can_dial(org_id, e164, now)` so there's exactly one place the rule lives.

```sql
create table contacts (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references orgs(id) on delete cascade,
  e164           text not null,                  -- normalized +country
  name           text,
  email          text,
  source         contact_source not null,
  crm_ref        text,
  tags           text[] not null default '{}',   -- campaign audience targeting (segments filter on these)
  fields         jsonb not null default '{}',    -- vertical-specific fields (Shopify: last_order; Clinic: provider, next_appt)
  consent_status consent_status not null default 'none',  -- CACHE, maintained by trigger
  consent_ts     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  unique (org_id, e164)
);
create index on contacts (org_id);
create index on contacts (org_id, consent_status);
create index on contacts using gin (tags);

-- Saved audience filter for the campaign builder (e.g. "Past buyers 90d", "Recall due").
create table segments (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id) on delete cascade,
  name       text not null,
  filter     jsonb not null default '{}',        -- declarative: tags, consent_status, source, field predicates
  created_at timestamptz not null default now(),
  unique (org_id, name)
);
create index on segments (org_id);

-- APPEND-ONLY. No UPDATE/DELETE policy. This is the legal record of truth.
create table consent_events (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  e164        text not null,                       -- key on number, not contact_id (survives delete)
  contact_id  uuid references contacts(id) on delete set null,
  kind        consent_event_kind not null,         -- grant | revoke | import_attest | expiry
  channel     consent_channel not null,            -- how consent was captured/withdrawn
  evidence    jsonb not null default '{}',         -- recording_url, form payload, SMS body, IP, operator
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index on consent_events (org_id, e164, occurred_at desc);

-- DNC / suppression. Keyed on number. Upsert on revoke or "STOP".
create table dnc_list (
  org_id      uuid not null references orgs(id) on delete cascade,
  e164        text not null,
  reason      text not null,                       -- 'opt_out' | 'global_suppression' | 'complaint' | 'manual'
  added_at    timestamptz not null default now(),
  source_event_id uuid references consent_events(id),
  primary key (org_id, e164)                        -- idempotent: re-adding is a no-op upsert
);
```

### 4.1 Immutability enforcement (trigger)

```sql
create or replace function block_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'append-only table: % may not be updated or deleted', tg_table_name;
end $$;

create trigger consent_events_immutable
  before update or delete on consent_events
  for each row execute function block_mutation();
```
Apply the same trigger to `usage_ledger`, `webhook_events`, `dialer_transitions`.

### 4.2 Consent cache + DNC propagation (trigger on `consent_events` insert)

```sql
create or replace function apply_consent_event() returns trigger language plpgsql as $$
begin
  -- update denormalized cache on the matching contact(s)
  update contacts
     set consent_status = case new.kind
            when 'grant'  then 'granted'::consent_status
            when 'revoke' then 'revoked'::consent_status
            when 'expiry' then 'none'::consent_status
            else consent_status end,
         consent_ts = new.occurred_at,
         updated_at = now()
   where org_id = new.org_id and e164 = new.e164;

  -- revocation propagates to DNC + active campaign targets (idempotent)
  if new.kind = 'revoke' then
     insert into dnc_list (org_id, e164, reason, source_event_id)
       values (new.org_id, new.e164, 'opt_out', new.id)
       on conflict (org_id, e164) do nothing;            -- idempotent

     update campaign_targets t
        set state = 'do_not_call', updated_at = now()
       from contacts c
      where t.contact_id = c.id
        and c.org_id = new.org_id and c.e164 = new.e164
        and t.state in ('queued','retry_wait');           -- only stoppable states
  end if;
  return new;
end $$;

create trigger consent_event_applied
  after insert on consent_events
  for each row execute function apply_consent_event();
```

### 4.3 The one and only pre-dial gate

```sql
-- Per-weekday window helper. p_hours shape: { mon:[9,19], tue:[9,19], ... } (inclusive hour range).
-- Empty {} → Mon–Fri 9–19 in p_tz (Settings/UI default before an agent overrides).
create or replace function is_within_business_hours(
  p_hours jsonb, p_tz text, p_now timestamptz
) returns boolean language plpgsql stable as $$
declare
  v_local timestamp; v_dow text; v_hour int; v_window jsonb;
begin
  v_local := p_now at time zone p_tz;
  v_dow := lower(trim(to_char(v_local, 'Dy')));
  v_hour := extract(hour from v_local)::int;
  if p_hours is null or p_hours = '{}'::jsonb then
    return extract(isodow from v_local) between 1 and 5 and v_hour between 9 and 19;
  end if;
  v_window := p_hours -> v_dow;
  if v_window is null or jsonb_array_length(v_window) < 2 then return false; end if;
  return v_hour >= (v_window ->> 0)::int and v_hour <= (v_window ->> 1)::int;
end $$;

-- Returns true only if the number may be dialed RIGHT NOW.
-- p_agent_id (optional): when set, hours check uses agents.business_hours + agents.timezone.
create or replace function can_dial(
  p_org uuid, p_e164 text, p_now timestamptz, p_tz text, p_agent_id uuid default null
)
returns boolean language sql stable as $$
  select
        -- 1. consent granted (read cache; ledger is authority for disputes)
        exists (select 1 from contacts
                 where org_id = p_org and e164 = p_e164
                   and consent_status = 'granted' and deleted_at is null)
        -- 2. not on DNC
    and not exists (select 1 from dnc_list where org_id = p_org and e164 = p_e164)
        -- 3. within agent business_hours (or Mon–Fri 9–19 fallback when p_agent_id omitted)
    and coalesce(
      case when p_agent_id is not null then (
        select is_within_business_hours(
          a.business_hours, coalesce(nullif(a.timezone, ''), p_tz), p_now
        )
        from agents a
        where a.id = p_agent_id and a.org_id = p_org and a.deleted_at is null
      ) else extract(hour from (p_now at time zone p_tz)) between 9 and 19 end,
      false);
$$;
```

> **CI invariant `consent-invariant`:** a property test asserts the dialer worker calls `can_dial()` and gets `true` before *every* `dialing` transition. **`optout-propagation`:** inserting a `revoke` event flips cache + DNC + queued targets within the same transaction. These two gates block merge on Tier-1 paths (CODEOWNERS).

---

## 5. Campaigns + Dialer state machine + Idempotency (Tier-1)

`campaign_targets` rows *are* the state machine. State lives in one column; every transition is appended to `dialer_transitions`.

```sql
create table campaigns (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  agent_id    uuid not null references agents(id),
  name        text not null,
  status      campaign_status not null default 'draft',
  window_start timestamptz,
  window_end   timestamptz,
  calling_tz   text not null default 'America/New_York',
  concurrency  int  not null default 5,
  max_retries  int  not null default 2,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on campaigns (org_id, status);

create table campaign_targets (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs(id) on delete cascade,
  campaign_id  uuid not null references campaigns(id) on delete cascade,
  contact_id   uuid not null references contacts(id),
  state        target_state not null default 'queued',
  attempts     int not null default 0,
  next_attempt_at timestamptz,
  -- idempotency: one in-flight dial per target. Worker claims with this.
  lease_token  uuid,
  lease_expires_at timestamptz,
  last_call_id uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (campaign_id, contact_id)            -- a contact appears once per campaign
);
create index on campaign_targets (org_id, campaign_id, state);
-- partial index drives the dialer poll cheaply
create index on campaign_targets (campaign_id, next_attempt_at)
  where state in ('queued','retry_wait');

-- APPEND-ONLY transition log (audit + replay/debug)
create table dialer_transitions (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs(id) on delete cascade,
  target_id    uuid not null references campaign_targets(id) on delete cascade,
  from_state   target_state,
  to_state     target_state not null,
  reason       text,
  call_id      uuid,
  occurred_at  timestamptz not null default now()
);
create index on dialer_transitions (target_id, occurred_at);
```

### 5.1 Idempotent dial claim (lease pattern)

The worker must never double-dial a target even if two worker instances race or a retry fires twice.

```sql
-- Atomically claim up to N dialable targets. SKIP LOCKED = no contention.
update campaign_targets t
   set state = 'dialing',
       lease_token = gen_random_uuid(),
       lease_expires_at = now() + interval '90 seconds',
       attempts = attempts + 1,
       updated_at = now()
 where t.id in (
   select id from campaign_targets
    where campaign_id = $1
      and state in ('queued','retry_wait')
      and (next_attempt_at is null or next_attempt_at <= now())
    order by next_attempt_at nulls first
    for update skip locked
    limit $2                                   -- = remaining concurrency budget
 )
returning t.id, t.contact_id, t.lease_token;
```
- **Lease expiry** reclaims stuck `dialing` rows (worker crashed mid-dial): a sweeper flips `dialing` rows whose `lease_expires_at < now()` back to `retry_wait`.
- **Webhook idempotency:** the provider's call-status webhook carries the `lease_token`; the handler only applies a transition if `lease_token` matches — stale/duplicate webhooks are dropped (see §8).
- **Pre-dial gate is re-checked inside the claim path** via `can_dial()` before the provider call is actually placed — state being `queued` is necessary but not sufficient; consent can have been revoked between enqueue and dial.

> CI invariant `idempotency`: fuzz test fires the same call-completed webhook 1–5× and asserts exactly one transition, one `calls` row finalized, one `usage_ledger` entry.

---

## 6. Calls + Call events + Recording storage

```sql
create table calls (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs(id) on delete cascade,
  agent_id     uuid not null references agents(id),
  campaign_id  uuid references campaigns(id),
  contact_id   uuid references contacts(id),
  direction    call_direction not null,
  status       call_status not null default 'queued',
  provider     voice_provider not null,
  provider_call_id text,                          -- external id for reconciliation
  started_at   timestamptz,
  ended_at     timestamptz,
  duration_sec int,
  cost_usd     numeric(12,4),
  outcome      jsonb not null default '{}',       -- booked, recovered_cart, deflected, opt_out…
  transcript   jsonb,                             -- or pointer to Storage for large ones
  recording_url text,                             -- Supabase Storage path, org-scoped bucket
  created_at   timestamptz not null default now(),
  unique (provider, provider_call_id)             -- reconciliation idempotency
);
create index on calls (org_id, created_at desc);
create index on calls (org_id, campaign_id);
create index on calls (org_id, contact_id);

-- High-volume per-call event stream (barge-in, function calls, DTMF…). Partition candidate (§7).
create table call_events (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null,
  call_id     uuid not null references calls(id) on delete cascade,
  kind        text not null,                      -- 'transcript_partial','tool_call','voicemail_detected'…
  payload     jsonb not null default '{}',
  occurred_at timestamptz not null default now()
) partition by range (occurred_at);
```

**Recordings:** large blobs live in **Supabase Storage**, one bucket, object path prefixed `org/{org_id}/calls/{call_id}.wav`. A Storage RLS policy mirrors the DB: a user can read an object only if its path prefix matches an `org_id` they belong to. The DB stores only the path + signed-URL generation happens server-side. Transcripts: inline `jsonb` if small; for long calls store to Storage and keep a pointer — avoids bloating row size and TOAST churn.

---

## 7. Indexes, partitioning & performance

The red-team named **Supabase connection limits / RLS performance at high write volume from call events** as a top-3 future bottleneck. Mitigations:

- **Connection pooling:** route the dialer worker + API through **Supavisor (transaction mode)**, not direct connections. Workers are bursty; transaction pooling keeps the connection count flat.
- **Partition the hot append tables by month:**
  ```sql
  create table call_events_2026_06 partition of call_events
    for values from ('2026-06-01') to ('2026-07-01');
  -- automate next-month partition creation via pg_cron
  ```
  Same pattern for `usage_ledger` and `webhook_events`. Old partitions detach + archive cheaply (ties into retention §9).
- **Index discipline (the ones that actually matter):**
  | Table | Index | Serves |
  |---|---|---|
  | `contacts` | `(org_id, e164)` unique | pre-dial lookup, dedup import |
  | `dnc_list` | `(org_id, e164)` PK | DNC check in `can_dial` |
  | `campaign_targets` | partial `(campaign_id, next_attempt_at) where state in (queued,retry_wait)` | dialer poll |
  | `consent_events` | `(org_id, e164, occurred_at desc)` | latest-consent / audit |
  | `calls` | `(org_id, created_at desc)` | dashboard feed |
  | `usage_ledger` | `(org_id, period, kind)` | billing rollup |
- **RLS perf:** keep policy predicates trivial — `org_id = (select auth_org())`. Wrap the org lookup in a `stable` SQL function so the planner caches it per-statement instead of re-evaluating per-row. Always filter by `org_id` in queries too (don't rely on RLS to do the index work).
- **Don't over-index `call_events`** — it's write-heavy; only the `(call_id, occurred_at)` lookup matters.

---

## 8. Webhook / event ledger & dedup (Tier-1 boundary)

Every inbound webhook (Vapi/Stripe/Shopify/Twilio) lands in one append-only ledger **before** any business logic, and is deduped on the provider's event id.

```sql
create table webhook_events (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid,                              -- resolved after signature verify (nullable pre-resolve)
  source        webhook_source not null,
  external_id   text not null,                     -- provider event id
  signature_ok  boolean not null,
  payload       jsonb not null,
  processed_at  timestamptz,                       -- null = not yet handled
  received_at   timestamptz not null default now(),
  unique (source, external_id)                     -- dedup: duplicate delivery = no-op insert
) partition by range (received_at);
```

Handler contract (Edge Function):
1. **Verify signature first** (`webhook-sig` CI invariant). Reject if bad — `signature_ok=false`, no processing.
2. `insert … on conflict (source, external_id) do nothing returning id`. If no row returned → it's a duplicate → **ack 200 and stop** (idempotent).
3. Process inside a transaction; set `processed_at = now()` at the end.
4. For voice-status webhooks, validate the `lease_token` against `campaign_targets` before applying any dialer transition (§5.1).

> This single chokepoint gives at-least-once delivery + exactly-once effect, and a replayable audit of everything that ever hit the system.

---

## 9. Backups, PITR, retention & GDPR erasure

| Concern | Approach |
|---|---|
| **Backups** | Supabase daily automated backups (Pro). Verify restore quarterly — an unverified backup isn't a backup. |
| **PITR** | Enable **Point-in-Time Recovery** (Pro add-on). Target RPO ≤ 5 min for the consent/billing tables — those are the ones you cannot afford to lose. |
| **Retention** | Recordings + `call_events` are the storage hogs. Default retention: recordings 90d, `call_events` 180d (per-org configurable, but never below legal-hold needs). Drop old monthly partitions to enforce. |
| **Legal hold on consent** | `consent_events` and `dnc_list` are **exempt from routine deletion** — TCPA defense requires you prove consent/opt-out history. Retain ≥ statute of limitations (≥ 5y). |
| **GDPR / CCPA erasure** | On a verified data-subject request: hard-delete `contacts`, `calls.transcript`, recordings (Storage object), and PII in `call_events`. **But keep a tombstone** in `consent_events`/`dnc_list` keyed on a salted hash of the E.164 (not the raw number) so the number stays suppressed without retaining identifiable PII. This is the one place "delete everything" and "never call them again" conflict — the hashed-DNC tombstone resolves it. |

```sql
-- erasure routine (illustrative): keep suppression, drop PII
create or replace function gdpr_erase(p_org uuid, p_e164 text) returns void language plpgsql as $$
begin
  -- 1. keep a non-identifiable suppression tombstone
  insert into dnc_list (org_id, e164, reason)
    values (p_org, p_e164, 'gdpr_erased') on conflict do nothing;
  -- 2. scrub call PII
  update calls set transcript = null, recording_url = null
   where org_id = p_org and contact_id in (select id from contacts where org_id=p_org and e164=p_e164);
  -- 3. hard-delete the contact
  delete from contacts where org_id = p_org and e164 = p_e164;
  -- (consent_events retained for legal defense — keyed on e164, scrub evidence.recording_url separately if requested)
end $$;
```

---

## 10. RLS — every tenant table

Pattern: a `stable` helper returns the caller's org, one permissive policy per table keyed on it. Service-role (worker/Edge Functions) bypasses RLS and **must filter `org_id` explicitly** in code.

```sql
-- caller's org from JWT claim (set at login)
create or replace function auth_org() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id','')::uuid
$$;

alter table contacts enable row level security;
create policy contacts_isolation on contacts
  using (org_id = auth_org())
  with check (org_id = auth_org());
-- repeat for: agents, integrations, campaigns, campaign_targets, calls,
-- call_events, subscriptions, usage_ledger (read-only policy), consent_events (insert-only),
-- segments, onboarding_state, knowledge_sources, knowledge_chunks, agent_knowledge,
-- twilio_subaccounts, phone_numbers, notifications, webhook_endpoints
-- EXCEPTION: vertical_configs is global config — SELECT to all authenticated, no tenant writes.
```

Append-only tables get a **read + insert** policy but **no update/delete** policy (so nobody, not even the owner, can mutate the audit trail via the API):

```sql
alter table consent_events enable row level security;
create policy consent_read   on consent_events for select using (org_id = auth_org());
create policy consent_insert on consent_events for insert with check (org_id = auth_org());
-- no update/delete policy → those operations are denied for all non-service roles
```

> CI invariant `rls-coverage`: a test enumerates every table with an `org_id` column and fails the build if any lacks `enable row level security` + an isolation policy. This is the agent's job to keep green — it cannot author the policies (Tier-1) but it owns the coverage test.

---

## 11. Billing / metering + usage rollups

Metering is a **ledger** (append-only, every billable unit), with periodic rollups for invoicing. Never mutate usage; never compute billing from `calls.cost_usd` alone — that's COGS, not what you bill.

```sql
create table subscriptions (
  org_id          uuid primary key references orgs(id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text,
  plan_id         text not null,                   -- maps to a tier (Starter/Growth/Pro) — see Scope §E
  included_minutes int not null default 0,         -- bundled minutes for the period
  included_numbers int not null default 0,         -- phone numbers bundled in the tier (Scope §E)
  overage_rate_usd numeric(12,4) not null default 0,-- per-minute overage price for this tier
  status          text not null default 'active',
  period_start    timestamptz,
  period_end      timestamptz,
  updated_at      timestamptz not null default now()
);
-- Tier values (price, included_minutes/numbers, overage_rate) are PLACEHOLDERS sourced from the
-- Stripe price + mirrored here so the DB is self-describing for usage math. They are config, never
-- hardcoded in app logic. Stripe price metadata is the upstream source; this row is the working copy.

-- APPEND-ONLY. One row per billable unit. Source of truth for invoicing.
create table usage_ledger (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  kind        meter_kind not null,                -- voice_minutes | sms | overage_minutes | campaign_call
  quantity    numeric(12,4) not null,             -- minutes/seconds/units
  call_id     uuid references calls(id),
  period      date not null,                       -- billing period (month) this falls in
  idempotency_key text not null,                   -- = provider_call_id+segment; dedup
  occurred_at timestamptz not null default now(),
  unique (org_id, idempotency_key)                 -- can't double-bill a call segment
) partition by range (occurred_at);
create index on usage_ledger (org_id, period, kind);
```

**Rollup → Stripe (nightly via pg_cron + worker):**
```sql
select org_id, sum(quantity) as minutes
  from usage_ledger
 where kind in ('voice_minutes','overage_minutes') and period = date_trunc('month', now())::date
 group by org_id;
```
- Compute `overage = max(0, used_minutes − included_minutes)`, push as a **Stripe metered usage record** (idempotent on the period+org).
- 80% / 100% cap alerts (US-27) are a query against this rollup, fired by the same job.
- **Reconciliation:** nightly eval compares `sum(usage_ledger.quantity)` vs `count(calls)`-derived minutes; drift > threshold pages a human. Billing correctness is Tier-1.

---

## 12. Migrations strategy & versioning

- **One tool, forward-only:** SQL migration files in `supabase/migrations/NNNN_description.sql`, timestamp-ordered, committed to the repo. No editing applied migrations — fix forward.
- **Every migration is reviewable on Tier-1 paths** (CODEOWNERS covers `supabase/migrations/**` touching consent/dnc/usage/dialer/RLS). Agents may *draft* a migration but a human authors/approves anything touching Tier-1 tables.
- **Expand → migrate → contract** for breaking changes (add column nullable → backfill → enforce NOT NULL → drop old) so deploys never block on a long lock.
- **Enums:** add values with `alter type … add value` (can't run in a txn with other DDL — isolate it). Never reorder/remove enum values; deprecate in app.
- **Seed/fixtures** (test orgs, sample contacts with mixed consent states) are an agent-owned chore (Runable), kept in `supabase/seed.sql`, never run in prod.
- **CI gate:** migrations apply cleanly against a fresh DB + the full invariant suite (`consent-invariant`, `optout-propagation`, `rls-coverage`, `idempotency`, `voice-eval`, `webhook-sig`) runs green before merge.

---

## 13. Build order (maps to the Wk1–19 timeline, capacity reinvested into tests)

| When | DB work | Tier |
|---|---|---|
| Wk1–4 (inbound MVP) | orgs(+vertical_config_id,branding), users, agents(+goal/voice/hours/transfer/consent_required+trigger), integrations, contacts, calls, call_events, RLS, webhook_events, **vertical_configs, onboarding_state, phone_numbers, twilio_subaccounts** | mixed; RLS = Tier-1 |
| Wk5–10 | subscriptions, usage_ledger + rollups + Stripe reconcile, **knowledge_sources/chunks (pgvector)+agent_knowledge, notifications, webhook_endpoints** | Tier-1 (billing); knowledge = Tier-2 |
| Wk11–15 (triggered outbound) | consent_events, dnc_list, triggers, `can_dial()` + **full test suite first** | Tier-1 |
| Wk16–19 (campaign engine) | campaigns, campaign_targets state machine, dialer_transitions, lease/idempotency | Tier-1 |

Freed agent capacity goes into: the consent property tests, the idempotency fuzzer, RLS coverage test, the billing reconciliation eval — not new features.

---

## Appendix — invariants the DB must always satisfy

1. Every table with `org_id` has RLS enabled + an isolation policy. *(rls-coverage)*
2. No `dialing` transition occurs unless `can_dial()` returned true immediately prior. *(consent-invariant)*
   - Corollary: every outbound-capable agent has `consent_required = true`, forced + locked by the `agents_force_consent` trigger; it can never be unset. *(consent-locked)*
3. A `revoke` event flips contact cache + DNC + queued targets in one transaction. *(optout-propagation)*
4. Duplicate webhooks / retries produce exactly one effect. *(idempotency, webhook-sig)*
5. No call segment is billed twice. *(usage_ledger unique idempotency_key)*
6. `consent_events`, `usage_ledger`, `webhook_events`, `dialer_transitions` are never updated or deleted via the API.
7. GDPR erasure removes PII but preserves a non-identifiable suppression tombstone.
