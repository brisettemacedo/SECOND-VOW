-- ============================================================
-- SecondVow — Fase 3: Catálogo de vestidos
-- Requiere haber corrido antes 0001_fase2_base_tecnica.sql
-- Pegar en Supabase > SQL Editor > Run.
-- ============================================================

-- ============================================================
-- 1. MARCAS (catálogo controlado con flujo de sugerencia)
-- ============================================================
create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Semilla inicial. Se puede ampliar después desde el panel admin (Fase 7).
insert into brands (name) values
  ('Pronovias'), ('Rosa Clará'), ('Vera Wang'), ('Sophia Tolli'),
  ('Berta'), ('Nicole Miller'), ('Galia Lahav'), ('Zuhair Murad'),
  ('San Patrick'), ('Marchesa'), ('Jenny Yoo'), ('Justin Alexander'),
  ('Maggie Sottero'), ('Pnina Tornai'), ('Casablanca Bridal')
on conflict (name) do nothing;

-- "Otra marca": la vendedora sugiere, no se agrega sola al catálogo público.
create table if not exists brand_suggestions (
  id uuid primary key default gen_random_uuid(),
  suggested_name text not null,
  seller_id uuid references profiles(id) not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- 2. CARACTERÍSTICAS (catálogo controlado, selección múltiple)
-- ============================================================
create table if not exists characteristics (
  id text primary key,
  label text not null
);

insert into characteristics (id, label) values
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
on conflict (id) do nothing;

-- ============================================================
-- 3. VESTIDOS
-- ============================================================
create table if not exists dresses (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references profiles(id) not null,

  -- Marca y modelo
  brand_id uuid references brands(id),
  brand_suggestion_id uuid references brand_suggestions(id),
  model text,
  collection text,
  year_approx int,

  -- Talla y medidas (sección 7.4). Centímetros como unidad principal.
  talla_etiqueta text not null,
  sistema_talla text not null default 'MX' check (sistema_talla in ('MX', 'US', 'EU', 'UK', 'Otro')),
  busto_cm numeric,
  cintura_cm numeric,
  cadera_cm numeric,
  largo_hombro_piso_cm numeric,
  altura_persona_cm numeric,
  altura_tacon_cm numeric,
  puede_ampliarse boolean,
  puede_reducirse boolean,

  -- Construcción (catálogos controlados, secciones 7.5–7.9)
  silueta text not null check (silueta in (
    'linea-a','sirena','fit-and-flare','princesa','ball-gown','recto-columna',
    'imperio','evase','mini','midi','jumpsuit','separados','otro'
  )),
  escote text not null check (escote in (
    'strapless-recto','corazon','v','cuadrado','halter','barco',
    'cuello-alto','ilusion','asimetrico','off-shoulder','redondo','otro'
  )),
  espalda text not null check (espalda in (
    'abierta','baja','cerrada','corse','botones','cierre','ilusion','v','otro'
  )),
  manga text not null check (manga in (
    'sin-mangas','tirantes-finos','tirantes-anchos','corta','tres-cuartos',
    'larga','removible','abullonada','off-shoulder','capa','otro'
  )),
  tela_principal text not null check (tela_principal in (
    'mikado','saten','crepe','tul','encaje','organza','chifon','gasa',
    'tafeta','charmeuse','seda','georgette','otro'
  )),
  tela_secundaria text check (tela_secundaria in (
    'mikado','saten','crepe','tul','encaje','organza','chifon','gasa',
    'tafeta','charmeuse','seda','georgette','otro'
  )),
  color_principal text not null check (color_principal in (
    'blanco','blanco-natural','ivory','off-white','champagne','nude',
    'blush','perla','plata','otro'
  )),
  color_forro text,
  cola text not null check (cola in (
    'sin-cola','barrido','capilla','catedral','real','desmontable'
  )),
  cola_largo_cm numeric,

  -- Condición (sección 7.13)
  condicion text not null check (condicion in (
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

  -- Ajustes (sección 7.14)
  tuvo_ajustes boolean not null default false,
  ajustes_detalle text,
  conserva_margen_costura boolean,

  -- Comercial
  precio_original_mxn integer,
  precio_venta_mxn integer not null check (precio_venta_mxn > 0),

  -- Ubicación y entrega (nunca domicilio exacto — solo ciudad/estado)
  ciudad text not null,
  estado text not null,
  envio_nacional boolean not null default false,
  entrega_presencial boolean not null default false,
  prueba_presencial boolean not null default false,

  descripcion text,

  -- Moderación (sección 9 / 15) — NUNCA confiar en esto desde el navegador
  status text not null default 'draft' check (status in (
    'draft','pending_review','changes_requested','approved',
    'rejected','archived','reserved','sold'
  )),
  moderation_notes text,
  moderated_by uuid references profiles(id),
  moderated_at timestamptz,
  published_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dresses_status on dresses (status);
create index if not exists idx_dresses_silueta on dresses (silueta);
create index if not exists idx_dresses_escote on dresses (escote);
create index if not exists idx_dresses_espalda on dresses (espalda);
create index if not exists idx_dresses_ciudad on dresses (ciudad);
create index if not exists idx_dresses_estado on dresses (estado);
create index if not exists idx_dresses_precio on dresses (precio_venta_mxn);
create index if not exists idx_dresses_talla on dresses (talla_etiqueta);
create index if not exists idx_dresses_status_created on dresses (status, created_at desc);

-- ============================================================
-- 4. CARACTERÍSTICAS POR VESTIDO (muchos a muchos)
-- ============================================================
create table if not exists dress_characteristics (
  dress_id uuid references dresses(id) on delete cascade,
  characteristic_id text references characteristics(id),
  primary key (dress_id, characteristic_id)
);

-- ============================================================
-- 5. FOTOGRAFÍAS
-- ============================================================
create table if not exists dress_photos (
  id uuid primary key default gen_random_uuid(),
  dress_id uuid references dresses(id) on delete cascade not null,
  storage_path text not null,
  position int not null default 0,
  is_primary boolean not null default false,
  classification text check (classification in (
    'frontal','trasera','lateral','escote','espalda','cola','tela',
    'etiqueta','ajuste','defecto','puesto','accesorio'
  )),
  created_at timestamptz not null default now()
);

create index if not exists idx_dress_photos_dress on dress_photos (dress_id);

-- ============================================================
-- SEGURIDAD (RLS)
-- ============================================================
alter table brands enable row level security;
alter table brand_suggestions enable row level security;
alter table characteristics enable row level security;
alter table dresses enable row level security;
alter table dress_characteristics enable row level security;
alter table dress_photos enable row level security;

-- Catálogos de solo lectura pública
create policy "marcas lectura publica" on brands for select using (true);
create policy "caracteristicas lectura publica" on characteristics for select using (true);

-- Sugerencias de marca: cada quien ve las suyas; cualquiera autenticada puede sugerir
create policy "crear sugerencia de marca" on brand_suggestions
  for insert with check (seller_id = auth.uid());
create policy "ver mis sugerencias de marca" on brand_suggestions
  for select using (
    seller_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Vestidos: público ve solo aprobados; la dueña ve los suyos en cualquier estado;
-- admin ve todo (para cuando exista el panel de moderación en la Fase 7).
create policy "ver vestidos aprobados o propios" on dresses
  for select using (
    status = 'approved'
    or seller_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "crear mi vestido" on dresses
  for insert with check (
    seller_id = auth.uid()
    and status in ('draft', 'pending_review')
  );

-- La vendedora puede editar TODO menos los campos de moderación, y nunca
-- puede ponerse a sí misma en 'approved'.
create policy "vendedora edita su vestido sin poderes de moderacion" on dresses
  for update
  using (seller_id = auth.uid())
  with check (
    seller_id = auth.uid()
    and status <> 'approved'
    and moderation_notes is not distinct from (select d.moderation_notes from dresses d where d.id = dresses.id)
    and moderated_by is not distinct from (select d.moderated_by from dresses d where d.id = dresses.id)
    and moderated_at is not distinct from (select d.moderated_at from dresses d where d.id = dresses.id)
  );

-- Admin puede todo (moderar, aprobar, rechazar) — política separada,
-- se combinan con OR frente a la de arriba.
create policy "admin modera cualquier vestido" on dresses
  for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Características por vestido: visibles si el vestido es visible; editables solo por la dueña
create policy "ver caracteristicas de vestidos visibles" on dress_characteristics
  for select using (
    exists (
      select 1 from dresses d where d.id = dress_id
      and (d.status = 'approved' or d.seller_id = auth.uid())
    )
  );
create policy "vendedora asigna caracteristicas a su vestido" on dress_characteristics
  for insert with check (
    exists (select 1 from dresses d where d.id = dress_id and d.seller_id = auth.uid())
  );
create policy "vendedora quita caracteristicas de su vestido" on dress_characteristics
  for delete using (
    exists (select 1 from dresses d where d.id = dress_id and d.seller_id = auth.uid())
  );

-- Fotos: mismas reglas de visibilidad que el vestido; solo la dueña sube/edita/borra
create policy "ver fotos de vestidos visibles" on dress_photos
  for select using (
    exists (
      select 1 from dresses d where d.id = dress_id
      and (d.status = 'approved' or d.seller_id = auth.uid())
    )
  );
create policy "vendedora sube fotos a su vestido" on dress_photos
  for insert with check (
    exists (select 1 from dresses d where d.id = dress_id and d.seller_id = auth.uid())
  );
create policy "vendedora edita fotos de su vestido" on dress_photos
  for update using (
    exists (select 1 from dresses d where d.id = dress_id and d.seller_id = auth.uid())
  );
create policy "vendedora borra fotos de su vestido" on dress_photos
  for delete using (
    exists (select 1 from dresses d where d.id = dress_id and d.seller_id = auth.uid())
  );

-- ============================================================
-- CORRECCIÓN sobre la Fase 2: el bucket "dress-images" se creó
-- como privado, pero Supabase solo aplica las políticas RLS de
-- storage.objects en las rutas AUTENTICADAS, no en la ruta pública
-- que usan las visitantes sin sesión para ver el catálogo. Sin este
-- cambio, nadie sin cuenta podría ver ninguna foto de vestido.
-- Quién puede SUBIR/EDITAR/BORRAR sigue protegido por las políticas
-- de "propia carpeta" ya definidas — esto solo afecta la lectura.
-- ============================================================
update storage.buckets set public = true where id = 'dress-images';

-- ============================================================
-- Actualiza el bloqueo documentado en la Fase 2: ahora que existe
-- "dresses", registramos también la política a nivel de fila (útil
-- si en el futuro se sirven fotos por la ruta autenticada, ej. para
-- previsualizar borradores en el panel de la vendedora).
-- ============================================================
create policy "fotos de vestido: lectura publica si aprobado" on storage.objects
  for select using (
    bucket_id = 'dress-images'
    and exists (
      select 1 from dresses d
      where d.id::text = (storage.foldername(name))[2]
      and d.status = 'approved'
    )
  );

-- ============================================================
-- updated_at automático
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists dresses_set_updated_at on dresses;
create trigger dresses_set_updated_at
  before update on dresses
  for each row execute procedure public.set_updated_at();
