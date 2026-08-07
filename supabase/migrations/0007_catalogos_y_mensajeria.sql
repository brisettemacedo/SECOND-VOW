-- ============================================================
-- SECOND VOW — 0007 · Catálogos controlados + mensajería segura
-- Ejecutar DESPUÉS de 0006.
-- Incremental: NO recrea conversations/messages de 0005.
-- ============================================================

begin;


-- ============================================================
-- A) NORMALIZACIÓN DE CATÁLOGOS DEL VESTIDO
-- Los valores que se filtran o comparan dejan de depender de texto libre.
-- Se conservan las columnas text actuales para no romper el frontend, pero
-- ahora apuntan por FOREIGN KEY a catálogos administrables.
-- ============================================================

create table if not exists public.dress_size_catalog (
  code text primary key,
  label text not null,
  sort_order integer not null,
  is_active boolean not null default true
);

insert into public.dress_size_catalog(code,label,sort_order) values
('0','0',10),('2','2',20),('4','4',30),('6','6',40),('8','8',50),('10','10',60),
('12','12',70),('14','14',80),('16','16',90),('18','18',100),('20','20',110),
('22','22',120),('24','24',130),('26','26',140),('28','28',150),('30','30',160),
('32','32',170),('XS','XS',200),('S','S',210),('M','M',220),('L','L',230),
('XL','XL',240),('XXL','XXL',250)
on conflict(code) do update set label=excluded.label,sort_order=excluded.sort_order;

create table if not exists public.sizing_system_catalog (
  code text primary key,
  label text not null,
  sort_order integer not null,
  is_active boolean not null default true
);
insert into public.sizing_system_catalog(code,label,sort_order) values
('MX','MX',10),('US','US',20),('EU','EU',30),('UK','UK',40),('Otro','Otro',50)
on conflict(code) do update set label=excluded.label,sort_order=excluded.sort_order;

create table if not exists public.silhouette_catalog(code text primary key,label text not null,sort_order int not null,is_active boolean not null default true);
insert into public.silhouette_catalog values
('linea-a','Línea A',10,true),('sirena','Sirena',20,true),('fit-and-flare','Fit and flare',30,true),
('princesa','Princesa',40,true),('ball-gown','Ball gown',50,true),('recto-columna','Recto o columna',60,true),
('imperio','Imperio',70,true),('evase','Evasé',80,true),('mini','Mini',90,true),('midi','Midi',100,true),
('jumpsuit','Jumpsuit',110,true),('separados','Separados',120,true),('otro','Otro',999,true)
on conflict(code) do update set label=excluded.label,sort_order=excluded.sort_order,is_active=excluded.is_active;

create table if not exists public.neckline_catalog(code text primary key,label text not null,sort_order int not null,is_active boolean not null default true);
insert into public.neckline_catalog values
('strapless-recto','Strapless recto',10,true),('corazon','Corazón',20,true),('v','En V',30,true),('cuadrado','Cuadrado',40,true),
('halter','Halter',50,true),('barco','Barco',60,true),('cuello-alto','Cuello alto',70,true),('ilusion','Ilusión',80,true),
('asimetrico','Asimétrico',90,true),('off-shoulder','Off shoulder',100,true),('redondo','Redondo',110,true),('otro','Otro',999,true)
on conflict(code) do update set label=excluded.label,sort_order=excluded.sort_order,is_active=excluded.is_active;

create table if not exists public.back_catalog(code text primary key,label text not null,sort_order int not null,is_active boolean not null default true);
insert into public.back_catalog values
('abierta','Abierta',10,true),('baja','Baja',20,true),('cerrada','Cerrada',30,true),('corse','Corsé',40,true),
('botones','Con botones',50,true),('cierre','Con cierre',60,true),('ilusion','Transparente o ilusión',70,true),('v','En V',80,true),('otro','Otro',999,true)
on conflict(code) do update set label=excluded.label,sort_order=excluded.sort_order,is_active=excluded.is_active;

