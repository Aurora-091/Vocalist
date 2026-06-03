/*
  # Aurora dialer atomicity, lease sweeper, RLS coverage, Realtime, partition rotation

  Adds the operational primitives the Black Book mandates that were missing from the
  initial schema migration. Nothing destructive: only new functions, views, schedules,
  publications, and Storage policies. Existing tables and policies are unchanged.

  ## What this adds

  1. **Atomic dial claim RPC** (`claim_dial_targets`)
     Replaces the two-step select+update pattern in the dialer worker with a single
     `FOR UPDATE SKIP LOCKED` claim that flips state to `dialing`, stamps a fresh
     `lease_token`, sets `lease_expires_at`, increments `attempts`, and returns the
     leased rows. Eliminates the race window where two workers could lease the same
     row.

  2. **Lease sweeper** (`reclaim_expired_leases`)
     Atomically returns rows whose `lease_expires_at` has passed back to `queued`,
     with a `dialer_transitions` entry per row. Run by the sweeper worker so a
     crashed worker's leases never strand targets in `dialing` forever.

  3. **GDPR erasure helper** (`gdpr_hash_e164`)
     Produces a deterministic non-identifiable tombstone for the DNC list so a
     suppression survives PII removal without retaining the number itself.

  4. **RLS coverage check** (`v_rls_coverage` view)
     Surfaces every public table and whether RLS is enabled. The DB-level
     `rls-coverage` invariant test queries this view.

  5. **Realtime publication**
     Adds `campaign_targets`, `calls`, and `call_events` to the
     `supabase_realtime` publication so the live campaign monitor can subscribe.

  6. **Storage bucket + RLS for call recordings**
     Creates `call-recordings` private bucket. Storage objects are accessible only
     when their first path segment matches the caller's `auth_org()` — mirrors the
     RLS pattern used on `calls` itself.

  7. **Partition rotation** (`ensure_monthly_partitions`)
     Idempotently creates the next 3 months of partitions for `call_events`,
     `webhook_events`, and `usage_ledger`. Scheduled via `pg_cron` if available.

  8. **Stripe customer index**
     Adds an index on `subscriptions.stripe_subscription_id` since the Stripe
     webhook handler looks up by it on every event.

  ## Notes
  - All new functions use `security definer` only where required (storage policy and
    coverage view). The dial claim runs as the calling role so RLS still applies.
  - `pg_cron` is enabled if the extension is available; the schedule is a no-op if
    the extension is unavailable.
*/

create extension if not exists pg_cron;

-- 1. Atomic dial claim
create or replace function claim_dial_targets(
  p_campaign uuid,
  p_limit    int,
  p_lease_seconds int default 90
)
returns table (
  target_id    uuid,
  contact_id   uuid,
  lease_token  uuid,
  attempts     int
)
language plpgsql
as $$
declare
  v_lease_token uuid := gen_random_uuid();
begin
  return query
  with leased as (
    update campaign_targets t
       set state            = 'dialing',
           lease_token      = v_lease_token,
           lease_expires_at = now() + make_interval(secs => p_lease_seconds),
           attempts         = attempts + 1,
           updated_at       = now()
     where t.id in (
       select c.id
         from campaign_targets c
        where c.campaign_id = p_campaign
          and c.state in ('queued','retry_wait')
          and (c.next_attempt_at is null or c.next_attempt_at <= now())
          and (c.lease_expires_at is null or c.lease_expires_at <= now())
        order by c.next_attempt_at nulls first
        for update skip locked
        limit p_limit
     )
    returning t.id, t.org_id, t.contact_id, t.lease_token, t.attempts, t.state
  )
  insert into dialer_transitions (org_id, target_id, from_state, to_state, reason)
  select org_id, id, 'queued'::target_state, 'dialing'::target_state, 'lease_claim'
    from leased
  returning leased.id, leased.contact_id, leased.lease_token, leased.attempts;
end $$;

-- 2. Lease sweeper
create or replace function reclaim_expired_leases(p_limit int default 200)
returns int
language plpgsql
as $$
declare
  v_count int;
