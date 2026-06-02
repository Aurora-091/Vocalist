-- 1. Create Enums
create type user_role        as enum ('owner','admin','ops');
create type integration_type as enum ('shopify','calcom','google_cal','outlook_cal','crm','zapier','twilio');
create type call_direction   as enum ('inbound','outbound');
create type voice_provider    as enum ('vapi','retell','pipecat');
create type contact_source    as enum ('shopify','crm','upload','inbound');
create type consent_status    as enum ('granted','none','revoked');
create type consent_event_kind as enum ('grant','revoke','import_attest','expiry');
create type consent_channel   as enum ('voice','sms','web_form','shopify_optin','manual');
create type campaign_status    as enum ('draft','scheduled','running','paused','completed','canceled');
create type target_state       as enum ('queued','suppressed','dialing','ringing','in_call','completed','failed','voicemail','retry_wait','do_not_call');
create type call_status        as enum ('queued','ringing','in_progress','completed','failed','no_answer','busy','voicemail','canceled');
create type meter_kind         as enum ('voice_minutes','sms','overage_minutes','campaign_call');
create type webhook_source     as enum ('vapi','retell','pipecat','shopify','stripe','calcom','twilio');

-- 2. Create Core Tables (Dependency Order)

-- Orgs
create table orgs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  plan_id     text,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- Users
create table users (
  id          uuid primary key references auth.users(id) on delete cascade,
  org_id      uuid not null references orgs(id) on delete cascade,
  email       text not null,
  role        user_role not null default 'ops',
  created_at  timestamptz not null default now()
);
create index on users (org_id);

-- Agents
create table agents (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  name          text not null,
  vertical      text,
  persona       jsonb not null default '{}',
  voice_id      text,
  inbound_number text,
  provider      voice_provider not null default 'vapi',
  provider_ref  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index on agents (org_id);

-- Integrations
create table integrations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  type        integration_type not null,
  config      jsonb not null default '{}',
  secret_ref  text,
  status      text not null default 'active',
  created_at  timestamptz not null default now(),
  unique (org_id, type)
);

-- Contacts
create table contacts (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references orgs(id) on delete cascade,
  e164           text not null,
  name           text,
  email          text,
  source         contact_source not null,
  crm_ref        text,
  consent_status consent_status not null default 'none',
  consent_ts     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  unique (org_id, e164)
);
create index on contacts (org_id);
create index on contacts (org_id, consent_status);

-- Campaigns
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

-- Campaign Targets
create table campaign_targets (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs(id) on delete cascade,
  campaign_id  uuid not null references campaigns(id) on delete cascade,
  contact_id   uuid not null references contacts(id),
  state        target_state not null default 'queued',
  attempts     int not null default 0,
  next_attempt_at timestamptz,
  lease_token  uuid,
  lease_expires_at timestamptz,
  last_call_id uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (campaign_id, contact_id)
);
create index on campaign_targets (org_id, campaign_id, state);
create index on campaign_targets (campaign_id, next_attempt_at)
  where state in ('queued','retry_wait');

-- Calls
create table calls (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs(id) on delete cascade,
  agent_id     uuid not null references agents(id),
  campaign_id  uuid references campaigns(id),
  contact_id   uuid references contacts(id),
  direction    call_direction not null,
  status       call_status not null default 'queued',
  provider     voice_provider not null,
  provider_call_id text,
  started_at   timestamptz,
  ended_at     timestamptz,
  duration_sec int,
  cost_usd     numeric(12,4),
  outcome      jsonb not null default '{}',
  transcript   jsonb,
  recording_url text,
  created_at   timestamptz not null default now(),
  unique (provider, provider_call_id)
);
create index on calls (org_id, created_at desc);
create index on calls (org_id, campaign_id);
create index on calls (org_id, contact_id);

-- Call Events (Partitioned)
create table call_events (
  id          uuid default gen_random_uuid(),
  org_id      uuid not null,
  call_id     uuid not null references calls(id) on delete cascade,
  kind        text not null,
  payload     jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  primary key (id, occurred_at)
) partition by range (occurred_at);