create table if not exists public.sleeve_catalog(code text primary key,label text not null,sort_order int not null,is_active boolean not null default true);
insert into public.sleeve_catalog values
('sin-mangas','Sin mangas',10,true),('tirantes-finos','Tirantes finos',20,true),('tirantes-anchos','Tirantes anchos',30,true),
('corta','Manga corta',40,true),('tres-cuartos','Manga tres cuartos',50,true),('larga','Manga larga',60,true),
('removible','Manga removible',70,true),('abullonada','Manga abullonada',80,true),('off-shoulder','Off shoulder',90,true),
('capa','Capa',100,true),('otro','Otro',999,true)
on conflict(code) do update set label=excluded.label,sort_order=excluded.sort_order,is_active=excluded.is_active;

create table if not exists public.fabric_catalog(code text primary key,label text not null,sort_order int not null,is_active boolean not null default true);
insert into public.fabric_catalog values
('mikado','Mikado',10,true),('saten','Satén',20,true),('crepe','Crepé',30,true),('tul','Tul',40,true),('encaje','Encaje',50,true),
('organza','Organza',60,true),('chifon','Chifón',70,true),('gasa','Gasa',80,true),('tafeta','Tafeta',90,true),
('charmeuse','Charmeuse',100,true),('seda','Seda',110,true),('georgette','Georgette',120,true),('otro','Otro',999,true)
on conflict(code) do update set label=excluded.label,sort_order=excluded.sort_order,is_active=excluded.is_active;

create table if not exists public.color_catalog(code text primary key,label text not null,sort_order int not null,is_active boolean not null default true);
insert into public.color_catalog values
('blanco','Blanco',10,true),('blanco-natural','Blanco natural',20,true),('ivory','Ivory o marfil',30,true),('off-white','Off-white',40,true),
('champagne','Champagne',50,true),('nude','Nude',60,true),('blush','Blush',70,true),('perla','Perla',80,true),('plata','Plata',90,true),('otro','Otro',999,true)
on conflict(code) do update set label=excluded.label,sort_order=excluded.sort_order,is_active=excluded.is_active;

create table if not exists public.train_catalog(code text primary key,label text not null,sort_order int not null,is_active boolean not null default true);
insert into public.train_catalog values
('sin-cola','Sin cola',10,true),('barrido','Barrido',20,true),('capilla','Capilla',30,true),('catedral','Catedral',40,true),('real','Real',50,true),('desmontable','Desmontable',60,true)
on conflict(code) do update set label=excluded.label,sort_order=excluded.sort_order,is_active=excluded.is_active;

create table if not exists public.condition_catalog(code text primary key,label text not null,sort_order int not null,is_active boolean not null default true);
insert into public.condition_catalog values
('nuevo-con-etiquetas','Nuevo con etiquetas',10,true),('nuevo-sin-etiquetas','Nuevo sin etiquetas',20,true),('nunca-usado','Nunca usado',30,true),
('usado-una-vez','Usado una vez',40,true),('usado-sesion-fotografica','Usado en sesión fotográfica',50,true),('muestra','Vestido de muestra',60,true),
('limpieza-profesional','Limpieza profesional realizada',70,true),('requiere-limpieza','Requiere limpieza',80,true)
on conflict(code) do update set label=excluded.label,sort_order=excluded.sort_order,is_active=excluded.is_active;

-- Quitar CHECKs duplicados: los FOREIGN KEY pasan a ser la fuente de verdad.
alter table public.dresses drop constraint if exists dresses_talla_etiqueta_controlada;
alter table public.dresses drop constraint if exists dresses_sistema_talla_check;
alter table public.dresses drop constraint if exists dresses_silueta_check;
alter table public.dresses drop constraint if exists dresses_escote_check;
alter table public.dresses drop constraint if exists dresses_espalda_check;
alter table public.dresses drop constraint if exists dresses_manga_check;
alter table public.dresses drop constraint if exists dresses_tela_principal_check;
alter table public.dresses drop constraint if exists dresses_tela_secundaria_check;
alter table public.dresses drop constraint if exists dresses_color_principal_check;
alter table public.dresses drop constraint if exists dresses_cola_check;
alter table public.dresses drop constraint if exists dresses_condicion_check;