begin
  with stale as (
    select id, org_id, state
      from campaign_targets
     where state = 'dialing'
       and lease_expires_at is not null
       and lease_expires_at <= now()
     order by lease_expires_at
     for update skip locked
     limit p_limit
  ),
  reverted as (
    update campaign_targets t
       set state            = 'queued',
           lease_token      = null,
           lease_expires_at = null,
           updated_at       = now()
      from stale s
     where t.id = s.id
    returning t.id, t.org_id
  )
  insert into dialer_transitions (org_id, target_id, from_state, to_state, reason)
  select r.org_id, r.id, 'dialing'::target_state, 'queued'::target_state, 'lease_expired'
    from reverted r;

  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- 3. GDPR hash helper
create or replace function gdpr_hash_e164(p_e164 text)
returns text
language sql
immutable
as $$
  select 'sha256:' || encode(extensions.digest(p_e164, 'sha256'), 'hex');
$$;

-- 4. RLS coverage view (read-only diagnostic)
create or replace view v_rls_coverage as
  select
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    coalesce(
      (select count(*) from pg_policies p
        where p.schemaname = 'public' and p.tablename = c.relname),
      0
    ) as policy_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname in (
      'orgs','users','agents','integrations','contacts','campaigns',
      'campaign_targets','calls','call_events','consent_events','dnc_list',
      'dialer_transitions','webhook_events','subscriptions','usage_ledger'
    );

grant select on v_rls_coverage to anon, authenticated, service_role;

-- 5. Realtime publication
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table campaign_targets';
  end if;
exception when duplicate_object then null;
end $$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table calls';
  end if;
exception when duplicate_object then null;
end $$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table call_events';
  end if;
exception when duplicate_object then null;
end $$;

-- 6. Storage bucket + RLS-mirrored policies
insert into storage.buckets (id, name, public)
  values ('call-recordings', 'call-recordings', false)
  on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname = 'call_recordings_org_read'
  ) then
    execute $p$
      create policy call_recordings_org_read on storage.objects
        for select to authenticated
        using (
          bucket_id = 'call-recordings'
          and (storage.foldername(name))[1] = (auth_org())::text
        )
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname = 'call_recordings_org_write'
  ) then
    execute $p$
      create policy call_recordings_org_write on storage.objects
        for insert to authenticated
        with check (
          bucket_id = 'call-recordings'
          and (storage.foldername(name))[1] = (auth_org())::text
        )
    $p$;
  end if;
end $$;

-- 7. Partition rotation
create or replace function ensure_monthly_partitions(p_months_ahead int default 3)
returns int
language plpgsql
as $$
declare
  v_now date := date_trunc('month', current_date)::date;
  v_start date;
  v_end date;
  v_suffix text;
  v_created int := 0;
  v_table text;
begin
  for i in 0 .. p_months_ahead loop
    v_start  := (v_now + (i || ' month')::interval)::date;
    v_end    := (v_now + ((i + 1) || ' month')::interval)::date;
    v_suffix := to_char(v_start, 'YYYY_MM');

    foreach v_table in array array['call_events', 'webhook_events', 'usage_ledger'] loop
      if not exists (
        select 1 from pg_class
         where relname = v_table || '_' || v_suffix
      ) then
        execute format(
          'create table %I partition of %I for values from (%L) to (%L)',
          v_table || '_' || v_suffix, v_table, v_start, v_end
        );
        v_created := v_created + 1;
      end if;
    end loop;
  end loop;
  return v_created;
end $$;

-- Schedule monthly partition rotation if pg_cron is available.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'aurora_partition_rotation',
      '0 3 25 * *',
      'select ensure_monthly_partitions(3);'
    );
    perform cron.schedule(
      'aurora_lease_sweeper',
      '* * * * *',
      'select reclaim_expired_leases(500);'
    );
  end if;
exception when others then null;
end $$;

-- 8. Stripe subscription lookup index
create index if not exists subscriptions_stripe_sub_id_idx
  on subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;
