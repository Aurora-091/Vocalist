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
```

Every box except `orgs` carries `org_id` → `orgs.id`.

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
```

> Enums over `text + check`: they're self-documenting, index-friendly, and the agent CI lint (`sdk-import-lint`) can assert no raw string states leak into the dialer code.

---

## 3. Core tenant tables (key DDL)

```sql
-- Tenant root. The ONLY table without org_id (it IS the org).
create table orgs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  plan_id     text,                       -- maps to Stripe price/plan
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
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
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  name          text not null,
  vertical      text,
  persona       jsonb not null default '{}',
  voice_id      text,
  inbound_number text,
  provider      voice_provider not null default 'vapi',
  provider_ref  text,                      -- external assistant/agent id
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index on agents (org_id);

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
  consent_status consent_status not null default 'none',  -- CACHE, maintained by trigger
  consent_ts     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  unique (org_id, e164)
);
create index on contacts (org_id);
create index on contacts (org_id, consent_status);

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
-- Returns true only if the number may be dialed RIGHT NOW.
create or replace function can_dial(p_org uuid, p_e164 text, p_now timestamptz, p_tz text)
returns boolean language sql stable as $$
  select
        -- 1. consent granted (read cache; ledger is authority for disputes)
        exists (select 1 from contacts
                 where org_id = p_org and e164 = p_e164
                   and consent_status = 'granted' and deleted_at is null)
        -- 2. not on DNC
    and not exists (select 1 from dnc_list where org_id = p_org and e164 = p_e164)
        -- 3. within allowed calling hours in contact's local TZ (e.g. 9–20)
    and extract(hour from (p_now at time zone p_tz)) between 9 and 19;
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
-- call_events, subscriptions, usage_ledger (read-only policy), consent_events (insert-only)
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
  plan_id         text not null,
  included_minutes int not null default 0,
  status          text not null default 'active',
  period_start    timestamptz,
  period_end      timestamptz,
  updated_at      timestamptz not null default now()
);

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
| Wk1–4 (inbound MVP) | orgs, users, agents, integrations, contacts, calls, call_events, RLS, webhook_events | mixed; RLS = Tier-1 |
| Wk5–10 | subscriptions, usage_ledger + rollups + Stripe reconcile | Tier-1 (billing) |
| Wk11–15 (triggered outbound) | consent_events, dnc_list, triggers, `can_dial()` + **full test suite first** | Tier-1 |
| Wk16–19 (campaign engine) | campaigns, campaign_targets state machine, dialer_transitions, lease/idempotency | Tier-1 |

Freed agent capacity goes into: the consent property tests, the idempotency fuzzer, RLS coverage test, the billing reconciliation eval — not new features.

---

## Appendix — invariants the DB must always satisfy

1. Every table with `org_id` has RLS enabled + an isolation policy. *(rls-coverage)*
2. No `dialing` transition occurs unless `can_dial()` returned true immediately prior. *(consent-invariant)*
3. A `revoke` event flips contact cache + DNC + queued targets in one transaction. *(optout-propagation)*
4. Duplicate webhooks / retries produce exactly one effect. *(idempotency, webhook-sig)*
5. No call segment is billed twice. *(usage_ledger unique idempotency_key)*
6. `consent_events`, `usage_ledger`, `webhook_events`, `dialer_transitions` are never updated or deleted via the API.
7. GDPR erasure removes PII but preserves a non-identifiable suppression tombstone.