alter table public.dresses drop constraint if exists dresses_size_catalog_fkey;
alter table public.dresses add constraint dresses_size_catalog_fkey foreign key(talla_etiqueta) references public.dress_size_catalog(code);
alter table public.dresses drop constraint if exists dresses_sizing_system_catalog_fkey;
alter table public.dresses add constraint dresses_sizing_system_catalog_fkey foreign key(sistema_talla) references public.sizing_system_catalog(code);
alter table public.dresses drop constraint if exists dresses_silhouette_catalog_fkey;
alter table public.dresses add constraint dresses_silhouette_catalog_fkey foreign key(silueta) references public.silhouette_catalog(code);
alter table public.dresses drop constraint if exists dresses_neckline_catalog_fkey;
alter table public.dresses add constraint dresses_neckline_catalog_fkey foreign key(escote) references public.neckline_catalog(code);
alter table public.dresses drop constraint if exists dresses_back_catalog_fkey;
alter table public.dresses add constraint dresses_back_catalog_fkey foreign key(espalda) references public.back_catalog(code);
alter table public.dresses drop constraint if exists dresses_sleeve_catalog_fkey;
alter table public.dresses add constraint dresses_sleeve_catalog_fkey foreign key(manga) references public.sleeve_catalog(code);
alter table public.dresses drop constraint if exists dresses_primary_fabric_catalog_fkey;
alter table public.dresses add constraint dresses_primary_fabric_catalog_fkey foreign key(tela_principal) references public.fabric_catalog(code);
alter table public.dresses drop constraint if exists dresses_secondary_fabric_catalog_fkey;
alter table public.dresses add constraint dresses_secondary_fabric_catalog_fkey foreign key(tela_secundaria) references public.fabric_catalog(code);
alter table public.dresses drop constraint if exists dresses_primary_color_catalog_fkey;
alter table public.dresses add constraint dresses_primary_color_catalog_fkey foreign key(color_principal) references public.color_catalog(code);
-- color_forro queda como texto opcional porque el esquema original permitía matices libres.
-- No se usa para filtros ni búsqueda y por eso no se usa como dimensión de catálogo.
alter table public.dresses drop constraint if exists dresses_train_catalog_fkey;
alter table public.dresses add constraint dresses_train_catalog_fkey foreign key(cola) references public.train_catalog(code);
alter table public.dresses drop constraint if exists dresses_condition_catalog_fkey;
alter table public.dresses add constraint dresses_condition_catalog_fkey foreign key(condicion) references public.condition_catalog(code);

-- Marca: una sola forma de escribir cada nombre sin distinguir mayúsculas.
create unique index if not exists brands_name_unique_ci on public.brands(lower(btrim(name)));

-- Rendimiento para un catálogo mucho mayor (50k+ vestidos).
create index if not exists idx_dresses_approved_brand_created on public.dresses(brand_id,created_at desc) where status='approved';
create index if not exists idx_dresses_approved_size_created on public.dresses(talla_etiqueta,created_at desc) where status='approved';
create index if not exists idx_dresses_approved_price on public.dresses(precio_venta_mxn) where status='approved';
create index if not exists idx_dresses_approved_silhouette on public.dresses(silueta) where status='approved';
create index if not exists idx_dresses_approved_condition on public.dresses(condicion) where status='approved';
create index if not exists idx_dresses_approved_published on public.dresses(published_at desc) where status='approved';

create unique index if not exists dress_photos_one_primary_per_dress
  on public.dress_photos(dress_id) where is_primary=true;
create unique index if not exists dress_photos_storage_path_unique
  on public.dress_photos(storage_path);

