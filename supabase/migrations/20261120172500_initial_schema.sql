create extension if not exists pgcrypto;

create type public.app_role as enum ('caregiver', 'admin');
create type public.sos_status as enum ('new', 'acknowledged', 'resolved');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'caregiver',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.smart_walk_users (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  relationship text,
  age_range text,
  notes text,
  preferred_language text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.caregiver_user_access (
  caregiver_id uuid not null references public.profiles(id) on delete cascade,
  smart_walk_user_id uuid not null references public.smart_walk_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (caregiver_id, smart_walk_user_id)
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  device_identifier text not null unique,
  smart_walk_user_id uuid not null references public.smart_walk_users(id) on delete restrict,
  device_token_hash text not null unique,
  battery_percent smallint check (battery_percent between 0 and 100),
  online_status boolean not null default false,
  gps_status text not null default 'unavailable'
    check (gps_status in ('available', 'unavailable')),
  network_status text,
  signal_strength smallint,
  firmware_version text,
  last_seen_at timestamptz,
  last_battery_reported_at timestamptz,
  last_gps_fix_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision check (accuracy_m is null or accuracy_m >= 0),
  recorded_at timestamptz not null,
  source text not null default 'device',
  created_at timestamptz not null default now()
);

create index locations_device_recorded_idx
  on public.locations (device_id, recorded_at desc);

create table public.sos_events (
  id uuid primary key default gen_random_uuid(),
  smart_walk_user_id uuid not null references public.smart_walk_users(id) on delete restrict,
  device_id uuid not null references public.devices(id) on delete restrict,
  location_id uuid references public.locations(id) on delete set null,
  triggered_at timestamptz not null,
  status public.sos_status not null default 'new',
  acknowledged_by uuid references public.profiles(id) on delete set null,
  acknowledged_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  check ((status = 'new' and acknowledged_at is null and resolved_at is null)
    or (status = 'acknowledged' and acknowledged_at is not null and resolved_at is null)
    or (status = 'resolved' and acknowledged_at is not null and resolved_at is not null))
);

create index sos_events_user_status_idx
  on public.sos_events (smart_walk_user_id, status, triggered_at desc);

create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  smart_walk_user_id uuid not null references public.smart_walk_users(id) on delete cascade,
  name text not null,
  relationship text,
  phone text not null,
  priority smallint not null default 1 check (priority > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  smart_walk_user_id uuid references public.smart_walk_users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_user_created_idx
  on public.audit_logs (smart_walk_user_id, created_at desc);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.can_access_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.caregiver_user_access
    where caregiver_id = auth.uid()
      and smart_walk_user_id = target_user_id
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', 'Caregiver'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute procedure public.touch_updated_at();
create trigger users_updated_at before update on public.smart_walk_users
  for each row execute procedure public.touch_updated_at();
create trigger devices_updated_at before update on public.devices
  for each row execute procedure public.touch_updated_at();
create trigger contacts_updated_at before update on public.emergency_contacts
  for each row execute procedure public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.smart_walk_users enable row level security;
alter table public.caregiver_user_access enable row level security;
alter table public.devices enable row level security;
alter table public.locations enable row level security;
alter table public.sos_events enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.audit_logs enable row level security;

create policy "caregivers read own profile" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "caregivers update own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "linked caregivers read users" on public.smart_walk_users
  for select using (public.can_access_user(id));
create policy "admins manage users" on public.smart_walk_users
  for all using (public.is_admin()) with check (public.is_admin());

create policy "caregivers read their links" on public.caregiver_user_access
  for select using (caregiver_id = auth.uid() or public.is_admin());
create policy "admins manage links" on public.caregiver_user_access
  for all using (public.is_admin()) with check (public.is_admin());

create policy "linked caregivers read devices" on public.devices
  for select using (public.can_access_user(smart_walk_user_id));
create policy "admins manage devices" on public.devices
  for all using (public.is_admin()) with check (public.is_admin());

create policy "linked caregivers read locations" on public.locations
  for select using (exists (
    select 1 from public.devices d
    where d.id = device_id and public.can_access_user(d.smart_walk_user_id)
  ));

create policy "linked caregivers read alerts" on public.sos_events
  for select using (public.can_access_user(smart_walk_user_id));

create policy "linked caregivers read contacts" on public.emergency_contacts
  for select using (public.can_access_user(smart_walk_user_id));
create policy "linked caregivers manage contacts" on public.emergency_contacts
  for all using (public.can_access_user(smart_walk_user_id))
  with check (public.can_access_user(smart_walk_user_id));

create policy "linked caregivers read audit logs" on public.audit_logs
  for select using (public.can_access_user(smart_walk_user_id));

create or replace function public.acknowledge_sos(event_id uuid)
returns public.sos_events
language plpgsql
security definer
set search_path = public
as $$
declare updated_event public.sos_events;
begin
  update public.sos_events
  set status = 'acknowledged',
      acknowledged_by = auth.uid(),
      acknowledged_at = now()
  where id = event_id
    and status = 'new'
    and public.can_access_user(smart_walk_user_id)
  returning * into updated_event;
  if updated_event.id is null then
    raise exception 'SOS event not found or already acknowledged';
  end if;
  insert into public.audit_logs(actor_id, smart_walk_user_id, action, entity_type, entity_id)
  values (auth.uid(), updated_event.smart_walk_user_id, 'sos_acknowledged', 'sos_event', event_id);
  return updated_event;
end;
$$;

create or replace function public.resolve_sos(event_id uuid, note text)
returns public.sos_events
language plpgsql
security definer
set search_path = public
as $$
declare updated_event public.sos_events;
begin
  if nullif(trim(note), '') is null then
    raise exception 'A resolution note is required';
  end if;
  update public.sos_events
  set status = 'resolved',
      acknowledged_by = coalesce(acknowledged_by, auth.uid()),
      acknowledged_at = coalesce(acknowledged_at, now()),
      resolved_by = auth.uid(),
      resolved_at = now(),
      resolution_note = trim(note)
  where id = event_id
    and status in ('new', 'acknowledged')
    and public.can_access_user(smart_walk_user_id)
  returning * into updated_event;
  if updated_event.id is null then
    raise exception 'SOS event not found or already resolved';
  end if;
  insert into public.audit_logs(actor_id, smart_walk_user_id, action, entity_type, entity_id,
                                metadata)
  values (auth.uid(), updated_event.smart_walk_user_id, 'sos_resolved', 'sos_event', event_id,
          jsonb_build_object('resolution_note', trim(note)));
  return updated_event;
end;
$$;

revoke all on function public.acknowledge_sos(uuid) from public;
grant execute on function public.acknowledge_sos(uuid) to authenticated;
revoke all on function public.resolve_sos(uuid, text) from public;
grant execute on function public.resolve_sos(uuid, text) to authenticated;