-- Consent Events (Append-Only)
create table consent_events (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  e164        text not null,
  contact_id  uuid references contacts(id) on delete set null,
  kind        consent_event_kind not null,
  channel     consent_channel not null,
  evidence    jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index on consent_events (org_id, e164, occurred_at desc);

-- DNC List (Suppression)
create table dnc_list (
  org_id      uuid not null references orgs(id) on delete cascade,
  e164        text not null,
  reason      text not null,
  added_at    timestamptz not null default now(),
  source_event_id uuid references consent_events(id),
  primary key (org_id, e164)
);

-- Dialer Transitions (Append-Only)
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

-- Webhook Events (Partitioned)
create table webhook_events (
  id            uuid default gen_random_uuid(),
  org_id        uuid,
  source        webhook_source not null,
  external_id   text not null,
  signature_ok  boolean not null,
  payload       jsonb not null,
  processed_at  timestamptz,
  received_at   timestamptz not null default now(),
  primary key (id, received_at),
  unique (source, external_id, received_at)
) partition by range (received_at);

-- Subscriptions
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

-- Usage Ledger (Partitioned, Append-Only)
create table usage_ledger (
  id          uuid default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  kind        meter_kind not null,
  quantity    numeric(12,4) not null,
  call_id     uuid references calls(id),
  period      date not null,
  idempotency_key text not null,
  occurred_at timestamptz not null default now(),
  primary key (id, occurred_at),
  unique (org_id, idempotency_key, occurred_at)
) partition by range (occurred_at);
create index on usage_ledger (org_id, period, kind);

-- 3. Create Partition Tables (Initial Months: Jun - Sep 2026)
create table call_events_2026_06 partition of call_events for values from ('2026-06-01') to ('2026-07-01');
create table call_events_2026_07 partition of call_events for values from ('2026-07-01') to ('2026-08-01');
create table call_events_2026_08 partition of call_events for values from ('2026-08-01') to ('2026-09-01');
create table call_events_2026_09 partition of call_events for values from ('2026-09-01') to ('2026-10-01');

create table webhook_events_2026_06 partition of webhook_events for values from ('2026-06-01') to ('2026-07-01');
create table webhook_events_2026_07 partition of webhook_events for values from ('2026-07-01') to ('2026-08-01');
create table webhook_events_2026_08 partition of webhook_events for values from ('2026-08-01') to ('2026-09-01');
create table webhook_events_2026_09 partition of webhook_events for values from ('2026-09-01') to ('2026-10-01');

create table usage_ledger_2026_06 partition of usage_ledger for values from ('2026-06-01') to ('2026-07-01');
create table usage_ledger_2026_07 partition of usage_ledger for values from ('2026-07-01') to ('2026-08-01');
create table usage_ledger_2026_08 partition of usage_ledger for values from ('2026-08-01') to ('2026-09-01');
create table usage_ledger_2026_09 partition of usage_ledger for values from ('2026-09-01') to ('2026-10-01');

-- 4. Triggers & Functions for Immutability & Consent

-- Block mutation function
create or replace function block_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'append-only table: % may not be updated or deleted', tg_table_name;
end $$;

-- Immutability Triggers
create trigger consent_events_immutable
  before update or delete on consent_events
  for each row execute function block_mutation();

create trigger dialer_transitions_immutable
  before update or delete on dialer_transitions
  for each row execute function block_mutation();

create trigger webhook_events_immutable
  before update or delete on webhook_events
  for each row execute function block_mutation();

create trigger usage_ledger_immutable
  before update or delete on usage_ledger
  for each row execute function block_mutation();

-- Consent cache & opt-out propagation function
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
       on conflict (org_id, e164) do nothing;

     update campaign_targets t
        set state = 'do_not_call', updated_at = now()
       from contacts c
      where t.contact_id = c.id
        and c.org_id = new.org_id and c.e164 = new.e164
        and t.state in ('queued','retry_wait');
  end if;
  return new;
end $$;

create trigger consent_event_applied
  after insert on consent_events
  for each row execute function apply_consent_event();

-- Pre-dial gate function
create or replace function can_dial(p_org uuid, p_e164 text, p_now timestamptz, p_tz text)
returns boolean language sql stable as $$
  select
        exists (select 1 from contacts
                 where org_id = p_org and e164 = p_e164
                   and consent_status = 'granted' and deleted_at is null)
    and not exists (select 1 from dnc_list where org_id = p_org and e164 = p_e164)
    and extract(hour from (p_now at time zone p_tz)) between 9 and 19;
$$;

-- GDPR Erasure function
create or replace function gdpr_erase(p_org uuid, p_e164 text) returns void language plpgsql as $$
begin
  -- 1. keep a non-identifiable suppression tombstone
  insert into dnc_list (org_id, e164, reason)
    values (p_org, p_e164, 'gdpr_erased') on conflict do nothing;
  
  -- 2. scrub call PII and dissociate contact link
  update calls set transcript = null, recording_url = null, contact_id = null
   where org_id = p_org and contact_id in (select id from contacts where org_id=p_org and e164=p_e164);
   
  -- 3. delete campaign targets referencing this contact
  delete from campaign_targets where contact_id in (select id from contacts where org_id = p_org and e164 = p_e164);
  
  -- 4. hard-delete the contact
  delete from contacts where org_id = p_org and e164 = p_e164;
end $$;

-- 5. Row Level Security Policies

-- Auth Org helper
create or replace function auth_org() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id','')::uuid
$$;

-- ORGs
alter table orgs enable row level security;
create policy orgs_isolation on orgs
  using (id = auth_org())
  with check (id = auth_org());

-- Users
alter table users enable row level security;
create policy users_isolation on users
  using (org_id = auth_org())
  with check (org_id = auth_org());

-- Agents
alter table agents enable row level security;
create policy agents_isolation on agents
  using (org_id = auth_org())
  with check (org_id = auth_org());

-- Integrations
alter table integrations enable row level security;
create policy integrations_isolation on integrations
  using (org_id = auth_org())
  with check (org_id = auth_org());

-- Contacts
alter table contacts enable row level security;
create policy contacts_isolation on contacts
  using (org_id = auth_org())
  with check (org_id = auth_org());

-- Campaigns
alter table campaigns enable row level security;
create policy campaigns_isolation on campaigns
  using (org_id = auth_org())
  with check (org_id = auth_org());

-- Campaign Targets
alter table campaign_targets enable row level security;
create policy campaign_targets_isolation on campaign_targets
  using (org_id = auth_org())
  with check (org_id = auth_org());

-- Calls
alter table calls enable row level security;
create policy calls_isolation on calls
  using (org_id = auth_org())
  with check (org_id = auth_org());

-- Call Events
alter table call_events enable row level security;
create policy call_events_isolation on call_events
  using (org_id = auth_org())
  with check (org_id = auth_org());

-- Consent Events (Insert-only policy)
alter table consent_events enable row level security;
create policy consent_read   on consent_events for select using (org_id = auth_org());
create policy consent_insert on consent_events for insert with check (org_id = auth_org());

-- DNC List
alter table dnc_list enable row level security;
create policy dnc_list_isolation on dnc_list
  using (org_id = auth_org())
  with check (org_id = auth_org());

-- Dialer Transitions
alter table dialer_transitions enable row level security;
create policy dialer_transitions_read   on dialer_transitions for select using (org_id = auth_org());
create policy dialer_transitions_insert on dialer_transitions for insert with check (org_id = auth_org());

-- Webhook Events
alter table webhook_events enable row level security;
create policy webhook_events_read   on webhook_events for select using (org_id = auth_org());
create policy webhook_events_insert on webhook_events for insert with check (org_id = auth_org() or org_id is null);

-- Subscriptions
alter table subscriptions enable row level security;
create policy subscriptions_isolation on subscriptions
  using (org_id = auth_org())
  with check (org_id = auth_org());

-- Usage Ledger
alter table usage_ledger enable row level security;
create policy usage_ledger_read   on usage_ledger for select using (org_id = auth_org());
create policy usage_ledger_insert on usage_ledger for insert with check (org_id = auth_org());