-- Los catálogos son de lectura pública; solo administración podrá mutarlos vía backend.
alter table public.dress_size_catalog enable row level security;
alter table public.sizing_system_catalog enable row level security;
alter table public.silhouette_catalog enable row level security;
alter table public.neckline_catalog enable row level security;
alter table public.back_catalog enable row level security;
alter table public.sleeve_catalog enable row level security;
alter table public.fabric_catalog enable row level security;
alter table public.color_catalog enable row level security;
alter table public.train_catalog enable row level security;
alter table public.condition_catalog enable row level security;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['dress_size_catalog','sizing_system_catalog','silhouette_catalog','neckline_catalog','back_catalog','sleeve_catalog','fabric_catalog','color_catalog','train_catalog','condition_catalog']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "catalog public read" ON public.%I',t);
    EXECUTE format('CREATE POLICY "catalog public read" ON public.%I FOR SELECT TO anon, authenticated USING (is_active=true OR public.is_admin())',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated',t);
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated',t);
  END LOOP;
END$$;

-- ============================================================
-- B) MENSAJERÍA
-- ============================================================

-- ------------------------------------------------------------
-- 1) Conversaciones: estado operativo y cierre
-- ------------------------------------------------------------
alter table public.conversations
  add column if not exists status text not null default 'active';

alter table public.conversations
  add column if not exists closed_at timestamptz;

alter table public.conversations
  add column if not exists updated_at timestamptz not null default now();

alter table public.conversations
  drop constraint if exists conversations_status_check;

alter table public.conversations
  add constraint conversations_status_check
  check (status in ('active','closed','blocked'));

create index if not exists idx_conversations_buyer_last
  on public.conversations (buyer_id, last_message_at desc);

create index if not exists idx_conversations_seller_last
  on public.conversations (seller_id, last_message_at desc);

-- ------------------------------------------------------------
-- 2) Estado individual de cada participante
-- Sirve para no leídos, silenciar y archivar sin alterar el chat.
-- ------------------------------------------------------------
create table if not exists public.conversation_participant_state (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz,
  muted boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists idx_conversation_state_user
  on public.conversation_participant_state (user_id, updated_at desc);

-- ------------------------------------------------------------
-- 3) Mensajes: tipos y borrado lógico administrativo
-- No permitimos edición libre para conservar evidencia.
-- ------------------------------------------------------------
alter table public.messages
  add column if not exists message_type text not null default 'text';

alter table public.messages
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.messages
  add column if not exists deleted_at timestamptz;

alter table public.messages
  add column if not exists deleted_by uuid references public.profiles(id);

alter table public.messages
  drop constraint if exists messages_message_type_check;

alter table public.messages
  add constraint messages_message_type_check
  check (message_type in ('text','image','system','offer','order'));

create index if not exists idx_messages_unread_lookup
  on public.messages (conversation_id, created_at desc)
  where deleted_at is null;

-- ------------------------------------------------------------
-- 4) Archivos adjuntos del chat
-- ------------------------------------------------------------
create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at timestamptz not null default now(),
  constraint message_attachments_path_nonempty check (btrim(storage_path) <> '')
);

create unique index if not exists message_attachments_storage_path_unique
  on public.message_attachments (storage_path);

create index if not exists idx_message_attachments_message
  on public.message_attachments (message_id);

-- ------------------------------------------------------------
-- 5) Bloqueos entre usuarias
-- El bloqueo evita nuevos mensajes, no destruye evidencia anterior.
-- ------------------------------------------------------------
create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

-- ------------------------------------------------------------
-- 6) Reportes de conversación para moderación
-- ------------------------------------------------------------
create table if not exists public.conversation_reports (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason_code text not null,
  details text,
  status text not null default 'open',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint conversation_reports_reason_check check (
    reason_code in ('fraud','off_platform_payment','harassment','spam','inappropriate_content','other')
  ),
  constraint conversation_reports_status_check check (
    status in ('open','under_review','resolved','dismissed')
  )
);

create index if not exists idx_conversation_reports_status
  on public.conversation_reports (status, created_at desc);

