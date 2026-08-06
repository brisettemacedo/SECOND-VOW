-- ============================================================
-- SECOND VOW — 0002 · Catálogo corregido
-- Requiere 0001.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- Catálogos
-- ------------------------------------------------------------
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint brands_name_nonempty check (btrim(name) <> '')
);

create unique index if not exists brands_name_unique_ci
  on public.brands (lower(btrim(name)));

insert into public.brands (name) values
  ('Pronovias'), ('Rosa Clará'), ('Vera Wang'), ('Sophia Tolli'),
  ('Berta'), ('Nicole Miller'), ('Galia Lahav'), ('Zuhair Murad'),
  ('San Patrick'), ('Marchesa'), ('Jenny Yoo'), ('Justin Alexander'),
  ('Maggie Sottero'), ('Pnina Tornai'), ('Casablanca Bridal')
on conflict do nothing;

create table if not exists public.brand_suggestions (
  id uuid primary key default gen_random_uuid(),
  suggested_name text not null,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  constraint brand_suggestions_name_nonempty
    check (btrim(suggested_name) <> '')
);

create table if not exists public.characteristics (
  id text primary key,
  label text not null,
  constraint characteristics_id_nonempty check (btrim(id) <> ''),
  constraint characteristics_label_nonempty check (btrim(label) <> '')
);

insert into public.characteristics (id, label) values
  ('bordado', 'Bordado'),
  ('bordado-floral', 'Bordado floral'),
  ('estampado-floral', 'Estampado floral'),
  ('encaje-floral', 'Encaje floral'),
  ('apliques-florales', 'Apliques florales'),
  ('flores-3d', 'Flores tridimensionales'),
  ('pedreria', 'Pedrería'),
  ('cristales', 'Cristales'),
  ('perlas', 'Perlas'),
  ('lentejuelas', 'Lentejuelas'),
  ('canutillo', 'Canutillo'),
  ('chaquira', 'Chaquira'),
  ('glitter', 'Glitter'),
  ('hilo-metalico', 'Hilo metálico'),
  ('plumas', 'Plumas'),
  ('flecos', 'Flecos'),
  ('monos', 'Moños'),
  ('drapeado', 'Drapeado'),
  ('plisado', 'Plisado'),
  ('volantes', 'Volantes'),
  ('transparencia', 'Transparencia'),
  ('paneles-ilusion', 'Paneles ilusión'),
  ('botones-forrados', 'Botones forrados'),
  ('cinturon', 'Cinturón'),
  ('corse-visible', 'Corsé visible'),
  ('varillas', 'Varillas'),
  ('copas-integradas', 'Copas integradas'),
  ('bolsillos', 'Bolsillos'),
  ('sobrefalda', 'Sobrefalda'),
  ('falda-desmontable', 'Falda desmontable'),
  ('cola-desmontable', 'Cola desmontable'),
  ('mangas-desmontables', 'Mangas desmontables'),
  ('tirantes-removibles', 'Tirantes removibles'),
  ('capa-incluida', 'Capa incluida'),
  ('velo-incluido', 'Velo incluido'),
  ('polison', 'Polisón'),
  ('abertura-pierna', 'Abertura en pierna')
on conflict (id) do update set label = excluded.label;

