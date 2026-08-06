-- ============================================================
-- SECOND VOW — 0003 · Favoritos corregidos
-- Requiere 0001 y 0002.
-- ============================================================

begin;

create table if not exists public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  dress_id uuid not null references public.dresses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, dress_id)
);

create index if not exists idx_favorites_user_created
  on public.favorites (user_id, created_at desc);

create index if not exists idx_favorites_dress
  on public.favorites (dress_id);

alter table public.favorites enable row level security;

drop policy if exists "ver favoritos propios" on public.favorites;
create policy "ver favoritos propios"
  on public.favorites
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "crear favorito propio" on public.favorites;
create policy "crear favorito propio"
  on public.favorites
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_active_user()
    and exists (
      select 1
      from public.dresses d
      where d.id = dress_id
        and d.status in ('approved', 'reserved', 'sold')
    )
  );

drop policy if exists "borrar favorito propio" on public.favorites;
create policy "borrar favorito propio"
  on public.favorites
  for delete
  to authenticated
  using (user_id = auth.uid());

revoke all on table public.favorites from anon, authenticated;
grant select, insert, delete on table public.favorites to authenticated;

commit;