-- ------------------------------------------------------------
-- 7) Storage privado para imágenes del chat
-- Ruta obligatoria: {user_id}/{conversation_id}/{file}
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-attachments',
  'message-attachments',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- ------------------------------------------------------------
-- 8) Helpers de seguridad
-- ------------------------------------------------------------
create or replace function public.is_conversation_participant(p_conversation_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversations c
    where c.id = p_conversation_id
      and p_user_id in (c.buyer_id, c.seller_id)
  );
$$;

revoke all on function public.is_conversation_participant(uuid, uuid) from public;
grant execute on function public.is_conversation_participant(uuid, uuid) to authenticated;

create or replace function public.are_users_blocked(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = p_user_a and b.blocked_id = p_user_b)
       or (b.blocker_id = p_user_b and b.blocked_id = p_user_a)
  );
$$;

revoke all on function public.are_users_blocked(uuid, uuid) from public;
grant execute on function public.are_users_blocked(uuid, uuid) to authenticated;

-- ------------------------------------------------------------
-- 9) Trigger: validar cada mensaje aunque el frontend sea manipulado
-- ------------------------------------------------------------
create or replace function public.enforce_message_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.conversations;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;

  select * into c
  from public.conversations
  where id = new.conversation_id;

  if c.id is null then
    raise exception 'Conversación inexistente';
  end if;

  if new.sender_id <> auth.uid() then
    raise exception 'No puedes enviar mensajes como otra usuaria';
  end if;

  if auth.uid() not in (c.buyer_id, c.seller_id) then
    raise exception 'No perteneces a esta conversación';
  end if;

  if c.status <> 'active' then
    raise exception 'La conversación no está activa';
  end if;

  if public.are_users_blocked(c.buyer_id, c.seller_id) then
    raise exception 'La conversación está bloqueada';
  end if;

  if not public.is_active_user() then
    raise exception 'La cuenta no puede enviar mensajes';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_message_insert() from public;

drop trigger if exists messages_enforce_insert on public.messages;
create trigger messages_enforce_insert
  before insert on public.messages
  for each row
  execute function public.enforce_message_insert();

-- Mantiene last_message_at y crea estado de participantes cuando llega un mensaje.
create or replace function public.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.conversations;
begin
  update public.conversations
  set last_message_at = new.created_at,
      updated_at = now()
  where id = new.conversation_id
  returning * into c;

  insert into public.conversation_participant_state(conversation_id, user_id)
  values (c.id, c.buyer_id), (c.id, c.seller_id)
  on conflict (conversation_id, user_id) do nothing;

  -- El remitente ya leyó hasta su propio mensaje.
  update public.conversation_participant_state
  set last_read_at = new.created_at,
      updated_at = now()
  where conversation_id = c.id
    and user_id = new.sender_id;

  return new;
end;
$$;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
  after insert on public.messages
  for each row
  execute function public.touch_conversation();

-- ------------------------------------------------------------
-- 10) RPC: marcar conversación como leída
-- ------------------------------------------------------------
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_conversation_participant(p_conversation_id, auth.uid()) then
    raise exception 'No autorizado';
  end if;

  insert into public.conversation_participant_state(
    conversation_id, user_id, last_read_at, updated_at
  )
  values (p_conversation_id, auth.uid(), now(), now())
  on conflict (conversation_id, user_id)
  do update set last_read_at = excluded.last_read_at,
                updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.mark_conversation_read(uuid) from public;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- ------------------------------------------------------------
-- 11) RLS
-- ------------------------------------------------------------
alter table public.conversation_participant_state enable row level security;
alter table public.message_attachments enable row level security;
alter table public.user_blocks enable row level security;
alter table public.conversation_reports enable row level security;

-- Rehacemos policies de mensajes para incorporar bloqueos/estado.
drop policy if exists "participants read conversations" on public.conversations;
create policy "participants read conversations"
  on public.conversations for select to authenticated
  using (auth.uid() in (buyer_id, seller_id) or public.is_admin());