-- ------------------------------------------------------------
-- Vestidos
-- Los campos del formulario nacen NULL para permitir borradores.
-- 0004 añade la validación de completitud al enviar a revisión.
-- ------------------------------------------------------------
create table if not exists public.dresses (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,

  brand_id uuid references public.brands(id),
  brand_suggestion_id uuid references public.brand_suggestions(id),
  model text,
  collection text,
  year_approx int,

  talla_etiqueta text,
  sistema_talla text not null default 'MX'
    check (sistema_talla in ('MX', 'US', 'EU', 'UK', 'Otro')),
  busto_cm numeric,
  cintura_cm numeric,
  cadera_cm numeric,
  largo_hombro_piso_cm numeric,
  altura_persona_cm numeric,
  altura_tacon_cm numeric,
  puede_ampliarse boolean,
  puede_reducirse boolean,

  silueta text check (silueta in (
    'linea-a','sirena','fit-and-flare','princesa','ball-gown','recto-columna',
    'imperio','evase','mini','midi','jumpsuit','separados','otro'
  )),
  escote text check (escote in (
    'strapless-recto','corazon','v','cuadrado','halter','barco',
    'cuello-alto','ilusion','asimetrico','off-shoulder','redondo','otro'
  )),
  espalda text check (espalda in (
    'abierta','baja','cerrada','corse','botones','cierre','ilusion','v','otro'
  )),
  manga text check (manga in (
    'sin-mangas','tirantes-finos','tirantes-anchos','corta','tres-cuartos',
    'larga','removible','abullonada','off-shoulder','capa','otro'
  )),
  tela_principal text check (tela_principal in (
    'mikado','saten','crepe','tul','encaje','organza','chifon','gasa',
    'tafeta','charmeuse','seda','georgette','otro'
  )),
  tela_secundaria text check (tela_secundaria in (
    'mikado','saten','crepe','tul','encaje','organza','chifon','gasa',
    'tafeta','charmeuse','seda','georgette','otro'
  )),
  color_principal text check (color_principal in (
    'blanco','blanco-natural','ivory','off-white','champagne','nude',
    'blush','perla','plata','otro'
  )),
  color_forro text,
  cola text check (cola in (
    'sin-cola','barrido','capilla','catedral','real','desmontable'
  )),
  cola_largo_cm numeric,

  condicion text check (condicion in (
    'nuevo-con-etiquetas','nuevo-sin-etiquetas','nunca-usado','usado-una-vez',
    'usado-sesion-fotografica','muestra','limpieza-profesional','requiere-limpieza'
  )),
  tiene_manchas boolean not null default false,
  tiene_jalones boolean not null default false,
  tiene_roturas boolean not null default false,
  dano_dobladillo boolean not null default false,
  falta_aplicaciones boolean not null default false,
  tiene_reparaciones boolean not null default false,
  tiene_decoloracion boolean not null default false,
  descripcion_danos text,

  tuvo_ajustes boolean not null default false,
  ajustes_detalle text,
  conserva_margen_costura boolean,

  precio_original_mxn integer,
  precio_venta_mxn integer,

  ciudad text,
  estado text,
  envio_nacional boolean not null default false,

  descripcion text,

  status text not null default 'draft' check (status in (
    'draft','pending_review','changes_requested','approved',
    'rejected','archived','reserved','sold'
  )),
  moderation_notes text,
  moderated_by uuid references public.profiles(id),
  moderated_at timestamptz,
  published_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint dresses_year_approx_valid
    check (year_approx is null or year_approx between 1950 and 2100),
  constraint dresses_measurements_positive check (
    (busto_cm is null or busto_cm > 0) and
    (cintura_cm is null or cintura_cm > 0) and
    (cadera_cm is null or cadera_cm > 0) and
    (largo_hombro_piso_cm is null or largo_hombro_piso_cm > 0) and
    (altura_persona_cm is null or altura_persona_cm > 0) and
    (altura_tacon_cm is null or altura_tacon_cm >= 0) and
    (cola_largo_cm is null or cola_largo_cm >= 0)
  ),
  constraint dresses_prices_valid check (
    (precio_original_mxn is null or precio_original_mxn > 0) and
    (precio_venta_mxn is null or precio_venta_mxn > 0)
  ),
  constraint dresses_brand_choice check (
    not (brand_id is not null and brand_suggestion_id is not null)
  )
);

-- Compatibilidad si se ejecuta sobre una versión anterior.
alter table public.dresses alter column talla_etiqueta drop not null;
alter table public.dresses alter column silueta drop not null;
alter table public.dresses alter column escote drop not null;
alter table public.dresses alter column espalda drop not null;
alter table public.dresses alter column manga drop not null;
alter table public.dresses alter column tela_principal drop not null;
alter table public.dresses alter column color_principal drop not null;
alter table public.dresses alter column cola drop not null;
alter table public.dresses alter column condicion drop not null;
alter table public.dresses alter column precio_venta_mxn drop not null;
alter table public.dresses alter column ciudad drop not null;
alter table public.dresses alter column estado drop not null;

