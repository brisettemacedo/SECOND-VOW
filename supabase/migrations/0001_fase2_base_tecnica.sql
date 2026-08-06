-- ============================================================
-- SECOND VOW — 0001 · Base técnica corregida
-- Auth, perfiles, helpers de seguridad y Storage.
-- Ejecutar primero en Supabase > SQL Editor.
-- ============================================================

begin;

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Perfiles
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  city text,
  state text,
  avatar_url text,
  role text not null default 'user'
    check (role in ('user', 'admin')),
  is_blocked boolean not null default false,
  blocked_reason text,
  blocked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  identity_verified boolean not null default false,
  response_time_label text,
  rating_average numeric(2,1) check (rating_average is null or rating_average between 1 and 5)
);

comment on table public.profiles is
  'Perfil de usuario. role y datos de bloqueo son administrativos y no deben exponerse públicamente.';

-- Para proyectos donde ya existía la tabla sin updated_at.
alter table public.profiles
  add column if not exists updated_at timestamptz not null default now();
alter table public.profiles
  add column if not exists identity_verified boolean not null default false;
alter table public.profiles
  add column if not exists response_time_label text;
alter table public.profiles
  add column if not exists rating_average numeric(2,1);

-- ------------------------------------------------------------
-- Helpers SECURITY DEFINER
-- Evitan políticas recursivas sobre profiles.
-- ------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.is_blocked = false
    ),
    false
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_blocked = false
    ),
    false
  );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_active_user() from public;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_active_user() to authenticated;

-- ------------------------------------------------------------
-- Crear perfil automáticamente al registrarse
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ------------------------------------------------------------
-- updated_at de perfiles
-- ------------------------------------------------------------
create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_profiles_updated_at();

-- ------------------------------------------------------------
-- RLS de profiles
-- ------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "perfil propio o admin" on public.profiles;
create policy "perfil propio o admin"
  on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
  );

drop policy if exists "usuaria actualiza perfil propio" on public.profiles;
create policy "usuaria actualiza perfil propio"
  on public.profiles
  for update
  to authenticated
  using (
    id = auth.uid()
    and public.is_active_user()
  )
  with check (
    id = auth.uid()
    and public.is_active_user()
  );

-- Impide que el navegador actualice campos administrativos.
revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;

grant select on table public.profiles to authenticated;
grant update (full_name, city, state, avatar_url)
  on table public.profiles
  to authenticated;

-- Vista pública con únicamente columnas seguras.
drop view if exists public.public_profiles;
create view public.public_profiles
with (security_barrier = true)
as
select
  id,
  full_name,
  city,
  state,
  identity_verified,
  response_time_label,
  rating_average
from public.profiles
where is_blocked = false;

revoke all on table public.public_profiles from public;
grant select on table public.public_profiles to anon, authenticated;

-- ------------------------------------------------------------
-- Storage buckets
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('dress-images', 'dress-images', false),
  ('dispute-evidence', 'dispute-evidence', false)
on conflict (id) do update
set public = excluded.public;

-- ------------------------------------------------------------
-- Storage policies: avatars
-- Ruta: {user_id}/avatar.webp
-- ------------------------------------------------------------
drop policy if exists "avatares lectura publica" on storage.objects;
create policy "avatares lectura publica"
  on storage.objects
  for select
  to public
  using (bucket_id = 'avatars');

drop policy if exists "avatares insertar carpeta propia" on storage.objects;
create policy "avatares insertar carpeta propia"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and public.is_active_user()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatares actualizar carpeta propia" on storage.objects;
create policy "avatares actualizar carpeta propia"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and public.is_active_user()
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and public.is_active_user()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatares borrar carpeta propia" on storage.objects;
create policy "avatares borrar carpeta propia"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and public.is_active_user()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ------------------------------------------------------------
-- Storage policies iniciales: dress-images
-- Ruta: {user_id}/{dress_id}/{image_id}.webp
-- La lectura pública de aprobados se añade en 0002.
-- ------------------------------------------------------------
drop policy if exists "imagenes vestido leer carpeta propia" on storage.objects;
create policy "imagenes vestido leer carpeta propia"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'dress-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "imagenes vestido insertar carpeta propia" on storage.objects;
create policy "imagenes vestido insertar carpeta propia"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'dress-images'
    and public.is_active_user()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "imagenes vestido actualizar carpeta propia" on storage.objects;
create policy "imagenes vestido actualizar carpeta propia"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'dress-images'
    and public.is_active_user()
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'dress-images'
    and public.is_active_user()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "imagenes vestido borrar carpeta propia" on storage.objects;
create policy "imagenes vestido borrar carpeta propia"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'dress-images'
    and public.is_active_user()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- dispute-evidence queda sin políticas para anon/authenticated.
-- Debe accederse únicamente desde backend con service_role.

commit;