drop policy if exists "participants read messages" on public.messages;
create policy "participants read messages"
  on public.messages for select to authenticated
  using (
    public.is_conversation_participant(conversation_id, auth.uid())
    or public.is_admin()
  );

drop policy if exists "participants send messages" on public.messages;
create policy "participants send messages"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_participant(conversation_id, auth.uid())
  );

-- Nadie edita el contenido. read_at queda por compatibilidad con el frontend antiguo.
drop policy if exists "recipient marks read" on public.messages;
create policy "recipient marks read"
  on public.messages for update to authenticated
  using (public.is_conversation_participant(conversation_id, auth.uid()))
  with check (public.is_conversation_participant(conversation_id, auth.uid()));

-- Estado individual
drop policy if exists "participant reads own conversation state" on public.conversation_participant_state;
create policy "participant reads own conversation state"
  on public.conversation_participant_state for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "participant manages own conversation state" on public.conversation_participant_state;
create policy "participant manages own conversation state"
  on public.conversation_participant_state for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and public.is_conversation_participant(conversation_id, auth.uid())
  );

-- Adjuntos
drop policy if exists "participants read message attachments" on public.message_attachments;
create policy "participants read message attachments"
  on public.message_attachments for select to authenticated
  using (
    exists (
      select 1
      from public.messages m
      where m.id = message_id
        and (
          public.is_conversation_participant(m.conversation_id, auth.uid())
          or public.is_admin()
        )
    )
  );

drop policy if exists "sender creates message attachments" on public.message_attachments;
create policy "sender creates message attachments"
  on public.message_attachments for insert to authenticated
  with check (
    uploader_id = auth.uid()
    and exists (
      select 1
      from public.messages m
      where m.id = message_id
        and m.sender_id = auth.uid()
    )
  );

-- Bloqueos
drop policy if exists "user reads own blocks" on public.user_blocks;
create policy "user reads own blocks"
  on public.user_blocks for select to authenticated
  using (blocker_id = auth.uid() or public.is_admin());

drop policy if exists "user creates own block" on public.user_blocks;
create policy "user creates own block"
  on public.user_blocks for insert to authenticated
  with check (blocker_id = auth.uid());

drop policy if exists "user removes own block" on public.user_blocks;
create policy "user removes own block"
  on public.user_blocks for delete to authenticated
  using (blocker_id = auth.uid());

-- Reportes
drop policy if exists "reporter reads own conversation report" on public.conversation_reports;
create policy "reporter reads own conversation report"
  on public.conversation_reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());

drop policy if exists "participant creates conversation report" on public.conversation_reports;
create policy "participant creates conversation report"
  on public.conversation_reports for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and public.is_conversation_participant(conversation_id, auth.uid())
  );

drop policy if exists "admin manages conversation reports" on public.conversation_reports;
create policy "admin manages conversation reports"
  on public.conversation_reports for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Storage de adjuntos
drop policy if exists "message attachments upload own path" on storage.objects;
create policy "message attachments upload own path"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'message-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_conversation_participant(
      ((storage.foldername(name))[2])::uuid,
      auth.uid()
    )
  );

drop policy if exists "message attachments read participants" on storage.objects;
create policy "message attachments read participants"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'message-attachments'
    and (
      public.is_conversation_participant(
        ((storage.foldername(name))[2])::uuid,
        auth.uid()
      )
      or public.is_admin()
    )
  );

drop policy if exists "message attachments delete own" on storage.objects;
create policy "message attachments delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'message-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ------------------------------------------------------------
-- 12) Grants
-- ------------------------------------------------------------
revoke all on public.conversation_participant_state,
  public.message_attachments,
  public.user_blocks,
  public.conversation_reports
from anon, authenticated;

grant select, insert, update, delete on public.conversation_participant_state to authenticated;
grant select, insert on public.message_attachments to authenticated;
grant select, insert, delete on public.user_blocks to authenticated;
grant select, insert, update on public.conversation_reports to authenticated;

commit;