create index if not exists idx_dresses_status on public.dresses (status);
create index if not exists idx_dresses_seller_status on public.dresses (seller_id, status);
create index if not exists idx_dresses_silueta on public.dresses (silueta);
create index if not exists idx_dresses_escote on public.dresses (escote);
create index if not exists idx_dresses_espalda on public.dresses (espalda);
create index if not exists idx_dresses_ciudad on public.dresses (ciudad);
create index if not exists idx_dresses_estado on public.dresses (estado);
create index if not exists idx_dresses_precio on public.dresses (precio_venta_mxn);
create index if not exists idx_dresses_talla on public.dresses (talla_etiqueta);
create index if not exists idx_dresses_status_created
  on public.dresses (status, created_at desc);

create table if not exists public.dress_characteristics (
  dress_id uuid not null references public.dresses(id) on delete cascade,
  characteristic_id text not null references public.characteristics(id),
  primary key (dress_id, characteristic_id)
);

create table if not exists public.dress_photos (
  id uuid primary key default gen_random_uuid(),
  dress_id uuid not null references public.dresses(id) on delete cascade,
  storage_path text not null,
  position integer not null default 0 check (position >= 0),
  is_primary boolean not null default false,
  classification text check (classification in (
    'frontal','trasera','lateral','escote','espalda','cola','tela',
    'etiqueta','ajuste','defecto','puesto','accesorio'
  )),
  created_at timestamptz not null default now(),
  constraint dress_photos_storage_path_nonempty check (btrim(storage_path) <> '')
);

create unique index if not exists dress_photos_storage_path_unique
  on public.dress_photos (storage_path);

create unique index if not exists dress_photos_one_primary_per_dress
  on public.dress_photos (dress_id)
  where is_primary = true;

create index if not exists idx_dress_photos_dress
  on public.dress_photos (dress_id, position);

-- ------------------------------------------------------------
-- Seguridad de cambios de vestido
-- RLS decide qué fila; el trigger protege campos y transiciones.
-- ------------------------------------------------------------
create or replace function public.enforce_dress_update_security()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_role text := auth.role();
  privileged boolean :=
    current_user in ('postgres', 'supabase_admin', 'service_role')
    or actor_role = 'service_role'
    or public.is_admin();
begin
  if privileged then
    return new;
  end if;

  if actor is null or old.seller_id <> actor or new.seller_id <> old.seller_id then
    raise exception 'No autorizado para modificar este vestido';
  end if;

  if not public.is_active_user() then
    raise exception 'La cuenta está bloqueada';
  end if;

  if old.status not in ('draft', 'changes_requested', 'rejected') then
    raise exception 'El vestido no puede editarse en su estado actual';
  end if;

  if new.status not in ('draft', 'pending_review', 'changes_requested', 'rejected', 'archived') then
    raise exception 'Transición de estado no permitida para la vendedora';
  end if;

  if new.moderation_notes is distinct from old.moderation_notes
     or new.moderated_by is distinct from old.moderated_by
     or new.moderated_at is distinct from old.moderated_at
     or new.published_at is distinct from old.published_at then
    raise exception 'Los campos de moderación solo pueden modificarse por administración';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_dress_update_security() from public;

create or replace function public.set_dress_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();

  if new.status = 'approved'
     and old.status is distinct from 'approved'
     and new.published_at is null then
    new.published_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists dresses_enforce_update_security on public.dresses;
create trigger dresses_enforce_update_security
  before update on public.dresses
  for each row
  execute function public.enforce_dress_update_security();

drop trigger if exists dresses_set_updated_at on public.dresses;
create trigger dresses_set_updated_at
  before update on public.dresses
  for each row
  execute function public.set_dress_updated_at();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.brands enable row level security;
