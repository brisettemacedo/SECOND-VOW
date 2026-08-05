-- ============================================================
-- SecondVow — Fase 4: Cuenta, favoritos y perfil
-- Requiere haber corrido antes 0001 y 0002.
-- ============================================================

create table if not exists favorites (
  user_id uuid references profiles(id) on delete cascade not null,
  dress_id uuid references dresses(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  primary key (user_id, dress_id)
);

create index if not exists idx_favorites_user on favorites (user_id, created_at desc);

alter table favorites enable row level security;

-- Cada usuaria ve, crea y borra únicamente sus propios favoritos.
create policy "ver mis favoritos" on favorites
  for select using (user_id = auth.uid());

create policy "crear mi favorito" on favorites
  for insert with check (user_id = auth.uid());

create policy "borrar mi favorito" on favorites
  for delete using (user_id = auth.uid());

-- Índice de apoyo para "número de publicaciones activas" en el perfil público
create index if not exists idx_dresses_seller_status on dresses (seller_id, status);
