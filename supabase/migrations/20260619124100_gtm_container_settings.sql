-- Drop old tables and functions if they exist
drop function if exists public.activate_tracking_profile(uuid);
drop table if exists public.tracking_profiles cascade;
drop table if exists public.site_settings cascade;

-- Create site_settings table exactly as specified
create table public.site_settings (
  id boolean primary key default true,
  gtm_container_id text,            -- e.g. GTM-XXXXXXX
  tracking_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint site_settings_singleton check (id = true)
);

insert into public.site_settings (id) values (true) on conflict do nothing;

alter table public.site_settings enable row level security;

-- public read: the GTM id is a public client-side value
create policy "site_settings_public_read" on public.site_settings
  for select using (true);

-- only authenticated admins write
create policy "site_settings_admin_write" on public.site_settings
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
