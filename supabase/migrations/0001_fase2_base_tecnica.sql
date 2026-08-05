-- ============================================================
-- SecondVow — Fase 2: Base técnica (auth, perfiles, storage)
-- Pegar en Supabase > SQL Editor > Run.
-- Esta migración reemplaza el esquema anterior más simple; NO la
-- mezcles con el SQL viejo de la conversación previa a esta fase.
-- ============================================================

-- ---------- EXTENSIÓN NECESARIA PARA gen_random_uuid() ----------
create extension if not exists "pgcrypto";

-- ---------- PERFILES ----------
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  city text,
  state text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  is_blocked boolean not null default false,
  blocked_reason text,
  blocked_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table profiles is 'Extiende auth.users con datos públicos y de moderación. NUNCA confiar en role/is_blocked enviados desde el navegador.';

-- ---------- CREACIÓN AUTOMÁTICA DE PERFIL AL REGISTRARSE ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- SEGURIDAD (RLS)
-- ============================================================
alter table profiles enable row level security;

-- Lectura pública: solo de datos que son seguros de mostrar.
-- (En Next.js, selecciona explícitamente las columnas públicas al
-- consultar esta tabla — no hagas "select *" desde el cliente.)
create policy "perfiles lectura publica"
  on profiles for select
  using (true);

-- Una usuaria puede actualizar su propio perfil, PERO no puede
-- cambiarse a sí misma el rol ni desbloquearse. Esto se hace
-- comparando el valor nuevo contra el valor ya guardado en la fila.
create policy "usuarias editan su perfil sin escalar privilegios"
  on profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from profiles p where p.id = auth.uid())
    and is_blocked = (select p.is_blocked from profiles p where p.id = auth.uid())
  );

-- No se permite insertar perfiles manualmente desde el cliente:
-- se crean únicamente vía el trigger handle_new_user() (security definer).
-- (No se crea policy de insert => queda bloqueado por defecto con RLS activo.)

-- ============================================================
-- STORAGE — buckets
-- ============================================================

-- Avatares: público para lectura (son fotos de perfil, no sensibles)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Fotos de vestidos: privado por ahora. La lectura pública de fotos
-- de vestidos APROBADOS se habilitará en la Fase 3, cuando exista la
-- tabla "dresses" con su columna "status". Documentado como bloqueo
-- real, no un olvido.
insert into storage.buckets (id, name, public)
values ('dress-images', 'dress-images', false)
on conflict (id) do nothing;

-- Evidencia de disputas: privado, sin políticas públicas. Solo
-- accesible vía service_role (Edge Functions), nunca desde el navegador.
insert into storage.buckets (id, name, public)
values ('dispute-evidence', 'dispute-evidence', false)
on conflict (id) do nothing;

-- ---------- Políticas de Storage: avatars ----------
-- Convención de ruta: avatars/{user_id}/avatar.webp
create policy "avatares lectura publica"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatares solo su propia carpeta (insert)"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatares solo su propia carpeta (update)"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatares solo su propia carpeta (delete)"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------- Políticas de Storage: dress-images ----------
-- Convención de ruta: dress-images/{user_id}/{dress_id}/{image_id}.webp
-- Por ahora SOLO la propia dueña puede leer/escribir sus fotos.
-- TODO Fase 3: agregar policy de "select" pública cuando exista
-- dresses.status = 'approved', uniendo contra la tabla dresses.
create policy "fotos de vestido: propia carpeta (select)"
  on storage.objects for select
  using (
    bucket_id = 'dress-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "fotos de vestido: propia carpeta (insert)"
  on storage.objects for insert
  with check (
    bucket_id = 'dress-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "fotos de vestido: propia carpeta (update)"
  on storage.objects for update
  using (
    bucket_id = 'dress-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "fotos de vestido: propia carpeta (delete)"
  on storage.objects for delete
  using (
    bucket_id = 'dress-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- "dispute-evidence" no recibe ninguna policy pública a propósito:
-- con RLS activo y cero policies, queda cerrado para todo el mundo
-- excepto llamadas hechas con la service_role key (Edge Functions).

-- ============================================================
-- CÓMO CONVERTIRTE EN ADMINISTRADORA (todavía manual en esta fase;
-- el panel de administración real llega en la Fase 7)
-- 1. Regístrate normalmente en el sitio.
-- 2. Supabase > Table Editor > tabla "profiles".
-- 3. Busca tu fila y cambia "role" de 'user' a 'admin'.
-- ============================================================
