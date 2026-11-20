create table public.pairing_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  smart_walk_user_id uuid references public.smart_walk_users(id) on delete cascade,
  device_id uuid references public.devices(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.pairing_codes enable row level security;

create policy "admins read pairing codes" on public.pairing_codes
  for select using (public.is_admin());

create or replace function public.generate_pairing_code(
  target_user_id uuid,
  target_device_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  generated_code text;
begin
  if not public.is_admin() then
    raise exception 'Only admins can generate pairing codes';
  end if;
  if target_device_id is not null and not exists (
    select 1 from public.devices
    where id = target_device_id and smart_walk_user_id = target_user_id
  ) then
    raise exception 'Device is not linked to the selected user';
  end if;

  loop
    generated_code := upper(
      substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
    );
    begin
      insert into public.pairing_codes (
        code, smart_walk_user_id, device_id, created_by, expires_at
      ) values (
        generated_code, target_user_id, target_device_id,
        auth.uid(), now() + interval '24 hours'
      );
      exit;
    exception when unique_violation then
    end;
  end loop;
  return generated_code;
end;
$$;

create or replace function public.consume_pairing_code(code_value text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  pairing public.pairing_codes;
begin
  select * into pairing
  from public.pairing_codes
  where code = upper(trim(code_value))
    and used_at is null
    and expires_at > now()
  for update;

  if pairing.id is null then
    raise exception 'Pairing code is invalid or expired';
  end if;

  insert into public.caregiver_user_access (
    caregiver_id, smart_walk_user_id
  ) values (
    auth.uid(), pairing.smart_walk_user_id
  ) on conflict do nothing;

  update public.pairing_codes
  set used_at = now(), used_by = auth.uid()
  where id = pairing.id;

  return pairing.smart_walk_user_id;
end;
$$;

revoke all on function public.generate_pairing_code(uuid, uuid) from public;
grant execute on function public.generate_pairing_code(uuid, uuid) to authenticated;
revoke all on function public.consume_pairing_code(text) from public;
grant execute on function public.consume_pairing_code(text) to authenticated;
