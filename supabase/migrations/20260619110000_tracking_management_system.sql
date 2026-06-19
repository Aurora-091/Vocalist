-- tracking_profiles: rotating GA4 + Ads sets, one active at a time
create table if not exists public.tracking_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ga4_id text not null,                 -- e.g. G-XXXXXXX
  ads_conversion_id text not null,      -- e.g. AW-XXXXXXXXX
  ads_conversion_label text not null,   -- e.g. AbC-D_efGhIjKl
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

-- only one active profile at a time (partial unique index)
create unique index if not exists one_active_tracking_profile
  on public.tracking_profiles (is_active) where is_active = true;

-- site_settings: singleton for static config
create table if not exists public.site_settings (
  id boolean primary key default true,
  meta_pixel_id text,
  tracking_enabled boolean not null default true,
  constraint site_settings_singleton check (id = true)
);
insert into public.site_settings (id) values (true) on conflict do nothing;

-- RLS: public can READ (pixels are public), only authenticated admins WRITE
alter table public.tracking_profiles enable row level security;
alter table public.site_settings enable row level security;

create policy "tracking_profiles_public_read" on public.tracking_profiles
  for select using (true);
create policy "tracking_profiles_admin_write" on public.tracking_profiles
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "site_settings_public_read" on public.site_settings
  for select using (true);
create policy "site_settings_admin_write" on public.site_settings
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Atomically activate a profile (deactivate all others, activate one)
create or replace function public.activate_tracking_profile(profile_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.tracking_profiles set is_active = false where is_active = true;
  update public.tracking_profiles set is_active = true where id = profile_id;
end; $$;
