-- ============================================================
-- SECOND VOW — 0013 · Administración de publicaciones y moderación
-- REQUIERE 0001–0012 ya aplicadas.
-- NO modifica ni sustituye migraciones anteriores.
-- ============================================================
begin;

-- Historial inmutable de decisiones administrativas sobre publicaciones.
create table if not exists public.dress_moderation_history (
  id uuid primary key default gen_random_uuid(),
  dress_id uuid not null references public.dresses(id) on delete cascade,
  action text not null check (action in ('approved','changes_requested','rejected')),
  status_from text not null,
  status_to text not null,
  comments text,
  admin_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists idx_dress_moderation_history_dress_created
  on public.dress_moderation_history(dress_id, created_at desc);

alter table public.dress_moderation_history enable row level security;

drop policy if exists "seller or admin reads dress moderation history" on public.dress_moderation_history;
create policy "seller or admin reads dress moderation history"
  on public.dress_moderation_history
  for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.dresses d
      where d.id = dress_id and d.seller_id = auth.uid()
    )
  );

revoke all on public.dress_moderation_history from anon, authenticated;
grant select on public.dress_moderation_history to authenticated;

-- Toda decisión de publicación pasa por esta función para que quede trazabilidad.
create or replace function public.admin_moderate_dress(
  p_dress_id uuid,
  p_action text,
  p_comments text default null
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dress public.dresses;
  v_target text;
  v_comments text := nullif(btrim(coalesce(p_comments,'')), '');
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  if p_action not in ('approved','changes_requested','rejected') then
    raise exception 'Acción de moderación inválida';
  end if;

  select * into v_dress
  from public.dresses
  where id = p_dress_id
  for update;

  if v_dress.id is null then
    raise exception 'Publicación inexistente';
  end if;

  if v_dress.status <> 'pending_review' then
    raise exception 'La publicación ya no está pendiente de revisión';
  end if;

  if p_action in ('changes_requested','rejected') and v_comments is null then
    raise exception 'Debes indicar el motivo';
  end if;

  -- El esquema histórico de SECOND VOW usa "approved" como estado interno
  -- de una publicación visible. En la interfaz se presenta como "Publicado".
  v_target := p_action;

  update public.dresses
  set status = v_target,
      moderation_notes = v_comments,
      moderated_by = auth.uid(),
      moderated_at = now()
  where id = p_dress_id;

  insert into public.dress_moderation_history(
    dress_id, action, status_from, status_to, comments, admin_id
  ) values (
    p_dress_id, p_action, v_dress.status, v_target, v_comments, auth.uid()
  );

  return v_target;
end;
$$;

revoke all on function public.admin_moderate_dress(uuid,text,text) from public;
grant execute on function public.admin_moderate_dress(uuid,text,text) to authenticated;

commit;