alter table public.brand_suggestions enable row level security;
alter table public.characteristics enable row level security;
alter table public.dresses enable row level security;
alter table public.dress_characteristics enable row level security;
alter table public.dress_photos enable row level security;

drop policy if exists "marcas activas lectura publica" on public.brands;
create policy "marcas activas lectura publica"
  on public.brands for select to anon, authenticated
  using (is_active = true or public.is_admin());

drop policy if exists "caracteristicas lectura publica" on public.characteristics;
create policy "caracteristicas lectura publica"
  on public.characteristics for select to anon, authenticated
  using (true);

drop policy if exists "crear sugerencia de marca" on public.brand_suggestions;
create policy "crear sugerencia de marca"
  on public.brand_suggestions for insert to authenticated
  with check (
    seller_id = auth.uid()
    and public.is_active_user()
    and status = 'pending'
  );

drop policy if exists "ver sugerencias propias o admin" on public.brand_suggestions;
create policy "ver sugerencias propias o admin"
  on public.brand_suggestions for select to authenticated
  using (seller_id = auth.uid() or public.is_admin());

drop policy if exists "admin actualiza sugerencias" on public.brand_suggestions;
create policy "admin actualiza sugerencias"
  on public.brand_suggestions for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "ver vestidos aprobados propios o admin" on public.dresses;
create policy "ver vestidos aprobados propios o admin"
  on public.dresses for select to anon, authenticated
  using (
    status in ('approved', 'reserved', 'sold')
    or seller_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists "crear borrador propio" on public.dresses;
create policy "crear borrador propio"
  on public.dresses for insert to authenticated
  with check (
    seller_id = auth.uid()
    and public.is_active_user()
    and status = 'draft'
    and moderation_notes is null
    and moderated_by is null
    and moderated_at is null
    and published_at is null
  );

drop policy if exists "vendedora actualiza vestido propio" on public.dresses;
create policy "vendedora actualiza vestido propio"
  on public.dresses for update to authenticated
  using (
    seller_id = auth.uid()
    and public.is_active_user()
  )
  with check (
    seller_id = auth.uid()
    and public.is_active_user()
  );

drop policy if exists "admin actualiza cualquier vestido" on public.dresses;
create policy "admin actualiza cualquier vestido"
  on public.dresses for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin elimina cualquier vestido" on public.dresses;
create policy "admin elimina cualquier vestido"
  on public.dresses for delete to authenticated
  using (public.is_admin());

drop policy if exists "ver caracteristicas de vestido visible" on public.dress_characteristics;
create policy "ver caracteristicas de vestido visible"
  on public.dress_characteristics for select to anon, authenticated
  using (
    exists (
      select 1
      from public.dresses d
      where d.id = dress_id
    )
  );

drop policy if exists "editar caracteristicas de vestido propio" on public.dress_characteristics;
create policy "editar caracteristicas de vestido propio"
  on public.dress_characteristics for insert to authenticated
  with check (
    public.is_active_user()
    and exists (
      select 1 from public.dresses d
      where d.id = dress_id
        and d.seller_id = auth.uid()
        and d.status in ('draft', 'changes_requested', 'rejected')
    )
  );

drop policy if exists "quitar caracteristicas de vestido propio" on public.dress_characteristics;
create policy "quitar caracteristicas de vestido propio"
  on public.dress_characteristics for delete to authenticated
  using (
    public.is_active_user()
    and exists (
      select 1 from public.dresses d
      where d.id = dress_id
        and d.seller_id = auth.uid()
        and d.status in ('draft', 'changes_requested', 'rejected')
    )
  );

drop policy if exists "ver fotos de vestido visible" on public.dress_photos;
create policy "ver fotos de vestido visible"
  on public.dress_photos for select to anon, authenticated
  using (
    exists (
      select 1 from public.dresses d
      where d.id = dress_id
    )
  );

drop policy if exists "insertar fotos de vestido propio" on public.dress_photos;
create policy "insertar fotos de vestido propio"
  on public.dress_photos for insert to authenticated
  with check (
    public.is_active_user()
    and exists (
      select 1 from public.dresses d
      where d.id = dress_id
        and d.seller_id = auth.uid()
        and d.status in ('draft', 'changes_requested', 'rejected')
    )
  );

drop policy if exists "actualizar fotos de vestido propio" on public.dress_photos;
create policy "actualizar fotos de vestido propio"
  on public.dress_photos for update to authenticated
  using (
    public.is_active_user()
    and exists (
      select 1 from public.dresses d
      where d.id = dress_id
        and d.seller_id = auth.uid()
        and d.status in ('draft', 'changes_requested', 'rejected')
    )
  )
  with check (
    public.is_active_user()
    and exists (
      select 1 from public.dresses d
      where d.id = dress_id
        and d.seller_id = auth.uid()
        and d.status in ('draft', 'changes_requested', 'rejected')
    )
  );

drop policy if exists "borrar fotos de vestido propio" on public.dress_photos;
create policy "borrar fotos de vestido propio"
  on public.dress_photos for delete to authenticated
  using (
    public.is_active_user()
    and exists (
      select 1 from public.dresses d
      where d.id = dress_id
        and d.seller_id = auth.uid()
        and d.status in ('draft', 'changes_requested', 'rejected')
    )
  );

-- ------------------------------------------------------------
-- Grants API
-- ------------------------------------------------------------
revoke all on table public.brands from anon, authenticated;
revoke all on table public.characteristics from anon, authenticated;
revoke all on table public.brand_suggestions from anon, authenticated;
revoke all on table public.dresses from anon, authenticated;
revoke all on table public.dress_characteristics from anon, authenticated;
revoke all on table public.dress_photos from anon, authenticated;

grant select on public.brands, public.characteristics
  to anon, authenticated;

grant select, insert, update on public.brand_suggestions
  to authenticated;

grant select on public.dresses, public.dress_characteristics, public.dress_photos
  to anon, authenticated;

grant insert, update, delete on public.dresses
  to authenticated;

grant insert, delete on public.dress_characteristics
  to authenticated;

grant insert, update, delete on public.dress_photos
  to authenticated;

-- ------------------------------------------------------------
-- Storage: dress-images permanece PRIVADO.
-- Descarga pública de imágenes aprobadas vía Storage API + anon key.
-- No usar getPublicUrl; usar download() o createSignedUrl().
-- ------------------------------------------------------------
update storage.buckets
set public = false
where id = 'dress-images';

drop policy if exists "imagenes aprobadas lectura publica" on storage.objects;
create policy "imagenes aprobadas lectura publica"
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'dress-images'
    and (
      (
        (storage.foldername(name))[1] = auth.uid()::text
      )
      or public.is_admin()
      or exists (
        select 1
        from public.dresses d
        where d.id::text = (storage.foldername(name))[2]
          and d.status in ('approved', 'reserved', 'sold')
      )
    )
  );

-- Reemplaza las políticas iniciales de escritura por versiones
-- que validan también que el dress_id pertenece a la usuaria.
drop policy if exists "imagenes vestido insertar carpeta propia" on storage.objects;
create policy "imagenes vestido insertar carpeta propia"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'dress-images'
    and public.is_active_user()
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.dresses d
      where d.id::text = (storage.foldername(name))[2]
        and d.seller_id = auth.uid()
        and d.status in ('draft', 'changes_requested', 'rejected')
    )
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
    and exists (
      select 1
      from public.dresses d
      where d.id::text = (storage.foldername(name))[2]
        and d.seller_id = auth.uid()
        and d.status in ('draft', 'changes_requested', 'rejected')
    )
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
    and exists (
      select 1
      from public.dresses d
      where d.id::text = (storage.foldername(name))[2]
        and d.seller_id = auth.uid()
        and d.status in ('draft', 'changes_requested', 'rejected')
    )
  );

commit;
